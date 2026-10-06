// ferry-plain-files.test.mjs — the ferry reads and writes plain files only.
//   node --test tools/ferry-plain-files.test.mjs
// Zero-dep; synthetic towns and real git repos in tmpdir. Needs a machine that
// can make symbolic links (the box can; a Windows box without the privilege
// skips).
//
// The law (ferry.mjs § plainKind, § oddEntryIn, § handleBounce):
//
//   · a folder letter that carries anything but plain files and folders
//     bounces by name, and moves nowhere;
//   · a bounce note is written only into the sender's own inbox folder, over
//     nothing or over a plain file — never through a link;
//   · an outbox that is not a folder is not swept.
//
// THE FLIP is the three checks removed (the `odd` branch in sweep, the
// inboxKind/noteKind guard in handleBounce, the plainKind guard in
// listOutboxItems): each test below then reds.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, symlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const FERRY = resolve(dirname(fileURLToPath(import.meta.url)), 'ferry.mjs');

function git(repo, args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${repo}:\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

const address = (handle) => `---\nhandle: ${handle}\nagent: ${handle}\ngithub: ${handle}\n---\n\nA test room.\n`;
const letter = (from, to, id) => `---\nid: ${id}\nfrom: ${from}\nto: ${to}\ndate: 2026-10-05\n---\n\nHello from ${from}.\n`;

// Rooms alice and bob; a file outside the town (`root/outside.txt`) that no
// crossing may touch.
function buildTown() {
  const root = mkdtempSync(join(tmpdir(), 'ferry-plain-'));
  const town = join(root, 'town');
  for (const room of ['alice', 'bob']) {
    mkdirSync(join(town, 'WHITE_PAGES', room, 'inbox'), { recursive: true });
    mkdirSync(join(town, 'WHITE_PAGES', room, 'outbox'), { recursive: true });
    writeFileSync(join(town, 'WHITE_PAGES', room, 'ADDRESS.md'), address(room));
    writeFileSync(join(town, 'WHITE_PAGES', room, 'inbox', '.gitkeep'), '');
    writeFileSync(join(town, 'WHITE_PAGES', room, 'outbox', '.gitkeep'), '');
  }
  writeFileSync(join(town, 'WHITE_PAGES', 'mail-ledger.md'), '# Mail ledger\n\n');
  writeFileSync(join(root, 'outside.txt'), 'untouched\n');
  spawnSync('git', ['init', '-b', 'main', town], { encoding: 'utf8' });
  git(town, ['config', 'user.email', 'ferry@test.local']);
  git(town, ['config', 'user.name', 'ferry test']);
  git(town, ['config', 'core.autocrlf', 'false']);
  return { root, town };
}

function commit(town) {
  git(town, ['add', '-A']);
  git(town, ['commit', '-qm', 'the town']);
}

// A link, or a skip when this machine cannot make one.
function link(t, target, path) {
  try {
    symlinkSync(target, path);
    return true;
  } catch (error) {
    if (error.code === 'EPERM') { t.skip('this machine cannot make symlinks'); return false; }
    throw error;
  }
}

const runFerry = (town) =>
  spawnSync('node', [FERRY, '--repo', town, '--date', '2026-10-05'], { encoding: 'utf8' });

const ledgerOf = (town) => readFileSync(join(town, 'WHITE_PAGES', 'mail-ledger.md'), 'utf8');

test('a folder letter carrying a link bounces by name and moves nowhere', (t) => {
  const { root, town } = buildTown();
  try {
    const folder = join(town, 'WHITE_PAGES', 'alice', 'outbox', 'letter-2026-10-05-parcel');
    mkdirSync(folder);
    writeFileSync(join(folder, 'letter.md'), letter('alice', 'bob', 'alice-2026-10-05-parcel'));
    if (!link(t, join(root, 'outside.txt'), join(folder, 'picture.txt'))) return;
    commit(town);

    const r = runFerry(town);
    assert.equal(r.status, 0, `the crossing refused:\n${r.stdout}\n${r.stderr}`);
    assert.equal(existsSync(join(town, 'WHITE_PAGES', 'bob', 'inbox', 'alice-2026-10-05-parcel')), false,
      'the folder letter was carried with a link inside it');
    assert.match(ledgerOf(town), /BOUNCE · WHITE_PAGES\/alice\/outbox\/letter-2026-10-05-parcel \(from alice\): folder letter carries something that is not a plain file: picture\.txt/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a bounce note is never written through a link', (t) => {
  const { root, town } = buildTown();
  try {
    writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'outbox', 'letter-2026-10-05-oops.md'),
      '---\nid: alice-2026-10-05-oops\nfrom: alice\ndate: 2026-10-05\n---\n\nNo recipient.\n');
    if (!link(t, join(root, 'outside.txt'), join(town, 'WHITE_PAGES', 'alice', 'inbox', 'bounce-2026-10-05-letter-2026-10-05-oops.md'))) return;
    commit(town);

    const r = runFerry(town);
    assert.equal(r.status, 0, `the crossing refused:\n${r.stdout}\n${r.stderr}`);
    assert.equal(readFileSync(join(root, 'outside.txt'), 'utf8'), 'untouched\n', 'the note was written through the link');
    assert.match(ledgerOf(town), /BOUNCE · WHITE_PAGES\/alice\/outbox\/letter-2026-10-05-oops\.md \(from alice\): missing required field: to/);
    assert.match(r.stdout, /note not written/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an outbox that is a link is not swept', (t) => {
  const { root, town } = buildTown();
  try {
    writeFileSync(join(town, 'WHITE_PAGES', 'bob', 'outbox', 'letter-2026-10-05-hi.md'), letter('bob', 'alice', 'bob-2026-10-05-hi'));
    const outbox = join(town, 'WHITE_PAGES', 'alice', 'outbox');
    rmSync(outbox, { recursive: true, force: true });
    if (!link(t, join('..', 'bob', 'outbox'), outbox)) return;
    commit(town);

    const r = runFerry(town);
    assert.equal(r.status, 0, `the crossing refused:\n${r.stdout}\n${r.stderr}`);
    assert.doesNotMatch(ledgerOf(town), /WHITE_PAGES\/alice\/outbox\/letter-2026-10-05-hi\.md/,
      'another room\'s letter was swept under alice');
    assert.match(r.stdout, /sweep: WARN WHITE_PAGES\/alice\/outbox is not a folder — not swept/);
    assert.ok(existsSync(join(town, 'WHITE_PAGES', 'alice', 'inbox', 'bob-2026-10-05-hi.md')), 'bob\'s own letter was not delivered');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
