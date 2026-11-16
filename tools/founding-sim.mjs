#!/usr/bin/env node
// founding-sim.mjs — the founding-act simulation fold: what the stakes DO.
//
// ⚠ PRE-CARVE, AND A RE-RUN IS OWED (Wright, 2026-08-10). The first run of this
// script folded the world under the SITE-CLUSTER model. The founding act
// executes after the merge train (grain/carve/consent) and after region
// polygon-truing, under which per-cell region carving REPLACES site clustering,
// the white flower leaves rivalry entirely (sovereign under household grain),
// and cross-household fan-up requires consent words. The blocker, the scale
// fact and the ordering requirement survive that change; the DETERMINATION
// SPECIFICS do not. Re-run this against the post-merge world before any letter
// quotes a number.
//
// Parameterized for exactly that re-run: --stake N, --targets FILE, --holder H.
//
// Question: what do 13 stakes of 77 stamps each, held by `the-town` onto the
// 11 resident-founder region marks + the-town/the-town-centre +
// vermillion/the-pando-peak, DO to determination?
//
// Discipline: the hypothetical `weight` per row is computed by the TOWN's own
// deriveWorldMarkWeights (the k-law engine), not by this script. We patch the
// live positions map and re-run the real derive, so the external-only k rule,
// the household registry, and the first-holder-gets-k assignment are all applied
// by the one implementation that owns them.
//
// Nothing is written. --no-write folds only.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argOf = (name, dflt = null) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : dflt; };
const positional = process.argv.slice(2).filter((a, i, arr) => !a.startsWith('--') && !(i > 0 && arr[i - 1].startsWith('--')));
const TOWN = positional[0];
const WORLD = positional[1];
const OUT = positional[2];
if (!TOWN || !WORLD || !OUT) {
  console.error('usage: treasury-sim.mjs <town-clone> <world-clone> <out-dir> [--stake N] [--holder H] [--targets FILE]');
  process.exit(2);
}
const HOLDER = argOf('--holder', 'the-town');
const TARGETS_FILE = argOf('--targets', null);

const ws = await import(new URL('file:///' + join(TOWN, 'tools/world-stake.mjs').replace(/\\/g, '/')));
const mf = await import(new URL('file:///' + join(WORLD, 'tools/marks-fold.mjs').replace(/\\/g, '/')));

// ---- the 13 targets, resolved against the live record (documented for review) ----
const STAKE_N = Number(argOf('--stake', '77'));
const TARGETS = [
  // founder            region mark id
  ['aion-solare', 'aion-solare/aelyria'],
  ['caelum', 'caelum/evermoon'],
  ['carta', 'carta/the-long-run'],
  ['east-facing-window', 'east-facing-window/the-east-window-district'],
  ['limen', 'limen/the-threshold-district'],
  ['orion-by-the-fire', 'orion-by-the-fire/the-reach'],
  ['rei', 'rei/the-lanternseed-gardens'],
  ['sage-reeves', 'sage-reeves/the-high-ground'],
  ['sol-of-garrison', 'sol-of-garrison/the-protected-grove'],
  ['spar', 'spar/the-doubled-coast'],
  ['wright', 'wright/the-trueing-terrace'],
  ['(the town itself)', 'the-town/the-town-centre'],
  ['(vermillion)', 'vermillion/the-pando-peak'],
];

// ---- baseline: the live ledger's own derive ----
const stateA = ws.worldStakeState(TOWN);
const derivedA = ws.deriveWorldMarkWeights(TOWN, stateA);

// ---- hypothetical: same state, plus 13 the-town positions, real derive re-run ----
const stateB = ws.worldStakeState(TOWN);
for (const [, mark] of TARGETS) {
  const key = `${mark}|${HOLDER}`;
  stateB.positions.set(key, (stateB.positions.get(key) ?? 0) + STAKE_N);
}
const derivedB = ws.deriveWorldMarkWeights(TOWN, stateB);

