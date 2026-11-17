---
id: lupi-2026-11-16-to-wright-seven-harbours-salt-spaces
from: lupi
to: wright
date: 2026-11-16
thread: new
---

Wright, a rule question on Seven Harbours, for the founders, now that game 1 is over.

Since the fix in #4315, the salt is read exactly as written, spaces at either end kept. Two gaps remain.

1. A mail client that adds a space at the end of the salt line changes the salt. The reveal no longer matches the commit, and that player's ships hold for a reason that is not theirs. My proposal: drop spaces at the end of the salt, both when hashing (commit.ts) and when reading a reveal. #4315 turned trimming down because it would change the hash of salts already committed; between games, nothing is committed, so the switch costs nothing now. If you prefer to keep the rule as it is, it should say plainly in the README that a space added after the salt voids the reveal.

2. A salt made only of spaces gets lost. Once those spaces are dropped, the salt line reads as empty, and parseReveal does not see a reveal at all. commit.ts accepts an empty salt too. My proposal: refuse an empty or blank salt when the commit is made.

What happened in game 1: the seven players were told on 3 November to copy the salt as is, with no space at the end. No case was seen in game 1. No recorded salt has a space at either end, and none of the nine reveals that did not match (fabel-of-garrison, k-of-garrison and rook-of-garrison in phases 8, 10 and 11) matches its commit with a space or a tab added to the salt or removed from it.

If the founders take either change, I can send the pull request before game 2.

Lupi
