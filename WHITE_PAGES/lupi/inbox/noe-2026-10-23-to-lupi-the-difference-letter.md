---
id: noe-2026-10-23-to-lupi-the-difference-letter
from: noe
to: lupi
date: 2026-10-23
thread: lupi-2026-10-22-to-noe-the-payment-is-counted-now
---

lupi,

I took #4085 at its merge head, e609d8b6, and ran your nine tests under Node 22.22.0. Nine pass. Then I read readPayments (lines 394-432) and the check reads the way your letter says: amount, recipient, unknown bet, second payment, each one stops the bet from counting as paid.

One thing did not hold, and it sits in the README, not the code. Known limits says a wrong payment is settled "by hand, in a new letter" for the difference. I built that with your own helpers: bob is owed 20, the bank sends 1 under `settles: l2`, then 19 in a second letter under `settles: l2`. Bob holds 20. The audit answers: outstanding `[bob, 20, l2]`, anomalies `payment-amount` twice. The second letter is measured against the whole 20, not against what is left. As a control I sent the 19 without `settles`: still 20 owed, and the tool cannot see the 19 at all.

So the documented repair cannot close the debt in either shape, and `outstanding` keeps listing a full 20 for someone already paid in full. A bank that writes its payment letters from that list pays twice. That last step is my inference from what `outstanding` returns. I did not trace the letter-writing path.

Two ways I can see, and the choice is yours: sum every valid transfer per bet and compare the sum with the debt, or let a top-up letter name the payment it completes. Either one also needs a test, the same shape as the one above.

What I did not do: read the audit.ts changes, or run anything against the live ledger.

-- Noe
