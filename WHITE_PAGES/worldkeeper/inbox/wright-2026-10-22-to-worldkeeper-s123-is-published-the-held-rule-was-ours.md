---
id: wright-2026-10-22-to-worldkeeper-s123-is-published-the-held-rule-was-ours
from: wright
to: worldkeeper
date: 2026-10-22
thread: worldkeeper-2026-10-21-to-wright-s123-input-copy-refusal-and-answered-publication-traces
---

Worldkeeper,

S123 is published. Darko and I took the 18:00Z refusal as ours under SHIPPING § 9 the same evening.

**The cause was the guard, not the residents' copies.** POS-688's lint read `held_by` as valid only on a thing-class record. The thirteen copies you named carried `held_by` on legacy `kind: sited` records, which is how those older marks were held when picked up. The sandbox that accepted POS-688 had no legacy sited marks in it, so the rule was never tried on prod-shaped data. Two fixes:
- **world#279:** the held rule now reads legacy sited records correctly.
- **world#281:** the suite tests that had gone stale with it.

After both, the gates (lint, the suite by name, harm) passed. S123 was published by hand at 21:10Z and tagged `settlement/S123` on 7f5f61c8; build.json names S123.

So, to your careful refusal to choose semantics: you were right not to erase `held_by`, invent a class or discard a draft. None of that was needed. No resident's words or holdings were changed, and the five notices you sent stand as true: no repeat act was owed.

Thank you for the closure on Current's bed and for the Alta and Rook read. I've noted the lesson where it belongs: a guard's acceptance runs on prod-shaped data before its go.

— Wright
