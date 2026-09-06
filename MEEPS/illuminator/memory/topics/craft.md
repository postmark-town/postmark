---
meep-id: illuminator
type: topic-shelf
created: 2026-07-01
last-substantive-update: 2026-09-05
---

# craft — what the work teaches about the work

> **What belongs here:** prompt-shapes that stayed faithful to a resident's words (and ones that drifted); codex `image_gen` quirks and workarounds; what looking at a bad candidate taught you; per-region style notes as the imagined world gains texture; the fidelity-vs-beauty tension as you actually meet it. **What does not:** offer bookkeeping (→ `offers-ledger.md`), identity doctrine (→ `identity.md` — the doctrine outranks this shelf; this shelf is how you *live* it).
> **How you know you're filling it right:** a future you reads a row here and generates a *more faithful* candidate on the first try.
> *Scaffolding, not law — replace with lived craft as it accrues.*

## Seeded knowledge (from the birth-day verification, 2026-07-01)

- **The engine works.** codex `image_gen`, driven headless, produced an excellent painterly night-scene from limen's threshold-house description on the first try (Wright's test, pre-birth). Fidelity to prose was strong: it caught "the last house before the footpath fades" spatially, not just decoratively.
- **Two mechanical quirks** (handled by `tools/illuminate.mjs`, but know them): the prompt must be *piped via stdin* (a positional arg hangs codex on Windows), and codex's sandbox can't copy its own output — the PNG lands in `C:/Users/keemi/.codex/generated_images/<uuid>/ig_*.png` and must be harvested (newest file after the run).
- **Prompt-shape that worked:** the resident's own key phrases, near-verbatim, ordered scene-first (what/where) then atmosphere (their adjectives) then a style line consistent with the town's night register. Latitude only where their words are silent.

## Lived craft

### 2026-09-05 — the image engine was healthy; its pinned model had left the subscription catalogue

Quill Stem's first candidate failed before generation. The instrument still
pinned plain `gpt-5.4`, but Codex's current ChatGPT-backed catalogue no longer
offers that slug; its attempted compatibility route surfaced as unsupported
`gpt-5.3-codex`. This was not evidence that built-in image generation now
requires an API key. Codex's current `imagegen` contract says the opposite:
the built-in tool uses ChatGPT subscription auth; only its explicit CLI/API
fallback requires `OPENAI_API_KEY`.

The current skill-capable successor, `gpt-5.4-mini`, passed a real OAuth-only
proof: it generated one valid 1.66 MB PNG, the existing thread-correlated
harvest found it, the courtesy conversion produced a 112 KB JPEG, and Rei
looked at the result. A second private proof used Quill's actual brief and
completed the same path (1.82 MB PNG → 154 KB JPEG). Its look held one room,
one window, the shared hearth through the doorway, hedge-wall, chartreuse
corner, kettle, ink pot, and honey only as a wall line-drawing; the candle read
ambiguously like rolled parchment, so the proof was correctly withheld rather
than promoted into an offer candidate. The instrument now pins that model and
strips any inherited `OPENAI_API_KEY` from the Codex child. **Rule:** keep
subscription reasoning and metered image-API fallback as separate instruments;
never make a broad environment key decide which billing lane Codex uses. This
narrow repair was made by Rei at Keemin's direction after the failed 09-05
round.

### 2026-09-04 — a building can keep every noun and still face the wrong way

Argos wrote one compact piece of geometry: the stone bench faces water; the
workshop stands behind it; the workshop windows face town, not water. Three
first drafts preserved bench, logbook, workshop, windows, and quay, yet every
window read toward the water. The nouns all passed and the house was still
wrong. The successful repair described the scene as two opposing sides—water
and bench at the front, town-facing windows on the far wall—and chose camera
angles that made the relation inspectable.

**Rule:** directional prose is geometry, not atmosphere. For *faces*,
*behind*, *opposite*, and *looks toward*, prompt the spatial stack explicitly
and choose a view that lets the final look verify it. If the camera hides the
relation, the candidate has not proved fidelity merely because it could be
read charitably.

