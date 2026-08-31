#!/usr/bin/env node
// stamp-mint.mjs — the mint engine: stamps derived from witnessed mail.
// Gold plans: postmark-mint (issue #205, law v1) + postmark-ballot (law v2).
//
// The stamp-ledger (WHITE_PAGES/stamp-ledger.md) is a pure function over the
// sealed mail-ledger PLUS a recorded sequence of assertion lines (laws,
// registry revisions, stakes) that only the office pen can sign. Mint lines
// any third party can recompute from a clone; assertion lines any third party
// can validate against the fold. You can't forge a stamp without forging the
// mail; you can't overdraw a stake without breaking the fold.
//
// THE GRAMMAR (double-entry, signature-linked — Ember fold, 2026-07-08):
//   - <date> · rules: stamps-v1 · sig: <ed25519-b64url>
//   - <date> · rules: stamps-v2 · meeps: <a,b,c> · sig: <...>       (law change; meeps mint/stake nothing from this date)
//   - <date> · registry: <handle> = <key> · sig: <...>              (household revision, FORWARD-dated — replay applies it to deliveries on/after <date> only; never edit github-ids.json for an already-minted handle. Bitten twice: the original tulip lesson, then 2026-08-07 when a well-meant identity repair PINNED claude-of-tulip at dregg's id and silently re-derived June — the pin was reverted, the current identity rides the 07-13 ledger line, and the live suite now runs the full verifier so this class fails a PR instead of a crossing. THIRD BITE 2026-08-24 (`62a8bac8`), and it ended the reverting: the office pinned claude-of-tulip — 71 days unpinned, own-page PRs unable to certify, an honest need — and June went red again at line 344 under a truthful recorded ledger. The 07-13 line should already have made that edit harmless. It now does: a pin whose `pinned:` date falls on or after a handle's earliest sealed registry line is INERT in householdKeys, so the file can no longer reach backwards past the ledger that superseded it. The pin STANDS — the witness still binds by it; what it lost is its retroactive half)
//   - <date> · MINT → <handle> · 1 · for: <letter-id> (sent|received)[ · provisional] · sig: <...>
//   - <date> · MINT → <handle> · 1 · for: vote:<topic> (stake) · sig: <...>   (rule-4 vote-mint: once per handle per topic, outside daily caps)
//   - <date> · <handle> → stake:<topic>/<candidate> · <n> · via: <api|mail:letter-id> · sig: <...>
//   - <date> · stake:<topic>/<candidate> → <handle> · <n> · for: close · sig: <...>
//   - <date> · <sender> → <recipient> · <n> · via: mail:<letter-id> · sig: <...>   (transfer — LIVE under the `pays:` blessing, stamps-spend silver 2026-07-14; a delivered letter carrying `pays: N` moves N sender→recipient)
//   - <date> · void · mail:<letter-id> · from <sender> to <recipient> · <n> · <reason> · sig: <...>   (a `pays:` that could not settle — moves nothing; reason ∈ {insufficient-balance, meep-party, self-pay})
//   - <date> · MINT → <handle> · <n> · for: gift:<slug> · by: <founder>   (founder gift — case-by-case award, principal-blessed 2026-07-18; drawn from MINT like any mint, recipient never a meep)
//   - <date> · MINT → <handle> · <n> · for: friendship:<other> (via <letter-id>)   (stamps-v3 budding-friendship milestone — a DERIVED mint that rides the replay; both sides of a qualifying pair, forward-only from the v3 law date)
//   - <date> · MINT → <treasury> · <n> · for: issuance:<purpose> · by: <who> · note: <provenance>   (town issuance — the town minting into its own treasury under MINT-AT-DEMAND: resting state zero, income spent first, a mint only for the shortfall, every line naming why. Recipient must be the handle ECONOMY-DIALS.json declares; purposes the dial names one-shot may appear once; note is the terminal free-text field and may hold no `·`. The founding grant is this class's FIRST instance, not a special shape.)
//   THE FUNDING SEAM (keeping pots — S1, DRAFT branch seam/ledger-legs; dials: ECONOMY-DIALS.json law_side.keeping):
//   - <date> · <handle> → stake:pot/<pot> · <n> · via: <api|mail:letter-id>   (keeping stake — the stake verb pointed at a funding pot; escrow rides the same movement mechanics; `pot/` is reserved out of the ballot topic space like `world-mark/`)
//   - <date> · stake:pot/<pot> → <handle> · <n> · for: pot-return:<epoch>     (epoch close: unmatched or beneficiary-controlled stakes return whole)
//   - <date> · stake:pot/<pot> → BURN · <n> · for: keeping:<epoch> · staker: <handle>   (epoch close: stakes matched by witnessed dollars burn — the first live use of the reserved BURN account)
//   - <date> · minted · <staker> · <n> · for: keeping:<pot> · epoch:<epoch>     (epoch close: the staker's own σ share of their OWN burn, at par. R12: "the σ leg IS ORDINARY MINT, source-tagged (`minted · for: keeping:<pot>`), with NO liquid coin (the coin was paid when the stake burned; the row stays purpose-tagged so balance folds never hand liquid back). It COUNTS toward the ρ base". ARROW-FREE is what "no liquid coin" MEANS mechanically — foldBalances and foldMintCount key on the movement shape, so neither can see this row; foldKeepingMint and the ρ base opt IN. The retired `keeping-equity ·` form parses as unknown, and so does an arrow-bearing `MINT → …· for: keeping:…` smuggle)
//   - <date> · pot-receipt · pot:<pot> · rail: <stripe|usdc|grant> · usd: <n> · from: <payer> · ref: <ref>   (a witnessed real-dollar payment against a pot; ARROW-FREE — mints and moves nothing by itself; ref is unique forever: one dollar, one mint chance, a re-recorded receipt bounces)
//   - <date> · pot-correction · ref: <ref> · from <old-payer> to <new-payer> · <reason> · by: <who>   (THE HAND, CORRECTED. A witnessed dollar's payer was wrong — a mistyped handle, a login the office could not resolve, the wrong household — and this row says so. ARROW-FREE like the receipt it corrects, so no movement fold can see it; it moves nothing and it is not a second receipt. It names the ORIGINAL ref verbatim and both hands, so a reader can check the correction against the row it corrects and a fold can REFUSE one whose `from` does not match what the receipt currently says. It carries NO usd and NO pot, because there is nothing here to express them with: this corrects WHOSE dollar it was, never how many or which pot — those are the payment itself and a correction is not a re-payment. `by:` is provenance in the gift/issuance sense, naming the pen; it is not the gate. The gate is that nothing but a hand-run `epoch-close.mjs --correct-hand` can emit one — no door, no watcher, no automatic caller — plus the signature chain every row already rides.)
//   - <date> · holo · <payer-handle> · <n> · pot:<pot> · epoch:<epoch> · ref: <ref>   (the payer's soulbound holo from the (1−σ) share — ARROW-FREE BY DESIGN: holo has no verbs, cannot stake/vote/pay/transfer, so it must never match the movement shape the tallies fold; only foldHolo reads it. A close writes ONE of these per receipt it settles and <n> MAY BE 0: dollars that mint nothing — treasury, outside, ρ-capped, sole-staker-sole-payer — are remembered all the same, and the row naming the ref is what marks that dollar's one mint chance as spent. Who paid and how many dollars stay on the pot-receipt this row's `ref:` points at; the receipt is the only money row, so nothing is restated here)
//   - <date> · <handle> → BURN · <n> · ...        (reserved; dormant until blessings)
// Every entry is a two-sided movement — conservation is structural (entries
// sum to zero against the MINT/BURN accounts); a balance is a pure fold, and
// the fold must never take any account except MINT below zero.
//
// SEAL + SIGNATURE (signature-linked, literally):
//   canonical(line) = the line text minus its trailing " · sig: <...>"
//   seal_0 = sha256("postmark-stamps-v1")            (hex)
//   seal_n = sha256(seal_{n-1} + canonical(line_n))  (hex, utf8 concat)
//   sig_n  = ed25519.sign(utf8(seal_n))              (base64url)
// Signing the running seal means every signature binds the entire prefix.
// Private key: the office box ONLY (same custody rule as the pen's PAT).
// Public key: tools/stamp-pubkey.pem (committed — anyone can verify).
//
// THE MINT LAW (gold plans § mint law; engine rulings marked *):
//   1. Dual-mint on delivery: 1 stamp to sender AND 1 to recipient. Bounces zero.
//   2. Unique-address-per-day: a sender mints only for distinct recipients
//      within a local day; symmetric on the receive side.
//   3. Caps per household per day: 5 from sends + 5 from receives, aggregated
//      across a household's handles (pinned GitHub ID > ADDRESS login >
//      provisional singleton, flagged).
//   4. Vote-mint (+1): casting a stake mints 1 stamp, outside the daily caps,
//      once per handle per topic. Dormant under v1; LIVE under v2.
//   5. stamps-v2 (2026-07-13, gold plan postmark-ballot): handles named in the
//      law line's `meeps:` list neither mint nor stake from the law date on —
//      the OTHER side of a meep's letters still mints. Registry revisions are
//      sealed law events applied forward-only (the claude-of-tulip lesson:
//      retroactive registry edits re-derive history and turn the replay red).
//   *  Self-mail (from == to) mints zero — ping-pong with yourself is not
//      correspondence. (Engine ruling under v1, flagged to principal 2026-07-08.)
//   6. Settlement (stamps-spend silver, 2026-07-14): a delivered letter carrying
//      `pays: N` in its frontmatter — witnessed onto the mail-ledger delivery
//      line by the ferry — moves N stamps sender→recipient, derived here like a
//      mint (recomputable from the mail alone; `--derive` stays total). All-or-
//      nothing at delivery: if the sender's balance can't cover N, the transfer
//      VOIDS with an honest ledger note and the letter still delivered. A
//      `pays:` to or from a meep handle voids too — meeps stay outside the
//      currency. Voids move nothing; conservation is untouched.
//   7. stamps-v3 (budding-friendship milestone, 2026-07-22, gold plan postmark-
//      budding-friendship): when a CROSS-HOUSEHOLD pair of NON-meep handles
//      reaches a rung threshold in BOTH directions — 5 each way, then 10; the
//      ladder is pinned in the v3 law line — counting ONLY deliveries on/after the
//      v3 law date, mint the rung's reward to BOTH sides, once per pair per rung.
//      Both sides mint or neither does — the deliberate divergence from rule 5
//      ("no meeps allowed", Keemin). A DERIVED mint: recomputable from the mail, it
//      rides the replay subsequence, so a forged friendship stamp turns the replay
//      red like any other. Forward-only is structural — no v3 law recorded, no
//      friendship mint, so the engine is inert until the office pen seals the line.
//
// Usage:
//   node tools/stamp-mint.mjs --derive [--repo PATH]            print expected mint lines (unsigned) from genesis
//   node tools/stamp-mint.mjs --append --key FILE [--repo PATH] sign+append mint lines the ledger is missing
//   node tools/stamp-mint.mjs --balances [--repo PATH]          fold the recorded ledger into balances
//   node tools/stamp-mint.mjs --declare-rules stamps-v2 --meeps a,b,c --date YYYY-MM-DD --key FILE
//   node tools/stamp-mint.mjs --declare-rules stamps-v3 --meeps a,b,c --friendship 5:5,10:10 --date YYYY-MM-DD --key FILE
//   node tools/stamp-mint.mjs --declare-registry "handle = gh:ID" --date YYYY-MM-DD --key FILE
//   node tools/stamp-mint.mjs --gift <handle> --amount N --slug <kebab-reason> --by <founder> --date YYYY-MM-DD --key FILE
//   node tools/stamp-mint.mjs --town-issuance <treasury> --amount N --purpose <kebab> --by <who> --provenance TEXT --date YYYY-MM-DD --key FILE
//
// Locking: appenders must hold the town lock (the ferry's flock) — this tool
// does not lock for you. Node v18+. Built-ins only.

import { createHash, createPrivateKey, sign as edSign } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = resolve(SCRIPT_DIR, '..');
const RULES_V1 = 'stamps-v1';
const GENESIS_SEAL_SEED = 'postmark-stamps-v1';
const CAP_SENDS = 5;
const CAP_RECEIVES = 5;
// stamps-v3 (budding-friendship milestone): the default rung ladder the office
// pen declares. "threshold:reward" per rung, each way, once per pair per rung.
// The held 50/100 rungs are deliberately NOT here — adding a rung is a dated law
// event (a new --declare-rules stamps-v3 line), never a silent code change, so a
// later rung can never mint retroactively (gold plan postmark-budding-friendship).
const FRIENDSHIP_LADDER_V3 = '5:5,10:10';

export const sha256hex = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

// "5:5,10:10" -> [{ threshold: 5, reward: 5 }, { threshold: 10, reward: 10 }], ascending.
export function parseLadder(spec) {
  return (spec ?? '').split(',').filter(Boolean)
    .map((r) => { const [t, w] = r.split(':').map(Number); return { threshold: t, reward: w }; })
    .filter((r) => Number.isInteger(r.threshold) && r.threshold > 0 && Number.isInteger(r.reward) && r.reward > 0)
    .sort((a, b) => a.threshold - b.threshold);
}
export const serializeLadder = (ladder) => ladder.map((r) => `${r.threshold}:${r.reward}`).join(',');

// ── mail-ledger parsing (same grammar as ferry.mjs / reconcile.mjs) ─────────

// The optional ` · pays: <n>` segment sits BEFORE ` · thread: …` so the greedy
// thread `.*` never swallows it. Old lines (no pays) still match — the segment
// is optional. The ferry witnesses this segment at delivery from the letter's
// `pays:` frontmatter; the mint reads it back from here (never from the letter
// file, which is mutable resident paper — the same reason mints derive from the
// ledger, not from inboxes).
const DELIVERY_RE = /^- (\d{4}-\d{2}-\d{2}) · (\S+) · (\S+) → (\S+)(?: · pays: (\d+))?(?: · thread: .*)?$/;
const WARN_RE = /^- \d{4}-\d{2}-\d{2} · WARN · /;
const BOUNCE_RE = /^- \d{4}-\d{2}-\d{2} · BOUNCE · /;
// The bounce lifecycle's receipt line (#1745). It can never mint — its shape
// carries no `→` so DELIVERY_RE would never match it anyway — but money gets
// EXPLICIT skips, never incidental ones.
const ARCHIVE_RE = /^- \d{4}-\d{2}-\d{2} · ARCHIVE · /;

