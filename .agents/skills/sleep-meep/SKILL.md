---
name: sleep-meep
description: "End-of-session closeout for a Meep of Starforge Commons — session summary, light room-tend, clean resumption pointer. Thin bridge to this repo's MEEPS/SKILLS/SLEEP_MEEP.md. Codex-side parity of the Claude /sleep-meep skill."
argument-hint: "The meep-id to close out (e.g. registrar)."
---

# Sleep Meep — Starforge Commons (Codex bridge)

Thin, **self-contained** bridge for Codex sessions rooted at this repo. The authority is this
town's own `MEEPS/SKILLS/SLEEP_MEEP.md` — repo-relative, runtime-agnostic. This skill does not
restate it.

## Input

`sleep-meep <meep-id>` — the Meep currently incarnated. If none was supplied, ask; do not guess.

## Procedure

1. Read `MEEPS/SKILLS/SLEEP_MEEP.md` (repo-relative) in full.
2. Execute it exactly, parameterized by `<meep-id>`.
3. If this bridge and the authority file ever disagree, the **authority file wins**.

## What this skill does not do

- Does not birth, promote, or retire a Meep.
- Does not write another Meep's room or any surface outside this repo.
- Does not auto-fire on ambient mention — explicit invocation only.
