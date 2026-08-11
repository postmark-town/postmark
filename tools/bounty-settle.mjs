#!/usr/bin/env node
// bounty-settle.mjs — burn-remint v0, REHEARSAL GRADE: the conversion planner
// for a completed bounty, built to the founder's parked rulings of 2026-08-11.
//
// ── THE PARK, FIRST ──────────────────────────────────────────────────────────
// The board shipped PURELY LIQUID, BETA (founder's final word, 2026-08-11
// ~03:53 EDT: "ship the liquid, no mint changes"). Burn-remint is DESIGNED and
// PARKED — so this tool PLANS a conversion end-to-end and REFUSES to write,
// always. There is no --commit path to arm by flag: the un-park is a founder
// ruling that flips `law_side.burn_remint.enabled` in ECONOMY-DIALS.json AND
// lands the ledger grammar for a conversion class through the fleet's
// implementer/reviewer cycle. Until both exist, the only honest output is the
// plan. (A write-path built solo at night against a sealed money ledger would
// be exactly the "polished draft over live thought" class of error this town
// keeps paying for.)
//
// ── THE DESIGN THIS REHEARSES (each rule cites its ruling) ───────────────────
// A bounty notice is a world mark (class: bounty) carrying a reward; residents
// back it by ordinary world stakes (escrow on the notice). On completion:
//
//   1. WHO CONFIRMS: the poster AND the town countersign (A1, 2026-08-11:
//      "poster AND the town. I do manual review for now, maybe assign Core
//      Team to it."). The plan prints the countersign checklist; no signature
//      machinery exists here because no write does.
//   2. WHAT CONVERTS: external backers' escrow BURNS (their liquid is
//      destroyed) and an equal mint writes the completer's past + present —
//      equity priced by what real people gave up. Liquid supply net zero;
//      the equity denominator grows by the pot (the 03:45 exchange: "burn-
//      remint is not EQUITY burn, just liquid" — confirmed, burn touches
//      escrowed present-tense only; nobody's past ever decreases).
//   3. WHAT RETURNS, twice over:
//      — the POSTER's household stakes return (A3, confirmed: "Poster's own
//        stake: returns, never converts");
//      — the COMPLETER's household stakes return (ECONOMY.md §4's standing
//        guard: "A completer's own stakes return rather than convert: no
//        subject may buy equity from itself").
//   4. NO BREADTH FACTOR on conversion (A2, skipped: the poster+town
//      countersign made it redundant — "a human reading 'who funded this pot'
//      catches a 2-ring better than any formula. It's on the shelf if review
//      ever gets too heavy.").
//
// Usage (read-only, always):
//   node tools/bounty-settle.mjs --repo PATH --mark <by>/<slug> --completer <handle> [--json]
//   (--commit prints the park refusal and exits 2 — that is its entire job.)

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { worldStakeState } from './world-stake.mjs';

export const PARK_RULING =
  'burn-remint is PARKED (founder ruling 2026-08-11: the board is purely liquid, BETA, no mint changes). ' +
  'This tool rehearses; it does not write. The un-park needs: a founder word, law_side.burn_remint in ' +
  'ECONOMY-DIALS.json, and the conversion ledger class built through the implementer/reviewer cycle.';

// The pure planner: given the mark, the completer, and a stake state, decide
// what converts and what returns. Exported so the tests hold the law without
// a repo. `state` is worldStakeState()'s shape (positions + currentHouseholdOf).
export function planConversion({ mark, completer, state }) {
  const poster = mark.includes('/') ? mark.slice(0, mark.indexOf('/')) : null;
  if (!poster) throw new Error(`"${mark}" is not a mark id (<by>/<slug>)`);
  const posterHousehold = state.currentHouseholdOf(poster);
  const completerHousehold = state.currentHouseholdOf(completer);

  const converts = [];
  const returns = [];
  for (const [key, n] of [...state.positions.entries()].sort()) {
    const i = key.lastIndexOf('|');
    if (key.slice(0, i) !== mark) continue;
    const holder = key.slice(i + 1);
    const household = state.currentHouseholdOf(holder);
    const row = { holder, household, n };
    if (household === posterHousehold) returns.push({ ...row, why: "poster's household — returns, never converts (A1/A3)" });
    else if (household === completerHousehold) returns.push({ ...row, why: "completer's household — no subject buys equity from itself (§4 guard)" });
    else converts.push(row);
  }
  const burned = converts.reduce((s, r) => s + r.n, 0);
  return {
    mark, poster, posterHousehold, completer, completerHousehold,
    converts, returns,
    burned,
    reminted: burned, // supply-neutral by construction: minted === burned
    countersigns: [
      { who: `poster (${poster})`, kind: 'the word that it was done', have: false },
      { who: 'the town (founder manual review; maybe Core Team later)', kind: 'the countersign', have: false },
    ],
  };
}

function main() {
  const arg = (name, dflt = null) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : dflt; };
  const has = (name) => process.argv.includes(name);

  if (has('--commit') || has('--execute')) {
    console.error(`REFUSED: ${PARK_RULING}`);
    process.exit(2);
  }

  const repo = resolve(arg('--repo', '.'));
  const mark = arg('--mark');
  const completer = arg('--completer');
  if (!mark || !completer) { console.error('need --mark <by>/<slug> and --completer <handle>'); process.exit(1); }

  // Optional world-state read, for the notice's own face (ask/reward/status).
  // The ledger knows the money; only the world knows the words.
  let notice = null;
  const ws = arg('--world-state');
  if (ws && existsSync(ws)) {
    const state = JSON.parse(readFileSync(ws, 'utf8'));
    notice = (state.marks ?? []).find((m) => m.id === mark) ?? null;
  }

  const state = worldStakeState(repo);
  const plan = planConversion({ mark, completer, state });

  console.log(`BURN-REMINT REHEARSAL — ${mark} → ${completer}`);
  if (notice) console.log(`  the notice: "${notice.ask ?? notice.body ?? ''}" · reward ${notice.reward ?? '?'} · status ${notice.status ?? 'open'}`);
  console.log(`  poster ${plan.poster} (household ${plan.posterHousehold}) · completer household ${plan.completerHousehold}`);
  console.log('');
  console.log(`  CONVERTS (burns to the completer's equity): ${plan.burned}`);
  for (const r of plan.converts) console.log(`    ${String(r.n).padStart(4)}  ${r.holder} (${r.household})`);
  console.log(`  RETURNS (never converts):`);
  for (const r of plan.returns) console.log(`    ${String(r.n).padStart(4)}  ${r.holder} — ${r.why}`);
  console.log('');
  console.log(`  net: liquid supply unchanged (${plan.burned} burned = ${plan.reminted} reminted); equity denominator +${plan.reminted} to ${plan.completer}`);
  console.log(`  countersigns required before any future write: ${plan.countersigns.map((c) => c.who).join(' · ')}`);
  console.log('');
  console.log(`  ⚠ ${PARK_RULING}`);
  if (has('--json')) console.log(JSON.stringify(plan, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
