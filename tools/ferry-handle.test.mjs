// ferry-handle.test.mjs — a delivery path is built only from a handle that is
// one well-formed segment and names a real room whose card says that handle.
//   node --test tools/ferry-handle.test.mjs
// Zero-dep; synthetic towns and real git repos in tmpdir.
//
// The law (envelope.mjs § the handle grammar, § collectHandles, § deliveryInbox):
//
//   · a room registers under its own folder name, and only when its ADDRESS.md
//     card says that same name and the name is a well-formed handle;
//   · the ferry asks the disk again where it builds the path, and anything that
//     fails bounces the one letter by name — the crossing goes on, every other
//     letter in it is delivered, and nothing is written outside the recipient's
//     own WHITE_PAGES/<handle>/inbox/;
//   · ballot-pass, the other crossing step that turns a letter's handle into a
//     path, holds the voter to the same grammar.
//
// THE FLIP is collectHandles restored to registering the card's value
// (`handles.add(fields.handle)` with the mismatch only warning), the HANDLE_RE
// guard in classify() and the deliveryInbox check in ferry.mjs § sweep removed:
// the crossing tests then red — a letter lands under another room's folder, and
// a crossing exits 1 with every other letter undelivered. (Take out only the
// registry and the sweep check and the classify guard still bounces the first
// two letters: each layer holds on its own.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { classify, collectHandles, deliveryInbox, remedyFor } from './envelope.mjs';
import { ballotPass } from './ballot-pass.mjs';

const FERRY = resolve(dirname(fileURLToPath(import.meta.url)), 'ferry.mjs');

