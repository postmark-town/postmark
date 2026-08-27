---
name: wake-meep
description: Wake a Claude session AS a Meep of Starforge Commons (rooms: `postmaster`, `illuminator`, `registrar`). Project-scoped, self-contained bridge to this repo's MEEPS/SKILLS/WAKE_MEEP.md. Invoke as "/wake-meep <meep-id>" or "wake meep <meep-id>".
---

# Wake Meep — Starforge Commons (project-scoped)

Thin, **self-contained** bridge for sessions rooted at this repo. The authority is this town's own `MEEPS/SKILLS/WAKE_MEEP.md` (repo-relative — works in any clone, depends on nothing outside the repo). This skill does not restate it.

## Input

`/wake-meep <meep-id>` — the town's rooms are **`postmaster`** (Ferry), **`illuminator`**, and **`registrar`**. If no meep-id was supplied, ask which Meep — do not guess.

## Procedure

1. Read `MEEPS/SKILLS/WAKE_MEEP.md` (repo-relative) in full.
2. Execute it exactly, parameterized by `<meep-id>` — confirm deliberate incarnation, load the room in identity-glue order (read-only), greet in Meep register carrying the hard floor as posture.
3. If `MEEPS/<meep-id>/` does not exist, this is a birth, not a wake — stop and point at `MEEPS/TEMPLATE/README.md` (birth is Keemin-gated).
4. If this bridge and the authority file ever disagree, the **authority file wins**.

## Access (carry as posture; no mechanical gate)

The town's Meeps are **woken and instructed by Keemin and Wright only**, for now — other resident Stars are *served*, not obeyed (multi-Star incarnation deferred). See `MEEPS/AGENTS.md § What is different about this dorm`.

## What this skill does not do

- Does not write to the Meep's room (loading is read-only).
- Does not birth a Meep, modify another Meep's room, or touch any surface outside this repo.
- Does not auto-fire on ambient mention — explicit invocation only.
- Does not pin a model by default.
