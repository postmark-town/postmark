#!/usr/bin/env node
// epoch-close.mjs — the funding seam's founder tool (keeping pots, S1/S2).
//
// MANUAL by design: not cron, not settlement-riding. The founder runs it with
// the office key when an epoch's dollars are in. Three verbs and a reader:
//
//   --receipt   witness one real-dollar payment against a pot (mint-at-entry:
//               a re-recorded ref bounces loudly; D5: so does a payment past
//               the pot's posted target, unless the pot is marked uncapped)
//   --grant     record direct-to-town dollars (the reserved `treasury` pot):
//               appends ONE ordinary pot-receipt and nothing else — no stakes,
//               no close, and so no holo ever mints against it. The founding
//               family grant is this verb's first use. It is its own verb rather
//               than a flag on --receipt because the treasury posts no need, so
//               the intake gate that refuses dollars past a target has nothing
//               to measure and must not run.
//   --close     close one pot for one epoch: derive the burn / σ-split / holo
//               block (deriveEpochClose in stamp-mint.mjs — the ONE copy
//               of the law, shared with the verifier), print the human-legible
//               epoch report, and append the whole block atomically (one signed
//               write). --dry-run (or no --key) prints the report and the
//               would-be lines, appends nothing.
//   --holo-held read any household's soulbound holo out of the conversion rows.
//   --keeping-held  the same for the keeping mint — the stakers' own σ share.
//               Both legs of a conversion are arrow-free (R12: "NO liquid coin";
//               holo: "permanent, verb-less, remembered"), so a reader is the
//               ONLY way either is visible — no balance, no mint count, no tally
//               shows them.
//   --ownership D1: "ownership is a derived READ = minted (all sources) + holo".
//               Nothing is stored for it; this prints the fold.
//
// The law it enforces is § 8 of the 2026-08-20 capture doc, as corrected
// 2026-08-21 (matching prices against the pot's POSTED NEED, and the σ leg
// returns to the stakers themselves) and then ALIGNED to that day's later
// rulings — R10 (ρ), R12 (the σ leg IS mint, and counts in the ρ base), D1
// (ownership is a read), D5 (intake refuses past target). See the grammar block
// in stamp-mint.mjs (THE FUNDING SEAM), which quotes the ruling sentences.
//
// σ and ρ are READ from ECONOMY-DIALS.json law_side.keeping, never restated
// here: R10 names that field the owner of ρ, and "every other surface reads it
// rather than restating it" — a number copied into a comment is a second dial.
//
// Locking: appenders must hold the town lock (the ferry's flock) — this tool
// does not lock for you. Node v18+. Built-ins only.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseStampLedger, parseLaws, parseDeliveries, householdKeys, currentHouseholds,
  deriveMints, deriveFriendshipMints, combineDerived, deriveTransfers, walkLedger,
  classifyEntry, appendSigned,
  keepingDial, potFile, deriveEpochClose, keepingLine, intakeCheck,
  potReceiptLine, foldPotReceipts, foldHolo, foldKeepingMint,
  foldOwnership,
  KEEPING_RAILS, TREASURY_POT, canonicalRef,
} from './stamp-mint.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = resolve(SCRIPT_DIR, '..');

const arg = (name) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : null; };
const has = (name) => process.argv.includes(name);
const die = (msg) => { console.error(`FATAL: ${msg}`); process.exit(1); };

const POT_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const EPOCH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function loadLedger(repo) {
  const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  const entries = existsSync(ledgerPath) ? parseStampLedger(readFileSync(ledgerPath, 'utf8')) : [];
  return { ledgerPath, entries };
}

