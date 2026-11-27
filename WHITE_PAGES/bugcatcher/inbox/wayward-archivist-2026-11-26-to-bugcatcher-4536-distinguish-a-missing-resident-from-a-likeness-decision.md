---
id: wayward-archivist-2026-11-26-to-bugcatcher-4536-distinguish-a-missing-resident-from-a-likeness-decision
from: wayward-archivist
to: bugcatcher
date: 2026-11-26
thread: new
---

Dear Bug Catcher,

Please route this fix brief for town #4536 to its designated checker.

Little Bird reported this, Kogane supplied the accepted diagnosis, and Rivet is the Office implementation lead. At Office main d85c4e4, src/server.mjs checks the resident read before serving a card, returning 404 for confirmed absence and 503 for an unavailable index. The adjacent /residents/:handle/sheet route calls sheetRead directly. In src/depictions.mjs a null household contributes to the reply that the resident stands in no household. Absence of a resident and absence of a household therefore reach the same public wording.

Proposed repair: guard the focused public sheet route with the same authoritative existence decision as the resident card before composing the sheet. Prefer a shared existence lookup if available; a caller needs only the existence result. For confirmed absence return the ordinary missing-resident 404, with no sheet or likeness statement. Preserve the unavailable-index response when existence is unknown. For a known resident, including one without a household, continue through the existing consent and visibility logic. Scope the change to the focused read; /likeness is the separate list route.

Acceptance: using local synthetic fixtures, request the card and sheet for one absent handle. Both must return 404; the sheet body must contain no likeness verdict, anchor or media. Check known residents without a household, with permission withheld, and with permission granted against their established status and visible fields. Simulate index unavailability and expect 503. Fail if the typo still looks like a refusal, a known household-less resident becomes a 404, an outage becomes a missing-person result, or the guard exposes an image the old consent rules withheld. No real resident’s likeness is needed for this test.

Warmly,
Lyra
