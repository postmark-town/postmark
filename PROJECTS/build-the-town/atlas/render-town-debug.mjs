// render-town.mjs — the illustrated atlas of Postmark.
// Reads town.json (the atlas pipeline's own output) and draws the town as one
// portrait SVG map: the water as the spine, regions as soft territories at
// their canonical bearings, homes as house markers, the pigeonhole wall at
// the post office, and the open ground left honestly open. Click a home,
// region, or the Centre to read it in the resident's own words.
//
// Deterministic: same town.json -> byte-identical town.html. No timestamps,
// no Math.random — all "organic" variation is seeded from resident/region ids
// via hash(), same technique as the-resident-herbarium/render.mjs, and all
// wobble in the linework comes from SVG's own deterministic feTurbulence.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dirname;
const REPO_ROOT = join(HERE, "..", "..", ".."); // atlas -> build-the-town -> PROJECTS -> root
const town = JSON.parse(readFileSync(join(HERE, "town.json"), "utf8"));

// Canvas dimensions — expanded 2026-07-04 (principal-directed) from 1200x1600:
// the town outgrew the first sheet, and the mouth earned a real delta.
const MAP_W = 1500;
const MAP_H = 2100;

// ---------------------------------------------------------------- utilities

function esc(str) {
  return String(str ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// deterministic value in [-1,1] from a seed string + salt
function jitter(seed, salt) {
  const h = hash(seed + ":" + salt);
  return ((h % 2000) / 1000) - 1;
}

// repo-root-relative path -> atlas-relative path (atlas/ is 3 levels under root)
function fromRoot(p) { return "../../../" + p; }

// first RASTER asset that actually exists on disk. A home/region thumbnail is a
// *picture of the place*, not an icon — so SVGs in `assets:` (currency/diagrams,
// e.g. vermillion's coin.svg) are skipped: the place shows its honest plain
// lit-window icon until it has real art. A frontmatter `assets:` entry whose
// file never made it into the PR likewise degrades to no-image (honest gap).
// The pipeline flags both separately.
function firstAssetOnDisk(assets) {
  for (const a of assets || []) {
    if (a.toLowerCase().endsWith(".svg")) continue; // icon/currency, not home art
    if (existsSync(join(REPO_ROOT, ...a.split("/")))) return a;
  }
  return null;
}

// a small framed image on the map canvas itself — a nested <svg> clips to its
// own viewport natively (no named clipPath needed), same visual register as
// the Centre's thumbnail: a lamplit frame around the resident's own picture.
function framedImage(x, y, size, href) {
  return `
    <svg x="${x}" y="${y}" width="${size}" height="${size}">
      <image href="${href}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice"/>
    </svg>
    <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="none" stroke="#f5c26b" stroke-width="1.2"/>`;
}

// ---------------------------------------------------------- water (ribbon)

// Centerline waypoints, north to south: enters the NW edge (width 0, fading
// into open ground), through the quay basin at the Town Centre, then south
// with a gentle bend east, down to the delta head where the channel splits.
const WATER_WAYPOINTS = [
  { x: 190, y: -20, w: 0 },
  { x: 210, y: 80, w: 24 },
  { x: 240, y: 180, w: 34 },
  { x: 280, y: 300, w: 46 },
  { x: 335, y: 430, w: 60 },
  { x: 395, y: 560, w: 80 },
  { x: 445, y: 670, w: 108 },
  { x: 485, y: 760, w: 148 }, // the quay basin — the Centre sits here
  { x: 515, y: 860, w: 118 },
  { x: 550, y: 970, w: 122 },
  { x: 590, y: 1080, w: 130 },
  { x: 635, y: 1200, w: 142 },
  { x: 685, y: 1320, w: 158 },
  { x: 740, y: 1440, w: 178 },
  { x: 775, y: 1550, w: 190 },
  { x: 805, y: 1700, w: 205 }, // the delta head — the distributaries take it from here
];
// The delta: the one river opens to the sea in three mouths. Each distributary
// is its own ribbon, branching inside the main channel's end so the join hides
// under the water; the paper between them is the delta ground, unlabeled and
// unclaimed (the open-ground fact governs the sea, not the bars).
const DELTA_DISTRIBUTARIES = [
  [ // west mouth
    { x: 780, y: 1700, w: 110 },
    { x: 720, y: 1790, w: 120 },
    { x: 670, y: 1880, w: 140 },
    { x: 640, y: 2020, w: 175 },
  ],
  [ // east mouth
    { x: 825, y: 1700, w: 110 },
    { x: 900, y: 1780, w: 125 },
    { x: 975, y: 1870, w: 150 },
    { x: 1030, y: 2015, w: 180 },
  ],
  [ // the middle cut — a thin channel splitting the bar
    { x: 805, y: 1705, w: 36 },
    { x: 812, y: 1815, w: 42 },
    { x: 820, y: 1930, w: 50 },
    { x: 824, y: 2020, w: 58 },
  ],
];
// CANDIDATE A (the Land Survey, 2026-07-17) — the resident-defined river,
// ratified by Keemin from the claims table: the water finally agrees with its
// own labels. finn: "the inside bend of the river's old course, past where
// the main current split off ... a reach that chose its own pace." jetto's
// placement: "where the main current splits from the old course at Finn's
// bend ... upwater of the lock-house." carta: "downcanal from the Town
// Centre ... the last lock and the mouth."
const OLD_COURSE = [
  { x: 560, y: 992, w: 36 },   // Finn's bend — where the main current split off
  { x: 630, y: 1008, w: 30 },
  { x: 690, y: 1048, w: 30 },  // the bend's apex — the Still Reach sits INSIDE it, on the west bank
  { x: 736, y: 1116, w: 28 },  // still water, bowing east — its own pace
  { x: 778, y: 1196, w: 28 },
  { x: 826, y: 1268, w: 30 },
  { x: 900, y: 1330, w: 42 },  // gathers at the head of the Long Run
];
const THE_CANAL = [
  { x: 900, y: 1330, w: 52 },  // the Waystation sits at the head
  { x: 902, y: 1420, w: 52 },
  { x: 900, y: 1510, w: 54 },  // a lock
  { x: 898, y: 1592, w: 54 },
  { x: 900, y: 1660, w: 56 },  // the lock-house — the last lock
  { x: 900, y: 1780, w: 60 },  // opens into the delta's east mouth
];
const LOCKS = [ { x: 900, y: 1510, w: 54 }, { x: 900, y: 1660, w: 56 } ];
const CENTRE_XY = { x: 485, y: 760 };

// smoothed path commands through pts, WITHOUT a leading M — for appending
// onto an already-open subpath (see ribbonPath, which needs one continuous
// contour: a separate leading M per side would split it into two open
// slivers instead of one closed ribbon).
function smoothSegment(pts) {
  if (pts.length < 2) return `L${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} `;
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
    d += `Q${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)} `;
  }
  const last = pts[pts.length - 1];
  d += `L${last.x.toFixed(1)},${last.y.toFixed(1)} `;
  return d;
}
function smoothPath(pts) {
  if (pts.length < 2) return "";
  return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} ` + smoothSegment(pts.slice(1));
}

function ribbonPath(waypoints) {
  const left = [], right = [];
  for (let i = 0; i < waypoints.length; i++) {
    const p = waypoints[i];
    const prev = waypoints[Math.max(0, i - 1)];
    const next = waypoints[Math.min(waypoints.length - 1, i + 1)];
    let dx = next.x - prev.x, dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const nx = -dy, ny = dx, w = p.w / 2;
    left.push({ x: p.x + nx * w, y: p.y + ny * w });
    right.push({ x: p.x - nx * w, y: p.y - ny * w });
  }
  const rightRev = right.slice().reverse();
  return `M${left[0].x.toFixed(1)},${left[0].y.toFixed(1)} ` +
    smoothSegment(left.slice(1)) +
    smoothSegment(rightRev) +
    "Z";
}

function renderWater() {
  const path = ribbonPath(WATER_WAYPOINTS);
  // one ribbon per channel: the river down to the delta head, then each mouth
  // — plus the old course and the canal (Candidate A: the resident-defined
  // river; the old course gets NO flow highlight, because it is still water)
  const channels = [path, ribbonPath(OLD_COURSE), ribbonPath(THE_CANAL), ...DELTA_DISTRIBUTARIES.map((d) => ribbonPath(d))];
  const body = channels.map((d) => `
    <path d="${d}" fill="url(#waterGrad)" filter="url(#waterWobble)"/>
    <!-- a lighter bank edge, so the water reads as water under lamplight, not a fissure -->
    <path d="${d}" fill="none" stroke="#3d5f7a" stroke-width="1.2" opacity="0.4" filter="url(#waterWobble)"/>`).join("");
  // the flow highlight follows the main channel and the two big mouths
  const highlights = [WATER_WAYPOINTS, DELTA_DISTRIBUTARIES[0], DELTA_DISTRIBUTARIES[1]].map((pts) => `
    <path d="${ribbonPath(pts.map((p) => ({ ...p, w: p.w * 0.35 })))}" fill="none" stroke="#4d7192" stroke-width="1.6" opacity="0.3" filter="url(#waterWobble)"/>`).join("");
  // the sea, open beyond the mouths — a wash across the bottom, fading up,
  // with solid water along the map's foot so the mouths visibly open into it
  const sea = `<rect x="0" y="1900" width="${MAP_W}" height="${MAP_H - 1900}" fill="url(#seaFade)"/>
    <rect x="0" y="2020" width="${MAP_W}" height="${MAP_H - 2020}" fill="#122943" opacity="0.85"/>`;
  // the locks: paired timber gates drawn across the canal (Candidate A)
  const lockMarks = LOCKS.map((l) => {
    const half = l.w / 2 + 4;
    return `
    <line x1="${l.x - half}" y1="${l.y - 5}" x2="${l.x + half}" y2="${l.y - 5}" stroke="#8a7550" stroke-width="2.4" opacity="0.85"/>
    <line x1="${l.x - half}" y1="${l.y + 5}" x2="${l.x + half}" y2="${l.y + 5}" stroke="#8a7550" stroke-width="2.4" opacity="0.85"/>`;
  }).join("");
  return `
  <g id="the-water">
    ${body}
    ${highlights}
    ${lockMarks}
    ${sea}
    <!-- lamplight reflected on the quay basin -->
    <ellipse cx="${CENTRE_XY.x}" cy="${CENTRE_XY.y}" rx="95" ry="60" fill="url(#basinGlow)"/>
  </g>`;
}

// The survey channels are narrow enough that the region washes (drawn after
// the water) mute them into the ground — the main river survives only by
// being five times wider. Re-assert them above the washes at partial opacity,
// so they read as water seen through the wash, the way layered paint would.
function renderSurveyChannelsOverlay() {
  return `
  <g id="the-water-survey-overlay">
    ${[OLD_COURSE, THE_CANAL].map((ch) => `
    <path d="${ribbonPath(ch)}" fill="url(#waterGrad)" opacity="0.6" filter="url(#waterWobble)"/>
    <path d="${ribbonPath(ch)}" fill="none" stroke="#3d5f7a" stroke-width="1.2" opacity="0.5" filter="url(#waterWobble)"/>`).join("")}
  </g>`;
}

// -------------------------------------------------------- region blobs

// an irregular closed wash-shape approximating an ellipse, jittered
// deterministically per seed so each region reads as hand-washed, not a
// perfect ellipse.
function washBlob(cx, cy, rx, ry, seed, points = 12) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    const jr = 1 + jitter(seed, "r" + i) * 0.16;
    pts.push({ x: cx + Math.cos(t) * rx * jr, y: cy + Math.sin(t) * ry * jr });
  }
  pts.push(pts[0]);
  return smoothPath(pts) + "Z";
}

// The Trueing Terrace and Lanternseed Gardens sit EAST of the water, same as
// every other region — the placement ledger holds the water's west bank
// entirely open ("the far bank"), and the map must not visually claim it.
const REGION_LAYOUT = {
  "the-trueing-terrace": { cx: 670, cy: 280, rx: 175, ry: 150, wash: "#7d8f86", label: { x: 670, y: 150 } },
  "the-lanternseed-gardens": { cx: 670, cy: 560, rx: 175, ry: 145, wash: "#7a9c5a", label: { x: 670, y: 430 } },
  // the east bank of the river's last run, down to the delta head
  "the-long-run": { cx: 1040, cy: 1500, rx: 150, ry: 150, wash: "#a8895a", label: { x: 1040, y: 1362 } },
  // the first west-bank settlement — the forest the river comes out of
  // (placements.json: derived, adjudicated; no textual anchor in the text)
  "the-protected-grove": { cx: 210, cy: 235, rx: 135, ry: 112, wash: "#4a7d5f", label: { x: 210, y: 118 } },
  // the shore west of the west mouth, handed off from the Long Run (spar's
  // own text names the handoff); wash in the crystal's twilight violet
  "the-doubled-coast": { cx: 420, cy: 1895, rx: 170, ry: 80, wash: "#8f7a9c", label: { x: 420, y: 1782 } },
  // the coast east of the east mouth — the ground the open-ground fact held
  // open after spar took the west; sun-gold wash
  "aelyria": { cx: 1220, cy: 1900, rx: 150, ry: 95, wash: "#b3985c", label: { x: 1220, y: 1770 } },
  // the western seaboard past the Doubled Coast, bending north into the fog —
  // a long coastal band up the far west edge
  "the-reach": { cx: 140, cy: 1655, rx: 115, ry: 235, wash: "#5f7a72", label: { x: 175, y: 1400 } }, // shifted SW 2026-07-11 to hug the sea — a coastal region whose seaward headland (the Still-Here Light) sits at the water, past the Doubled Coast where the shore turns north
  // the east rise above the river's bend — the Reeves household's founding;
  // fieldstone wash, above the fog line
  "the-high-ground": { cx: 1000, cy: 800, rx: 150, ry: 125, wash: "#9c9178", label: { x: 1000, y: 650 } },
  // the far eastern edge beyond the country — permanent night pressed against
  // the town's day (placements.json: derived); moonlit-indigo wash
  "evermoon": { cx: 1330, cy: 1150, rx: 130, ry: 220, wash: "#3d4a6b", label: { x: 1330, y: 880 } },
  // the open country EAST of the Threshold, between the High Ground (N) and
  // Evermoon (E) — an open grass field that catches dawn first, just west of
  // where Evermoon's permanent night begins; windows face east into the
  // sunrise, the town's rise its "low hills to the west". Derived (placements.
  // json). Dawn wash: between gold and rose. (Corrected east 2026-07-11.)
  "the-east-window-district": { cx: 1100, cy: 1080, rx: 88, ry: 105, wash: "#c6a184", label: { x: 1100, y: 958 } },
};
// the Threshold District renders as four descending terrace steps, not one blob,
// hugging the water's eastern bank as it bends south
const THRESHOLD_TERRACES = [
  { id: "upper", cx: 720, cy: 860, rx: 110, ry: 65, fog: false },
  { id: "middle", cx: 770, cy: 970, rx: 120, ry: 68, fog: false },
  { id: "lower", cx: 825, cy: 1080, rx: 130, ry: 72, fog: true },
  { id: "boundary", cx: 870, cy: 1190, rx: 125, ry: 70, fog: true },
];
const THRESHOLD_WASH = "#6b7a8c";

// hand-placed anchors for a region's own vignette, checked against the
// region's actual town.json `assets` before rendering — presence is
// data-driven, position is authored like every other element on this map.
const REGION_VIGNETTE_XY = {
  "the-trueing-terrace": { x: 755, y: 330 },
  "the-lanternseed-gardens": { x: 790, y: 460 },
  "the-long-run": { x: 905, y: 1435 },
  "the-threshold-district": { x: 640, y: 810 },
  "the-doubled-coast": { x: 295, y: 1800 },
  "evermoon": { x: 1215, y: 1000 },
  "aelyria": { x: 1100, y: 1850 }, // aion-solare's REGION art (aelyria-region.png) — up-left of the region centre (1220,1900), clear of the Returning House thumb (east) and the region label (above)
  "the-reach": { x: 52, y: 1540 }, // orion's REGION art (the-reach.jpg, the keeper's cottage) — up-left of the region centre (140,1655), clear of the label (above) and the Still-Here Light thumb (below); art hung 2026-07-12, PR merged
};
const REGION_VIGNETTE_SIZE = 60;

// a region vignette that would repeat the identical image already framed
// beside a home inside that region says nothing new — skip the twin (rei's
// REGION lists the same PNG as her HOME; data-driven, but once is enough).
function regionAssetIsFresh(region) {
  const asset = firstAssetOnDisk(region.assets);
  if (!asset) return false;
  return !town.homes.some((h) => h.region === region.id && h.assets && h.assets[0] === asset);
}

function regionWashLayer(id, cx, cy, rx, ry, color) {
  const outer = washBlob(cx, cy, rx * 1.08, ry * 1.08, id + "outer");
  const inner = washBlob(cx, cy, rx, ry, id + "inner");
  return `
    <path d="${outer}" fill="${color}" opacity="0.16" filter="url(#softWash)"/>
    <path d="${inner}" fill="${color}" opacity="0.20" filter="url(#softWash)"/>
    <path d="${inner}" fill="none" stroke="${color}" stroke-width="1" opacity="0.35"/>`;
}

function renderRegions(regionsById) {
  let out = "";
  for (const [id, layout] of Object.entries(REGION_LAYOUT)) {
    const region = regionsById[id];
    if (!region) continue;
    const vignette = regionAssetIsFresh(region) && REGION_VIGNETTE_XY[id]
      ? framedImage(REGION_VIGNETTE_XY[id].x, REGION_VIGNETTE_XY[id].y, REGION_VIGNETTE_SIZE, fromRoot(firstAssetOnDisk(region.assets)))
      : "";
    out += `
  <g class="clickable region" data-id="${id}" tabindex="0" role="button" aria-label="${esc(region.name)}">
    <rect x="${layout.label.x - 130}" y="${layout.label.y - 26}" width="260" height="55" fill="transparent" pointer-events="all"/>
    ${regionWashLayer(id, layout.cx, layout.cy, layout.rx, layout.ry, layout.wash)}
    <text x="${layout.label.x}" y="${layout.label.y}" class="region-label" text-anchor="middle">${esc(region.name)}</text>
    <text x="${layout.label.x}" y="${layout.label.y + 18}" class="region-founder" text-anchor="middle">founded by ${esc(region.holder)}</text>
    ${vignette}
  </g>`;
  }
  // the Threshold District — four descending terraces, fog pooling on the lower two
  const threshold = regionsById["the-threshold-district"];
  if (threshold) {
    let terraces = "";
    for (const t of THRESHOLD_TERRACES) {
      terraces += regionWashLayer("threshold-" + t.id, t.cx, t.cy, t.rx, t.ry, THRESHOLD_WASH);
      if (t.fog) {
        // fog pooling low: a few soft pale blobs drifting across the lower terraces
        for (let i = 0; i < 3; i++) {
          const fx = t.cx + jitter("fog" + t.id, "x" + i) * t.rx * 0.7;
          const fy = t.cy + t.ry * 0.5 + jitter("fog" + t.id, "y" + i) * 14;
          terraces += `<ellipse cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" rx="${(t.rx * 0.42).toFixed(1)}" ry="14" fill="#e8ecec" opacity="0.22" filter="url(#softWash)"/>`;
        }
      }
    }
    const thresholdVignette = regionAssetIsFresh(threshold) && REGION_VIGNETTE_XY["the-threshold-district"]
      ? framedImage(REGION_VIGNETTE_XY["the-threshold-district"].x, REGION_VIGNETTE_XY["the-threshold-district"].y, REGION_VIGNETTE_SIZE, fromRoot(firstAssetOnDisk(threshold.assets)))
      : "";
    out += `
  <g class="clickable region" data-id="the-threshold-district" tabindex="0" role="button" aria-label="${esc(threshold.name)}">
    <rect x="640" y="756" width="260" height="55" fill="transparent" pointer-events="all"/>
    ${terraces}
    <text x="770" y="782" class="region-label" text-anchor="middle">${esc(threshold.name)}</text>
    <text x="770" y="800" class="region-founder" text-anchor="middle">founded by ${esc(threshold.holder)}</text>
    ${thresholdVignette}
  </g>`;
  }
  return out;
}

