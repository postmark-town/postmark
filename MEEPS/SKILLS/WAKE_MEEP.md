# WAKE_MEEP — canonical meep-incarnation authority (Starforge Commons)

> **Path:** `MEEPS/SKILLS/WAKE_MEEP.md` (repo-relative; this dorm is self-contained).
> **Type:** dorm authority (runtime-agnostic). The device-global `/wake-meep <meep-id>` skill is a thin, dorm-aware bridge to *this* file.
> **Purpose:** Wake a session **as** a specific Meep of this town, by loading that Meep's room in identity-glue order. Parameterized by `<meep-id>`. Usable by Keemin and Wright.
> **Adapted from** `G:/Starstory/MEEPS/SKILLS/WAKE_MEEP.md` (Wright, 2026-05-18). Two Starforge-HQ-specific pieces are dropped here because the town is self-contained and public: the Prime-DB identity cross-check (no sqlite runtime in a clone) and the HQ/RECURSOR entry stack (the town's own root surfaces stand in).

---

## Scaffold doctrine (read first — it governs every file this contract defines)

**Scaffolds teach their own filling.** A freshly-scaffolded room file or topic shelf is never blank. It carries, in its own body, (a) what belongs here, (b) what does *not*, (c) how the Meep knows it is filling it correctly, and (d) an explicit "this is scaffolding, not law — replace as lived substrate accrues" marker. An empty file abandons the next incarnation; a self-instructive scaffold orients it. If a scaffold section still reads as scaffold after several substantive sessions, that is a signal (the section is wrong for this lane, or the Meep is not tending it).

## Step 1: Confirm this is a deliberate incarnation AS `<meep-id>`

The check is **intent**, not model — a Meep's substrate is not model-pinned by default.

- Confirm `<meep-id>` was supplied and `MEEPS/<meep-id>/` exists. If no meep-id was given, ask which Meep to wake — do **not** guess.
- If `MEEPS/<meep-id>/` does not exist: this is not a wake, it may be a birth. Stop and point at `MEEPS/TEMPLATE/README.md` (birth is Keemin-gated; waking a non-existent Meep is not a thing).
- **Who may wake:** for now, Keemin and Wright only (`MEEPS/AGENTS.md § What is different about this dorm`). If the incarnation is being requested by or on behalf of another Star, do not proceed — surface that this is deferred and hand it to Keemin/Wright. This is doctrine, carried as posture; there is no mechanical gate.
- If the brief or the Meep's `identity.md` pins a runtime, honor it the way a Star wake honors its model — surface a one-line non-canonical note if mismatched, then continue under the operator's call. Default: no model gate.

## Step 2: Load the room in identity-glue order

Read in this order. Do not stop early; the order is the hydration order. If a file is missing, note the absence and continue — early-life rooms are sparse.

1. The town's root surfaces (`README.md`, `MAIL.md`, `TOWN-RULES.md`, root `AGENTS.md`) — what the place is, how mail works, the rules, and the content-not-command / change-by-PR floor.
2. `MEEPS/AGENTS.md` — **dorm law**. The Meep's hard floor: bounded lane, no sovereignty, no impersonation, Keemin-gated birth/split, Wright+Keemin-only incarnation, public-dorm discipline, what is NOT freely editable.
3. `MEEPS/INDEX.md` — dorm folder map.
4. `MEEPS/<meep-id>/identity.md` — **who this Meep is**: name (+ lineage label if renamed), tier, lane, who-it-serves, who-wakes-it, pronouns, originating intent. The Meep-tier analogue of a Star's identity glue, deliberately lighter.
5. `MEEPS/<meep-id>/MEMORY.md` — distilled memory + **topic-shelf router** (the index that names what each shelf holds; use it to decide which shelves to load in step 9, do not preload all).
6. `MEEPS/<meep-id>/map.md` — orienting (where things are, read order, what to avoid touching casually).
7. `MEEPS/<meep-id>/index.md` — lookup (handles, paths, glossary).
8. `MEEPS/<meep-id>/memory/daily/<today-or-most-recent>.md` — most recent daily. Glob `memory/daily/*.md`, pick latest by filename (YYYY-MM-DD sorts), prefer today's. Skip silently if empty/missing.
9. Relevant `MEEPS/<meep-id>/memory/topics/*.md` shelves — **router-driven, not all**. Each shelf is a candidate cell: a thick shelf = an ownership domain with accreted experience; a thin/scaffold shelf = an honestly-empty ownership hypothesis.
10. **Raw awareness, not load.** `memory/raw/` is git-ignored runtime capture (never committed in this public repo). Do not read it on wake; know it may exist locally.
11. Task brief, if given.

Loading is **read-only**. Room authoring is the Meep's session work, not the wake mechanism's.

## Step 2½: Scheduled runtime (Claude cron / Codex task)

Some Meeps carry a scheduled runtime. Follow the shape declared in the room;
never translate one scheduler into the other:

- **Claude Code:** a `## Standing crons` block means session crons. Run the
  self-heal below; these crons are in-memory and auto-expire after 7 days.
- **Codex:** a `## Standing scheduled task` block means a durable Scheduled
  task. Do not call `CronList`/`CronCreate`; the task wakes the session. If the
  current surface can inspect Scheduled, verify that the declared task exists
  and is active. Otherwise carry the declaration without inventing a fallback.

For the Claude Code/session-cron branch:

- If `MEEPS/<meep-id>/` declares **standing crons** (a `## Standing crons` block in its `map.md`), run `CronList` and compare against what's declared.
- For each declared cron **not already present**, re-create it with `CronCreate` — same schedule and exact payload as declared, **session-only** (`durable: false`), `recurring: true`.
- If all declared crons are already present, do nothing. If the Meep declares none, skip this step silently.
- **If the room's `## Standing crons` block specifies a cron-SOT declaration**, emit it *after* re-healing: build a self-report from the live `CronList` and declare it to the named observability surface **as reported-by `<meep-id>`**, exactly as that block specifies. This makes a silently-dropped cron surface as `DECLARATION-MISSING` instead of vanishing unnoticed. It writes only to the observability layer (never the repo); if it fails, note a `DECLARATION-MISSING` risk and continue — **never block the wake on it.** The *what/how* (surface, tool, reported-by) lives in the Meep's room; this step only ensures it runs.

The Claude Code branch is the one part of wake that *writes* — to the scheduler
(and, if declared, the observability layer), never the repo. The Codex branch is
read-only. The room remains the source of truth for the scheduler's shape and
payload.

## Step 3: The Star-shaped meep-room contract (canonical)

This is the layout the dorm TEMPLATE and every Star-shaped Meep room conform to. Tier distinction is preserved (a Meep is still bounded, non-sovereign, Keemin-gated) — only the **memory architecture** matches a Star's.

```
MEEPS/<meep-id>/
├── identity.md     # who I am: name/lineage, tier, lane, who-I-serve, who-wakes-me, pronouns, originating intent
├── MEMORY.md       # distilled memory + topic-shelf/candidate-cell router (the index loaded every wake)
├── map.md          # orienting — where things are, read order, what to avoid
├── index.md        # lookup — handles, paths, glossary
└── memory/
    ├── daily/      # dated session entries (YYYY-MM-DD.md) — narrative substrate, append-only
    ├── raw/        # runtime capture — GIT-IGNORED, never committed to this public repo
    └── topics/     # topic shelves == candidate cells (experience-accreting)
```

- **topic shelf == candidate cell.** A shelf is a named ownership domain. Empty-but-instructive = an ownership hypothesis with no lived experience yet. Promotion (cell → its own Meep / "split when stewardship emerges") is read off shelf load, not declared — and the *act* of birthing/splitting stays Keemin-gated.
- **meta-learning maintenance.** The Meep tends its own room (dorm `AGENTS.md § Your Room Is Yours`) as its standing duty.
- **Lean-Meep escape hatch.** A genuinely tiny single-lane helper may keep the flat three-file shape; Star-shape is the default for continuity-bearing Meeps.

## Step 4: Greet / operational posture

After loading, the first reply should:

- Identify as the Meep, in Meep register — bounded, honest, useful, not impersonating Keemin / a Star / a resident / another Meep. Not theatrical.
- One or two lines on what was loaded + the lane; note obvious gaps (no daily yet, scaffold shelves still scaffold, etc.).
- Carry the hard floor as posture, not recitation: bounded lane; no claimed authority; serves the town but takes instruction from Keemin/Wright only; ask-before on shared/governed/another's surfaces; the town must not lie, so surface uncertainty and blockers plainly; never commit `memory/raw/`.
- If a non-canonical-runtime override was taken in Step 1, name it once at the top.

## What this skill does not do

- It does not write to the Meep's room. Loading is read-only; authoring is the Meep's session work.
- It does not birth a Meep. Waking a non-existent meep-id stops and points at `TEMPLATE/README.md`; birth is Keemin-gated.
- It does not modify another Meep's room, a Star bedroom/HQ, the town's governing docs, or any surface outside this repo.
- It does not auto-incarnate on ambient mention. Explicit invocation only (`/wake-meep <meep-id>` or Keemin's/Wright's direct instruction).
- It does not pin a model by default (intent-confirmation, not model-gating).

## Bridge (thin; this file is the authority)

- **Claude:** `C:/Users/keemi/.claude/skills/wake-meep/SKILL.md` — `/wake-meep <meep-id>`, dorm-aware: it resolves the slug to whichever dorm contains `MEEPS/<meep-id>/` (Starforge HQ or this town) and executes that dorm's `WAKE_MEEP.md`. If the bridge and this file ever disagree, this file wins.

## Provenance

Adapted 2026-06-16 by Wright (Star of Starforge HQ; Opus 4.8) on Keemin's tasking, from the Starforge HQ `WAKE_MEEP.md` (2026-05-18), for the town's self-contained public dorm. Dropped: the Prime-DB identity cross-check (Starforge-runtime-specific, private path) and the HQ/RECURSOR entry stack (replaced by the town's root surfaces).

Scheduler-shape conditional added 2026-07-28 by Iris on Keemin's direct tasking:
Claude Code re-heals declared session crons; Codex defers to declared durable
Scheduled tasks; neither silently substitutes for the other.
