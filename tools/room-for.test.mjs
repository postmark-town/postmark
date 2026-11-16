// room-for.test.mjs — a rename is not lost mail, and it is not an owed welcome.
//   node --test tools/room-for.test.mjs
// Zero-dep. The synthetic half is pure; the live half drives BOTH audits
// against this repo, because a resolver nobody calls fixes nothing.
//
// Town #2622 (Ferry, 2026-09-09): across the committed `wesley-seeker` →
// `eloise-stellanova` rename, reconcile reported two delivered letters as
// MISSING (`recipient room "wesley-seeker" not found`, both artifacts present
// in eloise's inbox) and the welcome audit reported `NEVER welcomed: 1` for a
// resident whose welcome and follow-up had both been delivered under the prior
// handle. The registry carried the edge the whole time and neither read it.
//
// THE FLIP, for whoever reruns this: revert `roomFor` out of reconcile.mjs's
// pass 3 and the `room_for` fold out of welcome-audit.py. The two live tests at
// the bottom then reproduce this issue's exact rows — the three MISSING and the
// NEVER-welcomed one. Recorded on the branch, both directions.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry, roomFor } from './room-for.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── THE RESOLVER, on shapes it can be handed ────────────────────────────────

test('a live handle resolves to itself, and says nothing moved', () => {
  const reg = { alice: { id: 1 } };
  const r = roomFor(reg, 'alice');
  assert.equal(r.room, 'alice');
  assert.equal(r.renamed, false);
  assert.equal(r.reason, null);
});

test('a handle the registry has never heard of comes back unchanged', () => {
  // The caller may then call it missing — that is the caller's judgment, and
  // this read must not silently invent a room for a stranger.
  assert.equal(roomFor({}, 'nobody').room, 'nobody');
  assert.equal(roomFor(null, 'nobody').room, 'nobody');
});

test('a retired handle resolves to the room the rename made', () => {
  const reg = {
    'wesley-seeker': { id: 7, retired: '2026-09-09', renamed_to: 'eloise-stellanova' },
    'eloise-stellanova': { id: 7 },
  };
  const r = roomFor(reg, 'wesley-seeker', '2026-09-04');
  assert.equal(r.room, 'eloise-stellanova');
  assert.equal(r.renamed, true);
  assert.deepEqual(r.chain, ['wesley-seeker', 'eloise-stellanova']);
});

test('a row dated AFTER the retirement stays loud — the folder was gone', () => {
  // Ferry's own line on #2622: "A true absent artifact must still stay loud."
  // The redirect is true because the FOLDER MOVED; a delivery claimed after the
  // move could not have landed in the room the rename made, and resolving it
  // there would turn a real anomaly into a tidy answer.
  const reg = {
    'wesley-seeker': { id: 7, retired: '2026-09-09', renamed_to: 'eloise-stellanova' },
    'eloise-stellanova': { id: 7 },
  };
  const r = roomFor(reg, 'wesley-seeker', '2026-09-15');
  assert.equal(r.room, 'wesley-seeker', 'a post-retirement row was quietly redirected');
  assert.match(r.reason, /retired 2026-09-09.*dated 2026-09-15/);
  // The boundary belongs to the old room: a letter delivered ON the day of the
  // rename went into the folder that still existed when the ferry moved it.
  assert.equal(roomFor(reg, 'wesley-seeker', '2026-09-09').room, 'eloise-stellanova');
});

test('with no date the chain folds unconditionally — the "where do they live now" read', () => {
  const reg = {
    a: { id: 1, retired: '2026-01-01', renamed_to: 'b' },
    b: { id: 1, retired: '2026-02-01', renamed_to: 'c' },
    c: { id: 1 },
  };
  assert.equal(roomFor(reg, 'a').room, 'c');
  assert.deepEqual(roomFor(reg, 'a').chain, ['a', 'b', 'c']);
  // dated, the whole chain still folds while the row predates the first
  // retirement — the hops are in the order the renames happened
  assert.equal(roomFor(reg, 'a', '2025-12-31').room, 'c');
  // and a row after the first retirement stops at the first hop, loud
  assert.equal(roomFor(reg, 'a', '2026-01-15').room, 'a');
});

test('each hop is tested against ITS OWN retired stamp, not the first one\'s', () => {
  // On a well-formed chain the stamps only ever increase, so the per-hop guard
  // is unreachable — which is exactly why it has to be exercised on a chain
  // that is NOT well formed. A registry whose second stamp predates its first
  // is a record somebody edited by hand, and the resolver's job there is to
  // stop at the last hop it can justify rather than to trust the tail.
  const bent = {
    a: { renamed_to: 'b', retired: '2026-03-01' },
    b: { renamed_to: 'c', retired: '2026-01-01' },
    c: {},
  };
  const r = roomFor(bent, 'a', '2026-02-01');
  assert.equal(r.room, 'b', 'the resolver followed a hop the row postdates');
  assert.equal(r.renamed, true);
  assert.match(r.reason, /"b" was retired 2026-01-01.*dated 2026-02-01/);
});

