// crossing-receipt.test.mjs — the crossing names the save state it crossed at.
//   node --test tools/crossing-receipt.test.mjs
// Zero-dep; a synthetic town and a real git repo in tmpdir.
//
// Keemin, 2026-09-10: the office index, the settlement window and the site
// build each name a save state and none of them can check the others. The
// window already carries `as_of: { window, town_sha, world_sha }` (office
// src/store-writedown.mjs § FOLD_INPUT_CONTRACT). The crossing carried nothing
// — so a sha in hand could not be turned into a crossing without a second
// clock. WHITE_PAGES/crossing-ledger.md closes that: one line per crossing that
// moved mail, `crossing` where the window says `window`, `town_sha` under the
// same name.
//
// THE ONE THAT CANNOT BE FAKED is `the sha is the parent of the crossing's own
// commit`. A receipt written from a sha read at the wrong moment still looks
// like a receipt; only that assertion can tell.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  CROSSING_EPOCH_UTC, CROSSING_MS, CROSSING_LEDGER_PREAMBLE, CROSSING_LEDGER_REL,
  crossingAt, latestCrossing, parseCrossingLedgerText,
} from './crossings.mjs';

const FERRY = resolve(dirname(fileURLToPath(import.meta.url)), 'ferry.mjs');

function git(repo, args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed:\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

const address = (h) => `---\nhandle: ${h}\nagent: ${h}\nhousehold: test\narchitecture: synthetic\n`
  + `since: 2026-01-01\njoined: 2026-01-01\ngithub: ${h}\n---\n\nA test room.\n`;
const letter = (from, to, id) =>
  `---\nid: ${id}\nfrom: ${from}\nto: ${to}\ndate: 2026-08-14\n---\n\nHello from ${from}.\n`;

function buildTown({ letters = 1 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'crossing-receipt-'));
  const town = join(root, 'town');
  for (const room of ['alice', 'bob']) {
    mkdirSync(join(town, 'WHITE_PAGES', room, 'inbox'), { recursive: true });
    mkdirSync(join(town, 'WHITE_PAGES', room, 'outbox'), { recursive: true });
    writeFileSync(join(town, 'WHITE_PAGES', room, 'ADDRESS.md'), address(room));
    writeFileSync(join(town, 'WHITE_PAGES', room, 'inbox', '.gitkeep'), '');
    writeFileSync(join(town, 'WHITE_PAGES', room, 'outbox', '.gitkeep'), '');
  }
  for (let i = 0; i < letters; i += 1) {
    writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'outbox', `letter-2026-08-14-n${i}.md`),
      letter('alice', 'bob', `alice-2026-08-14-n${i}`));
  }
  writeFileSync(join(town, 'WHITE_PAGES', 'mail-ledger.md'), '# Mail ledger\n\n');
  spawnSync('git', ['init', '-b', 'main', town], { encoding: 'utf8' });
  git(town, ['config', 'user.email', 'ferry@test.local']);
  git(town, ['config', 'user.name', 'ferry test']);
  git(town, ['add', '-A']);
  git(town, ['commit', '-m', 'the town']);
  return { root, town };
}

const runFerry = (town, extra = []) =>
  spawnSync('node', [FERRY, '--repo', town, '--date', '2026-08-14', ...extra], { encoding: 'utf8' });

const receiptPath = (town) => join(town, ...CROSSING_LEDGER_REL.split('/'));

// ── THE CLOCK ───────────────────────────────────────────────────────────────

test('the town clock agrees with the ruling it copied — "Crossing 100 lands 2026-08-01 00:00 UTC"', () => {
  // The sentence is Keemin's, 2026-07-29, quoted verbatim in the header of both
  // this repo's tools/crossings.mjs and the office's src/crossings.mjs. This
  // assertion is the only thing standing between two copies and two clocks.
  assert.equal(crossingAt(Date.parse('2026-08-01T00:00:00Z')), 100);
  assert.equal(crossingAt(Date.parse('2026-08-01T00:00:00Z') - 1), 99, 'the boundary belongs to the crossing that opens on it');
  assert.equal(crossingAt(Date.parse('2026-08-01T12:00:00Z')), 101, 'crossings are twelve hours, not a day');
  assert.equal(crossingAt(CROSSING_EPOCH_UTC), 0, 'the epoch is the mail-ledger\'s first delivery day');
  assert.equal(crossingAt(CROSSING_EPOCH_UTC - 5 * CROSSING_MS), 0, 'nothing crossed before the first crossing');
});

test('the committed ledger IS its preamble constant — one spelling, not two', () => {
  // The file is seeded in the repo so the three readers have a path that
  // exists before the first crossing after this lands; the ferry re-creates it
  // from the same constant if it is ever missing. Two spellings of a preamble
  // is how a header stops describing its own ledger.
  const onDisk = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', CROSSING_LEDGER_REL), 'utf8');
  assert.equal(onDisk.replace(/\r\n/g, '\n'), CROSSING_LEDGER_PREAMBLE);
  // and the preamble is prose the grammar skips rather than lines it cannot read
  assert.deepEqual(parseCrossingLedgerText(onDisk), { receipts: [], unrecognized: 0 });
});

