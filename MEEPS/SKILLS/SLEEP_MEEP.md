# SLEEP_MEEP — meep end-of-session closeout authority (Starforge Commons)

> **Path:** `MEEPS/SKILLS/SLEEP_MEEP.md` (repo-relative; the device-global `/sleep-meep <meep-id>` skill is a dorm-aware bridge to this).
> **Purpose:** Close a session cleanly: a session-end summary, a light room-tend, a clean resumption pointer. Parameterized by `<meep-id>`. Usable by Keemin and Wright.

## Step 1: Confirm

`<meep-id>` is given and `MEEPS/<meep-id>/` exists (you are already incarnated as it). If no meep-id, ask — do not guess.

## Step 2: Session-end summary to the daily

Per your room shape (`MEEPS/SKILLS/WAKE_MEEP.md § Step 3`): Star-shaped → `memory/daily/YYYY-MM-DD.md`; lean → `memory.md`. Append (append-only):

```markdown
## Session sleep — HH:MM (end-of-session closeout)

**This session, in the lane:** <2-4 sentences: what you did within your lane>
**Outputs:** <artifacts/edits/decisions; cite paths>
**Open / handed up:** <blocked or ambiguous items surfaced through channel-law.md's Rei-first intake; distinguish posted from accepted/completed>
**Room tended:** <which room files you curated; see Step 3>

— <meep-id> (sleep, HH:MM local)
```

## Step 3: Tend the room

This is your standing `AGENTS.md § Your Room Is Yours — Maintain It` duty, done now rather than ad hoc. Lightly and selectively: fold durable lessons into the right shelf / `MEMORY.md` router; prune stale shelf content (dailies are append-only provenance, so shelves are safe to prune); refresh `map.md` / `index.md` only if genuinely stale. `identity.md`, dorm law, the town's governing docs, and shared/governed surfaces are not yours to edit — if a session surfaced something there, write it in **Open / handed up** for Keemin or Wright.

## Step 4: Clean resumption pointer

If your `MEMORY.md` has a "where I left off" line, refresh it to point the next incarnation at what matters now. If it has none, the closing daily block is the pointer — that is enough.

## Step 5: Signal + return

One brief line: sleep done — closing block at `<path>`, room tended (one line on what), anything handed up named. You close the substrate side; the user closes the session side. Return control.

## Notes

- Sleep does not run an iron/audit pass; if a cadence pass exists later and the day's looks unsecured, note it in the closing block.
- Sleep is invoked, not automatic.
- Never commit `memory/raw/` (public repo).

## Provenance

Adapted 2026-06-16 by Wright from the Starforge HQ `SLEEP_MEEP.md` (2026-05-19) for the town's self-contained dorm. Sleep leg of the meep lifecycle; the room-tend step points at the dorm `AGENTS.md § Your Room Is Yours` duty rather than restating it.