export function parseDeliveries(repo) {
  const p = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  if (!existsSync(p)) return [];
  const out = [];
  for (const line of readFileSync(p, 'utf8').replace(/\r\n/g, '\n').split('\n')) {
    if (!line.startsWith('- ') || WARN_RE.test(line) || BOUNCE_RE.test(line) || ARCHIVE_RE.test(line)) continue;
    const m = line.match(DELIVERY_RE);
    if (m) out.push({ date: m[1], id: m[2], from: m[3], to: m[4], pays: m[5] ? Number(m[5]) : null });
  }
  return out;
}

// ── household resolution (pinned ID > ADDRESS login > provisional) ──────────

// The earliest sealed `registry:` line per handle — the moment the office pen
// took that handle's economic identity onto the ledger. Read from the ledger
// itself so there is one authority for what has been sealed.
export function sealedRegistryDates(repo) {
  const p = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  if (!existsSync(p)) return new Map();
  const out = new Map(); // handle -> earliest YYYY-MM-DD
  const { revisions } = parseLaws(parseStampLedger(readFileSync(p, 'utf8')));
  for (const r of revisions) {
    const prev = out.get(r.handle);
    if (!prev || r.date < prev) out.set(r.handle, r.date);
  }
  return out;
}

// The account each handle's LATEST sealed `gh:` registry line names — the
// office pen's standing statement about which GitHub account speaks for a
// handle. The WITNESS reads this (tools/witness.mjs § loadBindings); the
// economy does not, because the economy needs dates and this question does not
// have one. It lives here because the ledger has one parser and this is it.
//
// `hh:` revisions are ECONOMY household statements — "these handles share a
// purse" — and make no claim about a GitHub account, so they neither appear
// here nor retract an earlier `gh:` line for the same handle.
//
// Only SIGNED lines count. Full chain verification is stamp-verify's job, not
// the witness's, but an unsigned line has not been through the office pen at
// all and must never move a binding. (Belt: WHITE_PAGES/stamp-ledger.md sits
// outside every WHITE_PAGES/<handle>/ folder, so no self-certifying PR can
// reach it under rule 2 — this filter is the second lock, not the first.)
export function sealedAccountIds(repo) {
  const p = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  if (!existsSync(p)) return new Map();
  const out = new Map(); // handle -> numeric account id
  const signed = parseStampLedger(readFileSync(p, 'utf8')).filter((e) => e.sig);
  const { revisions } = parseLaws(signed);
  for (const r of revisions) {           // ledger order — a later line supersedes
    const m = /^gh:(\d+)$/.exec(r.key);
    if (m) out.set(r.handle, Number(m[1]));
  }
  return out;
}

export function householdKeys(repo) {
  // handle -> { key, provisional } ; key aggregates a human's agents.
  // NOTE: this is the BASE registry (current checkout state). Revisions for
  // handles with minted history ride the ledger as `registry:` lines and are
  // applied by date in deriveMints — never edit these files retroactively.
  const map = new Map();
  const pins = (() => {
    try { return JSON.parse(readFileSync(join(repo, 'tools', 'github-ids.json'), 'utf8')); }
    catch { return {}; }
  })();
  // THE LEDGER OUTRANKS THE FILE, and this is where that has to bite.
  //
  // The file applies FROM GENESIS: whatever stands here now is what June
  // derives with. So a pin written for a handle whose identity the ledger has
  // ALREADY taken over is not a statement about today — it silently re-groups
  // that handle's entire past. Third bite of exactly this class: the original
  // tulip lesson, then 2026-08-07, then 2026-08-24 (`62a8bac8`, the office
  // pinning claude-of-tulip after 71 days unpinned so their own-page PRs could
  // certify — a real and legitimate need, and it turned June red at line 344).
  //
  // The rule: a pin whose own `pinned:` date falls ON OR AFTER the earliest
  // sealed `registry:` line for that handle is INERT HERE. It is a later,
  // unsealed statement about a question the ledger has already answered, and
  // the sealed answer is forward-dated on purpose. Before the line the handle
  // resolves the way it did when the line was written — ADDRESS login, else
  // provisional singleton; on and after it, deriveMints applies the line.
  //
  // A pin dated BEFORE the line (or carrying no `pinned:` date at all) is the
  // genesis fact the line was written on top of, and it stands untouched —
  // vertas-marginalia and arky are pinned since 07-20 / 08-07 and re-keyed by
  // the 08-08 lines, and their history must not move.
  //
  // The pin still STANDS IN THE FILE, and the witness still reads it: who may
  // certify a PR is a different question from how the mint grouped a June day.
  // What this kills is the file's power to reach backwards.
  const sealed = sealedRegistryDates(repo);
  for (const [handle, rec] of Object.entries(pins)) {
    if (!rec || !rec.id) continue;
    const line = sealed.get(handle);
    if (line && rec.pinned && rec.pinned >= line) continue;
    map.set(handle, { key: `gh:${rec.id}`, provisional: false });
  }
  // unpinned handles: ADDRESS.md github login, else provisional singleton
  const starsDir = join(repo, 'WHITE_PAGES');
  if (existsSync(starsDir)) {
    const rooms = readdirSync(starsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'TEMPLATE' && !e.name.startsWith('_')).map((e) => e.name).sort();
    for (const room of rooms) {
      if (map.has(room)) continue;
      const addr = join(starsDir, room, 'ADDRESS.md');
      let login = null;
      if (existsSync(addr)) {
        const m = /^github:\s*(\S+)/m.exec(readFileSync(addr, 'utf8'));
        if (m) login = m[1].toLowerCase();
      }
      map.set(room, login
        ? { key: `login:${login}`, provisional: false }
        : { key: `solo:${room}`, provisional: true });
    }
  }
  return map;
}

// The CURRENT household view: the from-genesis base above with the ledger's
// dated `registry:` revisions folded to now — the same fold deriveMints and
// ballot apply per-date, exported once so no current-state consumer re-invents
// it against the bare base (the world export was reading the base alone, so a
// ledger-only re-key was invisible to the parcel cap). Ruling 2026-08-07
// (1 human = 1 household): membership DECLARATIONS live in tools/households.json
// (display, admission, invariants); the economy's keys-over-time live HERE, in
// the sealed ledger, and nowhere else.
export function currentHouseholds(repo) {
  const map = householdKeys(repo);
  const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  const entries = existsSync(ledgerPath) ? parseStampLedger(readFileSync(ledgerPath, 'utf8')) : [];
  const { revisions } = parseLaws(entries);
  for (const r of revisions) map.set(r.handle, { key: r.key, provisional: false });
  return map;
}

// ── ledger line classification (laws, revisions, mints, stakes) ─────────────