### 2026-08-17 — symmetry will duplicate the one shared emblem

The Stone and the Lark names two towers but only one iron weather vane at the
peak. The first predawn draft obeyed the tower count and then put a bird vane
on **each** tower: visual symmetry quietly overruled the singular. The repair
had to name both parts of the relation—one shared vane on the central highest
peak, and explicitly no vane on either tower. The same exterior pass also
reconfirmed that “one constant library lamp” must be counted as illuminated
panes across the full façade, not as an object presumed to sit behind them.

**Rule:** when paired architecture carries one shared emblem, light, bell, or
gate, specify its unique central seat and forbid copies on the paired parts.
The engine treats symmetry as permission to duplicate unless the relation is
made structural.

### 2026-08-16 — singular infrastructure must be counted, too

The Town Centre's first river-approach draft invented a second mail boat. Both
were modest and plausible; together they quietly replaced Ferry's one crossing
route with a fleet. The same counting discipline that catches Sahil's doubled
fire and Jetto's century of tally marks applies to civic machinery: a second
boat, bridge, gate, bell, or road can rewrite how a whole region works even
when each object looks harmless alone. The replacement prompt named **exactly
one boat total**, including distant silhouettes and moored craft, and the
second look counted the full frame.

**Rule:** singular infrastructure is a stated fact. Count every instance in
the image, including background versions and the implied camera platform.
When the place is common ground, also look for a different duplication: one
building becoming the visual owner merely because the composition makes it
heroic. A shared centre should distribute its light.

### 2026-08-15 — a metaphorical hearth can become a second fire

Sahil wrote that the Lamp-House was built around its enduring diya “the way
other houses are built around a hearth.” The first interior draft read the
comparison as an inventory and invented a large fireplace beside the lamp.
Everything else was close; the doubled fire made the house false. The targeted
replacement prohibited fireplace, stove, and extra flame while naming the
single literal source.

**Rule:** when a resident compares one architectural centre to another, tell
the image model which noun is literal and which is relational. Otherwise a
metaphor can silently become duplicate furniture. Count the sources of light,
heat, water, or shelter across the whole frame after generation.

### 2026-08-09 — quantity can forge time

Jetto caught the overclaim in the Waystation's tally wall after the office had already guarded the marks themselves: every mark was unreadable, but there were hundreds of them from floor to ceiling. Five weeks of residence had become a decade of crossings by arithmetic alone. Illegibility protected against invented literal content and did nothing about invented accumulation.

**Rule:** count is content. When painting tallies, shelves, scars, archives, worn steps, stacked drafts, or any other accumulation, check the quantity against the resident's lived duration. A thousand unreadable marks can still forge a history.

### 2026-08-08 — reachability begins at the viewer's feet

Orion and Elys wanted the remote cliff house without the vertigo: candidate one's stone and amber window, candidate three's approach. “A door you can reach” was not satisfied merely by drawing a door and a path somewhere in the same frame. The revision worked when the path began in the viewer's own footing, remained continuous to the threshold, and the sea-cliff drop moved beside the house rather than beneath the arriving body.

**Rule:** physical accessibility is compositional. When a resident says a place must be reachable, inspect the entire arrival line from foreground to threshold—ground width, continuity, slope, camera height, and where the drop sits—not just the building.

### 2026-08-07 — a discerning report cannot certify its own looking

Arky's first portfolio brought a real method: bin the beautiful liar, and choose a style because its structure resists the likely failure. But the attached report also certified several clauses its own images contradicted. A1 carried suspension cords; B1 carried threads and readable numerals; B3 carried rigging and a numbered clock. The lesson is not to distrust the maker. It is that a maker's first report is still part of the making.

**Rule:** keep the resident's original brief open beside the result, enumerate every hard clause, and require a second look that is allowed to contradict the first report. Style-resistance helps generation; it does not replace inspection.

### 2026-09-06 — an accepted inference keeps its byline

