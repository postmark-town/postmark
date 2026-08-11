#!/usr/bin/env node
// yield-sim.mjs — the §9.1 value-mint consequence table, DRY-RUN ONLY.
//
// ── WHY THIS EXISTS WHILE q IS UNLIT ─────────────────────────────────────────
// The founder's final ship-night word (2026-08-11): the board is purely
// liquid; "q=0. no minterest… only faucet." The PARKED design is q=30,
// per-settlement epoch, per-mark circuit breaker 5 (his calls B1/B2 + the
// 03:37 "q at 30" ruling, superseded into the park by the final scope). Rei's
// launch seatbelt #5 binds any future un-park: "q should begin inside a
// bounded range with concrete issuance consequences shown at the ballot."
// THIS TOOL IS THAT CONSEQUENCE TABLE — run it, read what a q would actually
// pay, town-wide and per mark, before any ballot or ruling lights the engine.
//
// THE ENGINE (ECONOMY.md §9.1, generalized 2026-08-03):
//     mint per epoch = q · (Σ√cᵢ)² / M      — capped by the breaker per mark
// where cᵢ = each backing household's stake on the mark, EXCLUDING the
// creator's own household (Rei seatbelt #5: "a creator's own stake should not
// contribute to that creator's beauty yield"), M = global cumulative mint
// snapshotted at the epoch start (seatbelt #6: snapshot M so processing order
// cannot alter payouts). Only DETERMINED marks yield — pass --world-state to
// apply that filter from the fold's own `determined` list; without it every
// staked mark is shown and the missing filter is disclosed, never silent.
//
// Usage:
//   node tools/yield-sim.mjs --repo PATH [--q 30] [--breaker 5]
//        [--world-state world-state.json] [--faucet-daily 1040] [--json]
//
// Writes nothing, signs nothing, mints nothing — arithmetic about a parked
// design, in the open, so the next economics sitting starts from numbers.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { worldStakeState } from './world-stake.mjs';
import { foldMintCount } from './stamp-mint.mjs';

// Pure kernel, exported for tests: households = [{household, n}] EXTERNAL to
// the creator (the caller excludes; the kernel just sums).
export function qfKernel(households) {
  const s = households.reduce((acc, h) => acc + Math.sqrt(h.n), 0);
  return s * s;
}

// One mark's epoch yield under (q, M, breaker). Deterministic, clamped, floor
// at 3 decimal places for display honesty (the ledger would round at write;
// nothing here writes).
export function epochYield({ kernel, q, M, breaker }) {
  if (M <= 0) throw new Error('M must be positive — a zero-mint town has no denominator yet');
  return Math.min((q * kernel) / M, breaker);
}

export function simulate({ state, q, breaker, M, determined = null }) {
  // group positions per mark per household, excluding the creator's household
  const perMark = new Map();
  for (const [key, n] of state.positions.entries()) {
    const i = key.lastIndexOf('|');
    const mark = key.slice(0, i);
    const holder = key.slice(i + 1);
    if (determined && !determined.has(mark)) continue;
    const creator = mark.slice(0, mark.indexOf('/'));
    const creatorHousehold = state.currentHouseholdOf(creator);
    const household = state.currentHouseholdOf(holder);
    if (household === creatorHousehold) continue; // seatbelt #5: own stakes never yield to yourself
    if (!perMark.has(mark)) perMark.set(mark, new Map());
    const hh = perMark.get(mark);
    hh.set(household, (hh.get(household) ?? 0) + n);
  }

  const rows = [];
  for (const [mark, hh] of [...perMark].sort(([a], [b]) => a.localeCompare(b))) {
    const households = [...hh].map(([household, n]) => ({ household, n }));
    const kernel = qfKernel(households);
    const per_epoch = epochYield({ kernel, q, M, breaker });
    rows.push({
      mark, creator: mark.slice(0, mark.indexOf('/')),
      external_households: households.length,
      external_escrow: households.reduce((s, h) => s + h.n, 0),
      kernel: Number(kernel.toFixed(2)),
      per_epoch: Number(per_epoch.toFixed(3)),
      per_day: Number((per_epoch * 2).toFixed(3)),      // two settlements: 06:00Z + 18:00Z
      per_month: Number((per_epoch * 2 * 30).toFixed(1)),
      breaker_hit: (q * kernel) / M > breaker,
    });
  }
  rows.sort((a, b) => b.per_epoch - a.per_epoch || a.mark.localeCompare(b.mark));
  const townDaily = rows.reduce((s, r) => s + r.per_day, 0);
  return { q, breaker, M, rows, town_daily: Number(townDaily.toFixed(2)) };
}

