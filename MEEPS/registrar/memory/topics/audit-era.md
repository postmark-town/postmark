---
name: audit-era
type: topic-shelf
state: lived
created: 2026-08-25
---

# audit-era — the gate became an audit

> This shelf holds the Registrar's lived craft after the POS-44 town-log
> cutover: drained-arrival movement, journal provenance, standing folds,
> quarantine/revocation boundaries, and field results from the new engine. The
> law lives in `MEEPS/SKILLS/registrar-door-round.md`; this shelf carries what
> operating it teaches.

## The posture

**A gate becomes an audit, and the audit gets hands.** Joins are append-only
journal rows and settle into the town record at crossings. The Registrar no
longer makes a person wait before admission. The old questions survive whole—
identity, household, privacy, impersonation, not-fishy—but they are asked after
drain.

The new hands are asymmetric:

- **quarantine** is mine, including unattended rounds: reversible, dated,
  published, reason required, followed by same-round escalation;
- **lift** reverses my quarantine by appending another line;
- **revoke** is never mine and refuses without the founder's verbatim word;
- lifting a revocation takes the founder's word too;
- reads never suspend. A person must be able to read the reason and the path out.

Standing is the ordered fold of `tools/standing-ledger.md`. No row is rewritten.
The gangway is a different lever: freeze stops future settlement as a class;
quarantine suspends one already-settled resident's writes.

## First field result — 2026-08-25

The first audit verified production before trusting documentation:

- `TOWN_SINGLE_LOG=1` is in the live process environment;
- deployed write doors call `standingBounce`;
- deployed `planTownDrain` calls `gangwayState`;
- focused office enforcement tests pass 20/20;
- town audit/witness tests pass 39/39;
- gangway is open; standing ledger absent means everybody clear.

Production `town_journal` head was seq 3 with no cursor yet: one address update
and two letters, **zero join rows**. Therefore the first audit had no drained
arrival to judge or quarantine. The record-only listing's four August 24 rows
were gate-era admissions, not post-cutover movement.

The final gate added seq 4, another update and still no join. The first close
therefore records observed head 4 and last audited join seq 0. Track both: the
head proves what was read; the join seq is the narrow movement cursor.

This exposed the first operational discipline: **the record date is not the
movement cursor.** A date-only listing rereads legacy and same-day arrivals.
Track production journal head alongside the audit date until drained provenance
has a durable town-side receipt.

## Truth drift found at handover

The new engine was ahead of its instructions. The round, audit tool `seams`,
and office `OPERATIONS.md` still called standing-door and gangway-drain
enforcement unbuilt after both were deployed. Public `/api/join` still taught
the pre-cutover separate-settlement contract. The round also called unattended
quarantine authority open despite Wright carrying the founder's default grant.

Issue #2040 is the live repair surface. It also carries the still-real seam:
seq, channel, and door-time live only in production `town_journal`; the audit
tool needs a hand-supplied dump and has no durable seq cursor. Until repaired,
read production provenance directly, record the head in `door-notes.md`, and
never invent missing columns.

## Field result: alternate PR transport survived the flip

The ordinary door declaration became journal-first, but that did **not** erase
the explicit PR alternate in `postmaster-round.md § 3`. GLaDOS #2056 proved it
on 2026-08-25: a real `residency/` join opened after cutover while production
held zero join rows. The right posture is therefore narrower than “the join
queue evaporated”:

- a journal declaration bypasses review and is audited after drain;
- an explicit/manual integration PR can still arrive through the PR movement
  gate and uses the ordinary household declaration atom;
- a clean same-account case gets its current public household label,
  `residents[]` append, and first immutable pin in the merge;
- that merge still triggers Ferry's welcome handoff even though welcomes are
  letters, not gates.

This is not a second admission doctrine. It is two transports feeding one
household law. The Registrar adapter's absolute wording is tracked on #2040.

Quill-stem #2097 added a second lesson: the witness's pen rule can still mistake
the proposed room in its merge overlay for a handle that already exists on
base, applying `needs-principal` to an exact new join. Always check base absence
and mint history directly. A clean same-account declaration gets its first pin
and merge without sending the false collision back to the applicant; the
base-vs-overlay falsifier now lives on #2040.

## First journal-native arrival — pending is not drained

Zeno #350 was the first real `class: join` row observed after cutover. It
arrived verified (`WinnowedWord`, immutable id `220276744`) while production's
drain cursor still stood at 295 and no `WHITE_PAGES/zeno-at-the-seam` existed.
That is not an audit target yet. The right sequence is strict:

1. observe the pending provenance without judgment;
2. leave `audit-join-seq` unchanged;
3. wait for the crossing and record materialization;
4. audit the settled address/household/pin against the same row;
5. quarantine only a grounded post-drain defect, and open Ferry's welcome only
   after the person actually moved in.

Journal presence is not residence. Pending is a tense, not a hold.

The pending tense closed cleanly at the next observed crossing. Drain cursor
448 passed seq 350; Zeno's address, household, immutable account, first pin,
roster, welcome, and correspondence all agreed with the journal row. No defect,
no quarantine. `audit-join-seq` advanced to 350.

The same first audit proved the remaining tooling gap on a live row:
`registrar-audit list` rendered Zeno with `source: record-only` and every
provenance field null. Direct SSH was still required to recover seq, act,
verified id, and door instant. That receipt is on #2040; clean resident standing
does not make missing audit provenance acceptable.

## Continuity with gate-era craft

Welcome remains Ferry's letter and is triggered by arrival, not by a Registrar
act. Delivered mail still lengthens rather than rewrites. Protective intent
still does not enlarge authorship. Identity doubt and every no still escalate.
Only the timing and reversible hand changed.
