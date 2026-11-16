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
//   --close     close one pot for one epoch: derive the returns-and-rewards
//               block (deriveEpochClose in stamp-mint.mjs — the ONE copy
//               of the law, shared with the verifier), print the human-legible
//               epoch report, and append the whole block atomically (one signed
//               write). --dry-run (or no --key) prints the report and the
//               would-be lines, appends nothing. REBUILT 2026-09-17 under the
//               09-14 amendment (every open stake returns whole; nothing burns;
//               the mass sizes the givers' mint) and the founder's 09-17 ruling
//               (the givers' reward IS the holo row, and holo stamps are liquid).
//   --unstake   take a resident's OWN open keeping stake back out of a pot,
//               before any close (founder-ruled 2026-09-17, after a site bug
//               placed the same stake twice: "just unstake it by hand please,
//               we don't need a whole engine for it"). One row, one hand, no
//               derivation. It clips to the staker's own open position on that
//               pot — never another resident's, never more than stands — and it
//               is NOT a close: it names no epoch, so the pot's epoch is still
//               open afterwards and the close that eventually runs is unaffected.
//               --dry-run prints the line and appends nothing.
//   --holo-held read any household's holo — how much of its mint came from the
//               funding seam. Since 2026-09-17 this is a SOURCE readout, not a
//               separate holding: those stamps are in the balance and in the
//               mint count like any other, and this says where they came from.
//   --keeping-held  the same for the retired keeping mint (no σ leg since
//               2026-09-14; the live ledger holds no such row). Kept so the
//               history reads back.
//   --ownership D1: "ownership is a derived READ". With holo inside
//               minted-cumulative it IS the all-sources mint; holo is the source
//               column beside it, never a second addend.
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
  potReceiptLine, potUnstakeLine, foldPotReceipts, foldPotPositions,
  foldHolo, foldKeepingMint,
  foldOwnership,
  KEEPING_RAILS, TREASURY_POT, canonicalRef,
  potCorrectionLine, foldClosedEpochs,
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

// ── CLOSES AT FILL (POS-653; Darko 2026-10-16 20:04 EDT: "new, no close date
// (closes at fill)") ──────────────────────────────────────────────────────────
//
// A pot whose file says `"closes_at_fill": true` has no close date. The receipt
// that takes it to its posted need closes it IN THE SAME ACT: this verb appends
// the receipt and then writes `status: closed` into the pot file, and the
// office's recorder (fund-exec) commits the ledger and the pot file together,
// so the town never holds the filling receipt with the pot still open. Once
// closed, the pot takes no dollars anywhere: this verb refuses a pot that is
// not open, and so do the office's /fund door and the payment watchers
// (potGate).
//
// THE LEDGER HOLDS IT TOO. A fill-closing pot that has ever closed an epoch
// takes no dollars, whatever its file says. D5's headroom is counted over the
// receipts no close has settled, so after the keeping close it reads the full
// target again. Without this line, a pot file reopened by hand (or a status
// write that failed) could take its need a second time.
//
// The keeping close still runs, by the founder's hand, as for every pot: every
// stake comes home whole and the givers' holo is minted. --close accepts a pot
// closed at fill, once, and refuses one the fill has not closed: a close of an
// open, partly funded pot would mark it closed on the ledger while its file and
// every door still said open, so the next payer would be charged and never
// witnessed (review-3896).
//
// A ONCE POT IS ONCE BY ITS CADENCE TOO. The ledger guard keys on
// `closes_at_fill` OR `epoch_cadence: "once"`, so a file edited back to open
// with closes_at_fill false still cannot take its need a second time.
const closesAtFill = (meta) => meta?.closes_at_fill === true;
const takesOnce = (meta) => closesAtFill(meta) || meta?.epoch_cadence === 'once';
const closedEver = (entries, pot) => [...foldClosedEpochs(entries)].some((k) => String(k).split('|')[0] === pot);

