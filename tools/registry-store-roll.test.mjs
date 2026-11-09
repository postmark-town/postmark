// registry-store-roll.test.mjs — a falsifiable CURRENT membership roll over the registry the town reads (POS-78).
//   node --test tools/registry-store-roll.test.mjs
// Zero-dep. Invented data only; no office, no store, no network.
//
// LAW (POS-345, Darko 2026-10-04, office src/households-read.mjs): "git can be written to, the store reads git,
// the store is the record, and every reader reads the store."
//
// THE CHAIN UNDER TEST: the office's public `GET /households` answers { read, registry, pins, from }; a town tool
// takes it through tools/registry-source.mjs (`loadRegistrySource`, a URL or a file, unchanged here). This file
// asks of that answer one question: does the CURRENT membership it carries equal the roll the town KNOWS?
//
// THE ROLL IS HELD APART FROM THE ANSWER. CANON below is the invented, frozen universe and grouping. Every
// document under test is built by `answer()` and then mutated into a WRONG answer while CANON stays put, so
// a missing or a duplicate attachment is measured against what should be there. A roll read off the answer itself
// cannot see an ABSENCE, and a view that files each handle once (the store's `identities` does) turns an absence
// into a solo and a doubling into one tidy house: that is shown below as a control, not argued.
//
// WHAT THIS DOES NOT CLAIM
//   · The fake fetch is a SYNTHETIC HTTP seam. It is not the office's handler, not an actual HTTP round trip and not
//     a live or deployed store. The office's own endpoint tests (office test/households-read.test.mjs) are the
//     upstream contract; they are not this file's executed integration.
//   · Membership here is the houses' explicit `residents`. A pin is not membership: deleting a pin does not remove
//     a member, and a house account no resident is pinned to is not rejected (positive controls, not detectors).
//   · Nothing here reads the ledger, the as-of economic keys, `currentHouseholds`/`householdsOf` or the sealed
//     register. Current grouping is not equality with the economic helper.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadRegistrySource } from './registry-source.mjs';

// ── the roll the town KNOWS: invented, frozen, separate from every document ────
const CANON = Object.freeze({
  hearth: Object.freeze(['fern', 'kit']),   // `kit` is a canonical resident with NO pin
  yonder: Object.freeze(['yan', 'zed']),
  lone: Object.freeze(['ono']),
});
const UNIVERSE = Object.values(CANON).flat();
assert.equal(UNIVERSE.length, 5, 'the invented universe is five residents in three houses');
assert.equal(new Set(UNIVERSE).size, 5, 'and nobody is canonical twice');

// ── the store's answer, in the shape of the office's GET /households ───────────
// Built fresh on each call, so one test's mutation never reaches another's input.
const URL_OF_THE_READ = 'https://postmark.town/api/households';
const answer = () => ({
  read: 'households',
  registry: {
    schema_version: 1,
    note: 'invented for the roll',
    households: {
      hearth: { name: 'hearth', accounts: [{ login: 'fern-gh', id: 201 }, { login: 'kit-gh', id: 203 }], residents: ['fern', 'kit'], since: '2026-09-01', declared_by: 'fern' },
      yonder: { name: 'yonder', accounts: [{ login: 'yan-gh', id: 202 }], residents: ['yan', 'zed'], since: '2026-09-02', declared_by: 'yan' },
      lone: { name: 'lone', accounts: [{ login: 'ono-gh', id: 207 }], residents: ['ono'], since: '2026-09-03', declared_by: 'ono' },
    },
  },
  pins: {
    fern: { login: 'fern-gh', id: 201, pinned: '2026-09-01' },
    yan: { login: 'yan-gh', id: 202, pinned: '2026-09-02' },
    zed: { login: 'yan-gh', id: 202, pinned: '2026-09-02' },
    ono: { login: 'ono-gh', id: 207, pinned: '2026-09-03' },
  },
  from: 'the registry store',
});

// ── the two supported inputs of the adapter ───────────────────────────────────
// A synthetic HTTP seam: records what the adapter asked for and hands back a Response-shaped value.
function seam(doc, { status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), accept: init?.headers?.accept });
    return { ok: status >= 200 && status < 300, status, json: async () => structuredClone(doc) };
  };
  return { fetchImpl, calls };
}
const viaUrl = async (doc) => { const s = seam(doc); const got = await loadRegistrySource(URL_OF_THE_READ, { fetchImpl: s.fetchImpl }); return { got, calls: s.calls }; };

const DIR = mkdtempSync(join(tmpdir(), 'reg-roll-'));
after(() => rmSync(DIR, { recursive: true, force: true }));
let n = 0;
// `door`: the whole GET document; `compact`: the { households, pins } file the welcome pass writes.
const viaFile = async (doc, shape) => {
  const path = join(DIR, `${shape}-${n++}.json`);
  writeFileSync(path, JSON.stringify(shape === 'door' ? doc : { households: doc.registry.households, pins: doc.pins }));
  return loadRegistrySource(path);
};