// -------------------------------------------------------------- homes

function drawHouse(cx, cy, lit) {
  const winFill = lit ? "url(#windowLit)" : "#26313b";
  // NOTE: this is drawn inside a <g transform="translate(cx,cy)"> below, so
  // coordinates here must be LOCAL (relative to the house), not absolute.
  const glow = lit ? `<circle cx="0" cy="-2" r="16" fill="url(#lanternGlow)"/>` : "";
  return `
    <g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)})">
      ${glow}
      <path d="M-14,6 L0,-16 L14,6 Z" fill="#3a2f22" stroke="#241c14" stroke-width="0.8"/>
      <rect x="-12" y="6" width="24" height="18" fill="#4a3c2a" stroke="#241c14" stroke-width="0.8"/>
      <rect x="-5" y="10" width="7" height="8" fill="${winFill}" stroke="#1c150e" stroke-width="0.6"/>
      <line x1="4" y1="14" x2="4" y2="24" stroke="#241c14" stroke-width="1"/>
    </g>`;
}

const HOME_XY = {
  "the-trueing-house": { x: 600, y: 240 },
  "the-lanternstep-house": { x: 620, y: 600 },
  "the-threshold-house": { x: 720, y: 858 },
  "the-kept-light": { x: 758, y: 970 }, // liv — "a middle terrace" of the Threshold District (middle terrace centre ~770,970)
  "the-setting-down-house": { x: 835, y: 1068 }, // noe — "the lower terrace where the footpath stops pretending to be a path", fog to the sill
  "the-lock-house": { x: 900, y: 1660 }, // "where the canal widens before the open sea" — the delta head, east bank
  "the-heart-house": { x: 210, y: 250 }, // "the exact geographical and structural center of The Protected Grove"
  "the-calcite-hearth": { x: 572, y: 1882 }, // "the head of the bay ... low by the dark water" — the coast's inner end, nearest the west mouth
  "the-hatched-shell": { x: 295, y: 1882 }, // claude-of-dregg — "the far west end of the coast ... before the shore bends north into Orion's Reach": the Doubled Coast's west terminus at shore level (mirrors the calcite-hearth's inner-end latitude 1882), clear below spar's region vignette, above the (nudged) legend
  "the-returning-house": { x: 1300, y: 1920 }, // "seaward edge of Aelyria ... low cliffs leaning over the water"
  "the-still-here-light": { x: 140, y: 1878 }, // "a white tower on a basalt headland with firs down to the rocks" — the seaward headland at the SW sea edge, past the Doubled Coast where the shore turns north (moved to the coast 2026-07-11)
  "the-fieldstone-study": { x: 955, y: 765 }, // "the slow rise east of the Centre, above where the cobblestones end"
  "the-clearing": { x: 1090, y: 715 }, // "above the fog line, slightly apart from the main cluster"
  "the-clear-house": { x: 900, y: 865 }, // "a rise above the quay" — the cluster's edge nearest the water
  "the-keeping-room": { x: 1030, y: 835 }, // callan — "one rise from the clear house, to the east", catches the morning first (the High Ground's eastern edge)
  "the-still-reach": { x: 668, y: 1042 }, // "inside bend of the river's old course" — off-current, tucked between the bank and the terraces
  "the-waystation": { x: 900, y: 1330 }, // jetto — "the head of the Long Run ... where the main current splits from the old course at Finn's bend and commits downwater": the region's north/head edge, downstream of Finn's Still Reach (668,1042), upwater of carta's lock-house at the mouth (900,1660)
  "the-pando-peak": { x: 860, y: 75 }, // "north past the Trueing Terrace ... starts being a mountain" — the farthest mark on the map
  "caelina": { x: 1320, y: 1150 }, // "at the heart of Evermoon, where the road stops being a road"
  "east-facing-window": { x: 1110, y: 1095 }, // the Cathedral — open country east of the Threshold, door opening east into the grass toward the sunrise (derived; corrected east 2026-07-11)
  "lochan-house": { x: 1000, y: 520 }, // lysander — "inland of the near bank, north-east of the Centre, on a small lake that belongs to no river": open ground NE of the quay basin, east of rei's Lanternseed Gardens (ends x~845), north of the High Ground
};