function closeAtFill(repo, pot, { date, ref, received, target }) {
  const p = join(repo, 'WHITE_PAGES', `pot-${pot}.json`);
  let j;
  try { j = JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { die(`the receipt was appended locally and took pot "${pot}" to its need, but WHITE_PAGES/pot-${pot}.json could not be read to close it (${e.message}); under the office's recorder nothing lands, and by hand set its status to closed before any other dollar`); }
  j.status = 'closed';
  j._closed = `CLOSED AT FILL ${date}: the receipt ${ref} took it to $${received} of $${target}, in the same act (closes_at_fill). It takes no more dollars; the keeping close (tools/epoch-close.mjs --close) returns every stake whole and mints the givers' holo.`;
  try { writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`, 'utf8'); }
  catch (e) { die(`the receipt was appended locally and took pot "${pot}" to its need, but its file could not be closed (${e.message}); under the office's recorder nothing lands, and by hand set its status to closed before any other dollar`); }
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
    showEquity('--holo-held', foldHolo, 'no holo has ever minted — the seam is unexercised');
    return;
  }

  if (has('--keeping-held')) {
    showEquity('--keeping-held', foldKeepingMint, 'no keeping mint exists — the σ leg was retired 2026-09-14 before any close ran');
    return;
  }

  // D1: "ownership is a derived READ — NOT a tense; no fifth tense node." So
  // this verb stores nothing and derives everything, per handle, biggest
  // ownership first. Since the founder's 2026-09-17 ruling holo is INSIDE
  // minted-cumulative, so ownership is the all-sources mint and the holo column
  // says how much of it came from the funding seam — adding it again would count
  // the same stamp twice.
  if (has('--ownership')) {
    const next = arg('--ownership');
    const who = next && !next.startsWith('--') ? next : null;
    const own = foldOwnership(entries);
    if (own.size === 0) { console.log('nothing minted and nothing held — the ledger is empty'); return; }
    const rows = [...own.entries()].filter(([h]) => !who || h === who).sort((a, b) => b[1].ownership - a[1].ownership);
    if (rows.length === 0) { console.log(`no ownership recorded for "${who}"`); return; }
    console.log('ownership = minted, all sources (primary + keeping + holo) — a read, not a tense (D1)');
    console.log(`${'handle'.padEnd(24)}${'primary'.padStart(8)}${'keeping'.padStart(9)}${'holo'.padStart(7)}${'minted'.padStart(8)}${'ownership'.padStart(11)}`);
    for (const [h, r] of rows) {
      console.log(`${h.padEnd(24)}${String(r.minted_primary).padStart(8)}${String(r.minted_keeping).padStart(9)}${String(r.holo).padStart(7)}${String(r.minted).padStart(8)}${String(r.ownership).padStart(11)}`);
    }
    return;
  }

  // ── --correct-hand: THE HAND, CORRECTED ────────────────────────────────────
  //
  // Founder-ruled 2026-08-27. A witnessed dollar's payer can be wrong — a
  // mistyped handle, a login the office could not resolve, the wrong household
  // — and until now nothing could say so: the ledger is append-only and had no
  // row kind that spoke about an earlier receipt.
  //
  // THIS FLAG IS THE ONLY THING IN THE TOWN THAT EMITS ONE. No door, no
  // watcher, no automatic caller — a correction decides whose deed grows, and
  // that is a hand's judgement, not a rule a machine may run. epoch-close.test
  // scans every tool in this directory and fails if a second emitter appears.
  //
  // It corrects the HAND and only the hand. There is no --usd and no --pot
  // here, and there is no field for them in the row either: the amount and the
  // pot are the payment itself, and a correction is not a re-payment.
  // ⚑ ORDERING, AND IT IS NOT OPTIONAL. Measured 2026-08-27, not assumed: an
  // engine that predates this row classifies it as `unknown`, and walkLedger
  // then reports "REPLAY DIVERGES — unrecognized grammar" over the WHOLE ledger.
  // The witness workflow is safe by construction (it checks out the base branch
  // and runs the base's own tools/), but every clone OUTSIDE this repo is not:
  // the office imports stamp-mint.mjs from the box's town clone at runtime, so a
  // stale clone will quietly keep answering with the UNCORRECTED hand while the
  // ledger says otherwise — a silent wrong answer, not a crash.
  //
  // So: land the engine everywhere that reads this ledger BEFORE the first
  // correction row is written. That is the box's town clone at minimum.
  if (has('--correct-hand')) {
    const ref = canonicalRef(arg('--ref')); const from = arg('--from'); const to = arg('--to');
    const reason = arg('--reason'); const by = arg('--by'); const date = arg('--date');
    const pem = readKey();
    if (!ref || !from || !to || !reason || !by || !date || !pem)
      die('--correct-hand needs --ref <ref> --from <old-payer> --to <new-payer> --reason <token> --by <who> --date YYYY-MM-DD --key FILE');
    if (!DATE_RE.test(date)) die(`--date must be YYYY-MM-DD (got "${date}")`);
    for (const [flag, v] of [['--from', from], ['--to', to], ['--reason', reason], ['--by', by]])
      if (/\s|·/.test(v)) die(`${flag} may not contain whitespace or the "·" field separator`);
    if (from === to) die('--from and --to are the same hand — that is not a correction');

    // The receipt must exist and must currently say what --from says. The row
    // names the old hand so a reader can CHECK it; refusing here is the same
    // guard the fold applies, said early and out loud, so the operator learns
    // it before a row is written rather than after one sits inert on the ledger.
    const { receipts, settled } = foldPotReceipts(entries);
    const target = receipts.find((r) => canonicalRef(r.ref) === ref);
    if (!target) die(`no pot-receipt with ref "${ref}" — a correction names the row it corrects`);
    if (target.from !== from)
      die(`receipt "${ref}" currently reads from: ${target.from}, not "${from}" — a correction must name the hand it replaces (it may already have been corrected)`);

    // AFTER THE CLOSE, SAY SO BEFORE WRITING. The hand will be corrected and
    // every reader will show the true payer, but the holo row the close already
    // wrote is not touched and nothing re-mints: "one dollar, one mint chance"
    // is the anti-double-mint law itself, and moving holo afterwards is the
    // founder's ruling to make, not this flag's.
    if (settled.has(target.ref))
      console.error(`# NOTE: ref "${ref}" has already been settled by a close — the hand will be corrected, the holo row will NOT be re-minted. Moving holo after a close is a founder ruling about the one-mint-chance law.`);

    const line = potCorrectionLine({ date, ref, from, to, reason, by });
    appendSigned(repo, [line], pem);
    console.log(line);
    console.log(`# ${ref}: from ${from} to ${to} (${reason}, by ${by})`);
    return;
  }

  if (has('--receipt')) {
    const pot = arg('--pot'); const rail = arg('--rail'); const usd = Number(arg('--usd'));
    const from = arg('--from'); const ref = canonicalRef(arg('--ref')); const date = arg('--date');
    const pem = readKey();
    if (!pot || !rail || !from || !ref || !date || !pem)
      die('--receipt needs --pot <id> --rail stripe|usdc|paypal|grant --usd N --from <payer> --ref <ref> --date YYYY-MM-DD --key FILE');
    if (!POT_ID_RE.test(pot)) die(`--pot must be kebab-case ([a-z0-9-], got "${pot}")`);
    if (!KEEPING_RAILS.includes(rail)) die(`--rail must be one of ${KEEPING_RAILS.join('|')} (got "${rail}")`);
    if (!Number.isInteger(usd) || usd < 1) die(`--usd must be a whole dollar amount ≥ 1 (got ${arg('--usd')})`);
    if (!DATE_RE.test(date)) die(`--date must be YYYY-MM-DD (got "${date}")`);
    if (/\s|·/.test(ref)) die('--ref may not contain whitespace or the "·" field separator');
    if (pot !== TREASURY_POT && !potFile(repo, pot)) die(`no pot file WHITE_PAGES/pot-${pot}.json — a receipt needs the pot it pays`);
    // A draft or closed pot takes no dollars, at this verb as at the office's
    // door and watchers (potGate): opening one is the founder's word.
    const metaForIntake = pot === TREASURY_POT ? null : potFile(repo, pot);
    if (metaForIntake?.status && metaForIntake.status !== 'open')
      die(`pot "${pot}" is ${metaForIntake.status}, not open — a draft or closed pot takes no dollars; opening one is the founder's word`);
    if (takesOnce(metaForIntake) && closedEver(entries, pot))
      die(`pot "${pot}" takes its need once and has already closed — it takes its need once, ever`);
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
    // THE FILL CLOSES IT (§ CLOSES AT FILL). D5 has already refused anything
    // past the need, so a fill is exactly the receipt that leaves no headroom.
    if (closesAtFill(metaForIntake) && intake.capped && intake.headroom - usd === 0) {
      closeAtFill(repo, pot, { date, ref, received: intake.received + usd, target: intake.target });
      console.log(`  pot ${pot}: filled — closed in the same act (closes_at_fill); it takes no more dollars`);
    }
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
      die('--grant needs --patron <name> --usd N --ref <ref> --date YYYY-MM-DD --key FILE [--rail stripe|usdc|paypal|grant]');
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

  if (has('--unstake')) {
    const pot = arg('--pot'); const handle = arg('--handle'); const date = arg('--date');
    const n = Number(arg('--n')); const via = arg('--via') ?? 'hand';
    if (!pot || !handle || !date || !arg('--n'))
      die('--unstake needs --pot <id> --handle <handle> --n N --date YYYY-MM-DD [--via <channel>] [--key FILE | --dry-run]');
    if (!POT_ID_RE.test(pot)) die(`--pot must be kebab-case ([a-z0-9-], got "${pot}")`);
    if (!DATE_RE.test(date)) die(`--date must be YYYY-MM-DD (got "${date}")`);
    if (!Number.isInteger(n) || n < 1) die(`--n must be a whole number of stamps ≥ 1 (got ${arg('--n')})`);
    if (/\s|·/.test(handle) || /\s|·/.test(via)) die('--handle and --via may not contain whitespace or the "·" field separator');
    if (pot === TREASURY_POT) die(`"${TREASURY_POT}" is the reserved direct-to-town pot — it never takes stakes, so it has none to give back`);
    if (!potFile(repo, pot)) die(`no pot file WHITE_PAGES/pot-${pot}.json — an unstake needs the pot it draws from`);
    // THE CLIP, and it is the whole safety of this verb. The escrow account is
    // per POT, so the ledger's generic conservation fold cannot tell one
    // staker's stamps from another's; only the per-(pot, handle) position can.
    // Refused here at the line-builder so an unlawful line is never written —
    // the verifier's identical check is the second net, not the first.
    const open = foldPotPositions(entries).get(`${pot}|${handle}`) ?? 0;
    if (open <= 0) die(`${handle} holds no open stake on pot "${pot}" — there is nothing to take back`);
    if (n > open) die(`${handle} holds ${open} on pot "${pot}", so ${n} cannot come out — an unstake draws only from your own open position`);
    const canonical = potUnstakeLine({ date, pot, handle, n, via });
    console.log(`── unstake · pot ${pot} · ${handle} · ${date} ──`);
    console.log(`open position:        ${open}`);
    console.log(`taking back:          ${n}  (${open - n} left staked on this pot)`);
    console.log(`not a close:          pot "${pot}" keeps its open epoch — this row names none`);
    console.log(`row:\n  ${canonical}`);
    const pem = readKey();
    if (has('--dry-run') || !pem) {
      console.log(has('--dry-run') ? 'dry run — nothing appended' : 'no --key — nothing appended (pass --key FILE to seal the unstake)');
      return;
    }
    requireSettledTail(repo, entries, date);
    appendSigned(repo, [canonical], pem);
    console.log(`stamp-ledger: unstaked\n  ${canonical}`);
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
    // A pot closed at fill still owes its keeping close (§ CLOSES AT FILL): its
    // stakes come home and its givers' holo mints, once.
    const filledClosed = meta?.status === 'closed' && closesAtFill(meta);
    if (meta && meta.status && meta.status !== 'open' && !filledClosed)
      die(`pot "${pot}" is ${meta.status}, not open — a close settles an open pot (opening one is the founder's word, not a default)`);
    if (closesAtFill(meta) && meta?.status !== 'closed')
      die(`pot "${pot}" closes at fill — its one keeping close runs after the fill closes it`);
    if (takesOnce(meta) && closedEver(entries, pot))
      die(`pot "${pot}" takes its need once and has already closed — one fill, one close`);
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
    console.log(report.elastic
      ? `posted need:          none — ELASTIC pot; the need is whatever arrived, floored at $${report.closeFloor} for the ceremony to run`
      : `posted need:          $${report.potTarget} for the epoch`);
    console.log(`dollars witnessed:    $${report.dollarsWitnessed} across ${report.receipts} receipt(s)` +
      (report.dollarsFunding !== report.dollarsWitnessed ? ` ($${report.dollarsWitnessed - report.dollarsFunding} treasury — funds nothing, mints nothing)` : ''));
    console.log(report.elastic
      ? `funded fraction:      100.0%  (an elastic pot's need IS the $${report.dollarsFunding} that arrived)`
      : `funded fraction:      ${(report.fundedFraction * 100).toFixed(1)}%  ($${report.dollarsFunding} ÷ $${report.potTarget}, capped at 100%)`);
    console.log(`stakes open:          ${report.stakesOpen}`);
    console.log(`returned WHOLE:       ${report.returned}  (every open stake comes home — a stake is weight lent; nothing burns)`);
    console.log(`the mass sizes:       ${report.fundingMintSized}  (floor of the funded fraction × the staked mass — the givers' mint before exclusions, floors and the cap)`);
    console.log(`  minted to givers:   ${report.fundingMint}  (holo rows — liquid, by dollar share of the roll, own household's stakes excluded, clipped to the room left under each household's holdings cap)`);
    console.log(`  un-minted:          ${report.unmintedRemainder}  (the seam keeps the change)`);
    if (report.payers.length) {
      console.log('per giver:');
      for (const p of report.payers) {
        // THE HOLDINGS CAP IN FULL (2026-09-17): the ceiling on this household's
        // holo AFTER the close, what it held going in, and the room that left —
        // which is the number the mint was actually clipped to. A giver who
        // minted nothing because the household is already at its ceiling reads
        // `room 0` and needs nothing else to understand why.
        const atCeiling = p.mint === p.roomLeft;
        console.log(`  ${p.handle.padEnd(22)}$${String(p.usd).padStart(4)} of $${report.dollarsFunding}` +
          `  mass ${String(p.massForPayer).padStart(5)}` +
          `  mint ${String(p.mint).padStart(5)}` +
          `  cap ${String(p.capHoldings).padStart(5)} = ρ × (${p.basePrimary} primary + ${p.holoHeldBefore} holo)` +
          `  held ${String(p.holoHeldBefore).padStart(5)}` +
          `  room ${String(p.roomLeft).padStart(5)}${atCeiling ? '  ← AT THE CEILING' : ''}`);
      }
    }
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

  console.error('usage: epoch-close.mjs --correct-hand --ref <ref> --from <old> --to <new> --reason <token> --by <who> --date D --key FILE | --receipt --pot <id> --rail stripe|usdc|paypal|grant --usd N --from <payer> --ref <ref> --date D --key FILE | --grant --patron <name> --usd N --ref <ref> --date D --key FILE | --close --pot <id> --epoch YYYY-MM --date D [--key FILE | --dry-run] | --unstake --pot <id> --handle <handle> --n N --date D [--via <channel>] [--key FILE | --dry-run] | --holo-held [handle] | --keeping-held [handle] | --ownership [handle]  [--repo PATH]');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