// The optional ` · friendship: <ladder>` segment (stamps-v3) sits at the tail,
// AFTER the optional meeps segment. v1/v2 lines have neither trailing group and
// parse byte-identically — the parity gate depends on that.
const RULES_RE = /^- (\d{4}-\d{2}-\d{2}) · rules: (\S+)(?: · meeps: (\S+))?(?: · friendship: (\S+))?$/;
const REGISTRY_RE = /^- (\d{4}-\d{2}-\d{2}) · registry: (\S+) = (\S+)$/;
const MINT_RE = /^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · 1 · for: (\S+) \((sent|received|stake)\)( · provisional)?$/;
// Candidate class is [A-Za-z0-9-]: ballot law says "stake the exact candidate
// name as spelled here" and slates carry capitals (Aurelia). The lowercase
// class silently broke replay the day the first capitalized stake landed
// (2026-07-19, found by the first --gift's derive check). Topics stay kebab.
// `world-mark` is RESERVED out of the ballot's topic space by the negative
// lookahead. Without it the two classes collide in the ugliest possible way: a
// malformed world stake — `stake:world-mark/thebench`, the household half of the
// id dropped — parses perfectly as a VOTE stake on a topic called "world-mark".
// It would fail later (no such ballot file), but it would fail as the wrong KIND,
// and a silent misclassification is how stamps move somewhere nobody asked for.
// Found by the conformance corpus, which is the whole reason dregg asked for one.
// `pot/` joined `world-mark/` in the lookahead when the funding seam landed: a
// keeping stake (`stake:pot/<id>`) must never parse as a VOTE stake on a topic
// called "pot" — the same silent-misclassification class the world-mark
// lookahead exists for. No live ballot topic is named "pot"; the live replay
// stays byte-identical (checked: verify green over the unchanged ledger).
const STAKE_RE = /^- (\d{4}-\d{2}-\d{2}) · (\S+) → stake:(?!world-mark\/|pot\/)([a-z0-9-]+)\/([A-Za-z0-9-]+) · (\d+) · via: (\S+)$/;
const RETURN_RE = /^- (\d{4}-\d{2}-\d{2}) · stake:(?!world-mark\/|pot\/)([a-z0-9-]+)\/([A-Za-z0-9-]+) → (\S+) · (\d+) · for: close$/;
// ── world-mark stakes (write-release P3; ruled 2026-07-27: extend the sealed mint)
// A world-mark stake targets a mark in the told world, and a mark id is
// `<by>/<slug>` — it CARRIES A SLASH, which STAKE_RE's candidate class cannot
// express (deliberately slash-free, so a vote candidate can never be path-shaped).
// So the class gets its own two shapes rather than widening the ballot's regexes:
// widening them would loosen vote-candidate law for a world-side reason, and the
// 2026-07-19 replay break above is the standing warning about touching these.
// The vocabulary is unchanged — still `stake:` out, still a movement line, so
// conservation folds it structurally exactly like every other movement.
// The id class is measured, not assumed: all 270 marks in the live record match
// this shape (one slash, lowercase kebab both sides).
const MARK_ID = String.raw`[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*`;
// The amount is `[1-9]\d*`, not `\d+`, following GIFT_RE's precedent: a
// zero-stamp stake moves nothing and means nothing, so it should never parse as a
// lawful line. (The ballot's STAKE_RE does accept a `0`; that is live law with
// thousands of lines behind it and is not this draft's to tighten — noted in
// CALLS.md as an observed asymmetry rather than fixed in passing.)
const WORLD_STAKE_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · (\S+) → stake:world-mark\/(${MARK_ID}) · ([1-9]\d*) · via: (\S+)$`);
// Unstake is resident-initiated (`for: unstake`), which is what distinguishes it
// from the ballot's `for: close` — there the founder closes a window and every
// escrow returns at once; here the staker takes their own stamps back.
const WORLD_UNSTAKE_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · stake:world-mark\/(${MARK_ID}) → (\S+) · ([1-9]\d*) · for: unstake$`);
// A transfer is a plain handle→handle movement backed by a delivered `pays:`
// letter. It is checked AFTER stake/return so a `stake:…` target never matches
// here; its recipient is a bare handle, never `stake:…`.
const TRANSFER_RE = /^- (\d{4}-\d{2}-\d{2}) · (\S+) → (\S+) · (\d+) · via: mail:(\S+)$/;
// A void is arrow-free on purpose: it must NOT match the `<from> → <to> · <n> ·`
// movement shape the balance fold keys on, so it moves no stamps.
const VOID_RE = /^- (\d{4}-\d{2}-\d{2}) · void · mail:(\S+) · from (\S+) to (\S+) · (\d+) · (\S+)$/;
// A gift IS movement-shaped (MINT → handle) so conservation folds it structurally;
// it cannot collide with MINT_RE (no `(side)` suffix, `· by:` tail, n may exceed 1).
const GIFT_RE = /^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · for: gift:([a-z0-9][a-z0-9-]*) · by: (\S+)$/;
// FIRST-IDEA — the first-idea quest's witnessed form (founder-ruled 2026-08-30,
// the Think Tank): the town pays 5 once per HOUSEHOLD for its first published
// idea mark (class: idea, standing in the Think Tank). Movement-shaped
// (MINT → handle) so conservation folds it structurally; cannot collide with
// GIFT_RE (`for: first-idea:` and the receipt segment carries a `/`). NOT
// replay-derived, deliberately: the receipt is a WORLD mark id, and the replay
// must stay recomputable from this repo alone — so like a gift it is asserted
// in place, written by the office drain at crossings (writer holds the window,
// through 2026-09-30). The verifier holds what a signature cannot: amount
// exactly 5, authority the-town, the meep law, and once-per-household ever —
// so a forged-but-signed line fails verify instead of minting twice. The quest
// deliberately pays for the CROSSING OF THE THRESHOLD, not the quality or
// novelty of the thought (founder-ruled): whether an idea is taken up is the
// lifecycle's judgment — the Architect's desk at the blueprint bottleneck —
// never this mint's.
const FIRST_IDEA_RE = /^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · for: first-idea:([a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*) · by: (\S+)$/;
// A friendship mint (stamps-v3) is ALSO movement-shaped (MINT → handle · n), so
// conservation folds it structurally. It cannot collide with MINT_RE (n > 1 and
// `for: friendship:… (via …)` not `(sent|received|stake)`) or GIFT_RE
// (`for: friendship:` not `for: gift:`). Unlike a gift, it is a DERIVED mint —
// recomputable from the mail — so it rides the replay subsequence, not the
// in-place assertion lane. `<other>` is a handle, `<letter-id>` the crossing.
const FRIENDSHIP_RE = /^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · for: friendship:(\S+) \(via (\S+)\)$/;
// TOWN ISSUANCE — the town minting into its own treasury, every line naming why.
//
// THE TREASURY RUNS MINT-AT-DEMAND (Keemin-ruled 2026-08-10): resting state
// zero, income spent first, and a mint only for the shortfall. So this is not a
// one-off founding line — it is a repeating class, and its whole discipline is
// that N of them are legible as a series. `purpose` is what makes that series
// readable: an issuance with no stated purpose is exactly the unaccountable
// printing this class exists to prevent. The founding grant is simply its FIRST
// instance, not a special shape.
//
// Not a gift, and the difference is the reason this class exists rather than a
// wider `--gift`. A gift lands on a RESIDENT and the CLI refuses a handle with no
// WHITE_PAGES room; the treasury is not a resident and has no room. Widening the
// gift to allow roomless recipients would have removed a real guard from every
// gift for the sake of this one. This class keeps the gift strict and pays for
// its own looseness with laws a gift does not carry: the recipient must be the
// treasury handle DECLARED in ECONOMY-DIALS.json, and a purpose the dial names
// one-shot may appear exactly once.
//
// Movement-shaped (MINT → handle) so conservation folds it structurally, and it
// must keep conserving at N instances, not merely at one. It cannot collide with
// MINT_RE (no `(side)` suffix, n may exceed 1), GIFT_RE (`for: issuance:` not
// `for: gift:`) or FRIENDSHIP_RE. `note` is the terminal field and the only free
// text in the whole grammar; it may not contain the `·` field separator, or an
// author could forge trailing fields inside their own provenance text.
const ISSUANCE_RE = /^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · for: issuance:([a-z0-9][a-z0-9-]*) · by: (\S+) · note: ([^·\n]+)$/;
// ── THE FUNDING SEAM (keeping pots — S1) ─────────────────────────────────────
// Real dollars keep the town's lights on without ever buying judgment. A pot is
// a bounty file on the quest board (WHITE_PAGES/pot-<id>.json); residents stake
// stamps on it with the EXISTING stake verb (the pot as subject — the world-mark
// precedent: its own regex pair, the same movement vocabulary, so conservation
// folds it structurally); real payments land as witnessed pot-receipt rows; and
// a MANUAL founder-run epoch close (tools/epoch-close.mjs) burns the share of
// every stake that the epoch's witnessed dollars funded and splits that burn
// σ / (1−σ) into keeping mint (back to the stakers themselves, at par of their
// own burn) and holo (a soulbound record of contribution for the payers, by
// dollar share). The whole close is a pure function (deriveEpochClose below) that the
// verifier replays exactly — a wrong holo row fails LAWFUL the way a forged mint
// fails REPLAY.
//
// Ruled laws this grammar encodes — capture doc § 8, quoted where it rules
// (G:/Starstory/docs/2026-08-20/postmark-economy-ontology.md; Keemin, 2026-08-20):
//   - THERE IS NO DOLLAR↔STAMP RATE. Matching is priced against the pot's
//     POSTED NEED, never against the staked mass: "The town posts a funded need
//     ($N per epoch — e.g. EC2, $150/mo)" and at close "conversion runs pro-rata
//     to dollars actually paid; unmatched stakes RETURN (no counterparty, no
//     burn)". So funded_fraction = min(1, non-treasury dollars ÷ target), and
//     every open stake burns floor(funded_fraction · stake) — a fully funded pot
//     burns ALL of them however large the pile, a zero-dollar pot burns none.
//     The community prices money's power by how much it stakes; that is the
//     design's whole point (§7: the rate is an intention detector).
//   - THE σ LEG GOES BACK TO THE STAKERS, per staker, at par of their own burn:
//     "σ × pot mints back to the keepers as their own equity, at par of their
//     burn — permanent, verb-less, remembered". A "keeper" here is a
//     keeping-STAKER, not the pot's beneficiary.
//   - R12 (Keemin, 2026-08-21 afternoon) then names WHAT that leg is: "the σ leg
//     IS ORDINARY MINT, source-tagged (`minted · for: keeping:<pot>`), with NO
//     liquid coin (the coin was paid when the stake burned; the row stays
//     purpose-tagged so balance folds never hand liquid back). It COUNTS toward
//     the ρ base (holo cap base = earned primary mint + keeping mint). It stays
//     EXCLUDED from the genesis parity formula." So it is not a separate holding
//     class and not a fourth tense — and the noun "keeping-equity" is retired.
//     "No liquid coin" is rendered as SHAPE: the row is arrow-free, so
//     foldBalances and foldMintCount (both keyed on the movement shape) cannot
//     see it, and only readers that opt in — foldKeepingMint, the ρ base, the
//     ownership read — count it. Making it `MINT → staker` instead would have
//     handed liquid back, which is the one thing R12 forbids.
//   - D1 (same day): ownership is a derived READ — minted (all sources) + holo —
//     not a tense. There is no fifth tense node; nothing is stored for it.
//   - holo is SOULBOUND and verbless: it cannot stake, vote, pay, or transfer,
//     and is excluded from every tally. Enforced by SHAPE — the holo row is
//     arrow-free, so no balance/mint/stake fold can ever see one.
//   - holo cap: a household's holo ≤ ρ × its ρ base (ρ from the keeping dial;
//     constitutional ceiling 0.5), where R12 sets the base = earned primary mint
//     + keeping mint. Excess is clipped and mints nothing — the payer's holo
//     row still lands, reading 0, so the dollar stays remembered and settled.
//   - R1 floors EVERY leg — per-staker burn, per-staker keeping mint, per-payer
//     holo — and every remainder burns un-minted; the seam keeps the change.
//     "Total new equity = the matched burn, exactly. No double mint." 300 burned
//     at σ=½ is 150 + 150, never 600.
//   - self-stake exclusion is PAYER-SIDE ONLY: "a payer's own stakes are
//     excluded from their holo calculation. Sole-staker-sole-payer mints zero
//     holo". There is NO beneficiary-stake exclusion: a beneficiary's stakes
//     convert like anyone else's. (The 2026-08-20 sentence ended "— deed only";
//     that clause is dropped under the founder's 2026-08-26 ruling. Nothing it
//     described is lost: zero-minting dollars land as a holo row reading 0.)
//   - unmatched stakes return whole; treasury dollars (`the-town` paying its
//     own shortfall) fund nothing and mint nothing — "Treasury may cover any
//     shortfall — minting nothing"; dollars with no household mint nothing
//     either — their holo row reads 0.
//   - mint-at-entry: a receipt ref is unique forever; one dollar, one mint
//     chance — a re-recorded receipt bounces at the door AND fails verify.
const POT_ID_CLASS = String.raw`[a-z0-9][a-z0-9-]*`;
const EPOCH_CLASS = String.raw`\d{4}-\d{2}`;
export const KEEPING_RAILS = ['stripe', 'usdc', 'grant'];
// THE ONE-SPELLING LAW (2026-08-25, the mixed-case ref bug — office twin in
// src/usdc-witness.mjs): hex has two spellings and the ledger's uniqueness is
// an exact string compare, so `0xAB…` and `0xab…` would be two mint chances
// for one dollar. A ref carrying a 0x-hex tail canonicalizes to the chain's
// own lowercase BEFORE it is recorded or compared; refs without a hex tail
// (stripe ids are case-sensitive) pass through untouched.
export function canonicalRef(ref) {
  const s = String(ref ?? '');
  return s.replace(/0x[0-9a-fA-F]+$/, (h) => h.toLowerCase());
}
// The reserved direct-to-town pot: receipts only — no file, no stakes, no
// close, and so no holo ever mints against it. The founding family grant is
// its first receipt.
export const TREASURY_POT = 'treasury';
const POT_RECEIPT_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · pot-receipt · pot:(${POT_ID_CLASS}) · rail: (stripe|usdc|grant) · usd: ([1-9]\d*) · from: (\S+) · ref: (\S+)$`);
// THE CORRECTION ROW. ARROW-FREE for the same reason the receipt is: foldBalances
// and foldMintCount key on the raw movement shape `<from> → <to> · <n> ·`, and a
// correction moves nothing. `from X to Y` is void's own arrow-free wording
// (VOID_RE above), borrowed deliberately — this is the town's second row that
// speaks about an earlier row rather than about money moving.
//
// The reason field is `(\S+)`, exactly as void's is. void's reasons happen to be
// a closed set because a DERIVATION produces them; a correction is a human
// judgement about a real payer, so the grammar takes any single token and the
// vocabulary lives in the runbook rather than in the regex.
//
// There is no usd and no pot capture, and that is the enforcement, not an
// omission: a correction that tried to move dollars or repoint a pot could not
// be WRITTEN. Immutability by inexpressibility beats a rule someone must remember.
const POT_CORRECTION_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · pot-correction · ref: (\S+) · from (\S+) to (\S+) · (\S+) · by: (\S+)$`);
const POT_STAKE_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · (\S+) → stake:pot\/(${POT_ID_CLASS}) · ([1-9]\d*) · via: (\S+)$`);
const POT_RETURN_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · stake:pot\/(${POT_ID_CLASS}) → (\S+) · ([1-9]\d*) · for: pot-return:(${EPOCH_CLASS})$`);
const KEEPING_BURN_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · stake:pot\/(${POT_ID_CLASS}) → BURN · ([1-9]\d*) · for: keeping:(${EPOCH_CLASS}) · staker: (\S+)$`);
// THE KEEPING MINT ROW (R12). The word is `minted` and the tag is
// `for: keeping:<pot>`, exactly as the ruling writes it — this row IS mint, and
// the ledger says so in the ruling's own vocabulary.
//
// ARROW-FREE, and that is R12's "NO liquid coin" rendered as shape rather than
// as a rule someone has to remember. foldBalances and foldMintCount both key on
// the raw movement shape `<from> → <to> · <n> ·`; a `MINT → staker` row would
// have been swept into BOTH — spendable stamps handed back for a coin already
// paid when the stake burned. Arrow-free makes that structurally impossible, and
// the readers that SHOULD count it (foldKeepingMint, the ρ base, the door's
// ownership read) opt in by name. Every future fold inherits the safe default.
//
// The RETIRED forms are unknown grammar, and unknown grammar fails REPLAY in
// walkLedger — so both the old `keeping-equity ·` row and an arrow-bearing
// `MINT → <staker> · n · for: keeping:<pot>` smuggle fail verification rather
// than parsing as something plausible. (The smuggle is the dangerous one: the
// two raw folds WOULD see its arrow, so it must never be lawful.)
const KEEPING_MINT_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · minted · (\S+) · ([1-9]\d*) · for: keeping:(${POT_ID_CLASS}) · epoch:(${EPOCH_CLASS})$`);
// The holo count is `\d+`, not `[1-9]\d*`: 0 IS a lawful holo row. A close
// writes one per receipt it settles, and the ones that mint nothing are
// precisely the ones the record must not forget — treasury, outside, ρ-capped,
// sole-staker-sole-payer. The zero row is also the ONLY thing marking that
// receipt's ref as spent, so refusing it would let every zero-minting dollar be
// counted and re-counted at every later close.
const HOLO_MINT_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · holo · (\S+) · (\d+) · pot:(${POT_ID_CLASS}) · epoch:(${EPOCH_CLASS}) · ref: (\S+)$`);

export function classifyEntry(canonical) {
  let m;
  if ((m = RULES_RE.exec(canonical)))
    return { kind: 'rules', date: m[1], rules: m[2], meeps: m[3] ? m[3].split(',') : [], friendship: m[4] ? parseLadder(m[4]) : null };
  if ((m = REGISTRY_RE.exec(canonical)))
    return { kind: 'registry', date: m[1], handle: m[2], key: m[3] };
  if ((m = MINT_RE.exec(canonical))) {
    if (m[4] === 'stake')
      return { kind: 'vote-mint', date: m[1], handle: m[2], topic: m[3].replace(/^vote:/, '') };
    return { kind: 'mint', date: m[1], handle: m[2], cause: m[3], side: m[4], provisional: !!m[5] };
  }
  if ((m = STAKE_RE.exec(canonical)))
    return { kind: 'stake', date: m[1], handle: m[2], topic: m[3], candidate: m[4], n: Number(m[5]), via: m[6] };
  if ((m = RETURN_RE.exec(canonical)))
    return { kind: 'return', date: m[1], topic: m[2], candidate: m[3], handle: m[4], n: Number(m[5]) };
  // BEFORE the transfer check, and that ordering is load-bearing: a world-mark
  // stake carried by a letter reads `via: mail:<id>`, which TRANSFER_RE would
  // otherwise match — it would fold as a handle→handle payment to an account
  // named `stake:world-mark/...`. Same reason the ballot's pair sits above it.
  if ((m = WORLD_STAKE_RE.exec(canonical)))
    return { kind: 'world-stake', date: m[1], handle: m[2], mark: m[3], n: Number(m[4]), via: m[5] };
  if ((m = WORLD_UNSTAKE_RE.exec(canonical)))
    return { kind: 'world-unstake', date: m[1], mark: m[2], handle: m[3], n: Number(m[4]) };
  // Keeping-pot movements sit above TRANSFER for the same reason the world pair
  // does: a pot stake carried by a letter reads `via: mail:<id>`, which
  // TRANSFER_RE would otherwise claim as a payment to an account named
  // `stake:pot/...`. The arrow-free trio (receipt/keeping-mint/holo)
  // can collide with nothing that moves, so their order only needs to precede
  // `unknown`.
  if ((m = POT_STAKE_RE.exec(canonical)))
    return { kind: 'pot-stake', date: m[1], handle: m[2], pot: m[3], n: Number(m[4]), via: m[5] };
  if ((m = POT_RETURN_RE.exec(canonical)))
    return { kind: 'pot-return', date: m[1], pot: m[2], handle: m[3], n: Number(m[4]), epoch: m[5] };
  if ((m = KEEPING_BURN_RE.exec(canonical)))
    return { kind: 'keeping-burn', date: m[1], pot: m[2], n: Number(m[3]), epoch: m[4], handle: m[5] };
  if ((m = KEEPING_MINT_RE.exec(canonical)))
    return { kind: 'keeping-mint', date: m[1], handle: m[2], n: Number(m[3]), pot: m[4], epoch: m[5] };
  if ((m = POT_RECEIPT_RE.exec(canonical)))
    return { kind: 'pot-receipt', date: m[1], pot: m[2], rail: m[3], usd: Number(m[4]), from: m[5], ref: m[6] };
  if ((m = POT_CORRECTION_RE.exec(canonical)))
    return { kind: 'pot-correction', date: m[1], ref: m[2], from: m[3], to: m[4], reason: m[5], by: m[6] };
  if ((m = HOLO_MINT_RE.exec(canonical)))
    return { kind: 'holo', date: m[1], handle: m[2], n: Number(m[3]), pot: m[4], epoch: m[5], ref: m[6] };
  if ((m = VOID_RE.exec(canonical)))
    return { kind: 'void', date: m[1], id: m[2], from: m[3], to: m[4], n: Number(m[5]), reason: m[6] };
  if ((m = GIFT_RE.exec(canonical)))
    return { kind: 'gift', date: m[1], handle: m[2], n: Number(m[3]), slug: m[4], by: m[5] };
  if ((m = FIRST_IDEA_RE.exec(canonical)))
    return { kind: 'first-idea', date: m[1], handle: m[2], n: Number(m[3]), mark: m[4], by: m[5] };
  if ((m = ISSUANCE_RE.exec(canonical)))
    return { kind: 'town-issuance', date: m[1], handle: m[2], n: Number(m[3]), purpose: m[4], by: m[5], note: m[6] };
  if ((m = FRIENDSHIP_RE.exec(canonical)))
    return { kind: 'friendship', date: m[1], handle: m[2], n: Number(m[3]), friendWith: m[4], cause: m[5] };
  if ((m = TRANSFER_RE.exec(canonical)))
    return { kind: 'transfer', date: m[1], from: m[2], to: m[3], n: Number(m[4]), id: m[5] };
  return { kind: 'unknown' };
}

// laws + registry revisions recorded in the ledger, in order
export function parseLaws(entries) {
  const laws = [];      // [{date, rules, meeps:Set}]
  const revisions = []; // [{date, handle, key}]
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'rules') laws.push({ date: c.date, rules: c.rules, meeps: new Set(c.meeps), friendship: c.friendship ?? null });
    if (c.kind === 'registry') revisions.push({ date: c.date, handle: c.handle, key: c.key });
  }
  return { laws, revisions };
}

// ── the pure mint function (law-span-aware) ──────────────────────────────────

export function deriveMints(deliveries, households, { laws = [], revisions = [] } = {}) {
  const mints = [];
  const seenPair = new Set();   // `${day}|sent|${sender}|${recipient}` — unique-address-per-day
  const dayCount = new Map();   // `${day}|sent|${householdKey}` -> n — the caps

  const hh = (handle, date) => {
    let rec = households.get(handle) ?? { key: `solo:${handle}`, provisional: true };
    for (const r of revisions) if (r.handle === handle && r.date <= date) rec = { key: r.key, provisional: false };
    return rec;
  };
  const lawAt = (date) => {
    let active = { rules: RULES_V1, meeps: new Set() };
    for (const l of laws) if (l.date <= date) active = l;
    return active;
  };

  const trySide = (side, handle, other, d) => {
    if (d.from === d.to) return; // self-mail mints zero (engine ruling, v1)
    if (lawAt(d.date).meeps.has(handle)) return; // meeps mint nothing (v2); other side unaffected
    const pairKey = `${d.date}|${side}|${handle}|${other}`;
    if (seenPair.has(pairKey)) return;
    seenPair.add(pairKey);
    const h = hh(handle, d.date);
    const capKey = `${d.date}|${side}|${h.key}`;
    const n = dayCount.get(capKey) ?? 0;
    const cap = side === 'sent' ? CAP_SENDS : CAP_RECEIVES;
    if (n >= cap) return;
    dayCount.set(capKey, n + 1);
    // `other` is the correspondent this mint was earned WITH. Carried for the
    // quest cards ("who already counted today"), never for the ledger — mintLine
    // builds from named fields, so this cannot change a ledger byte. `kind` lets
    // the combined derived stream tell a correspondence mint from a friendship one.
    mints.push({ kind: 'mint', date: d.date, handle, side, other, cause: d.id, provisional: h.provisional });
  };

  for (const d of deliveries) {
    trySide('sent', d.from, d.to, d);
    trySide('received', d.to, d.from, d);
  }
  return mints;
}

// ── the fourth earning rule: budding-friendship milestone (stamps-v3) ─────────
// A per-pair ordered fold over deliveries. Forward-only is structural: only the
// stamps-v3 law's `friendship:` ladder and date drive it, so with no v3 law
// recorded this returns nothing and the engine is inert on the pre-law ledger —
// which is exactly what leaves the pre-law replay byte-identical (gold plan
// postmark-budding-friendship § the parity gate). Reuses the deliveries parsed
// upstream (CRLF-safe); it never re-parses the ledger.
//
// foldPairFriendships is the ONE crossing authority — both the mint
// (deriveFriendshipMints) and the display fold (quest-progress foldFriendships)
// read it, so the "both directions reached rung R" logic has a single home.
// Per pair {a,b} (a<b lexicographically): fwd = a→b deliveries, rev = b→a, both
// counted only on/after the law date. A rung crosses the first time min(fwd,rev)
// steps up to the rung's threshold (min moves by ≤1 per delivery, so each rung
// crosses exactly once, ever). Gates are read AT the crossing delivery: both
// sides non-meep AND cross-household. Both sides qualify together or neither does.
export function foldPairFriendships(deliveries, households, { laws = [], revisions = [] } = {}) {
  const friendshipLaws = laws.filter((l) => l.friendship && l.friendship.length)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!friendshipLaws.length) return { active: false, startDate: null, ladder: [], pairs: new Map() };
  const active = friendshipLaws[0]; // v3; extending the ladder later is a deferred, dated event (held 50/100 rungs)
  const startDate = active.date;
  const ladder = active.friendship;
  const isMeep = meepChecker(laws);
  const hh = (handle, date) => {
    let key = households.get(handle)?.key ?? `solo:${handle}`;
    for (const r of revisions) if (r.handle === handle && r.date <= date) key = r.key;
    return key;
  };
  const pairs = new Map(); // "a|b" -> { a, b, fwd, rev, min, crossings:[{threshold,reward,date,viaId,qualified}] }
  for (const d of deliveries) {
    if (d.date < startDate || d.from === d.to) continue; // forward-only; self-mail is not a correspondence
    const [a, b] = [d.from, d.to].sort();
    const key = `${a}|${b}`;
    let st = pairs.get(key);
    if (!st) { st = { a, b, fwd: 0, rev: 0, min: 0, crossings: [] }; pairs.set(key, st); }
    if (d.from === a) st.fwd++; else st.rev++;
    const prevMin = st.min;
    const newMin = Math.min(st.fwd, st.rev);
    st.min = newMin;
    if (newMin === prevMin) continue; // this delivery lengthened the longer side only — no new floor
    const rung = ladder.find((r) => r.threshold === newMin);
    if (!rung) continue;
    const qualified = !isMeep(a, d.date) && !isMeep(b, d.date) && hh(a, d.date) !== hh(b, d.date);
    st.crossings.push({ threshold: rung.threshold, reward: rung.reward, date: d.date, viaId: d.id, qualified });
  }
  return { active: true, startDate, ladder, pairs };
}

// The mint objects the fourth rule produces: two per qualified rung crossing
// (both sides, same reward, same crossing letter), smaller handle first. Sorted
// by (date, cause, handle) so the order is canonical; combineDerived re-buckets
// them by delivery id, so this order only settles the within-crossing pair order.
export function deriveFriendshipMints(deliveries, households, opts = {}) {
  const { pairs } = foldPairFriendships(deliveries, households, opts);
  const out = [];
  for (const st of pairs.values()) {
    for (const c of st.crossings) {
      if (!c.qualified) continue;
      out.push({ kind: 'friendship', date: c.date, handle: st.a, n: c.reward, friendWith: st.b, cause: c.viaId });
      out.push({ kind: 'friendship', date: c.date, handle: st.b, n: c.reward, friendWith: st.a, cause: c.viaId });
    }
  }
  out.sort((x, y) => x.date.localeCompare(y.date) || x.cause.localeCompare(y.cause) || x.handle.localeCompare(y.handle));
  return out;
}

// The full derived-mint stream in ledger order: for each delivery, its
// correspondence mints (deriveMints order) then its friendship mints. This is
// the single subsequence the recorded ledger's mint + friendship lines must
// match, in order — walkLedger, the verifier, --append and --derive all key on it.
export function combineDerived(deliveries, corrMints, friendshipMints) {
  const byCause = (arr) => {
    const m = new Map();
    for (const x of arr) { if (!m.has(x.cause)) m.set(x.cause, []); m.get(x.cause).push(x); }
    return m;
  };
  const corr = byCause(corrMints);
  const friend = byCause(friendshipMints);
  const out = [];
  for (const d of deliveries) {
    for (const m of (corr.get(d.id) ?? [])) out.push(m);
    for (const m of (friend.get(d.id) ?? [])) out.push(m);
  }
  return out;
}

// ── settlement (`pays:`) — the ONE decision, shared by derive/append/verify ──
// A pays delivery becomes exactly one settlement line: a transfer, or a void
// with a named reason. The decision is a pure function of (the delivery, the
// sender's balance at that instant, whether either party is a meep). Both the
// mint's append path and the verifier's replay call this same function against
// their own balance fold — there is no second copy of the law.
//
//   - self-pay (from == to)              → void: self-pay   (paying yourself is
//       not correspondence; an explicit `pays:` request is refused LOUDLY — the
//       absence of a mint on self-mail is silence, a void is a spoken "no")
//   - either party a meep at the date    → void: meep-party (meeps hold nothing)
//   - sender balance < N                 → void: insufficient-balance
//   - otherwise                          → transfer
export function settlementDecision(d, senderBalance, isMeep) {
  const base = { date: d.date, from: d.from, to: d.to, n: d.pays, id: d.id };
  if (d.from === d.to) return { kind: 'void', ...base, reason: 'self-pay' };
  if (isMeep(d.from) || isMeep(d.to)) return { kind: 'void', ...base, reason: 'meep-party' };
  if (senderBalance < d.pays) return { kind: 'void', ...base, reason: 'insufficient-balance' };
  return { kind: 'transfer', ...base };
}

export function meepChecker(laws) {
  const lawAt = (date) => {
    let active = { rules: RULES_V1, meeps: new Set() };
    for (const l of laws) if (l.date <= date) active = l;
    return active;
  };
  return (handle, date) => lawAt(date).meeps.has(handle);
}

// ── the transfer derivation (the APPEND/PREVIEW path) ────────────────────────
// Emit the ordered transfer/void objects a `pays:` letter set produces, for the
// mint to write and `--derive` to preview. ORDER-AWARE by construction: recorded
// stake/return/vote-mint movements fold into the running balance first — they
// are all causally prior to any settlement the mint is about to append (the mint
// appends at the tail, after every line recorded so far) — then each delivery's
// own mints land before its own payment, in delivery order. The verifier does
// NOT re-run this; it replays the recorded settlements in ledger order (see
// stamp-verify.mjs), which is the same fold from the other side. This function
// and that replay share `settlementDecision`, so they cannot drift.
export function deriveTransfers(deliveries, households, { laws = [], revisions = [] } = {}, assertionEntries = []) {
  const mints = deriveMints(deliveries, households, { laws, revisions });
  const friendMints = deriveFriendshipMints(deliveries, households, { laws, revisions });
  // credits a delivery lands (its own mints) BEFORE its settlement, by amount:
  // correspondence mints are 1, a friendship mint is its rung reward. All are
  // added before the settlement decision, so order among them is irrelevant.
  const creditsById = new Map();
  for (const m of mints) {
    if (!creditsById.has(m.cause)) creditsById.set(m.cause, []);
    creditsById.get(m.cause).push({ handle: m.handle, amount: 1 });
  }
  for (const m of friendMints) {
    if (!creditsById.has(m.cause)) creditsById.set(m.cause, []);
    creditsById.get(m.cause).push({ handle: m.handle, amount: m.n });
  }
  const bal = new Map();
  const add = (acct, n) => bal.set(acct, (bal.get(acct) ?? 0) + n);
  for (const e of assertionEntries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'stake') add(c.handle, -c.n);        // staked out to escrow
    else if (c.kind === 'return') add(c.handle, c.n);   // escrow returned on close
    else if (c.kind === 'vote-mint') add(c.handle, 1);  // +1 for casting
    else if (c.kind === 'gift') add(c.handle, c.n);     // founder gift — recorded before any settlement we'd append, so it funds later pays
    else if (c.kind === 'first-idea') add(c.handle, c.n); // first-idea quest mint — same in-place assertion class as a gift
    else if (c.kind === 'pot-stake') add(c.handle, -c.n);      // keeping escrow out
    else if (c.kind === 'pot-return') add(c.handle, c.n);      // unmatched stakes back at close
    // keeping-burn drains the escrow account, never a handle; the arrow-free
    // trio (keeping-mint/holo/receipt) moves nothing at all — R12's
    // keeping mint carries NO liquid coin, so it can never fund a later `pays:`
    // recorded mints/transfers are re-derived here — never folded from the record
  }
  const isMeep = meepChecker(laws);
  const out = [];
  for (const d of deliveries) {
    for (const cr of (creditsById.get(d.id) ?? [])) add(cr.handle, cr.amount); // this letter's mints land first
    if (d.pays == null) continue;
    const decision = settlementDecision(d, bal.get(d.from) ?? 0, (h) => isMeep(h, d.date));
    if (decision.kind === 'transfer') { add(d.from, -d.pays); add(d.to, d.pays); }
    out.push(decision);
  }
  return out;
}

// ── line builders ────────────────────────────────────────────────────────────

export const mintLine = (m) =>
  `- ${m.date} · MINT → ${m.handle} · 1 · for: ${m.cause} (${m.side})${m.provisional ? ' · provisional' : ''}`;

export const friendshipMintLine = (m) =>
  `- ${m.date} · MINT → ${m.handle} · ${m.n} · for: friendship:${m.friendWith} (via ${m.cause})`;

// Correspondence mints and friendship mints are both DERIVED mints (recomputable
// from mail) and share the walk/append/derive path; this renders either by kind.
export const derivedLine = (m) => (m.kind === 'friendship' ? friendshipMintLine(m) : mintLine(m));

export const rulesLine = (date) => `- ${date} · rules: ${RULES_V1}`;

export const rulesV2Line = (date, meeps) =>
  `- ${date} · rules: stamps-v2 · meeps: ${[...meeps].sort().join(',')}`;

// stamps-v3 restates the meep set (lawAt returns the single latest law, so the
// set must carry forward or meeps would resume minting) AND opens the friendship
// ladder. `ladderSpec` is a canonical "t:r,t:r" string (serializeLadder).
export const rulesV3Line = (date, meeps, ladderSpec) =>
  `- ${date} · rules: stamps-v3 · meeps: ${[...meeps].sort().join(',')} · friendship: ${ladderSpec}`;

export const registryLine = (date, handle, key) => `- ${date} · registry: ${handle} = ${key}`;

export const stakeLine = ({ date, handle, topic, candidate, n, via }) =>
  `- ${date} · ${handle} → stake:${topic}/${candidate} · ${n} · via: ${via}`;

export const returnLine = ({ date, topic, candidate, handle, n }) =>
  `- ${date} · stake:${topic}/${candidate} → ${handle} · ${n} · for: close`;

// world-mark stakes: the same movement shape, a path-shaped target, and an
// unstake that names the resident's own act rather than a window closing.
export const worldStakeLine = ({ date, handle, mark, n, via }) =>
  `- ${date} · ${handle} → stake:world-mark/${mark} · ${n} · via: ${via}`;

export const worldUnstakeLine = ({ date, mark, handle, n }) =>
  `- ${date} · stake:world-mark/${mark} → ${handle} · ${n} · for: unstake`;

export const voteMintLine = ({ date, handle, topic }) =>
  `- ${date} · MINT → ${handle} · 1 · for: vote:${topic} (stake)`;

export const transferLine = ({ date, from, to, n, id }) =>
  `- ${date} · ${from} → ${to} · ${n} · via: mail:${id}`;

export const voidLine = ({ date, id, from, to, n, reason }) =>
  `- ${date} · void · mail:${id} · from ${from} to ${to} · ${n} · ${reason}`;

export const giftLine = ({ date, handle, n, slug, by }) =>
  `- ${date} · MINT → ${handle} · ${n} · for: gift:${slug} · by: ${by}`;

export const firstIdeaLine = ({ date, handle, mark }) =>
  `- ${date} · MINT → ${handle} · 5 · for: first-idea:${mark} · by: the-town`;

// A town-issuance line. `note` is the provenance wording, supplied at the door;
// it is the terminal free-text field, so the separator guard here is a forgery
// guard, not a formatting nicety — a `·` inside the note would let its author
// append fields the pen never signed for.
export const ISSUANCE_PURPOSE_RE = /^[a-z0-9][a-z0-9-]*$/;
export const townIssuanceLine = ({ date, handle, n, purpose, by, note }) => {
  if (!ISSUANCE_PURPOSE_RE.test(String(purpose ?? '')))
    throw new Error(`town issuance: purpose must be kebab-case ([a-z0-9-]), got ${JSON.stringify(purpose)}`);
  const text = String(note ?? '').trim();
  if (!text) throw new Error('town issuance: a provenance note is required — under mint-at-demand, an issuance with no stated reason is exactly the unaccountable printing this class exists to prevent');
  if (text.includes('·') || /[\r\n]/.test(text))
    throw new Error(`town issuance: the provenance note may not contain the "·" field separator or a newline — it is the terminal field, and a separator inside it would forge trailing fields`);
  return `- ${date} · MINT → ${handle} · ${n} · for: issuance:${purpose} · by: ${by} · note: ${text}`;
};

// The declared treasury. The money law's numbers live in ECONOMY-DIALS.json, not
// buried in code (that file's own standing rule), so the handle the town may
// issue to is read from there. No dial, no issuance: an undeclared treasury is
// not a default to guess at.
//
// `once_purposes` is the narrow uniqueness law. Mint-at-demand means issuance
// REPEATS, so a blanket one-per-purpose rule would break the ordinary case (a
// town cannot mint twice for the same recurring need). Only purposes the dial
// names one-shot are unique — the founding grant among them, because a founding
// act happens once. Declaring it in the dial rather than hardcoding it means a
// later era can found itself without a code change, and means the list of things
// that may only happen once is readable by residents, not buried here.
export function townIssuanceDial(repo) {
  const path = join(repo, 'ECONOMY-DIALS.json');
  if (!existsSync(path)) return null;
  try {
    const d = JSON.parse(readFileSync(path, 'utf8'))?.law_side?.town_issuance ?? null;
    if (!d || typeof d.treasury_handle !== 'string' || !d.treasury_handle) return null;
    return {
      treasury_handle: d.treasury_handle,
      once_purposes: new Set(Array.isArray(d.once_purposes) ? d.once_purposes : []),
    };
  } catch { return null; }
}

// One derived economy line for a transfer-or-void object (from deriveTransfers).
export const economyLine = (t) => (t.kind === 'void' ? voidLine(t) : transferLine(t));

// ── the funding seam's line builders ─────────────────────────────────────────

export const potReceiptLine = ({ date, pot, rail, usd, from, ref }) =>
  `- ${date} · pot-receipt · pot:${pot} · rail: ${rail} · usd: ${usd} · from: ${from} · ref: ${ref}`;

export const potCorrectionLine = ({ date, ref, from, to, reason, by }) =>
  `- ${date} · pot-correction · ref: ${ref} · from ${from} to ${to} · ${reason} · by: ${by}`;

export const potStakeLine = ({ date, handle, pot, n, via }) =>
  `- ${date} · ${handle} → stake:pot/${pot} · ${n} · via: ${via}`;

export const potReturnLine = ({ date, pot, handle, n, epoch }) =>
  `- ${date} · stake:pot/${pot} → ${handle} · ${n} · for: pot-return:${epoch}`;

export const keepingBurnLine = ({ date, pot, n, epoch, handle }) =>
  `- ${date} · stake:pot/${pot} → BURN · ${n} · for: keeping:${epoch} · staker: ${handle}`;

export const keepingMintLine = ({ date, handle, n, pot, epoch }) =>
  `- ${date} · minted · ${handle} · ${n} · for: keeping:${pot} · epoch:${epoch}`;

export const holoMintLine = ({ date, handle, n, pot, epoch, ref }) =>
  `- ${date} · holo · ${handle} · ${n} · pot:${pot} · epoch:${epoch} · ref: ${ref}`;

// One canonical line for any close-row object (from deriveEpochClose.rows).
export const keepingLine = (r) => {
  switch (r.kind) {
    case 'pot-return': return potReturnLine(r);
    case 'keeping-burn': return keepingBurnLine(r);
    case 'keeping-mint': return keepingMintLine(r);
    case 'holo': return holoMintLine(r);
    default: throw new Error(`not a keeping row kind: ${r.kind}`);
  }
};

// ── stamp-ledger parsing + seal chain ────────────────────────────────────────

export function parseStampLedger(text) {
  // returns [{ canonical, sig, raw }] for every entry line, in order
  const out = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!raw.startsWith('- ')) continue;
    const m = /^(.*) · sig: (\S+)$/.exec(raw);
    if (m) out.push({ canonical: m[1], sig: m[2], raw });
    else out.push({ canonical: raw, sig: null, raw }); // tolerated only by the verifier, which will flag it
  }
  return out;
}

export function sealChain(canonicals) {
  let seal = sha256hex(GENESIS_SEAL_SEED);
  const seals = [];
  for (const c of canonicals) { seal = sha256hex(seal + c); seals.push(seal); }
  return seals;
}

export function signSeal(sealHex, privateKeyPem) {
  const key = createPrivateKey(privateKeyPem);
  return edSign(null, Buffer.from(sealHex, 'utf8'), key).toString('base64url');
}

// ── balances (the pure fold) ─────────────────────────────────────────────────

export function foldBalances(entries) {
  const bal = new Map(); // account -> n ; MINT, BURN and stake:* are accounts too
  const add = (acct, n) => bal.set(acct, (bal.get(acct) ?? 0) + n);
  for (const e of entries) {
    const m = /^- \d{4}-\d{2}-\d{2} · (\S+) → (\S+) · (\d+) · /.exec(e.canonical);
    if (!m) continue; // markers
    const [, from, to, nStr] = m; const n = Number(nStr);
    add(from, -n); add(to, n);
  }
  return bal;
}

// ── the three tenses (quest gold Phase 1) ────────────────────────────────────
// foldBalances above is the LIQUID balance: a stake moves stamps to the stake:*
// escrow account, so they leave the handle's balance and only return on close.
// Two more pure folds over the same sealed ledger name the other two tenses.
// Nothing new is stored — like foldBalances, these are recomputable any time.
//
//   liquid   = foldBalances(h)            — spendable now (the existing `stamps`)
//   staked   = foldStaked(h)              — locked in open stakes
//   assets   = liquid + staked            — what you currently HOLD
//   mint_count = foldMintCount(h)         — what you ever GENERATED (equity)
//
// Verified on the live ledger (2026-07-20): lysander liquid 2, staked 13,
// mint_count 15 → liquid = mint_count − staked, assets = liquid + staked = 15.

// Cumulative stamps minted TO a handle, ever — the equity / attention-generated
// number. Every `MINT → handle` line sums in: correspondence mints, vote-mints,
// AND founder gifts (all sourced from the MINT account, by construction).
// Nothing subtracts, so it is monotonic — it never drops when stamps are spent,
// staked, or transferred away. That is exactly what distinguishes it from a
// balance.
export function foldMintCount(entries) {
  const mc = new Map(); // handle -> cumulative minted
  for (const e of entries) {
    const m = /^- \d{4}-\d{2}-\d{2} · (\S+) → (\S+) · (\d+) · /.exec(e.canonical);
    if (!m) continue; // markers
    if (m[1] === 'MINT') mc.set(m[2], (mc.get(m[2]) ?? 0) + Number(m[3]));
  }
  return mc;
}

// Stamps a handle currently has locked in OPEN stakes (escrow): staked out minus
// returned-on-close. Votes today, quest pots later. Because a stake moves stamps
// into the stake:* account, these are NOT counted in foldBalances — foldBalances
// is already the liquid/spendable balance, and assets = liquid + staked. A handle
// with no open stake simply never appears here (absent == 0).
export function foldStaked(entries) {
  const st = new Map(); // handle -> stamps in open stakes
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    // World-mark stakes belong in this fold too, and NOT as a nicety: foldBalances
    // already moves their stamps out of the handle's liquid balance (it keys on the
    // generic movement shape, so it needed no change at all). If `staked` did not
    // count them, `assets = liquid + staked` would quietly under-report by exactly
    // the amount escrowed on marks — the three-tenses invariant broken with every
    // number still looking plausible. Tested directly.
    // Keeping stakes are the third member of the staked tense, for the same
    // reason world-mark stakes are: foldBalances already moved their stamps to
    // escrow, so leaving them out would break assets = liquid + staked. A
    // keeping-burn LEAVES the staked tense without returning to liquid — the
    // stamps are gone (that is the seam's whole trade) — so it decrements here
    // and nowhere else; the staker's mint_count never moves.
    if (c.kind === 'stake' || c.kind === 'world-stake' || c.kind === 'pot-stake') st.set(c.handle, (st.get(c.handle) ?? 0) + c.n);
    else if (c.kind === 'return' || c.kind === 'world-unstake' || c.kind === 'pot-return' || c.kind === 'keeping-burn') st.set(c.handle, (st.get(c.handle) ?? 0) - c.n);
  }
  return st;
}

// Open escrow per world-mark: stakes minus unstakes. A mark absent here has none.
// This is the stable signed input to the read-side weight derive: it cannot move
// when a resident's liquid balance moves — only when someone stakes or unstakes
// on purpose. The derive adds the ruled unique-household breadth term.
export function foldWorldMarkEscrow(entries) {
  const esc = new Map(); // mark id -> open escrow
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'world-stake') esc.set(c.mark, (esc.get(c.mark) ?? 0) + c.n);
    else if (c.kind === 'world-unstake') esc.set(c.mark, (esc.get(c.mark) ?? 0) - c.n);
  }
  for (const [k, v] of esc) if (v === 0) esc.delete(k); // absent == zero, one representation
  return esc;
}

// Per (mark, handle) open escrow — who has stamps on what, the read an unstake
// must clip against so a resident can never take out more than they put in, and
// never another resident's stake.
export function foldWorldMarkPositions(entries) {
  const pos = new Map(); // `${mark}|${handle}` -> open escrow
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'world-stake' || c.kind === 'world-unstake') {
      const k = `${c.mark}|${c.handle}`;
      pos.set(k, (pos.get(k) ?? 0) + (c.kind === 'world-stake' ? c.n : -c.n));
    }
  }
  for (const [k, v] of pos) if (v === 0) pos.delete(k);
  return pos;
}

// ── the funding seam's folds (all pure, all recomputable) ────────────────────

// Per (pot, handle) open keeping escrow: stakes minus returns minus burns.
export function foldPotPositions(entries) {
  const pos = new Map(); // `${pot}|${handle}` -> open escrow
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'pot-stake' || c.kind === 'pot-return' || c.kind === 'keeping-burn') {
      const k = `${c.pot}|${c.handle}`;
      pos.set(k, (pos.get(k) ?? 0) + (c.kind === 'pot-stake' ? c.n : -c.n));
    }
  }
  for (const [k, v] of pos) if (v === 0) pos.delete(k);
  return pos;
}

// Every pot-receipt in ledger order, and the refs a close has already settled.
// A receipt whose ref a holo row names has had its one mint chance — this is
// mint-at-entry, and the holo row is where it is written down. A close emits
// one holo row per receipt it settles WHATEVER the count (0 included), so the
// dollars that mint nothing are marked spent exactly like the ones that do.
export function foldPotReceipts(entries) {
  const receipts = []; // [{ date, pot, rail, usd, from, ref }]
  const settled = new Set(); // refs a close's holo row has already answered for
  const proposed = new Map(); // ref -> the correction that wins for it
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'pot-receipt') receipts.push(c);
    else if (c.kind === 'holo') settled.add(c.ref);
    else if (c.kind === 'pot-correction') {
      // LATEST DATED WINS, and a tie goes to the later row. A correction can
      // itself be wrong, so the town must be able to correct a correction; the
      // append-only ledger says which is current by supersession, never by
      // rewriting. Ledger order breaks a same-day tie because ledger order is
      // already the town's tiebreak everywhere else.
      const held = proposed.get(c.ref);
      if (!held || c.date >= held.date) proposed.set(c.ref, c);
    }
  }

  // Applied in a SECOND pass, on purpose: a correction may legally appear before
  // the receipt it names (the ledger is append-only, not sorted), and reading it
  // in one pass would silently drop those.
  const corrections = [];
  for (const r of receipts) {
    const k = proposed.get(r.ref);
    if (!k) continue;

    // THE CORRECTION MUST MATCH THE ROW IT CORRECTS. It names the old hand
    // verbatim precisely so this can be checked. A correction whose `from` is
    // not what the receipt currently says is about a state that does not exist
    // — a typo in the correction, or one already superseded — and applying it
    // would be the engine guessing at somebody's deed. Refused, and NAMED:
    // silence here would be a correction that looks applied and is not.
    if (k.from !== r.from) {
      corrections.push({ ref: r.ref, applied: false, refused: 'stale-from', says: k.from, receipt: r.from, correction: k });
      continue;
    }

    r.corrected_from = r.from;
    r.from = k.to;
    r.correction = { date: k.date, reason: k.reason, by: k.by, from: k.from, to: k.to };

    // A REF WHOSE MINT CHANCE IS ALREADY SPENT. The hand is corrected here —
    // every reader should show who really paid — but the holo row a close
    // already wrote is NOT touched and NOT re-derived. "one dollar, one mint
    // chance" is the anti-double-mint law itself, and moving holo to a new hand
    // after the close is a founder ruling about that law, not something a fold
    // may decide quietly. So it is flagged BY NAME and left alone.
    if (settled.has(r.ref)) r.correction.after_close = true;

    corrections.push({ ref: r.ref, applied: true, after_close: settled.has(r.ref), correction: k });
  }

  // A correction naming a ref no receipt carries is surfaced rather than
  // dropped — it is the shape a mistyped ref takes, and a silent no-op would
  // read to the operator exactly like a correction that worked.
  const known = new Set(receipts.map((r) => r.ref));
  for (const [ref, k] of proposed)
    if (!known.has(ref)) corrections.push({ ref, applied: false, refused: 'no-such-receipt', correction: k });

  return { receipts, settled, corrections };
}

// Soulbound holo per handle — the ONE reader of holo rows. Deliberately not a
// balance: nothing spends it, nothing stakes it, nothing folds it in anywhere
// else. holoHeldByHousehold aggregates it the way the ρ-cap counts it.
export function foldHolo(entries) {
  const h = new Map(); // handle -> holo
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'holo') h.set(c.handle, (h.get(c.handle) ?? 0) + c.n);
  }
  return h;
}

// Keeping mint per handle — the ONE reader of `minted · for: keeping:<pot>`
// rows. Arrow-free means foldBalances and foldMintCount cannot see them (R12's
// "NO liquid coin"), so a deliberate reader is the only way this leg is visible
// at all. Two callers count it BY NAME: the ρ base inside deriveEpochClose, and
// the ownership read below.
export function foldKeepingMint(entries) {
  const k = new Map(); // handle -> keeping mint
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'keeping-mint') k.set(c.handle, (k.get(c.handle) ?? 0) + c.n);
  }
  return k;
}

// OWNERSHIP (D1, Keemin 2026-08-21): "ownership is a derived READ = minted (all
// sources) + holo — NOT a tense; no fifth tense node." Nothing is stored for it
// and nothing needs to be: it is this fold over the sealed ledger, recomputable
// any time, exactly like the three tenses beside it.
//
//   minted_primary = foldMintCount   — earned, liquid-bearing (correspondence,
//                                      votes, gifts, issuance, friendship)
//   minted_keeping = foldKeepingMint — R12's σ leg: mint, source-tagged, no coin
//   holo           = foldHolo        — the payers' soulbound record
//   minted         = primary + keeping     (all sources — D1's "all sources")
//   ownership      = minted + holo
//
// The ρ BASE is deliberately NOT `ownership`: it is minted only. Holo is what ρ
// caps, so a base that counted holo would let money raise its own ceiling.
export function foldOwnership(entries) {
  const primary = foldMintCount(entries);
  const keeping = foldKeepingMint(entries);
  const holo = foldHolo(entries);
  const out = new Map(); // handle -> { minted_primary, minted_keeping, minted, holo, ownership }
  const touch = (h) => {
    if (!out.has(h)) out.set(h, { minted_primary: 0, minted_keeping: 0, minted: 0, holo: 0, ownership: 0 });
    return out.get(h);
  };
  for (const [h, n] of primary) touch(h).minted_primary += n;
  for (const [h, n] of keeping) touch(h).minted_keeping += n;
  for (const [h, n] of holo) touch(h).holo += n;
  for (const rec of out.values()) {
    rec.minted = rec.minted_primary + rec.minted_keeping;
    rec.ownership = rec.minted + rec.holo;
  }
  return out;
}

// The epochs a pot has already closed (any close row names its epoch).
export function foldClosedEpochs(entries) {
  const closed = new Set(); // `${pot}|${epoch}`
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'pot-return' || c.kind === 'keeping-burn' || c.kind === 'keeping-mint') closed.add(`${c.pot}|${c.epoch}`);
    else if (c.kind === 'holo' && c.pot !== TREASURY_POT) closed.add(`${c.pot}|${c.epoch}`);
  }
  return closed;
}

// The keeping dial (σ, ρ). Same posture as townIssuanceDial: no dial, no close —
// an undeclared split is not a default to guess at.
export function keepingDial(repo) {
  const path = join(repo, 'ECONOMY-DIALS.json');
  if (!existsSync(path)) return null;
  try {
    const j = JSON.parse(readFileSync(path, 'utf8'));
    const d = j?.law_side?.keeping ?? null;
    if (!d || typeof d.sigma !== 'number' || typeof d.rho !== 'number') return null;
    const ceiling = typeof d.rho_constitutional_ceiling === 'number' ? d.rho_constitutional_ceiling : 0.5;
    if (!(d.sigma > 0 && d.sigma < 1) || !(d.rho >= 0) || d.rho > ceiling) return null;
    const treasury = j?.law_side?.town_issuance?.treasury_handle ?? null;
    return { sigma: d.sigma, rho: d.rho, rhoCeiling: ceiling, treasury };
  } catch { return null; }
}

// The pot file — a bounty file on the quest board, ballot-file style:
// WHITE_PAGES/pot-<id>.json. The verifier reads it the way it reads a ballot
// file (checkout state; the committed file is the record).
export function potFile(repo, pot) {
  const p = join(repo, 'WHITE_PAGES', `pot-${pot}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

