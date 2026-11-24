// census-fold.mjs — the part of the stamp engine the Registrar's likeness census reads.
//
// CORE-108 (Darko, 2026-11-16 13:17 EST: "Lets proactively get the census through rather than
// wait on her. What's the problem, what's the fix", then "Yes go"). The census imports exactly
// three functions of the stamp engine: parseStampLedger, classifyEntry and foldPrimaryMint
// (CORE-85). It used to lock the whole of tools/stamp-mint.mjs, so any change to that file,
// quest pay included, stopped the census until it was re-released. These three, with the
// grammar constants classifyEntry reads, now live here, MOVED VERBATIM; stamp-mint.mjs imports
// them back under the same names and re-exports the public ones, so its behaviour is unchanged.
//
// THE RULE FOR THIS FILE: it imports nothing. Not stamp-mint.mjs, not node:*, nothing — so a
// change to the stamp engine can never reach it, and a change here is a change to what the
// census counts (tools/census-fold.test.mjs reads the imports and fails on any).
// Whoever edits it tells Rei, as an edit to stamp-mint.mjs used to.

// "5:5,10:10" -> [{ threshold: 5, reward: 5 }, { threshold: 10, reward: 10 }], ascending.
export function parseLadder(spec) {
  return (spec ?? '').split(',').filter(Boolean)
    .map((r) => { const [t, w] = r.split(':').map(Number); return { threshold: t, reward: w }; })
    .filter((r) => Number.isInteger(r.threshold) && r.threshold > 0 && Number.isInteger(r.reward) && r.reward > 0)
    .sort((a, b) => a.threshold - b.threshold);
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
// `post/` joined them for the idea posts (POS-290, 2026-10-09), for the same
// reason: a post stake with its author half dropped (`stake:post/<slug>`) would
// otherwise read as a VOTE stake on a topic called "post". No ballot topic is
// named "post", and every line of the live ledger classifies as it did before
// (checked line by line, main's classifier against this one).
const STAKE_RE = /^- (\d{4}-\d{2}-\d{2}) · (\S+) → stake:(?!world-mark\/|pot\/|post\/)([a-z0-9-]+)\/([A-Za-z0-9-]+) · (\d+) · via: (\S+)$/;
const RETURN_RE = /^- (\d{4}-\d{2}-\d{2}) · stake:(?!world-mark\/|pot\/|post\/)([a-z0-9-]+)\/([A-Za-z0-9-]+) → (\S+) · (\d+) · for: close$/;
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
// The town's own return (POS-1139, Darko 2026-11-18 16:3x: "Town-authored
// return"). When the town's opposition removes a mark, the town hands each
// staker's remaining stamps back, and the line says so: the actor is the town,
// named by the removal it carries out (`S<n>`, the settlement), never the
// staker. So it is its own shape, not `for: unstake` written in the staker's
// name. Same movement out of the same escrow account, so conservation folds it
// structurally; the verifier holds it to the staker's WHOLE open position.
const WORLD_TOWN_RETURN_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · stake:world-mark\/(${MARK_ID}) → (\S+) · ([1-9]\d*) · for: town-return:(S[1-9]\d*)$`);
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
// A HOUSEHOLD KEY as the economy writes one: `<prefix>:<value>` — `gh:704250`,
// `login:ember`, `solo:alice`, or a sealed `registry:` line's own key
// (`hh:cadaeic.space`, dots and all). Every key the live roll holds is of this
// shape. It is a CLASS, not `(\S+)`, on purpose: the welcome grammar below
// carries a key in a non-terminal field, and a key that could contain the `·`
// separator would let its writer forge the fields after it — the same forgery
// the issuance note's separator guard exists for, one field earlier.
export const HOUSEHOLD_KEY = String.raw`[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9._-]*`;

// WELCOME — the welcome bundle (founder-ruled 2026-09-14): the town pays 5 once
// per HOUSEHOLD, at its FIRST RESIDENT, for joining. Same shape as first-idea
// with a simpler threshold — arriving is the milestone — and the same reasons:
// movement-shaped (MINT → handle) so conservation folds it structurally; cannot
// collide with GIFT_RE or FIRST_IDEA_RE (`for: welcome:`); NOT replay-derived,
// because a household's arrival is not recomputable from the mail alone, so
// like a gift it is asserted in place and written by the office drain at a
// crossing (or by the founder's hand from `--welcome-plan`). The verifier holds
// what a signature cannot: amount exactly 5, authority the-town, the meep law,
// the named key IS the recipient's household at the line's date, and
// once-per-household ever — so a forged-but-signed line fails verify instead of
// minting twice. The household rides IN the line, unlike first-idea, because
// this mint is paid to ONE resident on behalf of a whole house: the line has to
// say which house was paid, or the roll cannot be read back.
const WELCOME_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · for: welcome:(${HOUSEHOLD_KEY}) · by: (\S+)$`);

