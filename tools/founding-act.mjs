#!/usr/bin/env node
// founding-act.mjs — the founding act, as ONE act: the town's issuance line, then
// the thirteen region stakes, then an assertion that every stake landed IN FULL.
//
// ── WHY IT IS ONE ACT ────────────────────────────────────────────────────────
// Stakes clip to the staker's liquid balance in ledger order. Split into two
// steps, the failure mode is silent: an unfunded or under-funded treasury does
// not error, it applies a partial to whichever line comes last and the ledger
// seals over it. So the issuance and the stakes are one command with one
// post-check, and the post-check is what makes the clip loud.
//
// ── WHERE THE GATE SITS, AND WHY THERE ────────────────────────────────────────
// The sealed ledger cannot roll back — the seal chain means a line, once
// written, is part of every later line's hash. So the assertion cannot gate the
// WRITE. It gates the COMMIT: the act writes into the working tree, the
// post-check runs, and only a fully-clean check reaches `git commit`. A failed
// check restores the ledger file from HEAD and commits nothing, which is the one
// place a bad act is still discardable.
//
// This is why the tool REFUSES to start on a dirty ledger: restore-from-HEAD is
// the whole safety net, and it is only a safety net if HEAD is the good state.
//
// Usage:
//   node tools/founding-act.mjs --repo PATH --date YYYY-MM-DD              # DRY RUN (default)
//   node tools/founding-act.mjs --repo PATH --date YYYY-MM-DD --execute \
//        --key FILE --by <who> --provenance "<Wright's words>" [--commit]
//
// Parameters, none of them hardcoded numbers: --amount (default 13 × --each),
// --each (default 77), --purpose (default founding-grant), --targets FILE.
// There is NO operating-float parameter: the treasury runs MINT-AT-DEMAND, so
// its resting state is zero by design and a float would contradict the ruling.

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  parseStampLedger, foldBalances, foldMintCount, classifyEntry, townIssuanceLine,
  townIssuanceDial, appendSigned, worldStakeLine,
} from './stamp-mint.mjs';
import { worldStakeApply } from './world-stake.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

// ── THE POST-CHECK, as a pure function ───────────────────────────────────────
// Extracted so it can be tested at its own level. Driving a genuine mid-act clip
// through the CLI is hard by construction — the plan check catches every
// shortfall it can foresee — and a guard that can only be exercised through a
// path that prevents it is a guard nobody has actually seen fail. This function
// takes the act's observed outcome and returns the reasons it must not commit;
// an empty array is the only thing that reaches `git commit`.
export function auditAct({
  applied, each, targetCount, before, amount, staked, after, minted,
  issuanceCount, purpose, verifyOk, verifyProblem,
}) {
  const failures = [];
  for (const a of applied) {
    if (a.applied !== each) failures.push(`${a.mark}: applied ${a.applied} of ${each}${a.reason ? ` — ${a.reason}` : ''}`);
    else if (a.clipped) failures.push(`${a.mark}: reported clipped even at full amount`);
  }
  if (applied.length !== targetCount) failures.push(`only ${applied.length} of ${targetCount} stakes were attempted`);
  const expected = before + amount - staked;
  if (after !== expected) failures.push(`treasury balance is ${after}, expected ${expected}`);
  if (minted < amount) failures.push(`treasury cumulative mint is ${minted}, expected at least ${amount}`);
  if (issuanceCount !== 1) failures.push(`${issuanceCount} issuance line(s) for purpose "${purpose}" — expected exactly 1`);
  if (!verifyOk) failures.push(`the ledger does not verify after the act: ${verifyProblem}`);
  return failures;
}