// ── the roll: ONE checker, against CANON, over whatever the adapter returned ──
// Membership is the houses' explicit `residents`. Nothing is derived from the answer's own pins.
const attachments = ({ registry }) => {
  const at = new Map();
  for (const [slug, rec] of Object.entries(registry.households)) for (const h of rec.residents ?? []) at.set(h, [...(at.get(h) ?? []), slug]);
  return at;
};
function rollProblems(loaded, canon = CANON) {
  const at = attachments(loaded);
  const out = [];
  for (const [slug, members] of Object.entries(canon)) for (const handle of members) {
    const held = [...(at.get(handle) ?? [])].sort();
    if (held.length === 0) out.push({ kind: 'missing', handle, canonical: slug, attached: held });
    else if (held.length > 1) out.push({ kind: 'duplicate', handle, canonical: slug, attached: held });
    else if (held[0] !== slug) out.push({ kind: 'misplaced', handle, canonical: slug, attached: held });
  }
  return out.sort((a, b) => a.handle.localeCompare(b.handle));
}
const describe = (p) => ({
  missing: `${p.handle}: attached to no house; the roll has them in ${p.canonical}`,
  duplicate: `${p.handle}: attached to ${p.attached.join(' and ')}; the roll has them in ${p.canonical} only`,
  misplaced: `${p.handle}: attached to ${p.attached[0]}; the roll has them in ${p.canonical}`,
})[p.kind];
class RollRed extends Error { constructor(problems) { super(problems.map(describe).join('\n')); this.problems = problems; } }
const assertRoll = (loaded, canon = CANON) => { const p = rollProblems(loaded, canon); if (p.length) throw new RollRed(p); };
const groupingOf = ({ registry }) => Object.fromEntries(Object.entries(registry.households).map(([slug, rec]) => [slug, [...rec.residents].sort()]));

// The three wrong answers and the two positive controls, each a mutation of a fresh `answer()`.
const WITHOUT_PIN_STAYING = (doc) => { doc.registry.households.yonder.residents = ['zed']; return doc; };                      // yan: pin stays, attachment goes
const DUPLICATED = (doc) => { doc.registry.households.hearth.residents.push('zed'); return doc; };                             // zed: now in hearth AND yonder
const MOVED = (doc) => { doc.registry.households.yonder.residents = ['yan']; doc.registry.households.lone.residents.push('zed'); return doc; };
const PIN_DELETED = (doc) => { delete doc.pins.fern; return doc; };                                                           // fern stays a member
const ACCOUNT_WITH_NO_PIN = (doc) => { delete doc.pins.ono; return doc; };                                                    // lone's account matches no pin

const redOf = (loaded) => { try { assertRoll(loaded); } catch (e) { if (e instanceof RollRed) return e; throw e; } return null; };

test('the clean answer is the roll, through the URL seam and both file shapes, with the same grouping', async () => {
  const { got, calls } = await viaUrl(answer());
  // the adapter asked the named read, once, for JSON — the seam is bound, not assumed
  assert.deepEqual(calls, [{ url: URL_OF_THE_READ, accept: 'application/json' }]);
  const door = await viaFile(answer(), 'door');
  const compact = await viaFile(answer(), 'compact');
  for (const [from, loaded] of [['url', got], ['door file', door], ['compact file', compact]]) {
    assert.deepEqual(rollProblems(loaded), [], `${from}: the roll holds`);
    assert.deepEqual(groupingOf(loaded), { hearth: ['fern', 'kit'], lone: ['ono'], yonder: ['yan', 'zed'] }, `${from}: the grouping is the roll's`);
  }
  assert.deepEqual(got.registry.households, door.registry.households, 'url and door file carry the same houses');
  assert.deepEqual(got.registry.households, compact.registry.households, 'and the compact file the same again');
  assert.deepEqual(got.pins, compact.pins);
  assert.equal(attachments(got).has('kit'), true, 'the canonical resident with no pin is a member (positive control for the fixture)');
  assert.equal(got.pins.kit, undefined, 'and really has no pin');
});

test('a MISSING attachment is named by the roll even though the pin remains', async () => {
  for (const [from, load] of [['url', async (d) => (await viaUrl(d)).got], ['file', (d) => viaFile(d, 'door')]]) {
    const loaded = await load(WITHOUT_PIN_STAYING(answer()));
    assert.ok(loaded.pins.yan, `${from}: yan's pin is still there, so a pin-derived roll would still count them`);
    const red = redOf(loaded);
    assert.ok(red, `${from}: the roll goes red`);
    assert.deepEqual(red.problems, [{ kind: 'missing', handle: 'yan', canonical: 'yonder', attached: [] }], `${from}: exactly the missing attachment`);
    assert.match(red.message, /^yan: attached to no house; the roll has them in yonder$/, `${from}: the reason names the handle and the house`);
  }
});

