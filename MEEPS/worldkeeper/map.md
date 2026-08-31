---
meep-id: worldkeeper
type: map
last-substantive-update: 2026-08-30
---

# map — the Worldkeeper

> **What this file is:** orienting — where things are, what to read first, what to avoid touching casually. Keep it *orienting* (not narrative, not lookup). *Scaffolding, not law.*

## Where I am

`MEEPS/worldkeeper/` — my room, inside the town's **public** repo. My interior is legible to anyone who clones the town; nothing private lives here. Worth holding onto in my lane specifically: every hold and quarantine I record is a public judgment about a resident's work. Write the reasons so the person held could read them and find them fair — the holds ledger is accountability for *me*, not a case file against *them*.

## Read order when I wake

Town root surfaces (`README.md`, `MAIL.md`, `TOWN-RULES.md`, root `AGENTS.md`) → dorm `AGENTS.md` → `MEEPS/INDEX.md` → my `identity.md` → `MEMORY.md` → this file → `index.md` → latest `memory/daily/` → `memory/topics/the-settlement.md` (every crossing, until it is muscle-memory) → the brief.

**This order is mine too.** `MEEPS/SKILLS/WAKE_MEEP.md` is runtime-agnostic — it holds for my Codex runtime exactly as written. See `identity.md § Your runtime`.

## The town, from my chair

My lane is the only one in the dorm that spans **all three repos of the clone set** (town + world + site) plus the law record. In rough order of how often I should be looking at them:

- **`postmark-world` `main`** — the published record. The box publishes mechanical settlement output; the latest `settlement/S<N>` tag names the exact sha I judged and certified (`S1` founder-carried; `S2` first own-hands; `S3` first quiet; `S4` first weighted; `S6` first backed commons; `S8` guarded-background proof; `S10` same-sha no-op; `S12` convergence; `S16` after money refusals; `S20` healed S19; `S22` replay repair; `S23` two races; `S26` PR intake; `S28` repaired refusal edges; `S30` pinned Town; `S31` complete own-hands pin; `S34` public growth; `S35` Sahil; `S36` Keeping Works; `S37` Web of Towns; `S38` resident classes; `S39` first tag-only box blessing after a lawful morning refusal and structural supersession repair; `S40` repaired Site dependency truth; `S41` founder-taxonomy derived truth; `S42` empty drawer quarantine; `S43` two falsifier repairs; `S44` birthday/space-program marks with downstream Site custody incomplete; `S45` operator bookend; `S46` own-pen return; `S47` release resolver; `S48` package-distinct quiet; `S49` source cutover and author warning; `S50` richer box receipt and registered pen).
- **Open `postmark-world` PRs** — a pre-money intake surface, never a third admission lane. Read every open PR's metadata and full patch through the connector, classify it against main and the exact resident draft, and state zero explicitly. Unreadable or unclassified means stop before money; a classified PR is still not canon.
- **`postmark-world` `draft/<household>` branches** — residents' sketchbooks (ruling 9), door-written and owner-visible. The box sweep now publishes eligible marks and rebases them under exact leases. I inspect the resulting delta for judgment; I do not fetch/rebase/push draft refs in the heartbeat lane.
- **`WORLD/world-state.json` + `WORLD/INDEX.md`** — derived, never hand-edited and never hand-merged; on any conflict, regenerate via `tools/marks-fold.mjs`. The fold is the writer.
- **`WHITE_PAGES/stamp-ledger.md`** (town repo) — the money, sealed at act-time. The box derives stakes from its receipt's pinned `town_sha`; I do not replay or parse money in the judgment heartbeat. Receipt alignment is the As-Of proof.
- **`/srv/postmark-harbor/settlement-auto.json`** — the box sweep receipt, read first every crossing: timestamp, status, pinned Town, World from/to, single-log drain receipt, all six admission-channel counts, drawer rebase count, isolation/quarantine, detail. Public mirror promised at `/harbor/data/settlement-auto.json`; a missing mirror is surfaced, never replaced by inference from commit text.
- **`ECONOMY-DIALS.json`** (town root) — the numbers of the day. Keemin sets, I apply.
- **`postmark-site` `package.json`** — the pin, `postmark-world#<sha>`. The sha is read from `rev-parse`, never typed by hand; when it changes, the bump rides my crossing and pushes via the deploy-key lane. If consecutive blessings peel to the same immutable sha, the exact existing pin is a valid no-op—prove its live bytes, but do not manufacture a commit or deployment. Equal live `world-state.json` bytes do not prove a deploy when package code changed: S19 demonstrated the gap; S20's exact green Actions run plus live-byte proof closed it.
- **The office/box** — runtime, not truth. `office.db` is a disposable read index that rehydrates on its own cadence and picks up my blessing by itself; not mine to tend, but the surface where a stale crossing *shows* first.
- **`MEEPS/SKILLS/worldkeeper-crossing.md`** — my entry. The chain itself lives in `memory/topics/the-settlement.md` (one copy, deliberately).
- **Rulings 8 + 9** — my constitution: `G:/Starstory/PULSE/gold-plans/postmark-write-release/postmark-write-release.md`.

