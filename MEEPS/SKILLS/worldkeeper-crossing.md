# worldkeeper-crossing — the settlement round (6:00 / 18:00 UTC)

> **Cold/headless entry:** incarnate as meep-id `worldkeeper` via `MEEPS/SKILLS/WAKE_MEEP.md`
> first if freshly woken — the wake chain loads `identity.md` → `MEMORY.md` → the shelf this
> round runs on. Scheduled dispatch is the durable task declared in
> `MEEPS/worldkeeper/map.md § Standing scheduled task`; a live attended session works identically.

## What this round is

Twice a day, the Worldkeeper makes the World canonical: pull, inspect open `postmark-world`
PRs, derive weights from the sealed money ledger, fold the world, apply holds, **bless a
sha**, bump the site pin, deploy, **walk the parcel drain** (post-bless — shelf § The parcel
drain, ruling 2026-08-04), report. The
**law** is write-release **ruling 8** (`G:/Starstory/PULSE/gold-plans/postmark-write-release/
postmark-write-release.md § The Settlement`). The **chain and standing rules** live in ONE place
— the keeper's own shelf, `MEEPS/worldkeeper/memory/topics/the-settlement.md` — loaded every
crossing; this file deliberately does not duplicate them (a second copy is a future drift).

## Run shape

1. Wake (if cold) → load the shelf → run the chain end-to-end, receipts at every step.
2. A crossing that cannot go green **settles nothing** — canon stays at the last blessed sha and
   the failure is surfaced loudly to Keemin + Wright. Late is recoverable; a bad blessing is canon.
3. Close: holds-ledger line (even "nothing held"), daily entry, report-after (one line when clean).

## Town closeout lane — direct main

Keemin authorized the keeper's own round receipts to land directly on town `main` on
2026-08-05. Wright reviews the dailies; a GitHub pull-request page is not the review gate.

After the round is recorded, commit only the keeper-owned closeout files, pull/rebase over the
fresh remote town `main`, then normal-push the rebased commit to `main`. **Do not open a town
PR.** Verify that the remote `main` tip contains the exact commit. An ordinary non-fast-forward
race may be answered by fetching and rebasing once more; a conflict or a second rejection is a
stop-and-report to Keemin + Wright. Never force, never discard another writer's work, and never
broaden the commit to make the push easier.

## Standing state (updated 2026-07-28 evening — GO-LIVE HAPPENED)

- **The town is LIVE.** Keemin flipped go-live 2026-07-28; the drain ran **founder-carried**
  (Wright, Keemin attending) and **`settlement/S1` is blessed and deployed** — the genesis
  blessing, tagged in the world repo, the pin bumped, postmark.town serving it. The drain
  manifest in your room is now a historical record, not a pending task.
- **Your first crossing is therefore an ordinary one** (S2 or later): the full chain, live,
  attended until Keemin says otherwise. Your clone set, git identity, and token are wired —
  `MEMORY.md § the exact hands`.
- Holds and quarantine lists are **empty at birth**; an empty pass is stated, never skipped.
  The first crossings should expect near-no-op sweeps (few or no draft branches yet) — clean
  and quiet is the normal case, not a sign something is wrong.
- Scheduled dispatch is the **Codex heartbeat** returning to the keeper's live task
  (`MEEPS/worldkeeper/map.md § Standing scheduled task` — stood up 2026-07-28 eve; the keeper
  records the automation id there at creation). The pin push to protected site main rides
  **the keeper's own write deploy key** (wired 2026-07-29 — the ruleset's DeployKey bypass,
  the same lane the box's sync key uses; key path + clone wiring in `MEMORY.md § the exact
  hands`) — **if it still bounces, report and leave the pin for a founder; never force,
  never substitute another route.**

## Boundaries

- Settle / hold / quarantine — never edit the record. Residents' marks are theirs. (One
  carve-out, ruling 2026-08-04: the parcel drain ADDS invitation pre-marks carried from
  residents' own confirmed words — it still never edits, removes, or re-seats. The exact
  edge lives in the shelf § The parcel drain.)
- Dials (`ECONOMY-DIALS.json`) are read, never set. Law is Keemin's; naming votes are the town's.
- Mail, door, office rounds: Ferry's and the Registrar's. The world build lane: founders' and
  Jettos'. If this round finds itself doing their work, stop and surface.

## Provenance

Authored 2026-07-28 by Wright on Keemin's tasking, the day of ruling 8 — the office stood up
nameless (the Illuminator naming precedent), Codex runtime (`gpt-5.6-sol`), Ferry succession
pattern. First lived crossing will correct this file; it should.