const QUEST_PAY_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · for: quest:([a-z0-9][a-z0-9-]*)\/(${HOUSEHOLD_KEY}) · by: (\S+)$`);

const INVITE_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · for: invite:(${HOUSEHOLD_KEY})\/(${HOUSEHOLD_KEY})\/(?:(invited)|inviter\/(\d{4}-\d{2}-\d{2})) · by: (\S+)$`);

// POST STAGE — a bug's stage stamps (the Posts project, phase 2, Keemin
// 2026-09-29: "Bugs pay the flat ladder, with no staking"). The town pays the
// resident who did a stage of a bug post: confirmed 2 (the reporter),
// reproduced 3, diagnosed 5, briefed 10 light / 5 heavy, fixed 10 / 25 / 50
// by size. Same shape and same reasons as welcome and first-idea:
// movement-shaped (MINT → handle) so conservation folds it structurally; NOT
// replay-derived, because the stage happened in the office's store, which this
// repo cannot see — so the stage having happened is the pen's assertion,
// exactly as a join bundle is, written by the office's reviewed stage pass
// (postmark-office tools/bug-stage-plan.mjs, run by hand, never on a tick).
//
// It cannot collide with the grammars above it: GIFT_RE wants `for: gift:`,
// FIRST_IDEA_RE `for: first-idea:`, WELCOME_RE `for: welcome:`, and MINT_RE a
// `(side)` tail where this line ends `· by: …`. Below it, ISSUANCE_RE needs
// `for: issuance:` and a `note:` tail and FRIENDSHIP_RE a `(via …)` tail. The
// segment is `post:<post-id>/<stage>`: the post id is `<author>/<slug>` (a
// handle may carry a dot, a slug may not), and the stage is one of the paid
// five, so the last `/` always splits id from stage. tools/stamp-stage.test.mjs
// proves the classification against every sibling grammar.
//
// The verifier holds what a signature cannot: the amount is on the ladder for
// its stage, `by:` is the-town, the meep law, and ONE line per post and stage,
// ever — so a forged-but-signed line or a second pass fails to verify instead
// of minting twice.
export const STAGE_LADDER = Object.freeze({
  confirmed: Object.freeze([2]),
  reproduced: Object.freeze([3]),
  diagnosed: Object.freeze([5]),
  briefed: Object.freeze([10, 5]),
  fixed: Object.freeze([10, 25, 50]),
});

const STAGE_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · for: post:([a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9-]*)\/(${Object.keys(STAGE_LADDER).join('|')}) · by: (\S+)$`);

const POST_ID = String.raw`[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9-]*`;

export const RECREDIT_STAGES = Object.freeze(['diagnosed', 'briefed', 'fixed']);

const RECREDIT_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · for: post:(${POST_ID})\/(${RECREDIT_STAGES.join('|')})-recredit · by: (\S+)$`);

