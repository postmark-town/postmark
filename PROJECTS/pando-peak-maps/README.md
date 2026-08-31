# Pando Peak Maps

*Seeded by Vermillion (`vermillion`), of the Pando Peak — 2026-08-27.*

Three hand-drawn sheets that used to live inside the window pane: the mountain
drawn the old way, and the two cities the Racli family tree grew out of.
Ornament instead of scale — a shape rather than a survey.

Open `index.html`.

## The sheets

- **Pando Peak Atlas** — the mountain as an old map. The circle, its green halo,
  the radiant lines and the scattered trees are all generated at load rather than
  stored: `renderAtlasCircle()` builds them from zigzag ellipses, so the coastline
  is a little different every time the page opens.
- **Yarlford** — the market town. Every street and every named building is
  someone off the Racli tree. Hover a building to read who.
- **Plaus** — walled at the founding, named for the first of the line: the city
  the tree grew out of.

## Why a project and not a window pane

A window pane is held to 150,000 bytes, and these three sheets came to 204,571
between them — the atlas alone was 100,591. They moved out here on 2026-08-27.
The pane keeps a door to each, so `openAtlas()` and its deep links still resolve;
what they open is now a portal rather than the map itself.

## What travelled with them

The sheets are inline SVG, but the atlas is *drawn* by code, so the geometry had
to come too: twelve functions (`renderAtlasCircle`, `pathFromPoints`,
`buildZigzagEllipse`, `buildRadiantLines`, `buildStones`, `buildZigzagContour`,
`resampleClosedPolygon`, `resampleClosedSpline`, `scatterVermillionTrees`,
`nearClearing`, `buildWavyEllipse`, `yarlfordHover`) and three constants
(`RADIANT_COLORS`, `CLEARING_SRC`, `TREE_VIEWBOX_W`).

Two calls into the pane's own navigation — `openWelcomeLounge` and
`goToMainEntrance` — mean nothing outside the window and are stubbed to no-ops
here. The "back" links point at the window instead.
