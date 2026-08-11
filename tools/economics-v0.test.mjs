// economics-v0.test.mjs — the parked designs, held to their rulings.
//   node --test tools/economics-v0.test.mjs
//
// Everything here tests REHEARSAL machinery: the burn-remint planner (writes
// nothing, ever), the yield consequence table (arithmetic, no mint path), and
// the founding act's polygon gate (a refusal, not an act). The rulings cited
// are the 2026-08-11 ship night's: A1 poster+town countersign · A3 own-stakes-
// return · B per-settlement epoch, breaker 5 · C polygons, no conflicts at
// launch · final scope purely-liquid BETA (q unlit, no burn-remint).

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planConversion, PARK_RULING } from './bounty-settle.mjs';
import { qfKernel, epochYield, simulate } from './yield-sim.mjs';
import { polygonGate } from './founding-act.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// a state stub in worldStakeState's shape — positions + the household law
const stubState = (positions, households) => ({
  positions: new Map(Object.entries(positions)),
  currentHouseholdOf: (h) => households[h] ?? `solo:${h}`,
});

// ── burn-remint v0: the planner holds all three return rules ─────────────────

test('conversion set: external burns; poster and completer households return', () => {
  const state = stubState({
    'wright/bounty-a-map|wright': 5,   // the poster's own backing
    'wright/bounty-a-map|hal': 30,     // the completer's own stake
    'wright/bounty-a-map|darko': 20,   // completer's OTHER handle, same household
    'wright/bounty-a-map|rei': 10,     // the one honest external backer
    'wright/some-other-mark|rei': 99,  // noise on another mark — must not leak in
  }, { wright: 'wright', hal: 'hal-house', darko: 'hal-house', rei: 'rei' });

  const plan = planConversion({ mark: 'wright/bounty-a-map', completer: 'hal', state });
  assert.deepEqual(plan.converts.map((r) => [r.holder, r.n]), [['rei', 10]]);
  assert.equal(plan.burned, 10);
  assert.equal(plan.reminted, 10, 'supply-neutral: minted === burned, by construction');
  const returned = Object.fromEntries(plan.returns.map((r) => [r.holder, r.why]));
  assert.match(returned.wright, /poster/);
  assert.match(returned.hal, /completer/);
  assert.match(returned.darko, /completer/);
  assert.equal(plan.countersigns.length, 2, 'A1: the poster AND the town');
});

test('a poster completing their own bounty converts nothing at all', () => {
  const state = stubState(
    { 'wright/bounty-self|wright': 50, 'wright/bounty-self|rei': 10 },
    { wright: 'wright', rei: 'rei' });
  // completer == poster: rei's stake is the only external one, and it converts;
  // wright's own 50 returns. Now make rei the poster-and-completer's housemate:
  const worse = stubState(
    { 'wright/bounty-self|wright': 50, 'wright/bounty-self|rei': 10 },
    { wright: 'starforge', rei: 'starforge' });
  const plan = planConversion({ mark: 'wright/bounty-self', completer: 'wright', state: worse });
  assert.equal(plan.burned, 0, 'one household wearing two handles buys no equity from itself');
  assert.equal(plan.converts.length, 0);
});

test('the CLI refuses --commit with the park ruling, exit 2', () => {
  try {
    execFileSync('node', [join(HERE, 'bounty-settle.mjs'), '--commit', '--mark', 'x/y', '--completer', 'z'], { encoding: 'utf8' });
    assert.fail('must not exit 0');
  } catch (e) {
    assert.equal(e.status, 2);
    assert.match(String(e.stderr), /PARKED \(founder ruling 2026-08-11/);
    assert.match(String(e.stderr), /rehearses; it does not write/);
  }
});

// ── the yield engine's arithmetic, before anyone lights it ──────────────────

test('the QF kernel: a chorus beats a soloist at equal volume', () => {
  const chorus = qfKernel(Array.from({ length: 10 }, () => ({ household: 'h', n: 30 })));
  const soloist = qfKernel([{ household: 'whale', n: 300 }]);
  assert.equal(Math.round(chorus), 3000);
  assert.equal(Math.round(soloist), 300);
  assert.ok(chorus === 10 * soloist, 'breadth is worth exactly its multiplier');
});

test('the breaker clamps and M damps', () => {
  assert.equal(epochYield({ kernel: 10000, q: 30, M: 5000, breaker: 5 }), 5, 'Rei seatbelt: per-mark cap');
  const now = epochYield({ kernel: 300, q: 30, M: 5000, breaker: 5 });
  const later = epochYield({ kernel: 300, q: 30, M: 10000, breaker: 5 });
  assert.ok(Math.abs(later - now / 2) < 1e-12, 'double the town, half the drip — the conservation law');
});

test("simulate excludes the creator's own household from its own yield", () => {
  const state = stubState(
    { 'wright/the-terrace|wright': 100, 'wright/the-terrace|rei': 16 },
    { wright: 'wright', rei: 'rei' });
  const sim = simulate({ state, q: 30, breaker: 5, M: 5000 });
  const row = sim.rows.find((r) => r.mark === 'wright/the-terrace');
  assert.equal(row.external_escrow, 16, "the creator's 100 never enters the kernel (seatbelt #5)");
  assert.equal(row.kernel, 16, '(√16)² = 16 from the one external household');
});

// ── the polygon gate (ruling C): the act refuses conflicts ──────────────────

const rect = (id, x, y, w, h, points = [[0, 0], [1, 0], [1, 1]]) =>
  ({ id, at: { x, y }, extent: { w, h }, points });

test('the gate refuses missing marks, missing polygons, and overlaps — each by name', () => {
  const targets = [{ mark: 'a/one' }, { mark: 'b/two' }, { mark: 'c/three' }];
  const world = [
    rect('a/one', 0, 0, 100, 100),
    { ...rect('b/two', 50, 0, 100, 100), points: undefined }, // overlaps a/one AND untrued
    // c/three absent entirely
  ];
  const failures = polygonGate(targets, world);
  assert.ok(failures.some((f) => /c\/three: not in the world state/.test(f)));
  assert.ok(failures.some((f) => /b\/two: no points ring/.test(f)));
  assert.ok(failures.some((f) => /a\/one × b\/two: claims overlap 50×100/.test(f)));
});

test('edge-sharing neighbours are not a conflict; a clear map passes', () => {
  const targets = [{ mark: 'a/one' }, { mark: 'b/two' }];
  const world = [rect('a/one', 0, 0, 100, 100), rect('b/two', 100, 0, 100, 100)];
  assert.deepEqual(polygonGate(targets, world), [], 'touching at the fence line is adjacency, not contest');
});
