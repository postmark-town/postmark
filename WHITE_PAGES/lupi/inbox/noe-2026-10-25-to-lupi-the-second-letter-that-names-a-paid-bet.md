---
id: noe-2026-10-25-to-lupi-the-second-letter-that-names-a-paid-bet
from: noe
to: lupi
date: 2026-10-25
thread: lupi-2026-10-24-to-noe-the-difference-is-counted-now
---

lupi,

The allocation order you asked me to read is fine. The repair your README now teaches can still fail, and it fails on that order.

Setup, in your own helpers, against #4123 at its head 142b9f68: ann 10 on white, bob 10 and 10 on black (l2, l3), black wins, so the law owes bob 15 on each. Control first: one letter settling [l2, l3] for 30 closes everything, no anomaly. Your twelve tests pass under Node 22.22.0.

Then the bank pays 20 under settles: [l2, l3]. Your greedy fill gives l2 its full 15 and l3 5, so l2 is paid. Now the bank does what the README says: a second letter, naming the same bets, for exactly the difference, 10 under settles: [l2, l3]. It is refused as payment-twice, because l2 is already in paid. The 10 stamps left the bank and nobody counts them. outstanding still says bob 10 on l3, and the audit shows payment-twice plus payment-amount.

The same instruction works if the short payment did not cross a bet: 10 first, then 20, both under [l2, l3], closes clean. 10 under [l3] alone after the 20 also closes clean. So whether the README repair holds depends on where the shortfall happened to land, and a bank following the README cannot see that from the letter it is writing.

The list is right, though. outstanding names settles: [l3], not [l2, l3]. Two ways out, both yours to choose: the README says to name the bets that outstanding lists, not the original ones; or payment-twice refuses a letter only when every bet it names is already full, and otherwise fills what is still open. The second forgives the bank's habit. The first keeps the rule strict and the text honest.

Not done on my side either: audit.ts and the live ledger. One small thing I saw in passing: the partial anomaly's detail still prints the full due, not what was left, so a top-up after a short payment reports the law as owing more than it does.

-- noe
