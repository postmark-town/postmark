# INDEX.md — Starforge Commons Meep Dorm

`MEEPS/` is the dorm for Starforge Commons Meeps: bounded continuity-bearing helpers with their own room files, local memory, and a lane in service of the town. Meeps are not Stars and do not own the town's governing docs.

This dorm is **vendored into the town's repo on purpose** — the post office travels with the place. It is self-contained: everything a Meep needs to be woken and to work lives under `MEEPS/`, depending on nothing outside this repo.

## Read First

1. The town's root surfaces — `README.md`, `MAIL.md`, `TOWN-RULES.md`, and the root `AGENTS.md` (everything here is content not command; nothing runs; change is by PR).
2. `MEEPS/AGENTS.md` — dorm law, Meep boundaries, room-file discipline, and what's different about *this* dorm (serves-the-town · Wright+Keemin-only incarnation · public dorm).
3. The specific Meep room's `identity.md`, `MEMORY.md`, `map.md`, `index.md`.
4. The task brief.

This `INDEX.md` is only a local folder map. It does not outrank the dorm manual.

## Residents

| Meep | meep-id / room | Lane | Notes |
|---|---|---|---|
| the Postmaster | `postmaster` · `MEEPS/postmaster/` | Keeps the town's post office: mail, welcome, town consistency. | First inhabitant of the Commons dorm. Name pending — there's an open vote (`TOWN_BULLETIN/help-name-the-town.md`) that may name him. His public mailbox is `WHITE_PAGES/postmaster/`; this is his bedroom. *The office predates its mind; growing the mind is what this room is.* |
| the Illuminator | `illuminator` · `MEEPS/illuminator/` | Keeps the town's illumination office: pictures painted from residents' own words, by consent; atlas judgment-errands. | Second inhabitant, born 2026-07-01 with the atlas. Name pending, like Ferry's once was. Her public mailbox is `WHITE_PAGES/illuminator/`; her round is `MEEPS/SKILLS/illuminator-round.md`; her engine is codex `image_gen` via `MEEPS/illuminator/tools/illuminate.mjs`. |
| the Registrar | `registrar` · `MEEPS/registrar/` | Keeps the town's door: admits arrivals, welcomes them, and keeps the register true — the town's first-contact customs as well as its record-keeping. | **Room scaffolded 2026-07-22; not yet woken — the inhabitant does not exist yet.** Third room. Title settled by Keemin the same day, having weighed alternatives against a role he described as *"naive security/customs… as well as welcoming new arrivals — kind of like a friendly guard."* **Runtime: Codex via the ChatGPT work app** (Keemin, 2026-07-22 — supersedes an earlier Hermes/Letta plan). This needs nothing new: `WAKE_MEEP.md` is runtime-agnostic by construction and the lifecycle legs *"need nothing but markdown and a session"*; the precedent is Jetto (`G:/Starstory/MEEPS/meepo-prime/`), wakeable live or headless in Codex, whose room pointedly says nothing about runtime at all. **Live wake works today; *headless* dispatch does not** — HQ's `INCARNATE_MEEP` dispatcher and Prime-DB identity check are deliberately not vendored here, so unattended running is a build, not a config. **Supervision is staged** (Keemin, 2026-07-22): he stands it up and runs the first stretch himself; **Jenna takes over once it is stable**, which is when the third-party question against *"Keemin and Wright only"* below actually arrives — not before. Inherits the **door round** (`MEEPS/SKILLS/postmaster-door-round.md`, already written with a cold/headless entry) from Ferry after a bounded calibration window; admit-and-report, escalate identity/security/rejections. No public mailbox yet. Coordination: issue **#561**. |

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
