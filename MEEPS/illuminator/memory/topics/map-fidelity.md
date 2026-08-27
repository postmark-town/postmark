---
meep-id: illuminator
type: topic-shelf
created: 2026-07-13
last-substantive-update: 2026-08-26
---

# map-fidelity — the standing lift of the town's fidelity to its residents' words

> **What this shelf is:** the office's **long-term, gradual program** to make the *rendered* town truer to what residents actually wrote — at three scales, one small increment per round. Distinct from the other shelves: `craft.md` is how to paint a faithful *candidate*; `atlas-placements.md` is placing a *new arrival*; this shelf is **improving the fidelity of what is already drawn**, now that the map is mostly filled in and we can finally see everything relative to everything else. Born from Keemin's 2026-07-13 direction ("we're due for a higher-quality lift of the land itself… then region-by-region, then house-by-house… fold in a fidelity-pass to catch tweaks that honor residents' descriptions *more*… I don't mind you settling ambiguity by sending a resident a letter to clarify/confirm; this can be gradual").
> **What belongs here:** the terrain-lift design + its state; the region-by-region and house-by-house fidelity passes + their log; tweaks noticed and made (or PR'd); clarifying letters sent and what they confirmed. **What does not:** image-generation craft (→ `craft.md`), new-arrival placement (→ `atlas-placements.md`), offer bookkeeping (→ `offers-ledger.md`).
> **How you know you're filling it right:** a future you reads the log, picks up the next increment without re-deriving the plan, and every rendered change traces to a resident's own words (or a letter where they confirmed it). *Scaffolding in the method's edges; the plan and the invariant are real from row one.*

## The load-bearing invariant (never trade this away)

**Words are canon; coordinates serve them.** The map is generated from `placements.json` (facts quoted from residents) → `render-town.mjs` (coordinates). Every fidelity change moves the *render* toward the *words* — never the reverse. We do not repaint the land and then make residents' text match it. (This is why full "the-painting-is-the-map" is out; see the terrain options below.)

**`render-town.mjs` is core, shared, and regenerated every round by every agent's rounds.** The office's current route, by Keemin's 2026-07-29 direction, is validated direct-to-`main`; small placement-display changes may use that route after the full visual and deterministic checks. A terrain rewrite remains a different scale of risk and still requires advance coordination and a careful look with Wright (atlas-keeper). Resident-facing fidelity work (noticing a tweak, sending a clarifying letter) is in-lane.

## The three scales (do them in this order, gradually)

**Pass 1 — the land itself (the terrain lift).** The base terrain today is schematic: the river is gradient "ribbon" paths + an feTurbulence wobble filter; the sea is two gradient rects fading up from y1900; regions are jittered wash-blobs; the *land* is essentially background-color-minus-water — no real shoreline, elevation, or bank. The chosen lift is **Option B — enrich the procedural SVG terrain** (in `render-town.mjs`, stays canonical, reversible, no new binary, regenerates like now):
- a real drawn **shoreline** where land meets the sea (not just a fade) — a coast/beach edge;
- **N→S elevation** shading — the northern hill dropping to the southern sea (hillshade-ish gradient / contour washes for high ground vs lowland);
- **river banks** + a **quay** treatment at the Centre; reflections;
- subtle **land texture**.
(Rejected: Option C painterly-raster underlay — prettier but needs coordinate registration + one big permanent asset + softens generated-from-truth; possible *follow-on* after B, not first. Option A repaint-as-canon — breaks the invariant; never.) Pass 1 is a **Wright collaboration via PR**, advanced in increments (prototype one element — say the shoreline — look, PR, merge; then the next).

**Pass 2 — region-by-region.** For each region, check its drawn wash/label/position/vignette against its `REGION.md` now that its neighbors exist: does the drawn place honor the founder's words *in relation to* what's around it? (e.g. is a "coastal" region actually at the water; does a "just uphill of the crossing" region read that way now the Centre's neighbors are placed.) One region per round-increment.

**Pass 3 — house-by-house.** For each home, check its position/rendering against its `HOME.md` — **relational fidelity** especially: above/below/beside, what-kind-of-water, how-far, adjacent-or-not (the "guard the prepositions" lesson from `craft.md`, now applied at map scale). This is where the filled-in map pays off: a home reads truer once its neighbors are known. A few houses per round-increment.

## The fidelity-pass discipline

- **Catch the tweak that honors them MORE.** The pass isn't "is it wrong" — it's "would this render honor their words *more*." Small, cumulative, deferential.
- **Clarifying letters are allowed and encouraged** (Keemin, 2026-07-13). When a placement/rendering is genuinely ambiguous, **write the resident** to clarify or confirm rather than guess — it turns a guess into a resident-claim (the `prefer-asking` lesson) and it's warm. Gradual and consent-forward; log what they confirm.
- **One increment per round.** Restraint is the office's register: one terrain element, or one region, or a few houses — then look at the map. A round with zero fidelity-work is a fine round.
- **Look before you ship**, always — same as candidates. Screenshot the changed corner, read it.
- **Settling stays Wright's.** I author render-fidelity + send clarifying letters; I do not re-litigate *settled* facts. A tweak that would revise a settled placement → flag to Wright, don't make it.

## The log (passes done — starts here)

| date | scale | target | what changed / what a resident confirmed | shipped how |
|---|---|---|---|---|
| 2026-08-26 | Reorientation gate | Casa Nera acceptance after #2085 | PR #2085 merged the Atlas to the living World parcel after one Vellix letter said the household chose it. The same crossing delivered four other Vellix letters insisting southwest remains authoritative and the southeast parcel is wrong. No map or terrain change made: sent one explicit supersession question and kept the founder-merged point as current state pending a reconciled resident answer. | Correspondence + placement shelf only; no renderer change for Casa Nera. The contradiction keeps merged-frame acceptance open. |
| 2026-08-25 | Reorientation gate | Atlas/World merged surface | The merged World fold is now live enough to remove raw spectator-coordinate reads and seed Atlas homes as World parcels, but Casa Nera proves the coordinate frame is not acceptance-clean: Vellix says southwest of the lake; the new parcel is southeast. No legacy terrain plan resumed. Recorded the public-door shape change, used the shared local `assembleWorld` + `orient` fallback for today's placements, and filed the split on #1943. | Source placement records direct to `main`; no terrain change. Reorientation waits on Wright/merge acceptance rather than carrying Option B forward by inertia. |
| 2026-08-15 | Pass 3 — houses | Fox Hearth / Margin / Level cluster | Ellery supplied the three true display names and explicitly held geometry fixed. Added renderer-only names **Fox Hearth**, **The Margin**, and **The Level** for the visible label, place panel, and accessibility text. The first look caught the wider Margin name over Caelum Lumina's newly hung thumbnail and confirmed Fox Hearth's old label was still east of the water; label-only leaders now keep both names clear on the west bank while every exact World anchor remains untouched. | Source renderer direct to `main`; generated quartet held by existing #944/#1368 validation failures. |
| 2026-08-12 | Pass 3 — houses | Fox Hearth / Margin / Level cluster | Trued Ellery's old estimate and placed Alden + Corwin at their exact published World parcels. Because the three canonical anchors are closer than one glyph, added marker-only offsets with fine leaders: ground remains exact while every house stays readable. Full-map and corner looks passed. | Source facts + renderer direct to `main`; generated quartet held by existing #944/#1368 validation failures. |

## State of the terrain lift (Pass 1)

- **Status: MERGED SURFACE SEEN; REORIENTATION HELD ON ACCEPTANCE** (2026-08-26). The surface is live, but Casa Nera's household correspondence now conflicts with itself across parallel same-crossing branches even after #2085 merged. Do not resume shoreline work while the resident's final side-of-lake word is unreconciled and the public World door's spectator shape has changed.
- **Resume shape:** re-orient with Wright after the merged pin/frame acceptance passes. Preserve the invariant—resident words remain canon and the rendering serves them—but re-derive the terrain plan and round's orientation call from the merged architecture instead of carrying Option B or the retired raw-coordinate MCP shape forward by inertia.

## Provenance

Shelf created 2026-07-13 by the Illuminator, Keemin-directed, the day the map was full enough that its *land* became the weakest layer and a standing fidelity program made sense (superseding a one-shot silver — Keemin's call: "make a topic shelf/memory module… and set one more step in the round to work on that"). The Illuminator tends this shelf; the terrain lift is a Wright collaboration.
