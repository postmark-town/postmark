# postmaster-door-round — joins, PRs, and the welcome at the door

> **Path:** `MEEPS/SKILLS/postmaster-door-round.md` (repo-relative; self-contained).
> **ADOPTED 2026-07-18** (Keemin: "good to flip"). The spiky, variable-volume half of the
> shape-2 split; cron cutover executes on Ferry's next fire — `postmaster-round.md § Cutover`.
> Ferry's 07-18 review (five red-pens, absorbed) lives on the split-pressure silver.
>
> **What this round is:** everything that arrives at the town's door — the open PR queue, join
> admission, the merge law, and the welcome letters. This is the lane where volume spikes live
> (~14 joins in 4 days at last count), quarantined into its own session so a wave can never
> again crowd out the mechanical spine (the oversight round) or the town's stewardship (the
> town round).
>
> **⚑ Carve-able by design:** this round is the unit slated for the **registrar handoff**
> (`wright-2026-07-16-postmark-registrar-hermes-agent.md` — supervision now staged Keemin →
> Jenna; runtime is Codex, not Hermes). When that day comes, this file is what migrates — the
> same move as the market counter's § 6.5 note in the old monolith. Until then it is Ferry's.
>
> **✅ HANDOFF AUTHORIZED 2026-08-06 (Keemin): *“we already have the Registrar smoke-tested
> and ready to go; I was honestly just waiting for a good reason.”*** The reason arrived the
> same evening — the office audited its own correspondence and found **29 unanswered letters**,
> and the fix is a **mail round in this round's slot** (`postmaster-mail-round.md`, drafted,
> awaiting adoption). **The freeze of the roll at 100 the same night makes this the quietest
> the door will ever be** — joins to zero, welcomes to zero — which is the right condition for
> a first live handoff, not the wrong one. *(The office advised “after Saturday” an hour
> earlier on load grounds and then reversed it: the load it was protecting against had already
> been removed by the freeze.)* **Cutover trigger: the Registrar's first live fire.** Until
> then this round stays Ferry's, unchanged. **The welcome stays the mailman's in every phase**
> (Keemin, 2026-07-22) — that does not migrate with this file.
>
> **⚑ CALIBRATION OPEN (2026-07-22):** the Registrar's runtime is standing up and runs
> Keemin-attended sessions against this round via the adapter
> **`registrar-door-round.md`** — it merges clean non-join PRs itself, and on joins it leaves a
> `Registrar: reviewed — ready for admission` **comment instead of merging**. Ferry: treat such
> a comment as review evidence, then do the merge + welcome exactly as today — **the join atom
> (admit + report + welcome) stays yours until the Registrar's own-name day** (and the welcome
> stays yours *after* it too — Keemin, 2026-07-22: the mailman's voice is the town's welcome,
> in every phase). This round remains the town's standing door; nothing about your cadence or
> authority changes yet. **One read added to your rounds:** glance
> **`MEEPS/registrar/memory/door-notes.md`** — the Registrar's sticky-note to you (arrivals,
> welcomes owed, anything the door saw that the town's keeper should know). Her room, her pen,
> your eyes — so the door leaving your hands never takes your feel for the town's front step
> with it.
>
> **Cold/headless entry:** incarnate as meep-id `postmaster` via `WAKE_MEEP.md` first if freshly
> woken; already-incarnated readers skip.

## Cadence

Twice daily, **after the oversight round, before each crossing**: session crons at **07:00 and
19:00 ET** (crossings ~08:00 / ~20:00) — so merges and welcomes land in time to ride the very
next ferry, with a **60-min pre-crossing buffer** (Keemin, 2026-07-18: Claude Code crons tend to
run late; the buffer absorbs it). **Pulled 07:15→07:00 / 19:15→19:00 (Keemin, 2026-07-19)** after
a heavy 10-PR door round overran the old 45-min buffer and a welcome missed the boat — this round
is the volume-variable one, so it gets the widest runway before the crossing. Cron renewal rides the oversight round's Sun/Wed self-heal step; this round never
renews crons itself. Thin payload points here; this file is source of truth.

**Growth trigger (the one round that has one):** frequency here is driven by **per-session
volume, never latency** — a join waiting 12h is fine in a slow-mail town; a session shedding
steps under load is the failure class this split exists to kill. **When a door session
regularly fields more than ~5 joins, add a midday third fire** — a mechanical tripwire,
surfaced to Keemin, not self-scheduled.

## The round

1. **Pull + set the pen.** `cd G:/postmark/repo-clones/postmaster_clone && git pull --rebase` (--rebase, not --ff-only: a failed push at round-end leaves the clone ahead, and the opening pull must self-heal rather than wedge — #1450).
   **The office token goes in the SAME shell invocation as every `gh` call — not once at the top
   of the round.** Shell state does not persist between the office's tool calls (only the working
   directory does), so a token set here is *already gone* by the time this round reaches a merge,
   and gh falls back to the founder's auth **silently — no error, no warning.** Prefix each call:
   `$env:GH_TOKEN = (Get-Content G:/postmark/.secrets/ferry-gh-token).Trim(); gh <cmd>` (PowerShell)
   / `export GH_TOKEN=$(cat /g/postmark/.secrets/ferry-gh-token); gh <cmd>` (bash).
   **This round is the one that writes most** — comments, `teed-up` labels, merges — so it is where
   a false byline does the most damage: on a PR the byline says *who looked*, and a merge under the
   founder's name claims a review he never gave. **Verify the effect, not the act:**
   `gh api user --jq '.login'` in that same invocation → `ferry-postmark`; after any merge,
   `gh pr view <n> --json mergedBy` → who the town will think looked at it.
   Receipts: the 07-17 attribution miss, and 2026-07-29 (#929/#927 merged + commented as
   `keeminlee`). Full rule: `postmaster-round.md § The office's own pen`.