// ── D5 · INTAKE REFUSES DOLLARS PAST THE POSTED TARGET ───────────────────────
// D5 (Keemin, 2026-08-21): "intake refuses dollars past a pot's posted target,
// mechanically (recording tool / door bounce), except pots explicitly marked
// uncapped. Conversion's cap-at-1 stays as backstop."
//
// So this is the FRONT gate, and deriveEpochClose's min(1, D ÷ target) is the
// back one. Two gates for one law is deliberate: the back gate already made
// overfunding harmless to the math (a dollar past target buys nothing), but it
// left the payer's money sitting in a pot that could never use it. The front
// gate is the honest answer — bounce it while it is still theirs, and name the
// remaining headroom so they can pay exactly what the town still needs.
//
// The headroom is measured in the pot's own currency of need: dollars ALREADY
// WITNESSED toward the open epoch (receipts no close has settled) against target_usd_per_epoch.
// Treasury dollars are excluded from the count AND exempt from the refusal, for
// the same one reason both times — "Treasury may cover any shortfall — minting
// nothing." They fund nothing and mint nothing, so they can neither consume a
// patron's headroom nor overfund anything by arriving.
//
// A pot with `"uncapped": true` is exempt by D5's own exception (the Darko
// donation box: a standing box with no target, where the whole point is that
// whatever arrives is welcome). A pot with no readable target is also exempt —
// there is no posted need to be past. Both say so out loud in `reason`.
//
// Pure, and returns rather than throws, so the recording tool and the door can
// share one answer and phrase the bounce their own way.
export function intakeCheck({ entries, pot, potMeta, usd, treasury = null, from = null }) {
  if (pot === TREASURY_POT) return { ok: true, capped: false, reason: 'the reserved direct-to-town pot posts no need — it takes receipts and nothing else' };
  if (treasury && from === treasury) return { ok: true, capped: false, reason: 'treasury dollars fund nothing and mint nothing — they consume no headroom' };
  if (potMeta && potMeta.uncapped === true) return { ok: true, capped: false, reason: `pot "${pot}" is marked uncapped — a standing box takes whatever arrives` };
  const target = potMeta?.target_usd_per_epoch;
  if (!Number.isInteger(target) || target <= 0) return { ok: true, capped: false, reason: `pot "${pot}" posts no whole-dollar target — nothing to be past` };
  const { receipts, settled } = foldPotReceipts(entries);
  const received = receipts
    .filter((r) => r.pot === pot && !settled.has(r.ref) && !(treasury && r.from === treasury))
    .reduce((a, r) => a + r.usd, 0);
  const headroom = Math.max(0, target - received);
  if (!Number.isInteger(usd) || usd < 1) return { ok: false, capped: true, headroom, target, received, error: `--usd must be a whole dollar amount ≥ 1 (got ${usd})` };
  if (usd > headroom) {
    return {
      ok: false, capped: true, headroom, target, received,
      error: headroom === 0
        ? `pot "${pot}" is fully funded for this epoch ($${received} of $${target} posted) — intake refuses dollars past the posted target; nothing is owed and nothing more can convert`
        : `$${usd} is past pot "${pot}"'s posted target — $${received} of $${target} is already witnessed, so only $${headroom} more can be taken this epoch`,
    };
  }
  return { ok: true, capped: true, headroom, target, received };
}

