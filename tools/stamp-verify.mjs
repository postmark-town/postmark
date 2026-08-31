#!/usr/bin/env node
// stamp-verify.mjs — the honest verifier for the stamp-ledger.
// Gold plans: postmark-mint (v1) + postmark-ballot (v2). Side-effect-free
// import (the Seal's discipline).
//
// Five checks, in order, first divergence reported to the line:
//   1. CHAIN     — recompute the running seal (seal_0 = sha256("postmark-stamps-v1"),
//                  seal_n = sha256(seal_{n-1} + canonical)) — structural integrity.
//   2. SIGNATURE — every line's ed25519 signature over its running seal verifies
//                  against tools/stamp-pubkey.pem — only the office pen could
//                  have written it (signature-linked: each sig binds the prefix).
//   3. REPLAY    — re-derive the mint lines from the witnessed mail-ledger under
//                  the recorded law spans (rules + registry lines are read from
//                  the ledger itself); recorded mint lines must be exactly the
//                  derivation, in order, with assertion lines interleaved. You
//                  can't forge a stamp without forging the mail.
//   4. CONSERVE  — the double-entry fold sums to zero across all accounts
//                  (MINT, BURN and stake:* included) — structural by grammar.
//   5. LAWFUL    — the assertion lines obey the law: no account except MINT ever
//                  goes negative (no overdrawn stake), stakes name a real ballot
//                  topic + candidate and respect the per-household per-candidate
//                  cap, meeps neither mint nor stake after the v2 marker, and
//                  vote-mints are once-per-handle-per-topic with a stake behind
//                  them. You can't overdraw a stake without breaking the fold.
//
// Usage: node tools/stamp-verify.mjs [--repo PATH]   exits 0 green, 1 on any failure.

import { createPublicKey, verify as edVerify } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseDeliveries, householdKeys, deriveMints, deriveFriendshipMints, combineDerived,
  settlementDecision, meepChecker, rulesLine,
  parseStampLedger, sealChain, foldBalances, parseLaws, classifyEntry, walkLedger,
  townIssuanceDial,
  keepingDial, potFile, deriveEpochClose, keepingLine, TREASURY_POT,
} from './stamp-mint.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = resolve(SCRIPT_DIR, '..');