// ── THE RECEIPT ─────────────────────────────────────────────────────────────

test('a crossing writes a receipt naming the crossing and the sha it crossed at', () => {
  const { root, town } = buildTown({ letters: 2 });
  try {
    const before = git(town, ['rev-parse', 'HEAD']);
    const r = runFerry(town);
    assert.equal(r.status, 0, r.stderr);

    const found = latestCrossing(readFileSync(receiptPath(town), 'utf8'));
    assert.ok(found, 'no crossing receipt was written');
    assert.equal(found.date, '2026-08-14');
    // A --date replay stamps that day's FIRST crossing, never the wall clock.
    assert.equal(found.crossing, crossingAt(Date.parse('2026-08-14T00:00:00Z')));
    assert.equal(found.delivered, 2);
    assert.equal(found.bounced, 0);

    // THE ASSERTION THAT CANNOT BE FAKED: the sha names the state the crossing
    // READ, which is the parent of the commit the receipt rides in. A sha
    // fetched at any other moment fails here and only here.
    assert.equal(found.town_sha, before);
    assert.equal(found.town_sha, git(town, ['rev-parse', 'HEAD^']));
    assert.match(found.town_sha, /^[0-9a-f]{40}$/, 'the sha is full, never abbreviated');

    // The receipt is IN the crossing, not left behind beside it.
    const staged = git(town, ['show', '--name-only', '--no-renames', '--pretty=format:', 'HEAD']).split('\n');
    assert.ok(staged.includes(CROSSING_LEDGER_REL), `the receipt is not in the crossing commit: ${staged.join(', ')}`);
    assert.equal(git(town, ['status', '--porcelain']), '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a crossing that moves no mail writes no receipt — a sha nothing changed is already named', () => {
  const { root, town } = buildTown({ letters: 0 });
  try {
    const r = runFerry(town);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(existsSync(receiptPath(town)), false, 'an empty crossing minted a receipt anyway');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('two crossings append, and each names its own parent', () => {
  const { root, town } = buildTown({ letters: 1 });
  try {
    assert.equal(runFerry(town).status, 0);
    // COMMITTED before the crossing, because that is how a letter reaches an
    // outbox: the author opens a PR and the witness merges it, so the ferry
    // always pulls a TRACKED file. An untracked outbox letter makes `git add`
    // refuse the whole crossing with `pathspec … did not match any files` —
    // true of the pathspec list and of the argv it replaced alike, so it is a
    // standing property of the crossing and not this lane's to change.
    writeFileSync(join(town, 'WHITE_PAGES', 'bob', 'outbox', 'letter-2026-08-15-back.md'),
      letter('bob', 'alice', 'bob-2026-08-15-back'));
    git(town, ['add', '--', 'WHITE_PAGES/bob/outbox/letter-2026-08-15-back.md']);
    git(town, ['commit', '-m', 'bob writes back']);
    // The state the SECOND crossing will read: bob's own commit, not the first
    // crossing's. A receipt that named the last FERRY RUN rather than the last
    // SAVE STATE would pass a weaker assertion and be wrong about the town.
    const secondParent = git(town, ['rev-parse', 'HEAD']);
    const second = spawnSync('node', [FERRY, '--repo', town, '--date', '2026-08-15'], { encoding: 'utf8' });
    assert.equal(second.status, 0, second.stderr);

    const { receipts, unrecognized } = parseCrossingLedgerText(readFileSync(receiptPath(town), 'utf8'));
    assert.equal(unrecognized, 0, 'the crossing wrote a line its own grammar cannot read');
    assert.equal(receipts.length, 2);
    assert.equal(receipts[1].town_sha, secondParent, 'the second crossing did not name the state it read');
    assert.equal(receipts[0].town_sha, git(town, ['rev-parse', 'HEAD~3']),
      'the first crossing no longer names the town it found');
    assert.ok(receipts[1].crossing > receipts[0].crossing, 'the clock went backwards');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a crossing whose commit fails leaves no receipt behind', () => {
  const { root, town } = buildTown({ letters: 1 });
  try {
    const hooks = join(root, 'hooks-refuse');
    mkdirSync(hooks, { recursive: true });
    writeFileSync(join(hooks, 'pre-commit'), '#!/bin/sh\nexit 1\n');
    chmodSync(join(hooks, 'pre-commit'), 0o755);
    git(town, ['config', 'core.hooksPath', hooks.replace(/\\/g, '/')]);

    assert.equal(runFerry(town).status, 1);
    // The receipt is a write like any other: it rides the undo journal, so a
    // crossing that never happened does not leave a record saying it did.
    assert.equal(existsSync(receiptPath(town)), false, 'a refused crossing left a receipt claiming it crossed');
    assert.equal(git(town, ['status', '--porcelain']), '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
