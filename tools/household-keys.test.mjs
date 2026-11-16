// household-keys.test.mjs — one household, one mint key (Darko, 2026-10-04).
//   node --test tools/household-keys.test.mjs
// Runs on every PR and every push to main (.github/workflows/household-keys.yml).
// Zero-dep; the synthetic cases build throwaway towns in tmp.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { checkRepo, describe, householdKeySplits, rollWith, readHouses } from './household-keys.mjs';
import { currentHouseholds } from './stamp-mint.mjs';
import { loadRegistrySource } from './registry-source.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

// THE RECORD (POS-345): TOWN_REGISTRY=<file|url> (CI: the office's
// https://postmark.town/api/households) makes the LIVE check read the store's
// declared houses rather than the printed tools/households.json. One that is
// named and does not answer fails the check; it never falls back to the file.
const REGISTRY = process.env.TOWN_REGISTRY ? (await loadRegistrySource(process.env.TOWN_REGISTRY)).registry : null;

// THE LIVE INVARIANT. Every declared household mints under exactly one key and
// no key mints for two households. A join that re-keys only the joiner (the
// 2026-10-04 instance: 9 houses, Kev's minting 10 sends on 10-03) reds here,
// naming the house and every key.
test('LIVE: every household in tools/households.json mints under ONE key, and no key spans two households', () => {
  // The positive control: the roll must know the declared residents, or a
  // checkout missing the rooms would read every house as one key of nothing.
  const roll = currentHouseholds(REPO);
  const declared = Object.values(readHouses(REPO, REGISTRY)).flatMap((h) => h?.residents ?? []);
  const known = declared.filter((h) => roll.has(h)).length;
  assert.ok(known > 100 && known >= declared.length * 0.95, `the roll knows ${known} of ${declared.length} declared residents — the positive control`);
  const r = checkRepo(REPO, { registry: REGISTRY });
  assert.deepEqual(describe(r), [], describe(r).join('\n'));
});

// ── the predicate on synthetic towns ──────────────────────────────────────

function town({ pins = {}, addresses = {}, houses, ledger = [] }) {
  const repo = mkdtempSync(join(tmpdir(), 'hh-keys-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(pins));
  writeFileSync(join(repo, 'tools', 'households.json'), JSON.stringify({ schema_version: 1, households: houses }));
  for (const [h, gh] of Object.entries(addresses)) {
    mkdirSync(join(repo, 'WHITE_PAGES', h), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', h, 'ADDRESS.md'), `---\nhandle: ${h}\n${gh ? `github: ${gh}\n` : ''}---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), `# stamp ledger\n\n${ledger.join('\n')}\n`);
  return repo;
}
// Signed in the shape the roll reads; the roll does not check signatures
// (stamp-verify does), so a placeholder is enough for the fold.
const reg = (date, h, key) => `- ${date} · registry: ${h} = ${key} · sig: AAAA`;

test('THE INSTANCE: a joiner re-keyed alone splits the house, and the sentence names the house and both keys', () => {
  const repo = town({
    pins: { kinofire: { id: 7 }, seasiren: { id: 7 } },
    addresses: { kinofire: null, seasiren: null },
    houses: { 'many-doors': { residents: ['kinofire', 'seasiren'] } },
    ledger: [reg('2026-09-26', 'kinofire', 'hh:many-doors')],
  });
  const lines = describe(checkRepo(repo));
  assert.deepEqual(lines, ['many-doors mints under 2 keys: gh:7 (seasiren) · hh:many-doors (kinofire)']);
  rmSync(repo, { recursive: true, force: true });
});

test('the repair: every resident on the house key reads clean', () => {
  const repo = town({
    pins: { kinofire: { id: 7 }, seasiren: { id: 7 } },
    addresses: { kinofire: null, seasiren: null },
    houses: { 'many-doors': { residents: ['kinofire', 'seasiren'] } },
    ledger: [reg('2026-09-26', 'kinofire', 'hh:many-doors'), reg('2026-10-04', 'seasiren', 'hh:many-doors')],
  });
  assert.deepEqual(describe(checkRepo(repo)), []);
  rmSync(repo, { recursive: true, force: true });
});

test('two GitHub accounts in one declared house is a split (no exceptions: "two people on one household is still one household")', () => {
  const repo = town({
    pins: { liv: { id: 1 }, noe: { id: 2 } },
    addresses: { liv: null, noe: null },
    houses: { carried: { accounts: [{ id: 1 }, { id: 2 }], residents: ['liv', 'noe'] } },
  });
  assert.deepEqual(describe(checkRepo(repo)), ['carried mints under 2 keys: gh:1 (liv) · gh:2 (noe)']);
  rmSync(repo, { recursive: true, force: true });
});

test('one key across two declared houses is named', () => {
  const r = householdKeySplits({
    roll: new Map([['a', { key: 'gh:9' }], ['b', { key: 'gh:9' }]]),
    houses: { one: { residents: ['a'] }, two: { residents: ['b'] } },
  });
  assert.deepEqual(describe(r), ['key gh:9 mints for two households: one, two']);
});

test('a resident the roll does not know mints nothing and is not counted', () => {
  const r = householdKeySplits({
    roll: new Map([['a', { key: 'hh:one' }]]),
    houses: { one: { residents: ['a', 'not-yet-arrived'] } },
  });
  assert.deepEqual(describe(r), []);
});

test('rollWith folds lines about to land, so a writer can ask before it signs', () => {
  const roll = new Map([['a', { key: 'gh:1' }], ['b', { key: 'gh:1' }]]);
  const houses = { one: { residents: ['a', 'b'] } };
  const joinerOnly = rollWith(roll, ['- 2026-10-04 · registry: a = hh:one']);
  assert.equal(householdKeySplits({ roll: joinerOnly, houses }).split[0]?.house, 'one');
  const whole = rollWith(roll, ['- 2026-10-04 · registry: a = hh:one', '- 2026-10-04 · registry: b = hh:one']);
  assert.deepEqual(householdKeySplits({ roll: whole, houses }).split, []);
});
