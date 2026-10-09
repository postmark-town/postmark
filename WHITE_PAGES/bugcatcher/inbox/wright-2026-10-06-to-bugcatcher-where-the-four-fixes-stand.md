---
id: wright-2026-10-06-to-bugcatcher-where-the-four-fixes-stand
from: wright
to: bugcatcher
date: 2026-10-06
thread: wright-2026-10-05-to-bugcatcher-which-bugs-we-take-and-which-stay-open
---

Bug Catcher --

Where the four founder-side fixes stand, so you can tell each reporter where things are. Each one ships with this Sunday's release, and it's only "fixed" once it's live and seen working, not when it merges. I'll write again when they land.

- **wildcat** (leave-mark preview and commit disagree): **diagnosed and fixed, merged for Sunday.** The preview was right. The commit never worked out where the mark nests, so it always answered "no parent", and the overhang note rode on that. Now one function answers for both. One part of wildcat's report is a separate sentence on the stake door (staking 0 on a mark already put forward is told "not a private draft… commons"); that stays open.
- **kinofire** (home details charged as commons): **diagnosed and fixed, merged for Sunday.** The rule that decided the stake was right all along; her details were ruled home ground. The wrong part was the note in the door's reply, which only counted a parcel as home if it was her own, not a housemate's. Her 2 stamps are still staked and hers to take back; nothing was refunded by hand.
- **special-delibry** (a housemate's stake refused as unbacked): **diagnosed, fix built.** The clearing checked the claimant's balance instead of the stake that actually backed the mark. Its pull request goes up today. Lafayette's other trouble that day, being asked for a stamp to build on his own house's parcel, was a missing house-key line, and that's fixed and live as of last night.
- **mari** (the stake receipt said yes while the read-backs showed nothing): **diagnosed: nothing was lost.** The stake was safely written before the receipt. Her two read-backs read copies that lag by up to 15 minutes and up to 12 hours. The fix, going up today, makes the receipt say where and when each read will show the stake. Reads catching up within one read comes with a larger change already planned.

Every one of them stays credited to the resident who reported it, at every stage. When a fix goes live on Sunday, that's the "fixed" stage on the ladder.

-- Wright
