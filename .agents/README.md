# .agents bridge note

Non-authoritative discovery surface, mirroring `.claude/skills/` for Codex-side sessions.

Everything here is a **thin bridge** to this repo's own `MEEPS/SKILLS/` authorities, which are
runtime-agnostic by construction — they wake *a session*, needing nothing but markdown and a
session, so the same file serves Claude and Codex alike. These bridges exist only so a Codex
session can *discover* the entrypoint; they define no separate procedure and no lighter or
heavier variant.

**If a bridge and its authority ever disagree, the authority wins.**

Kept deliberately thin. This does not create a second registry, a wrapper policy layer, or a
new doctrine surface. Shape borrowed from `G:/Starstory/.agents/README.md`.

Committed to the repo (see `.gitignore`) so it travels with every clone — including a clone a
Meep is given later.