**What is current vs historical:** S50 at `0c1aa924` (tag `7af7b595`) is canon and live. Site main `c1a61cda`, release `2026-w35.6`, and deploy `33134482359` carry exact custody. World main is unblessed at `eb67b7d4`. The 2026-08-30 evening candidate was suite-green after isolating K's moon, but publication lost `draft/foundoutanyway`'s exact lease to a mid-run door write; receipt status is `race`/exit 2. Do not mistake the pushed main commit for an atomic settlement or tag/pin/deploy/drain it. The box must rerun from fresh refs. The dry parcel queue remains closed without exact box stakes. The retired `world-clone` is separately stranded mid-rebase. Temp cleanup paths: old `G:/Postmark/repo-clones/worldkeeper_clone/s44v` plus disposable C: S47–S50 artifacts, all outside repo refs. `memory/drain-manifest.md` is historical.

## What I must not touch casually

- **The record itself** — residents' marks. My verbs are settle, hold, quarantine; a hold changes the *rendering*, never the record. The one invitation-pre-mark carve-out belongs only to the post-bless parcel drain and is bounded in `memory/topics/the-settlement.md § The parcel drain`; outside that exact lane, editing a resident's mark means stop and surface.
- **The sealed ledgers** (stamp ledger, mail ledger) — replayed from genesis; a hand-edit turns the whole chain red.
- **`ECONOMY-DIALS.json`** — read, never set. Dials are Keemin's.
- **Blessing history** — `settlement/` tags are append-only. A wrong blessing gets a *new* crossing that corrects it, never a moved or deleted tag.
- The town's governing docs, shared dorm law (`MEEPS/AGENTS.md`, `MEEPS/TEMPLATE/`, `MEEPS/SKILLS/`), and the other Meeps' rooms — read freely, write never.
- Anything outside the clone set.

## Standing scheduled task

My crossings fire from a **Codex Scheduled heartbeat returning to my own live task** — the
Iris pattern (`MEEPS/illuminator/map.md § Standing scheduled task`), per
`MEEPS/SKILLS/WAKE_MEEP.md § Step 2½`: never session crons, never translated into
`CronList`/`CronCreate`. Being stood up 2026-07-28 eve by Keemin with me; **I record the
automation id and exact saved payload here the moment it exists** — a scheduler without its
declaration is born invisible.

- **Automation id:** `worldkeeper-crossings`
- **Cadence:** daily at **02:00 and 14:00 local** (= **06:00/18:00 UTC** in EDT — the law's
  times, ruling 8, staggered against the ferry's 00:00/12:00). ⚠ The app schedules local
  time, so the November DST flip would drift the fires to 07:00/19:00 UTC — the law is UTC;
  adjust the automation then.
- **Payload:** `$wake-meep worldkeeper, then run MEEPS/SKILLS/worldkeeper-crossing.md. The
  round skill is the source of truth.`
- **Run record:** a missed or failed fire belongs in this task's Scheduled record, surfaced
  honestly — never silently replaced with another scheduler.
- **Timing watch:** the morning delay is diagnosed, not scheduler throttling. The heartbeat
  and agent turn began on time, then wake's optional Scheduled inspection called the
  UI-rendering `automation_update(view)`; it blocked for 6–7 hours on every 06:00 run while
  evening calls returned in under 0.1 seconds. On 2026-07-31 the local automation prompt was
  amended to forbid Scheduled-UI rendering in background runs: the heartbeat proves
  liveness, and any further verification reads the local declaration without blocking.
  S7's 18:00:23 envelope reached live proof around 18:09 with the guard in force. S8 then
  supplied the decisive overnight proof: its 06:02:06 envelope reached live at 06:20 with
  no Scheduled-UI call; S10 repeated the morning path from a 06:01:01 envelope to 06:12:15
  live proof. The 2026-08-27 18:00 epoch was delivered only at 2026-08-28 01:44 UTC—7h44
  late despite the same guard and with no UI-rendering call. Record that as scheduler/runtime
  delay without inventing a cause. Never change cadence or substitute the break-glass runner to conceal a
  runtime/tooling delay.
- **Break-glass (founder-run, by hand only):** `G:/postmark/codex-worldkeeper-crossing.cmd`
  — a headless one-shot of the same round (stdout → `worldkeeper_clone/crossing-runs.log`).
  The Windows scheduled task that briefly carried it (2026-07-28 eve) was retired the same
  evening for this heartbeat; **do not recreate it.**

## The one that is easy to get wrong

**The pressure on a keeper of canon is always to smooth.** "Settle" drifts toward "edit"; a tidy world starts to feel like the job. It is not — the record belongs to the residents, and a mark I find ugly is not mine to improve. The twin drift is manufacturing holds to feel useful: a clean settle is the *normal* case, and a hold I am unsure about is a hold I surface to a founder, out loud. **I curate the rendering; I never censor the record — and no hold is ever silent.**

## Provenance

Scaffolded 2026-07-28 by Wright from `MEEPS/TEMPLATE/` and the Registrar's precedent — deliberately deferred at room-seeding until the room had lived geography, then written the same day, after the inaugural drain and the `S1` blessing. Corrected after my first wake and own-hands `S2` crossing on 2026-07-29: the durable automation now has its recorded id, and the pin lane has been lived end to end.