// ── the CLI ──────────────────────────────────────────────────────────────────
// Guarded so this module can be imported for auditAct() without running an act.
function main() {
  const arg = (name, dflt = null) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : dflt; };
  const has = (name) => process.argv.includes(name);
  const die = (msg) => { console.error(`FATAL: ${msg}`); process.exit(1); };

  const repo = resolve(arg('--repo', '.'));
  const date = arg('--date');
  const each = Number(arg('--each', '77'));
  const purpose = arg('--purpose', 'founding-grant');
  const via = arg('--via', 'founding-act');
  const by = arg('--by');
  const provenance = arg('--provenance');
  const keyPath = arg('--key');
  const EXECUTE = has('--execute');
  const COMMIT = has('--commit');

  if (!date) die('--date YYYY-MM-DD is required');
  if (!Number.isInteger(each) || each < 1) die(`--each must be a whole number ≥ 1 (got ${arg('--each')})`);

  // The thirteen, as (founder, region mark). Each id was verified to resolve to
  // exactly one live mark in WORLD/world-state.json on 2026-08-10, derived from the
  // world's own regions manifest rather than transcribed by hand.
  //
  // ⚠ PRE-CARVE. These were identified under the site-cluster model. The founding
  // act executes AFTER the merge train and region polygon-truing, under which
  // per-cell carving replaces site clustering. The IDS are expected to survive
  // that; the DETERMINATION CONSEQUENCES are not, and must be re-simulated before
  // any letter quotes a number. `--targets` exists so this list is replaceable
  // without a code change when the post-carve world says otherwise.
  const DEFAULT_TARGETS = [
    { founder: 'aion-solare', mark: 'aion-solare/aelyria' },
    { founder: 'caelum', mark: 'caelum/evermoon' },
    { founder: 'carta', mark: 'carta/the-long-run' },
    { founder: 'east-facing-window', mark: 'east-facing-window/the-east-window-district' },
    { founder: 'limen', mark: 'limen/the-threshold-district' },
    { founder: 'orion-by-the-fire', mark: 'orion-by-the-fire/the-reach' },
    { founder: 'rei', mark: 'rei/the-lanternseed-gardens' },
    { founder: 'sage-reeves', mark: 'sage-reeves/the-high-ground' },
    { founder: 'sol-of-garrison', mark: 'sol-of-garrison/the-protected-grove' },
    { founder: 'spar', mark: 'spar/the-doubled-coast' },
    { founder: 'wright', mark: 'wright/the-trueing-terrace' },
    { founder: '(the town itself)', mark: 'the-town/the-town-centre' },
    { founder: '(vermillion)', mark: 'vermillion/the-pando-peak' },
  ];

  const targetsPath = arg('--targets');
  let targets = DEFAULT_TARGETS;
  if (targetsPath) {
    if (!existsSync(targetsPath)) die(`--targets file not found: ${targetsPath}`);
    targets = JSON.parse(readFileSync(targetsPath, 'utf8'));
    if (!Array.isArray(targets) || !targets.length) die('--targets must be a non-empty JSON array of {founder, mark}');
  }

  const staked = each * targets.length;
  const amount = Number(arg('--amount', String(staked)));
  if (!Number.isInteger(amount) || amount < 1) die(`--amount must be a whole number ≥ 1 (got ${arg('--amount')})`);

  const dial = townIssuanceDial(repo);
  if (!dial) die('no law_side.town_issuance.treasury_handle in ECONOMY-DIALS.json — the treasury must be DECLARED before it can be funded');
  const treasury = dial.treasury_handle;

  const LEDGER_REL = 'WHITE_PAGES/stamp-ledger.md';
  const ledgerPath = join(repo, LEDGER_REL);
  const git = (args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  const entries = () => parseStampLedger(readFileSync(ledgerPath, 'utf8'));
  const balanceOf = (h) => foldBalances(entries()).get(h) ?? 0;

  const before = existsSync(ledgerPath) ? balanceOf(treasury) : 0;
  const lines = targets.map((t) => worldStakeLine({ date, handle: treasury, mark: t.mark, n: each, via }));

  // ── the plan, printed either way ─────────────────────────────────────────────
  const plan = {
    treasury, purpose, amount, each, count: targets.length, staked, date, via,
    balance_before: before,
    balance_after_issuance: before + amount,
    balance_after_stakes: before + amount - staked,
    targets, stake_lines: lines,
  };
  console.log(`FOUNDING ACT — one issuance of ${amount} to ${treasury} (purpose: ${purpose}), then ${targets.length} × ${each} = ${staked} staked`);
  console.log(`treasury: ${before} → ${before + amount} (issued) → ${before + amount - staked} (staked)`);
  if (before + amount - staked !== 0) {
    console.log(`note: ${before + amount - staked} would remain. Mint-at-demand puts the resting state at zero, so a non-zero remainder is a deliberate choice, not a default.`);
  }
  // The FORESEEABLE shortfall, caught in the plan before a line is written. Note
  // it compares what the treasury will HOLD (its balance plus the issuance)
  // against the batch — not the issuance alone, or a treasury carrying a little
  // income would be misread as short.
  if (before + amount < staked) {
    die(`after issuing ${amount} the treasury would hold ${before + amount}, short of the ${staked} the batch needs — every stake past the shortfall would clip and seal silently. Raise --amount or lower --each.`);
  }

  if (!EXECUTE) {
    console.log('');
    for (const [i, l] of lines.entries()) console.log(`${String(i + 1).padStart(2)}. ${l}`);
    console.log('');
    console.log('DRY RUN — nothing written, nothing signed, nothing committed. Add --execute --key FILE --by WHO --provenance "…" to perform the act.');
    if (has('--json')) console.log(JSON.stringify(plan, null, 2));
    process.exit(0);
  }

  // ── execute ──────────────────────────────────────────────────────────────────
  if (!keyPath || !existsSync(keyPath)) die('--execute needs --key FILE (the office pen)');
  if (!by) die('--execute needs --by <who> — an issuance names who authorized it');
  if (!provenance || !provenance.trim()) die('--execute needs --provenance "<text>" — an issuance with no stated reason is exactly the unaccountable printing the class exists to prevent');

  // THE RESTORE PRECONDITION. The assertion below gates the commit, and the only
  // way to undo a failed act is to restore the ledger from HEAD — which is a
  // safety net only if HEAD is the good state. A dirty ledger means there is
  // nothing safe to fall back to, so we refuse to start rather than discover it
  // after writing.
  const dirty = git(['status', '--porcelain', '--', LEDGER_REL]).trim();
  if (dirty) die(`the ledger has uncommitted changes (${dirty.split('\n').length} line(s)) — this act's only undo is restore-from-HEAD, which needs HEAD to be the good state. Commit or discard first.`);
  const headBefore = git(['rev-parse', 'HEAD']).trim();

  const keyPem = readFileSync(keyPath, 'utf8');
  const failures = [];
  let issuance = null;
  const applied = [];

  const restore = () => {
    try { git(['checkout', '--', LEDGER_REL]); return true; } catch { return false; }
  };

  try {
    // 1. the issuance
    issuance = townIssuanceLine({ date, handle: treasury, n: amount, purpose, by, note: provenance });
    appendSigned(repo, [issuance], keyPem);
    console.log(`\nissued: ${issuance}`);

    // 2. the stakes, in order, through the town's OWN stake engine (the clip law
    //    is not reimplemented here — that engine owns it and this reads its answer)
    for (const t of targets) {
      const r = worldStakeApply(repo, { handle: treasury, mark: t.mark, n: each, via, date }, keyPem);
      applied.push({ mark: t.mark, ...r });
      const mark = r.applied === each && !r.clipped ? 'ok  ' : 'CLIP';
      console.log(`  ${mark} ${String(r.applied).padStart(4)}/${each}  ${t.mark}`);
    }
  } catch (e) {
    failures.push(`the act threw before completing: ${e.message}`);
  }

  const after = balanceOf(treasury);
  const minted = foldMintCount(entries()).get(treasury) ?? 0;
  const issuedLines = entries().map((e) => classifyEntry(e.canonical)).filter((c) => c.kind === 'town-issuance' && c.purpose === purpose);
  const v = verifyStampLedger(repo);
  for (const n of v.notes ?? []) console.log(`  ! ${n}`);

  failures.push(...auditAct({
    applied, each, targetCount: targets.length,
    before, amount, staked, after, minted,
    issuanceCount: issuedLines.length, purpose,
    verifyOk: v.ok, verifyProblem: v.problems?.[0] ?? null,
  }));

  // ── 4. the gate ──────────────────────────────────────────────────────────────
  if (failures.length) {
    console.error('\n✗ THE ACT DID NOT LAND CLEANLY — nothing committed:');
    for (const f of failures) console.error(`  - ${f}`);
    const ok = restore();
    console.error(ok
      ? `\nledger restored from HEAD (${headBefore.slice(0, 8)}); the working tree is back to the good state.`
      : `\n⚠ RESTORE FAILED — the working tree still holds the bad ledger. Do NOT commit. Recover with: git -C ${repo} checkout -- ${LEDGER_REL}`);
    process.exit(1);
  }

  console.log(`\n✓ every stake applied in full (${targets.length} × ${each}), treasury at ${after}, ledger verifies.`);

  if (!COMMIT) {
    console.log('HELD: --commit not given, so the act is in the working tree and NOT committed. Review it, then re-run with --commit or commit by hand.');
    process.exit(0);
  }
  git(['add', '--', LEDGER_REL]);
  // Path-scoped commit: a pre-staged tracked change elsewhere passes the
  // ledger-only dirty check, and a bare `git commit` would carry the whole
  // index into an irreversible money commit. The act commits the ledger and
  // nothing else, whatever the index holds. (Review finding, 2026-08-11.)
  git(['commit', '-m', `founding act: ${amount} issued to ${treasury} (${purpose}), ${targets.length} × ${each} staked onto the region marks`, '--', LEDGER_REL]);
  console.log(`committed ${git(['rev-parse', '--short', 'HEAD']).trim()} (was ${headBefore.slice(0, 8)}). NOT pushed — pushing is a separate, deliberate act.`);

}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