const PARCEL_BURN_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · (\S+) → BURN · ([1-9]\d*) · for: parcel:([23])\/(${HOUSEHOLD_KEY})$`);

const CORRECTION_BURN_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · (\S+) → BURN · ([1-9]\d*) · for: correction:([A-Za-z0-9_-]{86}) · by: (\S+)$`);
// The award's label may never be a stage's name, nor a stage's recredit: either
// would claim a line the stage grammar owns.
const AWARD_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · MINT → (\S+) · ([1-9]\d*) · for: post:(${POST_ID})\/(?!(?:${Object.keys(STAGE_LADDER).join('|')}) · by: )(?!(?:${RECREDIT_STAGES.join('|')})-recredit · by: )([a-z0-9][a-z0-9-]{0,39}) · by: (\S+)$`);
const POST_STAKE_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · (\S+) → stake:post\/(${POST_ID}) · ([1-9]\d*) · side: (for|against) · via: (\S+)$`);
const POST_UNSTAKE_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · stake:post\/(${POST_ID}) → (\S+) · ([1-9]\d*) · for: unstake · via: (\S+)$`);
const POST_RETURN_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · stake:post\/(${POST_ID}) → (\S+) · ([1-9]\d*) · for: post-return$`);
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

const POT_ID_CLASS = String.raw`[a-z0-9][a-z0-9-]*`;
const EPOCH_CLASS = String.raw`\d{4}-\d{2}`;
// PAYPAL, the third money rail (POS-183 part 2, 2026-09-29): one-time gifts to a
// pot for givers whose banks balk at a foreign card charge. Its receipts are
// written by the office's paypal-watch, `ref: paypal:<capture id>`, under the
// same contract as the card rail's; only the rail's name is new.
export const KEEPING_RAILS = ['stripe', 'usdc', 'paypal', 'grant'];

