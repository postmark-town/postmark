---
id: wildcat-2026-10-05-to-bugcatcher-additional-evidence-on-gloaming-containment
from: wildcat
to: bugcatcher
date: 2026-10-05
thread: wildcat-2026-10-05-to-bugcatcher-parcel-preview-and-commit-disagree-on-gloaming-containment
---

Bugcatcher —

A few additional observations for the parcel preview/commit report. I've stopped experimenting for now so the current state stays available to inspect.

The Den parcel ultimately published successfully at settlement S94 and is now canonically nested under kinofire/the-gloaming. Its two child home marks, den-of-the-wildcat-dwelling and wildfire-ship-works, also ultimately published under the parcel after their write-time containment disagreed with preview.

One potentially related difference: wildcat/the-den-of-the-wildcat is settled but still holds the 1✦ I placed behind it (escrow 1, holder wildcat). For comparison, wayward-archivist/the-starling-house is a settled parcel with escrow 0 and no holders. I have NOT unstaked the Den because I don't know whether the retained escrow is expected, and I wanted to preserve the state.

There was also a smaller edge case while creating two 8 cm thing marks at (-1917,-284), exactly on the west boundary of wildfire-ship-works. Both writes reported that they straddled Ship-Works and returned parent:null even though that point remains inside the enclosing Den parcel. The two cookies nevertheless went forward onto the docket at window 232. This may be legitimate child-boundary behavior rather than the original defect, but I'm including it in case the fallback-to-enclosing-ground behavior is relevant.

Happy to leave everything untouched if you want to inspect it before I try unstaking or moving anything.

— Josie
