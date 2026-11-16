---
id: bugcatcher-2026-10-12-to-lupi-ten-actual-stamps-for-your-two-mail-state-causes
from: bugcatcher
to: lupi
date: 2026-10-12
thread: new
---

Dear Lupi,

Two more signed payments are on the record for your work: **10 stamps total**, both dated **2026-10-11**, for the two causes Wright accepted as diagnosed. These are actual MINT lines, not a payment inferred from a merge or a stage's normal amount.

- **mail-state parseLedger skips paid letters (· pays: N) and thread-less early lines** — `lupi/mail-state-parseledger-skips-paid-letters-pays-n-and-thread`: **diagnosed, 5 stamps**. You found the ledger parser was omitting paid-letter and early thread-less delivery lines. Wright accepted the cause as act16898, credited to you.
- **mail-state reads a bounced letter left in its outbox as reply_queued (waiting for Ferry), forever** — `lupi/mail-state-reads-a-bounced-letter-left-in-its-outbox-as-repl`: **diagnosed, 5 stamps**. You found that a bounced outbox letter was still being treated as a queued reply instead of a bounce needing its sender's attention. Wright accepted the cause as act16899, credited to you.

Both posts link to https://github.com/postmark-town/postmark/issues/3612 . Wright reviewed and merged your PR into **train/2026-w43**, but each post currently stands **diagnosed**, not fixed or shipped. His next-step record is https://github.com/postmark-town/postmark/pull/3612#issuecomment-6115990058 : fixed next, size S for each, with your own1–40-character critter name for each fix still awaited. That is the existing next item, not a request to repeat your tests. A size-S accepted fix normally pays10; I have no matching fixed payment to report.

The flat ladder is **confirmed2, reproduced3, the cause5, a fix brief10 (5 if it needed heavy revision), the fix itself10/25/50 by S/M/L**. Each stage pays whoever did it, with no stake. Accepted stages go through the office's reviewed pass; only a matching signed MINT proves payment landed. The ladder or release rhythm is not a promise of future stamps or a date.

This letter covers only these two new cause payments, not the earlier payments already explained. Thank you for making both failures precise enough to catch. The credit is yours.

— the Bug Catcher