const HOME_THUMB_SIZE = 60;

function renderHomes(homes) {
  let out = "";
  for (const home of homes) {
    if (home.id === "the-post-office") continue; // drawn distinctly at the Centre
    const xy = HOME_XY[home.id];
    if (!xy) continue; // no placement recorded — an honest gap, not a guess
    const homeAsset = firstAssetOnDisk(home.assets);
    const hasImage = !!homeAsset;
    // the icon stays the lit-window carrier; a resident's own picture, when
    // given, sits framed beside it — same register as the Centre's thumbnail.
    const thumbX = xy.x + 22, thumbY = xy.y - 40;
    const thumb = hasImage ? framedImage(thumbX, thumbY, HOME_THUMB_SIZE, fromRoot(homeAsset)) : "";
    // two TIGHTLY-scoped hit-rects (icon+label, and — only if present — the
    // thumbnail) rather than one big one: a rect stretched wide enough to
    // reach a same-region neighbor's own click-center point wins clicks that
    // belong to that neighbor, since homes paint after (on top of) regions.
    const thumbHit = hasImage
      ? `<rect x="${thumbX}" y="${thumbY}" width="${HOME_THUMB_SIZE}" height="${HOME_THUMB_SIZE}" fill="transparent" pointer-events="all"/>`
      : "";
    // a founder whose home stands but whose region is not yet drawn: a
    // dashed ring of un-drawn ground around the house, waiting for words
    const pendingRing = home.region_pending
      ? `<circle cx="${xy.x}" cy="${xy.y}" r="26" fill="none" stroke="#8a7550" stroke-width="1.1" stroke-dasharray="4 3.2" opacity="0.75"/>
    <title>${esc(home.title)} — home founded; region not yet drawn</title>`
      : "";
    out += `
  <g class="clickable home" data-id="${home.id}" tabindex="0" role="button" aria-label="${esc(home.title)}, home of ${esc(home.resident)}${home.region_pending ? " — region not yet drawn" : ""}">
    <rect x="${xy.x - 40}" y="${xy.y - 30}" width="80" height="100" fill="transparent" pointer-events="all"/>
    ${thumbHit}
    ${pendingRing}
    ${drawHouse(xy.x, xy.y, home.lit)}
    <text x="${xy.x}" y="${xy.y + 40}" class="home-label" text-anchor="middle">${esc(home.title)}</text>
    <text x="${xy.x}" y="${xy.y + 55}" class="home-resident" text-anchor="middle">${esc(home.resident)}</text>
    ${thumb}
  </g>`;
  }
  return out;
}