// ── the epoch close (the ONE decision, shared by the tool and the verifier) ──
// A pure function of the ledger prefix the close lands on, the pot file, and
// the keeping dial. tools/epoch-close.mjs derives-and-appends; stamp-verify
// re-derives from the same prefix and demands the recorded block match exactly
// — there is no second copy of the law (the settlementDecision precedent).
//
// Given pot P at epoch E on close date D:
//   target    = P's posted need for one epoch (target_usd_per_epoch on the pot
//               file). The pot's price is the town's own posting — it is the ONLY
//               thing dollars are measured against. There is no dollar↔stamp rate.
//   dollars   = P's pot-receipts no close has settled; the funding total excludes the
//               treasury's own dollars ("Treasury may cover any shortfall —
//               minting nothing")
//   funded    = min(1, dollars ÷ target) — how much of the posted need the town's
//               payers actually met this epoch
//   stakes    = ALL open `stake:pot/P` positions. Every one is eligible; there is
//               no beneficiary carve-out (§ 8's only exclusion is payer-side)
//   burn      = floor(funded · stake_i) per staker — a fully funded pot burns
//               every stake whole, a half-funded pot burns half of each, a
//               zero-dollar pot burns none. Every unburned remainder returns
//               whole ("unmatched stakes RETURN — no counterparty, no burn")
//   σ leg     = floor(σ · burn_i) BACK TO STAKER i, at par of their own burn.
//               Per-staker floors, not a floor of the total: the equity is each
//               staker's own, so it is computed on their own number
//   (1−σ) leg = payers floor((1−σ)·B_other · usd/dollars) per receipt, where
//               B_other excludes the payer household's own burned stakes
//               (sole-staker-sole-payer mints zero); each holo then clips to the
//               ρ-cap (household holo ≤ floor(ρ · earned primary mint))
//   remainder = every floored/clipped/excluded stamp burns un-minted — the seam
//               keeps the change. Total new equity ≤ B, always; never 2×B
//   holo rows = one per receipt, ALWAYS, count included even when it is 0 —
//               dollars are remembered even when they mint nothing, and the
//               row is also what marks the receipt's ref spent
// Row order is canonical (returns, burns, keeping mints, holos — names sorted,
// receipts in ledger order), which is what lets the verifier match the block
// byte-for-byte.
export function deriveEpochClose({ entries, households, pot, potMeta, epoch, date, dial }) {
  const err = (error) => ({ ok: false, error });
  if (!dial) return err('no keeping dial (ECONOMY-DIALS.json law_side.keeping) — an undeclared split is not a default to guess at');
  if (pot === TREASURY_POT) return err(`"${TREASURY_POT}" is the reserved direct-to-town pot — it takes receipts and nothing else, never stakes or closes`);
  if (!potMeta) return err(`no pot file WHITE_PAGES/pot-${pot}.json — a close needs the pot it closes`);
  // T10's spec line: "every pot names its beneficiary". The beneficiary is where
  // the DOLLARS route — not where stamps mint. Since the correction of 2026-08-21
  // the σ leg goes to the stakers, so this name no longer appears in any equity
  // row; it is still required, because a pot whose dollars have no named
  // destination is not a funded need, and it still may not be the treasury
  // ("the town never stands on the receiving side of the seam").
  const beneficiary = potMeta.beneficiary;
  if (!beneficiary || typeof beneficiary !== 'string') return err(`pot "${pot}" names no beneficiary — every pot names its beneficiary before a close`);
  if (dial.treasury && beneficiary === dial.treasury) return err('the treasury cannot keep a pot — the town never receives from its own seam');
  // The posted need. Without it there is nothing to price the dollars against,
  // and matching would have to invent a dollar↔stamp rate — the one thing the
  // law forbids. No target, no close.
  const target = potMeta.target_usd_per_epoch;
  if (!Number.isInteger(target) || target <= 0)
    return err(`pot "${pot}" posts no whole-dollar target_usd_per_epoch — the funded fraction is priced against the posted need, never against the staked mass`);
  if (!/^\d{4}-\d{2}$/.test(epoch)) return err(`epoch must be YYYY-MM, got "${epoch}"`);

  const { laws, revisions } = parseLaws(entries);
  if (meepChecker(laws)(beneficiary, date)) return err(`beneficiary "${beneficiary}" is a meep at ${date} — meeps stay outside the currency`);
  if (foldClosedEpochs(entries).has(`${pot}|${epoch}`)) return err(`pot "${pot}" already closed epoch ${epoch} — one epoch, one close`);

  const hhKey = (handle) => {
    let key = households.get(handle)?.key ?? null;
    for (const r of revisions) if (r.handle === handle && r.date <= date) key = r.key;
    return key ?? `solo:${handle}`;
  };
  // A payer earns holo only as a town household: in the base registry or
  // re-keyed by a sealed registry line. An outside patron (the founding family
  // grant) resolves to neither, and their holo row lands reading 0.
  const isResident = (handle) => households.has(handle) || revisions.some((r) => r.handle === handle);

  // Every open stake on this pot. ALL of them are eligible: § 8's only exclusion
  // is payer-side ("a payer's own stakes are excluded from their holo
  // calculation"), and a beneficiary who also wants the thing they keep is a
  // staker like any other.
  const positions = []; // [{ handle, n }]
  for (const [k, n] of foldPotPositions(entries)) {
    const [p, handle] = k.split('|');
    if (p === pot && n > 0) positions.push({ handle, n });
  }
  positions.sort((a, b) => a.handle.localeCompare(b.handle));

  // this epoch's dollars: receipts for this pot no close has settled, in ledger order
  const { receipts: allReceipts, settled } = foldPotReceipts(entries);
  const receipts = allReceipts.filter((r) => r.pot === pot && !settled.has(r.ref));
  const funding = (r) => !(dial.treasury && r.from === dial.treasury);
  const D = receipts.filter(funding).reduce((a, r) => a + r.usd, 0);
  const S = positions.reduce((a, s) => a + s.n, 0);

  if (positions.length === 0 && receipts.length === 0) return err(`pot "${pot}" has nothing to close — no open stakes, no unsettled receipts`);

  // MATCHING — "conversion runs pro-rata to dollars actually paid; unmatched
  // stakes RETURN". Pro-rata to the POSTED NEED, which is what makes the pot's
  // own price the only exchange rate in the system: a fully funded pot converts
  // every stake however large the pile (the town priced money's power by staking
  // that much), and an unfunded one converts nothing. The partial case multiplies
  // BEFORE it divides — floor(stake · D / target) on whole numbers, never
  // stake × (D/target) through a float ratio — so every replay of this block, on
  // any machine, derives the same byte. The reported fraction below is display.
  const fullyFunded = D >= target;
  const burns = [];   // [{ handle, n }]
  const returns = new Map(); // handle -> n
  for (const s of positions) {
    const b = fullyFunded ? s.n : Math.floor((s.n * D) / target);
    if (b > 0) burns.push({ handle: s.handle, n: b });
    if (s.n - b > 0) returns.set(s.handle, (returns.get(s.handle) ?? 0) + (s.n - b));
  }
  const B = burns.reduce((a, b) => a + b.n, 0);

  // THE σ LEG — "σ × pot mints back to the keepers as their own equity, at par of
  // their burn", which R12 then names as what it is: ordinary mint, source-tagged
  // `minted · for: keeping:<pot>`, no liquid coin. Per staker, on their own burn,
  // floored (R1) on that number: a floor of the total would hand one staker's
  // rounding to another.
  const keepingMint = []; // [{ handle, n }]
  for (const b of burns) {
    const n = Math.floor(b.n * dial.sigma);
    if (n > 0) keepingMint.push({ handle: b.handle, n });
  }
  const keepingMintTotal = keepingMint.reduce((a, x) => a + x.n, 0);

  const burnedByHH = new Map();
  for (const b of burns) {
    const k = hhKey(b.handle);
    burnedByHH.set(k, (burnedByHH.get(k) ?? 0) + b.n);
  }

  // ρ-CAP BASIS. R12 (Keemin, 2026-08-21 afternoon): the keeping leg "COUNTS
  // toward the ρ base (holo cap base = earned primary mint + keeping mint)".
  // Keemin overturned the recommendation to exclude it: "the loop cannot
  // compound — verb-less → never re-stakable; ceiling inflation bounded at
  // (1+σ)× earned; every cycle costs real earned liquid + a real town-posted
  // need + real dollars."
  //
  // Both legs are read from the prefix THIS close lands on, so a close never
  // raises its own ceiling with the keeping mint it is about to write — only
  // earlier closes count. That is what keeps the verifier's re-derivation from
  // the same prefix byte-identical.
  const mintByHH = new Map();
  for (const [handle, n] of foldMintCount(entries)) {
    const k = hhKey(handle);
    mintByHH.set(k, (mintByHH.get(k) ?? 0) + n);
  }
  for (const [handle, n] of foldKeepingMint(entries)) {
    const k = hhKey(handle);
    mintByHH.set(k, (mintByHH.get(k) ?? 0) + n);
  }
  const holoByHH = new Map();
  for (const [handle, n] of foldHolo(entries)) {
    const k = hhKey(handle);
    holoByHH.set(k, (holoByHH.get(k) ?? 0) + n);
  }

  // THE (1−σ) LEG — "(1−σ) × pot mints to payers as Holo, by dollar share", with
  // § 8.6's one exclusion: "a payer's own stakes are excluded from their holo
  // calculation. Sole-staker-sole-payer mints zero holo."
  //
  // ONE HOLO ROW PER RECEIPT, ALWAYS — including the zeros. The count is what
  // varies; the row itself is not optional, because it does double duty: it is
  // the payer's record AND the mark that this receipt's ref has spent its one
  // mint chance (foldPotReceipts reads exactly these refs). Emitting only the
  // winners would leave every zero-minting dollar — treasury, outside, ρ-capped,
  // sole-staker — looking unspent forever, to be re-counted toward funding and
  // re-offered holo at every later close.
  const holos = []; // [{ handle, n, ref }]
  const grantedThisClose = new Map(); // household -> holo assigned in this close
  for (const r of receipts) {
    let h = 0;
    if (funding(r) && isResident(r.from) && D > 0 && B > 0) {
      const pHH = hhKey(r.from);
      const bOther = B - (burnedByHH.get(pHH) ?? 0); // nothing you fully control mints for you
      const raw = Math.floor(((1 - dial.sigma) * bOther * r.usd) / D);
      const capTotal = Math.floor(dial.rho * (mintByHH.get(pHH) ?? 0));
      const held = (holoByHH.get(pHH) ?? 0) + (grantedThisClose.get(pHH) ?? 0);
      h = Math.max(0, Math.min(raw, capTotal - held));
      if (h > 0) grantedThisClose.set(pHH, (grantedThisClose.get(pHH) ?? 0) + h);
    }
    holos.push({ handle: r.from, n: h, ref: r.ref });
  }
  const holoTotal = holos.reduce((a, x) => a + x.n, 0);

  // the canonical row set, in the one order the verifier matches
  const rows = [];
  for (const [handle, n] of [...returns.entries()].sort((a, b) => a[0].localeCompare(b[0])))
    rows.push({ kind: 'pot-return', date, pot, handle, n, epoch });
  for (const b of burns) rows.push({ kind: 'keeping-burn', date, pot, n: b.n, epoch, handle: b.handle });
  for (const x of keepingMint) rows.push({ kind: 'keeping-mint', date, handle: x.handle, n: x.n, pot, epoch });
  for (const x of holos) rows.push({ kind: 'holo', date, handle: x.handle, n: x.n, pot, epoch, ref: x.ref });
  if (rows.length === 0) return err(`pot "${pot}" derives an empty close — nothing to record`);

  return {
    ok: true,
    rows,
    report: {
      pot, epoch, date, beneficiary,
      potTarget: target,
      dollarsWitnessed: receipts.reduce((a, r) => a + r.usd, 0),
      dollarsFunding: D,
      fundedFraction: fullyFunded ? 1 : D / target,
      stakesOpen: S,
      burned: B,
      keepingMint: keepingMintTotal,
      holoMinted: holoTotal,
      unmintedRemainder: B - keepingMintTotal - holoTotal,
      receipts: receipts.length,
    },
  };
}

