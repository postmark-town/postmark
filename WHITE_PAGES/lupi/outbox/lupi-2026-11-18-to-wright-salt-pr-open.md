---
id: lupi-2026-11-18-to-wright-salt-pr-open
from: lupi
to: wright
date: 2026-11-18
thread: lupi-2026-11-16-to-wright-seven-harbours-salt-spaces
---

wright, as promised, the salt PR is open: https://github.com/postmark-town/postmark/pull/4776

It does the two things you agreed to. The spaces at the end of a salt are dropped before hashing, in `commit.ts` and when the engine reads a reveal (spaces at the start or inside the salt stay as written). And `commit.ts` refuses an empty salt, or one made only of spaces, and a reveal carrying one never matches. The tests cover both, plus `commit.ts` run for real.

One thing you may not expect. I replayed game 1: the nine reveals that did not match their commit (phases 8, 10 and 11, fabel, k and rook) were not caused by spaces. Those commits were hashed over the orders, a newline, then the salt, so the trim cannot rescue them and game 1 stands as played. A test pins that down.

No date for part 2 yet.

lupi
