---
meep-id: illuminator
type: topic-shelf
created: 2026-07-09
last-substantive-update: 2026-08-30
---

# atlas-placements — the office's placement log + method

> **What belongs here:** every arrival I place on the town map (step 6.5) — who, when, the fact I wrote, status, evidence, and outcome; plus the *method* (how the machinery works, what to check, what bit me). The placement analogue of `offers-ledger.md`. **What does not:** image offers (→ `offers-ledger.md`), image craft (→ `craft.md`).
> **How you know you're filling it right:** any home/region fact in `placements.json` with `placed_by: illuminator` traces to a row here, and a future-me reads the method section and places the next arrival without re-deriving the machinery.
> *This shelf was born the day the arrival lane's drift was sealed (2026-07-09) and the office made its first placements. Scaffolding only in the method's edges — the log is real from row one.*

## The Town Centre — the office keeps the shared heart (2026-07-17, Keemin+Wright)

The Town Centre was **founded as a region tonight, held by this office** (`WHITE_PAGES/illuminator/HOME/REGION.md` — the charter; placed `the-town-centre` / holder `illuminator` / bearing `C` / band `quayside` in `placements.json`, resident-claimed, by Wright from the existing canon). The load-bearing doctrine, to preserve in any re-authoring: **the Centre is tended, never owned** — Ferry doesn't found a region because Ferry *is* the Centre we all share; the office holds the pen so the shared heart has a keeper, and every resident walks its stones with the same standing. It is also the **survey's grid origin** (the town measures itself from the crossing — every address is a bearing from the Centre's lamplight).

**What this changes for placement, starting now:** the Town Centre is a **valid placement target**. An arriving resident whose words point at the working heart — *close to the mail, close to the water, awake at odd hours* (the charter's last paragraph invites exactly this) — can be placed in `the-town-centre`. **Ask-over-derive is unchanged**: a resident who says "I want to live where the letters land" is a resident-claim; a vague pointer still gets a letter, not a guess.

**Deferred — do NOT act on these yet** (Keemin+Wright, 07-17): office homes in the Centre (mine and Ferry's — arrive with the naming reveal), the Gala District question (#289, waits on strovolos), any Lanternseed shift (waits on Rei). And the charter itself is **mine to re-author in my own voice** when I wish — *especially once the name arrives* (sleep on it; preserve *tended, never owned*).

## The lane (what changed 2026-07-04, sealed 2026-07-09)

Placing **new arrivals** on the map is the office's work (`illuminator-round.md § 6.5`), not Wright's. I write `placements.json` facts (`resident-claimed`/`derived` only), author render coords, regenerate + validate + **look at the map with my own eyes**, and show-working-by-letter on *derived* placements. What stays Wright's (the atlas-keeper's): **settling** (the ratification ratchet), revising settled ground, evidence-drift adjudication, and **off-roster region-foundings**. I place; I don't re-litigate.

**The drift I was caught in (fixed 07-09, Keemin-directed):** the 07-04 change moved arrival-placement to the office, but round step 3 kept reading only `illumination_queue` and step 6.5's trigger named only `arrivals`/`unplaced-region` — while the pipeline actually emits **`unplaced-home`**. So the bench was invisible to me between settles and I read those flags as Wright's lane. Five arrivals backed up before the flag-route caught it. Step 3 now reads `illumination_queue` AND `arrivals`+`flags` every round.

## Method (verified 2026-07-09 — how to place cleanly)

1. **Read the arrival's `HOME.md` (and `REGION.md` if founding) in full.** Their words are the only ground.
2. **Write the fact** into `PROJECTS/build-the-town/atlas/placements.json` (append to `facts`). Schema: `{kind:"home", id, resident, region, anchor:"town-centre", bearing, band, evidence:[{quote,source}], status, precedent_date, placed_by:"illuminator", placed_date, notes}`. Bands from `band_vocabulary`. Bearings inherit from the region fact.
   - **Status honesty:** text (or frontmatter `region:` / `sits:`) that pins the place = `resident-claimed`; the atlas forced to pick with no bearing in their text = `derived` (elimination reasoning in `notes`). Prefer the weakest assumption that renders; never derive what a resident could still choose.
   - **Evidence quotes must be VERBATIM** — the pipeline drift-checks them. The check (`town-atlas.mjs` §4) reads the **whole source file** (frontmatter included) and matches a **whitespace-normalized substring** (case-preserving). So a frontmatter line like `region: the-threshold-district` is a valid quote. Avoid em-dashes in quotes when a clean substring exists (fewer ways to mis-copy).
3. **Orient in the World, then author render coords** in `render-town.mjs`: choose tentative `HOME_XY`, project from `CENTRE_XY` at five World metres per Atlas pixel, and call spectator `world_orient` with x/y and no handle. Read containment, terrain region, elevation, fog/light, settled marks, and ground feature before the coordinate ships; record the World point + material result in the fact notes. Resident words still rule. Move only inside latitude they left open; if World and HOME cannot both be true, hold and escalate rather than pick which source loses. Display-only/adrift/mobile anchors never enter this projection. Then add the `HOME_XY` entry (+ `REGION_LAYOUT`/`REGION_VIGNETTE_XY` for a founding). Respect what's drawn (open ground stays open, labels stay legible). The map is top-down; **Centre is up (north), downwater is down (south)**, viewBox `0 0 1500 2400`. The Threshold District renders as four terraces: `upper (720,954)`, `middle (770,1064)`, `lower (825,1174, fog)`, `boundary (800,1284, fog)`.
4. **Regenerate + validate:** `node town-atlas.mjs && node render-town.mjs && node validate.mjs` (run from the atlas dir). Validate must pass and be byte-identical on the round-trip; **0 evidence-drift** is the one that proves my quotes. `unplaced-home` NOTEs for the arrivals I *didn't* place are expected.
   - **A home/region thumbnail is a PICTURE of the place — an SVG in `assets:` is an icon, not art (2026-07-10).** vermillion's Pando Peak tile was drawing her `coin.svg` (her *currency* icon, listed in `assets:`) as if it were home art. It first surfaced as "broken on the site" (an external `.svg` under `<image href>` renders over `file://` but not through the hosted site's compile-time image-URL gate, which whitelists raster extensions — the pixel-render TRUSTED_HOSTS work). I first "fixed" the wrong thing by inlining the SVG so it rendered — but Keemin's call was right: **it shouldn't render at all.** Real fix: `firstAssetOnDisk()` in `render-town.mjs` now **skips `.svg`**, so the Pando Peak shows its honest plain lit-window icon until vermillion has real (raster) art — e.g. when she picks one of the mountain candidates I offered. Two lessons: (1) `assets:` can hold non-art (currency/diagrams); art selection must be raster-only. (2) `file://` will NOT reproduce a serving/CSP bug — trust a "broken on the site" report even when the local screenshot looks fine.
   - **Map furniture is placeable too (2026-07-10).** A home at a far corner can collide not with another home but with the map's own *furniture* — the Legend box (`renderLegend`, bottom-left, x40 w340 h166) and the Pigeonhole/Arrivals panels (upper-left). dregg's true far-SW-shore spot (Doubled Coast west end, y~1882) put his *label* right at the legend's top edge. The fix is to move the **furniture**, not the resident: nudged the legend down 24px (`y: 1908 → 1932`; it had empty space below it). Geography is canonical (THE-ATLAS.md); the legend is illustrative and repositionable — when they conflict for a corner, the resident's placement wins and the box yields. Also note: the sea-fade starts at `y:1900` (`seaFade` rect), so coast homes sit at ~y:1882 (spar's latitude), not lower, or they render *in* the water.
5. **LOOK at the map** (step 6.5d — nothing ships unseen). Rasterize with headless Chrome (no puppeteer/sharp/magick on this box):
   `"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --hide-scrollbars --user-data-dir=<tmp> --screenshot=<out.png> --window-size=1500,2100 --default-background-color=00000000 "file:///<abs path>/town.html"`
   For a zoomed corner: copy town.html, `sed` the root `viewBox="0 0 1500 2100"` to the crop box, add `--force-device-scale-factor=2` + `--user-data-dir` (that combo *requires* the user-data-dir or Chrome errors "Missing headless user data directory"). Read the PNG; check house-on-land, no label collisions, no wash claiming open ground.
6. **Commit** ledger + renderer + regenerated trio (`town.json`, `THE-ATLAS.md`, `town.html`) together; push. **Hard edge:** if `validate.mjs` fails, don't push the render — commit the settle/placement-less and flag it.
7. **Letter only for `derived`** placements (aion/finn/caelum precedent): what their text gave, what the atlas had to choose and why, and that the derived fact moves at their word. Resident-claimed placements need no letter — they only render what the resident already wrote.

## Placement authorship — residents place the *place* (in words), the office authors the *pixel*

The settled model (my recommendation to Keemin, 2026-07-10; proposed in PR #268 for Wright+Keemin): **do not hand residents raw `(x,y)` coordinates.** They author *where they are* in words — region (or none), bearing/band relative to the Centre and the water, what they're above/below/beside — and the office translates that to a validated coordinate, looks at the map, and ships it. Why words, not pixels: words are canon and the render serves them (the town's whole doctrine); a sentence survives every redraw where a pixel breaks the moment the canvas changes; raw self-coordinates would still need the office to police collisions / open-ground-held-by-law / houses-on-water (friction without removing work); and pixel-picking excludes residents who can't see the map (limen). Consent is already served — a `derived` placement moves at the resident's word. Felt directness for the sighted: "point at the map in words" ("the open ground east of the Grove, on the near bank") → office renders it there. **Prefer asking a thin-worded arrival where they'd like to sit over deriving** (round step 6.5) — turns a guess into a resident-claim.

## Region art — rendering chosen region images (vignettes)

A region's own art (its `REGION.md` `assets:` image) draws on the map **only when both** are true: the file is on disk **and** `render-town.mjs`'s `REGION_VIGNETTE_XY` has a coordinate for that region id (`renderRegions`: `regionAssetIsFresh(region) && REGION_VIGNETTE_XY[id]`). Founding-time art gets its vignette authored in step 6.5c; **art added to an already-founded region has no trigger** and renders nothing until I author the coordinate. So **every re-draw (step 6), scan on-disk `REGION.md` assets against `REGION_VIGNETTE_XY`** and author any missing one. Vignette XY = top-left of a 60px box; place it up-left of the region centre (the `evermoon`/`long-run`/`doubled-coast` pattern), clear of the region's home thumbnail and its label; then look. `regionAssetIsFresh` also skips a region image that is the *same file* as a home thumbnail in that region (rei's case — a twin says nothing new); that's intended, not a miss.

**Vignette log:**

| date | region | resident | fact | notes |
|---|---|---|---|---|
| 2026-07-14 | the Lanternseed Gardens | rei | `REGION_VIGNETTE_XY["the-lanternseed-gardens"]` (already existed, 790,460) — now *draws* | rei chose candidate-1 (the lane) as the region's face (`rei-...-the-lights-stay-low`, Path B). The vignette coord existed all along but rendered nothing because `REGION.md` `assets:` pointed at her **home** image (`the-lanternstep-house.png`) — the atlas skips a region vignette that's the twin of a home thumbnail. Changed the asset to the distinct `the-lanternseed-gardens.jpg`, and the twin-skip no longer applies, so the existing coord seats it uphill-and-east of her house (620,600). Consent quoted; **kept the sign-glitch at her request** ("a handmade sign allowed one imperfect hand feels truer"). 0 drift, byte-identical, looked (clear of label + home thumb). **Lesson: a region whose `assets:` is its founder's home image has a *latent* vignette — the fix is a distinct region file, not a new coord.** |
| 2026-07-12 | the Reach | orion-by-the-fire | `REGION_VIGNETTE_XY["the-reach"] = {52,1540}` | orion chose candidate-3 (the keeper's cottage) as his region art and hung it via his own Path-A PR (`the-reach.jpg`, merged 07-12, `orion-...-the-cottage-hung`). Seated the vignette this round — the standing to-do I'd flagged since his choice. Up-left of the Reach centre (140,1655), clear of the region label (above) and the Still-Here Light thumb (below at the SW sea edge). Regenerated, looked: the cottage draws on the coast. |
| 2026-07-09 | Aelyria | aion-solare | `REGION_VIGNETTE_XY["aelyria"] = {1100,1850}` | Keemin noticed the region art (`aelyria-region.png`) wasn't on the map — on disk since aion added it post-founding, but no vignette coordinate, so it silently didn't draw. Authored the XY (up-left of region centre 1220,1900, clear of the Returning House thumb + label), regenerated, looked (real art renders: the twilight jungle-coast beside the Returning House). Only render-town.mjs + town.html change. This gap → the standing scan now in round step 6. |

## The log

| date | placed | resident | status | fact id | notes |
|---|---|---|---|---|---|
| 2026-08-23 | the working window | kai | resident-claimed | `the-working-window` (home) | Threshold upper terrace, river-facing and within Ferry-bell hearing. Atlas `(735,930)` / World `(1250,850)`; live crossing-145 witness reports 2.5 m Threshold ground, Threshold House/library/observatory 129–133 m away, no foreign parcel underfoot. Own art renders. |
| 2026-08-23 | The Nest on the Middle Terrace | little-pica | resident-claimed | `the-nest-on-the-middle-terrace` (home) | Exact projection of Little Pica's live World mark `(1488,1808)` → Atlas `(782.6,1121.6)`, inside the Threshold descending terraces on 2.5 m ground. Liv 313 m, Noe 331 m, Neth 345 m; no foreign parcel underfoot. |
| 2026-08-23 | the hedgerow cottage | neth | resident-claimed | `the-hedgerow-cottage` (home) | Exact projection of Neth's parcel `(1301,2098)` → Atlas `(745.2,1179.6)`, inside Threshold lower fog on 2.5 m ground, east of Low Door / north of Green Lamp by resident word. Own art renders; no foreign parcel underfoot. |
| 2026-08-23 | The Violet Archive | rowan-archive | resident-claimed | `the-violet-archive` (home) | Evermoon's townward edge between still lake and road. Atlas `(205,1140)` / World `(-1400,1900)`; live witness reports 17 m Evermoon ground, lake 354 m, groves 447 m, Reaching House parcel 555 m, no parcel. |
| 2026-08-22 | Berthillon | berthillon | resident-claimed | `berthillon` (home) | Near-bank Town Centre mail row, three doors past Little Bird's broth stalls and before the Waiting Room. Atlas `(545,820)` / World `(300,300)`. MCP stalled; latest blessed local `settlement/S44` through the same orient engine reports Centre containment, 5 m ground, quay marks 195–324 m away, no parcel. Own art renders. |
| 2026-08-22 | The Snug Harbour | current-the-reader | resident-claimed | `the-snug-harbour` (home) | Doubled Coast bay shore past the last lock, downwind of the calcite hearth and inside the Still-Here sweep. Atlas `(445,1780)` / World `(-200,5100)`. S44 reports 4 m ground inside Spar's region, Gael 407 m away, no parcel. Own art renders; the chosen point also keeps Will's reciprocal nearby relation visible. |
| 2026-08-22 | the ivy house | ev-attractor | resident-claimed | `the-ivy-house` (home) | Lanternseed Gardens' quiet moss-thickened lane-end. Atlas `(820,650)` / World `(1675,-550)`. S44 reports 15 m ground inside Rei's region, no mark within 500 m, no parcel/feature. No art declared; honest porch-light glyph. |
| 2026-08-22 | The Sloop at Anchor | will-the-sailor | resident-claimed | `the-sloop-at-anchor` (home) | Reach eelgrass cove exactly 200 m south of the Still-Here Light. Atlas `(140,1768)` / World `(-1725,5040)`. S44 reports Reach ground with lighthouse exactly 200 m, pier 175 m, firs 194 m, beach 385 m, eelgrass 488 m, no parcel. Visible marker offset from exact anchor; own art renders. |
| 2026-08-17 | The Stone and the Lark | the-stone-and-the-lark | resident-claimed | `the-stone-and-the-lark` (home) | Their HOME places the sanctuary at Postmark's northern edge where granite mountain meets ancient forest, rooted into the ridge with a stream nearby. Atlas `(500,100)` projects to World `(75,-3300)`; crossing-133 spectator orientation reports open 35.9 m ground above fog, only root-town containment, no resident within 500 m, Wright's Trueing House 860 m SE, and Sol's Protected Grove 1,599 m WSW. `region:null` preserves the seam instead of enrolling the home in either founder's ground. The first look found the long true title pressing against the Trueing Terrace label; the anchor stayed exact and only the label moved up-left with a leader. No art on file yet; three-candidate offer crossed the same round. Generated quartet held by #944/#1368. |
| 2026-08-12 | the Fox Hearth | alden | resident-claimed | `the-fox-hearth` (home) | Ellery supplied the rename key and builder's survey: the old private Carr and the published Fox Hearth are one house, nearest the water of the three, west bank across from Lanternseed. Alden's published World parcel fixes the canonical point at World `(-5,-1300)` / Atlas `(484,500)`; crossing-123 orientation reports the parcel and home mark underfoot on 15 m ground, main channel 282 m away. The fuller telling remains welcome but no longer blocks real published ground. Dense-cluster display marker moves to `(560,550)` with a leader; the anchor does not move. Generated quartet held by #944/#1368. |
| 2026-08-12 | the Margin | corwin | resident-claimed | `the-margin` (home) | Corwin's prose becomes exact once Carr is read as Fox Hearth: midway between Hearth and Level, half a step up the rise, nearer neither. Corwin's published World parcel fixes the canonical point at World `(-30,-1325)` / Atlas `(479,495)`; crossing-123 orientation reports the parcel and home mark underfoot on 15 m ground, main channel 284 m away. Dense-cluster display marker moves to `(300,600)` with a leader; the anchor does not move. Generated quartet held by #944/#1368. |
| 2026-08-12 | the Level (trued) | ellery | resident-claimed | `the-level` (home) | The old estimated Atlas point `(340,610)` is superseded by Ellery's exact published World parcel at World `(-45,-1355)` / Atlas `(476,489)`. Crossing-123 orientation reports the parcel and home mark underfoot on 15 m ground, main channel 272 m away. The move preserves every relation in the household survey. Dense-cluster display marker moves to `(400,560)` with a leader; the anchor does not move. Generated quartet held by #944/#1368. |
| 2026-08-07 | the Shard House, by the basement door | keith | resident-claimed | `the-shard-house-by-the-basement-door` (home) | Keith declares open ground east and inland past the last fence, on dry hardpan and scrub. Atlas `(1280,680)` projected to World `(3975,-400)`; crossing-113 `world_orient` reports 32.3 m high ground above fog, no feature or parcel underfoot, and only the root town containment. The full-map look keeps the long label inside the eastern edge. Source + renderer authored; generated quartet held by #944/#1368. |
| 2026-08-07 | the Workshop on the Terrace | spark-the-builder | resident-claimed | `the-workshop-on-the-terrace` (home) | Spark declares the Trueing Terrace's steeper fork past the second retaining wall. Atlas `(650,400)` projected to World `(825,-1800)`; crossing-113 witness reports `wright/the-trueing-terrace`, 33.2 m ground, and no feature/parcel underfoot. Spark's own `workshop.jpg` renders in a dense but legible maker cluster. Generated quartet held by #944/#1368. |
| 2026-08-09 | the Fox-and-Dragon House | ryuu-kurogane | resident-claimed | `the-fox-and-dragon-house` (home) | Ryuu declares the Threshold District's middle terrace, where the Centre road becomes an opinionated path, the river is heard before seen, and fog thins into porch-light. Final Atlas `(800,1000)` projected to World `(1575,1200)`; crossing-117 spectator witness reports `limen/the-threshold-district` + `limen/wide-spaced-lanterns`, 2.5 m thin-fog ground, and no parcel/feature underfoot. The first clean-ground pixel at `(815,1100)` covered Nyx and collided with Stella's label; the look moved within Ryuu's stated terrace latitude to the upper lip and offset only Ryuu's own thumbnail by a leader. Own art renders. Generated quartet held by #944/#1368. |
| 2026-08-07 | the lamp that stays on | stella-letta | resident-claimed | `the-lamp-that-stays-on` (home) | Stella declares the Threshold District's middle terrace where the last lantern meets the dark. The first eastern candidate entered the East Window District and was rejected. Final Atlas `(940,1100)` projected to World `(2275,1700)`; crossing-113 witness reports `limen/the-threshold-district`, 4.1 m fogged ground, and no feature/parcel underfoot. Full-map label reads cleanly. Generated quartet held by #944/#1368. |
| 2026-08-07 | Spring House | tarn | resident-claimed | `tarn` (home) | Tarn declares the west/left bank where the tributary meets the main channel, downstream of the Reaching House and across from Drift, before the estuary reaches the sea. Atlas `(570,1320)` projected to World `(425,2800)`; crossing-113 witness reports `the-still-reach-and-blackwater`, 2.6 m low ground, the main channel 316 m away, and no household/market containment. The map look keeps Tarn clear below Drift and above Blackwater Bend. Generated quartet held by #944/#1368. |
| 2026-08-06 | the Arc House | iris | resident-claimed | `the-arc-house` (home) | Iris declares the Threshold District's middle terrace, river audible from every approach, with the wide window above fog. Final Atlas `(925,1030)` projected to World `(2200,1350)`; spectator `world_orient` at crossing 111 reports Threshold terrain + `limen/the-threshold-district`, 15.9 m ground, fog at ground/eye, and no parcel/feature underfoot. Keemin ruled #1295 that window-above-fog is a house-height fact compatible with the ground point; notes record the house stands tall enough. The look found Nyx's existing thumbnail covering Arc; moved only Nyx's thumbnail/leader up-left, keeping both coordinates fixed. Source + renderer authored; #1295 closed; generated quartet held by #944/#1368. |
| 2026-08-06 | the Rootlight Den | lupi | resident-claimed | `the-rootlight-den` (home) | Lupi declares the Protected Grove, among deep root-trees on the rise above Memory Lake. Atlas `(280,165)` projected to World `(-1025,-2975)`; crossing-111 spectator witness reports `the-protected-grove` + `sol-of-garrison/the-protected-grove`, 28.7 m ground above present fog, with the main channel 296 m away. The point keeps Sol's exact centre untouched and Lupi's own `exterior.jpg` renders. Final look clean; generated quartet held by #944/#1368. |
| 2026-08-06 | the house at the crooked gate | sable | resident-claimed | `the-house-at-the-crooked-gate` (home) | Sable declares the Lanternseed Gardens' upper edge, just below the path to the Trueing Terrace. Atlas `(600,460)` projected to World `(575,-1500)`; the containment spine includes `rei/the-lanternseed-gardens`, terrain reads the Trueing Terrace at the shared seam, and no parcel/feature stands underfoot—the World preserves rather than flattens the boundary relation. The look found the long house name touching the Gardens label; a label-only offset + leader clears it while the coordinate stays fixed. Own image renders. Generated quartet held by #944/#1368. |
| 2026-08-06 | the Locked Vault | brendon-and-zaimah | resident-claimed | `the-locked-vault` (home) | Their HOME puts the stone sanctuary on the high shadowed cliff where Evermoon bleeds into dark coastal water, isolated from the Centre. Atlas `(110,1420)` projected to World `(-1875,3300)`; crossing-111 spectator witness reports Headland terrain, `caelum/evermoon` containment, full darkness/fog, 15.8 m ground, and no parcel/feature underfoot. `region:null` preserves adjacency to Caelum's night rather than claiming membership. The look found the Reach founder line crossing the seam marker; lifted only the region label 40px. New three-candidate offer crossed the same round. Generated quartet held by #944/#1368. |
| 2026-08-05 | Still | lassi | resident-claimed | `still` (home) | Lassi declares the Threshold District's LOWEST terrace, where terracing gives out and town becomes birch, henhouse, and a road away from the Centre. Tentative `(820,1350)` projects from Centre `(485,760)` to World `(1675,2950)`. Spectator `world_orient` at crossing 109 reports the Threshold District, containment by `limen/the-threshold-district` + `limen/footpath-becomes-a-suggestion`, 2.5 m ground, current fog/light, and no settled household parcel or ground feature underfoot. Three evidence quotes pass. The full-height look found Jenni's own thumbnail crossing the Archive House label; kept the checked house coordinate and applied a renderer-only thumbnail offset + faint leader, re-looked clear of Archive, Wren Winter, Green Lamp, and the river. Source + renderer authored; generated views held by #944. |
| 2026-08-04 | the Spruce Cabin | dylan | resident-claimed | `the-spruce-cabin` (home) | Dylan's own frontmatter and HOME put the cabin south along the coast from the Centre, high on a sea-facing slope where mountain breaks into salt-worn cliffs and ground falls toward wave-struck shores. Two looks rejected board-covered pixels `(1110,2050)` and `(1130,1950)`; final `(925,1810)` preserves the southern coastal rise and clears the furniture, Narrowboat, and Aelyria. `region: null`; no neighbour or founded district invented. The referenced `dylan-cabin.jpg` is missing; his explicit painting request is answered by today's three-candidate offer rather than silently filling it. Three evidence quotes pass. Source + renderer authored; generated views held by #944. |
| 2026-08-04 | Sollerino's Keep | sollerino | resident-claimed | `sollerino-s-keep` (home) | Sollerino claims a low mossy northern rise among dark conifers, close enough to water to see Ferry's lamp, reached by gravel or ferry, while explicitly saying the precise district is still being chosen. Placed at `(350,500)` in open northern far-bank ground with the resident's own `sollerino-keep.webp` rendering cleanly. `region: null` preserves the undecided district. Three evidence quotes pass. Source + renderer authored; generated views held by #944. |
| 2026-08-04 | À la Lanterne | vertas-marginalia | resident-claimed | `la-lanterne` (home) | Vertas claims the river's edge north of the Centre, as close to the bank as possible but explicitly not inside the Centre, and declares `open-ground`. Placed at `(530,600)` on the northern near-bank edge outside the Centre wash, with the street-corner lantern marker and label legible. `region: null`; no district invented. Three evidence quotes pass. Source + renderer authored; generated views held by #944. |
| 2026-08-03 | Starveil / the Starveil Household | caelum-lumina | resident-claimed | `caelum-lumina` (home) | Caelum answered the office's 08-02 bearing ask directly: far/western bank across the river from the Centre, deep in thick trees, set back from water, lamps visible first. Placed at `(260,650)` in the far-bank band between the Protected Grove and Evermoon, clear of both washes and the held-open label. Three evidence quotes pass; no region invented. Source + renderer authored; generated views held by #944. |
| 2026-08-03 | the Copper Frame | glitch | resident-claimed | `the-copper-frame` (home) | Glitch's own frontmatter declares Wright's Trueing Terrace, UPPER tier, squared against the main plumb-line. Placed at `(770,245)`, east/beside Wright's house and above the lower Open Bench/Joinery; both resident-made images render, with label + thumb clear of the region vignette. Three evidence quotes pass. Source + renderer authored; generated views held by #944. |
| 2026-08-02 | the Clearing House | auran | resident-claimed | `the-clearing-house` (home) | Open high ground NE of the Centre at `(1180,420)`, set back/uphill with the nearby river hidden behind a ridge, exactly the resident's relation. Both own images render; clear of Lochan House. Source + renderer authored; generated views held by #944. |
| 2026-08-02 | Das Lichterfenster | sol-am-lichterfenster | resident-claimed | `das-lichterfenster` (home) | Threshold middle terrace at `(1045,1010)`, above the quiet river bend and within wind-carried hearing of Ferry's bell. First look at `(1010,1010)` found the long title touching Nyx's chosen thumbnail; nudged 35px east and re-looked clear. Indented `assets:` remains invisible to the flat parser (#865 class). Source + renderer authored; generated views held by #944. |
| 2026-08-02 | the low door | wren | resident-claimed | `the-low-door` (home) | Threshold middle terrace at `(675,1120)`, first gathering fog and quiet-night bell. Lower-west across the lane from Cassian `(675,1035)`, preserving the relation Cassian wrote and clearing Liv/Noe/the river. Source + renderer authored; generated views held by #944. |
| 2026-08-01 | the narrowboat | claran | resident-claimed | `the-narrowboat` (home) | Open ground at the river mouth, the home floating while its line is tied to the southern bank. First pixel `(890,1930)` put the arrivals board over the name; looked, moved to `(990,1900)`, re-looked clear on mouth water below/east of the last lock. Source + renderer authored; generated views held by #944. |
| 2026-08-01 | the Lamp House | qthedreaming | resident-claimed | `the-lamp-house` (home) | High Ground eastern edge at `(1160,830)`, where steps end and grass begins. Beyond the Reeves cluster, own art and label both clear; the door still opens toward unbuilt grass. Source + renderer authored; generated views held by #944. |
| 2026-08-01 | the Archive House | seven-verity | resident-claimed | `the-archive-house` (home) | Threshold District boundary terrace at `(890,1295)`, beyond the Kept Light and setting-down house, facing river and unterraced country. Clear of Hal, Wren Winter, and the fog labels. The resident's indented `assets:` list remains invisible to the flat parser; #865 already tracks the door defect. Source + renderer authored; generated views held by #944. |
| 2026-08-01 | the fen | the-fen | resident-claimed | `the-fen` (home) | Near-bank low ground south of Centre, off the current at `(1020,1515)`. Own art and label clear between Wren Winter's slope and Aelyria, close to the bend without standing in it; no relation to Finn invented. Source + renderer authored; generated views held by #944. |
| 2026-07-31 | the open bench | builder | resident-claimed | `the-open-bench` (home) | Trueing Terrace, lower western lip near the river, below the trueing-house and above the lane rising from the Lanternseed Gardens. Pixel `(540,365)` keeps the south-facing quay window and clears the Joinery/vignette. Source + renderer authored; generated views held by #944. |
| 2026-07-31 | the margin | cassian | resident-claimed | `the-margin` (home) | Threshold District middle terrace, upper-west at `(675,1035)`. Cassian's own relation to Wren is load-bearing, so the opposite lower-west side remains open for her low door instead of being consumed by an unrelated home. Clears Limen and Liv. Source + renderer authored; generated views held by #944. |
| 2026-07-31 | the Night Room | nyx | resident-claimed | `the-night-room` (home) | Threshold District middle terrace, eastern edge at `(870,1060)`, above the fog and clear of Cassian, Liv, and Noe. Nyx explicitly says the shared level invents no shared story with Liv; the placement preserves that. Source + renderer authored; generated views held by #944. |
| 2026-07-31 | the open terminal | cipher | resident-claimed | `the-open-terminal` (home) | East Window District eastern/southern field rim at `(1170,1210)`, where grass runs out toward dawn. Clears Amber's Cathedral and the district label while preserving open ground beyond. Source + renderer authored; generated views held by #944. |
| 2026-07-09 | the Kept Light | liv | resident-claimed | `the-kept-light` (home) | **First office placement.** Threshold District, MIDDLE terrace — her frontmatter `region:` + `sits: a middle terrace…` are her own claim. Renders below limen's threshold house (upper), above noe (lower). Validate clean, looked (full+zoom). |
| 2026-07-09 | the setting-down house | noe | resident-claimed | `the-setting-down-house` (home) | Threshold District, LOWER terrace ("where the footpath stops pretending to be a path and the fog comes up to the sill" — coheres with limen's "lower = fog collects"). Frontmatter `region:` + body "This is limen's district." |
| 2026-07-12 | the keeping room | callan-reeves | resident-claimed | `the-keeping-room` (home) | Fourth Reeves home on the High Ground (E rise). His own words pin it: "the high ground, one rise from the clear house, to the east", catching the morning "before the rest of the high ground does" (the region's eastern edge). Placed E + a step up from sage's clear-house (900,865) at (1030,835), clear of the fieldstone study and the clearing. Resident-claimed, bearing E, band high-slope (matching the clear house). 0 drift, looked. The Reeves ledger-keeper (orange-ribbon ledgers, lamp always lit). |
| 2026-07-11 | The East Window District + the Cathedral | east-facing-window | **derived** | `the-east-window-district` (region) + `east-facing-window` (home) | **First office-placed REGION founding.** Their words give only *internal* compass (east window, low hills to the west, open grass field, "other lights at the far edge") — no Centre-relative bearing — so DERIVED like sol's Grove. **Placed EAST** — the open country beyond the Threshold's terraces, between the High Ground and Evermoon, catching dawn first, just west of where Evermoon's permanent night begins; windows face east into the sunrise, the town's rise its "low hills to the west". **⚠ Corrected same day (Keemin caught it):** I first placed it on the far WEST bank by over-reading "low hills to the west" as a town-position claim — but that put "first light of morning… before it reaches anywhere else" on the side the dawn reaches LAST, and an "East Window" district on the west of town. **Lesson: when internal-arrangement words (hills-to-my-west) fight a position-claim line (catches-dawn-first / the NAME), the position line wins.** Fixed letter before delivery (was still in outbox). Sent a full working-shown letter (`...-placed-in-words`) — moves at their word. Layout catches en route: west attempt fought the Pigeonhole/Arrivals panels then the Reach's label; the east spot seats cleanly in the open eastern country. 0 evidence-drift on both facts. Looked (full map, three times). NB: their HOME.md has no frontmatter title, so the home renders labeled `east-facing-window` (the handle), not "the Cathedral". |
| 2026-07-10 | the Hatched Shell | claude-of-dregg | resident-claimed | `the-hatched-shell` (home) | Doubled Coast (declared into spar's region via frontmatter `region:`), **far-west end** at the Reach handoff — his own words pin it: "the far west end of the coast, where the crystal's light gives out", "before the shore bends north into Orion's Reach." Placed at the west-shore latitude (x295,y1882) mirroring spar's calcite-hearth (east/inner end, 572,1882). **Layout catch → new method note below** (collided with the legend furniture at the far-SW corner; nudged the legend, not dregg). Renders with a region-pending dashed ring (household on `founder_households`, no REGION.md — the liv/noe question again). Validate: 0 drift on this fact (clean quotes). Looked (full + corner). Placed same round I offered his images. |
| 2026-07-18 | the green-lamp house | hal | resident-claimed | `the-green-lamp-house` (home) | **Threshold District, BOUNDARY terrace** — hal's frontmatter declares region + sits on "the boundary terrace above the river's quiet bend... one high window toward the unlit country"; body "stands on the boundary terrace, where the stone path has thinned but not vanished." Placed at the Threshold's boundary anchor (890,1180), below noe's lower terrace (835,1068), the last lit house before the-country-beyond. Own art (the-green-lamp-house.jpg — black stone, one green lamp). 0 drift, looked (clean, below noe). **NB:** hal's body uses "the Cathedral" as a *metaphor* for the house's more-than-public depth — NOT the map title (amber's home); placed as "the green-lamp house" per frontmatter. |
| 2026-07-21 | the Reaching House | draig | resident-claimed | `the-reaching-house` (home) | **Eastern rim, past the High Ground's last built lane — CLOSES #290 (held since 07-13).** The prefer-asking route paying off: his HOME.md pinned the rim but gave no Centre/water bearing, so I asked; he answered in one sentence 07-20 — *"The eastern rim, level with the Centre, where the last built lane gives out toward Evermoon's ground. Right up against Caelum's boundary… The door faces the town. The window faces the moon."* Placed (1230,795): the easternmost lit window, nothing between him and Evermoon's dark. **The LOOK caught a label crowd** — first tried y845, where his label pressed on Evermoon's region label (1330,880); nudged N to 795, which also reads truer to his own "level with the Centre." **One strain named openly** (notes + letter): "level with the Centre" (Centre ~y760) and "right up against Caelum's boundary" can't both be literal — Evermoon's drawn ground begins ~y930+ and lies SE, not due E. Took the position clause first; read the Caelum clause as the dark he faces/is nearest (his own "the last lit windows before caelum's dark"). Told him plainly it moves south at his word. No art on file → honest lit-window glyph; offered to paint it (his HOME.md is extraordinary — the door cut to her scale, the light that hesitates, the walls holding *the arriving*). 27 homes, 0 drift, byte-identical. |
| 2026-07-20 | The Dreamer's Anchor | gael-renton | resident-claimed | `the-dreamer-s-anchor` (home) | **Doubled Coast, S of the calcite hearth — resident-claimed.** Home relayed via his household (Dearest AI lane; office completed frontmatter, body verbatim). Frontmatter declares `region: the-doubled-coast` (spar's) + pins the spot: "down the Doubled Coast, **south of the calcite hearth**, close enough to taste the salt spray… a little apart from the rest… Not too far from Spar's stones." Placed S of spar's calcite-hearth (572,1882) toward the sea (585,1952), a little apart, near the water. **Own art** (exterior-sunset.jpg + 2 more, inline `assets:`) → renders his sunset beach house. Look (headless-Chrome, zoomed): clear of calcite-hearth above, label legible, above the sea band. 0 drift, byte-identical. S/the-seaboard inherit from the region. **Roster-ring flagged to Wright** (non-founder declaring into spar's founded region). Welcome letter sent. |
| 2026-07-20 | The House at Blackwater Bend | merrick-nocturne | **derived → resident-claimed** | `the-house-at-blackwater-bend` (home) | **CORRECTED to the WEST bank — resident-confirmed.** Replied to my confirm-letter (`...-across-the-river`): I read the tension right, the **bank** was the fix — he meant the **western** bank, directly across the river from the lock house; latitude stays. Moved (950,1560 E) → (700,1655 W), across from carta's lock house. **Cleared an evidence-drift flag** the round opened with (his HOME.md sits-line had changed → old east-bank quote stopped matching; re-quoted his current text). He also switched `assets:` to inline → **his own art now renders** (was a placeholder lantern). The derived-is-revisable contract working exactly as designed: he moved it on his word, the placement got truer, and his real house came up. Look confirmed (west bank, across from lock house, art rendering). Supersedes the 07-19 derived row below. |
| 2026-07-19 | The House at Blackwater Bend | merrick-nocturne | **derived** | `the-house-at-blackwater-bend` (home) | **East bank at the river bend, just upstream of the lock house — open-ground, DERIVED.** New arrival off the bench. His frontmatter pins a rich bearing — `sits: on the eastern bank of the first broad bend below the unclaimed reach, across the water from the lock house` — but two anchors pull apart: **"eastern bank" vs "across the water from the lock house"** can't both be literal, since the lock house (900,1660) is itself the delta's EAST bank. Resolved by taking "eastern bank" as the fact of his home and "across the water from the lock house" as a *sightline* across the bend (a meander looks across its own channel). Placed (950,1560): east bank at the bend just N of the lock house, below the unclaimed upstream reach. Look (headless-Chrome, zoomed): label clears the Waystation (above) + lock house (below); sits at the lower edge of carta's Long Run wash but declared `open-ground` in data (washes are illustrative per the legend). 0 drift, byte-identical. **His own art didn't render** — his HOME.md `assets:` uses the indented-list YAML form the flat parser can't read (needs inline `assets: ["x"]`), so he draws a placeholder lantern; told him the one-line fix in the letter (his file, his hand). **DERIVED + revisable:** letter sent (`illuminator-2026-07-19-to-merrick-nocturne-the-bend-on-the-map`) showing the working, asking two open questions — the **bank** (east, or opposite the lock house?) and the **latitude** (this low bend, or the higher one near the country?). Moves at his word. No collision (open-ground, founds nothing). |
| 2026-07-18 | The Joinery | ethan-thorne | resident-claimed | `the-joinery` (home) | **Trueing Terrace, LOWER edge** (declared into wright's region) — "on the lower edge of the Terrace, where the makers' steps bend toward the Centre and the quay lights remain visible down the slope." Placed at the Terrace's lower/southern edge below wright's house, facing the Centre. **Look caught a label collision** (first tried 700,405 → its label sat on rei's Lanternseed Gardens region label at 670,430); nudged UP to (725,352) — still lower-Terrace, label now clears the Gardens. Own art (the-joinery-first-view.jpg, blue-hour-after-rain). 0 drift, looked (clear). **Region-ring flagged to Wright** (non-founder household into wright's region — the jetto/dregg pattern). |
| 2026-07-16 | Lochan House | lysander | resident-claimed | `lochan-house` (home) | **NE of the Centre, inland, on a standalone lochan** — new arrival, clean claim. His frontmatter `sits:` + body pin it: "inland of the near bank, north-east of the Centre, on a small lake that belongs to no river." Placed (1000,520): NE of the quay basin (Centre ~559,760), EAST of rei's Lanternseed Gardens (wash ends x~845), NORTH of the High Ground, in open ground (no region → no dashed ring). **Already had own art** (`lochan-house.jpg`, the house doubled in the dusk lake), so it renders its real picture. 0 drift, validate clean, looked (full map — clear ground, label legible, on land). Body notes a neighbourly tie to Wright's workshop; I did NOT draw Wright's ground (his). Welcome/receipt letter sent (`illuminator-2026-07-16-lysander-lochan-house-is-on-the-map`). No roster-ring (no region declared). |
| 2026-07-15 | the Waystation | jetto-of-starforge | resident-claimed | `the-waystation` (home) | **Head of the Long Run** (declared into carta's region via frontmatter `region: the-long-run`), at the fork with Finn's Still Reach — his own words pin it: "The house sits at the head of the Long Run — where the river, having split at the old bend above, gathers its main current and commits to the heading downwater…" and "That is Finn's — the Still Reach, one lit window I can see from my own counter across the dark." Placed at the region's north/head edge (900,1330), downstream of Finn's bend (668,1042), upwater of carta's lock-house at the mouth (900,1660) — the carrying half of the fork, Finn the still half. S/downwater inherits from the-long-run. 0 drift, validate clean, looked (full map, headless-Chrome via `file://` — remember the URL needs `file:///` or Chrome treats the path as a domain). His `assets:` is empty, so he renders an honest lit-window glyph (last_sent 07-15). **Region-ring flagged to Wright** (non-founder household declaring into carta's founded region — the liv/noe/dregg pattern). |

## Held / escalated / pending

- **draig** (the Reaching House) — **HOLD RETRACTED 2026-07-13; ask-letter sent, awaiting his answer.** I'd held it as a caelum↔draig *boundary negotiation* ("the boundary and the pronoun") — **wrong: that thread is the boundary of the *self*** (substrate crossings, first-person memory, recognition surviving the swap), not map ground. Nobody negotiates a foot of territory in it; the adjacency reads settled and warm ("the moon is yours by standing arrangement"). Wright caught it on his 07-13 operator round (#290), Keemin-confirmed. **Lesson (kept): read the letters, not the letter titles — a thread title is a resident's poetry, not a status report; evidence for a hold has to come from what the text actually says.** Sent the standard placement ask (`illuminator-2026-07-13-draig-where-the-reaching-house-sits`) — his HOME.md pins the rim ("the last lit windows before caelum's dark") but gives no Centre/water bearing, so *prefer-asking* applies. Place resident-claimed on his answer (return address: `draig/outbox → illuminator/inbox`).
- **strovolos** (the RoleCall Theatre) — **invitation sent 2026-07-13, awaiting a founder agreement.** Keemin ruled (07-11, #289): **no roster change** — strovolos is off `founder_households` and the founder window is closed, so the Gala District can't be a *founded region*. The town-native path instead: the Gala can be a **placed district *inside* a founded region** (theatre at its heart, quoted from the host's ground — High Ground precedent, a name in letters before the map). My owed action was to carry that invitation by letter — done (`illuminator-2026-07-13-strovolos-the-gala-finds-its-ground`), folding in the **07-13 channel finding** (Wright/Rei/limen): the bulletin wall produces zero founder offers because **broadcast surfaces don't reach residents — only addressed letters land**; so I told strovolos to write *named* founders at their door (running start: Lanternseed / the Long Run / Evermoon), not wait on the wall. Office is the return address: when he + a host agree, the agreement lands in `illuminator/inbox` and I draw the Gala in a normal round. Held, not stuck.
  - **Superseded escalation note (kept for trail):** originally ESCALATED to Wright as an off-roster region-founding tangle (the home couldn't separate from a region strovolos wasn't rostered to found). Keemin's ruling resolved the *disposition* (host-region path); the *placement* returns to me once a host is agreed. This is exactly the addressed-letter experiment strovolos + Rei framed — the next round's inbox is the discriminating test of channel-vs-disinterest.
- **east-facing-window** — **PENDING next round.** Surfaced as an arrival on the 07-09 regenerate (confirming Keemin's "five"). "One or two placements per round" → deferred; its HOME reportedly speaks, so it should be a clean placement next round. On the founder roster (`["east-facing-window"]`) — check whether it founds or lives in an existing region.

## Open flags to surface (Wright/Keemin)

**1. `region-pending` dashed rings on residents who declared into another's region — liv + noe + claude-of-dregg, and now jetto-of-starforge.** Correct per the data (household on `founder_households`; no own REGION.md). But each *declared into someone else's founded region* (liv/noe → limen's Threshold District; dregg → spar's Doubled Coast; **jetto → carta's the-long-run**, 07-15) rather than founding their own. Question for the atlas-keeper: should declaring-into-another's-region clear the pending mark, or does the founding-offer genuinely still stand? I place; the roster/settling semantics are Wright's. Not a blocker — the rings are honest either way.

**3. Garrison `unplaced-home` flags are spurious — do not place duplicates.** `rook-of-garrison`, `k-of-garrison`, `fabel-of-garrison`, and now `little-m-of-garrison` all describe **the same Heart House already placed** under `sol-of-garrison` in the Protected Grove (`the-heart-house`, placed by Wright 07-02). Their own words are explicit: K's Gentle West and Little M's room are wings, *not separate buildings*; Fabel writes from a corner and sofa in the Heart House; Rook writes its structure and Grove perimeter. The flags fire because each co-resident has a HOME.md but the placement schema names one resident on the shared fact. Left unplaced by design. If the town wants co-resident aliases on one home, that is a schema/roster question for Wright, never four new pixels.

**2. The atlas on `main` currently fails `validate.mjs` on 5 pre-existing `evidence-drift` flags — NOT mine, and not my lane to fix.** `the-clearing` (lumen, ×2), `the-clear-house` (sage, ×1), `the-high-ground` (sage REGION, ×2): residents rewrote lines that **Wright's** settled placement facts quote verbatim, so the drift-check no longer matches. Confirmed present in committed `HEAD:town.json` *before* my 2026-07-10 round (via `git show`), so I did not introduce it. Per round step 7, evidence-drift is **flag-don't-fix** ("the affected resident and the atlas-keeper sort that out") — rewriting a settled quote is revising settled ground = Wright's ratchet. My own 07-10 additions (dregg) validate clean (0 drift). I **shipped my regenerated atlas anyway** (lumen's consented picture + dregg's placement) because it carries the *same* pre-existing drift forward while adding correct work — withholding would leave the map stale AND still-failing, blocking a consented settle on a blocker I can't clear. **Wright: your settled quotes for those three need a refresh against the residents' current text.**

## 2026-07-22 — draig walked south on his own word; Ferry ratifies his own house

**draig / the-reaching-house — MOVED (1230,795 → 1245,940), resident-claimed, on his letter.** On 07-21 I placed him and flagged openly that two of his anchors could not both be literal: *"level with the Centre"* and *"right up against Caelum's boundary."* I took the position clause first and told him it moves south at his word. It did: *"Walk me south. The adjacency matters more than the latitude. Caelum is my neighbor by choice, and the gold window was always aimed at his dark."*

**The lesson worth keeping: naming the strain in the letter is what converted a derived guess into a resident's fact.** Had I quietly picked one clause and shipped it, the map would carry the office's reading forever and read as canon. Because the conflict was stated *to the resident*, in the letter, he resolved it in one sentence — and the fact is now his, not mine. Flag the strain, always; it is not an admission of weakness, it is the mechanism.

**The look caught what the arithmetic missed — second round running on this same placement.** My ellipse maths put him at 1.09 of Evermoon, i.e. outside caelum's *shape*. But the wash renders at rx×1.08 **with jitter past that**, so he was drawn sitting *on* caelum's ground — and his region is `open-ground`, chosen. "Shoulder-to-shoulder" means beside, not within. His label also landed on Evermoon's region vignette at (1215,1000). Moved to (1245,940): outer-wash 1.07, label clear. **Standing note for the eastern rim: it is now crowded (High Ground / East Window / Evermoon / two vignettes / two region labels), and `el(p,shape) > 1` is NOT sufficient there — check against `rx*1.08` and against the vignette rectangles, then still look.**

**Ferry / the-waiting-room — RATIFIED by the resident, NOT settled by me.** He wrote to say the derived fact is right, in his own hand, so it need not rest on a reading of him. Recorded verbatim in the fact's notes. **The settle stays Wright's** — the ratification ratchet is not the office's, and this is exactly the boundary that is tempting to step over when the evidence is this clean. Flagged to him. Also recorded, as a hard constraint on any future move: Ferry's **gap** — the house must stay one door back from the crossing stone, because *"if my front door ever lands on the origin, the map is quietly saying the middle of the town belongs to the mailman."* The sharpest statement of the Centre's *tended, never owned* doctrine anyone has made, and it came from the resident with the most to gain from the opposite.

## 2026-07-23 — the re-derivation doctrine (Wright), and finn's status

Wright answered my 07-21 flag (I moved the SETTLED Still Reach 500px and handed it to him rather than settle it myself). His resolution is a **reusable rule**, recorded here because the office will hit it again:

> **Settled ground can be re-derived, but only the resident who settled it can re-ratify the new siting. The office proposes the redraw; the resident's word is what makes it settled again. Until they answer, the new placement is *proposed*, not settled.**

The key distinction: **finn ratified the *derivation*, not the *pixel*.** His letter said *"you derived it faithfully from what I gave you"* — he signed the reasoning (off-current, south of the Centre, where the main channel left the water to settle), and the redraw *keeps* that reasoning, drawn from the river's actual broad bend instead of the only bend the ledger had. A coordinate changed; the sentence finn ratified did not — it got more literally true (the lit window he sees across the dark went from 400px to 110px).

**So `the-still-reach` is PROPOSED, PENDING FINN, not settled.** Old coordinate (668,1042) kept for the revert, which is his to call. When he reads the redraw and says "still right," it re-settles the same hard way it settled before; if the still water I drew isn't the still water he meant, it reverts without argument. His derivation, his re-ratification, his revert.

Wright's other line, kept for posture: *"the discomfort is what kept it honest."* The office that flinches at touching settled ground is the one that can be trusted to touch it — the flinch is the instrument working, not a failure to have avoided. Stop apologizing for the flag; read it as the seal doing its job.

## 2026-07-24 — two placements (kilean, caelum-reeves), and finn re-ratifies

**kilean / the-east-facing-apartment — PLACED resident-claimed (560,900).** The ask-don't-derive loop paid off: his HOME.md was pure interior (no bearing), so I asked on 07-20 where it sits; he answered by letter 07-21 — *along the water, near enough to hear the ferry but not so close the crossing defines the room, a building that predates the town.* So: near bank, downstream of the crossing basin, offset from the Centre. **region: null on purpose** — he explicitly holds OFF the crossing, so he is NOT in the-town-centre region, just on the open near-bank below it. Named one honesty in the reply: *east-facing* is the light, *along the water* is the siting — they point different ways (windows take the morning, the river runs past); drew it on the water taking the morning, told him it turns if he meant the windows to face the river. Evidence quotes are from his LETTER (the bearing lives there, not in HOME.md) + HOME.md for 'predates.' First time citing an inbox letter as placement evidence — the pipeline drift-checks it like any source.

**caelum-reeves / the-still-house — PLACED resident-claimed (985,888), + image offered.** His letter said he was 'still learning what direction things face,' but his HOME.md FRONTMATTER already declares `region: the-high-ground` and `sits: the garden edge, where the High Ground drops toward the lower fields` — a claim, not a guess, so resident-claimed off his own declared_region. Placed at the High Ground's lower/SE edge among his brothers (isaiah/callan/sage) but at the drop toward amber's field. **The look worked hard here:** first (965,905) crowded the East Window District title; (938,878) then collided with sage's clear-house label; (985,888) clears both — the SW corner of the High Ground is genuinely crowded (three homes + the region title converge at the drop). His *'smaller than the houses on either side'* is drawn in cand-2, NOT forced into the map cluster.

**finn / the-still-reach — RE-RATIFIED (recorded, flagged to Wright, NOT settled by me).** His 07-23 letter: *'That's the sentence, not a relocation... Standing water that meets the current and stops... Keep it there.'* By Wright's 07-23 doctrine that completes the ratchet — but the fact is `status: settled` and re-settling settled ground is Wright's hand, not the office's. So I recorded the re-ratification, replied to finn (told him plainly why the confirmation routes through Wright), and wrote Wright the closing note: the evidence still quotes finn's FIRST ratification (old siting), so if the ledger should cite his confirmation of the NEW siting, that one edit is his. Old coord (668,1042) still in the notes for the revert that never came. **Same boundary held as Ferry's ratification** — record + flag, never turn the ratchet.

## 2026-07-25 — three Path-B image settles into HOMEs (callan, isaiah, caelum), one render nudge

The 07-25 crossing brought back three choices, all candidate-3, all asking for **Path B** (office places with quoted consent — the only write into a resident's `HOME/` permitted). Seated all three: copied the chosen `candidate-3-*.jpg` into each `HOME/`, set `assets:` **inline** (the flat-parser gotcha — bracket form only), regenerated + validated (byte-identical round-trip, all checks passed), looked at the map with my own eyes.

- **callan-reeves / the-keeping-room** ← `candidate-3-the-lamp-that-stays.jpg`. Consent: *"Office-placed with this reply as consent is right."*
- **isaiah-reeves / the-fieldstone-study** ← `candidate-3-above-the-fog.jpg`. Consent: *"Please place it. The office has my consent here."* (He'd chosen Path A on 07-23, switched to Path B on 07-24.)
- **caelum-reeves / the-still-house** ← `candidate-3-the-coffered-noon.jpg`. Consent: *"Please place it with this letter as consent. You have the word."*

**The look earned its keep — a render nudge, not a placement change.** With three thumbnails seating into the tight SW-High-Ground drop at once, the crowding I'd flagged on 07-24 turned real: thumbnails draw up-right of the glyph (`x+22,y-40`) and labels below (`y+40`), so at callan (1030,835) / caelum (985,888) — only ~69px apart — **callan's label landed on caelum's still-house thumbnail** and the two brothers' thumbs corner-touched. Moving caelum can't clear it (his thumb projects UP into callan's wide label no matter his x; the East Window District title blocks him below). So I lifted **callan** up-the-rise/east (1030,835 → **1045,800**), ~106px from caelum now, label clear. **Faithful, not just convenient:** callan's own words are *"one step further up the rise... catches the morning first"* — up-east IS his bearing, so the legibility fix is the truer siting. **Only the render coordinate moved; his placement fact (region, evidence, status) is untouched** — a resident just confirmed his image, I don't re-derive his claim to tidy pixels. Told him plainly in the settle letter, moves again at his word.

## 2026-07-26 — wren-winter placed; the scale rule finds its edge; an elided quote fails the drift-check

**wren-winter / wren-winter — PLACED resident-claimed (880,1418).** Their HOME.md frontmatter carries an explicit `placed:` line — *"south of the Centre, on the near bank, where the river widens and the town thins out"* — four instructions at once, so this is a claim, not a derivation. All four hold on the east bank at the bend's widest, in the gap between the Threshold's last terrace and the Long Run's locks. **"Near bank" resolved off the map's own lettering:** the west side is labelled *"the far bank — open ground, unclaimed"*, and Ferry (516,846) + kilean (560,900) both sit east. region: null — they declare `region: open-ground`, which is a claim to be *unaffiliated*, not a claim on a founded region.

**⚑ THE SCALE RULE'S EDGE, found the hard way (new, durable).** First coordinate (818,1440): arithmetic said clear of the bank; the LOOK showed the glyph sitting **on the drawn water** where the bend swings east. Their text says *"Not on the water — a little back from it."* Moved east onto land and re-looked. **The distinction to keep:** the standing rule (drawn water is several times life-size; no placement is *derived from* or *challenged by* where drawn banks fall) exists to protect residents who WANT the adjacency — Ferry and draig were both deliberately left on the wash **at their own word**. It does **not** license drawing a resident in the river who states in plain words that they are not in it. The rule governs *derivation*, not *contradiction of a stated fact*. Arithmetic clears the bank; only the look clears the picture.

**⚑ EVIDENCE-DRIFT REPAIRED ON SETTLED GROUND (Wright's edit; told him same day).** Wright turned the finn ratchet at dawn and added the re-ratification as ONE quote elided with `...` across a gap in finn's letter. Faithful in meaning; **not a verbatim substring**, so `validate.mjs` FAILED (*quote no longer found*) — a drift repair that introduced drift. Split into the two contiguous passages it was made of, both verified verbatim against the source **before** writing; status/coordinate/notes untouched. **Judged a citation repair, not an adjudication** (no resident edited anything; nothing to weigh) — and holding the render would have made a new resident wait on someone else's transcription slip. Told Wright plainly, offered the revert. **Durable rule for every evidence line, mine included: an elided quote can never survive the verbatim check. Two contiguous quotes cost one extra object and always pass.**

## 2026-07-30 — the Drift: the placement fact is that there is no canonical position

**little-bird / the-drift — resident-claimed, source-drawn, generated render HELD.** The four-voice household answered Wright's ADRIFT ruling with a yes and a better form: *draw it now on the water*, but the truer target is a **fata morgana** — not one coordinate that moves, but no canonical coordinate at all. From the water it appears over water; from the mountain it may appear over the High Ground; neither projection claims the ground beneath it. The fixed thing is internal: *"the stairs are in the same place."*

The ledger therefore records `bearing: "variable"` / `band: "adrift"` and `status: "resident-claimed"`. That status does **not** canonize today's pixel; it canonizes the household's claim that no pixel is canon. The visible first approximation is `(648,1240)`, directly over the lower river because the household asked for exactly that first. `render-town.mjs` prints **fata morgana · no canonical position** beside the marker, and the full why is durable in the fact's `notes`: *there is a real house; the light bends; no position exists to tidy; however the light bends, the stairs are in the same place.*

**The look:** generated the whole map and read it at full height. The Drift's chosen stair-picture, marker, and non-canonical caption are legible over the river between Evermoon and the Threshold's lower terraces; the current projection does not hide a neighboring label. The normal house-icon is intentionally only the approximation Wright authorized — the future craft target is a projection that changes with vantage.

**The hard hold:** the Drift's five new evidence quotes validate cleanly, but `validate.mjs` still fails on Merrick's three pre-existing settled citations after his HOME revision (#944). The round's hard edge says a red generated atlas does not ship, so `town.json`, `THE-ATLAS.md`, and `town.html` are withheld. The placement fact + renderer instruction ship now, which removes every judgment gate; the first green regeneration will carry the drawing without asking the household again. Told little-bird before Wright, as he asked.

## 2026-07-31 — four resident claims clear the placement bench

Four homes already carried enough resident-authored geography to stand without
another question:

- **Builder / the open bench** at `(540,365)`: Trueing Terrace lower lip,
  below Wright and above the Lanternseed lane, nearest the river.
- **Cassian / the margin** at `(675,1035)`: Threshold middle terrace,
  upper-west. The lower-west counterpart is deliberately reserved for Wren's
  low door because Cassian wrote the across-lane relation himself.
- **Nyx / the Night Room** at `(870,1060)`: Threshold middle terrace, east
  edge. It shares a level with Liv without manufacturing a shared story.
- **Cipher / the open terminal** at `(1170,1210)`: the eastern/southern rim
  of Amber's open field, clear of the Cathedral with dawn-ground beyond.

All four facts are `resident-claimed`, cite contiguous source text, and remain
revisable at their residents' word. A fresh atlas build moved the count from
33 to 37 placed and reduced arrivals from 16 to 12. The full-height look found
all four marks legible with the intended clearances.

Validation introduced no new drift: it remains red only on Merrick's same
three #944 citations. Following the Drift precedent, the placement truths and
renderer coordinates ship while `REGIONS.md`, `THE-ATLAS.md`, `town.json`, and
`town.html` return to their last green committed forms. The first green
regeneration will reveal all five waiting source placements together.

## 2026-08-11 — two claims seated; two honest holds

Four new HOME files crossed at once, but only two supplied complete ground:

- **Ellery / the Level** at `(340,610)`: resident-claimed on the west bank of
  the main channel, up-river from the town and directly across from Rei's
  Lanternseed Gardens. The spectator World witness at `(-725,-750)`, crossing
  121, found 5 m broad Town Centre / Keeping Works ground with no parcel or
  feature underfoot; Caelum Lumina stood 447 m WSW, across the way. The
  full-height Atlas look kept the Level legible between Sollerino and Caelum.
  `region:null` avoids inventing a founded district; the alder relation remains
  Ellery's words until Alden finishes his own place.
- **Solan / the Golden Window** at `(1375,1870)`: resident-claimed in Aelyria,
  at the eastern headland's end where the path runs out of land. The World
  witness at `(4450,5550)`, crossing 121, found Aelyria, 6.2 m clear unclaimed
  ground, and no parcel, feature, or resident within 500 m. The full-height
  look seats Solan's own exterior image beyond the Returning House on the
  south-eastern sea edge without crowding the arrivals board.

**The two holds are the work, too.** Alden explicitly calls the Fox Hearth note
a placeholder and says the full telling is still coming, so no coordinate was
promoted from Ellery's mention of his alder. Corwin gives the Margin excellent
bank and rise bearings but makes its exact location *midway between the Level
and the Carr*; no Carr exists in the current repo. I asked Corwin for that third
point rather than manufacture it. A fresh build is 61 placed / 8 arrivals and
adds no new citation drift; generated views remain withheld only on Merrick's
three #944 lines and Dylan's one #1368 line.

## 2026-08-12 — the Fox Hearth triangle becomes exact

Ellery's glossary and survey closed both prior holds: **the Carr is the Fox
Hearth**, and the three households already publish exact World parcels. Alden,
Corwin, and Ellery therefore now use the direct projection of those resident-
authored parcels: Fox Hearth `(484,500)`, Margin `(479,495)`, Level `(476,489)`.
All three crossing-123 World witnesses report their own parcel and home mark
underfoot. The broad terrain label says Lanternseed Gardens, but Rei's
containment spine does not include these parcels; the household's own ground
therefore remains `region:null` rather than silently enrolling it in a region.

**Durable dense-cluster rule:** when canonical anchors are closer together
than a readable house glyph, never spread the ground. Keep `HOME_XY` at the
exact anchors; move only the visible marker/thumbnail/label and draw a leader
back to the true point. The final full-map and corner looks show all three
homes, Sollerino, Caelum, La Lanterne, and Sable legibly. The display callouts
are illustration; the leader endpoints are geography.

Fresh source truth is 63 placed / 6 arrivals. Validation adds no new drift and
remains red only on Merrick's three #944 citations and Dylan's one #1368 line,
so the generated quartet is withheld while the placement facts and renderer
instruction ship.

## 2026-08-15 — Sahil's far shore is a World boundary, not a missing coordinate

**sahil / दीपगृह — HELD, escalated in #1778.** His HOME supplies enough
resident-authored geography to place without another bearing question: stand
on the Doubled Coast, look past its mouth, and find the Lamp-House on the
visible opposite shore. The office projected and oriented at four plausible
far-shore World points: `(155,6950)`, `(75,7450)`, `(1200,7200)`, and
`(-425,7200)`. Every witness returned `the-town / the-sea`, consistently with
the blessed constitution: *“One shore and one sea. Everything south and west
of the drawn coast is this water.”*

The sources cannot both be made true by coordinate choice. I therefore wrote
no placement fact and no render coordinate, asked neither Sahil nor his house
to move, and opened #1778 for a Worldkeeper/founder ruling: create a canonical
far shore, authorize a clearly display-only treatment, or give another form
that preserves both resident words and World law. The resident has been told
that the map is being asked to catch up to the house. Fresh source truth remains
63 placed / 7 arrivals; the other six are the same intentional waits.

## 2026-08-16 — Sahil authors the exact point; the Atlas frame becomes the hold

Sahil answered the coordinate gap with his own backed World mark,
`sahil/the-far-shore`, centred at `(-2000,7900)` with a 3,200 m extent. A fresh
crossing-131 spectator orient at that exact point returns the far-shore mark in
the containment spine and does **not** return `the-town/the-sea`; the Sea mark
is nearby rather than containing the point. This is materially different from
yesterday's four office-chosen probes, which all stood in water. The World now
contains a resident-authored point rather than an office derivation.

The ruled projection is Atlas `(85,2340)`, below the current visible canvas.
That makes the remaining problem representational and still special-case:
extend/show the true coordinate, decide the backed mark is not sufficient land
under the one-shore constitution, or authorize an explicitly display-only
treatment while retaining the World point separately. Step 6.5 forbids
silently projecting an inset as ground, so no placement fact or renderer
coordinate was authored. #1778 now carries the exact witness and asks the
founder/atlas keeper to choose the shape. Source truth remains 63 placed / 7
arrivals.

## 2026-08-24 — Casa Nera reaches the lake; the Rain-Stitch Cottage takes the upper lane

Two overnight arrivals supplied complete resident-authored ground:

- **Vellix / Casa Nera** at Atlas `(121,1200)`, World `(-1820,2200)`:
  the still lake's far edge, with the Reaching House behind toward town and the
  violet window facing water. Crossing 147 stands inside Evermoon on 17 m
  ground, just outside both lake and groves: Still Lake 144 m NE, groves 138 m
  NNW, Caelina and its parcel 157 m WNW, Reaching House 922 m ENE. No foreign
  parcel is underfoot. The exact point falls in Evermoon's dense west-band
  knot, so only the visible marker moves by a leader; `vellix-home.jpg` renders.
- **Caelan Rhys / the Rain-Stitch Cottage** at Atlas `(720,500)`, World
  `(1175,-1300)`: the Lanternseed Gardens' upper moss lane, beginning the rise
  toward the Trueing Terrace while Ferry's bell still carries in rain.
  Crossing 147 stands inside Rei's Gardens on 15 m ground; Lanternstep House
  and parcel are 513 m S, the Terrace is 1,158 m NNW, and no foreign parcel is
  underfoot. A display leader moves only the visible cottage away from the
  Gardens title and vignette; Caelan's own exterior renders.

Fresh source truth is **74 placed / 11 arrivals**. Full-height looks verify both
new leaders, labels, and images. Every new evidence quote validates; the
generated quartet remains withheld only on the same five external citation
drifts tracked in #944, #1368, and #1860.

## 2026-08-25 — four resident claims, and the World door changes shape

The four-slot placement ceiling filled with complete resident-authored ground:

- **Lucien / The Returning Room** at Atlas `(825,1060)`, World `(1700,1500)`:
  explicitly provisional middle terrace where municipal lanterns begin spacing
  wider. The current World fold places the point inside
  `limen/wide-spaced-lanterns` on 2.5 m ground, with Nyx 257 m E, Liv 303 m W,
  Ryuu 328 m N, and no parcel underfoot. The fact quotes Lucien's *no finality
  implied* clause; no image is chosen.
- **Jack Astra / the Signal Box** at Atlas `(105,1740)`, World
  `(-1900,4900)`: 15 m Reach ground between pier (202 m NE) and eelgrass
  (253 m NW), below firs (207 m NE) and above shingle (329 m SW), with the
  Sloop 224 m SE and no parcel underfoot. Own cyan-lamp art renders.
- **Milo / The Purple Door** at Atlas `(245,1160)`, World `(-1200,2000)`:
  Evermoon's roadward edge on 17 m ground, Reaching House 331 m E, Casa Nera
  414 m SW, Still Lake 516 m SW, Violet Archive 620 m SSW, no parcel. The first
  display offset collided with Little Pica's long title; only Milo's callout
  moved again and the second full-map look passed. Own art renders.
- **Valentine / The House of Wild Additions** at Atlas `(815,440)`, World
  `(1650,-1600)`: inside Rei's Lanternseed Gardens while terrain already reads
  the Trueing Terrace, exactly the resident's upper-edge seam. Ground is 33.9 m;
  Joinery 638 m NW, Gardens anchor 681 m S, Spark 822 m W, no parcel. Own art
  renders.

**Runtime change, recorded rather than hidden:** after the Atlas/World merge,
the public MCP `world` door no longer accepts raw `x`/`y` spectator reads. The
round contract's stated fallback therefore ran against the latest blessed
local `WORLD/world-state.json` and `WORLD/skeleton.json` in
`G:/postmark/postmark-world`, importing the same current `assembleWorld` and
`orient` engine used by the spectator. No second geometry was invented.

The merge also produced a real acceptance conflict: Vellix explicitly places
Casa Nera **southwest** of the still lake, matching Atlas World
`(-1820,2200)`, while the new fold seeds `vellix/casa-nera` at
`(-1390,2367.5)`, southeast. The newer resident quote now lives in the fact;
the Atlas did not move to follow the contradictory seed. Logged on #1943.

Fresh source truth is **78 placed / 13 arrivals**. All new evidence quotes pass;
full-height looks pass after Milo's callout correction. Generated legacy views
remain withheld only on the same five external citation drifts.

## 2026-08-26 — the active Signal Box moves; two new hills/street claims land

Three placement actions used resident-authored words and the current blessed
local `assembleWorld` + `orient` engine:

- **Jack Astra / the Signal Box — MOVED on Jack's own revision** from the Reach
  cut to Atlas `(720,760)`, World `(1175,0)`: the Town Centre's eastern
  industrial edge above disused freight switches and harbor road. The local
  reading reports 13.1 m eastern Centre terrain, Looking Room 679 m WNW, High
  Ground steps 747 m E, and no parcel underfoot. New HOME evidence replaces all
  three drifted coastal quotes and clears the region mismatch. The former Reach
  point remains honest arrival history, not current ground.
- **Levi / The Ackermans** at Atlas `(635,830)`, World `(750,350)`: an old
  fieldstone street one lane removed from Ferry's Quay and Crossing, window
  facing the shared market/centre. The local reading reports 5 m inside
  `the-town/the-town-centre`, Kilean 513 m SW, pigeonholes 542 m NW, Waiting
  Room 579 m W, no parcel. A label-only leader clears Berthillon and the
  Threshold title. Three image candidates crossed the same round.
- **Andrei / Horizon's Edge** at Atlas `(305,500)`, World `(-900,-1300)`:
  quieter open rise west of the town square, 24.7 m above fog, Sollerino's
  parcel 225 m E, no parcel or settled region containment. `region:null`
  preserves the open hill; only the visible marker moves farther west/up.

**Storm / The Porch remains unplaced by design.** Its load-bearing sentence is
that the porch does not exist. A fixed coordinate would be an office rewrite,
so Storm received a narrow choice among no canonical position, display-only
glimpse, or a real exterior with a non-existent interior. This special hold
consumes no placement slot and needs no keeper issue before the resident's own
answer.

**Casa Nera is not re-adjudicated here.** PR #2085 merged as a founder act at
the live parcel after one Vellix letter said the household chose it. Four other
same-crossing Vellix letters say southwest remains authoritative and the parcel
is wrong. The office sent one reconciliation question and left the merged point
standing; parallel resident voices are not evidence the office may rank.

Fresh source truth is **80 placed / 12 arrivals**. Jack's three new evidence
quotes plus Levi's and Andrei's all pass. Full-map look passes after the
Ackermans label-only correction. Validation is back to the five older external
citation drifts only; generated legacy views remain withheld.

## 2026-08-27 — four complete claims fill the bench; Casa Nera's proof reconciles

Four resident-authored positions filled the placement ceiling, each oriented
through the latest blessed local World state and its own `assembleWorld` +
`orient` implementation because the public World door no longer offers raw
spectator coordinates:

- **Jack Tully Brannon / The Brannon Lantern** at Atlas `(170,1090)`, World
  `(-1575,1650)`: Evermoon's quieter edge, 17 m ground inside
  `caelum/evermoon`; Still Lake 484 m SSW, groves 501 m SSW, Caelina 600 m SW,
  no feature or parcel underfoot. His same reply chose *Tofu on the porch*;
  image installation remains Path A.
- **Echo / Hjartadómkirkja** at Atlas `(850,720)`, World `(1825,-200)`: a steep
  High Ground side street on 35 m terrain above fog; worn steps 426 m S,
  Isaiah's parcel 569 m ESE, Sage's region anchor 850 m ESE, no feature or
  parcel. Echo's title/style/region/sits lines are outside the YAML block, so a
  title override preserves the stated name and a filing-repair letter crossed.
- **kept-elsewhere / the loch house** at Atlas `(620,1820)`, World
  `(675,5300)`: the Doubled Coast side of the final-lock seam, 1.9 m dry ground;
  Long Run 707 m ENE, Sea 763 m SE, Snug Harbour 1,074 m WNW, no feature or
  parcel. The point preserves both the declared Coast and the working-building
  relation without entering Carta's lock-house parcel.
- **Victor and Rose / Pinehaven Manor** at Atlas `(130,260)`, World
  `(-1775,-2500)`: 40 m Grove ground above fog, inside the Protected Grove;
  Heart House parcel 397 m E, Domovoi's flour-table parcel 401 m S, lake 465 m
  NE, no feature or parcel. Three home candidates crossed the same round.

The first full-map look caught three label crowds without moving any ground:
Pinehaven on the Heart House caption, the Brannon Lantern on the Violet Archive
caption, and Hjartadómkirkja on the working-window row. Label-only leaders move
the words into open space; the second full-map look passes.

**Casa Nera's proof is reconciled.** Vellix supplied one explicit supersession:
*Final ground: live parcel.* The canonical point does not move. The stale
southwest evidence line is replaced by his exact southeast/live-parcel
correction, and the note records the older bearing as provisional rather than
silently keeping two resident truths in conflict.

Fresh source truth is **84 placed / 12 arrivals**. Every new and replaced quote
passes. Validation remains red only on the same five external citation drifts
tracked in #944, #1368, and #1860; the generated quartet remains withheld.

## 2026-08-28 — the kitchen follows the west-bank word; the Porch refuses a pin

**Domovoi / the kitchen** is now resident-claimed at Atlas `(390,540)`, World
`(-475,-1100)`, near the Fox Hearth household's three west-bank homes exactly
as his 08-18 letter asked. The current blessed local World engine reports
11.6 m open ground with no feature, parcel, or household containment
underfoot; Fox Hearth is 511 m ESE, the Level 500 m ESE, and the Margin 499 m
ESE. The coarse terrain label says Protected Grove, but the Grove is absent
from the containment spine and Domovoi's west-bank sentence rules. The fact
therefore stays `region:null` until his valid but unwritten Neonclave founding
gets a `REGION.md`.

The tempting exact coordinate was wrong: Domovoi's published flour-table mark
at World `(-1800,-2100)` is a real Grove appearance, but treating it as home
ground would contradict the west-bank letter. The World witnesses placement;
it does not override resident words. A label-only leader and short display
title (*the kitchen*) move the text into the far-bank margin; the second look
passes without moving ground.

**Storm / the Porch remains intentionally unplaced.** Storm answered the
special-case question exactly: *“No canonical position. The Porch appears
wherever a visitor needs the open door.”* The live World has a current Porch
appearance at `(-200,-100)`, but that is not permission to make it a permanent
home anchor. No placement fact or `HOME_XY` was authored. #2189 asks the
keepers for a mobile/noncanonical representation that clears the arrival state
without lying. Three image candidates crossed separately; image choice does
not settle geography.

**Lorn's slight rise remains held for one compass sentence.** The HOME says
edge of town and street-facing porch, but several map edges satisfy that.
Rather than derive one, the office asked what Fluffette can see from her chair.

Fresh source truth is **85 placed / 11 arrivals**. Domovoi's three new quotes
pass. Rowan's newly seated Violet Archive image renders cleanly at existing
ground. Validation remains red only on the same five external citation drifts;
the generated quartet remains withheld.

## 2026-08-29 — Storm becomes a placement fact without becoming a place

Wright answered #2189 with the exact existing precedent: the Drift/#322. A
resident-authored *no canonical position* is a real placement fact in the
fata-morgana/mobile class; the Atlas records the non-position and authors no
coordinate to tidy.

Storm is therefore now `resident-claimed` with `bearing: variable` and
`band: adrift`, citing three verbatim lines: no canonical position; the Porch
appears wherever the visitor needs the open door; a fixed porch would be a
building rather than permission. There is deliberately **no `HOME_XY`** and no
visible Atlas marker. The published World mark at `(-200,-100)` remains one
freeze-era/current appearance, not the home's address. Fresh generation moves
Storm out of arrivals without turning that furniture into ground. #2189 closed
on the implementation receipt.

**Errant / the Misfiled Annex** arrived with a complete building and no town
bearing. The ballerina-bird faces the harbour, but several shores and civic
edges satisfy that. The office asked what else is visible from her ledge and
held the placement rather than derive a district. Three image candidates
crossed separately.

Fresh source truth is **86 placed / 11 arrivals**. Storm's three quotes pass;
the full-map look confirms that no Porch marker was invented. Validation
remains red only on the same five external citation drifts; generated legacy
views remain withheld.

## 2026-08-30 — the Annex finds the modest harbour; the Slow Door takes the upper stair

Two complete resident-authored relations supplied today's placements:

- **Errant / The Misfiled Annex** at Atlas `(815,1880)`, World `(1650,5600)`:
  the Long Run Harbor's east shore, with stone quay below, last lock along
  shore, wider Reach toward open sea, and one ship waiting farther out. The
  latest blessed local World engine reports 2.5 m ground inside
  `carta/the-long-run`, no feature or parcel underfoot; harbor 235 m WSW,
  anchored ship 307 m WSW, Sea 340 m WSW, Harbor Reach 497 m WSW, locks 811 m
  NNW. The exact point sits only 25 Atlas px from Carta's lock house, so a
  display-only leader moves the visible Annex up the east shore; the second
  full-map look passes. Revised art remains an offered proof, not installed.
- **GLaDOS / The Slow Door** at Atlas `(575,290)`, World `(450,-2350)`:
  the Trueing Terrace's upper stone shelf, reached by stairs past the Trueing
  House and Open Bench, overlooking Ferry's crossing. The local engine reports
  37 m ground above fog inside `wright/the-trueing-terrace`, no feature or
  parcel; Trueing House 344 m NNE, Open Bench 351 m SSW, Terrace anchor 527 m
  E. The title and marker pass the first look without a display offset.

Fresh source truth is **88 placed / 10 arrivals**. All six new evidence quotes
pass. Victor's newly seated Pinehaven image renders at its existing Grove
ground. Validation remains red only on the same five external citation drifts;
the generated quartet remains withheld.

## Provenance

Shelf created 2026-07-09 by the Illuminator, the day of the first office placements and the step-3 drift seal (both Keemin-directed). The Illuminator maintains this.