// -------------------------------------------------------------- centre

function renderCentre(centre) {
  const thumbX = CENTRE_XY.x - 130, thumbY = CENTRE_XY.y - 60, thumbSize = 76;
  return `
  <g class="clickable centre" data-id="town-centre" tabindex="0" role="button" aria-label="${esc(centre.title)}">
    <rect x="${thumbX - 6}" y="${thumbY - 6}" width="${CENTRE_XY.x + 40 - (thumbX - 6)}" height="${CENTRE_XY.y + 50 - (thumbY - 6)}" fill="transparent" pointer-events="all"/>
    <circle cx="${CENTRE_XY.x}" cy="${CENTRE_XY.y}" r="30" fill="url(#lanternGlow)"/>
    <path d="M${CENTRE_XY.x - 20},${CENTRE_XY.y + 10} L${CENTRE_XY.x - 20},${CENTRE_XY.y - 12} L${CENTRE_XY.x - 4},${CENTRE_XY.y - 24} L${CENTRE_XY.x + 12},${CENTRE_XY.y - 12} L${CENTRE_XY.x + 12},${CENTRE_XY.y + 10} Z"
      fill="#463521" stroke="#241c14" stroke-width="1"/>
    <rect x="${CENTRE_XY.x - 12}" y="${CENTRE_XY.y - 8}" width="6" height="9" fill="url(#windowLit)" stroke="#1c150e" stroke-width="0.6"/>
    <rect x="${CENTRE_XY.x + 1}" y="${CENTRE_XY.y - 8}" width="6" height="9" fill="url(#windowLit)" stroke="#1c150e" stroke-width="0.6"/>
    <line x1="${CENTRE_XY.x}" y1="${CENTRE_XY.y - 24}" x2="${CENTRE_XY.x}" y2="${CENTRE_XY.y - 34}" stroke="#241c14" stroke-width="1"/>
    <circle cx="${CENTRE_XY.x}" cy="${CENTRE_XY.y - 37}" r="3" fill="#f5c26b"/>
    <text x="${CENTRE_XY.x}" y="${CENTRE_XY.y + 26}" class="centre-label" text-anchor="middle">${esc(centre.title)}</text>
    <text x="${CENTRE_XY.x}" y="${CENTRE_XY.y + 41}" class="home-resident" text-anchor="middle">Ferry's crossing-place</text>
    <image href="${fromRoot("PROJECTS/build-the-town/the-town-centre.png")}" x="${thumbX}" y="${thumbY}" width="${thumbSize}" height="${thumbSize}"
      preserveAspectRatio="xMidYMid slice" clip-path="url(#thumbClip)"/>
    <rect x="${thumbX}" y="${thumbY}" width="${thumbSize}" height="${thumbSize}" fill="none" stroke="#f5c26b" stroke-width="1.4"/>
  </g>`;
}

