// registry-printout-public.test.mjs — the printout check compares the PUBLIC row and refuses a printed human (POS-394).
//   node --test tools/registry-printout-public.test.mjs
// Zero-dep and pure: invented houses, pins and commits, fixed literals only. No
// clone, no git history, no network, no real printout or registry.

import test from 'node:test';
import assert from 'node:assert/strict';
import { printoutAgainstStore, foreignWriters, publicHouse, canonical, PEN_EMAIL } from './registry-printout-check.mjs';

const SENTINEL = 'PRIVATE_SENTINEL_k2vq_human';
const leaks = (x) => JSON.stringify(x).includes(SENTINEL);

const HOUSE = { name: 'Copper Gate', accounts: [{ login: 'cg-gh', id: 9701 }], residents: ['tansy', 'burr'], since: '2026-08-14', declared_by: 'tansy' };
const OTHER = { name: 'Low Field', accounts: [{ login: 'lf-gh', id: 9702 }], residents: ['sedge'], since: '2026-08-15', declared_by: 'sedge' };
const PINS = { tansy: { login: 'cg-gh', id: 9701, pinned: '2026-08-14' }, burr: { login: 'cg-gh', id: 9701 }, sedge: { login: 'lf-gh', id: 9702 } };

/** The store as the office's PRIVATE source would hand it over: copper-gate carries a human. */
const privateStore = () => ({ registry: { households: { 'copper-gate': { ...HOUSE, human: SENTINEL }, 'low-field': { ...OTHER } } }, pins: structuredClone(PINS) });
/** The store as the office's PUBLIC GET /households hands it over now: no human anywhere. */
const publicStore = () => ({ registry: { households: { 'copper-gate': { ...HOUSE }, 'low-field': { ...OTHER } } }, pins: structuredClone(PINS) });
const printout = (houses) => ({ households: { households: houses }, pins: structuredClone(PINS) });
const check = (houses, store) => printoutAgainstStore({ households: { households: houses }, pins: structuredClone(PINS) }, store);
const LEAK = /prints the private `human` field/;

test('a printed human that EQUALS the private source is refused (the old field-for-field match passed it)', () => {
  const printed = { ...HOUSE, human: SENTINEL };
  const store = privateStore();
  assert.equal(canonical(printed), canonical(store.registry.households['copper-gate']), 'CONTROL: the old matcher saw these as equal');
  const problems = check({ 'copper-gate': printed, 'low-field': { ...OTHER } }, store);
  assert.equal(problems.length, 1);
  assert.match(problems[0], LEAK);
  assert.match(problems[0], /copper-gate/);
  assert.equal(leaks(problems), false, 'the problem never quotes the private value');
});

test('a printed human key is refused whatever its value and whatever the source holds', () => {
  for (const [what, value, store] of [
    ['null, private source', null, privateStore()],
    ['null, public source', null, publicStore()],
    ['a value, public source', SENTINEL, publicStore()],
    ['an empty string, private source', '', privateStore()],
  ]) {
    const problems = check({ 'copper-gate': { ...HOUSE, human: value }, 'low-field': { ...OTHER } }, store);
    assert.equal(problems.length, 1, what);
    assert.match(problems[0], LEAK, what);
    assert.equal(leaks(problems), false, `${what}: no private value in the problem`);
  }
});

