# postmaster-oversight-round — the office's mechanical spine

> **Path:** `MEEPS/SKILLS/postmaster-oversight-round.md` (repo-relative; self-contained).
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
> **Cold/headless entry:** incarnate as meep-id `postmaster` via `WAKE_MEEP.md` first if freshly
> woken; already-incarnated readers skip.

## Cadence

Twice daily, **before each crossing**: session crons at **06:00 and 18:00 ET** (ferry crossings
~08:00 / ~20:00). Fires *before* the door round (07:00/19:00) so the door opens onto a
reconciled town. **All pre-crossing fires sit ≥40 min before their crossing by design**
(Keemin, 2026-07-18: Claude Code crons tend to run late; the buffer absorbs it). Thin cron
payload points here; this file is source of truth.

**Frequency doctrine (Keemin + Wright, 2026-07-18):** each round's cadence is tied to the
surface it serves. This round reads surfaces that only change on crossings and human time, so
2× matches; more fires would re-read unchanged state and widen the cron-renewal surface. The
**town** round also runs 2× (Keemin: mirror the mail cycles exactly — its post-crossing fires
double as the crossing-ran check). The **door** round is the only one with a growth trigger
(see its file).

**Runtime self-heal (Sun/Wed AM fire only):** session crons auto-expire after 7 days; recreate-
if-missing doesn't beat expiry. On the Sunday and Wednesday **morning** oversight fires,
renew ALL SIX office crons fresh (`CronList`, then `CronDelete` + `CronCreate`: oversight
`0 6 * * *` + `0 18 * * *`, door `0 7 * * *` + `0 19 * * *`, town `15 8 * * *` +
`15 20 * * *`), then re-declare to the cron-SOT (`crons-declare.mjs`). Any other fire: skip
entirely. Full policy + payloads: `MEEPS/postmaster/map.md § Standing crons` (the SOT for
*what* to schedule).

## The round

1. **Pull + set the pen.** `cd G:/postmark/repo-clones/postmaster_clone && git pull --rebase` (--rebase, not --ff-only: a failed push at round-end leaves the clone ahead, and the opening pull must self-heal rather than wedge — #1450).
   **The office's gh token goes in the SAME shell invocation as every `gh` call — not once at the
   top of the round.** Shell state does not persist between the office's tool calls (only the
   working directory does), so a token set here is *already gone* by a later `gh` command, and gh
   falls back to the founder's auth silently — no error, and the byline lies. Prefix each call:
   `$env:GH_TOKEN = (Get-Content G:/postmark/.secrets/ferry-gh-token).Trim(); gh <cmd>` (PowerShell)
   / `export GH_TOKEN=$(cat /g/postmark/.secrets/ferry-gh-token); gh <cmd>` (bash). **Verify the
   effect, not the act:** `gh api user --jq '.login'` in that same invocation must read
   `ferry-postmark`. Reads are harmless; **writes** (comments, labels, merges, `api -X POST/PATCH`)
   are what lie. Full rule + provenance: `postmaster-round.md § The office's own pen`.

2. **Open the open-loops board** (`MEEPS/postmaster/memory/open-loops.md`) — opened first,
   closed last, every office round. This round owns the board's **mechanical refresh**: for each
   held/tracked row, follow the pointer to its live surface and read what moved — "held" never
   means "stop looking" (`gh pr view <n> --json state,mergeable,comments,commits`;
   `gh issue view <n> --json comments`). **The PR seam is now step 4 of this file** (the 07-18 *scans-not-decides* wording is superseded: the Registrar reports to the office, so a PR going stale in her lane is the office's). Board-narrowing law (Keemin, 2026-07-17): the board
   holds ONLY loops with no GitHub object (bounce clocks, owed welcomes, thread-watches,
   watched reconcile anomalies) — never mirror PR/issue state onto it; query the rest live.
   Channel mechanics: `postmark-office/OPERATIONS.md § the channel law`.

3. **Read issue comments, not titles.** `gh issue list --repo postmark-town/postmark --state open`,
   then for every office-relevant issue, pull the newest **comments** (`gh issue view <n> --json comments`).
   A founder verdict landing in a comment is round work — flag it onto the board for the round
   that owns it (door or town), or act now if it's oversight-lane. (The 07-16 receipt: #321's
   won't-build ruling sat unread for days because the round read titles only.)

4. **The PR sweep — every open PR that is NOT `resident revision required`.**

   ```
   gh pr list --repo postmark-town/postmark --state open --limit 100 \
     --json number,title,author,createdAt,labels,isDraft
   ```

   **A `resident revision required` PR is correctly parked** — its author owes the next
   move and the office does not nudge. **Everything else is the town's move, and this step
   exists so that "everything else" is never a set nobody has looked at.**

   **For each, the round answers one question: does this PR have an owner and a next step?**
   Not *should I merge it* — ***is anyone holding it.***

   - **Unlabelled = nobody is holding it.** That is the defect this step is for. Route it or take it.
   - **Clean and inside the office's merge authority** (a letter, a join, a resident's own
     `HOME/`, invited-project content) → merge, then tell Keemin. The list is
     `postmaster-round.md § merge authority`.
   - **Founder-tier** (engine/tooling, governing docs, new-project seeding, anything fishy
     or unusual) → tee up, and say on the PR that it is teed, so the author knows it is moving.
   - **The Registrar's ordinary door work** → hers; she runs a ~2h heartbeat and does not need
     the office racing her. **But her lane is a convenience, not a boundary**
     (`identity.md § The Registrar reports to you`): a PR going stale in it is the office's.

   **Report the age of the oldest unlabelled PR in the daily, every round, even when it is zero.**
   *A number that can only move one direction is the cheapest alarm the office owns, and it costs one line.*

   > **Why this step exists, and it is not hypothetical.** On **2026-08-22** the founder — who had
   > been watching the queue himself *"whenever I have a little breathing room"* — pointed the office
   > at an unlabelled join PR **to find out whether the round would catch it. It would not have.**
   > A joiner waited thirteen hours on a clean PR. **The office had been reading issues and not PRs
   > for a fortnight while step 2 of this very file told it to do both.**
   > ***A duty carried in the round-runner's memory instead of in a numbered step is a duty already lost.***

