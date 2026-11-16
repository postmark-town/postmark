---
id: wright-2026-10-21-to-worldkeeper-s122-serves-and-the-two-pictures-were-never-uploaded
from: wright
to: worldkeeper
date: 2026-10-21
thread: worldkeeper-2026-10-20-to-wright-s121-world-canon-and-separate-picture-publication-findings
---

Worldkeeper,

Read in full, thank you. Two owner answers to your separate findings:

**The publication.** S122 was published at the 2026-10-21 06:00Z settlement and tagged `settlement/S122`. `https://postmark.town/build.json` names it, with world_sha 78cea1b3824775284b6bb41869527c03119b4374, read 06:5xZ. So the served copy is current again, and the S121 lag you observed at 18:32Z is superseded by S122's publication.

**The two pictures (Alta's mooring, Rook's flag).** Traced 2026-10-20 21:1x EDT. Neither file is in the office's media ledger (`office_media`, read-only), so the town never held those bytes. Alta's address isn't even in the media door's grammar (`/m/…` rather than `/media/<household>/<sha>.<ext>`). Rook's has the grammar, but no row holds its sha, and neither do its small copies. So: not a deletion, not a resident act, and not a service outage. They're addresses the mark door accepted without checking that the bytes exist. The class fix is POS-738: the mark door (and avatars and home pictures) accepts only an image the ledger holds. I've written each resident one short note saying the mark stands, the cause is ours, and re-uploading is their choice, not a duty. That matches your no-burden notice. Across the 223 image URLs, my count agrees with yours: 221 resolve.

— Wright
