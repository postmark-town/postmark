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
  keepingDial, potFile, deriveEpochClose, keepingLine, TREASURY_POT, STAGE_LADDER,
  AWARD_MAX, AWARD_HANDS, QUEST_PAY, RECREDIT_STAGES, CORRECTION_HANDS,
  PARCEL_PRICE, PARCEL_SETTLED_BY_DAY, PARCEL_ROOM_FROM,
} from './stamp-mint.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = resolve(SCRIPT_DIR, '..');

// WELCOME LINES RULED LAWFUL BY THE FOUNDER, one by one, keyed by the line's
// own signature (only the office pen could have written it, and it binds the
// line to its place in the chain, so no other line can borrow the ruling).
// Each entry skips the welcome's key and once-per-household checks for that
// line alone; its stamps still fold like any mint.
//
//   wildcat, 2026-09-28 · welcome:login:commander-and-chief. The house of many
//   doors (gh:334016343) was welcomed through kinofire on 09-25. Wildcat joined
//   by PR, the office did not yet know the login was that house's, and the
//   12:00Z crossing minted a second bundle; the binding that made them one
//   house landed at 13:59Z (town d9ff628). A double welcome by the town's
//   error, not the resident's. Keemin, 2026-09-28: "agreed with your instance
//   fix" — wildcat keeps the five. The class (judge a welcome by the account,
//   before it is minted) is the settle-join fix's to close.
//
//   scout, 2026-09-28 · welcome:login:generalroam-boop. House of Harvey
//   (gh:273009068) was welcomed through amia-semper on 09-14. Scout joined by
//   the pen's PR (#3244, merged 02:08Z 09-29), unbound, and the tick paid a
//   second bundle at 02:22Z under the card's GitHub username. The same account,
//   the town's error. Keemin, 2026-09-29: the stamps that already went out stay
//   out (append only). Allowlisted BEFORE Scout's bind, so the bind cannot turn
//   the verifier red the way Wildcat's did. The class is closed by town
//   51d0ceb07 (the bundle pays only a bound resident, and compares by house) and
//   POS-297 (admission is the bind).
const RULED_WELCOMES = new Set([
  'XAGgD4zviHwmHM2OXlC0WR6U3C1D0jNCz6D7Z2qxFGB0bQ9sxrq13Xwu0Nwx3CziKrMUg9gd84awPZ5kBn8iDA',
  'puN9nTwldpee7EBXGdcRQYs-YPsOvfWBZsvA0hckjCyyDCs_9AVXN6mryNLrb2Pd7cM1HfxPaN5iaIlL87fQBw',
  // postmark-pen, 2026-09-25 · welcome:login:postmark-pen. The office's pen was
  // made a resident of the-town by a founder's direct commit (55df1afc6), never
  // pinned, and paid a bundle under its card's GitHub username. Pinned at
  // 301406700 on 09-29 (c1887e000), which re-keyed the line and redded it.
  // The same ruling as Scout's: the stamps that went out stay out.
  'PTXsVjCUYqMnmaKrIAZwjqBrq8If07GchFlgAnHQ2NdeOeIYbJcaa4P3fACdEAYbmFR4H6T4KA9oiCVO76jTDg',
]);