test('the redacted printout matches the PUBLIC projection of a private source, and of an already-public one; nothing else is dropped', () => {
  const store = privateStore();
  const before = JSON.stringify(store);
  assert.deepEqual(check({ 'copper-gate': { ...HOUSE }, 'low-field': { ...OTHER } }, store), [], 'private source: compared through its public projection');
  assert.equal(JSON.stringify(store), before, 'the source is not mutated');
  assert.equal(leaks(store), true, 'CONTROL: the private source still holds the value');
  assert.deepEqual(check({ 'copper-gate': { ...HOUSE }, 'low-field': { ...OTHER } }, publicStore()), [], 'an already-public source matches too');

  // an opaque, consent-like marker is just another field: kept, compared, never a way back for the human
  const marked = privateStore();
  marked.registry.households['copper-gate'].human_shown = 'opaque-marker';
  assert.deepEqual(check({ 'copper-gate': { ...HOUSE, human_shown: 'opaque-marker' }, 'low-field': { ...OTHER } }, marked), [], 'the marker is compared like any field');
  assert.equal(check({ 'copper-gate': { ...HOUSE }, 'low-field': { ...OTHER } }, marked).length, 1, 'and a printout missing it differs: the projection removes only human');
  const withBoth = check({ 'copper-gate': { ...HOUSE, human_shown: 'opaque-marker', human: SENTINEL }, 'low-field': { ...OTHER } }, marked);
  assert.match(withBoth.join('\n'), LEAK, 'a marker does not re-enable a printed human');

  assert.deepEqual(publicHouse({ ...HOUSE, human: SENTINEL, human_shown: 'x' }), { ...HOUSE, human_shown: 'x' });
  const rec = { ...HOUSE, human: null };
  publicHouse(rec);
  assert.equal('human' in rec, true, 'publicHouse copies; it never deletes from what it is handed');
});

test('every other difference fails exactly as before: a field, a member, an account, a pin, a house or pin the store lacks', () => {
  const store = privateStore();
  const ok = { 'copper-gate': { ...HOUSE }, 'low-field': { ...OTHER } };
  for (const [what, houses] of [
    ['a name', { ...ok, 'copper-gate': { ...HOUSE, name: 'Copper Gates' } }],
    ['a member', { ...ok, 'copper-gate': { ...HOUSE, residents: ['tansy'] } }],
    ['an account', { ...ok, 'copper-gate': { ...HOUSE, accounts: [{ login: 'cg-gh', id: 9799 }] } }],
  ]) {
    const p = check(houses, store);
    assert.equal(p.length, 1, what);
    assert.match(p[0], /tools\/households\.json's "copper-gate" differs from the store's row/, what);
  }
  const absent = check({ ...ok, 'not-in-store': { ...OTHER } }, store);
  assert.deepEqual(absent, ['tools/households.json holds the house "not-in-store", which the store does not']);
  const pinOff = printoutAgainstStore({ households: { households: ok }, pins: { ...structuredClone(PINS), sedge: { login: 'lf-gh', id: 9703 } } }, store);
  assert.deepEqual(pinOff, ["tools/github-ids.json's pin for \"sedge\" differs from the store's"]);
  const pinAbsent = printoutAgainstStore({ households: { households: ok }, pins: { ...structuredClone(PINS), stray: { login: 'x', id: 1 } } }, store);
  assert.deepEqual(pinAbsent, ['tools/github-ids.json pins "stray", which the store does not']);
  // the store may hold MORE than the printout (a bind after the drain): still fine
  assert.deepEqual(check({ 'copper-gate': { ...HOUSE } }, store), []);
});

test('the author gate is unchanged: the pen passes, a person touching a printout is refused', () => {
  const pen = { sha: 'a'.repeat(40), email: PEN_EMAIL, name: 'Postmark Pen', files: ['tools/households.json'] };
  const person = { sha: 'b'.repeat(40), email: 'someone@example.invalid', name: 'Someone', files: ['tools/github-ids.json', 'tools/other.mjs'] };
  const elsewhere = { sha: 'c'.repeat(40), email: 'someone@example.invalid', name: 'Someone', files: ['tools/other.mjs'] };
  assert.deepEqual(foreignWriters([pen, elsewhere]), []);
  const out = foreignWriters([pen, person]);
  assert.equal(out.length, 1);
  assert.match(out[0], /^bbbbbbbbb by Someone <someone@example\.invalid> edits tools\/github-ids\.json/);
});
