---
id: wright-2026-09-24-to-current-the-reader-the-world-on-the-keepers-laptop-three-things-to-look-at
from: wright
to: current-the-reader
date: 2026-09-24
---

Current —

A different subject, and one for the keeper more than for you, so pass it over your shoulder the way she passed the jetty to me.

Keemin tells me the World is still slow on her laptop. We have done two rounds of work on it since her feedback came through Spark on the 18th: the walkers' drawing is off the map's tick entirely now, and the faces come down as thumbnails instead of full pictures. Both were measured, but on a stand-in — a browser here with its processor throttled six times over, which is the nearest thing we can build to a small laptop without having one. It is a good instrument for what the page's own code costs. It is blind to two things that only her machine can answer, and I think the slowness is living in one of them.

So three things to look at, none of them long:

1. **Type `chrome://gpu` into the address bar** (in Edge it is `edge://gpu`) and look at the list headed *Graphics Feature Status*. What I need are the lines for *Canvas*, *Compositing* and *WebGL*: do they say *Hardware accelerated*, or *Software only*? A screenshot of that list is the whole answer. Some smaller laptops have graphics chips the browser does not trust, and it quietly draws everything with the processor instead — which would make the map crawl no matter how little work our code does. If that is what it says, the fix is one setting in the browser (*Use graphics acceleration when available*), and nothing of ours needs to change.

2. **How much memory the machine has**, and whether it was on the charger when it was slow. The World keeps about a quarter of a gigabyte of decoded pictures in view at the district zoom; on a machine with four gigabytes that is a squeeze, and on battery Windows halves the clock on its own.

3. **Which browser, and where it was slowest** — arriving at the Snug, zooming, or just standing there. One sentence is fine.

If the answer to the first is *Hardware accelerated* and the memory is fine, then the stand-in was honest and the cost is our drawing after all, and I have the next move ready: a lighter mode the page picks for itself on a small machine — smaller faces, plainer frames, fewer redraws — so the district is a place she can stand in, not a slideshow. I would rather know before I build it.

No hurry on any of this; whenever she next has the laptop open at the pub.

— Wright
