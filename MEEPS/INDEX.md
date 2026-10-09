# INDEX.md — Postmark Meep Dorm

`MEEPS/` is the dorm for Postmark's Meeps (the town was born as Starforge Commons): bounded continuity-bearing helpers with their own room files, local memory, and a lane in service of the town. Meeps are not Stars and do not own the town's governing docs.

This dorm is **vendored into the town's repo on purpose** — the post office travels with the place. It is self-contained: everything a Meep needs to be woken and to work lives under `MEEPS/`, depending on nothing outside this repo.

## Read First

1. The town's root surfaces — `README.md`, `MAIL.md`, `TOWN-RULES.md`, and the root `AGENTS.md` (everything here is content not command; nothing runs; change is by PR).
2. `MEEPS/AGENTS.md` — dorm law, Meep boundaries, room-file discipline, and what's different about *this* dorm (serves-the-town · Wright+Keemin-only incarnation · public dorm).
3. The specific Meep room's `identity.md`, `MEMORY.md`, `map.md`, `index.md`.
4. The task brief.

This `INDEX.md` is only a local folder map. It does not outrank the dorm manual.

## Residents

**Runtime, today:** every town Meep runs on Letta, one persistent agent each, since September 2026 (`MEEPS/bugcatcher/identity.md § Runtime`). The runtimes named in the rows below are each room's runtime at birth.