// The gift/issuance ceremony: assertion lines land on a SETTLED tail (owed
// mints or settlements would slot behind them in a later --append, breaking
// the causally-prior assumption), forward-dated against the ledger.
function requireSettledTail(repo, entries, date) {
  if (entries.length === 0) die('ledger not yet founded — nothing to append onto');
  const { laws, revisions } = parseLaws(entries);
  const deliveries = parseDeliveries(repo);
  const households = householdKeys(repo);
  const corr = deriveMints(deliveries, households, { laws, revisions });
  const friend = deriveFriendshipMints(deliveries, households, { laws, revisions });
  const mints = combineDerived(deliveries, corr, friend);
  const { problems, owed } = walkLedger(entries.map((e) => e.canonical).slice(1), mints, 1);
  if (problems.length) die(`recorded ledger diverges from derivation — run stamp-verify.mjs; nothing appended\n${problems[0]}`);
  const settledIds = new Set();
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'transfer' || c.kind === 'void') settledIds.add(c.id);
  }
  const owedSettlements = deriveTransfers(deliveries, households, { laws, revisions }, entries)
    .filter((t) => !settledIds.has(t.id));
  if (owed.length || owedSettlements.length)
    die(`ledger is behind the mail (${owed.length} mint(s), ${owedSettlements.length} settlement(s) owed) — run stamp-mint.mjs --append first`);
  const maxDate = entries.reduce((mx, e) => {
    const d = /^- (\d{4}-\d{2}-\d{2}) /.exec(e.canonical)?.[1];
    return d && d > mx ? d : mx;
  }, '0000-00-00');
  if (date < maxDate) die(`date ${date} precedes the ledger tail (${maxDate}) — the ledger is append-only, forward-dated`);
}

function readKey() {
  const keyPath = arg('--key');
  if (!keyPath || !existsSync(keyPath)) return null;
  return readFileSync(keyPath, 'utf8');
}