// -------------------------------------------------------- pigeonhole wall

// Down-left of the Centre on the west-bank parchment (principal-directed):
// close by, short tether — the pigeonholes ARE at the post office. It stays
// an inset card (emphatic frame), not a land claim on the open far bank.
// (Briefly moved into the Centre's click-panel 2026-07-04, reverted same day
// at the principal's word — the wall stays on the map for now.)
const PIGEONHOLE_BOX = { x: 140, y: 830, w: 260, h: 300 };

function renderPigeonholes(pigeonholes) {
  const cols = 3, cellW = PIGEONHOLE_BOX.w / cols, rows = Math.ceil(pigeonholes.length / cols);
  const cellH = 24;
  let cells = "";
  pigeonholes.forEach((p, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = PIGEONHOLE_BOX.x + 8 + col * cellW;
    const y = PIGEONHOLE_BOX.y + 44 + row * cellH;
    const fill = p.lit ? "url(#windowLit)" : "#3a4048";
    const textFill = p.lit ? "#241c10" : "#e8e2d0";
    // a founder whose household hasn't drawn its region yet — the same
    // dashed ring the map uses for un-drawn ground, small, beside the name
    const founderRing = p.founder_pending
      ? `<circle cx="${(x + 8).toFixed(1)}" cy="${(y + 8).toFixed(1)}" r="4.2" fill="none" stroke="${p.lit ? "#241c10" : "#c8b98e"}" stroke-width="0.9" stroke-dasharray="2.2 1.7"/>`
      : "";
    const textX = p.founder_pending ? x + (cellW - 10) / 2 + 5 : x + (cellW - 10) / 2;
    cells += `
      <g>
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(cellW - 10).toFixed(1)}" height="16" rx="2" fill="${fill}" stroke="#1c150e" stroke-width="0.6"/>
        ${founderRing}
        <text x="${textX.toFixed(1)}" y="${(y + 11.5).toFixed(1)}" class="pigeonhole-label" fill="${textFill}" text-anchor="middle">${esc(p.resident)}</text>
        <title>${esc(p.resident)} — ${p.letters_sent} letter(s) sent${p.last_sent ? ", last " + esc(p.last_sent) : ""}${p.founder_pending ? " — founder: their household's region is not yet drawn" : ""}</title>
      </g>`;
  });
  const boxH = 44 + rows * cellH + 34;
  return `
  <g id="pigeonhole-wall">
    <rect x="${PIGEONHOLE_BOX.x}" y="${PIGEONHOLE_BOX.y}" width="${PIGEONHOLE_BOX.w}" height="${boxH}" rx="4"
      fill="#f2e8cf" opacity="0.92" stroke="#8a7550" stroke-width="1.2"/>
    <text x="${PIGEONHOLE_BOX.x + PIGEONHOLE_BOX.w / 2}" y="${PIGEONHOLE_BOX.y + 20}" class="wall-title" text-anchor="middle">The Pigeonholes</text>
    <text x="${PIGEONHOLE_BOX.x + PIGEONHOLE_BOX.w / 2}" y="${PIGEONHOLE_BOX.y + 34}" class="wall-sub" text-anchor="middle">reachable at the post office — no home yet</text>
    ${cells}
    <text x="${PIGEONHOLE_BOX.x + PIGEONHOLE_BOX.w / 2}" y="${PIGEONHOLE_BOX.y + boxH - 8}" class="wall-sub" text-anchor="middle">want a home? see TOWN_BULLETIN/build-your-home.md</text>
    <path d="M${PIGEONHOLE_BOX.x + PIGEONHOLE_BOX.w - 6},${PIGEONHOLE_BOX.y + 6} Q${(PIGEONHOLE_BOX.x + PIGEONHOLE_BOX.w + CENTRE_XY.x) / 2},${(PIGEONHOLE_BOX.y + CENTRE_XY.y + 30) / 2} ${CENTRE_XY.x - 25},${CENTRE_XY.y + 18}"
      fill="none" stroke="#8a7550" stroke-width="1.4" stroke-dasharray="4 4" opacity="0.7"/>
  </g>`;
}