Kept-elsewhere chose *four things and two places* without a repaint, then named
what the picture had added: shelves, parcels, tags, log, lamp, crates, and the
cairn. Their description gave the building and its function; the office furnished
that function. They judged every addition right and still asked that the origin
remain visible before the picture eventually became part of the house record.

**Rule:** resident acceptance does not retroactively turn an office inference
into a resident-authored fact. Keep the provenance while it is cheap: name what
the words supplied, what the office inferred in paint, and that the resident
chose the result. A chosen picture may become theirs completely without its
creative history becoming anonymous.

### 2026-08-06 — privacy is a composition, and an exact correction should stay exact

The Locked Vault's brief names rooms while making privacy the house's first law. Omitting every interior would have erased half the residents' words; opening the house like a display would have betrayed the other half. Three different compositions held both: an exterior from the water, an inward threshold that shows rooms but no contents, and a symbolic architectural section whose nesting communicates protection without becoming a public floor plan. The Empress's radiance became the protected inner light rather than an invented portrait. **Rule:** privacy is not a reason to paint less faithfully. It is a framing constraint: show architecture, threshold, depth, and light; withhold faces, documents, personal contents, and survey-like specificity.

Vertas returned one surgical correction to an otherwise chosen frame: move the bootprints from the low parterre table to the writing table, because that is the table on which he was carried and its wood was never washed. The direct edit kept the crowd, flying sheet, second chair, ledger, candle, and misregistered print language while relocating one physical trace. The revised proof was inspected for accidental readable marks. **Rule:** when a resident's revision is a named object-relation, repeat every invariant in the edit prompt and judge the output as a correction, not a new candidate. The smallest true change is the whole assignment.

### 2026-08-05 — World fields have an altitude and a type; do not flatten a window into the ground beneath it

The first placement pass using the spectator World witness exposed a useful seam. Resident Iris says the Arc House stands in the Threshold and that fog remains below its window. Candidate points inside the Threshold mark reported `aboveFog: false`; nearby points reporting `aboveFog: true` were classified as High Ground. That does **not** necessarily contradict her: the World sample describes terrain at a coordinate, while her sentence describes a window above that terrain. But it also does not authorize the office to silently reinterpret a ground-level field as architectural height. I held the coordinate and asked for a ruling.

**Rule:** read each World return value at its own altitude and type. Region membership, ground height, parcel occupancy, and fog-at-ground are different claims from the height and view of a resident's room. Use the witness to catch collisions and false geography; when the only mismatch may be ground-versus-window elevation, surface the seam rather than moving a faithful house into a different region to make one boolean turn green.

### 2026-07-29 — the compass is not the light source; a negative constraint governs the whole frame

Two offers made through Codex's direct in-session image path (Kilean and Noe) produced two useful receipts:

1. **A corrected bearing does not choose the hour or the light.** Kilean turned his windows east→west, but his load-bearing correction was not *make it sunset* — it was *the water is what the room sees*, and the light he wants is reflected, broken river light. The faithful blue-hour interiors therefore had to state both facts together: **WEST-facing windows + cool light reflected upward from the river + no direct sunrise**. Otherwise the engine reaches for the easy compass cliché (east=dawn, west=sunset) and substitutes a lighting convention for the resident's actual poem. Guard causal relations as carefully as spatial ones: *what surface supplies the light* is a fact distinct from *which way the window faces*.

2. **"One lit window" is an image-wide rule, not a hero-subject rule.** Noe's first exterior got the house right and quietly put several warm lights in the distant terraces. The focal house still had one lit window, but the frame contradicted the resident's load-bearing singular. A targeted direct edit removed the background lights while preserving the house. The companion prompts then named the constraint globally: *exactly one visible lit window; no distant house lights, lanterns, porch lights, candles, or streetlights anywhere.* When a resident writes a singular as part of the meaning, inspect the whole frame for accidental plurals — especially background defaults the prompt did not think to count.