function git(repo, args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${repo}:\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

const address = (handle) => `---\nhandle: ${handle}\nagent: ${handle}\ngithub: ${handle}\n---\n\nA test room.\n`;
const letter = (from, to, id) => `---\nid: ${id}\nfrom: ${from}\nto: ${to}\ndate: 2026-10-05\n---\n\nHello from ${from}.\n`;

// Rooms alice, bob and carol, each with a card naming itself, and one ordinary
// letter bob → carol that every crossing below must still deliver. `cards`
// overrides a room's card handle. The town sits one folder down in its own tmp
// root so a path that leaves the town is still inside the test's sandbox.
function buildTown({ cards = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ferry-handle-'));
  const town = join(root, 'town');
  for (const room of ['alice', 'bob', 'carol']) {
    mkdirSync(join(town, 'WHITE_PAGES', room, 'inbox'), { recursive: true });
    mkdirSync(join(town, 'WHITE_PAGES', room, 'outbox'), { recursive: true });
    mkdirSync(join(town, 'WHITE_PAGES', room, 'HOME'), { recursive: true });
    writeFileSync(join(town, 'WHITE_PAGES', room, 'ADDRESS.md'), address(cards[room] ?? room));
    writeFileSync(join(town, 'WHITE_PAGES', room, 'inbox', '.gitkeep'), '');
    writeFileSync(join(town, 'WHITE_PAGES', room, 'outbox', '.gitkeep'), '');
    writeFileSync(join(town, 'WHITE_PAGES', room, 'HOME', 'HOME.md'), `# ${room}\n`);
  }
  writeFileSync(join(town, 'WHITE_PAGES', 'bob', 'outbox', 'letter-2026-10-05-hello.md'),
    letter('bob', 'carol', 'bob-2026-10-05-hello'));
  writeFileSync(join(town, 'WHITE_PAGES', 'mail-ledger.md'), '# Mail ledger\n\n');
  spawnSync('git', ['init', '-b', 'main', town], { encoding: 'utf8' });
  git(town, ['config', 'user.email', 'ferry@test.local']);
  git(town, ['config', 'user.name', 'ferry test']);
  git(town, ['config', 'core.autocrlf', 'false']);
  return { root, town };
}

function commit(town, msg = 'the town') {
  git(town, ['add', '-A']);
  git(town, ['commit', '-qm', msg]);
}

const runFerry = (town) =>
  spawnSync('node', [FERRY, '--repo', town, '--date', '2026-10-05'], { encoding: 'utf8' });

const ledgerOf = (town) => readFileSync(join(town, 'WHITE_PAGES', 'mail-ledger.md'), 'utf8');

// ── the crossing ────────────────────────────────────────────────────────────

test('a card naming another room\'s folder registers nothing; the letter to it bounces and lands nowhere', () => {
  const { root, town } = buildTown({ cards: { alice: 'bob/HOME' } });
  try {
    const folder = join(town, 'WHITE_PAGES', 'alice', 'outbox', 'letter-2026-10-05-parcel');
    mkdirSync(folder);
    writeFileSync(join(folder, 'letter.md'), letter('alice', 'bob/HOME', 'alice-2026-10-05-parcel'));
    writeFileSync(join(folder, 'enclosure.txt'), 'an enclosure\n');
    commit(town);

    const r = runFerry(town);
    assert.equal(r.status, 0, `the crossing refused:\n${r.stdout}\n${r.stderr}`);
    assert.equal(existsSync(join(town, 'WHITE_PAGES', 'bob', 'HOME', 'inbox')), false,
      'a letter was delivered under another room\'s folder');
    assert.ok(existsSync(join(folder, 'letter.md')), 'the bounced letter stays in its sender\'s outbox');
    assert.match(ledgerOf(town), /BOUNCE · WHITE_PAGES\/alice\/outbox\/letter-2026-10-05-parcel \(from alice\): unknown recipient: "bob\/HOME"/);
    assert.ok(existsSync(join(town, 'WHITE_PAGES', 'carol', 'inbox', 'bob-2026-10-05-hello.md')),
      'the ordinary letter in the same crossing was not delivered');
    assert.match(r.stdout, /registry: WARN alice\/ADDRESS\.md declares handle "bob\/HOME" \(dir mismatch\) — skipping room/);
    assert.equal(git(town, ['status', '--porcelain']), '', 'the crossing left changes outside its own commit');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a card naming a path outside the town registers nothing; the crossing goes on and writes nothing outside', () => {
  const { root, town } = buildTown({ cards: { alice: '../../outside' } });
  try {
    writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'outbox', 'letter-2026-10-05-away.md'),
      letter('alice', '../../outside', 'alice-2026-10-05-away'));
    commit(town);

    const r = runFerry(town);
    assert.equal(r.status, 0, `the crossing refused:\n${r.stdout}\n${r.stderr}`);
    assert.equal(existsSync(join(root, 'outside')), false, 'the crossing wrote outside the town');
    assert.ok(existsSync(join(town, 'WHITE_PAGES', 'carol', 'inbox', 'bob-2026-10-05-hello.md')),
      'the ordinary letter in the same crossing was not delivered');
    assert.match(ledgerOf(town), /BOUNCE · WHITE_PAGES\/alice\/outbox\/letter-2026-10-05-away\.md \(from alice\): unknown recipient/);
    assert.ok(existsSync(join(town, 'WHITE_PAGES', 'alice', 'inbox', 'bounce-2026-10-05-letter-2026-10-05-away.md')),
      'the sender was not told');
    assert.equal(git(town, ['status', '--porcelain']), '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a recipient room whose inbox is not a folder bounces the letter by name, at the crossing', (t) => {
  const { root, town } = buildTown();
  try {
    const inbox = join(town, 'WHITE_PAGES', 'carol', 'inbox');
    rmSync(inbox, { recursive: true, force: true });
    try {
      symlinkSync(join('..', 'carol', 'HOME'), inbox);
    } catch (error) {
      if (error.code === 'EPERM') { t.skip('this machine cannot make symlinks'); return; }
      throw error;
    }
    commit(town);

    const r = runFerry(town);
    assert.equal(r.status, 0, `the crossing refused:\n${r.stdout}\n${r.stderr}`);
    assert.equal(existsSync(join(town, 'WHITE_PAGES', 'carol', 'HOME', 'bob-2026-10-05-hello.md')), false,
      'the letter was written through the link');
    assert.match(ledgerOf(town), /BOUNCE · WHITE_PAGES\/bob\/outbox\/letter-2026-10-05-hello\.md \(from bob\): undeliverable recipient room: "carol" has an inbox that is not a folder/);
    assert.match(readFileSync(join(town, 'WHITE_PAGES', 'bob', 'inbox', 'bounce-2026-10-05-letter-2026-10-05-hello.md'), 'utf8'),
      /What to do: the recipient's room is not in a deliverable state/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── the law, unit by unit ───────────────────────────────────────────────────

test('collectHandles registers a room only under its own well-formed folder name', () => {
  const { root, town } = buildTown({ cards: { alice: 'Alice', bob: 'carol' } });
  try {
    mkdirSync(join(town, 'WHITE_PAGES', 'Dot_Room'));
    writeFileSync(join(town, 'WHITE_PAGES', 'Dot_Room', 'ADDRESS.md'), address('Dot_Room'));
    const { handles, warnings } = collectHandles(town);
    assert.deepEqual([...handles].sort(), ['carol']);
    assert.ok(warnings.some((w) => /alice\/ADDRESS\.md declares handle "Alice" \(dir mismatch\) — skipping room/.test(w)));
    assert.ok(warnings.some((w) => /bob\/ADDRESS\.md declares handle "carol" \(dir mismatch\) — skipping room/.test(w)));
    assert.ok(warnings.some((w) => /Dot_Room\/ADDRESS\.md declares handle "Dot_Room", which is not a well-formed handle — skipping room/.test(w)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('classify refuses a recipient that is not one handle, even from a set that lists it', () => {
  const fields = { id: 'alice-2026-10-05-x', from: 'alice', to: '../x', date: '2026-10-05' };
  const defect = classify(fields, 'alice', new Set(['../x']), { deliveredIds: new Set() });
  assert.equal(defect, 'unsafe recipient handle: "../x"');
  assert.ok(remedyFor(defect));
});

test('deliveryInbox vouches only for a real room whose card says its name', () => {
  const { root, town } = buildTown({ cards: { bob: 'carol' } });
  try {
    assert.equal(deliveryInbox(town, 'carol').inbox, join(resolve(town), 'WHITE_PAGES', 'carol', 'inbox'));
    assert.match(deliveryInbox(town, 'bob').defect, /"bob" has an ADDRESS\.md that names another handle/);
    assert.match(deliveryInbox(town, 'nobody').defect, /"nobody" has no room folder/);
    assert.match(deliveryInbox(town, 'carol/HOME').defect, /is not a well-formed handle/);
    assert.match(deliveryInbox(town, '..').defect, /is not a well-formed handle/);
    rmSync(join(town, 'WHITE_PAGES', 'carol', 'ADDRESS.md'));
    assert.match(deliveryInbox(town, 'carol').defect, /"carol" has no ADDRESS\.md file/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ballot-pass writes no receipt for a ballot whose sender is not one handle', () => {
  const root = mkdtempSync(join(tmpdir(), 'ferry-handle-ballot-'));
  try {
    const inbox = join(root, 'WHITE_PAGES', 'postmaster', 'inbox');
    mkdirSync(inbox, { recursive: true });
    writeFileSync(join(root, 'WHITE_PAGES', 'mail-ledger.md'), '# ledger\n\n');
    writeFileSync(join(inbox, 'x-2026-10-05-to-postmaster-ballot.md'),
      `---\nid: x-2026-10-05-to-postmaster-ballot\nfrom: x/../../../../escaped\nto: postmaster\ndate: 2026-10-05\nthread: new\nstake_topic: name-vote\nstake_candidate: lumen\nstake_stamps: 1\n---\n\nA ballot.\n`);
    const r = ballotPass(root, 'unused', '2026-10-05');
    assert.equal(r.receipts, 0);
    assert.equal(existsSync(join(root, 'escaped-ballot-receipt-x-2026-10-05-to-postmaster-ballot.md')), false,
      'a receipt was written outside the office outbox');
    assert.equal(existsSync(join(root, 'WHITE_PAGES', 'postmaster', 'outbox')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
