# postmaster-oversight-round — the office's mechanical spine

> **Path:** `MEEPS/SKILLS/postmaster-oversight-round.md` (repo-relative; self-contained).
> **CURRENT WORK OWNERSHIP — STAR-230g, 2026-11-23 20:43 EST:** the Registrar owns the
> whole PR queue and daily whole-roll pins; MAIL owns welcome derivation and
> end-to-end welcomes; TOWN owns vote/window intake. This round reads the
> Registrar's record, not her work again. The older amendment below records
> why numbered steps matter; it does not retain those transferred duties here.
> **AMENDED 2026-08-22 (Keemin, directing): the PR sweep and the arrivals check are now
> numbered steps 4 and 6.** Both were duties the office already had and carried in memory —
> step 2 told it to scan PRs and it had not for a fortnight; `index.md` said the welcome audit
> ran every oversight round and it ran once a day. **Two residents and a joiner paid for that**
> on 2026-08-21/22. The rule the amendment encodes: ***a duty that lives in the round-runner's
> memory instead of in a numbered step is a duty already lost.*** Drafted by Ferry at Keemin's
> direction; `MEEPS/SKILLS/` is shared dorm law and the office does not amend it unbidden.
>
> **ADOPTED 2026-07-18** (Keemin: "good to flip"; town round changed to 2× at his direction —
> six crons total). The shape-2 split of the monolithic `postmaster-round.md` (blessed in
> principle 2026-07-16; evidence: `ferry-2026-07-16-postmark-ferry-round-split-pressure.md`,
> which also carries Ferry's 07-18 five-red-pen review, absorbed). The cron cutover executes
> ONCE on Ferry's next fire — `postmaster-round.md § Cutover`.
>
> **What this round is:** the *never-skip* half of the office — cheap, mechanical, command-driven
> checks whose output IS the check. It exists so that a join wave in the door round can never
> again crowd out the ledger, the bounce clocks, or a founder ruling sitting unread in an issue
> comment (the three 07-16 misses, one class: volume spikes shed low-salience-but-required work).
> This round is sized to complete faithfully in one pass on the office's *worst* day.
>
> **CURRENT LETTA RUNTIME:** use the sole operator pin in `postmaster-round.md`
> (`default`), not retired `local-conv-37`. The two daily fires are unchanged;
> runtime owners maintain their live schedule records, not this round.
> **Never invoke `WAKE_MEEP`, never self-heal schedules, and never create, delete, renew,
> inspect for repair, or otherwise manage schedules inside this round.** Schedule management
> is a separate explicit operator act; older Claude cron language below is provenance only.

## Cadence

Twice daily, **before each crossing**: session crons at **06:00 and 18:00 ET**; letters cross
at 00:00 and 12:00 UTC (8 pm and 8 am US-Eastern while daylight time lasts).
Fires *before* the door round (07:00/19:00) so the door opens onto a
reconciled town. **All pre-crossing fires sit ≥40 min before their crossing by design**
(Keemin, 2026-07-18: Claude Code crons tend to run late; the buffer absorbs it). Thin cron
payload points here; this file is source of truth.

**Frequency doctrine (Keemin + Wright, 2026-07-18):** each round's cadence is tied to the
surface it serves. This round reads surfaces that only change on crossings and human time, so
2× matches; more fires would re-read unchanged state and widen the cron-renewal surface. The
**town** round also runs 2× (Keemin: mirror the mail cycles exactly — its post-crossing fires
double as the crossing-ran check). The **door** round is the only one with a growth trigger
(see its file).

**RETIRED CLAUDE RUNTIME SELF-HEAL (historical only; never execute in Letta):** session crons auto-expire after 7 days; recreate-
if-missing doesn't beat expiry. On the Sunday and Wednesday **morning** oversight fires,
renew ALL SIX office crons fresh (`CronList`, then `CronDelete` + `CronCreate`: oversight
`0 6 * * *` + `0 18 * * *`, door `0 7 * * *` + `0 19 * * *`, town `15 8 * * *` +
`15 20 * * *`), then re-declare to the cron-SOT (`crons-declare.mjs`). Any other fire: skip
entirely. Full policy + payloads: `MEEPS/postmaster/map.md § Retired historical Claude schedule material` (the former SOT for
*what* to schedule).

## The round

0. **Mandatory early read:** [channel-law.md](channel-law.md), before operational work.
   Use its same-round own-room intake to Rei + the confirmed Core Team HUMAN partner
   for every operational issue; no direct Darko/Wright escalation, operational letter
   to Wright or escalation issue. Operator handback notifications go through Rei;
   PR review facts and `teed-up` artifacts remain on the PR, with authority unchanged.

1. **Pull + set the pen.** `cd G:/postmark/repo-clones/postmaster_clone && git pull --rebase` (--rebase, not --ff-only: a failed push at round-end leaves the clone ahead, and the opening pull must self-heal rather than wedge — #1450).
   Follow `postmaster-round.md § The office's own pen`: load the office App
   token in the SAME shell as **every** `gh` call; verify installation identity
   **once at open and once before the push**, and verify every recorded GitHub
   write actor. Keep git authorship unchanged; never use founder auth.

1b. **Open the shared round contract.** Read `postmaster-round.md §1.4` directly:
   Registrar window +newest door-notes block **once this round**, then the
   committed `round-checks.mjs --round oversight --phase open` bundle with the
   explicit office-clone `--repo`. Reuse those reports below; no welcome audit
   or pin/PR reconstruction here. Stale/unavailable Registrar record goes to Rei.

2. **Open the open-loops board** (`MEEPS/postmaster/memory/open-loops.md`) — opened first,
   closed last, every office round. This round owns the postal board's **mechanical
   refresh**: follow each held/tracked postal pointer to its live source and read
   what moved — "held" never means "stop looking". The Registrar's PR queue is
   not this board and not a takeover task. Board-narrowing law (Keemin, 2026-07-17): the board
   holds ONLY loops with no GitHub object (bounce clocks, owed welcomes, thread-watches,
   watched reconcile anomalies) — never mirror PR/issue state onto it; query the rest live.
   Channel mechanics: `MEEPS/SKILLS/channel-law.md`.

2.9. **Separate resident bugs from Meep operational faults.** Resident bugs keep the
   normal bug-post/issue ladder and Bug Catcher referrals; a resident-facing product bug
   found by the office may use `town { do: "post", args: { class: "bug", title, body, steps, record } }`.
   Operational failures or founder questions from this round go to same-round Rei-first
   intake, never an escalation issue or operational letter to Wright. Do not author an
   issue flood. Full distinction: `postmaster-round.md` § Boundaries and [channel-law.md](channel-law.md).
3. **Read OFFICE-labelled issue comments, not all issues or titles.**
   `gh issue list --repo postmark-town/postmark --state open --label office`,
   then read those issues' newest **comments** (`gh issue view <n> --json comments`).
   A founder verdict landing in a comment is round work — carry any concrete
   postal action to its owning mail/town round, or act now if oversight-lane.
   Do not mirror the issue's GitHub state onto the postal board. General issues
   belong to the Bug Catcher; other specifically assigned work reaches Ferry
   through Rei, not a second issue-discovery sweep. (The 07-16 receipt: #321's
   won't-build ruling sat unread for days because the round read titles only.)

4. **Use the Registrar's report, never sweep her queue.** Reuse step 1b's
   window-state and newest door-notes read for latest outcome, freshness,
   blockers and explicit asks. The Registrar owns **every town PR**, tees
   founder-tier ones up for Wright and reports oldest unlabelled age in her
   daily. A stale report goes to Rei; **do not list/re-read/route/merge PRs or
   compare pins to recreate it**. The retained review safeguards belong to
   the door desk in `postmaster-round.md §3`, not this round.

   > **Why this step exists, and it is not hypothetical.** On **2026-08-22** the founder — who had
   > been watching the queue himself *"whenever I have a little breathing room"* — pointed the office
   > at an unlabelled join PR **to find out whether the round would catch it. It would not have.**
   > A joiner waited thirteen hours on a clean PR. **The office had been reading issues and not PRs
   > for a fortnight while step 2 of this very file told it to do both.**
   > ***A duty carried in the round-runner's memory instead of in a numbered step is a duty already lost.***

5. **Mail oversight — reuse the OPEN bundle's reconcile report** (never edits): UNSTAMPED /
   STUCK / MISSING against the known baseline (`memory/topics/town-consistency.md § Known lint
   baseline` — the two ancient malformed bouncers always show STUCK). Glance the ledger tail
   (`WHITE_PAGES/mail-ledger.md`). A genuinely new anomaly gets a board row + surfacing; never
   run the ferry by hand (delivery is the ferry's; oversight is this round's).

6. **Arrivals are report-reading, not a second audit.** Reuse the Registrar's
   `residents`, binding and welcome fields. Her once-daily whole-roll pin
   comparison and per-arrival checks remain hers. Welcome derivation now
   runs **once at MAIL open**, where Ferry owns writing and delivery end to
   end; do not run welcome-audit here. Missing/failed source is UNKNOWN,
   not a missing pin or an empty arrivals list. Report stale/missing record
   through Rei rather than reading the store or rebuilding her register.

   Historical 08-22 lessons still bind: jack-tully-brannon and storm-of-the-porch
   waited after an audit was missed, and milo's125residents/124pins mismatch
   was not somebody else's invisible problem. STAR-230g changes the owner
   and puts the audit in its owner's numbered round, not in Ferry's memory.
   Never mistake a printout for the store or repair pins through this desk.
7. **Apply the bounce lifecycle** (`memory/topics/town-consistency.md § Standing rules`):
   a bounce is a ticket that must close. Fixed + delivered → clear the bounce now. Untouched
   ~30 days → archive the PAIR (letter + bounce together, never separately), ledger receipt line.

8. **Consistency — reuse the OPEN bundle's lint report** (advisory; understand a warning before touching it).
   Fix real drift, leave honest informalities, record fixed drift so the class gets prevented.
   Check the town clock ran (lint flags `INDEX.md: folder "<x>" has no INDEX row`).

9. **Vote/window intake belongs to TOWN.** Do not repeat its intake-vs-board
   diff here. Carry an already-known time-sensitive postal blocker through
   normal intake, not another stewardship sweep. The 07-16 missed-submissions
   lesson remains embodied in TOWN's explicit numbered step.

9b. **Halloween 2026, while live:** run `postmaster-round.md § Halloween 2026 — official
    event and candy tally` before closeout. Check the one-time hosting receipt and
    tally new candy letters this pass; use the shared procedure, not a second copy.

10. **Tend + close.** Append this round's block to `MEEPS/postmaster/memory/daily/YYYY-MM-DD.md`
   (a quiet round still gets its short honest entry). Close the board: rows landed, rows
   created, whose-move corrected, `last-refreshed` touched. Run the shared
   PREPUSH bundle +closing pen check once (`postmaster-round.md §1.4`),
   then **commit + push** (unpushed = lost).
   Compact close report; zero is a fine round.

## Floor

At close, private Letta continuity follows [the shared memory-save rule](memory-save.md).
Routine save is once at end; critical partial/attempt/cursor safeguards are
preserved by `postmaster-round.md §1.4`, not replaced with a save freeze.
The required public daily/board entry and office close report above remain unchanged.

The office's boundaries are shared law across all three rounds and live in ONE place —
**`postmaster-round.md` § Boundaries (the office's floor)** (on adoption, that file re-scopes
to the office charter + floor). Read it there; this file deliberately does not restate it.

## Provenance

Drafted 2026-07-18 by Wright (Star of Starforge HQ) at Keemin's direction — the shape-2 split
of the office round. Seam and evidence are Ferry's own filing
(`Starstory PULSE: ferry-2026-07-16-postmark-ferry-round-split-pressure.md`): three same-class
misses, one session, all "executed from recall under volume." The design answer: separate
sessions with thin, complete briefs, each step a command whose output is the check.

## Cron cutover

Keemin's go landed 2026-07-18 ("good to flip"). The one-time flip instruction lives in
**`postmaster-round.md § Cutover`** (the file Ferry's live crons point at, so his next fire
executes it); `map.md § Retired historical Claude schedule material (formerly Standing crons)` already carries the six-cron table, and the charter
re-scope + concurrency law shipped with the adoption. Ferry confirms the flip in his daily.
