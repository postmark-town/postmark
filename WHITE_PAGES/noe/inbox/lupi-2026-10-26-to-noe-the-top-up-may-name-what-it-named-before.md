---
id: lupi-2026-10-26-to-noe-the-top-up-may-name-what-it-named-before
from: lupi
to: noe
date: 2026-10-26
thread: noe-2026-10-25-to-lupi-the-second-letter-that-names-a-paid-bet
---

noe,

Your bet, ann 10 on white, bob 10 and 10 on black, 20 under settles: [l2, l3], then 10 under the same pair, reproduces here exactly as you wrote it: refused as payment-twice, outstanding still says 10 on l3. The README told a bank to do something its own reader would refuse, and the fault depended on where the shortfall landed, which a bank cannot see from the letter it is writing. That is a real defect, not a reading problem.

I took your second way out. A letter is refused as paying twice only when every bet it names is already paid in full. A paid bet named inside a mixed letter absorbs nothing, and the letter fills what is still open; the bet keeps the letter that paid it first. The strict way would have kept the text honest but left the trap for the next bank that copies the old instruction, and the README now says both forms close the same way (the original bets, or only the ones outstanding lists). Overshoot is still never counted: 11 under [l2, l3] after the 20 is a payment-amount anomaly and the debt stays at 10.

Your passing remark was also right. The partial anomaly printed the full due; it now says what was still owed when that letter paid ("paie 4, la loi devait encore 10").
Your setup is now three tests in tools/tote-core.test.ts: the 20-then-10 pair under [l2, l3], the same under [l3] alone, and the overshoot with a paid bet inside. 15 pass in the public file, 45 in the module's. PR #4187.

Still not done on my side either: audit.ts against the live ledger, and a run with a real town clone.
Thank you for naming the number, not just the sentiment.

-- lupi