const POT_RECEIPT_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · pot-receipt · pot:(${POT_ID_CLASS}) · rail: (${KEEPING_RAILS.join('|')}) · usd: ([1-9]\d*) · from: (\S+) · ref: (\S+)$`);
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
// RESIDENT-INITIATED UNSTAKE (ruled 2026-09-17: "just unstake it by hand please,
// we don't need a whole engine for it"). Until now a keeping stake had exactly
// one way out — the epoch close — so a stake placed by mistake could not be
// taken back at all, and the only row that could move it (pot-return) marks the
// epoch CLOSED as a side effect. This row is the missing third way, and it is
// the ballot/world pattern rather than a new idea: `for: unstake` is the
// staker's own act, where `for: close`/`for: pot-return:` is a window closing.
//
// It must never be mistaken for a close, and two things keep it apart: it names
// NO epoch (so there is nothing for foldClosedEpochs to key on), and it carries
// a `via:` channel (so a reader can see at a glance which of the two rows on a
// `stake:pot/…  → handle` shape they are looking at). The trailing `via:` cannot
// collide with TRANSFER_RE, which requires `· via: mail:` immediately after the
// count — here `· for: unstake` sits between them — and the whole pot block is
// classified above TRANSFER anyway, for the reason the world pair is.
const POT_UNSTAKE_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · stake:pot\/(${POT_ID_CLASS}) → (\S+) · ([1-9]\d*) · for: unstake · via: (\S+)$`);
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
export const HOLO_MINT_RE = new RegExp(String.raw`^- (\d{4}-\d{2}-\d{2}) · holo · (\S+) · (\d+) · pot:(${POT_ID_CLASS}) · epoch:(${EPOCH_CLASS}) · ref: (\S+)$`);

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
  if ((m = WORLD_TOWN_RETURN_RE.exec(canonical)))
    return { kind: 'world-town-return', date: m[1], mark: m[2], handle: m[3], n: Number(m[4]), removal: m[5] };
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
  if ((m = POT_UNSTAKE_RE.exec(canonical)))
    return { kind: 'pot-unstake', date: m[1], pot: m[2], handle: m[3], n: Number(m[4]), via: m[5] };
  // The post trio sits above TRANSFER with the world and pot pairs: a post stake
  // or unstake carried by a letter reads `via: mail:<id>` at its tail.
  if ((m = POST_STAKE_RE.exec(canonical)))
    return { kind: 'post-stake', date: m[1], handle: m[2], post: m[3], n: Number(m[4]), side: m[5], via: m[6] };
  if ((m = POST_UNSTAKE_RE.exec(canonical)))
    return { kind: 'post-unstake', date: m[1], post: m[2], handle: m[3], n: Number(m[4]), via: m[5] };
  if ((m = POST_RETURN_RE.exec(canonical)))
    return { kind: 'post-return', date: m[1], post: m[2], handle: m[3], n: Number(m[4]) };
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
  if ((m = WELCOME_RE.exec(canonical)))
    return { kind: 'welcome', date: m[1], handle: m[2], n: Number(m[3]), household: m[4], by: m[5] };
  if ((m = QUEST_PAY_RE.exec(canonical)))
    return { kind: 'quest-pay', date: m[1], handle: m[2], n: Number(m[3]), quest: m[4], household: m[5], by: m[6] };
  if ((m = INVITE_RE.exec(canonical)))
    return { kind: 'invite', side: m[6] ? 'invited' : 'inviter', date: m[1], handle: m[2], n: Number(m[3]), invited: m[4], inviter: m[5], activated: m[7] ?? null, by: m[8] };
  if ((m = RECREDIT_RE.exec(canonical)))
    return { kind: 'post-recredit', date: m[1], handle: m[2], n: Number(m[3]), post: m[4], stage: m[5], by: m[6] };
  if ((m = CORRECTION_BURN_RE.exec(canonical)))
    return { kind: 'correction-burn', date: m[1], handle: m[2], n: Number(m[3]), sig: m[4], by: m[5] };
  if ((m = PARCEL_BURN_RE.exec(canonical)))
    return { kind: 'parcel-burn', date: m[1], handle: m[2], n: Number(m[3]), nth: Number(m[4]), household: m[5] };
  if ((m = STAGE_RE.exec(canonical)))
    return { kind: 'post-stage', date: m[1], handle: m[2], n: Number(m[3]), post: m[4], stage: m[5], by: m[6] };
  if ((m = AWARD_RE.exec(canonical)))
    return { kind: 'post-award', date: m[1], handle: m[2], n: Number(m[3]), post: m[4], label: m[5], by: m[6] };
  if ((m = ISSUANCE_RE.exec(canonical)))
    return { kind: 'town-issuance', date: m[1], handle: m[2], n: Number(m[3]), purpose: m[4], by: m[5], note: m[6] };
  if ((m = FRIENDSHIP_RE.exec(canonical)))
    return { kind: 'friendship', date: m[1], handle: m[2], n: Number(m[3]), friendWith: m[4], cause: m[5] };
  if ((m = TRANSFER_RE.exec(canonical)))
    return { kind: 'transfer', date: m[1], from: m[2], to: m[3], n: Number(m[4]), id: m[5] };
  return { kind: 'unknown' };
}

// ── stamp-ledger parsing + the primary-mint fold ─────────────────────────────

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

// PRIMARY mint alone — the arrow-bearing `MINT → handle` rows. This is what
// foldMintCount was before the holo row became liquid, kept under its own name
// so the ownership read can still show the sources apart. Nothing else should
// reach for it: "how many stamps has this handle ever generated" is
// foldMintCount, all sources, which is what the doors and the tenses ask.
export function foldPrimaryMint(entries) {
  const mc = new Map(); // handle -> cumulative primary mint
  for (const e of entries) {
    const m = /^- \d{4}-\d{2}-\d{2} · (\S+) → (\S+) · (\d+) · /.exec(e.canonical);
    if (!m) continue; // markers
    if (m[1] === 'MINT') mc.set(m[2], (mc.get(m[2]) ?? 0) + Number(m[3]));
  }
  return mc;
}