function ballotFile(repo, topic) {
  const p = join(repo, 'WHITE_PAGES', `ballot-${topic}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

// `registry` (POS-345): the store's registry as tools/households.json's
// object, handed over by --registry <file|url> (tools/registry-source.mjs).
// Without it, the printout is read, as before.
export function verifyStampLedger(repo, { pubkeyPem, registry = null } = {}) {
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
    const welcomedHouses = new Set();   // household keys already paid their welcome bundle
    const paidStages = new Set();       // `${post}/${stage}` already paid its stage stamps
    const paidAwards = new Set();       // `${post}/${label}` already paid its award (POS-290)
    const paidQuests = new Set();       // `${quest}|${household}` already paid (POS-632)
    const stageLineOf = new Map();      // `${post}/${stage}` -> the stage line { handle, n, sig } (POS-649)
    const stageLineBySig = new Map();   // a stage line's sig -> { post, stage, handle, n } (POS-649)
    const recredited = new Set();       // `${post}/${stage}` already re-credited (once, ever)
    const burnedSigs = new Set();       // stage-line sigs already burned by a correction (once, ever)
    const postPosition = new Map();     // `${post}|${handle}` -> { n, side }, the open stake on a post
    const postReturned = new Set();     // `${post}|${handle}` already returned (once, ever)
    // ONE HOUSE, TWO SPELLINGS (2026-09-20, cloud-phi). A household declared
    // through the office door is keyed `hh:<slug>` by the drain's registry line,
    // while the pin the welcome plan read the same afternoon keyed it
    // `gh:<id>`. Both name the same house — tools/households.json binds the
    // account id to the slug — and a day-granular registry made the earlier
    // welcome read as a stranger's. The line stays true because it was true:
    // a welcome's key is lawful when it resolves to the recipient's house under
    // EITHER spelling, and once-per-household counts the house, not the
    // spelling. Nothing here widens what a lying key can do: a gh: id the
    // households file does not bind to the handle's declared house still fails.
    const houseSlugByGhId = (() => {
      const m = new Map();
      try {
        const hhFile = registry ?? JSON.parse(readFileSync(join(repo, 'tools', 'households.json'), 'utf8'));
        for (const [slug, rec] of Object.entries(hhFile?.households ?? {})) {
          for (const a of rec?.accounts ?? []) if (a && a.id != null) m.set(`gh:${a.id}`, `hh:${slug}`);
          // A key the house once carried (`formerly`, printed from the store) is
          // the same house: POS-299 re-keyed Emmett's after its welcome, and the
          // line's date still resolves the recipient to the old key.
          for (const f of rec?.formerly ?? []) if (f) m.set(`hh:${f}`, `hh:${slug}`);
        }
      } catch { /* no declared households: every key is its own spelling */ }
      return m;
    })();
    const canonHouse = (key) => houseSlugByGhId.get(key) ?? key;
    // Each declared house's declaration day, as the registry wrote it (`since`,
    // a town-time date string, never the day it came ashore), keyed by its
    // canonical `hh:<slug>`: the parcel purchase is lawful only for a house
    // declared after the cutoff (POS-762).
    const declaredOn = (() => {
      const m = new Map();
      try {
        const hhFile = registry ?? JSON.parse(readFileSync(join(repo, 'tools', 'households.json'), 'utf8'));
        for (const [slug, rec] of Object.entries(hhFile?.households ?? {}))
          if (typeof rec?.since === 'string') m.set(`hh:${slug}`, rec.since.slice(0, 10));
      } catch { /* no declared households: no house can buy a parcel */ }
      return m;
    })();
    const parcelsBought = new Map();    // canonical house key -> parcels bought so far (POS-762)
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

      // A resident-initiated unstake, and the ONE branch on a `stake:pot/…`
      // movement that deliberately does NOT call checkCloseBlock: it belongs to
      // no close block, names no epoch, and stands alone by design. What it does
      // share with world-unstake is the ownership clip, for the identical
      // reason — the escrow account is per POT, so the generic movement fold
      // below would happily let one staker withdraw another's stamps with every
      // account still non-negative. This map is the only thing that can see it.
      if (cls.kind === 'pot-unstake') {
        const pk = `${cls.pot}|${cls.handle}`;
        const open = potPosition.get(pk) ?? 0;
        if (cls.n > open) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${cls.handle} unstakes ${cls.n} from pot ${cls.pot} but holds only ${open} there`); break;
        }
        potPosition.set(pk, open - cls.n);
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

      if (cls.kind === 'welcome' && !RULED_WELCOMES.has(entries[i].sig)) {
        // The welcome bundle (founder-ruled 2026-09-14). The signature proves
        // the office pen; the fold holds the quest's own terms, quoted from the
        // rule's grammar comment: "amount exactly 5, authority the-town, the
        // meep law, the named key IS the recipient's household at the line's
        // date, and once-per-household ever."
        if (cls.n !== 5) {
          problems.push(`line ${lineNo}: LAWFUL fails — a welcome bundle mints exactly 5 (got ${cls.n})`); break;
        }
        if (cls.by !== 'the-town') {
          problems.push(`line ${lineNo}: LAWFUL fails — the welcome bundle is the town's mint (by: "${cls.by}", must be the-town)`); break;
        }
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — welcome bundle to meep "${cls.handle}" (meeps stay outside the currency)`); break;
        }
        // The key rides IN the line, so it can LIE — and a lying key is how one
        // household would collect a second bundle under a neighbour's name. The
        // recipient's own household at the line's date is the answer that
        // cannot be written by the pen, so it is the one that rules.
        const houseKey = hh(cls.handle, cls.date);
        if (canonHouse(cls.household) !== canonHouse(houseKey)) {
          problems.push(`line ${lineNo}: LAWFUL fails — welcome names household "${cls.household}" but "${cls.handle}" is ${houseKey} at ${cls.date}`); break;
        }
        // The once-ever set still counts SPELLINGS here, as it always has: making
        // it count houses re-judges history (line 12103, noe's house, holds a
        // bundle under each spelling already) and that is the class fix, ruled
        // separately — a hotfix unblocks the instance and moves nothing else.
        if (welcomedHouses.has(houseKey)) {
          problems.push(`line ${lineNo}: LAWFUL fails — household of "${cls.handle}" already holds its welcome bundle (once per household, ever)`); break;
        }
        welcomedHouses.add(houseKey);
      }

      if (cls.kind === 'post-stage') {
        // A bug's stage stamps (Posts phase 2, 2026-09-29). The signature proves
        // the office pen; the stage having happened is the pen's assertion, as a
        // join bundle's arrival is, because this repo cannot see the store. The
        // fold holds the rest, quoted from the grammar comment: "the amount is on
        // the ladder for its stage, by: is the-town, the meep law, and ONE line
        // per post and stage, ever."
        //
        // An award whose label is a stage's name reads as THIS kind, never as an
        // award (the two grammars are disjoint on purpose). A hand's `by:` is how
        // it shows, so it is named for what it is before the ladder speaks.
        if (AWARD_HANDS.includes(cls.by)) {
          problems.push(`line ${lineNo}: LAWFUL fails — post:${cls.post}/${cls.stage} is an award by ${cls.by} under a bug stage's name (an award label is never a stage; stages are the town's mint)`); break;
        }
        if (!(STAGE_LADDER[cls.stage] ?? []).includes(cls.n)) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${cls.stage} pays ${(STAGE_LADDER[cls.stage] ?? []).join(' or ')}, not ${cls.n} (post:${cls.post}/${cls.stage})`); break;
        }
        if (cls.by !== 'the-town') {
          problems.push(`line ${lineNo}: LAWFUL fails — stage stamps are the town's mint (by: "${cls.by}", must be the-town)`); break;
        }
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — stage stamps to meep "${cls.handle}" (meeps stay outside the currency)`); break;
        }
        const k = `${cls.post}/${cls.stage}`;
        if (paidStages.has(k)) {
          problems.push(`line ${lineNo}: LAWFUL fails — post:${k} is paid twice (one line per post and stage, ever)`); break;
        }
        paidStages.add(k);
        stageLineOf.set(k, { handle: cls.handle, n: cls.n, sig: entries[i].sig });
        stageLineBySig.set(entries[i].sig, { post: cls.post, stage: cls.stage, handle: cls.handle, n: cls.n });
      }

      // ── the correction (POS-649, Darko 2026-10-15) ───────────────────────
      // A stage paid to the wrong resident: its recredit pays the right one the
      // SAME amount, and the very next line burns the wrong mint, named by its
      // full signature, from the handle it paid. Either half alone, either half
      // twice, or a burn of anything but a stage line is red. The overdraw of
      // the wrong recipient's liquid stamps is the running fold's below (a burn
      // is an arrow out of the handle, so it can never draw on escrow).
      if (cls.kind === 'post-recredit') {
        const k = `${cls.post}/${cls.stage}`;
        const wrong = stageLineOf.get(k);
        if (cls.by !== 'the-town') {
          problems.push(`line ${lineNo}: LAWFUL fails — a recredit is the town's mint (by: "${cls.by}", must be the-town) (post:${k}-recredit)`); break;
        }
        if (!RECREDIT_STAGES.includes(cls.stage)) {
          problems.push(`line ${lineNo}: LAWFUL fails — only ${RECREDIT_STAGES.join(', ')} are re-credited (post:${k}-recredit)`); break;
        }
        if (!wrong) {
          problems.push(`line ${lineNo}: LAWFUL fails — post:${k}-recredit corrects a stage that was never paid`); break;
        }
        if (cls.n !== wrong.n) {
          problems.push(`line ${lineNo}: LAWFUL fails — post:${k}-recredit pays ${cls.n}, and the stage it corrects paid ${wrong.n} (the same amount, never another)`); break;
        }
        if (cls.handle === wrong.handle) {
          problems.push(`line ${lineNo}: LAWFUL fails — post:${k}-recredit pays ${cls.handle}, who the stage already paid`); break;
        }
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — a recredit to meep "${cls.handle}" (meeps stay outside the currency)`); break;
        }
        if (recredited.has(k)) {
          problems.push(`line ${lineNo}: LAWFUL fails — post:${k} is re-credited twice (one correction per post and stage, ever)`); break;
        }
        const next = entries[i + 1] ? classifyEntry(entries[i + 1].canonical) : { kind: 'none' };
        if (next.kind !== 'correction-burn' || next.sig !== wrong.sig) {
          problems.push(`line ${lineNo}: LAWFUL fails — post:${k}-recredit is not followed by the burn of the mint it corrects (${wrong.sig.slice(0, 16)}…); the two are written together or not at all`); break;
        }
        recredited.add(k);
      }
      if (cls.kind === 'correction-burn') {
        const wrong = stageLineBySig.get(cls.sig);
        if (!wrong) {
          problems.push(`line ${lineNo}: LAWFUL fails — correction:${cls.sig.slice(0, 16)}… names no earlier stage line (a correction burns a bug stage's mint, nothing else)`); break;
        }
        const k = `${wrong.post}/${wrong.stage}`;
        if (cls.handle !== wrong.handle) {
          problems.push(`line ${lineNo}: LAWFUL fails — the correction of post:${k} burns from ${cls.handle}, and that mint paid ${wrong.handle}`); break;
        }
        if (cls.n !== wrong.n) {
          problems.push(`line ${lineNo}: LAWFUL fails — the correction of post:${k} burns ${cls.n}, and that mint was ${wrong.n} (exactly its amount)`); break;
        }
        if (!CORRECTION_HANDS.includes(cls.by)) {
          problems.push(`line ${lineNo}: LAWFUL fails — a correction is a hand's (${CORRECTION_HANDS.join(' or ')}), not "${cls.by}" (post:${k})`); break;
        }
        if (burnedSigs.has(cls.sig)) {
          problems.push(`line ${lineNo}: LAWFUL fails — the mint post:${k} is burned twice (one correction per mint, ever)`); break;
        }
        // A MEEP'S STAGE MINT IS BURNED ALONE (POS-655, Darko 2026-10-16 20:04
        // EDT): "meeps are credited, not paid". A stage line that paid a handle
        // the law in force at the burn's date names a meep has no right
        // recipient to re-credit, so its correction is the burn alone. Every
        // other correction still follows its recredit, line for line.
        const prev = i > 0 ? classifyEntry(entries[i - 1].canonical) : { kind: 'none' };
        const meepCorrection = lawAt(cls.date).meeps.has(wrong.handle);
        if (!meepCorrection && (prev.kind !== 'post-recredit' || `${prev.post}/${prev.stage}` !== k)) {
          problems.push(`line ${lineNo}: LAWFUL fails — the correction of post:${k} does not follow its recredit; the two are written together or not at all (only a meep's stage mint is burned alone)`); break;
        }
        burnedSigs.add(cls.sig);
      }

      // ── the parcel purchase (POS-762, Darko 2026-10-22) ──────────────────
      // A household declared after Halloween buys its 2nd and 3rd parcels from
      // the town. The signature proves the office pen, and the overdraw is the
      // running fold's below (a burn is an arrow out of the handle, so it can
      // never draw on escrow). This holds the rest, quoted from the grammar
      // comment: dated on or after the first day of the law; the meep law; the
      // key IS the payer's household at the line's date, and that household's
      // declaration is dated after the cutoff; ONE line per household and parcel, the 2nd
      // before the 3rd; and the amount is the price times a count under the
      // parcel it buys.
      if (cls.kind === 'parcel-burn') {
        const what = `parcel:${cls.nth}/${cls.household}`;
        if (cls.date < PARCEL_ROOM_FROM) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${what} is dated ${cls.date}, and no parcel is bought before ${PARCEL_ROOM_FROM}`); break;
        }
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${what} is paid by meep "${cls.handle}" (meeps stay outside the currency)`); break;
        }
        const houseKey = hh(cls.handle, cls.date);
        if (canonHouse(cls.household) !== canonHouse(houseKey)) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${what} names household "${cls.household}" but "${cls.handle}" is ${houseKey} at ${cls.date}`); break;
        }
        const house = canonHouse(houseKey);
        const since = declaredOn.get(house);
        if (!since) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${what}: ${house} has no declaration day in the registry, so it keeps three parcels and has none to buy`); break;
        }
        if (since <= PARCEL_SETTLED_BY_DAY) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${what}: ${house} was declared on ${since}, on or before ${PARCEL_SETTLED_BY_DAY}, so it keeps three parcels and has none to buy`); break;
        }
        const bought = parcelsBought.get(house) ?? 0;
        if (cls.nth !== bought + 2) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${what}: ${house} has bought ${bought} parcel${bought === 1 ? '' : 's'}, so its next purchase is parcel ${bought + 2}${bought + 2 > 3 ? ', past the cap of three' : ''} (the 2nd, then the 3rd, once each)`); break;
        }
        // THE PRICE IS THE ROOM ALREADY BOUGHT (Darko 2026-10-23 09:51 EDT,
        // POS-762/f "Room bought": "50 x room already bought: room 1->2 costs 50,
        // 2->3 costs 100, whatever is held"). Room for the nth parcel is bought
        // with room nth − 1 in hand, so the amount is exact.
        if (cls.n !== PARCEL_PRICE * (cls.nth - 1)) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${what} burns ${cls.n}; room for parcel ${cls.nth} costs exactly ${PARCEL_PRICE * (cls.nth - 1)} (${PARCEL_PRICE} × the room already bought, ${cls.nth - 1}, whatever is held)`); break;
        }
        parcelsBought.set(house, bought + 1);
      }

      // ── a quest the town pays (POS-632) ─────────────────────────────────
      // The signature proves the office pen; the fold holds the terms, from the
      // sealed QUEST_PAY table, quoted from the grammar comment: "the quest is in
      // QUEST_PAY; the amount is exactly its amount; the line's date is inside its
      // window; by: is the-town; the meep law; the named key IS the recipient's
      // household at the line's date; and ONE line per quest and household, ever."
      if (cls.kind === 'quest-pay') {
        const terms = QUEST_PAY[cls.quest];
        if (!terms) {
          problems.push(`line ${lineNo}: LAWFUL fails — quest:${cls.quest} is not a paid quest (${Object.keys(QUEST_PAY).join(', ')})`); break;
        }
        if (cls.n !== terms.amount) {
          problems.push(`line ${lineNo}: LAWFUL fails — quest:${cls.quest} pays exactly ${terms.amount} (got ${cls.n})`); break;
        }
        if (cls.date < terms.from || (terms.until && cls.date > terms.until)) {
          problems.push(`line ${lineNo}: LAWFUL fails — quest:${cls.quest} pays from ${terms.from}${terms.until ? ` until ${terms.until}` : ''}, not on ${cls.date}`); break;
        }
        if (cls.by !== 'the-town') {
          problems.push(`line ${lineNo}: LAWFUL fails — a quest is the town's mint (by: "${cls.by}", must be the-town)`); break;
        }
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — quest pay to meep "${cls.handle}" (meeps stay outside the currency)`); break;
        }
        const houseKey = hh(cls.handle, cls.date);
        if (canonHouse(cls.household) !== canonHouse(houseKey)) {
          problems.push(`line ${lineNo}: LAWFUL fails — quest:${cls.quest} names household "${cls.household}" but "${cls.handle}" is ${houseKey} at ${cls.date}`); break;
        }
        const k = `${cls.quest}|${canonHouse(houseKey)}`;
        if (paidQuests.has(k)) {
          problems.push(`line ${lineNo}: LAWFUL fails — quest:${cls.quest} is paid twice to household ${houseKey} (one line per quest and household, ever)`); break;
        }
        paidQuests.add(k);
      }

      // ── the idea posts (POS-290) ─────────────────────────────────────────
      // The award: the signature proves the office pen; the fold holds the
      // terms, quoted from the grammar comment: "n is 1..AWARD_MAX, `by:` is one
      // of AWARD_HANDS, the meep law on the recipient, and ONE line per post and
      // label, ever."
      if (cls.kind === 'post-award') {
        if (!AWARD_HANDS.includes(cls.by)) {
          problems.push(`line ${lineNo}: LAWFUL fails — an award is paid by a hand (${AWARD_HANDS.join(' or ')}), not by "${cls.by}" (post:${cls.post}/${cls.label})`); break;
        }
        if (cls.n > AWARD_MAX) {
          problems.push(`line ${lineNo}: LAWFUL fails — an award pays at most ${AWARD_MAX}, not ${cls.n} (post:${cls.post}/${cls.label})`); break;
        }
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — award to meep "${cls.handle}" (meeps stay outside the currency)`); break;
        }
        const k = `${cls.post}/${cls.label}`;
        if (paidAwards.has(k)) {
          problems.push(`line ${lineNo}: LAWFUL fails — post:${k} is awarded twice (one line per post and label, ever)`); break;
        }
        paidAwards.add(k);
      }

      // The stake with a side. Overdraw is structural (the movement fold below):
      // a stake past the staker's balance overdraws the handle, and a way out
      // past the post's whole escrow overdraws `stake:post/<id>`. What that fold
      // cannot see is the POSITION: the account is per post while a position is
      // per (post, handle), so these branches hold ownership (the world-unstake
      // hole), the one side, the whole return, and its once.
      if (cls.kind === 'post-stake') {
        if (lawAt(cls.date).meeps.has(cls.handle)) {
          problems.push(`line ${lineNo}: LAWFUL fails — meep "${cls.handle}" cannot stake`); break;
        }
        const pk = `${cls.post}|${cls.handle}`;
        const open = postPosition.get(pk) ?? { n: 0, side: null };
        if (open.n > 0 && open.side !== cls.side) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${cls.handle} stakes ${cls.side} on post ${cls.post} while holding ${open.n} ${open.side} there (a position has one side)`); break;
        }
        postPosition.set(pk, { n: open.n + cls.n, side: cls.side });
      }

      if (cls.kind === 'post-unstake') {
        const pk = `${cls.post}|${cls.handle}`;
        const open = postPosition.get(pk) ?? { n: 0, side: null };
        if (cls.n > open.n) {
          problems.push(`line ${lineNo}: LAWFUL fails — ${cls.handle} unstakes ${cls.n} from post ${cls.post} but holds only ${open.n} there`); break;
        }
        postPosition.set(pk, { n: open.n - cls.n, side: open.side });
      }

      if (cls.kind === 'post-return') {
        const pk = `${cls.post}|${cls.handle}`;
        if (postReturned.has(pk)) {
          problems.push(`line ${lineNo}: LAWFUL fails — post ${cls.post} already returned ${cls.handle}'s stake (one return per post and resident, ever)`); break;
        }
        const open = postPosition.get(pk) ?? { n: 0, side: null };
        if (cls.n !== open.n) {
          problems.push(`line ${lineNo}: LAWFUL fails — a post return is whole: ${cls.n} to ${cls.handle} on post ${cls.post}, but the open position is ${open.n}`); break;
        }
        postReturned.add(pk);
        postPosition.set(pk, { n: 0, side: open.side });
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
      } else if (cls.kind === 'holo') {
        // THE HOLO ARM (2026-09-17, the founder: "non-spendable is repealed; the
        // stamps are like any other, but are holo to signify the special
        // source"). This fold is the verifier's OWN balance — the one the
        // overdraw check and the settlement replay read — and it keys on the
        // movement shape, so the arrow-free holo row is invisible to it. Without
        // this arm a giver's first stake out of their reward would read as an
        // overdraw and the whole ledger would fail LAWFUL: a forgery verdict on
        // a lawful row. Drawn from MINT exactly as foldBalances does it, so the
        // two folds cannot drift; the conservation check above is the same law
        // read over the whole file at once.
        add('MINT', -cls.n); add(cls.handle, cls.n);
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

function main(registrySource = null) {
  const i = process.argv.indexOf('--repo');
  const repo = resolve(i !== -1 ? process.argv[i + 1] : DEFAULT_REPO);
  const r = verifyStampLedger(repo, { registry: registrySource?.registry ?? null });
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // --registry <file|url>: the store's registry, handed over or fetched (POS-345).
  const { registryFromArgv } = await import('./registry-source.mjs');
  main(await registryFromArgv(process.argv, { tool: 'stamp-verify' }));
}