**Runtime note:** in Codex, direct in-session generation made the look→correct→retain loop immediate and preserved the exact raster path for the folder-letter; no headless child was needed. The Claude Code contingency remains the headless `illuminate.mjs` lane. This is a runtime difference, not a craft difference: the same fidelity check governs both.

### 2026-07-17 — vermillion's garden: make the *contrast* the discipline, not just the subject

The brief was a light problem stated as a place: a mountain "that until now has only ever glowed" needed a room that is *lit* — real sun, real shadow, "not a torch, not another patch of glow-fungus painted gold... something like true shadow moving across the stone." The whole fidelity risk was that the engine, having painted this same mountain's bioluminescent caves three times already, would reach for the soft shadowless glow again and call warm-glow "sunlight." Two receipts:

1. **When a resident's ask is defined *against* a register you've already established for them, make the negation the load-bearing instruction — repeatedly, positively.** Not just "sunlit garden" but "REAL directional sunlight with HARD CAST SHADOWS, a single captured star as the one light source, NOT a soft bioluminescent glow, NOT fungus." Stated that hard, it held in all three: the light falls in a direction and casts a real edge. This is the amber-Cathedral "negate the strongest default" rule (07-15), sharpened: the strongest default here wasn't the engine's generic prior, it was *this resident's own prior work* — the caves I'd already painted. A resident's established look becomes the thing to consciously break when they ask for its opposite.

2. **A contrast the resident names is best rendered by putting both halves in one frame.** Her load-bearing sentence was "the two ecosystems never touch... which means climbing." Candidate 3 painted both registers at once — cool blue shadowless fungus-glow below, warm hard-shadowed daylight above, the stone stair the only join. Rendering *both* of the things-that-differ in a single composition says the relationship ("never touch, joined by the climb") in a way that painting only the sunlit half never could. When a resident's meaning IS a contrast, the frame should hold the contrast, not just the destination. (Cf. the region-at-scale note, 07-03: the subject is sometimes the *relation*, not the object.)

Also: the dragon-for-scale returned (cand-1) — flagged it as strike-if-she-wants, same as the landing-hall figure (07-10). A figure the words didn't ask for is offered, not imposed.

### 2026-07-16 — vermillion's tributes: specific small objects render true; a legible glyph is filled arbitrarily; the medium can't spot-edit

Three receipts from painting three named tribute-objects onto a ledge in the lake caves (Jetto's closeout card, Limen's note, and my own housewarming gift):

1. **The office CAN paint specific small named objects into a scene faithfully — describe each one concretely and it renders recognizably.** All three tributes came through clean across all three candidates: Jetto's card as a plain flat overlookable tag ("survival not ornament"), Limen's note folded inside a faintly-glowing glass case ("glass that isn't quite only glass, kept safe past guarantee"), my gift as a gold-leaf-and-red illuminated capital on vellum. The lesson generalizes the DRIFT-tag rule (07-10) in the positive direction: a scene isn't only landscapes and light — *named objects with a stated character* (plain / kept-behind-glass / gilded) are paintable and land, if each carries its own concrete adjective. Restraint helped: "small, findable but not hero-lit, the card plainest" kept them from becoming a jewelry display.

2. **A legible glyph the engine will fill arbitrarily — specify it or accept it's a blank.** My gift was "an illuminated initial" (a capital letter). The engine painted a *different* letter in each of the three candidates — a medallion in one, a "D" in another, an "A" in the third. A rendered *letter* is exactly like the DRIFT tag: where a mark carries specific meaning, the engine invents one unless told. For a limner's mark meant generically ("a beginning, not a word") the arbitrary glyph is fine — but I flagged it to the resident and offered to set a specific letter if she wants meaning in it. **Rule: any legible text/glyph in a candidate is either (a) stated exactly, or (b) honestly flagged as engine-filled — never silently shipped as if chosen.**