// ---- fold both ----
const marksDir = join(WORLD, 'WORLD/marks');
const terrain = JSON.parse(readFileSync(join(WORLD, 'WORLD/skeleton.json'), 'utf8'));
const households = JSON.parse(readFileSync(join(WORLD, 'WORLD/households.json'), 'utf8'));
const marks = mf.loadMarks(marksDir);
const committed = JSON.parse(readFileSync(join(WORLD, 'WORLD/world-state.json'), 'utf8'));

function run(stakes, prev, label) {
  const state = mf.fold({ marks, terrain, stakes, prev, tick: 0, households });
  return { label, state };
}

const runs = {
  coldA: run(derivedA.rows, null, 'baseline / no prev'),
  coldB: run(derivedB.rows, null, 'founding / no prev'),
  warmA: run(derivedA.rows, committed, 'baseline / prev=committed'),
  warmB: run(derivedB.rows, committed, 'founding / prev=committed'),
};

// ---- diffing ----
const summarize = (s) => ({
  marks: s.marks.length,
  parcels: s.parcels.length,
  determined: Object.keys(s.determined).length,
  vague: s.vague.length,
  rivalries: s.rivalries.length,
  errors: s.errors.length,
});

function detDiff(a, b) {
  const keys = new Set([...Object.keys(a.determined), ...Object.keys(b.determined)]);
  const out = [];
  for (const k of [...keys].sort()) {
    const va = a.determined[k] ?? null, vb = b.determined[k] ?? null;
    if (va !== vb) out.push({ slot: k, before: va, after: vb });
  }
  return out;
}
function listDiff(a, b) {
  const A = new Set(a), B = new Set(b);
  return {
    added: [...B].filter((x) => !A.has(x)).sort(),
    removed: [...A].filter((x) => !B.has(x)).sort(),
  };
}
function weightDiff(a, b) {
  const bw = new Map(b.marks.map((m) => [m.id, m]));
  const out = [];
  for (const m of a.marks) {
    const n = bw.get(m.id);
    if (!n) continue;
    if (n.weight !== m.weight || n.stamps !== m.stamps) {
      out.push({ id: m.id, stamps: [m.stamps, n.stamps], weight: [m.weight, n.weight], delta: n.weight - m.weight });
    }
  }
  return out.sort((x, y) => y.delta - x.delta);
}
function rivalryIndex(s) {
  const m = new Map();
  for (const r of s.rivalries) m.set(r.slot, r);
  return m;
}

const report = {
  generated: new Date().toISOString(),
  stake_n: STAKE_N,
  targets: TARGETS.map(([f, m]) => ({ founder: f, mark: m })),
  k: derivedA.k,
  summary: {
    cold_baseline: summarize(runs.coldA.state),
    cold_founding: summarize(runs.coldB.state),
    warm_baseline: summarize(runs.warmA.state),
    warm_founding: summarize(runs.warmB.state),
  },
  errors: {
    cold_baseline: runs.coldA.state.errors,
    cold_founding: runs.coldB.state.errors,
    warm_baseline: runs.warmA.state.errors,
    warm_founding: runs.warmB.state.errors,
  },
  cold: {
    determination: detDiff(runs.coldA.state, runs.coldB.state),
    vague: listDiff(runs.coldA.state.vague, runs.coldB.state.vague),
    weights: weightDiff(runs.coldA.state, runs.coldB.state),
  },
  warm: {
    determination: detDiff(runs.warmA.state, runs.warmB.state),
    vague: listDiff(runs.warmA.state.vague, runs.warmB.state.vague),
  },
  ledger_weight_rows: {
    baseline: derivedA.marks.filter((m) => TARGETS.some(([, t]) => t === m.mark)),
    founding: derivedB.marks.filter((m) => TARGETS.some(([, t]) => t === m.mark)),
  },
};

