// household-keys.mjs — ONE HOUSEHOLD, ONE MINT KEY (Darko, 2026-10-04).
//
//   node tools/household-keys.mjs           # prints the split houses; exit 1 if any
//   node tools/household-keys.mjs --json    # one JSON line (the box alarm's log line)
//
// The mint caps a household by the key `currentHouseholds` gives each handle
// (the base registry with the ledger's sealed `registry:` lines folded over it).
// The DECLARED household is tools/households.json. The two are meant to say the
// same thing, and until this file nothing checked that they did: a join into an
// existing house wrote ONE registry line, for the joiner, so the residents
// already in the house kept their human's `gh:` key and the house minted as two
// households with two daily caps. Measured 2026-10-04: 9 houses split, Kev's
// (house-of-many-doors) minting 10 sends on 10-03. Repaired at town 07fa74d6a.
//
// This is the one predicate, and three readers share it:
//   · the live test (tools/household-keys.test.mjs) — reds on a split;
//   · the office's drain — refuses a crossing whose lines would leave a house
//     it touches split (it folds this clone's currentHouseholds the same way);
//   · the box alarm — runs this CLI against the box's town clone and logs the
//     JSON line, which the roll-call reads as an outcome row.
//
// THERE ARE NO EXCEPTIONS (Darko, 2026-10-04: "two people on one household is
// still one household"). Two GitHub ids inside one declared house is exactly
// the case this catches; the-carried-weight was merged at town 7a5ba94cf.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentHouseholds, parseStampLedger, parseLaws } from './stamp-mint.mjs';

// `registry` (POS-345): the store's registry (tools/households.json's
// object), handed over by --registry <file|url> through
// tools/registry-source.mjs. Without it, the printout is read, as before.
export function readHouses(repo, registry = null) {
  if (registry) return registry.households ?? {};
  return JSON.parse(readFileSync(join(repo, 'tools', 'households.json'), 'utf8')).households ?? {};
}

// Fold `extraLines` (bare `- <date> · registry: <h> = <key>` lines a writer is
// about to append) over a roll, the same way currentHouseholds folds the ledger.
export function rollWith(roll, extraLines = []) {
  const out = new Map(roll);
  const { revisions } = parseLaws(parseStampLedger(`${extraLines.join('\n')}\n`));
  for (const r of revisions) out.set(r.handle, { key: r.key, provisional: false });
  return out;
}

/**
 * The split houses. A house is split when its residents mint under more than
 * one key; a key is shared when residents of two houses mint under it.
 * Residents the roll does not know (no room, no line) mint nothing and are not
 * counted. Returns { split, shared }; both are defects.
 */
export function householdKeySplits({ roll, houses }) {
  const split = [];
  const houseOf = new Map();
  for (const [slug, rec] of Object.entries(houses)) {
    const keys = new Map();
    for (const h of rec?.residents ?? []) {
      houseOf.set(h, slug);
      const k = roll.get(h)?.key;
      if (!k) continue;
      keys.set(k, [...(keys.get(k) ?? []), h]);
    }
    const entry = { house: slug, keys: Object.fromEntries([...keys].sort(([a], [b]) => a.localeCompare(b))) };
    if (keys.size > 1) split.push(entry);
  }
  const byKey = new Map();
  for (const [h, v] of roll) {
    const slug = houseOf.get(h);
    if (!slug) continue;
    byKey.set(v.key, new Set([...(byKey.get(v.key) ?? []), slug]));
  }
  const shared = [...byKey].filter(([, s]) => s.size > 1).map(([key, s]) => ({ key, houses: [...s].sort() }));
  return { split, shared };
}

/** The whole check over a town checkout, with optional lines about to land. */
export function checkRepo(repo, { extraLines = [], registry = null } = {}) {
  return householdKeySplits({
    roll: rollWith(currentHouseholds(repo), extraLines),
    houses: readHouses(repo, registry),
  });
}

/** One sentence per defect, naming the house and every key. */
export function describe({ split, shared }) {
  return [
    ...split.map((s) => `${s.house} mints under ${Object.keys(s.keys).length} keys: ${Object.entries(s.keys).map(([k, hs]) => `${k} (${hs.join(', ')})`).join(' · ')}`),
    ...shared.map((s) => `key ${s.key} mints for two households: ${s.houses.join(', ')}`),
  ];
}

function main(registrySource = null) {
  const args = process.argv.slice(2);
  const ri = args.indexOf('--repo');
  const repo = ri >= 0 ? args[ri + 1] : resolve(fileURLToPath(new URL('..', import.meta.url)));
  const registry = registrySource?.registry ?? null;
  const r = checkRepo(repo, { registry });
  const lines = describe(r);
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({
      at: new Date().toISOString(),
      split_households: r.split.map((s) => s.house),
      shared_keys: r.shared.map((s) => s.key),
      detail: lines,
    }) + '\n');
  } else {
    for (const l of lines) console.log(l);
    console.log(`household keys: ${Object.keys(readHouses(repo, registry)).length} houses · ${r.split.length} split · ${r.shared.length} key(s) across two houses`);
  }
  process.exit(lines.length ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // --registry <file|url>: the store's registry, handed over or fetched (POS-345).
  const { registryFromArgv } = await import('./registry-source.mjs');
  main(await registryFromArgv(process.argv, { tool: 'household-keys' }));
}