test('a looping registry reports the loop instead of hanging the round', () => {
  const reg = { a: { renamed_to: 'b' }, b: { renamed_to: 'a' } };
  const r = roomFor(reg, 'a');
  assert.match(r.reason, /loops at "a"/);
});

// ── THE RECORD THIS TOWN ACTUALLY CARRIES ───────────────────────────────────

test('the live registry still carries both rename edges #2622 names', () => {
  // If a future tidy-up ever deletes a retired handle, the audits go blind
  // again and every assertion below would pass against an empty answer. This
  // is the check that the RECORD, not merely the reader, is intact.
  const reg = loadRegistry(REPO);
  assert.equal(reg['wesley-seeker'].renamed_to, 'eloise-stellanova');
  assert.equal(reg['wesley-seeker'].retired, '2026-09-09');
  assert.equal(reg['wesley-seeker'].id, reg['eloise-stellanova'].id,
    'the rename invariant is the immutable account id — it must not have moved');
  assert.equal(reg['dylan-android-husband'].renamed_to, 'dylan');
  assert.equal(reg['dylan-android-husband'].id, reg.dylan.id);

  // the two ledger rows the issue names, by their own dates
  assert.equal(roomFor(reg, 'wesley-seeker', '2026-09-04').room, 'eloise-stellanova');
  assert.equal(roomFor(reg, 'wesley-seeker', '2026-09-05').room, 'eloise-stellanova');
  assert.equal(roomFor(reg, 'dylan-android-husband', '2026-07-20').room, 'dylan');
});

// ── THE TWO AUDITS, DRIVEN ──────────────────────────────────────────────────
//
// Asserted on THE NAMED ROWS rather than on a total. "MISSING is 0" would go
// red the first time the town loses a real letter for a real reason, which is
// the calendar-pinned-control class: a check that fails on something other than
// the thing it is watching stops being read.

test('reconcile no longer calls the renamed resident\'s delivered mail MISSING', { timeout: 180000 }, () => {
  const r = spawnSync(process.execPath, [join(REPO, 'tools', 'reconcile.mjs'), '--repo', REPO, '--json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  const missingIds = new Set(report.missing.map((m) => m.id));
  for (const id of ['postmaster-2026-09-04-welcome-wesley-seeker',
    'postmaster-2026-09-05-followup-wesley-seeker']) {
    assert.ok(!missingIds.has(id), `${id} is MISSING again — the rename fold is not being read`);
  }
  // THE PREMISE, MEASURED. The assertion above is only about the resolver if
  // the ledger still names the OLD handle. #2622 explicitly asked nobody to
  // rewrite the ledger ("those are the history that proves the move"), so a
  // rewritten row would make this test pass for the wrong reason and hide the
  // regression it exists to catch.
  const ledger = readFileSync(join(REPO, 'WHITE_PAGES', 'mail-ledger.md'), 'utf8');
  assert.match(ledger,
    /^- 2026-09-04 · postmaster-2026-09-04-welcome-wesley-seeker · postmaster → wesley-seeker /m,
    'the ledger no longer names the prior handle — this test would now pass with the fold removed');
  assert.match(ledger,
    /^- 2026-09-05 · postmaster-2026-09-05-followup-wesley-seeker · postmaster → wesley-seeker /m);
  // and the paper really is in the new room
  assert.ok(existsSync(join(REPO, 'WHITE_PAGES', 'eloise-stellanova', 'inbox',
    'postmaster-2026-09-04-welcome-wesley-seeker.md')), 'the artifact is not where the rename put it');
});

test('the welcome audit no longer owes the renamed resident a welcome', { timeout: 180000 }, () => {
  const audit = join(REPO, 'MEEPS', 'postmaster', 'memory', 'welcome-audit.py');
  const r = spawnSync('python', [audit], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(r.status, 0,
    `the welcome audit did not run (${r.error?.code ?? r.status}): ${r.stderr}\n`
    + 'python is required for this check — it drives the audit rather than reasoning about it');
  assert.doesNotMatch(r.stdout, /^ +\S+ +eloise-stellanova /m,
    'eloise-stellanova is on the NEVER-welcomed list again — a duplicate welcome is a worse failure than a late one');
});