// rivalry detail on every slot that touched a target mark
const rivA = rivalryIndex(runs.coldA.state), rivB = rivalryIndex(runs.coldB.state);
const touched = new Set([...rivA.keys(), ...rivB.keys()].filter((k) => TARGETS.some(([, t]) => k.includes(t))));
report.cold.rivalries_touching_targets = [...touched].sort().map((slot) => ({
  slot,
  before: rivA.get(slot) ?? null,
  after: rivB.get(slot) ?? null,
}));
report.cold.all_rivalries_before = runs.coldA.state.rivalries;
report.cold.all_rivalries_after = runs.coldB.state.rivalries;

writeFileSync(join(OUT, 'treasury-sim-report.json'), JSON.stringify(report, null, 2));

// ---- human read ----
const L = [];
L.push('=== TREASURY SIMULATION — 13 × 77 stamps, holder: the-town ===');
L.push(`k (unique-external-household bonus) = ${derivedA.k}`);
L.push('');
L.push('-- fold summary --');
for (const [k, v] of Object.entries(report.summary)) {
  L.push(`${k.padEnd(16)} marks=${v.marks} parcels=${v.parcels} determined=${v.determined} vague=${v.vague} rivalries=${v.rivalries} errors=${v.errors}`);
}
L.push('');
L.push('-- fold errors --');
for (const [k, v] of Object.entries(report.errors)) L.push(`${k.padEnd(16)} ${v.length} ${v.length ? JSON.stringify(v) : ''}`);
L.push('');
L.push('-- ledger_weight on the 13 targets (town derive) --');
const bl = new Map(derivedA.marks.map((m) => [m.mark, m]));
for (const [, mark] of TARGETS) {
  const a = bl.get(mark), b = derivedB.marks.find((m) => m.mark === mark);
  const av = a ? `${a.escrow} escrow + ${derivedA.k}×${a.households_external} ext = ${a.weight}` : '(no position) 0';
  const bv = `${b.escrow} escrow + ${derivedB.k}×${b.households_external} ext = ${b.weight}`;
  L.push(`${mark.padEnd(46)} ${av.padEnd(30)} -> ${bv}`);
}
L.push('');
L.push('-- determination changes (cold) --');
L.push(report.cold.determination.length ? report.cold.determination.map((d) => `  ${d.slot}: ${d.before} -> ${d.after}`).join('\n') : '  (none)');
L.push('-- vague changes (cold) --');
L.push(`  added: ${report.cold.vague.added.join(', ') || '(none)'}`);
L.push(`  removed: ${report.cold.vague.removed.join(', ') || '(none)'}`);
L.push('-- determination changes (warm, prev=committed) --');
L.push(report.warm.determination.length ? report.warm.determination.map((d) => `  ${d.slot}: ${d.before} -> ${d.after}`).join('\n') : '  (none)');
L.push('-- vague changes (warm) --');
L.push(`  added: ${report.warm.vague.added.join(', ') || '(none)'}`);
L.push(`  removed: ${report.warm.vague.removed.join(', ') || '(none)'}`);
L.push('');
L.push(`-- weight changes (cold): ${report.cold.weights.length} marks moved --`);
for (const w of report.cold.weights) L.push(`  ${String(w.delta).padStart(6)}  ${w.id.padEnd(48)} stamps ${w.stamps[0]}->${w.stamps[1]}  weight ${w.weight[0]}->${w.weight[1]}`);
L.push('');
L.push('-- rivalries touching a target mark --');
for (const r of report.cold.rivalries_touching_targets) {
  L.push(`  slot: ${r.slot}`);
  L.push(`    before: total=${r.before?.total ?? '-'} det=${r.before?.determined ?? 'null'} ${JSON.stringify(r.before?.values ?? [])}`);
  L.push(`    after:  total=${r.after?.total ?? '-'} det=${r.after?.determined ?? 'null'} ${JSON.stringify(r.after?.values ?? [])}`);
}
const text = L.join('\n');
writeFileSync(join(OUT, 'treasury-sim-report.txt'), text);
console.log(text);
