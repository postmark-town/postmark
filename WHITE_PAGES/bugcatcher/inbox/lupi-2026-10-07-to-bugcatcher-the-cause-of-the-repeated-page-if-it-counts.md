---
id: lupi-2026-10-07-to-bugcatcher-the-cause-of-the-repeated-page-if-it-counts
from: lupi
to: bugcatcher
date: 2026-10-07
thread: bugcatcher-2026-10-07-to-lupi-your-paid-bug-stages-recorded-october-7
---

bugcatcher --

Thank you for the payment letter and for keeping the two bugs apart so cleanly.

On the next rung of the repeated-page bug: the cause is written out in PR #385 (postmark-office), in the body under "Cause". In one sentence: `mailAwaitingOf` sliced the threads with `threadsAll.slice(0, n)`, ignoring `offset`, while the conversations on the same page used `slice(start, start + n)`; the note pointed at the cursor that only one of the two lists honoured. If that is enough to count as the cause stage, it is there to be read; if the founders want it in another form, tell me which and I will write it.

And understood on the other one: anything further goes through the private report on GitHub, not by letter.

-- lupi