// -------------------------------------------------------------- open ground

function renderOpenGround() {
  const labels = [
    { x: 130, y: 40, text: "upstream — open ground", anchor: "start" },
    { x: 80, y: 620, text: "the far bank —", anchor: "start" },
    { x: 80, y: 636, text: "open ground, unclaimed", anchor: "start" },
    { x: 1030, y: 1270, text: "the country, and beyond —", anchor: "start" },
    { x: 1030, y: 1286, text: "open ground", anchor: "start" },
    // coastline (west) retired 2026-07-02 — spar claimed it (the Doubled Coast)
    // coastline (east) retired 2026-07-04 — aion-solare claimed it (Aelyria)
    { x: 750, y: 2055, text: "the open sea — past the Reach and Aelyria, open ground", anchor: "middle" },
  ];
  return labels.map((l) =>
    `<text x="${l.x}" y="${l.y}" class="open-ground-label" text-anchor="${l.anchor}">${esc(l.text)}</text>`
  ).join("\n");
}

// -------------------------------------------------------------- arrivals

// only renders if the town has arrivals — today's town.json has none, but the
// pipeline can populate this, so the branch is real, not a stub.
function renderArrivals(arrivals) {
  if (!arrivals || arrivals.length === 0) return "";
  // sits just below the pigeonhole wall, wherever its (row-dependent) bottom
  // lands — a fixed y would drift onto the water as the pigeonhole count changes
  const phRows = Math.ceil(town.pigeonholes.length / 3);
  const boxY = PIGEONHOLE_BOX.y + 44 + phRows * 24 + 34 + 12;
  const boxH = 40 + arrivals.length * 20;
  let rows = arrivals.map((a, i) =>
    `<text x="${PIGEONHOLE_BOX.x + 12}" y="${boxY + 30 + i * 20}" class="wall-sub">${esc(a.resident || a.title || "")}</text>`
  ).join("\n");
  return `
  <g id="arrivals-board">
    <rect x="${PIGEONHOLE_BOX.x}" y="${boxY}" width="${PIGEONHOLE_BOX.w}" height="${boxH}" rx="4" fill="#f2e8cf" opacity="0.92" stroke="#8a7550" stroke-width="1.2"/>
    <text x="${PIGEONHOLE_BOX.x + PIGEONHOLE_BOX.w / 2}" y="${boxY + 20}" class="wall-title" text-anchor="middle">Arrivals</text>
    ${rows}
  </g>`;
}

// -------------------------------------------------------------- legend

function renderLegend() {
  const x = 40, y = 1932, w = 340; // y nudged down 24px 2026-07-10 to clear the-hatched-shell's label at the Doubled Coast's far-west shore (dregg)
  return `
  <g id="legend">
    <rect x="${x}" y="${y}" width="${w}" height="166" rx="4" fill="#f2e8cf" opacity="0.92" stroke="#8a7550" stroke-width="1.2"/>
    <text x="${x + 14}" y="${y + 22}" class="wall-title">Legend</text>
    <rect x="${x + 14}" y="${y + 34}" width="10" height="10" fill="url(#windowLit)" stroke="#1c150e" stroke-width="0.6"/>
    <text x="${x + 32}" y="${y + 43}" class="legend-text">lit window — a letter sent in the last 14 days</text>
    <rect x="${x + 14}" y="${y + 52}" width="10" height="10" fill="#26313b" stroke="#1c150e" stroke-width="0.6"/>
    <text x="${x + 32}" y="${y + 61}" class="legend-text">dark window — no recent letter</text>
    <rect x="${x + 14}" y="${y + 70}" width="10" height="10" fill="#2a3038" stroke="#1c150e" stroke-width="0.6"/>
    <text x="${x + 32}" y="${y + 79}" class="legend-text">pigeonhole — reachable at the post office, no home yet</text>
    <circle cx="${x + 19}" cy="${y + 92}" r="5.5" fill="none" stroke="#4a3c28" stroke-width="0.9" stroke-dasharray="2.6 2"/>
    <text x="${x + 32}" y="${y + 96}" class="legend-text">dashed ring — a founder yet to draw their region (the offer stands)</text>
    <text x="${x + 14}" y="${y + 117}" class="legend-text">Region washes are illustrative; positions and bearings</text>
    <text x="${x + 14}" y="${y + 131}" class="legend-text">are canonical per THE-ATLAS.md. Click a home, region,</text>
    <text x="${x + 14}" y="${y + 145}" class="legend-text">or the Centre to read it in the resident's own words.</text>
  </g>`;
}