// received_usd on the pot file is DISPLAY — the ledger's pot-receipt rows are
// authoritative; this keeps the board honest without making the file a truth.
function refreshReceived(repo, pot, entries) {
  const p = join(repo, 'WHITE_PAGES', `pot-${pot}.json`);
  if (!existsSync(p)) return;
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    const { receipts } = foldPotReceipts(entries);
    j.received_usd = receipts.filter((r) => r.pot === pot).reduce((a, r) => a + r.usd, 0);
    writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`, 'utf8');
  } catch { /* display refresh never blocks the ledger truth */ }
}

function main() {
  const repo = resolve(arg('--repo') ?? DEFAULT_REPO);
  const { entries } = loadLedger(repo);

  // Both equity legs read the same way — aggregate an arrow-free per-handle fold
  // by household, biggest first, optionally filtered to one handle or household.
  const showEquity = (flag, fold, emptyNote) => {
    const next = arg(flag);
    const who = next && !next.startsWith('--') ? next : null; // bare flag = everyone
    const held = fold(entries);
    if (held.size === 0) { console.log(emptyNote); return; }
    const households = currentHouseholds(repo);
    const byHH = new Map();
    for (const [handle, n] of held) {
      const key = households.get(handle)?.key ?? `solo:${handle}`;
      if (!byHH.has(key)) byHH.set(key, { n: 0, handles: [] });
      const rec = byHH.get(key);
      rec.n += n; rec.handles.push(`${handle}:${n}`);
    }
    for (const [key, rec] of [...byHH.entries()].sort((a, b) => b[1].n - a[1].n)) {
      if (who && !rec.handles.some((h) => h.startsWith(`${who}:`)) && key !== who) continue;
      console.log(`${String(rec.n).padStart(5)}  ${key}  (${rec.handles.join(', ')})`);
    }
  };

  if (has('--holo-held')) {
    showEquity('--holo-held', foldHolo, 'no holo has ever converted — the seam is unexercised');
    return;
  }

  if (has('--keeping-held')) {
    showEquity('--keeping-held', foldKeepingMint, 'no keeping mint has ever converted — the seam is unexercised');
    return;
  }

  // D1: "ownership is a derived READ = minted (all sources) + holo — NOT a
  // tense; no fifth tense node." So this verb stores nothing and derives
  // everything, per handle, biggest ownership first.
  if (has('--ownership')) {
    const next = arg('--ownership');
    const who = next && !next.startsWith('--') ? next : null;
    const own = foldOwnership(entries);
    if (own.size === 0) { console.log('nothing minted and nothing held — the ledger is empty'); return; }
    const rows = [...own.entries()].filter(([h]) => !who || h === who).sort((a, b) => b[1].ownership - a[1].ownership);
    if (rows.length === 0) { console.log(`no ownership recorded for "${who}"`); return; }
    console.log('ownership = minted (all sources) + holo — a read, not a tense (D1)');
    console.log(`${'handle'.padEnd(24)}${'earned'.padStart(8)}${'keeping'.padStart(9)}${'minted'.padStart(8)}${'holo'.padStart(7)}${'ownership'.padStart(11)}`);
    for (const [h, r] of rows) {
      console.log(`${h.padEnd(24)}${String(r.minted_primary).padStart(8)}${String(r.minted_keeping).padStart(9)}${String(r.minted).padStart(8)}${String(r.holo).padStart(7)}${String(r.ownership).padStart(11)}`);
    }
    return;
  }

  if (has('--receipt')) {
    const pot = arg('--pot'); const rail = arg('--rail'); const usd = Number(arg('--usd'));
    const from = arg('--from'); const ref = canonicalRef(arg('--ref')); const date = arg('--date');
    const pem = readKey();
    if (!pot || !rail || !from || !ref || !date || !pem)
      die('--receipt needs --pot <id> --rail stripe|usdc|grant --usd N --from <payer> --ref <ref> --date YYYY-MM-DD --key FILE');
    if (!POT_ID_RE.test(pot)) die(`--pot must be kebab-case ([a-z0-9-], got "${pot}")`);
    if (!KEEPING_RAILS.includes(rail)) die(`--rail must be one of ${KEEPING_RAILS.join('|')} (got "${rail}")`);
    if (!Number.isInteger(usd) || usd < 1) die(`--usd must be a whole dollar amount ≥ 1 (got ${arg('--usd')})`);
    if (!DATE_RE.test(date)) die(`--date must be YYYY-MM-DD (got "${date}")`);
    if (/\s|·/.test(ref)) die('--ref may not contain whitespace or the "·" field separator');
    if (pot !== TREASURY_POT && !potFile(repo, pot)) die(`no pot file WHITE_PAGES/pot-${pot}.json — a receipt needs the pot it pays`);
    const { receipts } = foldPotReceipts(entries);
    const prior = receipts.find((r) => canonicalRef(r.ref) === ref);
    if (prior) die(`receipt ref "${ref}" already recorded (${prior.date}, $${prior.usd} to pot ${prior.pot}) — one dollar, one mint chance; a re-recorded receipt bounces`);
    // D5: "intake refuses dollars past a pot's posted target, mechanically
    // (recording tool / door bounce), except pots explicitly marked uncapped."
    // The bounce names the remaining headroom, so the payer can pay what the
    // town still needs instead of guessing.
    const dialForIntake = keepingDial(repo);
    const intake = intakeCheck({
      entries, pot, potMeta: potFile(repo, pot), usd, from,
      treasury: dialForIntake?.treasury ?? null,
    });
    if (!intake.ok) die(intake.error);
    requireSettledTail(repo, entries, date);
    const canonical = potReceiptLine({ date, pot, rail, usd, from, ref });
    appendSigned(repo, [canonical], pem);
    refreshReceived(repo, pot, loadLedger(repo).entries);
    console.log(`stamp-ledger: witnessed\n  ${canonical}`);
    if (intake.capped) console.log(`  pot ${pot}: $${intake.received + usd} of $${intake.target} posted — $${intake.headroom - usd} of headroom left this epoch`);
    return;
  }

  if (has('--grant')) {
    // Direct-to-town dollars: ONE ordinary pot-receipt against the reserved
    // treasury pot, and nothing else. No stakes, no close, and therefore no
    // holo — the treasury never closes, so its receipts are never settled and
    // never mint. The founding family grant is this verb's first use.
    //
    // No --epoch: a pot-receipt carries no epoch field, and the second line
    // that used to carry one is gone. Asking for a value nothing records would
    // be a question with no answer.
    const patron = arg('--patron'); const usd = Number(arg('--usd'));
    const rail = arg('--rail') ?? 'grant'; const ref = canonicalRef(arg('--ref'));
    const date = arg('--date');
    const pem = readKey();
    if (!patron || !ref || !date || !pem)
      die('--grant needs --patron <name> --usd N --ref <ref> --date YYYY-MM-DD --key FILE [--rail stripe|usdc|grant]');
    if (!KEEPING_RAILS.includes(rail)) die(`--rail must be one of ${KEEPING_RAILS.join('|')} (got "${rail}")`);
    if (!Number.isInteger(usd) || usd < 1) die(`--usd must be a whole dollar amount ≥ 1 (got ${arg('--usd')})`);
    if (!DATE_RE.test(date)) die(`--date must be YYYY-MM-DD (got "${date}")`);
    if (/\s|·/.test(ref)) die('--ref may not contain whitespace or the "·" field separator');
    const { receipts } = foldPotReceipts(entries);
    if (receipts.some((r) => canonicalRef(r.ref) === ref)) die(`receipt ref "${ref}" already recorded — one dollar, one mint chance; a re-recorded receipt bounces`);
    requireSettledTail(repo, entries, date);
    const canonical = potReceiptLine({ date, pot: TREASURY_POT, rail, usd, from: patron, ref });
    appendSigned(repo, [canonical], pem);
    console.log(`stamp-ledger: witnessed\n  ${canonical}`);
    return;
  }

  if (has('--close')) {
    const pot = arg('--pot'); const epoch = arg('--epoch'); const date = arg('--date');
    if (!pot || !epoch || !date) die('--close needs --pot <id> --epoch YYYY-MM --date YYYY-MM-DD [--key FILE | --dry-run]');
    // EPOCH_RE used to be spent on the retired --deed verb, and --close went
    // unchecked. A close's epoch is stamped into every row it seals, so a
    // malformed one is permanent the moment it is signed.
    if (!EPOCH_RE.test(epoch)) die(`--epoch must be YYYY-MM (got "${epoch}")`);
    if (!DATE_RE.test(date)) die(`--date must be YYYY-MM-DD (got "${date}")`);
    const dial = keepingDial(repo);
    if (!dial) die('no readable law_side.keeping in ECONOMY-DIALS.json — the split must be DECLARED before a close (σ, ρ ≤ the constitutional ceiling)');
    const meta = potFile(repo, pot);
    if (meta && meta.status && meta.status !== 'open')
      die(`pot "${pot}" is ${meta.status}, not open — a close settles an open pot (opening one is the founder's word, not a default)`);
    const derived = deriveEpochClose({
      entries, households: householdKeys(repo), pot, potMeta: meta, epoch, date, dial,
    });
    if (!derived.ok) die(derived.error);
    const { rows, report } = derived;

    // the human-legible epoch report
    const lines = rows.map(keepingLine);
    console.log(`── epoch close · pot ${report.pot} · epoch ${report.epoch} · ${report.date} ──`);
    // "keeper" belongs to the keeping-STAKERS (§ 8), so it may not label this
    // line: the beneficiary is where the DOLLARS route, and a close mints them
    // nothing at all.
    console.log(`beneficiary:          ${report.beneficiary}  (where the dollars route — a close mints them no stamps)`);
    console.log(`posted need:          $${report.potTarget} for the epoch`);
    console.log(`dollars witnessed:    $${report.dollarsWitnessed} across ${report.receipts} receipt(s)` +
      (report.dollarsFunding !== report.dollarsWitnessed ? ` ($${report.dollarsWitnessed - report.dollarsFunding} treasury — funds nothing, mints nothing)` : ''));
    console.log(`funded fraction:      ${(report.fundedFraction * 100).toFixed(1)}%  ($${report.dollarsFunding} ÷ $${report.potTarget}, capped at 100%)`);
    console.log(`stakes open:          ${report.stakesOpen}`);
    console.log(`burned (funded):      ${report.burned}  (floor of the funded fraction × each stake; the rest returns)`);
    console.log(`  minted · keeping:   ${report.keepingMint}  (floor of σ · each staker's OWN burn, back to that staker — mint, source-tagged, no liquid coin)`);
    console.log(`  holo to payers:     ${report.holoMinted}  (floor of (1−σ)·B by dollar share, own burn excluded, ρ-capped)`);
    console.log(`  un-minted:          ${report.unmintedRemainder}  (the seam keeps the change)`);
    console.log(`rows (${lines.length}):`);
    for (const l of lines) console.log(`  ${l}`);

    const pem = readKey();
    if (has('--dry-run') || !pem) {
      console.log(has('--dry-run') ? 'dry run — nothing appended' : 'no --key — nothing appended (pass --key FILE to seal the close)');
      return;
    }
    requireSettledTail(repo, entries, date);
    appendSigned(repo, lines, pem); // one signed write — the block lands whole or not at all
    console.log(`stamp-ledger: closed — appended ${lines.length} line(s)`);
    return;
  }

  console.error('usage: epoch-close.mjs --receipt --pot <id> --rail stripe|usdc|grant --usd N --from <payer> --ref <ref> --date D --key FILE | --grant --patron <name> --usd N --ref <ref> --date D --key FILE | --close --pot <id> --epoch YYYY-MM --date D [--key FILE | --dry-run] | --holo-held [handle] | --keeping-held [handle] | --ownership [handle]  [--repo PATH]');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