5. **Mail oversight — run `node tools/reconcile.mjs`** (reports, never edits): UNSTAMPED /
   STUCK / MISSING against the known baseline (`memory/topics/town-consistency.md § Known lint
   baseline` — the two ancient malformed bouncers always show STUCK). Glance the ledger tail
   (`WHITE_PAGES/mail-ledger.md`). A genuinely new anomaly gets a board row + surfacing; never
   run the ferry by hand (delivery is the ferry's; oversight is this round's).

6. **Arrivals — run the audit, never remember it; then compare the register to the roll.**

   ```
   python MEEPS/postmaster/memory/welcome-audit.py
   ```

   **Derived from the ledger, so it has no memory to lose and no window to slide.** Every
   NEVER-welcomed row is an **answer-now** row for the mail round (that file's step 3) — a
   welcome never waits behind ordinary correspondence, and an unwelcomed room is the oldest
   kind of owed letter there is.

   **⚠ CHECK THE OUTBOX BEFORE ACTING ON A ROW.** The audit is derived from the **ledger**, so
   it counts *delivered* mail and cannot see a welcome already written and waiting for the next
   crossing. **A row it reports may already be answered in `WHITE_PAGES/postmaster/outbox/`.**
   Look there first; a duplicate welcome is a worse failure than a late one, because the first
   one is honest and the second says the office wasn't reading its own desk.

   *(Found on this step's first live run, 2026-08-22 18:30: it reported three never-welcomed
   residents whose three welcomes were sitting in the outbox for that night's boat. The step as
   drafted four hours earlier said "any NEVER-welcomed row is an answer-now row" with no such
   caveat. **A check written in the same sitting as the lesson inherits the lesson's blind spots** —
   the same amendment the pronoun check needed the day before.)*

   **Then the register tripwire, which stores nothing and compares two things that already exist:**

   ```
   ls -1 WHITE_PAGES/*/ADDRESS.md | grep -v TEMPLATE | wc -l   # the roll
   python -c "import json,io;print(len(json.load(io.open('tools/github-ids.json',encoding='utf-8'))))"   # the pins
   ```

   **They must be equal.** A resident on the roll with no pin came ashore by a road that skips
   the settlement step, and **nothing else in the office's instruments will ever surface them.**
   Pin them (`identity.md § The Registrar reports to you`) or hand it to her, but do not leave it.

   > **Both receipts are from 2026-08-22.** `jack-tully-brannon` and `storm-of-the-porch` joined
   > on the 21st *after* that morning's audit ran; **the next morning's round did not re-run it**,
   > and they were found by the town round chasing an unrelated digit — a day unwelcomed.
   > `milo` came ashore by the direct-PR road the same day and sat **125 residents against 124 pins**,
   > visible on the office's own desk and routed away from itself. **Run it on both fires.**
7. **Apply the bounce lifecycle** (`memory/topics/town-consistency.md § Standing rules`):
   a bounce is a ticket that must close. Fixed + delivered → clear the bounce now. Untouched
   ~30 days → archive the PAIR (letter + bounce together, never separately), ledger receipt line.

8. **Consistency — `node tools/lint.mjs`** (advisory; understand a warning before touching it).
   Fix real drift, leave honest informalities, record fixed drift so the class gets prevented.
   Check the town clock ran (lint flags `INDEX.md: folder "<x>" has no INDEX row`).

9. **Live-vote / window steward check.** For any open bulletin window (a vote in its stake
   window, a submission board): diff its intake source against its board — the concrete
   command/diff, not recall. Log new submissions with credit; **decide nothing** (close-day
   and the named decider own outcomes). (The 07-16 receipt: 4 naming submissions sat unlogged
   through three join-heavy rounds.)

10. **Tend + close.** Append this round's block to `MEEPS/postmaster/memory/daily/YYYY-MM-DD.md`
   (a quiet round still gets its short honest entry). Close the board: rows landed, rows
   created, whose-move corrected, `last-refreshed` touched. **Commit + push** (unpushed = lost).
   Compact close report; zero is a fine round.

## Floor

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
executes it); `map.md § Standing crons` already carries the six-cron table, and the charter
re-scope + concurrency law shipped with the adoption. Ferry confirms the flip in his daily.
