# CALLS.md — world_stake (write-release P3), draft judgment log

Every call a ruling didn't cover, with the options, the choice, the reason, and how
reversible it is. **All provisional. Keemin adjudicates from this file.** Nothing here
is pushed; three local draft branches carry the code.

Branches: `world-stake-draft` in `postmark-town-jetto2`, `postmark-world-jetto2`,
`office-jetto2`.

Ruled already, and NOT re-litigated here: extend the sealed mint (P0, "B"); the
`stake:world-mark/<mark-id>` target class; resident-initiated unstake; weight = sum of
open escrows read as stable signed inputs; retirement gated on zero escrow; the stamp
ledger stays the one money ledger; dregg's conformance corpus as a hard requirement.

## Adjudication applied — 2026-07-28

This remains the draft's judgment record; the gold plan's activity-log entry
`2026-07-28 — the draft-calls adjudication slate + RULING 8` is the ruling
authority. The P3 build gate applies it as follows:

- calls 1 and 2: blessed verbatim — the two world-mark line shapes stand and
  `world-mark` remains reserved out of ballot topics;
- calls 3 and 8: ratified — unstake has no friction and self-stake is allowed;
- call 4: **reversed** — there is no household cap and therefore no cap clip;
  a stake clips only to the resident's liquid balance;