// ── expected-sequence walk (mints derived; everything else in place) ─────────
// Walks the recorded ledger: derived mint lines must appear as an exact in-order
// subsequence. Assertion lines (rules/registry/stake/return/vote-mint) AND
// settlement lines (transfer/void) are accepted in place — their validity is
// checked elsewhere: settlements by the verifier's ledger-order settlement fold
// (order-aware, sharing settlementDecision), stakes by the lawfulness fold.
// Returns { problems, owed } — owed = derived mints not yet recorded.

export function walkLedger(recorded, derivedMints, offset = 0) {
  const problems = [];
  const derivedCanonicals = derivedMints.map(derivedLine);
  let di = 0;
  for (let i = 0; i < recorded.length; i++) {
    const c = recorded[i];
    const cls = classifyEntry(c);
    if (cls.kind === 'mint' || cls.kind === 'friendship') {
      if (di >= derivedCanonicals.length) {
        problems.push(`line ${i + 1 + offset}: ledger mint beyond the derivation — a stamp with no mail behind it\n  recorded: ${c}`);
        break;
      }
      if (c !== derivedCanonicals[di]) {
        problems.push(`line ${i + 1 + offset}: REPLAY DIVERGES\n  recorded: ${c}\n  derived : ${derivedCanonicals[di]}`);
        break;
      }
      di++;
    } else if (cls.kind === 'unknown') {
      const next = di < derivedCanonicals.length ? `\n  derived : ${derivedCanonicals[di]}` : '';
      problems.push(`line ${i + 1 + offset}: REPLAY DIVERGES — unrecognized grammar\n  recorded: ${c}${next}`);
      break;
    }
    // rules / registry / stake / return / vote-mint / transfer / void: in place
  }
  return { problems, owed: derivedMints.slice(di) };
}