function ballotFile(repo, topic) {
  const p = join(repo, 'WHITE_PAGES', `ballot-${topic}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

export function verifyStampLedger(repo, { pubkeyPem } = {}) {
  const problems = [];
  // Checks the verifier could not run. A skipped check must be VISIBLE — silence
  // would read as a pass.
  const notes = [];
  const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  if (!existsSync(ledgerPath)) return { ok: false, problems: ['no stamp-ledger.md — nothing to verify'] };

  const entries = parseStampLedger(readFileSync(ledgerPath, 'utf8'));
  if (entries.length === 0) return { ok: false, problems: ['stamp-ledger has no entry lines'] };
  const seals = sealChain(entries.map((e) => e.canonical));

  // 2. signatures (chain is implicit in the seal recomputation the sigs bind)
  const pem = pubkeyPem ?? (existsSync(join(repo, 'tools', 'stamp-pubkey.pem'))
    ? readFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), 'utf8') : null);
  if (!pem) problems.push('no tools/stamp-pubkey.pem — signatures unverifiable');
  else {
    const key = createPublicKey(pem);
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].sig) { problems.push(`line ${i + 1}: UNSIGNED — "${entries[i].canonical.slice(0, 60)}..."`); break; }
      const ok = edVerify(null, Buffer.from(seals[i], 'utf8'), key, Buffer.from(entries[i].sig, 'base64url'));
      if (!ok) { problems.push(`line ${i + 1}: SIGNATURE FAILS — first divergence at "${entries[i].canonical.slice(0, 60)}..."`); break; }
    }
  }

  // 3. replay from the witnessed mail, under the recorded law spans
  const recorded = entries.map((e) => e.canonical);
  const { laws, revisions } = parseLaws(entries);
  const deliveries = parseDeliveries(repo);
  const genesisDate = deliveries[0]?.date ?? '2026-06-12';
  if (recorded[0] !== rulesLine(genesisDate))
    problems.push(`line 1: ledger must open with "${rulesLine(genesisDate)}" — found "${recorded[0]}"`);
  const households = householdKeys(repo);
  // the full derived subsequence: correspondence mints + the stamps-v3 friendship
  // milestone mints, in ledger order. Friendship mints ride the replay exactly
  // like correspondence mints, so a forged one turns REPLAY red.
  const corrMints = deriveMints(deliveries, households, { laws, revisions });
  const friendMints = deriveFriendshipMints(deliveries, households, { laws, revisions });
  const mints = combineDerived(deliveries, corrMints, friendMints);
  const walk = walkLedger(recorded.slice(1), mints, 1);
  for (const p of walk.problems) problems.push(p);
  if (walk.problems.length === 0 && walk.owed.length > 0)
    problems.push(`ledger is ${walk.owed.length} line(s) behind the derivation — mints owed, run the mint pass (not a tamper)`);

  // 3b. settlements — the pays deliveries the ledger must account for, one line
  // each. Their transfer-vs-void DECISION is checked in ledger order in the
  // lawful fold below (order-aware by construction). Here we only build the
  // lookup and note which deliveries carry a payment.
  const paysDeliveries = new Map(); // id -> { from, to, date, pays }
  for (const d of deliveries) if (d.pays != null) paysDeliveries.set(d.id, d);

  // 4. conservation
  const bal = foldBalances(entries);
  const sum = [...bal.values()].reduce((a, b) => a + b, 0);
  if (sum !== 0) problems.push(`conservation broken: all accounts sum to ${sum}, not 0`);

  // 5. lawful — running fold + assertion validity
  {
    const running = new Map();
    const add = (acct, n) => running.set(acct, (running.get(acct) ?? 0) + n);
    const hh = (handle, date) => {
      let key = null;
      for (const r of revisions) if (r.handle === handle && r.date <= date) key = r.key;
      if (key) return key;
      const base = householdKeys(repo).get(handle);
      return base ? base.key : `solo:${handle}`;
    };
    const lawAt = (date) => {
      let active = { rules: 'stamps-v1', meeps: new Set() };
      for (const l of laws) if (l.date <= date) active = l;
      return active;
    };
    const voteMinted = new Set();       // `${handle}|${topic}`
    const stakedByTopic = new Map();    // `${topic}|${candidate}|${householdKey}` -> total staked
    const markPosition = new Map();     // `${mark}|${handle}` -> currently open escrow
    const hasStake = new Set();         // `${handle}|${topic}`
    const ballots = new Map();          // topic -> file (cached)
    const oneShotSeen = new Set();      // one-shot issuance purposes already spent
    const firstIdeaHouses = new Set();  // household keys already paid their first-idea mint
    const issuanceDial = townIssuanceDial(repo);
    let warnedNoIssuanceDial = false;
    const isMeep = meepChecker(laws);
    const seenSettlements = new Set();   // pays-delivery ids the ledger has settled

    // ── the funding seam's state (keeping pots) ──────────────────────────────
    const potPosition = new Map();       // `${pot}|${handle}` -> open keeping escrow
    const potReceipts = new Map();       // ref -> the receipt row (mint-at-entry: one ref, ever)
    const settledRefs = new Set();       // refs a close's holo row has already answered for
    const potFiles = new Map();          // pot -> file (cached)
    const closeSpans = new Map();        // `${pot}|${epoch}` -> { start, end } of the verified close block
    const kDial = keepingDial(repo);
    let warnedNoKeepingDial = false;
    const householdsBase = householdKeys(repo);
    const potOf = (pot) => {
      if (!potFiles.has(pot)) potFiles.set(pot, potFile(repo, pot));
      return potFiles.get(pot);
    };
    // The close block is replayed EXACTLY: at the first row of a close for
    // (pot, epoch), re-derive the whole block from the ledger prefix + the pot
    // file + the keeping dial, and demand the recorded rows match byte-for-byte
    // in canonical order. A wrong holo (or burn, or keeping mint) row fails
    // here the way a forged mint fails REPLAY. Returns the problem string, or null.
    const CLOSE_KINDS = new Set(['pot-return', 'keeping-burn', 'keeping-mint', 'holo']);
    const checkCloseBlock = (i, cls) => {
      const key = `${cls.pot}|${cls.epoch}`;
      const span = closeSpans.get(key);
      if (span) {
        if (i >= span.start && i <= span.end) return null; // inside its verified block
        return `line ${i + 1}: LAWFUL fails — ${cls.kind} row for ${cls.pot}/${cls.epoch} outside its close block (a close is one contiguous derivation, appended once)`;
      }
      if (kDial === null) {
        if (!warnedNoKeepingDial) {
          notes.push('keeping closes UNCHECKED — no readable law_side.keeping in ECONOMY-DIALS.json');
          warnedNoKeepingDial = true;
        }
        closeSpans.set(key, { start: 0, end: Infinity }); // structural checks still run
        return null;
      }
      const expected = deriveEpochClose({
        entries: entries.slice(0, i), households: householdsBase,
        pot: cls.pot, potMeta: potOf(cls.pot), epoch: cls.epoch, date: cls.date, dial: kDial,
      });
      if (!expected.ok) return `line ${i + 1}: LAWFUL fails — epoch close ${cls.pot}/${cls.epoch} derives no lawful block: ${expected.error}`;
      const want = expected.rows.map(keepingLine);
      for (let j = 0; j < want.length; j++) {
        const got = entries[i + j]?.canonical;
        if (got !== want[j]) {
          return `line ${i + j + 1}: KEEPING REPLAY DIVERGES — epoch close ${cls.pot}/${cls.epoch}\n  recorded: ${got ?? '(ledger ends)'}\n  derived : ${want[j]}`;
        }
      }
      closeSpans.set(key, { start: i, end: i + want.length - 1 });
      return null;
    };

    for (let i = 0; i < entries.length; i++) {
      const c = entries[i].canonical;
      const cls = classifyEntry(c);
      const lineNo = i + 1;

      if (cls.kind === 'stake') {
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — meep "${cls.handle}" cannot stake`); break;
        }
        if (!ballots.has(cls.topic)) ballots.set(cls.topic, ballotFile(repo, cls.topic));
        const b = ballots.get(cls.topic);
        if (!b) { problems.push(`line ${lineNo}: LAWFUL fails — stake names unknown ballot topic "${cls.topic}" (no WHITE_PAGES/ballot-${cls.topic}.json)`); break; }
        if (Array.isArray(b.candidates) && b.candidates.length > 0 && !b.candidates.includes(cls.candidate)) {
          problems.push(`line ${lineNo}: LAWFUL fails — "${cls.candidate}" is not a candidate of ballot "${cls.topic}"`); break;
        }
        const cap = Number(b.cap_per_household_per_candidate ?? 20);
        const hkey = `${cls.topic}|${cls.candidate}|${hh(cls.handle, cls.date)}`;
        const staked = (stakedByTopic.get(hkey) ?? 0) + cls.n;
        if (staked > cap) {
          problems.push(`line ${lineNo}: LAWFUL fails — household stake on ${cls.topic}/${cls.candidate} totals ${staked}, cap is ${cap}`); break;
        }
        stakedByTopic.set(hkey, staked);
        hasStake.add(`${cls.handle}|${cls.topic}`);
      }

      // ── world-mark stakes (write-release P3) ─────────────────────────────
      // The generic movement fold below already enforces two accounting
      // invariants, so they are deliberately NOT repeated: a stake beyond the
      // staker's balance overdraws the handle, and an unstake beyond a mark's
      // total escrow overdraws the `stake:world-mark/…` account. What the generic
      // fold CANNOT see is ownership — the escrow account is per MARK while a
      // position is per (mark, handle), so without the check below one resident
      // could unstake another's stamps and every account would still be
      // non-negative. That hole is the reason this branch exists.
      if (cls.kind === 'world-stake') {
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — meep "${cls.handle}" cannot stake`); break;
        }
        const pk = `${cls.mark}|${cls.handle}`;
        markPosition.set(pk, (markPosition.get(pk) ?? 0) + cls.n);
      }

      if (cls.kind === 'world-unstake') {
        const pk = `${cls.mark}|${cls.handle}`;
        const open = markPosition.get(pk) ?? 0;
        if (cls.n > open) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${cls.handle} unstakes ${cls.n} from world-mark ${cls.mark} but holds only ${open} there`); break;
        }
        markPosition.set(pk, open - cls.n);
      }

      // ── the funding seam (keeping pots) ──────────────────────────────────
      // Overdraw is structural (the generic movement fold below); what these
      // branches police is what the fold cannot see: ownership (whose escrow a
      // return or burn drains), mint-at-entry (one receipt ref, ever), the meep
      // law, and — via checkCloseBlock — that every close row belongs to a
      // contiguous block matching the epoch-close derivation exactly.
      if (cls.kind === 'pot-stake') {
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — meep "${cls.handle}" cannot stake`); break;
        }
        if (cls.pot === TREASURY_POT) {
          problems.push(`line ${lineNo}: LAWFUL fails — "${TREASURY_POT}" is the reserved direct-to-town pot; it takes receipts and nothing else, never stakes`); break;
        }
        if (!potOf(cls.pot)) {
          problems.push(`line ${lineNo}: LAWFUL fails — stake names unknown pot "${cls.pot}" (no WHITE_PAGES/pot-${cls.pot}.json)`); break;
        }
        const pk = `${cls.pot}|${cls.handle}`;
        potPosition.set(pk, (potPosition.get(pk) ?? 0) + cls.n);
      }

      if (cls.kind === 'pot-receipt') {
        if (cls.pot !== TREASURY_POT && !potOf(cls.pot)) {
          problems.push(`line ${lineNo}: LAWFUL fails — receipt names unknown pot "${cls.pot}" (no WHITE_PAGES/pot-${cls.pot}.json)`); break;
        }
        if (potReceipts.has(cls.ref)) {
          problems.push(`line ${lineNo}: LAWFUL fails — receipt ref "${cls.ref}" already recorded (one dollar, one mint chance — a re-recorded receipt bounces)`); break;
        }
        potReceipts.set(cls.ref, cls);
      }

      if (cls.kind === 'pot-return' || cls.kind === 'keeping-burn') {
        const blockProblem = checkCloseBlock(i, cls);
        if (blockProblem) { problems.push(blockProblem); break; }
        const pk = `${cls.pot}|${cls.handle}`;
        const open = potPosition.get(pk) ?? 0;
        if (cls.n > open) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${cls.kind} of ${cls.n} for ${cls.handle} on pot ${cls.pot}, but only ${open} is escrowed there`); break;
        }
        potPosition.set(pk, open - cls.n);
      }

      // The σ leg goes to the STAKERS, so a meep can only appear here if a forged
      // row put them there — meeps cannot stake (checked above), so they can hold
      // no position to convert. The replay would catch it; this names it plainly.
      if (cls.kind === 'keeping-mint') {
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — keeping mint to meep "${cls.handle}" (meeps stay outside the currency, and cannot stake at all)`); break;
        }
        const blockProblem = checkCloseBlock(i, cls);
        if (blockProblem) { problems.push(blockProblem); break; }
      }

      if (cls.kind === 'holo') {
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — holo to meep "${cls.handle}" (meeps stay outside the currency)`); break;
        }
        const blockProblem = checkCloseBlock(i, cls);
        if (blockProblem) { problems.push(blockProblem); break; }
        // MINT-AT-ENTRY lives here now. A close writes one holo row per receipt
        // it settles — count included when it is 0 — so the holo row is what
        // spends a ref's one mint chance, and a second one naming the same ref
        // is a dollar being counted twice.
        const r = potReceipts.get(cls.ref);
        if (!r) {
          problems.push(`line ${lineNo}: LAWFUL fails — holo ref "${cls.ref}" has no recorded pot-receipt behind it`); break;
        }
        if (r.pot !== cls.pot) {
          problems.push(`line ${lineNo}: LAWFUL fails — holo names pot ${cls.pot} but its receipt "${cls.ref}" paid pot ${r.pot}`); break;
        }
        if (settledRefs.has(cls.ref)) {
          problems.push(`line ${lineNo}: LAWFUL fails — receipt ref "${cls.ref}" already settled (one dollar, one mint chance)`); break;
        }
        settledRefs.add(cls.ref);
      }

      if (cls.kind === 'gift') {
        // Founder gifts: the signature already proves the office pen wrote it;
        // the one law the fold enforces is the standing one — meeps stay
        // outside the currency, so a gift may never land on a meep handle.
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — gift to meep "${cls.handle}" (meeps stay outside the currency)`); break;
        }
      }

      if (cls.kind === 'first-idea') {
        // The first-idea quest's witnessed mint (the Think Tank, 2026-08-30).
        // The signature proves the office pen; the fold holds the quest's own
        // terms — the whole point being that a forged-but-signed line, or a
        // second line slipped in by any route, fails to VERIFY rather than
        // minting twice. The terms, quoted from the rule's grammar comment:
        // "amount exactly 5, authority the-town, the meep law, and
        // once-per-household ever."
        if (cls.n !== 5) {
          problems.push(`line ${lineNo}: LAWFUL fails — first-idea mints exactly 5 (got ${cls.n})`); break;
        }
        if (cls.by !== 'the-town') {
          problems.push(`line ${lineNo}: LAWFUL fails — first-idea is the town's mint (by: "${cls.by}", must be the-town)`); break;
        }
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — first-idea to meep "${cls.handle}" (meeps stay outside the currency)`); break;
        }
        const houseKey = hh(cls.handle, cls.date);
        if (firstIdeaHouses.has(houseKey)) {
          problems.push(`line ${lineNo}: LAWFUL fails — household of "${cls.handle}" already holds its first-idea mint (once per household, ever)`); break;
        }
        firstIdeaHouses.add(houseKey);
      }

      if (cls.kind === 'town-issuance') {
        // The signature already proves the office pen wrote it. What the fold
        // enforces is what a signature cannot: the standing meep law, and that a
        // one-shot purpose runs once. The treasury-handle check lives at the door
        // only; the one-shot rule belongs HERE too, because a second line slipped
        // in by any route must fail to verify, not merely fail at one door.
        //
        // Issuance repeats by design under mint-at-demand, so this check is
        // narrow: only purposes the dial names one-shot are unique. If the dial
        // is unreadable the check is SKIPPED and said out loud — a verifier that
        // silently stops checking is worse than one that admits it cannot.
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — town issuance to meep "${cls.handle}" (meeps stay outside the currency)`); break;
        }
        if (issuanceDial === null) {
          if (!warnedNoIssuanceDial) {
            notes.push('town-issuance one-shot purposes UNCHECKED — no readable law_side.town_issuance in ECONOMY-DIALS.json');
            warnedNoIssuanceDial = true;
          }
        } else if (issuanceDial.once_purposes.has(cls.purpose)) {
          if (oneShotSeen.has(cls.purpose)) {
            problems.push(`line ${lineNo}: LAWFUL fails — purpose "${cls.purpose}" is declared one-shot but is issued twice`); break;
          }
          oneShotSeen.add(cls.purpose);
        }
      }

      if (cls.kind === 'vote-mint') {
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — meep "${cls.handle}" cannot vote-mint`); break;
        }
        const k = `${cls.handle}|${cls.topic}`;
        if (voteMinted.has(k)) { problems.push(`line ${lineNo}: LAWFUL fails — duplicate vote-mint for ${k}`); break; }
        if (!hasStake.has(k)) { problems.push(`line ${lineNo}: LAWFUL fails — vote-mint for ${k} with no stake behind it`); break; }
        voteMinted.add(k);
      }

      // settlement decision, checked in LEDGER ORDER (the order-aware fold):
      // `running` holds the sender's balance from every prior line — including
      // this delivery's own mint (appended just before) and every stake recorded
      // before now — so the transfer-vs-void call here is exactly the one the
      // mint made when it appended. Checked BEFORE the movement fold applies.
      if (cls.kind === 'transfer' || cls.kind === 'void') {
        const d = paysDeliveries.get(cls.id);
        if (!d) {
          problems.push(`line ${lineNo}: SETTLEMENT fails — "mail:${cls.id}" is not a delivered paying letter (a settlement with no mail behind it)`); break;
        }
        if (d.pays !== cls.n || d.from !== cls.from || d.to !== cls.to) {
          problems.push(`line ${lineNo}: SETTLEMENT fails — disagrees with its paying letter (letter: ${d.from}→${d.to} pays ${d.pays})`); break;
        }
        const expected = settlementDecision(d, running.get(cls.from) ?? 0, (h) => isMeep(h, d.date));
        const recordedTag = cls.kind === 'void' ? `void:${cls.reason}` : 'transfer';
        const expectedTag = expected.kind === 'void' ? `void:${expected.reason}` : 'transfer';
        if (recordedTag !== expectedTag) {
          problems.push(`line ${lineNo}: SETTLEMENT DIVERGES — expected ${expectedTag}, recorded ${recordedTag}`); break;
        }
        seenSettlements.add(cls.id);
      }

      // the running fold: nothing but MINT may ever be negative
      const m = /^- \d{4}-\d{2}-\d{2} · (\S+) → (\S+) · (\d+) · /.exec(c);
      if (m) {
        add(m[1], -Number(m[3])); add(m[2], Number(m[3]));
        if (m[1] !== 'MINT' && (running.get(m[1]) ?? 0) < 0) {
          problems.push(`line ${lineNo}: LAWFUL fails — account "${m[1]}" overdrawn to ${running.get(m[1])}`); break;
        }
      }
    }

    // a paying letter the ledger never settled — behind the mail, not a tamper
    if (problems.length === 0) {
      for (const id of paysDeliveries.keys()) {
        if (!seenSettlements.has(id)) {
          problems.push(`settlement owed for "mail:${id}" — ledger is behind the mail, run the mint pass (not a tamper)`); break;
        }
      }
    }
  }

  return { ok: problems.length === 0, problems, notes, lines: entries.length, minted: -(bal.get('MINT') ?? 0) };
}

function main() {
  const i = process.argv.indexOf('--repo');
  const repo = resolve(i !== -1 ? process.argv[i + 1] : DEFAULT_REPO);
  const r = verifyStampLedger(repo);
  if (r.ok) {
    console.log(`✓ stamp-ledger verifies — ${r.lines} line(s), ${r.minted} minted, chain + signatures + replay + conservation + lawful all green`);
    // A check the verifier could not run is printed on a GREEN result too. Green
    // plus a skipped check is a different claim from green, and hiding the note
    // behind failure would make the weaker claim look like the stronger one.
    for (const n of r.notes ?? []) console.log(`  ! ${n}`);
  } else {
    console.error('✗ stamp-ledger verification FAILED:');
    for (const p of r.problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