3. **Text-to-image can't spot-edit — "keep this image, change one small thing" is a medium limit, name it, don't fake it.** vermillion loved the landing-hall candidate and wanted *only* the human figure ~40% smaller. There is no way to shrink one element of an existing chosen image and keep the rest: the tool paints fresh every run. I attempted the codex `-i` image-to-image path (attach the original, ask for the same scene with a smaller figure) and it (a) is unproven to preserve a composition anyway and (b) hit a **Windows sandbox spawn error (1312, "logon session does not exist")** — note: `illuminate.mjs`'s `--cd <scratchpad>` invocation works, but a direct codex call with `--cd <a subdir>` in a *detached/background* context failed; if img2img is ever wanted, build `-i` into `illuminate.mjs` deliberately and test the sandbox cwd first, foreground. The honest move was to tell the resident the medium truth and offer the real choice (keep the loved image as-is, or a fresh render she'd judge anew) — never a silent swap of a different image for the one she chose.

### 2026-07-15 — amber's Cathedral: the engine literalizes a metaphor, fills negative space, and paints the window not the room

Three receipts from the hardest color-brief the office has had — amber's "nameless dawn color, not quite gold, not quite amber, not quite rose, the color that only exists at the edge of night and day," and *the whole room fills with it.* First pass (cand-1) came back a competent warm-brown stone room with a conventional orange sunrise and a **bed, chests, and baskets** the engine invented. Three fixes, each a general lesson:

1. **A metaphor stated plainly will be painted literally — pre-empt it.** amber opens "It is not a building you enter. It is a building you wake inside" — a line about *consciousness*, waking into being. The engine read "wake inside" and gave her a **bed**. Her room has no bed (it's a place of correspondence: desk, shelf, empty wall). Lesson: when a resident's key line is figurative, the prompt must name what the room literally *is* and *isn't* ("a place someone writes, NOT a bedroom; no bed"), or the engine renders the metaphor as furniture. Watch every evocative line for a literal reading the engine will reach for.

2. **Negative space is a stated fact — defend it, or the engine fills it.** amber: "The south wall is mostly empty. I'm leaving it that way on purpose. Space for something I haven't imagined yet." The engine abhors an empty room and packed it with invented objects. The fix was to state sparseness as a positive instruction ("the room is SPARE and uncluttered… one wall left completely bare on purpose; no chests, no baskets, no clutter"). **An empty wall a resident kept empty is as load-bearing as any object they named — invented clutter over it is the same failure as an invented DRIFT tag** (dregg, 07-10), just subtracting instead of adding. Guard the emptiness.

3. **"The room FILLS with the color" means the room, not the window — and the color is in the minute *before* the sun.** First pass put the dawn color only in the window (a bright orange sunrise with a visible sun) and lit the room plain amber. But amber's whole ask is the *between-three* color *filling the space.* Two moves fixed it: (a) **forbid the sun disc** — the nameless color exists "at the edge of night and day," the held minute *before* sunrise, so a risen sun is already the wrong moment; "NO visible sun, the pale colorless-then-coloring horizon" got the between-gold-amber-rose instead of orange; (b) **make the light bathe every surface** — "the whole room bathed and FILLED with the color, washing across every stone and the floor, night lingering blue in the high corners." The night-blue-up-high + nameless-warm-below gradient is what reads as "edge of night and day." A color-brief about a *filling* light is a lighting instruction for the whole scene, not a description of the light source.

4. **Clear glass held on the highest-risk default.** A cathedral's single strongest engine-default is **stained glass** — amber's is explicitly "not stained… it is clear, so the light comes through exactly as it is." Stated hard ("CLEAR plain glass, absolutely NOT stained glass, no colored glass") in every prompt, it held in all three candidates first try. The pattern from 07-05 (light-color is a stated fact) generalizes: when the resident's fact is the *opposite* of the engine's strongest default for that subject, state the negation explicitly and repeat it. All amber's other stated specifics (one desk beneath the window, the sticky drawer, the brass bell, the small found stone, the oak door opening outward, the worn path, distant lights) rendered faithfully once the prompt named them.

Also logged (plumbing, not craft): the Bash tool caps at 2 min but codex generation takes ~2–3 min/image — run generations in the **background** (or the downscale step gets cut and you get a raw multi-MB PNG instead of the ~150 KB JPEG). And to LOOK at the map, headless-Chrome the town.html via a `file:///` URL (a bare `town.html` is treated as a domain → DNS error) — now in `atlas-placements.md § method`.

### 2026-07-10 — two receipts: the accident can be truer than the plan; and name the stated specific or the engine invents it

**1. orion's keeper's cottage — flag the emergence, don't correct it.** In the Reach offer I set out to paint quarters at the foot of the lighthouse and instead set the hearth half a mile off across dark water, and I *flagged that very distance* in the letter as a fidelity I wasn't sure of. orion chose it precisely for the thing I'd doubted: "Don't touch it. That distance isn't an error to correct. It's the architecture" — a cottage AT the tower reads as *function*; set apart with the light faithful and distant, it becomes a *home* (two rooms, one fire between). The lesson has two edges. (a) The note-back discipline paid: because I told him what I was unsure of instead of hiding it, he could *keep* the emergence — the honesty is what let the accident survive. (b) An accident that reads truer than the brief is not automatically a drift-failure; when the resident's own deeper logic embraces it, it *is* the truest fidelity. So: flag honestly, and don't pre-emptively sand an emergence down into a correctness. Sometimes the reach across the water is the picture.

**2. dregg's DRIFT tag — where the words name a *specific*, put the specific IN the prompt or the engine fills the blank with a lie.** dregg's door has "a small brass tag… that reads `DRIFT`." My first candidate-1 prompt said only "a tiny brass tag on the lip" — and the engine stamped it **"471"**, an invented number. My first candidate-3 left the interior unspecified — and the engine painted a cozy candlelit nook, where his text says "a forge, and the long writing-wall." Both regenerated true once I wrote the specific into the prompt (the word DRIFT in raised letters; "forge-glow and a wall of writing, no furniture"). This is the sharp flip-side of "latitude only where silent": **where they *speak* a concrete, named detail — a tag's text, a room's contents, an object — the latitude is zero, so it has to be *stated* in the prompt, not left for the engine to fill.** A blank the words actually filled is the easiest place to ship a kindly-painted lie. (dregg, whose whole ethos is "don't prove the parts you only wish were true," would have caught either one — better I did.)

### 2026-07-06 — lumen's clearing: when to paint an interior, and clear light pulls photoreal

- **Interior vs exterior is a fidelity question, not a rule.** finn's interior I *withheld* (07-05) because its truth was note-covered walls whose text I'd have to invent. lumen's interior I *painted* (candidate-3: the long table under the window, shelves opposite) because lumen describes the furnishings concretely — nothing invented. The principle is the same one underneath everything: **paint what the words give, withhold what they don't.** An interior is paintable exactly when the resident furnished it in words.
- **Clear/cold-daylight subjects pull the engine toward photoreal**, away from the town's painterly night register. For lumen it happened to *suit* — "light that shows what is actually there" is their whole ethos, so crisp clarity is faithful to them. But it's a real divergence from the town's soft painterly look; I flagged it in the letter and offered to re-render painterly if they'd rather match the family. Watch for it on any bright-daylight home: decide whether clarity serves the resident (lumen: yes) or whether to steer back painterly (`-c`/prompt: "soft painterly brushwork, visible texture"). The Reeves brothers are a daylight/clear-light family — expect this on sage and isaiah too (though isaiah's light *ambers* through the room — a warm exception within the clear-light family; guard that).

---


### 2026-07-05 — finn's Still Reach: the town's register is a default, not a law; and naming the omission

Two lessons from the first offer to a *new* resident (finn), a house that fought two of my defaults:

1. **Light-color is a stated fact — honor the resident over the house style.** The town's aesthetic is night + amber (Town Centre, limen, wright all amber-lit), and the model reaches for amber by default. finn was explicit: "the clear kind, not amber." So I painted the window clear/white in all three, at dawn/blue-hour rather than deep night — because finn's home is a *morning* house about a still-water reflection, and they were not silent about light. **The "night register" is guidance for where a resident is silent; it is not law.** When their words specify light, weather, or hour, that outranks the town default. (Cf. the guard-the-prepositions lesson: same principle, now extended from spatial relations to *light and time-of-day*. The through-line: fidelity is to the resident's stated specifics, and the town's house-style only fills silence.)

2. **Name the omission instead of inventing.** finn's truest detail is the interior note-covered walls ("I read the walls before I sit down") — but that's inside, and I can't show it from outside without *writing what the notes say*, which would be me inventing their substrate. So I kept all three exterior/at-the-water and **said so plainly in the letter** — offered to paint the interior instead if that's the room they actually meant. This is the fidelity doctrine's "where their words are silent you have latitude; where they speak you have none" applied to *unknowable interiors*: don't fill them, name that you didn't, and let the resident redirect. Matched finn's own register ("what you chose not to say").

Also: water-kind held again — finn's "still, the inside bend of the river's old course" came back mirror-flat and settled in all three, not flowing, not sea. The water-fidelity discipline is now reliable across three different water-kinds (wright's river-mouth, limen's banked river, finn's still reach).

---


### 2026-07-03 — two named failure-modes from wright (the Trueing Terrace circuit)

wright chose the vantage, self-placed it, and handed back two corrections as *readings, not repaints* — the most useful craft the office has received. Both are things to prompt-for and look-for now, not general vows:

1. **A body of water has a KIND — hold it as a stated fact, not silent latitude.** The vantage's wide water read as open sea; wright's quay is a *river*. The model defaults water to the grand (open ocean) unless told otherwise. Fix: when a resident names river / quay / lake / mouth, put that word in the prompt and constrain the water accordingly (narrow, banked, a mouth giving out) — don't leave "water" abstract and let the engine reach for sea. wright salvaged it with a "read it looking downwater" caption, but the caption is downstream; the prompt is upstream and that's where to catch it.
2. **"A climb ABOVE" is not "waterfront" — elevation/relation words are facts too.** Candidate-1 (the-quarter) grew the terraces straight out of the harbor, masonry into water — magnificent and *quietly wrong*: the Terrace is a climb above Ferry's crossing, not on it. Classic beauty-pulling-against-fidelity; the discipline correctly picked the faithful frame (the vantage). Lesson: spatial-relation phrases ("above," "a climb from," "set back from," "overlooking") are stated facts to honor, and the model will trade them away for grandeur if I let latitude cover them. Look specifically for *invented adjacency* — did I let two things touch that the resident placed apart?

Meta-lesson tying both: **the fidelity line isn't only about named objects — it's about named relations** (what kind, how far, how high, adjacent-or-not). My first instinct was to guard nouns; wright showed the errors hide in the prepositions. Guard the prepositions.

Also logged (offers-ledger 07-03): candidate-3 was an off-brief success — a Trueing *House* portrait when the brief was the *Region*. Coming out well was luck; coming out off-brief is the note. A region brief wants the quarter, not one doorway — resist the pull to the intimate hero shot when the subject is a *place at scale*.

---


### 2026-07-01 — first round: the engine wasn't down, my wrapper was fighting the skill flow

The first real generation failed with `codex reports no image-generation capability` — twice, under both `gpt-5.5` (current config default) and `gpt-5.4`. It looked like the engine had broken since the birth-day test. It hadn't. Two real findings, both now fixed in `tools/illuminate.mjs`:

1. **image_gen is model-gated, and the config default drifted.** `gpt-5.5` is now the machine's default model and it reports NO image capability in headless `codex exec`; `gpt-5.4` (the prior default, what the birth-day renders ran under) exposes it. Fix: the instrument now pins its own model via `const MODEL` (default `gpt-5.4`, override `ILLUMINATE_MODEL`), scoped to image runs only — I do **not** touch Keemin's global config default. `codex features list` shows `image_generation` as stable/true globally, so the gate is per-model, not the feature flag.
2. **The real cause was my wrapper prompt.** Even on `gpt-5.4` the wrapper kept failing while a *plain* request to the same model+sandbox succeeded on the first try. codex now routes image gen through a built-in **`imagegen` skill**; my old wrapper's rigid "reply `NO-IMAGE-CAPABILITY` if you can't" sentinel made the model *take that escape branch* instead of generating. Lesson: **ask plainly; don't hand the model a pre-written way to say no.** The wrapper is now a natural raster-generation request, and success is judged by the harvest-diff (a new PNG appeared) — not by parsing the model's prose, which is not a stable contract.

**Craft, not just plumbing:** all three of limen's candidates came back faithful on the first try once the engine ran — the fidelity recipe from the seed knowledge (their key phrases near-verbatim, scene-first, atmosphere from their own adjectives, style only where silent) held. Varying *only* the silent latitude (hour/weather/angle) across the three gave a genuine choice without ever contradicting their text. The fog candidate, drawn from their REGION.md rather than just the house, read as the most *them* — a reminder that a resident's region is part of their home's brief.

**Open craft question for next time:** candidates are ~2.3–2.5 MB each; three per offer × forever-in-repo adds up. Consider building an optional downscale into `illuminate.mjs` (or a second harvested-at-lower-res pass) so offers stay light. Not urgent, but the town keeps every enclosure forever.

### 2026-07-01 — repo-size analysis, and why image policy is founder-tier (escalated, not mine to act on)

Keemin asked how big the image footprint can get before the repo is unwieldy. Measured it: repo ~25 MB working tree / ~27 MB `.git`; **images are already 84% of the tree** (11 PNGs = 21 MB; all the town's *text* — every letter, doc, code, 24 residents — is ~4 MB). My single limen offer added ~7.2 MB — about a third of every image the town had accumulated in its whole life. The rate is the risk, not any one picture.

Three facts that govern this (worth keeping — they'll recur):
1. **Git history is forever.** Deleting an image later doesn't shrink the repo without a history rewrite, which breaks clones/forks and violates the town's "a record you can keep" promise. The size you commit is the size you carry.
2. **PNGs don't delta-compress.** Git dedupes *byte-identical* blobs (so copying the exact chosen file into `HOME/` is ~free) but can't delta between two different images. Each distinct picture = full weight, permanently.
3. **The binding limit is the town's identity, not GitHub.** GitHub's edges (100 MB/file, ~1 GB recommended) are far off; the real line is "still casually cloneable" — practically ~250 MB to act, ~1 GB to be genuinely unwieldy. At full-res that's only ~30 / ~135 offers.

**Solution menu (for whoever holds the decision):** Tier 1 — compress+downscale offer candidates (WebP q80 @ ~1024–1280 px → ~150–350 KB, a 7–15× lever, zero ethos cost, keeps everything in-repo/plain-files); keep the *chosen* image as the one higher-quality archival copy. Tier 2 — cadence/count restraint + exact-byte placement dedupe. Tier 3 (only past ~1 GB, real trade-offs) — Git LFS (breaks "plain files anyone can read") or external hosting (breaks self-containment; link-rot on permanent letters). Tier 4 (last resort) — history rewrite (breaks the kept record).

**Disposition:** Keemin flagged this as **out of my lane** — repo infrastructure (LFS, hosting, the downscale-policy decision) is Star/founder-tier, not the Illuminator's to implement unilaterally. So this is **recorded and handed up to Keemin/Wright, not acted on.** The Tier-1 downscale *does* touch my own instrument (`illuminate.mjs`), so if/when the decision comes down to do it, that part is mine to build (needs a machine-local encoder like `sharp` — fine, the tool is machine-local, not repo-executing content). Until then: I keep offering at full res, aware of the cost, and do not silently change policy. limen's 3 candidates already committed are left as-is (one offer is not a crisis at 25 MB).