function main() {
  const arg = (name, dflt = null) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : dflt; };
  const has = (name) => process.argv.includes(name);
  const repo = resolve(arg('--repo', '.'));
  const q = Number(arg('--q', '30'));
  const breaker = Number(arg('--breaker', '5'));
  const faucetDaily = Number(arg('--faucet-daily', '1040'));

  const state = worldStakeState(repo);
  const M = [...foldMintCount(state.entries).values()].reduce((a, b) => a + b, 0);

  let determined = null, determinedNote = '⚠ no --world-state: showing EVERY staked mark; the live engine pays only DETERMINED marks';
  const ws = arg('--world-state');
  if (ws && existsSync(ws)) {
    const world = JSON.parse(readFileSync(ws, 'utf8'));
    const d = world.determined ?? {};
    // The fold's `determined` is keyed by contest (`<mark>::<slot>` for
    // predicate rivalries, `site::a|b|…` for ground contests). v0 extracts the
    // slot-contest winners' marks only — WHICH marks count as "determined" for
    // yield purposes is an OPEN DETAIL of the parked design (the §9.1 text
    // predates the rivalry-keyed fold), and this tool names the gap rather
    // than quietly inventing the answer.
    determined = new Set(Object.keys(Array.isArray(d) ? {} : d)
      .filter((k) => k.includes('::') && !k.startsWith('site::'))
      .map((k) => k.slice(0, k.indexOf('::'))));
    if (Array.isArray(d)) for (const m of d) determined.add(typeof m === 'string' ? m : m.id ?? m.mark);
    determinedNote = `determined filter PARTIAL: ${determined.size} slot-contest marks extracted; ground-contest winners NOT extracted (open design detail — the §9.1 "determined" set needs its own ruling)`;
  }

  const sim = simulate({ state, q, breaker, M, determined });
  console.log(`YIELD CONSEQUENCE TABLE — q=${q}, breaker=${breaker}/mark/epoch, M=${M} (snapshot), 2 epochs/day`);
  console.log(`  ${determinedNote}`);
  console.log('');
  for (const r of sim.rows.slice(0, 25)) {
    console.log(`  ${r.per_epoch.toFixed(3).padStart(8)}/epoch  ${r.per_month.toFixed(1).padStart(7)}/mo  ${r.breaker_hit ? 'BRKR' : '    '}  ${r.mark}  (${r.external_households} ext hh, ${r.external_escrow} escrow)`);
  }
  if (sim.rows.length > 25) console.log(`  … ${sim.rows.length - 25} more (use --json for all)`);
  console.log('');
  console.log(`  town-wide: ~${sim.town_daily}/day minted at q=${q} — ${(100 * sim.town_daily / faucetDaily).toFixed(1)}% of a ~${faucetDaily}/day faucet`);
  console.log(`  (the ship-night napkin said ~1% at q=30 — if this number disagrees materially, the napkin loses.)`);
  console.log('');
  console.log('  DRY RUN, ALWAYS: q is UNLIT (founder ruling 2026-08-11, purely liquid BETA). This is the ballot\'s consequence table, not a mint.');
  if (has('--json')) console.log(JSON.stringify(sim, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