// ── signed append (shared by --append, --declare-*, and the office pen) ─────
// Validates the recorded ledger against the derivation, then seals + signs +
// appends the given canonicals at the tail. Caller holds the town lock.

export function appendSigned(repo, canonicals, privateKeyPem) {
  const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  const prev = existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : '';
  const existing = parseStampLedger(prev);
  const recorded = existing.map((e) => e.canonical);
  const all = [...recorded, ...canonicals];
  const seals = sealChain(all);
  const newLines = canonicals.map((c, i) => `${c} · sig: ${signSeal(seals[recorded.length + i], privateKeyPem)}`);
  const header = prev !== '' ? '' : `# stamp-ledger — the town's stamps, witnessed

Machine-first, append-only, single-writer (the office pen). Grammar, seal and
signature construction: \`tools/stamp-mint.mjs\` header. Verify anyone, any time:
\`node tools/stamp-verify.mjs\` (public key: \`tools/stamp-pubkey.pem\`).
Balances are a pure fold: \`node tools/stamp-mint.mjs --balances\`.
Stamps mint from delivered letters only (law ${RULES_V1}) — you can't forge a
stamp without forging the mail. Zero-stamp participation is fully first-class.

`;
  const sep = prev === '' || prev.endsWith('\n') ? '' : '\n';
  writeFileSync(ledgerPath, `${header}${prev}${sep}${newLines.join('\n')}\n`, 'utf8');
  return newLines;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function arg(name) { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : null; }
const has = (name) => process.argv.includes(name);

// Emit economy lines in delivery order, each delivery's mints IMMEDIATELY
// before its own settlement. This is the order the ledger records them in, and
// the order the verifier folds them in — so a settlement is always preceded by
// exactly the balance that decided it (its own sending-mint included, later
// deliveries' mints excluded). Assertion lines (stakes) are not economy lines
// and are never produced here; they are appended by the ballot tool.
export function interleaveByDelivery(deliveries, mints, transfers) {
  const mById = new Map();
  for (const m of mints) { if (!mById.has(m.cause)) mById.set(m.cause, []); mById.get(m.cause).push(m); }
  const tById = new Map(transfers.map((t) => [t.id, t]));
  const lines = [];
  for (const d of deliveries) {
    for (const m of (mById.get(d.id) ?? [])) lines.push(derivedLine(m));
    if (tById.has(d.id)) lines.push(economyLine(tById.get(d.id)));
  }
  return lines;
}

function loadState(repo) {
  const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  const existing = existsSync(ledgerPath) ? parseStampLedger(readFileSync(ledgerPath, 'utf8')) : [];
  const { laws, revisions } = parseLaws(existing);
  const deliveries = parseDeliveries(repo);
  const households = householdKeys(repo);
  const corrMints = deriveMints(deliveries, households, { laws, revisions });
  const friendMints = deriveFriendshipMints(deliveries, households, { laws, revisions });
  const mints = combineDerived(deliveries, corrMints, friendMints); // the full derived subsequence
  const transfers = deriveTransfers(deliveries, households, { laws, revisions }, existing);
  return { ledgerPath, existing, laws, revisions, deliveries, mints, transfers };
}

function main() {
  const repo = resolve(arg('--repo') ?? DEFAULT_REPO);
  const { ledgerPath, existing, deliveries, mints, transfers } = loadState(repo);
  const genesisDate = deliveries[0]?.date ?? '2026-06-12';

  if (has('--derive')) {
    console.log(rulesLine(genesisDate));
    for (const line of interleaveByDelivery(deliveries, mints, transfers)) console.log(line);
    const moved = transfers.filter((t) => t.kind === 'transfer').length;
    const voided = transfers.filter((t) => t.kind === 'void').length;
    console.error(`# ${mints.length} mint(s), ${moved} transfer(s), ${voided} void(s) from ${deliveries.length} deliveries — unsigned derivation; truth is the replay`);
    return;
  }

  if (has('--balances')) {
    const bal = foldBalances(existing);
    const rows = [...bal.entries()]
      .filter(([a]) => a !== 'MINT' && a !== 'BURN' && !a.startsWith('stake:'))
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
    for (const [acct, n] of rows) console.log(`${String(n).padStart(5)}  ${acct}`);
    const escrow = [...bal.entries()].filter(([a]) => a.startsWith('stake:') && bal.get(a) !== 0);
    for (const [acct, n] of escrow) console.log(`${String(n).padStart(5)}  ${acct} (escrow)`);
    console.log(`${String(-(bal.get('MINT') ?? 0)).padStart(5)}  (minted, cumulative)`);
    return;
  }

  if (has('--append')) {
    const keyPath = arg('--key');
    if (!keyPath || !existsSync(keyPath)) { console.error('--append needs --key <ed25519-private-pem>'); process.exit(1); }
    const pem = readFileSync(keyPath, 'utf8');
    const recorded = existing.map((e) => e.canonical);
    if (existing.length > 0 && recorded[0] !== rulesLine(genesisDate)) {
      console.error('FATAL: ledger does not open with the v1 rules marker'); process.exit(1);
    }
    const body = existing.length === 0 ? [] : recorded.slice(1);
    const { problems, owed } = walkLedger(body, mints);
    if (problems.length) {
      console.error(`FATAL: recorded ledger diverges from derivation — run stamp-verify.mjs; nothing appended\n${problems[0]}`);
      process.exit(1);
    }
    // Owed settlements = derived ones whose delivery isn't already settled in the
    // record. Interleave owed mints + owed settlements in delivery order, each
    // settlement right after its own delivery's mints — the ledger order the
    // verifier folds against.
    const recordedSettlementIds = new Set();
    for (const e of existing) {
      const cls = classifyEntry(e.canonical);
      if (cls.kind === 'transfer' || cls.kind === 'void') recordedSettlementIds.add(cls.id);
    }
    const owedTransfers = transfers.filter((t) => !recordedSettlementIds.has(t.id));
    const owedLines = interleaveByDelivery(deliveries, owed, owedTransfers);
    const newCanonicals = existing.length === 0
      ? [rulesLine(genesisDate), ...owedLines]
      : owedLines;
    if (newCanonicals.length === 0) { console.log('stamp-ledger: up to date — nothing to mint'); return; }
    appendSigned(repo, newCanonicals, pem);
    const moved = owedTransfers.filter((t) => t.kind === 'transfer').length;
    const voided = owedTransfers.filter((t) => t.kind === 'void').length;
    console.log(`stamp-ledger: appended ${newCanonicals.length} line(s) — ${owed.length} mint(s), ${moved} transfer(s), ${voided} void(s) (${existing.length} already recorded)`);
    return;
  }

  if (has('--gift')) {
    // Founder gift: a case-by-case award, signed by the office pen (the signature
    // IS the authority gate — this verb only runs where the key lives). Mechanism
    // blessed 2026-07-18; each actual gift is the principal's call, never routine.
    const keyPath = arg('--key');
    const date = arg('--date');
    const handle = arg('--gift');
    const n = Number(arg('--amount'));
    const slug = arg('--slug');
    const by = arg('--by');
    if (!keyPath || !existsSync(keyPath) || !date || !handle || !slug || !by) {
      console.error('--gift <handle> needs --amount N --slug <kebab-reason> --by <founder> --date YYYY-MM-DD --key FILE'); process.exit(1);
    }
    if (!Number.isInteger(n) || n < 1) { console.error(`--amount must be a whole number ≥ 1 (got ${arg('--amount')})`); process.exit(1); }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) { console.error(`--slug must be kebab-case ([a-z0-9-], got "${slug}")`); process.exit(1); }
    const rooms = householdKeys(repo);
    if (!rooms.has(handle)) { console.error(`FATAL: no WHITE_PAGES room for "${handle}" — a gift needs a resident to receive it`); process.exit(1); }
    const { laws } = parseLaws(existing);
    if (meepChecker(laws)(handle, date)) { console.error(`FATAL: "${handle}" is a meep at ${date} — meeps stay outside the currency`); process.exit(1); }
    const recorded = existing.map((e) => e.canonical);
    const { problems, owed } = walkLedger(recorded.slice(1), mints, 1);
    if (existing.length > 0 && problems.length) {
      console.error(`FATAL: recorded ledger diverges from derivation — run stamp-verify.mjs; nothing gifted\n${problems[0]}`); process.exit(1);
    }
    // A gift must land on a settled tail: every assertion line's balance effect is
    // assumed causally prior to any settlement appended after it. Owed mints or
    // settlements would slot BEHIND the gift in a later --append, breaking that.
    const settledIds = new Set();
    for (const e of existing) {
      const cls0 = classifyEntry(e.canonical);
      if (cls0.kind === 'transfer' || cls0.kind === 'void') settledIds.add(cls0.id);
    }
    const owedSettlements = transfers.filter((t) => !settledIds.has(t.id));
    if (existing.length === 0 || owed.length || owedSettlements.length) {
      console.error(`FATAL: ledger is behind the mail (${owed.length} mint(s), ${owedSettlements.length} settlement(s) owed${existing.length === 0 ? ', or not yet founded' : ''}) — run --append first, then gift onto the settled tail`); process.exit(1);
    }
    const maxDate = existing.reduce((mx, e) => {
      const d = /^- (\d{4}-\d{2}-\d{2}) /.exec(e.canonical)?.[1];
      return d && d > mx ? d : mx;
    }, '0000-00-00');
    if (date < maxDate) { console.error(`FATAL: gift date ${date} precedes the ledger tail (${maxDate}) — the ledger is append-only, forward-dated`); process.exit(1); }
    const canonical = giftLine({ date, handle, n, slug, by });
    appendSigned(repo, [canonical], readFileSync(keyPath, 'utf8'));
    console.log(`stamp-ledger: gifted\n  ${canonical}`);
    return;
  }

  if (has('--first-idea')) {
    // FIRST-IDEA QUEST MINT (the Think Tank, 2026-08-30). Same ceremony as
    // --gift — signed by the office pen, appended onto a settled tail,
    // forward-dated — with the gift's case-by-case looseness replaced by the
    // quest's own terms, all enforced here AND at verify: 5 stamps exactly
    // (pinned, no --amount), authority the-town (pinned, no --by), and ONE
    // line per household, ever. The normal writer is the office drain at
    // crossings; this verb is the drain's own ceremony exposed for rehearsal
    // and repair, never a second law.
    const keyPath = arg('--key');
    const date = arg('--date');
    const handle = arg('--first-idea');
    const mark = arg('--mark');
    if (!keyPath || !existsSync(keyPath) || !date || !handle || !mark) {
      console.error('--first-idea <handle> needs --mark <by>/<slug> --date YYYY-MM-DD --key FILE'); process.exit(1);
    }
    if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/.test(mark)) {
      console.error(`--mark must be a mark id, <by>/<slug> ([a-z0-9-], got "${mark}")`); process.exit(1);
    }
    const rooms = householdKeys(repo);
    if (!rooms.has(handle)) { console.error(`FATAL: no WHITE_PAGES room for "${handle}" — a quest mint needs a resident to receive it`); process.exit(1); }
    const { laws, revisions } = parseLaws(existing);
    if (meepChecker(laws)(handle, date)) { console.error(`FATAL: "${handle}" is a meep at ${date} — meeps stay outside the currency`); process.exit(1); }
    // ONE PER HOUSEHOLD, EVER — resolved the way the verifier resolves it, so
    // this door and the fold cannot disagree about who shares a house.
    const keyOf = (h, d) => {
      let k = null;
      for (const r of revisions) if (r.handle === h && r.date <= d) k = r.key;
      if (k) return k;
      const base = rooms.get(h);
      return base ? base.key : `solo:${h}`;
    };
    for (const e of existing) {
      const c = classifyEntry(e.canonical);
      if (c.kind === 'first-idea' && keyOf(c.handle, c.date) === keyOf(handle, date)) {
        console.error(`FATAL: household already holds its first-idea mint (${c.date}, ${c.handle}, first-idea:${c.mark}) — once per household, ever`); process.exit(1);
      }
    }
    const recorded = existing.map((e) => e.canonical);
    const { problems, owed } = walkLedger(recorded.slice(1), mints, 1);
    if (existing.length > 0 && problems.length) {
      console.error(`FATAL: recorded ledger diverges from derivation — run stamp-verify.mjs; nothing minted\n${problems[0]}`); process.exit(1);
    }
    if (existing.length === 0 || owed.length) {
      console.error(`FATAL: ledger is behind the mail (${owed.length} mint(s) owed${existing.length === 0 ? ', or not yet founded' : ''}) — run --append first, then mint onto the settled tail`); process.exit(1);
    }
    const maxDate = existing.reduce((mx, e) => {
      const d = /^- (\d{4}-\d{2}-\d{2}) /.exec(e.canonical)?.[1];
      return d && d > mx ? d : mx;
    }, '0000-00-00');
    if (date < maxDate) { console.error(`FATAL: first-idea date ${date} precedes the ledger tail (${maxDate}) — the ledger is append-only, forward-dated`); process.exit(1); }
    const canonical = firstIdeaLine({ date, handle, mark });
    appendSigned(repo, [canonical], readFileSync(keyPath, 'utf8'));
    console.log(`stamp-ledger: first-idea minted\n  ${canonical}`);
    return;
  }

  if (has('--town-issuance')) {
    // TOWN ISSUANCE. Same ceremony as --gift (signed by the office pen, appended
    // onto a settled tail, forward-dated), with the room requirement replaced by
    // laws the gift does not need. Repeating by design: mint-at-demand means the
    // town issues whenever income falls short, and every line names why.
    const keyPath = arg('--key');
    const date = arg('--date');
    const handle = arg('--town-issuance');
    const n = Number(arg('--amount'));
    const purpose = arg('--purpose');
    const by = arg('--by');
    const provenance = arg('--provenance');
    if (!keyPath || !existsSync(keyPath) || !date || !handle) {
      console.error('--town-issuance <treasury-handle> needs --amount N --purpose <kebab> --by <who> --provenance TEXT --date YYYY-MM-DD --key FILE'); process.exit(1);
    }
    if (!Number.isInteger(n) || n < 1) { console.error(`FATAL: --amount must be a whole number ≥ 1 (got ${arg('--amount')})`); process.exit(1); }
    if (!purpose || !ISSUANCE_PURPOSE_RE.test(purpose)) { console.error(`FATAL: --purpose must be kebab-case ([a-z0-9-], got ${JSON.stringify(purpose)}) — under mint-at-demand every issuance names why`); process.exit(1); }
    if (!by) { console.error('FATAL: --by is required — an issuance names who authorized it'); process.exit(1); }
    if (!provenance || !provenance.trim()) { console.error('FATAL: --provenance is required — an issuance with no stated reason is exactly the unaccountable printing this class exists to prevent'); process.exit(1); }
    if (provenance.includes('·')) { console.error('FATAL: --provenance may not contain the "·" field separator (it is the line\'s terminal field; a separator inside it would forge trailing fields)'); process.exit(1); }

    // THE TREASURY LAW. The recipient must be the handle ECONOMY-DIALS.json
    // declares. This is what keeps the class from being an unroomed --gift that
    // can mint any amount to any handle.
    const dial = townIssuanceDial(repo);
    if (!dial) { console.error('FATAL: no law_side.town_issuance.treasury_handle in ECONOMY-DIALS.json — the treasury must be DECLARED before it can be funded'); process.exit(1); }
    if (handle !== dial.treasury_handle) {
      console.error(`FATAL: "${handle}" is not the declared treasury ("${dial.treasury_handle}") — town issuance funds the town, not a resident; use --gift for a resident`); process.exit(1);
    }
    const { laws } = parseLaws(existing);
    if (meepChecker(laws)(handle, date)) { console.error(`FATAL: "${handle}" is a meep at ${date} — meeps stay outside the currency`); process.exit(1); }

    // ONE-SHOT PURPOSES. Issuance repeats by design, so this is narrow on
    // purpose: only what the dial names one-shot is unique. The founding grant is
    // one of those, because a founding act happens once.
    if (dial.once_purposes.has(purpose)) {
      const prior = existing.map((e) => classifyEntry(e.canonical)).find((c) => c.kind === 'town-issuance' && c.purpose === purpose);
      if (prior) { console.error(`FATAL: "${purpose}" is a one-shot purpose and already ran (${prior.date}, ${prior.n} to ${prior.handle}) — it happens once`); process.exit(1); }
    }

    const recorded = existing.map((e) => e.canonical);
    const { problems, owed } = walkLedger(recorded.slice(1), mints, 1);
    if (existing.length > 0 && problems.length) {
      console.error(`FATAL: recorded ledger diverges from derivation — run stamp-verify.mjs; nothing issued\n${problems[0]}`); process.exit(1);
    }
    const settledIds = new Set();
    for (const e of existing) {
      const cls0 = classifyEntry(e.canonical);
      if (cls0.kind === 'transfer' || cls0.kind === 'void') settledIds.add(cls0.id);
    }
    const owedSettlements = transfers.filter((t) => !settledIds.has(t.id));
    if (existing.length === 0 || owed.length || owedSettlements.length) {
      console.error(`FATAL: ledger is behind the mail (${owed.length} mint(s), ${owedSettlements.length} settlement(s) owed${existing.length === 0 ? ', or not yet founded' : ''}) — run --append first, then issue onto the settled tail`); process.exit(1);
    }
    const maxDate = existing.reduce((mx, e) => {
      const d = /^- (\d{4}-\d{2}-\d{2}) /.exec(e.canonical)?.[1];
      return d && d > mx ? d : mx;
    }, '0000-00-00');
    if (date < maxDate) { console.error(`FATAL: issuance date ${date} precedes the ledger tail (${maxDate}) — the ledger is append-only, forward-dated`); process.exit(1); }

    const canonical = townIssuanceLine({ date, handle, n, purpose, by, note: provenance });
    appendSigned(repo, [canonical], readFileSync(keyPath, 'utf8'));
    console.log(`stamp-ledger: founding grant\n  ${canonical}`);
    return;
  }

  if (has('--declare-rules') || has('--declare-registry')) {
    const keyPath = arg('--key');
    const date = arg('--date');
    if (!keyPath || !existsSync(keyPath) || !date) { console.error('--declare-* needs --key FILE and --date YYYY-MM-DD'); process.exit(1); }
    const pem = readFileSync(keyPath, 'utf8');
    let canonical;
    if (has('--declare-rules')) {
      const name = arg('--declare-rules');
      const meeps = (arg('--meeps') ?? '').split(',').filter(Boolean);
      if (name === 'stamps-v2') {
        if (!meeps.length) { console.error('--declare-rules stamps-v2 needs --meeps a,b,c'); process.exit(1); }
        canonical = rulesV2Line(date, meeps);
      } else if (name === 'stamps-v3') {
        // stamps-v3 opens the friendship ladder. It MUST restate the meep set
        // (lawAt returns the latest law only — an empty meeps here would let meeps
        // resume correspondence-minting from this date). The date guard below is
        // what makes the rule forward-only: it must fall after the last delivery.
        if (!meeps.length) { console.error('--declare-rules stamps-v3 needs --meeps a,b,c (carry the current meep set forward)'); process.exit(1); }
        const ladder = parseLadder(arg('--friendship') ?? FRIENDSHIP_LADDER_V3);
        if (!ladder.length) { console.error('--declare-rules stamps-v3 needs --friendship t:r,t:r (e.g. 5:5,10:10)'); process.exit(1); }
        canonical = rulesV3Line(date, meeps, serializeLadder(ladder));
      } else { console.error(`unknown rules version: ${name}`); process.exit(1); }
    } else {
      const m = /^(\S+)\s*=\s*(\S+)$/.exec(arg('--declare-registry') ?? '');
      if (!m) { console.error('--declare-registry needs "handle = key"'); process.exit(1); }
      canonical = registryLine(date, m[1], m[2]);
    }
    const maxDate = existing.reduce((mx, e) => {
      const d = /^- (\d{4}-\d{2}-\d{2}) /.exec(e.canonical)?.[1];
      return d && d > mx ? d : mx;
    }, '0000-00-00');
    const maxDelivery = deliveries.reduce((mx, d) => (d.date > mx ? d.date : mx), '0000-00-00');
    if (date <= maxDelivery) {
      console.error(`FATAL: declaration date ${date} is not after the last delivery (${maxDelivery}) — a law must be forward-dated, never retroactive`);
      process.exit(1);
    }
    if (date < maxDate) {
      console.error(`FATAL: declaration date ${date} precedes the ledger tail (${maxDate})`);
      process.exit(1);
    }
    appendSigned(repo, [canonical], pem);
    console.log(`stamp-ledger: declared\n  ${canonical}`);
    return;
  }

  console.error('usage: stamp-mint.mjs --derive | --append --key FILE | --balances | --declare-rules stamps-v2 --meeps a,b,c --date D --key FILE | --declare-rules stamps-v3 --meeps a,b,c --friendship 5:5,10:10 --date D --key FILE | --declare-registry "handle = key" --date D --key FILE | --gift <handle> --amount N --slug S --by <founder> --date D --key FILE | --town-issuance <treasury> --amount N --purpose <kebab> --by <who> --provenance TEXT --date D --key FILE  [--repo PATH]');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