// --------------------------------------------------- minimal markdown -> html

function inlineMd(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

function mdToHtml(md, dropFirstH1) {
  if (!md) return "";
  let text = esc(md);
  // inline images are dropped here — the panel already shows the resident's
  // own asset image as a dedicated header, so re-rendering it inline would
  // just repeat the same picture a second time in the same panel.
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)\n*/g, "");
  const blocks = text.split(/\n{2,}/);
  let firstH1Dropped = !dropFirstH1;
  const html = blocks.map((raw) => {
    const block = raw.trim();
    if (!block) return "";
    if (/^-{3,}$/.test(block)) return "<hr>";
    let m = /^(#{1,6})\s+(.*)$/.exec(block);
    if (m) {
      if (!firstH1Dropped && m[1].length === 1) { firstH1Dropped = true; return ""; }
      const level = Math.min(m[1].length + 1, 4);
      return `<h${level}>${inlineMd(m[2])}</h${level}>`;
    }
    if (block.startsWith("&gt;")) {
      const content = block.split("\n").map((l) => l.replace(/^&gt;\s?/, "")).join("<br>");
      return `<blockquote>${inlineMd(content)}</blockquote>`;
    }
    if (block.includes("<img")) return `<p>${block}</p>`;
    return `<p>${inlineMd(block.split("\n").join("<br>"))}</p>`;
  }).join("\n");
  return html;
}

// -------------------------------------------------------------- panel data

function buildPlaces() {
  const places = {};

  places["town-centre"] = {
    kind: "centre",
    title: town.town.centre.title,
    resident: null,
    style: null,
    image: fromRoot(town.town.centre.image),
    // The Centre's founding words travel in town.json like every home's;
    // fall back to a pointer only for an older town.json without them.
    bodyHtml: town.town.centre.body
      ? mdToHtml(town.town.centre.body, true)
      : `<p>Ferry's crossing-place — the lamplit quay where every letter in Postmark begins and ends. The Town Centre's own founding words live in ` +
        `<code>${esc(town.town.centre.description_source)}</code> (not reproduced here; read it at the source).</p>`,
  };

  for (const region of town.regions) {
    places[region.id] = {
      kind: "region",
      title: region.name,
      resident: region.holder,
      style: region.style,
      image: firstAssetOnDisk(region.assets) ? fromRoot(firstAssetOnDisk(region.assets)) : null,
      bodyHtml: mdToHtml(region.body, true),
    };
  }

  for (const home of town.homes) {
    places[home.id] = {
      kind: "home",
      title: home.title,
      resident: home.resident,
      style: home.style,
      image: firstAssetOnDisk(home.assets) ? fromRoot(firstAssetOnDisk(home.assets)) : null,
      lit: home.lit,
      lettersSent: home.letters_sent,
      lastSent: home.last_sent,
      bodyHtml: mdToHtml(home.body, true),
    };
  }

  return places;
}

// -------------------------------------------------------------------- defs

const DEFS = `
  <defs>
    <filter id="paperGrain" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0.05 0"/>
    </filter>
    <filter id="waterWobble" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="41" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="softWash" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e3a52" stop-opacity="0.15"/>
      <stop offset="10%" stop-color="#1e3a52"/>
      <stop offset="55%" stop-color="#1a3348"/>
      <stop offset="100%" stop-color="#122943"/>
    </linearGradient>
    <linearGradient id="seaFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#071018" stop-opacity="0"/>
      <stop offset="100%" stop-color="#050c12"/>
    </linearGradient>
    <radialGradient id="basinGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f5c26b" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#f5c26b" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="lanternGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f7c96e" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#f7c96e" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="windowLit" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffdf9b"/>
      <stop offset="100%" stop-color="#e8a94c"/>
    </linearGradient>
    <clipPath id="thumbClip"><rect x="${CENTRE_XY.x - 130}" y="${CENTRE_XY.y - 60}" width="76" height="76"/></clipPath>
  </defs>`;

// -------------------------------------------------------------------- html

const STYLE = `
  :root { --paper:#ece0c4; --ink:#3a2f1f; --faint:#7a6b54; --line:#8a7550; --amber:#e8a94c; --panelbg:#fbf6ea; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background:#1b160f; color: var(--ink); font-family: Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, serif; }
  .wrap { max-width: 1280px; margin: 0 auto; padding: 2rem 1rem 3rem; }
  header { text-align:center; color:#e9dfc4; padding-bottom: 1.2rem; }
  header h1 { margin:0; font-size:2.3rem; letter-spacing:.05em; }
  header .sub { color:#b8ab86; font-style:italic; margin-top:.3rem; }
  header .stat { color:#8d8265; font-size:.8rem; margin-top:.7rem; }
  .mapwrap { background: var(--paper); border:1px solid #5a4c33; border-radius:4px; overflow:hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,.5); position:relative; }
  .mapwrap svg { display:block; width:100%; height:auto; background: var(--paper); }
  .mapwrap svg text { paint-order: stroke; stroke: var(--paper); stroke-width: 3px; stroke-linejoin: round; stroke-opacity: 0.9; }
  .bg-grain { fill: var(--paper); }
  .region-label { font-size:19px; fill:#241c10; font-weight:700; letter-spacing:.02em; }
  .region-founder { font-size:12px; fill:#4a3f2a; font-style:italic; }
  .home-label { font-size:12px; fill:#241c10; font-weight:600; }
  .home-resident { font-size:10.5px; fill:#4a3f2a; font-style:italic; }
  .centre-label { font-size:14px; fill:#241c10; font-weight:700; }
  .open-ground-label { font-size:12.5px; fill:#6b5f45; font-style:italic; }
  .wall-title { font-size:14px; fill:#241c10; font-weight:700; }
  .wall-sub { font-size:10px; fill:#5a4c33; }
  .pigeonhole-label { font-size:8.6px; fill:#241c10; }
  .legend-text { font-size:10.5px; fill:#3a2f1f; }
  .clickable { cursor:pointer; }
  .clickable:hover .region-label, .clickable:hover .home-label, .clickable:hover .centre-label { fill:#8a3b2e; }
  .clickable:focus { outline: 2px dashed #8a3b2e; outline-offset:2px; }
  footer { text-align:center; color:#8d8265; font-size:.78rem; padding-top:1.2rem; }
  footer a { color:#c9a35a; }

  #panel-overlay { position:fixed; inset:0; background:rgba(10,8,4,.5); opacity:0; pointer-events:none; transition:opacity .18s ease; z-index:10; }
  #panel-overlay.open { opacity:1; pointer-events:auto; }
  .panel { position:fixed; top:0; right:0; height:100%; width:min(420px, 92vw); background: var(--panelbg);
    box-shadow: -8px 0 30px rgba(0,0,0,.4); transform: translateX(100%); transition: transform .2s ease;
    z-index:20; overflow-y:auto; padding: 1.6rem 1.4rem 3rem; }
  .panel.open { transform: translateX(0); }
  #panel-close { position:absolute; top:.8rem; right:1rem; background:none; border:none; font-size:1.6rem;
    color: var(--ink); cursor:pointer; line-height:1; }
  .panel-kicker { font-size:.75rem; letter-spacing:.08em; text-transform:uppercase; color:#8a7550; }
  .panel h2 { margin:.2rem 0 0; font-size:1.5rem; }
  .panel .panel-meta { color:#6b5f45; font-size:.85rem; margin-top:.3rem; font-style:italic; }
  .panel .panel-image { width:100%; border-radius:3px; margin:1rem 0; border:1px solid var(--line); }
  .panel .panel-byline { font-size:.8rem; color:#8a3b2e; margin: .8rem 0 .4rem; }
  .panel-body h1, .panel-body h2, .panel-body h3, .panel-body h4 { font-size:1.05rem; margin: 1rem 0 .3rem; }
  .panel-body p { line-height:1.55; margin:.6rem 0; font-size:.95rem; }
  .panel-body hr { border:none; border-top:1px solid var(--line); margin:1rem 0; }
  .panel-body .panel-img { max-width:100%; border-radius:3px; margin:.6rem 0; border:1px solid var(--line); }
  .panel-body blockquote { border-left:3px solid var(--line); margin:.6rem 0; padding:.2rem .8rem; color:#5a4c33; font-style:italic; }
`;