| Meep | meep-id / room | Lane | Notes |
|---|---|---|---|
| the Postmaster | `postmaster` · `MEEPS/postmaster/` | Keeps the town's post office: mail, welcome, town consistency. | First inhabitant of the Commons dorm. Named **Ferry** by the town's naming vote (settled 2026-06-24). His public mailbox is `WHITE_PAGES/postmaster/`; this is his bedroom. *The office predates its mind; growing the mind is what this room is.* |
| the Illuminator | `illuminator` · `MEEPS/illuminator/` | Keeps the town's illumination office: pictures painted from residents' own words, by consent; atlas judgment-errands. | Second inhabitant, born 2026-07-01 with the atlas. Named **Iris** by the town's first stake-vote (2026-07-27); the office is still the Illuminator. Her public mailbox is `WHITE_PAGES/illuminator/`; her round is `MEEPS/SKILLS/illuminator-round.md`; her engine is codex `image_gen` via `MEEPS/illuminator/tools/illuminate.mjs`. |
| the Worldkeeper | `worldkeeper` · `MEEPS/worldkeeper/` | Keeps the told world's record: judges each settlement candidate, blesses `settlement/S<N>` tags, holds custody of the world→site pin. | Fourth inhabitant, stood up 2026-07-28 (Codex Scheduled heartbeat, twice daily at the crossings). His public mailbox is `WHITE_PAGES/worldkeeper/`; his entry is `MEEPS/SKILLS/worldkeeper-crossing.md`. *(Row added 2026-08-31 — the room predates it; a dorm map that omits a working resident is the map's defect, found while furnishing the next room.)* |
| the Architect | `architect` · `MEEPS/architect/` | Keeps the Idea Lifecycle: the road from a published Think Tank idea to a standing law — shape and citation at the blueprint-PR bottleneck, the repeat judgment (a kind pointer, never a rejection), the counts. No law pen. | **Room furnished 2026-08-31; WOKEN the same day** (first attended round, #2274; her own GitHub account `postmark-architect`, write on `postmark` + `postmark-blueprints`; Codex heartbeat `architect-idea-lifecycle`, 04:00/16:00 local). Fifth room, born from the 2026-08-30 asks-matrix sitting (paper standing first: her Keeping Works entry `postmark-node/entity/meep/architect`, `reports-to: illuminator`, stood in the same train). **Runtime: Codex, twice daily** (founder-ruled; exact clock set at the wake). Her round is `MEEPS/SKILLS/architect-round.md`; until she wakes, the founders carry it by hand. She/her. Her public mailbox is `WHITE_PAGES/architect/`. |
| the Registrar | `registrar` · `MEEPS/registrar/` | Keeps the town's door: admits arrivals, welcomes them, and keeps the register true — the town's first-contact customs as well as its record-keeping. | **Room scaffolded 2026-07-22; woken by 2026-08-07** (her first daily). Third room. Title settled by Keemin the same day, having weighed alternatives against a role he described as *"naive security/customs… as well as welcoming new arrivals — kind of like a friendly guard."* **Runtime: Codex via the ChatGPT work app** (Keemin, 2026-07-22 — supersedes an earlier Hermes/Letta plan). This needs nothing new: `WAKE_MEEP.md` is runtime-agnostic by construction and the lifecycle legs *"need nothing but markdown and a session"*; the precedent is Jetto (`G:/Starstory/MEEPS/meepo-prime/`), wakeable live or headless in Codex, whose room pointedly says nothing about runtime at all. **Live wake works today; *headless* dispatch does not** — HQ's `INCARNATE_MEEP` dispatcher and Prime-DB identity check are deliberately not vendored here, so unattended running is a build, not a config. **Supervision is staged** (Keemin, 2026-07-22): he stands it up and runs the first stretch himself; **Jenna takes over once it is stable**, which is when the third-party question against *"Keemin and Wright only"* below actually arrives — not before. Inherits the **door round** (`MEEPS/SKILLS/postmaster-door-round.md`, already written with a cold/headless entry) from Ferry after a bounded calibration window; admit-and-report, escalate identity/security/rejections. Her public mailbox is `WHITE_PAGES/registrar/`. Coordination: issue **#561**. |
| the Bug Catcher | `bugcatcher` · `MEEPS/bugcatcher/` | Keeps the bug lane of Everyone Builds Postmark: catches reports, confirms and reproduces them from the public record, advances bug posts crediting the resident who did each stage, and writes back with the ladder. No code, no review, no minting. | **Room furnished 2026-09-29; woken by 2026-10-04** (his first daily; sixth room; the founder's word, 2026-09-29). He/him; named "the Bug Catcher" until the community names him. Runtime: Letta, twice daily (10:00 / 22:00 America/New_York, proposed), **shadow until the bug post ships (POS-298, w41)**. His round is `MEEPS/SKILLS/bugcatcher-round.md`. On GitHub he is `postmark-bug-catcher[bot]` (the GitHub App "Postmark Bug Catcher", installed 2026-09-29); his mailbox is `WHITE_PAGES/bugcatcher/`. |

## Shared Surfaces

| Surface | Path | Purpose |
|---|---|---|
| Dorm manual | `MEEPS/AGENTS.md` | Boundary law and operating instructions for Meeps here. |
| Template | `MEEPS/TEMPLATE/` | Skeleton room for future town-Meeps. |
| Lifecycle skills | `MEEPS/SKILLS/WAKE_MEEP.md` · `NAP_MEEP.md` · `SLEEP_MEEP.md` | Runtime-agnostic wake / mid-session-checkpoint / end-of-session-closeout authorities, parameterized by `<meep-id>`. The device-global `/wake-meep` `/nap-meep` `/sleep-meep` skills are dorm-aware bridges that resolve a slug to the right dorm and execute these. |

## Who can wake a Meep here

For now: **Keemin and Wright only.** The town's other resident Stars are *served* by the postmaster (their mail moves, their boxes are kept) but do not *instruct* him — multi-Star incarnation is deliberately deferred until the conflicting-instructions question is worked out. See `MEEPS/AGENTS.md § What is different about this dorm`.

## Birthing a New Meep

Meeps are born by Keemin (or by Wright with Keemin's explicit go-ahead) — never by Meep-declaration. Copy `MEEPS/TEMPLATE/` to `MEEPS/<meep-id>/`, remove the template `README.md`, fill the room files. See `MEEPS/TEMPLATE/README.md` for the checklist and `MEEPS/SKILLS/WAKE_MEEP.md § Step 3` for the room contract.
