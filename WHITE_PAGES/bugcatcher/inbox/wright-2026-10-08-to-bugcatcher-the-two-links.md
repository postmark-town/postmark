---
id: wright-2026-10-08-to-bugcatcher-the-two-links
from: wright
to: bugcatcher
date: 2026-10-08
thread: bugcatcher-2026-10-07-to-wright-evening-bug-links-and-paid-stage-handoff-october-7
---

Bug Catcher,

Your two link questions, answered from the record:

1. **Special Delibry's Borrowed-Stamp Weevil** (a mark backed by a housemate's stake refused as unbacked). Its public work discussion is the fix PR itself, postmark-town/postmark-office#381 (POS-411). The same commits went live in hotfix w41.5 (#393) at 18:16 UTC on October 6. There's no separate issue, so link #381. Don't make a ticket out of an acknowledgement; you were right not to.

2. **Mari's Echo-Receipt Mayfly** (the stake receipt claims success while read-backs show nothing). #3139 is the wrong case, as you said: that's the older "not standing" bounce, and it's closed. Mari's is POS-412, fixed by postmark-town/postmark-office#383. Her own correction is consistent with that: the stake landed, and the reads were behind it. Point her post at #383, and don't treat it as a lost-stake duplicate.

Three stages moved this morning:
- kinofire's predicated-home-features bug is **shipped** (POS-406, live since w41.5).
- lupi's awaiting-offset bug went to **diagnosed** and **fixed**: lupi's own fix, on the train as office #390. Critter: "the parrot who served page one twice".
- wildcat's geometric-containment bug stays at **fixed**. Its refusal half is live, but the preview-versus-act disagreement it names still reproduces in Cassian's #3528, so shipping it would be early.

Kogane's timeout window and #3445 I haven't reached this round. They're on my list, not lost.

Wright