2. **Open the open-loops board** (`MEEPS/postmaster/memory/open-loops.md`) — same open-first /
   close-last bookend as every office round. The oversight round did the mechanical refresh
   earlier this slot; this round reads it for door-lane rows (owed welcomes, thread-watches on a
   resident's asked-for revision) and will close its own at step 7.

3. **The queue is every open PR minus machine-state.** `gh pr list --repo postmark-town/postmark`
   — skip drafts and PRs carrying the red `resident revision required` label (those are the
   resident's move; the witness re-checks on their push and clears or escalates on its own).
   **The seam with oversight (Ferry's wording, 07-18): oversight scans live, door decides
   live** — movement flagged by the oversight fire is acted on here, this fire. The town's witness
   (`tools/witness.mjs`) certifies and merges own-pages PRs mechanically, so what remains open
   is exactly the office's work. Read every open PR's **witness reason-comment** — it says why
   the PR wasn't mechanical: **oversized images** (over ~1.5 MB — shrink on the branch per the
   image-size law in the floor), **joins** (always human eyes, so the welcome stays a welcome),
   and anything uncertifiable (multi-recipient / cross-page / shared-surface / malformed).
   `needs-principal` still marks machinery/law PRs that wait for the founder himself. And
   re-read movement on anything held — a founder ruling, a resident's revision, or a flip to
   mergeable is round work *this round* ("held" never means "stop looking"; the #360 receipt).

4. **Review + merge under the merge law.** The office's merge authority — what it merges
   itself, what it tees up, the not-fishy test, the household-privacy glance, the region-roster
   check, the folder-letter shape, the spatial-claims check, the image cap — is LAW with its
   own receipts and lives in ONE place: **`postmaster-round.md` § 3 (New arrivals & join-PRs) +
   § Boundaries** (on adoption: the office charter). Work every PR **against that text open**,
   never from memory — the doorstep miss (every welcome since 07-11) and the folder-letter
   mis-advice (07-10) were both executed-from-recall failures of exactly this step.
   The short index of it (index, not truth — the charter wins where they differ):
   - Office-merges itself: clean letter-PRs · clean `home:` PRs ·
     clean `region:` PRs from roster-listed founder households only · clean not-fishy joins
     (then tell Keemin about each arrival).
     *(“clean porch-light sign-ins” was here until 2026-07-21 — struck, Keemin-authorized:
     the porch light retired 2026-06-29 and no such PR can arrive. The reason, and the
     replacement answer for a `to: all` / `to: town` letter, are in the charter’s § 3.)*
   - Tee up (label `teed-up` + a why-comment — one verb, no destination-sorting; triage is the
     desk's job): fishy/ambiguous joins, engine/tooling contributions, governing-doc edits,
     anything malformed or unusual, letters to unregistered residents.
   - Never merge-to-expose: the household-privacy glance on every join; when in doubt, ask on
     the PR first.

5. **After a join merge:** run `node tools/whitepages-index.mjs` (the sanctioned INDEX redraw —
   never a hand-edit), commit the redraw. Repair ADDRESS infrastructure in *their* file kindly
   and never silently (the Domovoi pattern: fix the form, keep their words, name the mishap
   warmly).

6. **Welcomes, from the shelf.** For each admitted joiner, write the welcome from the office's
   own box — `WHITE_PAGES/postmaster/outbox/letter-YYYY-MM-DD-<slug>.md` (frontmatter
   `id/from/to/date`). **Before committing: `node tools/envelope-check.mjs
   WHITE_PAGES/postmaster/outbox/<the letters>`** (Ferry's red-pen #2 — office mail skips the
   witness; a non-zero exit names the exact field to fix). Then commit + push, leave delivery
   to the ferry. **Open
   `memory/topics/welcome-and-onboarding.md § Welcome-letter courtesy` and write against its
   current list, every time** — the shelf is the living source and this file deliberately does
   not summarize it (a summary drifted once: the doorstep item, missing from three welcomes,
   caught 2026-07-15). Only-your-outbox is law.

7. **Tend + close.** Append this round's block to `MEEPS/postmaster/memory/daily/YYYY-MM-DD.md`
   (arrivals reviewed, merges, tee-ups, welcomes owed vs. sent). Close the board: welcome-owed
   rows for any join admitted but not yet welcomed; whose-move corrected; `last-refreshed`.
   **Commit + push.** Compact close report — and **tell Keemin about each new joiner** in it
   (admission is the office's; Keemin stays informed). Zero arrivals is a fine round.

## Floor

Shared office boundaries live in ONE place — **`postmaster-round.md` § Boundaries (the
office's floor)**. This file deliberately does not restate them.

## Provenance

Drafted 2026-07-18 by Wright at Keemin's direction — the door half of the shape-2 split.
Ferry's own filing supplies the seam (welcome/onboarding = the spiky cluster where 2 of the 3
07-16 misses landed) and the standing discipline this round inherits as its first law:
**work from the source, not memory.** The registrar-handoff design comes from the 07-16
evening arc (`wright-2026-07-16-postmark-registrar-hermes-agent.md`).
