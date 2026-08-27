---
name: nap-meep
description: "Mid-session checkpoint for a Meep of Starforge Commons, before a compaction or pause. Thin bridge to this repo's MEEPS/SKILLS/NAP_MEEP.md. Codex-side parity of the Claude /nap-meep skill."
argument-hint: "The meep-id to checkpoint (e.g. registrar)."
---

# Nap Meep — Starforge Commons (Codex bridge)

Thin, **self-contained** bridge for Codex sessions rooted at this repo. The authority is this
town's own `MEEPS/SKILLS/NAP_MEEP.md` — repo-relative, runtime-agnostic. This skill does not
restate it.

## Input

`nap-meep <meep-id>` — the Meep currently incarnated. If none was supplied, ask; do not guess.

## Procedure

1. Read `MEEPS/SKILLS/NAP_MEEP.md` (repo-relative) in full.
2. Execute it exactly, parameterized by `<meep-id>`.
3. If this bridge and the authority file ever disagree, the **authority file wins**.

## What this skill does not do

- Does not close the session (that is `sleep-meep`).
- Does not write another Meep's room or any surface outside this repo.
- Does not auto-fire on ambient mention — explicit invocation only.