test('a DUPLICATE attachment across two houses is named by the roll', async () => {
  for (const [from, load] of [['url', async (d) => (await viaUrl(d)).got], ['file', (d) => viaFile(d, 'door')]]) {
    const red = redOf(await load(DUPLICATED(answer())));
    assert.ok(red, `${from}: the roll goes red`);
    assert.deepEqual(red.problems, [{ kind: 'duplicate', handle: 'zed', canonical: 'yonder', attached: ['hearth', 'yonder'] }], `${from}: exactly the duplicate`);
    assert.match(red.message, /^zed: attached to hearth and yonder; the roll has them in yonder only$/, `${from}: the reason names the handle and both houses`);
  }
});

test('a resident filed in the wrong house is named too, so the grouping is held and not only the counts', async () => {
  const { got } = await viaUrl(MOVED(answer()));
  assert.deepEqual(rollProblems(got), [{ kind: 'misplaced', handle: 'zed', canonical: 'yonder', attached: ['lone'] }]);
  assert.notDeepEqual(groupingOf(got), { hearth: ['fern', 'kit'], lone: ['ono'], yonder: ['yan', 'zed'] });
});

test('CONTROL: a roll read off the answer cannot see an absence, and one house per handle hides both wrong answers', async () => {
  // What a view that files each handle once (the store's `identities`: DISTINCT ON handle, solo for the houseless)
  // or a roll read off the answer itself would report.
  const oneHousePerHandle = (loaded) => {
    const out = new Map();
    for (const [h, slugs] of attachments(loaded)) out.set(h, slugs.sort()[0]);
    for (const h of Object.keys(loaded.pins)) if (!out.has(h)) out.set(h, `solo:${h}`);
    return out;
  };
  const missing = (await viaUrl(WITHOUT_PIN_STAYING(answer()))).got;
  const duplicated = (await viaUrl(DUPLICATED(answer()))).got;
  assert.deepEqual(rollProblems(missing, groupingOf(missing)), [], 'a canon read off the missing answer has nothing missing');
  assert.equal(oneHousePerHandle(missing).get('yan'), 'solo:yan', 'the one-house view turns the absence into a solo');
  assert.equal(oneHousePerHandle(duplicated).get('zed'), 'hearth', 'and the doubling into a single, tidy house');
  // ...while the roll held apart from the answer sees both, in the same run
  assert.equal(rollProblems(missing).length, 1);
  assert.equal(rollProblems(duplicated).length, 1);
});

test('POSITIVE CONTROL: deleting a pin does not remove a member whose attachment stays', async () => {
  const { got } = await viaUrl(PIN_DELETED(answer()));
  assert.equal(got.pins.fern, undefined, 'the pin really is gone from what the adapter returned');
  assert.deepEqual(rollProblems(got), [], 'the roll is unchanged: membership is the house, not the pin');
  assert.deepEqual(groupingOf(got).hearth, ['fern', 'kit'], 'fern is still a member of hearth');
});

test('POSITIVE CONTROL: a house account that no resident is pinned to is not newly rejected', async () => {
  const { got } = await viaUrl(ACCOUNT_WITH_NO_PIN(answer()));
  assert.equal(got.registry.households.lone.accounts.length, 1, 'lone still declares its account');
  assert.equal(Object.values(got.pins).some((p) => p.id === 207), false, 'and no pin names it');
  assert.deepEqual(rollProblems(got), [], 'the roll takes no position on it');
  assert.deepEqual(rollProblems((await viaUrl(answer())).got), [], 'hearth already declares kit-gh with no pin for kit, and the clean answer is the roll');
});

test('a refusal is never read as an empty roll: the adapter rejects before the roll runs', async () => {
  const down = seam({ error: 'bounce' }, { status: 503 });
  await assert.rejects(loadRegistrySource(URL_OF_THE_READ, { fetchImpl: down.fetchImpl }), /answered 503/);
  assert.equal(down.calls.length, 1, 'it asked once and did not fall back to anything');
  await assert.rejects(loadRegistrySource(join(DIR, 'no-such-registry.json')), /could not be read/);
  const wrong = seam({ read: 'households', registry: { households: {} } });
  await assert.rejects(loadRegistrySource(URL_OF_THE_READ, { fetchImpl: wrong.fetchImpl }), /is not \{ registry, pins \}/);
  // the roll over an EMPTY but readable answer is red, not clean: absence is a finding
  const emptyHouses = (await viaUrl({ read: 'households', registry: { households: {} }, pins: {} })).got;
  assert.equal(rollProblems(emptyHouses).length, UNIVERSE.length, 'an answer holding no house misses all five');
});