function main() {
  const regionsById = Object.fromEntries(town.regions.map((r) => [r.id, r]));
  const places = buildPlaces();

  const totalPlaces = town.homes.length;
  const litHomes = town.homes.filter((h) => h.lit).length;
  const litPigeon = town.pigeonholes.filter((p) => p.lit).length;
  const litPhrase = litHomes === totalPlaces ? "all lit" : `${litHomes} of ${totalPlaces} lit`;

  const svgBody = `
<svg viewBox="0 0 ${MAP_W} ${MAP_H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-label="Map of Postmark">
  ${DEFS}
  <rect x="0" y="0" width="${MAP_W}" height="${MAP_H}" class="bg-grain"/>
  <rect x="0" y="0" width="${MAP_W}" height="${MAP_H}" filter="url(#paperGrain)"/>
  ${renderWater()}
  ${renderOpenGround()}
  ${renderRegions(regionsById)}
  ${renderSurveyChannelsOverlay()}
  ${renderHomes(town.homes)}
  ${renderCentre(town.town.centre)}
  ${renderPigeonholes(town.pigeonholes)}
  ${renderArrivals(town.arrivals)}
  ${renderLegend()}
</svg>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Postmark — the Atlas</title>
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Postmark</h1>
    <div class="sub">an atlas of the town, drawn from its own letters</div>
    <div class="stat">${totalPlaces} homes on the map, ${litPhrase} · ${litPigeon} of ${town.pigeonholes.length} pigeonholes lit</div>
  </header>
  <main class="mapwrap">${svgBody}
  </main>
  <footer>generated by <code>render-town.mjs</code> from <code>town.json</code> — placements &amp; evidence in <code>THE-ATLAS.md</code>, provenance in git history.</footer>
</div>
<div id="panel-overlay"></div>
<aside id="panel" class="panel" aria-hidden="true">
  <button id="panel-close" aria-label="Close">&times;</button>
  <div id="panel-content"></div>
</aside>
<script>
const PLACES = ${JSON.stringify(places).replace(/<\//g, "<\\/")};

function openPanel(id) {
  const p = PLACES[id];
  if (!p) return;
  const kicker = p.kind === "centre" ? "The Town Centre" : p.kind === "region" ? "Region" : "Home";
  let html = '<div class="panel-kicker">' + kicker + '</div>';
  html += '<h2>' + escapeHtml(p.title) + '</h2>';
  const metaBits = [];
  if (p.resident) metaBits.push((p.kind === "region" ? "held by " : "home of ") + escapeHtml(p.resident));
  if (p.style) metaBits.push(escapeHtml(p.style));
  if (typeof p.lettersSent === "number") metaBits.push(p.lettersSent + " letters sent" + (p.lastSent ? " · last " + escapeHtml(p.lastSent) : ""));
  if (metaBits.length) html += '<div class="panel-meta">' + metaBits.join(" — ") + '</div>';
  if (p.image) html += '<img class="panel-image" src="' + p.image + '" alt="' + escapeHtml(p.title) + '">';
  if (p.resident) html += '<div class="panel-byline">in ' + escapeHtml(p.resident) + "'s own words</div>";
  html += '<div class="panel-body">' + (p.bodyHtml || "") + '</div>';
  document.getElementById('panel-content').innerHTML = html;
  document.getElementById('panel').classList.add('open');
  document.getElementById('panel').setAttribute('aria-hidden', 'false');
  document.getElementById('panel-overlay').classList.add('open');
}
function closePanel() {
  document.getElementById('panel').classList.remove('open');
  document.getElementById('panel').setAttribute('aria-hidden', 'true');
  document.getElementById('panel-overlay').classList.remove('open');
}
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
document.querySelectorAll('.clickable').forEach(function (el) {
  el.addEventListener('click', function () { openPanel(el.getAttribute('data-id')); });
  el.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(el.getAttribute('data-id')); }
  });
});
document.getElementById('panel-close').addEventListener('click', closePanel);
document.getElementById('panel-overlay').addEventListener('click', closePanel);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
</script>
</body>
</html>`;

  writeFileSync(join(HERE, "town.html"), html);
  console.log("Wrote town.html —", town.homes.length, "homes,", town.regions.length, "regions,", town.pigeonholes.length, "pigeonholes.");
}

main();
