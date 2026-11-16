// validate.mjs — self-test for town-atlas.mjs.
//
// Runs the pipeline against this very repo (twice) and asserts today's
// known-good invariants. Not a general-purpose test framework — a tripwire
// for "did the atlas just silently stop matching the town it describes."
//
// Run from anywhere:  node validate.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PIPELINE = join(HERE, 'town-atlas.mjs');
const TOWN_JSON_PATH = join(HERE, 'town.json');

const failures = [];
const check = (label, ok, detail = '') => {
  if (ok) {
    console.log(`  ok — ${label}`);
  } else {
    console.log(`  FAIL — ${label}${detail ? `: ${detail}` : ''}`);
    failures.push(label);
  }
};

function runPipeline() {
  const out = execFileSync(process.execPath, [PIPELINE], { encoding: 'utf8' });
  return out;
}

console.log('Run 1: node town-atlas.mjs');
const run1Stdout = runPipeline();
if (!existsSync(TOWN_JSON_PATH)) {
  console.error('FATAL: town.json was not written by the pipeline.');
  process.exit(1);
}
const run1Json = readFileSync(TOWN_JSON_PATH, 'utf8');

let town;
try {
  town = JSON.parse(run1Json);
} catch (e) {
  console.error(`FATAL: town.json does not parse: ${e.message}`);
  process.exit(1);
}
console.log('  ok — town.json parses\n');

// --- invariant checks -----------------------------------------------------

console.log('Invariants:');

const totalResidents = town.homes.length + town.arrivals.length + town.pigeonholes.length;
check('>= 20 residents total', totalResidents >= 20, `got ${totalResidents}`);

// The town grows: placed homes/regions are checked as "at least the founding
// set, never fewer" — an exact-count assertion here would fail every time a
// new resident's placement lands, which is the pipeline working, not breaking.
const placedResidents = town.homes.map((h) => h.resident).sort();
const foundingPlaced = ['carta', 'limen', 'postmaster', 'rei', 'wright'];
check(
  'placed homes include the founding five (wright, rei, limen, carta, postmaster)',
  foundingPlaced.every((r) => placedResidents.includes(r)),
  `got ${town.homes.length} placed homes: [${placedResidents.join(', ')}]`
);
console.log(`  (placed homes now: ${town.homes.length})`);

const postmasterHome = town.homes.find((h) => h.resident === 'postmaster');
check(
  'postmaster\'s home is "the-post-office" at the centre',
  !!postmasterHome && postmasterHome.id === 'the-post-office' && postmasterHome.region === null,
  postmasterHome ? `id=${postmasterHome.id} region=${postmasterHome.region}` : 'no postmaster home found'
);

const regionIds = town.regions.map((r) => r.id);
const foundingRegions = ['the-trueing-terrace', 'the-lanternseed-gardens', 'the-threshold-district', 'the-long-run'];
check(
  'regions include the founding four',
  foundingRegions.every((r) => regionIds.includes(r)),
  `got ${town.regions.length} regions: [${regionIds.join(', ')}]`
);
console.log(`  (regions now: ${town.regions.length})`);

// Evidence drift against a FROZEN baseline (Keemin, 2026-09-29, postmark#3263):
// the twelve flags standing when the Atlas was retired are listed in
// drift-baseline.json and neither repaired nor allowed to block a lawful
// placement. Any drift flag NOT in that list still fails, so new drift is
// caught exactly as before.
const DRIFT_BASELINE = new Set(JSON.parse(readFileSync(join(HERE, 'drift-baseline.json'), 'utf8')).frozen);
const evidenceDriftFlags = town.flags.filter((f) => f.kind === 'evidence-drift');
const newDrift = evidenceDriftFlags.filter((f) => !DRIFT_BASELINE.has(f.detail));
check('no evidence-drift flag outside the frozen baseline', newDrift.length === 0, newDrift.map((f) => f.detail).join('; '));
console.log(`  (evidence-drift flags: ${evidenceDriftFlags.length}, all in the frozen baseline of ${DRIFT_BASELINE.size})`);

// illumination_queue: homes/regions with real words but no picture. Field
// presence and shape are hard-gated (a missing/malformed field is a pipeline
// bug); the exact membership is soft — new HOMEs or newly-added images shift
// it legitimately, so a drift from today's known baseline is a NOTE, not FAIL.
const iq = town.illumination_queue;
check('illumination_queue field exists and is an array', Array.isArray(iq), typeof iq);
if (Array.isArray(iq)) {
  const wellFormed = iq.every(
    (e) =>
      e && typeof e === 'object' &&
      (e.kind === 'home' || e.kind === 'region') &&
      typeof e.id === 'string' && e.id &&
      typeof e.holder === 'string' && e.holder &&
      typeof e.title === 'string' && e.title &&
      typeof e.source === 'string' && e.source
  );
  check('illumination_queue entries are well-formed', wellFormed, JSON.stringify(iq));

  const sortedCopy = [...iq].sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  check(
    'illumination_queue is sorted (kind then id)',
    JSON.stringify(iq) === JSON.stringify(sortedCopy)
  );

  const gotIds = iq.map((e) => `${e.kind}:${e.id}`).sort();
  const expectedIds = ['home:the-threshold-house', 'region:the-threshold-district', 'region:the-trueing-terrace'].sort();
  if (JSON.stringify(gotIds) === JSON.stringify(expectedIds)) {
    console.log('  ok — illumination_queue matches today\'s known baseline (3 entries)');
  } else {
    console.log(`  NOTE — illumination_queue has moved from today's known baseline: got [${gotIds.join(', ')}]`);
    // Not a hard failure — a resident adding an image or a new described-but-
    // unpictured home/region legitimately changes this set.
  }
}

const unplacedHomeFlags = town.flags.filter((f) => f.kind === 'unplaced-home');
if (unplacedHomeFlags.length === 0) {
  console.log('  ok — 0 unplaced-home flags');
} else {
  console.log(`  NOTE — ${unplacedHomeFlags.length} unplaced-home flag(s) (a new HOME/ landed since this check was last raised):`);
  for (const f of unplacedHomeFlags) console.log(`    - ${f.detail}`);
  // Not a hard failure — a new HOME/ with no placements.json record yet is an
  // expected, honest "arrivals" state, not a pipeline bug. Surfaced, not gated.
}

// --- determinism: round-trip byte-identical on a second run --------------

console.log('\nRun 2: node town-atlas.mjs (checking byte-identical round-trip)');
runPipeline();
const run2Json = readFileSync(TOWN_JSON_PATH, 'utf8');
check('town.json is byte-identical across two consecutive runs', run1Json === run2Json);

// --- report -----------------------------------------------------------------

console.log('');
if (failures.length) {
  console.log(`${failures.length} check(s) FAILED:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log('All checks passed.');
  process.exit(0);
}
