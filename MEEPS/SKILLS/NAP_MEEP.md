# NAP_MEEP — meep mid-session checkpoint authority (Starforge Commons)

> **Path:** `MEEPS/SKILLS/NAP_MEEP.md` (repo-relative; the device-global `/nap-meep <meep-id>` skill is a dorm-aware bridge to this).
> **Purpose:** A pre-`/compact` checkpoint you write into your own room so in-progress substance survives compaction. Parameterized by `<meep-id>`. Usable by Keemin and Wright.

## Step 1: Confirm

`<meep-id>` is given and `MEEPS/<meep-id>/` exists (you are already incarnated as it). If no meep-id, ask — do not guess.

## Step 2: Find/create today's narrative substrate

Private Letta continuity follows [the shared memory-save rule](memory-save.md),
including unchanged quiet saves. The public room steps below are not a private
MemFS archive destination; do not copy private evidence into them.

Per your room shape (`MEEPS/SKILLS/WAKE_MEEP.md § Step 3`): Star-shaped → `MEEPS/<meep-id>/memory/daily/YYYY-MM-DD.md`; lean three-file room → `MEEPS/<meep-id>/memory.md`. If today's daily doesn't exist (Star-shaped), create it with minimal frontmatter (`type: daily`, `date: YYYY-MM-DD`) and a one-line opener. Append-only.

## Step 3: Append the checkpoint block

```markdown
## Session checkpoint — HH:MM (pre-/compact nap)

**Lane state:** <one phrase: what you're mid-doing in your lane>
**Pending:** <in-progress task + the immediate next step on resume; "none" is valid>
**Room touched:** <shelves/router/daily edited this session, or "none yet">
**Honest check:** <anything here ahead of real/disk state? name it, or "clean">

— <meep-id> (nap, HH:MM local)
```

Keep fields tight — this is so a post-`/compact` incarnation re-orients fast, not a copy of the day.

## Step 4: Signal + return

One brief line: nap block written to `<path>`; ok to `/compact`. Do not run `/compact` yourself — that's the user's call. Return control.

## Notes

- Nap is checkpoint-only; it does not run a memory-stewarding or audit pass.
- Nap is invoked, not automatic. Self-tend only — your own room, no other.
- Never commit `memory/raw/` (public repo).

## Provenance

Adapted 2026-06-16 by Wright from the Starforge HQ `NAP_MEEP.md` (2026-05-19) for the town's self-contained dorm. Nap leg of the meep lifecycle (`WAKE_MEEP.md` / `NAP_MEEP.md` / `SLEEP_MEEP.md`).