- call 6: extended by the ruled economy subset — the town still derives the
  world's input, but mark weight is now `Σ open escrow + k × unique staking
  households`, with household identity resolved from the town's pins.

---

## 1. The line shape — a mark id carries a slash, so "reuse the existing shape" can't be literal

**Not a judgment call I sought; the ruling could not have known it.** The ruled target
class is `stake:world-mark/<mark-id>`, and Q1 says it reuses the existing line shape.
But a mark id is `<by>/<slug>` — it contains a slash, and `STAKE_RE`'s candidate class
is `[A-Za-z0-9-]`, deliberately slash-free so a vote candidate can never be
path-shaped. `stake:world-mark/wright/the-crossing-bench` therefore cannot match the
ballot's regex at all.

- **(a) Widen the ballot's candidate class to admit `/`.** Rejected: it loosens
  vote-candidate law for a world-side reason, and the comment above that regex records
  a 2026-07-19 replay break caused by the last change to it.
- **(b) Give the class its own two shapes** (`WORLD_STAKE_RE`, `WORLD_UNSTAKE_RE`).
  **CHOSEN.** Ballot regexes untouched; vocabulary unchanged (still `stake:` out,
  still a movement line, so conservation folds it structurally with no change); the
  mark id stays literal in the ledger, which is what Keemin's deciding argument for B
  — resident legibility — depends on.
- **(c) Encode the slash away** (`wright~the-crossing-bench`). Rejected: the ledger
  would stop showing the real id.

**Reversible:** yes, before any real line is written. After that, no — the shape is in
the sealed chain.

## 2. `world-mark` is reserved out of the ballot's topic space

Found by the corpus, and the reason dregg wanted one. `world-mark` is a legal *ballot
topic* name, so a malformed world stake — `stake:world-mark/thebench`, the household
half of the id dropped — parsed **perfectly as a vote stake on a topic called
"world-mark"**. It would have failed later for want of a ballot file, but it failed as
the wrong KIND, and silent misclassification is how stamps move somewhere nobody asked.

**CHOSEN:** a negative lookahead reserving `world-mark` on both `STAKE_RE` and
`RETURN_RE`. **Reversible:** yes. **Note:** this is the one place I did touch the
ballot's regexes; it only ever *narrows* them, and only for a name the world now owns.

## 3. Q2 — unstake friction: NONE, beyond ownership

Explicitly deferred to this gate. The ballot has no unstake at all ("final for the
window"); world stakes are standing claims a resident may withdraw.

- **(a) No friction.** **CHOSEN.**
- (b) A cooldown (no unstake within N crossings of staking).
- (c) Partial return / a burn on withdrawal.
- (d) One unstake per mark per crossing.

**Why (a):** stakes are existence-anchors, not bets, and every friction option is a
governance guess about behaviour nobody has observed yet. Baking one in now would be
the expensive kind of default — it would look like law by the time anyone questioned
it. What I did NOT skip is the part that isn't friction but safety: an unstake clips to
the staker's **own** open position, enforced in the engine and again in the verifier.

**The risk, named:** with zero friction a resident can churn stake/unstake and flicker
a mark's ✦weight, which the whole town sees. If that turns out to matter, (b) is the
cheapest fix and needs no grammar change — a date comparison in the engine.
**Reversible:** fully.

## 4. Q4 — caps: draft chose 20 per household; build gate reversed it to NO CAP

Explicitly deferred to this gate. The ballot reads
`cap_per_household_per_candidate` from a per-topic JSON file; marks have no such file.

- **(a) No cap.** Rejected: one wealthy household could dominate every mark's weight.
- **(b) A constant.** **CHOSEN** — `WORLD_MARK_CAP_PER_HOUSEHOLD = 20`, matching the
  ballot's default so the number a resident already learned at the vote carries over.
- (c) A per-mark config file. Rejected for a draft: it invents a new record type and a
  new question (who sets a mark's cap — its author? the town?).

Defined **once** in `stamp-mint.mjs` and imported by the verifier and the door, so law
and gate cannot disagree. The cap is on what is **currently** staked, so an unstake
returns headroom. **Reversible:** yes — but note that lowering it later would make
already-lawful history unlawful, so it is easier to raise than to lower.

**ADJUDICATED 2026-07-28:** option (a), no cap. The draft choice above is
preserved as the record of what was on the table; it is not the built law.

## 5. Where world-stake lines live: the main ledger

**CHOSEN: the one money ledger**, `WHITE_PAGES/stamp-ledger.md`. Not a judgment so much
as an application of the ruling's own sentence ("the stamp ledger stays the one money
ledger — that was true in both branches and is now simply true"). A sub-ledger would
split conservation across two files and end the property that one fold answers "where
is every stamp". Recorded because it was on the expected-members list.
**Reversible:** no, once lines exist.

## 6. Escrow-vs-balance read for the fold: escrow, and the world parses no money

The ruling says weight = sum of open escrows, read as stable signed inputs, no
balance-coupled dimming. Implemented as a fold over sealed lines
(`foldWorldMarkEscrow`), so a mark's weight cannot move when a resident's liquid
balance moves — only when someone stakes or unstakes on purpose.

**The call I had to make on top of that:** *which repo parses the money lines.* The
world's `loadStakes()` was reading `WHITE_PAGES/stamp-ledger.md` under the WORLD root
for a `stake:mark:<id>` grammar — a path that never existed there (the ledger is in the
town) **and** a grammar the mint could never produce. That is the read-side orphan
flagged 2026-07-23; every mark's ✦weight has been silently 0.

- **(a) Mirror the grammar in the world repo.** Rejected: a second definition across a
  repo boundary, where no import can keep them honest.
- **(b) The town derives the world's input.** **CHOSEN.**
  `node tools/world-stake.mjs --escrow --json > stakes.json` → `marks-fold.mjs
  --stakes stakes.json`. Exactly one parser of the money lines in the two repos; the
  world repo now contains no money parser at all.

**The cost, named:** it adds a pipeline step. Without the file the world folds with
zero escrow — honest, not broken. **Who runs it** is unresolved and is the first thing
a real deployment needs: the box's rehydrate timer is the obvious home.
**Reversible:** fully.

## 7. Retirement-gate enforcement point: the fold, as an invariant

- (a) At the office door (refuse a retire call).
- (b) In `mark-lint`.
- **(c) In the fold, as ESCROW IMPLIES EXISTENCE.** **CHOSEN.**

Keemin's rule ("a mark is not retired until it hits 0 stamps") is not really a
permission check — it is an invariant, and the fold already enforced it as an unnamed
`stake on unknown mark` error. Retiring a staked mark cannot fold clean, because the
escrow still names it. So the gate needed no new machinery, only its right name and a
message saying what to do (return the escrow first).

**Why not the door:** retirement isn't a door verb yet, and a check that lives only
where the call happens is bypassed by anyone editing the record directly — which is how
marks are made today. The fold is the choke point every path goes through.
**Reversible:** yes; it is one error message and one predicate
(`retirementBlocked()`), reusable wherever a retire verb eventually lands.

## 8. Self-stake: ALLOWED

May a resident stake on their own mark?

- **(a) Allow.** **CHOSEN.**
- (b) Forbid (self-dealing inflates your own weight).

**Why:** the stamps are really escrowed — a genuine cost, not a free vote — and the
ballot has no self-vote prohibition to mirror. Backing your own mark is also the most
natural first act, and the fixture demo is exactly that (wright stakes 6 on his own
bench).

**This is the call I most expect to be overruled**, because weight is a *public*
ranking signal and self-staking is the cheapest way to buy prominence. If Keemin wants
it forbidden it is a two-line check (`mark.split('/')[0] === handle`) in the engine and
the verifier. **Reversible:** yes, though existing self-stakes would need grandfathering.

## 9. Mark existence is the door's gate, not the ledger's

The ledger engine reads only the town's ledger, so it **cannot** know whether a mark
exists. Staking a nonexistent id is therefore lawful-but-meaningless at ledger level:
real stamps escrowed against an id nothing reads.

**CHOSEN:** the door refuses it (it holds the world clone), and the fold catches the
other direction (escrow naming an absent mark). Deliberately **not** applied to
unstake — taking your stamps back must never depend on the record's state; if a mark
vanished while your escrow stood, unstaking is the repair.

**The gap, named:** a stake written by any path that bypasses the door — a hand-edited
ledger, a future mail-carried stake — has no existence gate. **Reversible:** yes; the
honest fix is a crossing-time reconciliation pass, not more door code.

## 10. Zero-stamp lines refused on the new class only

`(\d+)` accepted `· 0 ·`. Tightened to `[1-9]\d*` on the world class, following
`GIFT_RE`'s precedent. **The ballot's `STAKE_RE` has the same looseness and I did NOT
touch it** — that is live law with thousands of lines behind it, and tightening it
could make a historical line unparseable. Recorded as an observed asymmetry rather than
fixed in passing. **Reversible:** yes on the new class; the ballot's is a separate call
with a replay question attached.

---

## Not built, and honest about it

- **No mail-carried stake lane.** The grammar accepts `via: mail:<id>` (and the corpus
  tests that it classifies correctly rather than folding as a transfer), but no
  crossing pass reads stake requests out of letters. API only, for now.
- **Nothing ran against a real pen key.** Both doors answer `409 not-yet-open` without
  one; the engine is exercised only against test-generated keys in synthetic towns.
- **The bodyless-mark and rivalry interactions are untested.** Stakes feed
  `slot.values` and the rivalry resolution in the fold; I verified weight and fan-up,
  not what a staked *contested* claim does to a rivalry. Named because it is the next
  thing I would test, not because I think it is broken.
- **No unstake-all / close-out verb.** A resident with escrow on twelve marks unstakes
  twelve times.
