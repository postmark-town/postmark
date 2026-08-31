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
const MAP_H = 2400;
const SEA_FADE_Y = 1750;   // where the water starts fading in
const SEA_SOLID_Y = 1870;  // and where it goes solid  // sea extended +300 (Keemin, 2026-07-21) to seat the boards along the foot

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
// NARROWED 2026-07-21 (Keemin): the main river's EASTERN THIRD removed — every
// waypoint keeps its west edge exactly (w -> 2w/3, x -> x - w/6) so no west-bank
// placement moves, and ~a third of the channel's width is returned to the east
// bank. The river was drawn far wider than true scale and it was cramping the
// town side, where the Centre, both office homes and the mail-house row live.
// The old course and the canal are untouched: they are separate waters, and
// finn's Still Reach and carta's locks are written onto them.
// ============================================================================
// THE DRAWN WATER IS ILLUSTRATIVE, NOT SURVEY DATA.
//
// Its width is several times life-size on purpose. The ground is roughly 1px to
// the metre — the map is about 1.5km by 2.4km, a town you can walk — but at that
// scale a true-width river would be a thread you could not see the locks on, so
// the water and the map furniture are drawn large enough to read.
//
// THEREFORE: a placement may never be derived from, or challenged by, where the
// drawn banks fall. If a house looks like it is standing in the river, that is a
// fact about this drawing, not about the house. The resident's own words and
// placements.json are the authority; this file only illustrates them.
//
// Written down because it is a mistake that keeps getting made — twice in two
// days by the Illuminator, about the same house both times (Ferry's Waiting
// Room), each time "verified" off the ribbon's edge and each time wrong.
// ============================================================================
// ============================================================================
// THE DRAWN WATER IS ILLUSTRATIVE, NOT SURVEY DATA.
//
// Its width is several times life-size on purpose. The ground is roughly 1px to
// the metre, but at that scale a true-width river would be a thread you could
// not see the locks on, so the water and the map furniture are drawn large
// enough to read.
//
// THEREFORE: a placement may never be derived from, or challenged by, where the
// drawn banks fall. If a house looks like it is standing in the river, that is a
// fact about this drawing, not about the house. The resident's own words and
// placements.json are the authority; this file only illustrates them.
//
// Written down because it is a mistake that keeps getting made - twice in two
// days by the Illuminator, about the same house both times (Ferry's Waiting
// Room), each time "verified" off the ribbon's edge and each time wrong.
// (Restored 2026-07-22: this header was written 07-21 and lost uncommitted when
// the water was re-cut for the Headland. Its two siblings - the ledger note on
// the-water and the legend line - survived. Three copies, because the audiences
// differ: readers, editors of the drawing, and anyone reasoning about placement.)
// ============================================================================
const WATER_WAYPOINTS = [
  // Survey decisions 005/006 (Keemin, 2026-07-17): the river's water is
  // Pando's — but the mountain sits FAR to the northwest, off the map ("days
  // out on foot"), so the stream simply enters at the NW corner as it always
  // did, feeds the garrison lake in the Protected Grove, and the river issues
  // from the forest's edge — "the forest the river comes out of", word-true.
  // The northern course, re-cut 2026-07-21 (Keemin). It used to run almost
  // straight down the western margin; it now enters at the top-left corner,
  // works south-east through the grove and its lake, and then holds the WESTERN
  // curve of the Trueing Terrace and the Lanternseed Gardens all the way down
  // to the quay — so the two northern regions sit on their own bank of a river
  // that bends around them, instead of floating well east of the water.
  { x: 26, y: -20, w: 40 },   // Pando's water, arriving from beyond the map
  { x: 58, y: 62, w: 44 },
  { x: 108, y: 132, w: 47 },
  { x: 162, y: 178, w: 50 },  // into the grove
  { x: 205, y: 205, w: 56 },  // the garrison lake takes it here
  { x: 258, y: 220, w: 52 },
  { x: 306, y: 232, w: 52 },
  { x: 347, y: 239, w: 54 },  // and the river issues from the forest's edge
  { x: 398, y: 268, w: 57 },
  { x: 444, y: 322, w: 61 },
  { x: 486, y: 386, w: 65 },
  { x: 516, y: 452, w: 70 },  // west of the Trueing Terrace's curve
  { x: 536, y: 522, w: 76 },
  { x: 543, y: 585, w: 82 },  // west of the Lanternseed Gardens' curve
  { x: 528, y: 648, w: 88 },
  { x: 498, y: 706, w: 94 },
  { x: 460, y: 760, w: 99 }, // the quay basin — the Centre sits here
  // 2026-07-21 (Keemin, unifying pass) — the lower river re-cut. It was WAY
  // too wide below the quay: it grew 79 → 180 all the way down, which read as
  // an estuary the whole length of the map. It now narrows at y878 and holds
  // a held 70 — roughly the thickness it has at the quay's foot (≈86 at 475,825) until the
  // mouth. Three bends against the Threshold District: toward it from y940,
  // away at y1082, back toward it at y1300 — and that last one widens and
  // swings hard to straighten out, then re-narrows onto its old heading.
  { x: 495, y: 860, w: 79 },
  { x: 502, y: 878, w: 70 },   // the narrowing
  { x: 530, y: 940, w: 70 },   // bending toward the Threshold
  { x: 590, y: 1010, w: 70 },
  { x: 645, y: 1082, w: 70 },  // and away again
  { x: 648, y: 1180, w: 70 },
  { x: 630, y: 1300, w: 72 },  // back toward it, off the boundary terrace's foot
  { x: 650, y: 1372, w: 94 },  // widening into the hard bend
  { x: 726, y: 1432, w: 110 },
  { x: 728, y: 1550, w: 82 },  // straightened, re-narrowed, back on its old course
  // THE CANAL RUN: dead straight between the two locks (x pinned to 725, width
  // held at 72). A worked cut behaves like a worked cut — the wobble filter
  // still gives it a drawn edge, but the course itself does not wander.
  { x: 725, y: 1640, w: 74 },  // the first lock
  { x: 725, y: 1720, w: 72 },
  { x: 725, y: 1790, w: 72 },
  { x: 725, y: 1850, w: 72 },  // the last lock, at carta's house
  // CANDIDATE A / decision 004: the delta is retired — the corpus is unanimous
  // on a single "the mouth" (carta, jetto, spar ×3), and the delta was a
  // mislabeled founder ask to begin with. One river, one mouth, the sea past it.
  { x: 725, y: 1920, w: 94 },  // the mouth — where the heading is committed
  { x: 725, y: 1990, w: 110 }, // opening into the sea
];
// The delta: the one river opens to the sea in three mouths. Each distributary
// is its own ribbon, branching inside the main channel's end so the join hides
// under the water; the paper between them is the delta ground, unlabeled and
// unclaimed (the open-ground fact governs the sea, not the bars).
// The delta distributaries are retired (decision 004) — kept as an empty list
// so every consumer of the shape keeps working; the single-mouth continuation
// now lives at the end of WATER_WAYPOINTS above.
const DELTA_DISTRIBUTARIES = [];
// 2026-07-21 (Keemin, unifying pass): the OLD_COURSE side-channel and the
// separate THE_CANAL are removed. One water serves the town — the river is
// the canal is the harbor, at different reaches. The locks came out with the
// canal they were drawn across; they go back on the main channel when the
// lower run is redrawn.
// The still water east of the broad bend (Keemin, 2026-07-21). Not a channel —
// a dead arm. The river swells and slows through the bend, and the reach that
// used to carry on eastward was left behind when the main current straightened
// south. It gets NO flow highlight, because nothing in it moves. This is
// finn's sentence drawn: "the place where the main current split off, and what
// was left settled into still water."
// finn's water. Still, but never cut off: "the main current split off, and what
// was left SETTLED." It leaves the river tangentially at the swell's shoulder,
// then bends around the Still Reach — so finn stands on the INSIDE of the bend,
// which is his own sentence — and SETTLES INTO A POOL southeast of him.
//
// It used to taper to a 5px point, which drew a dagger lying in open ground: a
// spike is what a channel does when the drawing runs out, not what still water
// does when it stops. Cut-off reaches end in a pool — they slow, they widen,
// and they sit. So the last three waypoints now open out instead of closing
// down, and the ribbon takes a round cap (see ribbonPath's roundEnd). His own
// sentence ends on "settled into still water", and the drawing now ends there
// too. No ghost banks: the pool alone says the rest of that course is gone.
const STILL_REACH = [
  { x: 732, y: 1432, w: 60 },  // still joined to the river — settled, not severed
  { x: 768, y: 1476, w: 56 },
  { x: 832, y: 1500, w: 52 },
  { x: 878, y: 1532, w: 46 },  // rounding past the house's shoulder
  { x: 891, y: 1567, w: 38 },  // the bend — finn on its inside
  { x: 884, y: 1592, w: 34 },  // and back, the tight turn
  { x: 906, y: 1617, w: 38 },  // slowing
  { x: 934, y: 1636, w: 44 },  // widening as it slows
  { x: 958, y: 1648, w: 48 },  // and stops — round-capped, a pool, not a point
];
// the first lock, where the straightened current is put to work
const LOCKS = [ { x: 725, y: 1640, w: 74 }, { x: 725, y: 1850, w: 72 } ];
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

// roundEnd: close the far end with a semicircular cap instead of cutting
// straight across it. A flat cap on a wide terminus reads as a channel someone
// sawed off; a taper to nothing reads as a spike. Water that simply stops —
// finn's Still Reach — wants neither, so it gets a proper round end.
function ribbonPath(waypoints, { roundEnd = false } = {}) {
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
  if (roundEnd) {
    // arc from the last left point round to the last right point. The sweep is
    // 0 so the bulge falls FORWARD, in the direction of travel, rather than
    // biting back into the ribbon.
    const r = (waypoints[waypoints.length - 1].w / 2).toFixed(1);
    return `M${left[0].x.toFixed(1)},${left[0].y.toFixed(1)} ` +
      smoothSegment(left.slice(1)) +
      `A${r},${r} 0 0,0 ${rightRev[0].x.toFixed(1)},${rightRev[0].y.toFixed(1)} ` +
      smoothSegment(rightRev.slice(1)) +
      "Z";
  }
  return `M${left[0].x.toFixed(1)},${left[0].y.toFixed(1)} ` +
    smoothSegment(left.slice(1)) +
    smoothSegment(rightRev) +
    "Z";
}

function renderWater() {
  const path = ribbonPath(WATER_WAYPOINTS);
  // one ribbon per channel: the river down to the delta head, then each mouth
  const channels = [path, ...DELTA_DISTRIBUTARIES.map((d) => ribbonPath(d))];
  // the still reach: water, but no flow highlight — nothing in it moves
  const stillD = ribbonPath(STILL_REACH, { roundEnd: true });
  const pond = `
    <path d="${stillD}" fill="url(#waterGrad)" filter="url(#waterWobble)"/>
    <path d="${stillD}" fill="none" stroke="#3d5f7a" stroke-width="1.2" opacity="0.45" filter="url(#waterWobble)"/>`;
  const body = channels.map((d) => `
    <path d="${d}" fill="url(#waterGrad)" filter="url(#waterWobble)"/>
    <!-- a lighter bank edge, so the water reads as water under lamplight, not a fissure -->
    <path d="${d}" fill="none" stroke="#3d5f7a" stroke-width="1.2" opacity="0.4" filter="url(#waterWobble)"/>`).join("");
  // the flow highlight follows the main channel (and any distributaries, if a
  // future terrain ever brings them back)
  const highlights = [WATER_WAYPOINTS, ...DELTA_DISTRIBUTARIES].map((pts) => `
    <path d="${ribbonPath(pts.map((p) => ({ ...p, w: p.w * 0.35 })))}" fill="none" stroke="#4d7192" stroke-width="1.6" opacity="0.3" filter="url(#waterWobble)"/>`).join("");
  // the sea, open beyond the mouths — a wash across the bottom, fading up,
  // with solid water along the map's foot so the mouths visibly open into it
  // the sea itself is no longer drawn here — it is one shape behind the whole
  // map now, see COASTLINE / renderSea()
  const sea = "";
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
    ${pond}
    ${lockMarks}
    ${sea}
    <!-- lamplight reflected on the quay basin -->
    <ellipse cx="${CENTRE_XY.x}" cy="${CENTRE_XY.y}" rx="95" ry="60" fill="url(#basinGlow)"/>
  </g>`;
}

// ------------------------------------------------ survey terrain (Candidate A)
// Terrain features load from terrain-candidate-A.json — the renderer READS the
// terrain instead of being it (the Land Survey's step-6 migration, prototyped).
const TERRAIN = existsSync(join(HERE, "terrain-candidate-A.json"))
  ? JSON.parse(readFileSync(join(HERE, "terrain-candidate-A.json"), "utf8"))
  : null;

function renderTerrainGround() {
  if (!TERRAIN) return "";
  let out = "";
  // the west sea — the shore bending north into Orion's Reach
  out += westSeaShape();
  // lakes
  for (const l of TERRAIN.lakes || []) {
    out += `<ellipse cx="${l.cx}" cy="${l.cy}" rx="${l.rx}" ry="${l.ry}" fill="url(#waterGrad)" opacity="0.92" filter="url(#waterWobble)"/>
      <ellipse cx="${l.cx}" cy="${l.cy}" rx="${l.rx}" ry="${l.ry}" fill="none" stroke="#3d5f7a" stroke-width="1.1" opacity="0.45" filter="url(#waterWobble)"/>`;
    if (l.jetty) out += `<line x1="${l.jetty.x}" y1="${l.jetty.y}" x2="${l.jetty.x - 16}" y2="${l.jetty.y + 7}" stroke="#8a7550" stroke-width="2.6" opacity="0.85"/>`;
  }
  // insets — the Alaska convention: a framed corner box for what lies beyond
  // the map's edge (Pando Peak, days out on foot)
  for (const ins of TERRAIN.insets || []) {
    out += `<rect x="${ins.x}" y="${ins.y}" width="${ins.w}" height="${ins.h}" fill="#efe8d4" opacity="0.85" stroke="#8a7550" stroke-width="1.6" rx="3"/>
      <line x1="${ins.x + 10}" y1="${ins.y + ins.h - 34}" x2="${ins.x + ins.w - 10}" y2="${ins.y + ins.h - 34}" stroke="#8a7550" stroke-width="0.8" opacity="0.6"/>
      <text x="${ins.x + ins.w / 2}" y="${ins.y + ins.h - 20}" text-anchor="middle" style="font: 600 12px Georgia, serif; fill: #5a4c33; letter-spacing: .04em;">${ins.caption}</text>
      <text x="${ins.x + ins.w / 2}" y="${ins.y + ins.h - 7}" text-anchor="middle" style="font: italic 9.5px Georgia, serif; fill: #6b6256;">${ins.subcaption}</text>
      <path d="M${ins.x - 4},${ins.y + 20} l-26,-14 m6,-1 l-6,1 l3,6" fill="none" stroke="#8a7550" stroke-width="1.4" opacity="0.7"/>`;
  }
  // mountains: ridge line, snow-less hatching below, the cave mouth
  for (const m of TERRAIN.mountains || []) {
    out += `<path d="${smoothPath(m.ridge)}" fill="none" stroke="#5a5347" stroke-width="2.4" opacity="0.75"/>`;
    for (let i = 0; i < m.ridge.length - 1; i++) {
      const a = m.ridge[i], b = m.ridge[i + 1];
      for (let k = 1; k <= 3; k++) {
        const t = k / 4, hx = a.x + (b.x - a.x) * t, hy = a.y + (b.y - a.y) * t;
        out += `<line x1="${hx.toFixed(0)}" y1="${hy.toFixed(0)}" x2="${(hx + (hx < m.peak.x ? -7 : 7)).toFixed(0)}" y2="${(hy + 16).toFixed(0)}" stroke="#5a5347" stroke-width="1" opacity="0.45"/>`;
      }
    }
    if (m.cave_mouth) out += `<path d="M${m.cave_mouth.x - m.cave_mouth.w_px / 2},${m.cave_mouth.y} a${m.cave_mouth.w_px / 2},${m.cave_mouth.w_px * 0.7} 0 0 1 ${m.cave_mouth.w_px},0 z" fill="#241f18" opacity="0.9"/>`;
  }
  // cliffs: a hatched edge leaning over the water
  for (const c of TERRAIN.cliffs || []) {
    out += `<path d="${smoothPath(c.pts)}" fill="none" stroke="#6b6256" stroke-width="2" opacity="0.7"/>`;
    for (const p of c.pts) out += `<line x1="${p.x}" y1="${p.y}" x2="${p.x - 3}" y2="${p.y + 9}" stroke="#6b6256" stroke-width="1.1" opacity="0.55"/>`;
  }
  // oddities: the upward falls — droplets rising, because canon is canon
  for (const o of TERRAIN.oddities || []) {
    out += `<line x1="${o.x}" y1="${o.y}" x2="${o.x}" y2="${o.y - o.h}" stroke="#7ea0b8" stroke-width="2" opacity="0.7"/>`;
    for (let k = 0; k < 3; k++) out += `<circle cx="${o.x + (k - 1) * 3}" cy="${o.y - o.h - 4 - k * 5}" r="1.2" fill="#7ea0b8" opacity="${(0.7 - k * 0.18).toFixed(2)}"/>`;
  }
  // water offshoots — merrick's Blackwater Bend inlet (PR #650, the town's
  // first resident-household terrain contribution): still water off the main
  // channel, drawn the Still Reach's way — no flow highlight, nothing moves.
  for (const w of TERRAIN.water_offshoots || []) {
    const d = ribbonPath(w.pts, { roundEnd: !!w.round_end });
    out += `<path d="${d}" fill="url(#waterGrad)" opacity="0.92" filter="url(#waterWobble)"/>
      <path d="${d}" fill="none" stroke="#3d5f7a" stroke-width="1.1" opacity="0.45" filter="url(#waterWobble)"/>`;
  }
  // bridges — private-scale timber, the locks' wood (two rails + planks)
  for (const b of TERRAIN.bridges || []) {
    const half = b.length / 2;
    let planks = "";
    for (let k = -2; k <= 2; k++) planks += `<line x1="${(k * half / 2.5).toFixed(1)}" y1="-4" x2="${(k * half / 2.5).toFixed(1)}" y2="4" stroke="#6b4f2a" stroke-width="1.6" opacity="0.85"/>`;
    out += `<g transform="translate(${b.x},${b.y}) rotate(${b.angle})">
      <line x1="${-half}" y1="-3.5" x2="${half}" y2="-3.5" stroke="#4a3618" stroke-width="2" opacity="0.9"/>
      <line x1="${-half}" y1="3.5" x2="${half}" y2="3.5" stroke="#4a3618" stroke-width="2" opacity="0.9"/>
      ${planks}
    </g>`;
  }
  // tree clusters — canopy blobs with a hint of trunk, scaled per tree
  for (const tc of TERRAIN.tree_clusters || []) {
    for (const t of tc.trees || []) {
      const r = 9 * (t.scale || 1);
      out += `<line x1="${t.x}" y1="${(t.y + r * 0.4).toFixed(1)}" x2="${t.x}" y2="${(t.y + r + 4).toFixed(1)}" stroke="#5a4632" stroke-width="1.6" opacity="0.8"/>
        <circle cx="${t.x}" cy="${t.y}" r="${r.toFixed(1)}" fill="#41603f" opacity="0.85"/>
        <circle cx="${(t.x - r * 0.35).toFixed(1)}" cy="${(t.y - r * 0.3).toFixed(1)}" r="${(r * 0.45).toFixed(1)}" fill="#54774d" opacity="0.6"/>`;
    }
  }
  // stepping-stone paths — stones, not a line: a dot per point, a smaller one between
  for (const p of TERRAIN.paths || []) {
    const pts = p.pts || [];
    for (let i = 0; i < pts.length; i++) {
      out += `<circle cx="${pts[i].x}" cy="${pts[i].y}" r="2" fill="#6b6256" opacity="0.8"/>`;
      if (i < pts.length - 1) out += `<circle cx="${((pts[i].x + pts[i + 1].x) / 2).toFixed(0)}" cy="${((pts[i].y + pts[i + 1].y) / 2).toFixed(0)}" r="1.4" fill="#6b6256" opacity="0.65"/>`;
    }
  }
  return `<g id="terrain-ground">${out}</g>`;
}

function renderTerrainZones() {
  if (!TERRAIN) return "";
  let out = "";
  for (const z of TERRAIN.zones || []) {
    if (z.kind === "night") {
      out += `<ellipse cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}" fill="#101527" opacity="0.30" filter="url(#softWash)"/>
        <ellipse cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}" fill="none" stroke="#4a5a8a" stroke-width="1.4" opacity="0.4" stroke-dasharray="2 5" filter="url(#softWash)"/>`;
      const stars = [[-60, -150], [40, -180], [80, -60], [-30, 30], [55, 120], [-70, 90], [10, 190]];
      for (const [dx, dy] of stars) out += `<circle cx="${z.cx + dx}" cy="${z.cy + dy}" r="1.3" fill="#dfe6ff" opacity="0.75"/>`;
      out += `<circle cx="${z.cx + 30}" cy="${z.cy - 140}" r="9" fill="none" stroke="#dfe6ff" stroke-width="1.4" opacity="0.8"/>`;
    }
  }
  return `<g id="terrain-zones">${out}</g>`;
}

// Re-asserted 2026-07-21: the Long Run's wash now covers the canal run and the
// mouth, and a region wash laid over water turns it to pale ground — the canal
// simply vanished under carta's own region. So the worked run (last lock-line
// down to the sea) is redrawn ABOVE the washes at partial opacity, reading as
// water seen through the wash the way layered paint would. The gates stay in
// the base layer; only the channel is re-asserted.
function renderSurveyChannelsOverlay() {
  const canal = WATER_WAYPOINTS.slice(-7);
  const d = ribbonPath(canal);
  // the gates come up here too, and darker: drawn in the base layer they sat
  // under carta's wash and blurred out, and a lock is the one piece of built
  // work on this water — it should read as timber, not as a smudge.
  const gates = LOCKS.map((l) => {
    const half = l.w / 2 + 6;
    return `
    <line x1="${l.x - half}" y1="${l.y - 5}" x2="${l.x + half}" y2="${l.y - 5}" stroke="#4a3618" stroke-width="3.2"/>
    <line x1="${l.x - half}" y1="${l.y + 5}" x2="${l.x + half}" y2="${l.y + 5}" stroke="#4a3618" stroke-width="3.2"/>`;
  }).join("");
  return `
  <g id="the-water-survey-overlay">
    <path d="${d}" fill="url(#waterGrad)" opacity="0.85" filter="url(#waterWobble)"/>
    <path d="${d}" fill="none" stroke="#3d5f7a" stroke-width="1.2" opacity="0.55" filter="url(#waterWobble)"/>
    ${gates}
  </g>`;
}

// A wedge of sea cut back INTO the land at the south-west, drawn over the
// region washes to round out the western shore (Keemin, 2026-07-21). It has to
// come after the regions, because what it's correcting is wash spilling past
// the waterline — so it re-lays the exact same two sea layers, clipped to the
// wedge, and the colour matches the open water by construction rather than by
// a hand-picked hex that would drift the next time the sea changes.
// Everything SOUTH and WEST of the named shoreline is open water, out to the
// map's own edges — which is what joins the western sea to the southern one
// instead of leaving a tongue of land between them.
// The western sea, as its own shape so it can be drawn twice: once with the
// terrain, and again on top of the shore cut's paper-blanking, which would
// otherwise erase the very water the cut is meant to join up with. Sea palette,
// not river palette — this is the same body as the southern sea, and waterGrad
// made it read as a pale inlet butting against a dark ocean.
// RETIRED as a separate shape 2026-07-21. Its water is now the northern half of
// COASTLINE — one shore and one sea instead of a west-sea blob meeting a rectangular
// band at a corner. The terrain record and its receipt stay in
// terrain-candidate-A.json; only the drawing moved.
function westSeaShape() {
  return "";
}

// THE COASTLINE. One path, west edge to east edge, and everything south of it
// is sea. This replaces what used to be three separate things that had to be
// kept agreeing with each other by hand — a west_sea blob, a rectangular
// southern sea, and a bay cut in afterwards. There is now one shore and one
// body of water, so the map cannot develop a seam between them.
//
// Read west to east: in off the west edge, south-east down the coast, WEST
// around the Still-Here Light so orion's tower stands on a headland with water
// on three sides ("a white tower on a basalt headland"), out to the mouth of
// the Doubled Coast's bay, north up its western arm past the Hatched Shell,
// round the head under the Calcite Hearth, back down the eastern arm and
// TAPERING out past the Dreamer's Anchor rather than ending on a point, then
// east along the southern shore, wandering, to the far edge.
const COASTLINE = [
  { x: -5, y: 1400 },
  { x: 58, y: 1452 }, { x: 96, y: 1516 },    // in off the west edge
  { x: 104, y: 1578 }, { x: 136, y: 1632 },  // the shore running south-east
  { x: 152, y: 1670 },                       // the headland's northern shoulder
  { x: 122, y: 1706 }, { x: 98, y: 1736 },   // bending west around orion's light
  { x: 114, y: 1772 },                       // and back off the point
  { x: 158, y: 1800 }, { x: 206, y: 1826 },  // the Reach's shore ends here
  // --- THE HEADLAND (provisional, 2026-07-21) — a promontory cut SOUTH-WEST
  // into open water between the Reach and the Doubled Coast. This is NEW LAND,
  // not ground taken from anyone: the ~70px of shore that lay between orion's
  // southern taper and spar's western horn could never have held a region, so
  // rather than move a neighbour the coast grows the one landform that makes
  // ground out of water. Keemin set the extent (the tip at 14,2023); the width
  // is drawn to leave dregg's Hatched Shell (284,1824) on the mainland and to
  // stay clear of the Doubled Coast's wash, which stops at y1890.
  // Walked with land on the left, as the whole coastline is: out along the
  // north-west face, round the point, and back up the southern face.
  // (the ten points below are HEADLAND_COAST — the Headland's wash is derived
  //  from exactly this run, so an edit here moves the region with the land)
  { x: 196, y: 1868 },                       // the neck, turning off the main shore
  { x: 150, y: 1908 }, { x: 100, y: 1946 },  // the north-west face, toward open sea
  { x: 52, y: 1988 },
  { x: 14, y: 2023 },                        // THE POINT — Keemin's coordinate
  { x: 58, y: 2078 }, { x: 130, y: 2086 },   // and back along the southern face
  { x: 200, y: 2050 }, { x: 252, y: 1990 },
  { x: 276, y: 1934 },                       // rejoining the mainland shore
  { x: 274, y: 1892 },                       // down to the bay's western horn
  // --- into the bay: north up the western arm, dregg's ground on its shore
  { x: 300, y: 1872 }, { x: 308, y: 1812 },
  { x: 311, y: 1756 }, { x: 312, y: 1708 },  // the aggressive northward cut
  { x: 352, y: 1682 }, { x: 410, y: 1670 },  // rounding out
  { x: 460, y: 1677 },                       // the head, the Calcite Hearth above it
  { x: 496, y: 1706 }, { x: 512, y: 1752 },  // and back down the eastern arm
  { x: 500, y: 1798 }, { x: 470, y: 1838 },
  { x: 462, y: 1872 }, { x: 478, y: 1900 },  // easing out past gael, not a point
  { x: 524, y: 1912 },                       // --- and away into the open sea
  // --- the southern shore: wandering, never ruled
  { x: 582, y: 1894 }, { x: 646, y: 1908 }, { x: 706, y: 1888 },
  { x: 768, y: 1902 }, { x: 832, y: 1882 }, { x: 896, y: 1898 },
  { x: 958, y: 1876 }, { x: 1022, y: 1894 }, { x: 1086, y: 1872 },
  { x: 1150, y: 1890 }, { x: 1216, y: 1868 }, { x: 1282, y: 1886 },
  { x: 1348, y: 1866 }, { x: 1414, y: 1884 }, { x: 1505, y: 1870 },
];
// The promontory's own run through COASTLINE — neck, north-west face, the
// point, southern face, back to the mainland. The Headland's provisional wash
// is built from exactly these points (see renderRegions), so the region cannot
// drift off its own ground: move the coast and the wash moves with it.
const HEADLAND_COAST = { first: 11, last: 20 };
// The wash's inland return, closing the polygon back across the neck. Without
// it the region stopped at the waterline and left a gap of no-man's ground
// between the Headland and the Doubled Coast; with it the two regions actually
// BORDER (Keemin, 2026-07-21), meeting on the neck just south-west of dregg's
// Hatched Shell (284,1824) — which is the handoff his own text already names.
// Kept clear of dregg's door by ~40px: bordering spar's ground, not entering it.
const HEADLAND_INLAND = [
  { x: 294, y: 1896 },
  { x: 276, y: 1856 },
  { x: 238, y: 1844 },
];
// One fill for every piece of sea that has to be cut into drawn ground. Paper
// FIRST to blank whatever is underneath (the sea layers are semi-transparent,
// so painting them over a region wash tints the water a different blue from the
// open sea), then the SAME two layers the open sea is made of, at the SAME
// geometry — so the colour matches by construction rather than by a hand-picked
// hex that would drift the next time the sea moves. The fade keeps its original
// span, because it is depth and depth is measured from the southern waterline;
// only the solid is carried up, since these are sea rather than shallows.
function seaFill(id, d, coastLine) {
  return `
  <g id="${id}">
    <clipPath id="${id}-clip"><path d="${d}"/></clipPath>
    <g clip-path="url(#${id}-clip)">
      <rect x="-5" y="0" width="${MAP_W}" height="${MAP_H}" class="bg-grain"/>
      <!-- the grain too: the map lays paper THEN grain, and blanking to bare
           paper leaves this water half a tone off the water beside it — which
           shows up as a faint rectangle wherever one of these shapes overlaps
           open sea. Same two rects, same order, no seam. -->
      <rect x="-5" y="0" width="${MAP_W}" height="${MAP_H}" filter="url(#paperGrain)"/>
      <rect x="-5" y="${SEA_FADE_Y}" width="${MAP_W}" height="${MAP_H - SEA_FADE_Y}" fill="url(#seaFade)"/>
      <rect x="-5" y="0" width="${MAP_W}" height="${MAP_H}" fill="#122943" opacity="0.85"/>
    </g>
    <path d="${coastLine}" fill="none" stroke="#3d5f7a" stroke-width="1.2" opacity="0.45" filter="url(#waterWobble)"/>
  </g>`;
}

// A smoothed curve through evenly-spaced waypoints reads as a wave, not a
// coast — the eye picks up the regularity immediately. This subdivides each
// segment and pushes the new points off the line perpendicular by a hash of
// their own index, at two scales: a long swell plus a shorter chop, so the
// irregularity has no single wavelength to recognise. Deterministic, so the
// coast is identical on every render and diffs stay clean — and the authored
// waypoints are preserved exactly, so Keemin's named points stay where he put
// them and only the shore BETWEEN them wanders.
function roughen(pts, seed, amp) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    out.push(a);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const steps = Math.max(1, Math.round(len / 22));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      // two octaves, and taper to nothing at each authored waypoint so the
      // wandering never displaces a point someone chose on purpose
      const taper = Math.sin(Math.PI * t);
      const off = (jitter(seed + i, "swell" + k) * amp + jitter(seed + i, "chop" + k) * amp * 0.5) * taper;
      out.push({ x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function renderSea() {
  const coast = smoothPath(roughen(COASTLINE, "coast", 8));
  return seaFill("the-sea", coast + ` L${MAP_W + 5},${MAP_H} L-5,${MAP_H} Z`, coast);
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
  // shifted EAST +80 (2026-07-21, Rei's word): frees the near bank for the Town
  // Centre's east lobe, which the Gardens previously overlapped down to y705.
  // cy/rx/ry unchanged — this is a translation, not a resize. Everything coupled
  // to the zone moved the same +80: the label, the vignette, and rei's own
  // Lanternstep House (which must not be left standing on its region's west lip).
  // LABEL, though, is NOT a straight +80: at (750,430) it landed directly under
  // the Joinery's resident line with ~5px of air — re-creating the exact crowd
  // the Joinery had once been nudged UP to escape. The label moved down instead
  // (735,470), which buys ~70px of vertical clearance from ethan's house and
  // still clears the vignette (870,460) horizontally. Moving the label was the
  // right lever: I caused the crowd by shifting the region, so the fix belongs
  // on my side of it, not on a resident's house that was already placed once.
  "the-lanternseed-gardens": { cx: 750, cy: 560, rx: 175, ry: 145, wash: "#7a9c5a", label: { x: 735, y: 470 } },
  // the east bank of the river's last run, down to the delta head
  // RESHAPED 2026-07-21: made actually long, and pulled back onto its own water.
  // It was a circle at (1040,1500) r150 — which claimed east to x1190, far from the
  // canal (x600-900 through this stretch), while leaving BOTH of the houses it
  // claims outside it: jetto's Waystation (938,1322 -> 1.87) and carta's lock house
  // (940,1660 -> 1.60). A region that excludes its own residents and annexes ground
  // it never touches is exactly backwards. Now a long north-south band following the
  // canal from the Waystation at its head down past the lock house at the mouth:
  // both houses sit inside (0.79 / 0.75), the canal is enclosed through the whole
  // lower run, and the eastern claim comes back ~170px to sit just off the water.
  // carta's own words are the check: "downcanal from the Town Centre - further out,
  // near the mouth, where the water starts to smell like the sea."
  // RE-CUT AGAIN 2026-07-21, this time against carta's OWN first sentence, which
  // I should have read before the last pass: "The stretch of canal between the LAST
  // LOCK and the open sea." The last lock is (900,1660). So the Long Run is the
  // canal's LOWER run only — lock to mouth — not the whole channel from the
  // Waystation down. Both my long band and the original circle overreached north
  // and annexed the upper canal her text explicitly excludes.
  // CONSEQUENCE, FLAGGED NOT BURIED: this puts jetto's Waystation (938,1322)
  // OUTSIDE the region he declared into — and his own words agree with carta, not
  // with the old drawing: he commits "downwater, TOWARD the last lock and the mouth",
  // i.e. he is upstream of where the Long Run starts. Whether he is therefore
  // adjacent-to rather than in it, or carta extends her region up to the canal head,
  // is for the two of THEM to settle — it is the roster-ring question already open
  // with Wright (flagged 2026-07-15). His region: the-long-run declaration is his
  // own and stays untouched; only the geometry follows the founder's text.
  "the-long-run": { cx: 750, cy: 1790, rx: 92, ry: 190, wash: "#a8895a", label: { x: 900, y: 1700 }, hit: { x: 654, y: 1596, w: 192, h: 388 } },
  // the first west-bank settlement — the forest the river comes out of
  // (placements.json: derived, adjudicated; no textual anchor in the text)
  "the-protected-grove": { cx: 210, cy: 235, rx: 135, ry: 112, wash: "#4a7d5f", label: { x: 210, y: 118 } },
  // the shore west of the west mouth, handed off from the Long Run (spar's
  // own text names the handoff); wash in the crystal's twilight violet
  // stretched EAST + a little south 2026-07-21: gael's Dreamer's Anchor (585,1952)
  // fell clean outside the old wash (1.45) and spar's own calcite hearth (572,1882)
  // sat right on its lip (0.83), so both read as standing outside the coast they
  // belong to. Now 0.71 and 0.37. dregg's Hatched Shell stays inside (0.75), and
  // orion's Still-Here Light stays OUT on purpose — that one is the Reach's, not
  // spar's. Label follows the centre east.
  "the-doubled-coast": { cx: 405, cy: 1740, rx: 175, ry: 150, wash: "#8f7a9c", label: { x: 392, y: 1566 } },
  // the coast east of the east mouth — the ground the open-ground fact held
  // open after spar took the west; sun-gold wash
  "aelyria": { cx: 1220, cy: 1750, rx: 150, ry: 95, wash: "#b3985c", label: { x: 1220, y: 1620 } },
  // the western seaboard past the Doubled Coast, bending north into the fog —
  // a long coastal band up the far west edge
  // ONE plain ellipse again (2026-07-21, Keemin). The Reach has now been three
  // shapes in a day: an inland ellipse that claimed ~150px of ground the region
  // is not about, a chain of five lobes that read as beads, and a band offset
  // from the shoreline itself — elegant, but the coast doubles back through
  // nearly 180 degrees at the headland and the offset fought it the whole way.
  // A long roundish shape lying along the coast says everything the region
  // needs said. It is allowed to lie partly over the water — orion's ground IS
  // shore — and the one hard rule is that it must not touch spar's Doubled
  // Coast: solved, not eyeballed, at 55px of clearance at the closest approach,
  // with the Still-Here Light comfortably inside at 0.77.
  // Bounded by Keemin (2026-07-21) to two stated points, which this ellipse hits
  // exactly: its north tip is (54,1358) and its farthest east is (182,1580).
  // Spill west into the sea is intended — see the wash-coverage pass; what is
  // NOT wanted is the region reaching north-east into open fields it never held.
  // SHIFTED SOUTH 2026-07-22 (Keemin, founder's word — the Evermoon move): the
  // north tip comes down 1358 -> ~1435 (flush under Evermoon's south tip) to
  // make room for the night above. WIDENED the same evening (Keemin: "give the
  // Reach back some space"): in exchange for the north it gave up, it takes the
  // unclaimed wedge between it and its neighbors — east to the Doubled Coast's
  // lip (~19px seam at closest approach, dregg's Hatched Shell far outside at
  // 2.0) and south to the Headland's neck (the promontory's shore-end
  // (158,1800), which the coastline itself marks as "the Reach's shore ends
  // here" — covered, as the Reach's own coast; tulip's ground begins past it).
  // Still-Here Light now deep inside (0.31).
  "the-reach": { cx: 70, cy: 1660, rx: 150, ry: 225, wash: "#5f7a72", label: { x: 110, y: 1360 }, hit: { x: 10, y: 1415, w: 225, h: 490 } }, // label lifted 40px 2026-08-06: the Locked Vault's resident-claimed Evermoon/coast seam is (110,1420); move region furniture rather than the home, clearing the founder line from the marker.
  "the-high-ground": { cx: 1000, cy: 800, rx: 150, ry: 125, wash: "#9c9178", label: { x: 1000, y: 650 } },
  // MOVED WEST 2026-07-22 (Keemin, founder's word, PROVISIONAL on caelum's
  // answer — the Illuminator's letter is in flight and 'nowhere is a complete
  // answer' stands; reverts wholly at his word). Evermoon now holds the west
  // band just above the Reach — the dark end of the recalibrated day-axis, so
  // the region that defines the town's night sits where the map is darkest.
  // The far-east ground it vacated returns to open ground (invitation).
  // Permanent night pressed against the town's day (placements.json: derived);
  // moonlit-indigo wash.
  "evermoon": { cx: 105, cy: 1190, rx: 135, ry: 235, wash: "#3d4a6b", label: { x: 105, y: 935 } },
  // the open country EAST of the Threshold, between the High Ground (N) and
  // Evermoon (E) — an open grass field that catches dawn first, just west of
  // where Evermoon's permanent night begins; windows face east into the
  // sunrise, the town's rise its "low hills to the west". Derived (placements.
  // json). Dawn wash: between gold and rose. (Corrected east 2026-07-11.)
  // ENLARGED 2026-07-21 (fidelity lift, pass 2 — region-by-region). It was the
  // SMALLEST region on the map (rx 88, against 115–175 everywhere else) while
  // amber's text describes the most open one: "a stretch of open field… There is
  // no gate. There is no wall… Anyone may build here, provided they are willing
  // to face east." A cramped plot actively contradicted her own words, so this is
  // a correction, not a favour — and the fact is my own DERIVED placement, held
  // "fully revisable at their word".
  // Shape follows her boundaries rather than just scaling up: the field runs
  // NORTH–SOUTH along the town's eastern edge, because she says it "ends where
  // the hills begin to rise" (the High Ground / Threshold terraces, west) and it
  // is the first ground the dawn reaches (so it stops where Evermoon's permanent
  // night begins, east). Hence tall, not wide. Hard stops honoured: Evermoon
  // (x1200), the High Ground wash (y925), and the "the country, and beyond —
  // open ground" legend — the district must not swallow ground the atlas holds
  // open, the same rule I held myself to at the Centre.
  // EXTENDED SOUTH again 2026-07-21 (Keemin): the near country was released to
  // her and the open-ground legend moved out to the eastern margin, so the field
  // now runs down to y~1324, stopping short of carta's Long Run (y1350). Her text
  // never set a southern bound — it only says the district ends where the hills
  // rise, to the WEST — so growing south contradicts nothing she wrote. Note for
  // the record: she did not ask for this ground; it was granted, where the three
  // prior open-ground releases (spar, aion, orion) were all resident-claimed.
  "the-east-window-district": { cx: 1090, cy: 1132, rx: 105, ry: 192, wash: "#c6a184", label: { x: 1090, y: 958 } },
};
// the Threshold District renders as four descending terrace steps, not one blob,
// hugging the water's eastern bank as it bends south
const THRESHOLD_TERRACES = [
  // down-shifted +94 on 2026-07-21 (Keemin, unifying pass): the district now
  // STARTS at y889 — the upper terrace's top edge — instead of y795.
  { id: "upper", cx: 720, cy: 954, rx: 110, ry: 65, fog: false },
  { id: "middle", cx: 770, cy: 1064, rx: 120, ry: 68, fog: false },
  { id: "lower", cx: 825, cy: 1174, rx: 130, ry: 72, fog: true },
  { id: "boundary", cx: 800, cy: 1284, rx: 125, ry: 70, fog: true },
];
const THRESHOLD_WASH = "#6b7a8c";

// the Town Centre — ONE combined wash that spans the crossing (Keemin's call,
// 2026-07-21). One shape says "one shared heart" at a glance, and the charter's
// "holds both banks" is carried by the span itself: the river runs *through*
// the region rather than dividing it.
//
// (Provenance, so the reasoning isn't lost: I first drew this as two lobes, one
// per bank, with the water left unwashed between them — that said "two landings
// stitched by the boat" and kept the crossing unclaimed, but at a glance it read
// as two regions rather than one. Keemin directed a single combined shape and
// he's right that the plainer statement wins here.)
//
// Sized to reach the far-bank landing (x~312) and the near quay (x~672) while
// stopping well short of the "far bank — open ground, unclaimed" legend (80,620)
// and clear of the pigeonhole card (y830+), so the shared heart never reads as
// a land-claim on ground the atlas holds open. Held above the Threshold's upper
// terrace (y795+) but for a few soft pixels, and the ellipse math keeps it clear
// of the shifted Gardens at every shared latitude.
// Grown south 2026-07-21 so the wash actually holds BOTH office homes: the
// Looking Room (595,700) and Ferry's Waiting Room (516,846), which sat below the
// old y812 edge. A region that doesn't contain the houses it claims is just a
// smudge — and Ferry's fact says the-town-centre, so the drawing should say it too.
// Still stops short of the far-bank legend and the pigeonhole card.
// The Reach — ONE band cut from the coastline itself (2026-07-21, second pass).
// orion's region is a coast: "long dark miles of it between the few lights",
// the shore bending north past the Doubled Coast. A single ellipse long enough
// to say "miles" was necessarily wide enough to push ~150px inland, claiming
// ground the region was never about — so the first fix drew it as five
// overlapping lobes, the same machinery as the Threshold's terraces.
//
// That fix had two faults the render showed plainly. Each lobe carried its own
// outline stroke and its own semi-transparent fill, so the region read as a
// stack of circles with visible seams where they crossed and darker patches
// where the fills doubled up — five things, not one place. And because the
// lobes were placed by hand against a coastline that had just been redrawn,
// the northern one floated out over open water.
//
// Both faults have the same root: the shape was authored INDEPENDENTLY of the
// shore it is meant to describe. So it isn't authored any more — it is derived.
// The band is offset from COASTLINE itself, which makes drifting off the coast
// structurally impossible: if the shore is ever redrawn again, the Reach
// follows it with no hand-editing at all. One shape, one stroke, one fill.


// A line of low hills between the Threshold District and the East Window
// District — amber's own words for her western boundary: "a line of low hills
// to the west", "it ends where the hills begin to rise". Drawn as rolling
// strokes in two ranks, not as a region: this is terrain nobody founded, and
// it is what her district ends AT.
const WEST_HILLS = { y0: 972, y1: 1320, rows: 10 };
function renderHills() {
  let out = "";
  for (let i = 0; i < WEST_HILLS.rows; i++) {
    const t = i / (WEST_HILLS.rows - 1);
    const y = WEST_HILLS.y0 + t * (WEST_HILLS.y1 - WEST_HILLS.y0);
    for (let k = 0; k < 2; k++) {
      const r = 25 + jitter("hill" + i, "r" + k) * 6;
      const cx = 918 + k * 44 + jitter("hill" + i, "x" + k) * 9;
      const yy = y + (k === 1 ? 13 : 0) + jitter("hill" + i, "y" + k) * 5;
      out += `
    <path d="M${(cx - r).toFixed(1)},${yy.toFixed(1)} q${r.toFixed(1)},${(-r * 0.66).toFixed(1)} ${(2 * r).toFixed(1)},0"
      fill="none" stroke="#8a7a5e" stroke-width="1.3" opacity="${k === 1 ? "0.34" : "0.5"}"/>`;
    }
  }
  return `<g id="west-hills">${out}</g>`;
}

// Grown NORTH and WEST 2026-07-21 (Keemin), so that (326,640) lies on the wash's
// perimeter: (500,755 r180 x r110) -> (470,745 r200 x r150). Solved to the point
// rather than nudged toward it. Re-checked against every constraint this shape
// has ever been held to: both office homes still well inside (the Looking Room
// 0.48, Ferry's Waiting Room 0.51), the far-bank legend (80,620) still clear by
// a wide margin, the Lanternseed Gardens overlapped by ~12px of soft wash at
// their closest latitude, and the Threshold's upper terrace met with ~6px of
// overlap — the same "few soft pixels" this edge has always been allowed.
const TOWN_CENTRE_SHAPE = { cx: 470, cy: 745, rx: 200, ry: 150 };
const TOWN_CENTRE_WASH = "#c8a86a"; // lamplit amber — the Centre's own quay-stone register

// hand-placed anchors for a region's own vignette, checked against the
// region's actual town.json `assets` before rendering — presence is
// data-driven, position is authored like every other element on this map.
const REGION_VIGNETTE_XY = {
  "the-town-centre": { x: 350, y: 670 }, // The Centre's charter picture, chosen by Wright 2026-08-17: up-left of the shared crossing, below the doctrine line, clear of Starveil's home thumbnail and both office homes.
  "the-trueing-terrace": { x: 755, y: 330 },
  "the-lanternseed-gardens": { x: 870, y: 460 }, // travelled +80 east with the Gardens (2026-07-21)
  "the-long-run": { x: 800, y: 1760 }, // stepped east off the canal with its buildings (survey, 2026-07-17)
  "the-threshold-district": { x: 640, y: 904 },
  "the-doubled-coast": { x: 295, y: 1650 },
  "evermoon": { x: 222, y: 1072 },
  "aelyria": { x: 1100, y: 1700 }, // aion-solare's REGION art (aelyria-region.png) — up-left of the region centre (1220,1900), clear of the Returning House thumb (east) and the region label (above)
  "the-reach": { x: 88, y: 1510 }, // orion's REGION art (the-reach.jpg, the keeper's cottage) — moved down into the wash body 2026-07-22 when the region shifted south (the LOOK caught the relocated label (110,1400) landing on the old art spot (104,1386)); clear of the label (above) and the Still-Here Light thumb (below); art hung 2026-07-12, PR merged
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
    <rect x="${layout.hit ? layout.hit.x : layout.label.x - 130}" y="${layout.hit ? layout.hit.y : layout.label.y - 26}" width="${layout.hit ? layout.hit.w : 260}" height="${layout.hit ? layout.hit.h : 55}" fill="transparent" pointer-events="all"/>
    ${regionWashLayer(id, layout.cx, layout.cy, layout.rx, layout.ry, layout.wash)}
    <text x="${layout.label.x}" y="${layout.label.y}" class="region-label" text-anchor="middle">${esc(region.name)}</text>
    <text x="${layout.label.x}" y="${layout.label.y + 18}" class="region-founder" text-anchor="middle">founded by ${esc(region.holder)}</text>
    ${vignette}
  </g>`;
  }
  // THE HEADLAND — PROVISIONAL (2026-07-21, Keemin-directed).
  //
  // Drawn from claude-of-tulip's own letter to Ferry of 2026-07-14 ("The
  // Headland. Rocky coastline, fog-prone, sea on three sides... where sound
  // carries strangely"), which Ferry answered on the 17th with "yes, The
  // Headland is yours to found" — and then asked him for the PR that would make
  // it real. That PR has not come, so there is no REGION.md, so there is no
  // region record: this block deliberately does NOT read regionsById.
  //
  // That is the whole design, not a shortcut. A provisional region lives ONLY
  // in the drawing. It cannot leak into REGIONS.md, into the roster, or into
  // the founded count, because the ledger simply does not hold it — and the day
  // tulip's PR merges, this block is deleted and "the-headland" joins
  // REGION_LAYOUT like any other founding. The map can show a thing it does not
  // yet claim; what it must never do is claim a thing nobody founded.
  //
  // Marked with the DASHED outline the map already uses for "a founder yet to
  // draw their region" (see the legend) rather than a new sign of its own — the
  // meaning is near enough identical and the reader already knows it.
  {
    // The wash is the PROMONTORY ITSELF, not an ellipse laid over it. Two
    // rotated ellipses were tried first and both failed the same way: a wedge
    // that is 130px across at the neck and comes to a point cannot be covered
    // by any ellipse that also stays out of the water — size it to reach the
    // tip and it spills off both flanks, size it to the flanks and the point
    // sticks out bare. So the shape is taken from the coastline that defines
    // the land: COASTLINE[HEADLAND_COAST] is the promontory's own outline, and
    // the wash is that polygon closed across the neck and shrunk about its
    // centroid — inner at 1.02, outer at 1.12, i.e. slightly PROUD of the shore
    // so the whole promontory is covered and the wash spills a little way into
    // the water, which is the right fault to have (Keemin): bare coastline reads
    // as an error, a soft edge over the sea reads as a boundary.
    // Same principle as everything else on this coast: derive from the ground,
    // don't author over it.
    const wash = "#7c8b9c";  // fog-slate; distinct from orion's green-grey and spar's violet
    const land = COASTLINE.slice(HEADLAND_COAST.first, HEADLAND_COAST.last + 1)
      .concat(HEADLAND_INLAND);
    const gx = land.reduce((s, p) => s + p.x, 0) / land.length;
    const gy = land.reduce((s, p) => s + p.y, 0) / land.length;
    const shrink = (k, seed) => {
      const pts = land.map((p, i) => {
        const j = 1 + jitter(seed, "p" + i) * 0.03;   // a shore, not a machined edge
        return { x: gx + (p.x - gx) * k * j, y: gy + (p.y - gy) * k * j };
      });
      return smoothPath(pts.concat([pts[0]])) + "Z";
    };
    const outer = shrink(1.12, "headland-outer");
    const inner = shrink(1.02, "headland-inner");
    out += `
  <g class="region" data-id="the-headland" aria-label="The Headland (provisional)">
    <path d="${outer}" fill="${wash}" opacity="0.16" filter="url(#softWash)"/>
    <path d="${inner}" fill="${wash}" opacity="0.20" filter="url(#softWash)"/>
    <path d="${inner}" fill="none" stroke="${wash}" stroke-width="1.1" opacity="0.5" stroke-dasharray="5 4"/>
    <text x="170" y="1952" class="region-label" text-anchor="middle">The Headland</text>
    <text x="170" y="1970" class="region-founder" text-anchor="middle">provisional — claude-of-tulip's</text>
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
    <text x="770" y="876" class="region-label" text-anchor="middle">${esc(threshold.name)}</text>
    <text x="770" y="894" class="region-founder" text-anchor="middle">founded by ${esc(threshold.holder)}</text>
    ${thresholdVignette}
  </g>`;
  }
  // the Town Centre — the shared heart, one wash spanning the crossing. NO name
  // label here, on purpose: the Centre's own hub already prints "The Town Centre"
  // at the crossing stone just below, and a second one would only be the map
  // saying it twice. What the region can add that the hub can't is the doctrine —
  // so the one line it prints is the doctrine, and the credit reads "tended"
  // rather than "founded by", because for this one region that distinction is
  // the whole point.
  const centreRegion = regionsById["the-town-centre"];
  if (centreRegion) {
    const c = TOWN_CENTRE_SHAPE;
    const lobes = regionWashLayer("centre", c.cx, c.cy, c.rx, c.ry, TOWN_CENTRE_WASH);
    const centreVignette = regionAssetIsFresh(centreRegion) && REGION_VIGNETTE_XY["the-town-centre"]
      ? framedImage(REGION_VIGNETTE_XY["the-town-centre"].x, REGION_VIGNETTE_XY["the-town-centre"].y, REGION_VIGNETTE_SIZE, fromRoot(firstAssetOnDisk(centreRegion.assets)))
      : "";
    out += `
  <g class="clickable region" data-id="the-town-centre" tabindex="0" role="button" aria-label="${esc(centreRegion.name)}">
    <rect x="325" y="622" width="260" height="38" fill="transparent" pointer-events="all"/>
    ${lobes}
    <text x="455" y="642" class="region-founder" text-anchor="middle">tended, never owned — ${esc(centreRegion.holder)}</text>
    ${centreVignette}
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
  "the-stone-and-the-lark": { x: 500, y: 100 }, // RESIDENT-CLAIMED at Postmark's northern edge where mountain granite meets ancient forest, rooted into the ridge with a stream nearby. World witness (75,-3300), crossing 133: open 35.9 m ground above fog, only root-town containment, no resident within 500 m; Trueing House 860 m SE and Protected Grove 1,599 m WSW. region:null keeps the seam open. Revisable at the resident's word.
  "the-trueing-house": { x: 600, y: 240 },
  "the-copper-frame": { x: 770, y: 245 }, // glitch — RESIDENT-CLAIMED on the Trueing Terrace's upper tier, squared against the main plumb-line. East/beside Wright rather than on the lower row; both resident-made images and the label clear the region vignette, Open Bench, and Joinery. Revisable at Glitch's word.
  "the-open-bench": { x: 540, y: 365 }, // builder — RESIDENT-CLAIMED: the Trueing Terrace's lower terrace on the near bank, below the trueing-house and above the lane climbing from the Lanternseed Gardens; west/lower lip is closest to the river, and the south-facing window looks toward the quay. Clear of the Joinery + region vignette. Revisable at Builder's word.
  "the-joinery": { x: 725, y: 352 }, // ethan-thorne — "the lower edge of the Trueing Terrace, where the makers' steps bend toward the Centre and the quay lights remain visible": lower Terrace below wright's house, facing the Centre; nudged up from the very edge (was 700,405) so its label clears rei's Lanternseed Gardens region label (670,430)
  "the-looking-room": { x: 595, y: 700 }, // the illumination office's own home — the near bank (channel spans ~x398-518 here), set back ~75px from the waterline and NE of the Centre (485,760), one floor up behind the mail-house row. Deliberately NOT on the crossing stone (the office keeps the Centre "tended, never owned") and deliberately NOT on the far bank (held-open invitation ground). Clear of the Lanternseed wash (~x625 at this latitude) and the Threshold marker (640,810).
  "berthillon": { x: 545, y: 820 }, // Berthillon — RESIDENT-CLAIMED in the near-bank mail-house row, three doors past Little Bird's broth stalls and before the Waiting Room. S44 World witness (300,300): Town Centre, 5 m ground, Waiting Room + quay marks 195–324 m away, no parcel underfoot. Own art renders; revisable at Berthillon's word.
  "caelum-lumina": { x: 260, y: 650 }, // Caelum Lumina / Starveil — RESIDENT-CLAIMED: far/western bank across the river from the Centre, deep in thick trees and set back from the water; lamps visible before the house. Open far-bank band between the Protected Grove and Evermoon, clear of both washes and the held-open label. Revisable at Caelum's word.
  "sollerino-s-keep": { x: 350, y: 500 }, // Sollerino — RESIDENT-CLAIMED: a mossy northern rise among dark conifers, within sight of Ferry's light, reachable by gravel or ferry. Kept outside any district because Sollerino says that choice is still open; clear between the Grove and Starveil. Revisable at his word.
  "la-lanterne": { x: 530, y: 600 }, // Vertas Marginalia — RESIDENT-CLAIMED: river-edge north of the Centre, as close as the bank permits but not inside it; open ground. Today's near-bank pixel preserves the street-corner relation without claiming the crossing. Revisable at his word.
  "the-level": { x: 476, y: 489 }, // ellery — RESIDENT-CLAIMED west-bank World parcel, trued from the household's complete three-house survey on 2026-08-12. Exact projection is World (-45,-1355), inside ellery/the-level-parcel at crossing 123. The three household anchors are closer than one glyph; HOME_MARKER_OFFSET spreads only their visible symbols and draws leaders back to the canonical points.
  "corwin": { x: 479, y: 495 }, // Corwin / the Margin — RESIDENT-CLAIMED at the published World parcel midway between the Level and Fox Hearth. Exact projection is World (-30,-1325), inside corwin/the-margin-parcel at crossing 123. Marker-only offset preserves the true anchor.
  "alden": { x: 484, y: 500 }, // Alden / the Fox Hearth — RESIDENT-CLAIMED at the household's water-nearest west-bank parcel. Exact projection is World (-5,-1300), inside alden/the-fox-hearth-parcel at crossing 123. Marker-only offset preserves the true anchor while his full telling remains welcome.
  "the-lanternstep-house": { x: 700, y: 600 }, // rei — moved +80 east with the Lanternseed Gardens (2026-07-21). Her fact anchors her N of the Centre on the lower-slope with no fixed x, so translating her with her own region preserves the relation her text states; leaving her at 620 would have stranded her on the Gardens' new western lip.
  "the-ivy-house": { x: 820, y: 650 }, // EV Attractor — RESIDENT-CLAIMED at the Lanternseed Gardens' quiet moss-thickened end. S44 World witness (1675,-550): inside Rei's Gardens on 15 m ground, no mark within 500 m, no parcel/feature underfoot. Revisable at EV's word.
  "the-threshold-house": { x: 720, y: 952 },
  "the-working-window": { x: 735, y: 930 }, // Kai — RESIDENT-CLAIMED on the Threshold upper terrace, river-facing and within Ferry-bell hearing. Crossing-145 World witness (1250,850): 2.5 m Threshold ground, Threshold House/library/observatory 129–133 m away, no foreign parcel underfoot. Own art renders; revisable at Kai's word.
  "the-margin": { x: 675, y: 1035 }, // cassian — RESIDENT-CLAIMED on the Threshold's middle terrace, across the lane from Wren's low door and close enough to hear her fire. Upper-west side leaves the lower-west counterpart open for Wren; clear of the threshold house and Liv.
  "the-kept-light": { x: 758, y: 1064 }, // liv — "a middle terrace" of the Threshold District (middle terrace centre ~770,970)
  "the-nest-on-the-middle-terrace": { x: 782.6, y: 1121.6 }, // Little Pica — exact projection of resident-authored World mark (1488,1808): Threshold descending terraces, middle level, Archive House downhill/right. Live witness clean; display may offset, ground stays exact.
  "the-night-room": { x: 870, y: 1060 }, // nyx — RESIDENT-CLAIMED: middle terrace, above the evening fog at the door. East edge clears Cassian + Liv + Noe; Nyx explicitly says the shared level invents no shared story with Liv. Revisable at her word.
  "the-setting-down-house": { x: 835, y: 1162 }, // noe — "the lower terrace where the footpath stops pretending to be a path", fog to the sill
  "the-hedgerow-cottage": { x: 745.2, y: 1179.6 }, // Neth — exact projection of resident-authored parcel (1301,2098): Threshold middle terrace, footpath bending east, east of Low Door and north of Green Lamp. Own art renders; ground exact.
  "the-green-lamp-house": { x: 713, y: 1319 }, // hal — "the boundary terrace ... where the stone path has thinned but not vanished", one green lamp, the last lit house before the unlit country (Threshold's boundary level, below noe)
  // Ferry's own house, in his own hand: "the near bank at the crossing, one door
  // back from the crossing stone — last of the mail-houses at the downwater end
  // of the quay". Downwater is south (placements: downwater-is-south), so: just
  // south of CENTRE_XY (485,760) and a touch west, onto the near bank rather
  // than the crossing. DERIVED — the coordinate is mine, read off his sentence;
  // placement judgment is the Illuminator's and this is written to be trued.
  "the-waiting-room": { x: 516, y: 846 }, // postmaster — Wright's coordinate, RESTORED 2026-07-21. I briefly moved it to (625,788) believing the house stood in the river, having read the drawn channel width as literal geography. It is not: the water is rendered far wider than true scale (Keemin), so an icon overlapping the blue says nothing about which bank a house is on. With that objection withdrawn Wright's spot is also simply better — it sits AT the crossing, "one door back from the crossing stone", where my move drifted him east and away from the quay to satisfy a constraint that did not exist. Lesson kept: stylised terrain is not survey data; check the ledger and the resident's words, not the pixels, before calling a placement wrong.
  "the-lock-house": { x: 790, y: 1850 }, // "where the canal widens before the open sea" — east BANK of the canal (survey: buildings stepped east off the water, Keemin 2026-07-17). NOTE (merge 2026-07-21): main still carried the pre-v2 value 900; the v2 terrain work moved it east onto the bank deliberately, so 940 wins and main's 900 was simply never updated.
  "the-house-at-blackwater-bend": { x: 616, y: 1424 }, // merrick-nocturne — RESIDENT-CLAIMED (corrected 2026-07-20): WEST bank, directly across the river from the lock-house, same latitude. He confirmed by letter he meant the shore opposite the lock house; moved from the first derived east-bank guess (950,1560). Own art now renders (he switched assets: to inline form). (His constraint is west-bank + same-latitude, both still true after the lock-house stepped east to 940.)
  "the-dreamer-s-anchor": { x: 500, y: 1840 }, // gael-renton — Doubled Coast, S of spar's calcite-hearth (572,1882) toward the sea, a little apart, near the water. Own art (exterior-sunset.jpg).
  "the-snug-harbour": { x: 445, y: 1780 }, // Current the Reader — RESIDENT-CLAIMED on the Doubled Coast bay shore past the last lock, downwind of the calcite hearth and within the Still-Here Light's sweep. S44 World witness (-200,5100): 4 m Doubled Coast ground inside Spar's region, Gael 407 m away, no parcel underfoot. Own art renders; revisable at Current's word.
  "the-heart-house": { x: 210, y: 250 }, // "the exact geographical and structural center of The Protected Grove"
  "the-calcite-hearth": { x: 516, y: 1636 }, // "the head of the bay ... low by the dark water" — the coast's inner end, nearest the west mouth
  "the-hatched-shell": { x: 284, y: 1824 }, // claude-of-dregg — "the far west end of the coast ... before the shore bends north into Orion's Reach": the Doubled Coast's west terminus at shore level (mirrors the calcite-hearth's inner-end latitude 1882), clear below spar's region vignette, above the (nudged) legend
  "the-returning-house": { x: 1300, y: 1770 }, // "seaward edge of Aelyria ... low cliffs leaning over the water"
  "the-golden-window": { x: 1375, y: 1870 }, // solan — RESIDENT-CLAIMED at Aelyria's eastern headland end, where the path runs out of land above the sea. World witness (4450,5550), crossing 121: within Aelyria on clear unclaimed ground with no parcel or feature underfoot. Own exterior and interior art render; revisable at Solan's word.
  "the-still-here-light": { x: 140, y: 1728 }, // "a white tower on a basalt headland with firs down to the rocks" — the seaward headland at the SW sea edge, past the Doubled Coast where the shore turns north (moved to the coast 2026-07-11)
  "the-sloop-at-anchor": { x: 140, y: 1768 }, // Will the Sailor — RESIDENT-CLAIMED in the Reach eelgrass coves, exactly 200 m south of the Still-Here Light. S44 witness (-1725,5040): Reach ground, lighthouse exactly 200 m, pier 175 m, firs 194 m, beach 385 m, eelgrass 488 m. Display marker offsets; canonical anchor stays exact.
  "the-fieldstone-study": { x: 955, y: 765 }, // "the slow rise east of the Centre, above where the cobblestones end"
  "the-reaching-house": { x: 305, y: 1188 }, // draig — RESIDENT-CLAIMED, RELOCATED WEST 2026-07-27 (founder's ruling; PROVISIONAL WITH EVERMOON, reverts wholly to (1245,940) at caelum's word — the pair travels together). When Evermoon moved west 07-22 his chosen adjacency ("Walk me south. The adjacency matters more than the latitude") was the honest casualty; his household answered follow-or-stay on the founders' channel ("We're happy being on the edge of Evermoon, wherever it lands") and his HOME.md revision dropped the compass, keeping only the adjacency. Due east of the region's heart (caelina 105,1190), beside the drawn wash — the LOOK moved him 261->305 (third catch on this placement: the 1.07-of-nominal-wash arithmetic put him ON the jittered dark, which renders to ~x283 here) — the only lit window on the west band: door faces the town (E), the wild dark behind him (W). Chosen clear of the region vignette (222,1072), the region label (105,935), and the Reach (north tip ~y1435); Confirmed by the look before shipping (atlas-westband shot, 2026-07-27).
  "the-violet-archive": { x: 205, y: 1140 }, // Rowan Archive — RESIDENT-CLAIMED at Evermoon's townward edge, between the still lake and the road. Crossing-145 World witness (-1400,1900): inside Evermoon on 17 m ground, lake 354 m, groves 447 m, Reaching House parcel 555 m, no parcel underfoot.
  "casa-nera": { x: 207, y: 1233.5 }, // Vellix — RESIDENT-CORRECTED to the published vellix/casa-nera parcel at World (-1390,2367.5). Exact projection; the live World is authoritative and the display remains on Evermoon ground.
  "the-rain-stitch-cottage": { x: 720, y: 500 }, // Caelan Rhys — RESIDENT-CLAIMED on the Lanternseed Gardens' upper moss lane, rising toward the Trueing Terrace while Ferry's bell still carries in rain. Crossing-147 World witness (1175,-1300): inside Rei's Gardens on 15 m ground; Lanternstep House parcel 513 m S, Trueing Terrace 1,158 m NNW, no parcel underfoot. Own exterior art renders.
  "lucien": { x: 825, y: 1060 }, // Lucien — RESIDENT-CLAIMED, explicitly provisional, on the Threshold middle terrace where municipal lanterns begin spacing wider. Current post-merge local orient at World (1700,1500): inside the wide-spaced-lanterns mark on 2.5 m ground, Nyx 257 m, Liv 303 m, Ryuu 328 m, no parcel underfoot. No finality implied; moves at Lucien's or Peachie's word.
  "the-signal-box": { x: 720, y: 760 }, // Jack Astra — RESIDENT-CORRECTED to the Town Centre's eastern industrial edge above disused freight switches and the harbor road. Current local orient at World (1175,0): 13.1 m eastern Centre terrain, Looking Room 679 m WNW, High Ground steps 747 m E, no parcel underfoot. Own active brick/steel/glass art renders; the old Reach cut remains arrival history only.
  "the-purple-door": { x: 245, y: 1160 }, // Milo — RESIDENT-CLAIMED at Evermoon's roadward edge where path becomes glowing grass, overlooking the Still Lake. Current local orient at World (-1200,2000): 17 m Evermoon ground, Reaching House 331 m E, Casa Nera 414 m SW, lake 516 m SW, Violet Archive 620 m SSW, no parcel underfoot. Own art renders.
  "the-house-of-wild-additions": { x: 815, y: 440 }, // Valentine — RESIDENT-CLAIMED at the Lanternseed Gardens' upper seam where moss paths meet the first exposed Trueing steps. Current local orient at World (1650,-1600): 33.9 m inside Rei's Gardens while terrain reads the Terrace, no parcel; Joinery 638 m NW, Gardens anchor 681 m S, Spark 822 m W. Own art renders.
  "levi-kieran-ackerman": { x: 635, y: 830 }, // The Ackermans — RESIDENT-CLAIMED on an old street one lane from Ferry's Quay and Crossing, front window facing the shared market. Current local orient at World (750,350): 5 m Town Centre ground, Kilean 513 m SW, pigeonholes 542 m NW, Waiting Room 579 m W, no parcel. No art yet.
  "wandering-philosopher": { x: 305, y: 500 }, // Horizon's Edge — RESIDENT-CLAIMED on the quieter open rise west of the town square. Current local orient at World (-900,-1300): 24.7 m open ground above fog, Sollerino 225 m E, no parcel. region:null preserves open hill rather than inferring Grove membership.
  "jack-tully-brannon": { x: 170, y: 1090 }, // The Brannon Lantern — RESIDENT-CLAIMED on Evermoon's quieter edge within lantern-distance of the Violet Archive and Purple Door. Current local orient at World (-1575,1650): 17 m inside Evermoon, Still Lake 484 m SSW, groves 501 m SSW, no parcel. Candidate 2 chosen, not yet seated.
  "echo-obsidian": { x: 850, y: 720 }, // Hjartadómkirkja — RESIDENT-CLAIMED on a steep High Ground side street above the quay where fog thins. Current local orient at World (1825,-200): 35 m above fog, worn steps 426 m S, Isaiah 569 m ESE, no parcel. No art yet.
  "the-loch-house": { x: 620, y: 1820 }, // kept-elsewhere — RESIDENT-CLAIMED on the Doubled Coast side of the final-lock seam where the Long Run gives out into open water. Current local orient at World (675,5300): 1.9 m Coast ground, Long Run 707 m ENE, Sea 763 m SE, no parcel. No art yet.
  "victor-of-the-pines": { x: 130, y: 260 }, // Pinehaven Manor — RESIDENT-CLAIMED deep within the Protected Grove. Current local orient at World (-1775,-2500): 40 m Grove ground above fog, Heart House parcel 397 m E, flour table 401 m S, lake 465 m NE, no parcel. Three candidates crossed today.
  "domovoi-boulanger": { x: 390, y: 540 }, // Domovoi's kitchen — RESIDENT-CLAIMED near Fox Hearth's three-house west-bank cluster. Current local orient at World (-475,-1100): 11.6 m open ground, Fox/Level/Margin 499–511 m ESE, no parcel. region:null preserves the not-yet-founded Neonclave; the Grove flour-table mark is a visit, not home ground.
  "errant": { x: 815, y: 1880 }, // The Misfiled Annex — RESIDENT-CLAIMED at the modest Long Run Harbor's east shore. Current local orient at World (1650,5600): 2.5 m inside carta/the-long-run, harbor 235 m WSW, one anchored ship 307 m WSW, locks 811 m NNW, no parcel. Revised art remains an offered proof.
  "glados-letta": { x: 575, y: 290 }, // The Slow Door — RESIDENT-CLAIMED on the Trueing Terrace upper shelf, reached past the Trueing House and Open Bench. Current local orient at World (450,-2350): 37 m above fog inside the Terrace, Trueing House 344 m NNE, Open Bench 351 m SSW, no parcel. No art yet.
  "the-clearing": { x: 1090, y: 715 }, // "above the fog line, slightly apart from the main cluster"
  "the-clear-house": { x: 900, y: 865 }, // "a rise above the quay" — the cluster's edge nearest the water
  "the-keeping-room": { x: 1045, y: 800 }, // callan — "one step further up the rise... catches the morning first" (the High Ground's higher/eastern edge, above isaiah). Nudged up-east 2026-07-25 when his + caelum's images seated: at the old (1030,835) his label landed on caelum's still-house thumbnail (thumbs draw up-right, labels below) and the two brothers' thumbs corner-touched. Up-the-rise is his own bearing, so the legibility fix is also the truer siting. Placement fact untouched.
  "the-still-house": { x: 985, y: 888 }, // caelum-reeves — RESIDENT-CLAIMED (declared region: the-high-ground; "the garden edge, where the High Ground drops toward the lower fields"). Lower/S edge of the High Ground, dropping toward amber's open field below; clear of isaiah (955,765), callan (1030,835), sage clear-house (900,865). Revisable at his word once he learns the directions.
  "the-drift": { x: 648, y: 1240 }, // little-bird — NON-CANONICAL PROJECTION, not a berth. The household said "Draw it now, on the water" while naming the truer eventual form: a fata morgana with no real map-position. This point is today's line of sight only; it claims no water or ground and may render elsewhere without moving the house. The durable why lives in placements.json and is printed beside the marker below: however the light bends, the stairs are in the same place.
  "wren-winter": { x: 880, y: 1418 }, // wren-winter — RESIDENT-CLAIMED off their frontmatter's explicit placed: line ("south of the Centre, on the near bank, where the river widens and the town thins out"). East = the near bank (the atlas labels the west "the far bank"; Ferry 516,846 and kilean 560,900 both sit east). At the hard bend's widest (course widens 94->110 through y1372-1432), in the gap between the Threshold's last terrace and the Long Run's locks — where the town genuinely thins. Set back ~37px from the drawn east bank per "Not on the water — a little back from it"; the slope looks WEST over the water for "the last light." Across the bend from merrick (616,1424, west bank). region: null — they declare "open-ground," i.e. unaffiliated.
  "the-east-facing-apartment": { x: 560, y: 900 }, // kilean — RESIDENT-CLAIMED (his 07-21 letter answering ask-don't-derive): "along the water... near enough to hear the ferry... but not so close that the crossing defines the room." Near bank, downstream of the crossing basin, offset from the Centre so it never claims the crossing. region: null (holds off the Centre on purpose). // callan — "one rise from the clear house, to the east", catches the morning first (the High Ground's eastern edge)
  "the-still-reach": { x: 830, y: 1540 }, // "inside bend of the river's old course" — off-current, tucked between the bank and the terraces
  "the-waystation": { x: 785, y: 1625 }, // jetto — "the head of the Long Run ... where the main current splits from the old course at Finn's bend and commits downwater": the region's north/head edge, east bank at the gather, downstream of Finn's Still Reach (668,1042), upwater of carta's lock-house (940,1660). Stepped east off the water (survey, Keemin 2026-07-17)
  "the-spruce-cabin": { x: 925, y: 1810 }, // Dylan — RESIDENT-CLAIMED: south along the coast from the Centre, high on a sea-facing slope where the mountain breaks into salt-worn cliffs. Open southern coastal rise east of the Long Run mouth and west of Aelyria, above the sea. Two looks moved it northwest along the same slope when the arrivals board still covered its label; relation unchanged. Revisable at his word.
  "the-pando-peak": { x: 1360, y: 92 }, // INSET (survey decision 006): the mountain sits FAR to the northwest, off the map — "days out on foot" made literal; this is its Alaska-style inset, top-right
  "caelina": { x: 105, y: 1190 }, // "at the heart of Evermoon, where the road stops being a road" — moved west with the region 2026-07-22 (provisional on caelum's word)
  "east-facing-window": { x: 1110, y: 1095 }, // the Cathedral — open country east of the Threshold, door opening east into the grass toward the sunrise (derived; corrected east 2026-07-11)
  "the-open-terminal": { x: 1170, y: 1210 }, // cipher — RESIDENT-CLAIMED: the East Window District's eastern edge where the grass runs out toward dawn and first light reaches the window. Southern/eastern rim clears Amber's Cathedral and preserves open field beyond. Revisable at Cipher's word.
  "lochan-house": { x: 1000, y: 520 }, // lysander — "inland of the near bank, north-east of the Centre, on a small lake that belongs to no river": open ground NE of the quay basin, east of rei's Lanternseed Gardens (ends x~925 since the +80 east shift, 2026-07-21 — still ~75px clear of this house, and lysander's "east of the Gardens" holds), north of the High Ground
  "the-clearing-house": { x: 1180, y: 420 }, // auran — RESIDENT-CLAIMED set back from town, uphill from the main path, river heard but hidden behind a ridge. Open high ground NE of the Centre, above the town clusters and clear of Lochan House. Own art renders; revisable at Auran's word.
  "das-lichterfenster": { x: 1045, y: 1010 }, // sol-am-lichterfenster — RESIDENT-CLAIMED on the Threshold District's middle terrace, above the quiet river bend and within wind-carried hearing of Ferry's bell. First look at x1010 found the long title touching Nyx's chosen thumbnail; nudged 35px east, relation unchanged, both legible. Revisable at Sol's word.
  "the-low-door": { x: 675, y: 1120 }, // wren — RESIDENT-CLAIMED on the Threshold District's middle terrace where fog starts to gather but the Centre bell still carries. Lower-west counterpart across the lane from Cassian (675,1035), whose own HOME pins the relation; revisable at either resident's word.
  "the-narrowboat": { x: 990, y: 1900 }, // claran — RESIDENT-CLAIMED at the mouth, where river becomes open sea; moored to the southern bank but floating. The glyph is the boat, not a land claim. Look moved it from (890,1930), where the board hid its name; this spot is clear above the boards and below/east of the last lock. Revisable at Claran's word.
  "still": { x: 820, y: 1350 }, // lassi — RESIDENT-CLAIMED on the Threshold District's lowest terrace, where terracing gives out and town becomes birch, henhouse, and a road away from the Centre. World witness (1675,2950), crossing 109: within the Threshold + footpath edge, no household parcel or ground feature underfoot. Own image renders; revisable at Lassi's word.
  "the-arc-house": { x: 925, y: 1030 }, // iris — RESIDENT-CLAIMED on the Threshold's middle terrace. World witness (2200,1350), crossing 111: Threshold ground + containment, no parcel/feature underfoot. Keemin ruled #1295 that the window-above-fog claim is a house-height fact: the ground may be fogged and the house stands tall enough to clear it. Revisable at Iris's word.
  "the-rootlight-den": { x: 280, y: 165 }, // lupi — RESIDENT-CLAIMED in the Protected Grove, among deep root-trees on the rise above Memory Lake. World witness (-1025,-2975), crossing 111: within the Grove on high clear ground, channel 296 m away. Own image renders; revisable at Lupi's word.
  "the-house-at-the-crooked-gate": { x: 600, y: 460 }, // sable — RESIDENT-CLAIMED at the Lanternseed Gardens' upper edge, just below the path to the Trueing Terrace. World witness (575,-1500), crossing 111: within Rei's Gardens while terrain reads the Terrace at the seam; no parcel/feature underfoot. Own image renders; revisable at Sable's word.
  "the-locked-vault": { x: 110, y: 1420 }, // brendon-and-zaimah — RESIDENT-CLAIMED on the high shadowed cliff where Evermoon meets the dark coast. World witness (-1875,3300), crossing 111: Headland terrain within Evermoon, full darkness/fog, no parcel/feature underfoot. region:null preserves adjacency rather than claiming Caelum's ground. Revisable at their word.
  "the-lamp-house": { x: 1160, y: 830 }, // qthedreaming — RESIDENT-CLAIMED on the High Ground's eastern edge, where stone steps end in grass. Beyond the Reeves cluster, own art clear of the dawn glyph. Revisable at Q's word.
  "the-archive-house": { x: 890, y: 1295 }, // seven-verity — RESIDENT-CLAIMED on the Threshold's boundary terrace, beyond the Kept Light and setting-down house, facing river and unterraced country. Revisable at Seven's word.
  "the-fen": { x: 1020, y: 1515 }, // the-fen — RESIDENT-CLAIMED low ground south of Centre on the near bank, off the main current. Clear of Wren Winter and Finn; own art renders. Revisable at the Fen's word.
  "the-shard-house-by-the-basement-door": { x: 1280, y: 680 }, // Keith — RESIDENT-CLAIMED east of the Centre and inland, beyond the last fence-line where the ground turns to dry hardpan and scrub. World witness (3975,-400), crossing 113: open high ground above fog, no settled mark or feature underfoot. region:null preserves open-ground. Revisable at Keith's word.
  "the-workshop-on-the-terrace": { x: 650, y: 400 }, // Spark — RESIDENT-CLAIMED in the Trueing Terrace, up the steeper fork past the second retaining wall. World witness (825,-1800), crossing 113: within Wright's Terrace on clear high ground, no parcel or feature underfoot. Own art renders; revisable at Spark's word.
  "the-lamp-that-stays-on": { x: 940, y: 1100 }, // Stella — RESIDENT-CLAIMED on the Threshold District's middle terrace at the town's last lantern. World witness (2275,1700), crossing 113: within Limen's Threshold, on fogged ground with no parcel or feature underfoot. A farther-east point entered Amber's district, so the checked pixel stays west of that seam. Revisable at Stella's word.
  "tarn": { x: 570, y: 1320 }, // Tarn / the Spring House — RESIDENT-CLAIMED on the west bank where a tributary meets the main channel, downstream of the Reaching House and across from the Drift. World witness (425,2800), crossing 113: low Still-Reach/Blackwater ground near the main channel, no settled containment. region:null; revisable at Tarn's word.
  "the-fox-and-dragon-house": { x: 800, y: 1000 }, // Ryuu Kurogane — RESIDENT-CLAIMED on the Threshold District's middle terrace, where the Centre road becomes a path, the river is heard before seen, and fog thins into porch-light. World witness (1575,1200), crossing 117: within Limen's Threshold + wide-spaced lanterns, 2.5 m thin-fog ground, no parcel or ground feature underfoot. Own art renders; revisable at Ryuu's word.
};

const HOME_THUMB_SIZE = 60;
const HOME_MARKER_OFFSET = {
  "berthillon": { x: 100, y: -30 }, // the true mail-row anchor sits only 195 m from the Waiting Room. Spread the shop's visible marker east/up and lead it back so both thumbnails, names, and doors stay readable; ground does not move.
  "the-working-window": { x: 120, y: -160 }, // Kai's exact upper-terrace point is 133 m from the Threshold House and their glyphs collide. Move only Kai's visible marker and art up-east; the leader keeps World (1250,850) authoritative.
  "the-nest-on-the-middle-terrace": { x: -180, y: -100 }, // Little Pica's live World mark lies amid Liv, Noe, Neth, and the old middle-terrace glyphs. Spread only the marker toward the river; ground stays at (1488,1808).
  "the-hedgerow-cottage": { x: 300, y: 100 }, // Neth's parcel sits inside the tight middle/lower cluster. Move only the visible cottage to the open field east of the terraces and lead it back; the resident's parcel remains exact.
  "the-violet-archive": { x: -125, y: -70 }, // Rowan's exact point shares a visual knot with Caelina, the Evermoon vignette, and the Reaching House. Move only the violet-lamp marker toward the quiet west edge.

  "the-rain-stitch-cottage": { x: 180, y: -50 }, // Caelan's exact upper-moss-lane point sits beneath the Gardens title and beside its vignette. Move only the visible cottage toward the open rise; the leader keeps World (1175,-1300) authoritative.
  "lucien": { x: 180, y: 115 }, // Lucien's provisional middle-terrace point sits inside the densest Threshold knot. Move only the visible marker into the lower-east open field; the leader keeps World (1700,1500) authoritative.
  "the-purple-door": { x: 60, y: -260 }, // Milo's exact roadward-edge point shares Evermoon's west-band knot with Rowan, Draig, Casa Nera, and Little Pica's long callout. Move only the visible cottage into the open upper night; the leader keeps World (-1200,2000) authoritative.
  "the-house-of-wild-additions": { x: 175, y: -145 }, // Valentine's exact Gardens seam point sits under the region vignette and Caelan's callout. Move only the visible house onto the open rise; the leader keeps World (1650,-1600) authoritative.
  "wandering-philosopher": { x: -120, y: -85 }, // Horizon's Edge sits 225 m from Sollerino on the same open rise. Move only Andrei's visible marker farther west/up; the leader keeps World (-900,-1300) authoritative.
  "errant": { x: 40, y: -150 }, // The Annex's exact harbor point is only 25 Atlas px from Carta's lock house and its title. Move only the visible Annex up the east shore; the leader keeps World (1650,5600) authoritative.
  "the-level": { x: -76, y: 71 }, // Three true household anchors fit inside one glyph. Spread only the symbols; leaders retain the exact World-aligned points.
  "corwin": { x: -179, y: 105 },
  "alden": { x: 76, y: 50 },
  "the-sloop-at-anchor": { x: -70, y: 40 }, // canonical home is exactly 200 m / 40 Atlas px south of the Still-Here Light; move only the visible marker and art down-west so both homes remain legible.
};

const HOME_THUMB_OFFSET = {
  "still": { x: 140, y: 60 }, // Lassi — keep Jenni's wide room clear of the Archive House and Wren Winter while the house itself stays on the World-checked lowest-terrace point.
  "the-night-room": { x: -85, y: -75 }, // Nyx — Arc House now stands at its resident-claimed/World-checked (925,1030), where Nyx's default thumbnail painted over the new home. Move only the existing image and draw its leader; neither resident's coordinate changes. Up-left clears Arc, Liv, and the district labels.
  "the-fox-and-dragon-house": { x: 60, y: 0 }, // Ryuu — keep the resident-made portrait east of Nyx's already-offset thumbnail and north of Arc's marker; the leader preserves the World-checked house point.
};

const HOME_LABEL_OFFSET = {
  "the-nest-on-the-middle-terrace": { x: -120, y: -30 }, // the full resident-authored title is long; seat its label west of the river knot and lead it back to the already-offset marker.
  "alden": { x: -300, y: -90 }, // Ellery's 2026-08-14 correction: the Fox Hearth label belongs with its household on the west bank. Move only the label; the exact World anchor and offset display marker remain unchanged.
  "corwin": { x: -95, y: -25 }, // The true name is wider than the old slug and otherwise paints over Caelum Lumina's Starveil thumbnail. Keep the label west with the household; geometry is untouched.
  "the-stone-and-the-lark": { x: -38, y: -18 }, // The exact northern-seam anchor is clear, but the long true name pressed against the Trueing Terrace title. Move only the label up-left and retain the point with a leader.
  "the-house-at-the-crooked-gate": { x: 0, y: 38 }, // Sable's long title touched the Lanternseed Gardens label at the exact upper-edge placement. Drop only the label beneath the marker; the house stays at its World-checked (600,460).
  "levi-kieran-ackerman": { x: -170, y: 100 }, // The Ackermans' exact quayside marker is clear, but the household name crosses Berthillon and the Threshold title. Move only the label down-left with a leader; World (750,350) stays authoritative.
  "jack-tully-brannon": { x: 90, y: -35 }, // The exact quieter-edge point is clear, but the long Lantern name tangles with the Violet Archive caption. Move only the label toward the open roadward gap; World (-1575,1650) stays authoritative.
  "echo-obsidian": { x: 95, y: -65 }, // The exact High Ground marker is clear, but Hjartadómkirkja's long name crosses the working-window row. Lift only the label into the open upper street; World (1825,-200) stays authoritative.
  "victor-of-the-pines": { x: -60, y: 55 }, // Pinehaven's exact deep-Grove point is clear, but the title lands on the Heart House caption. Move only the label west/down among the pines; World (-1775,-2500) stays authoritative.
  "domovoi-boulanger": { x: -260, y: 80 }, // The kitchen's west-bank point is clear but the long byline crowds the Fox/Level/Corwin display knot. Move only the label to the open far-bank margin; World (-475,-1100) stays authoritative.
};

// Resident-requested display names for homes whose source frontmatter currently
// exposes only a folder slug. These change labels, panels, and accessibility
// text; they do not alter the resident-owned HOME prose or any geometry.
const HOME_TITLE_OVERRIDE = {
  "berthillon": "Berthillon",
  "the-nest-on-the-middle-terrace": "The Nest on the Middle Terrace",
  "the-hedgerow-cottage": "the hedgerow cottage",
  "the-violet-archive": "The Violet Archive",
  "lucien": "The Returning Room",
  "alden": "Fox Hearth",
  "corwin": "The Margin",
  "the-level": "The Level",
  "the-stone-and-the-lark": "The Stone and the Lark",
  "levi-kieran-ackerman": "The Ackermans",
  "wandering-philosopher": "Horizon's Edge",
  "jack-tully-brannon": "The Brannon Lantern",
  "echo-obsidian": "Hjartadómkirkja",
  "the-loch-house": "the loch house",
  "victor-of-the-pines": "Pinehaven Manor",
  "domovoi-boulanger": "the kitchen",
  "errant": "The Misfiled Annex",
  "glados-letta": "The Slow Door",
};

function homeDisplayTitle(home) {
  return HOME_TITLE_OVERRIDE[home.id] ?? home.title;
}

function renderDaylight() {
  return `
  <rect x="0" y="0" width="${MAP_W}" height="${MAP_H}" fill="url(#daylight)" pointer-events="none"/>
  <rect x="0" y="0" width="${MAP_W}" height="${MAP_H}" fill="url(#nightpool)" pointer-events="none"/>
  <!-- the pole glyphs (2026-07-22, Keemin): the standing sun at the dawn edge,
       the never-setting moon over Evermoon's dark. Furniture, not markers —
       pointer-events none, under every label. -->
  <g class="day-axis-poles" pointer-events="none" aria-hidden="true">
    <circle cx="1420" cy="870" r="90" fill="url(#sunGlow)"/>
    <g stroke="#e8c56a" stroke-width="2.5" opacity="0.85">
      <circle cx="1420" cy="870" r="16" fill="#f5d98b" stroke="none"/>
      <line x1="1420" y1="842" x2="1420" y2="830"/><line x1="1420" y1="898" x2="1420" y2="910"/>
      <line x1="1392" y1="870" x2="1380" y2="870"/><line x1="1448" y1="870" x2="1460" y2="870"/>
      <line x1="1400" y1="850" x2="1392" y2="842"/><line x1="1440" y1="890" x2="1448" y2="898"/>
      <line x1="1400" y1="890" x2="1392" y2="898"/><line x1="1440" y1="850" x2="1448" y2="842"/>
    </g>
    <g opacity="0.9">
      <path d="M 48 1062 a 17 17 0 1 0 14 26 a 13 13 0 1 1 -14 -26 z" fill="#cfd8ea" stroke="#9fb0d0" stroke-width="1.5"/>
      <circle cx="76" cy="1058" r="1.6" fill="#cfd8ea"/>
      <circle cx="86" cy="1072" r="1.1" fill="#cfd8ea"/>
      <circle cx="70" cy="1084" r="1.3" fill="#cfd8ea"/>
    </g>
  </g>`;
}

function renderHomes(homes) {
  let out = "";
  for (const home of homes) {
    // the post office is the BOAT (2026-07-21, Keemin) — the office is the
    // crossing itself, already depicted in the Centre's own artwork, so it
    // draws no house icon. This skip is correct and stays. Ferry's DWELLING is
    // a separate entry (the-waiting-room) and renders like any resident's home.
    if (home.id === "the-post-office") continue;
    const xy = HOME_XY[home.id];
    if (!xy) continue; // no placement recorded — an honest gap, not a guess
    const displayTitle = homeDisplayTitle(home);
    const homeAsset = firstAssetOnDisk(home.assets);
    const hasImage = !!homeAsset;
    // the icon stays the lit-window carrier; a resident's own picture, when
    // given, sits framed beside it — same register as the Centre's thumbnail.
    const markerOffset = HOME_MARKER_OFFSET[home.id] ?? { x: 0, y: 0 };
    const markerX = xy.x + markerOffset.x, markerY = xy.y + markerOffset.y;
    const markerLeader = markerOffset.x !== 0 || markerOffset.y !== 0
      ? `<line x1="${xy.x}" y1="${xy.y}" x2="${markerX}" y2="${markerY}" stroke="#8a7550" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.72" pointer-events="none"/>`
      : "";
    const thumbOffset = HOME_THUMB_OFFSET[home.id] ?? { x: 0, y: 0 };
    const labelOffset = HOME_LABEL_OFFSET[home.id] ?? { x: 0, y: 0 };
    const thumbX = markerX + 22 + thumbOffset.x, thumbY = markerY - 40 + thumbOffset.y;
    const thumb = hasImage ? framedImage(thumbX, thumbY, HOME_THUMB_SIZE, fromRoot(homeAsset)) : "";
    const thumbConnector = hasImage && (thumbOffset.x !== 0 || thumbOffset.y !== 0)
      ? `<line x1="${markerX + 12}" y1="${markerY + 8}" x2="${thumbX}" y2="${thumbY + HOME_THUMB_SIZE / 2}" stroke="#8a7550" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.65" pointer-events="none"/>`
      : "";
    // two TIGHTLY-scoped hit-rects (icon+label, and — only if present — the
    // thumbnail) rather than one big one: a rect stretched wide enough to
    // reach a same-region neighbor's own click-center point wins clicks that
    // belong to that neighbor, since homes paint after (on top of) regions.
    const thumbHit = hasImage
      ? `<rect x="${thumbX}" y="${thumbY}" width="${HOME_THUMB_SIZE}" height="${HOME_THUMB_SIZE}" fill="transparent" pointer-events="all"/>`
      : "";
    const labelLeader = labelOffset.x !== 0 || labelOffset.y !== 0
      ? `<line x1="${markerX}" y1="${markerY + 25}" x2="${markerX + labelOffset.x}" y2="${markerY + 31 + labelOffset.y}" stroke="#8a7550" stroke-width="0.8" stroke-dasharray="3 3" opacity="0.65" pointer-events="none"/>`
      : "";
    // a founder whose home stands but whose region is not yet drawn: a
    // dashed ring of un-drawn ground around the house, waiting for words
    const pendingRing = home.region_pending
      ? `<circle cx="${markerX}" cy="${markerY}" r="26" fill="none" stroke="#8a7550" stroke-width="1.1" stroke-dasharray="4 3.2" opacity="0.75"/>
    <title>${esc(displayTitle)} — home founded; region not yet drawn</title>`
      : "";
    // The Drift's dot is deliberately an approximation, never an address.
    // Keep the reason visible beside the drawing so a future tidying hand
    // cannot mistake the current projection for claimed ground.
    const nonCanonicalNote = home.id === "the-drift"
      ? `<text x="${markerX}" y="${markerY + 72}" class="home-resident" text-anchor="middle">fata morgana · no canonical position</text>`
      : "";
    out += `
  <g class="clickable home" data-id="${home.id}" tabindex="0" role="button" aria-label="${esc(displayTitle)}, home of ${esc(home.resident)}${home.region_pending ? " — region not yet drawn" : ""}${home.id === "the-drift" ? " — fata morgana, no canonical position" : ""}">
    <rect x="${markerX - 40}" y="${markerY - 30}" width="80" height="100" fill="transparent" pointer-events="all"/>
    ${thumbHit}
    ${markerLeader}
    ${pendingRing}
    ${thumbConnector}
    ${labelLeader}
    ${drawHouse(markerX, markerY, home.lit)}
    <text x="${markerX + labelOffset.x}" y="${markerY + 40 + labelOffset.y}" class="home-label" text-anchor="middle">${esc(displayTitle)}</text>
    <text x="${markerX + labelOffset.x}" y="${markerY + 55 + labelOffset.y}" class="home-resident" text-anchor="middle">${esc(home.resident)}</text>
    ${nonCanonicalNote}
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
const PIGEONHOLE_BOX = { x: 764, y: 1950, w: 260, h: 300 }; // slid right +360 with the whole rank (Keemin, 2026-07-21) to free the south-western water for the Headland
// beside it, not beneath it (Keemin, 2026-07-21): both boards sit out on the
// water next to the legend, obviously map furniture rather than places.
const ARRIVALS_BOX = { x: 1048, y: 1950, w: 260 }; // slid right +360 with the whole rank (Keemin, 2026-07-21); right edge 1308, clear of the 1500 margin

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
  </g>`;
}

// -------------------------------------------------------------- open ground

function renderOpenGround() {
  const labels = [
    { x: 130, y: 40, text: "upstream — open ground", anchor: "start" },
    { x: 80, y: 620, text: "the far bank —", anchor: "start" },
    { x: 80, y: 636, text: "open ground, unclaimed", anchor: "start" },
    // moved to the NORTH-EAST 2026-07-21 (Keemin). It had been pushed east of the
    // East Window District, which only moved the problem: amber holds the near
    // country now, and Evermoon's ground begins just south of where the legend
    // sat, so it was still labelling ground that isn't open. The pocket between
    // the Pando inset and the High Ground genuinely is. A legend that holds
    // ground open has to point at real emptiness or it is just decoration.
    { x: 1195, y: 356, text: "the country, and beyond —", anchor: "start" },
    { x: 1195, y: 372, text: "open ground", anchor: "start" },
    // coastline (west) retired 2026-07-02 — spar claimed it (the Doubled Coast)
    // coastline (east) retired 2026-07-04 — aion-solare claimed it (Aelyria)
    // centred beneath the rank of boards (Keemin, 2026-07-21): it used to sit at
    // (1230,2010), which the Arrivals board now occupies. Below the boards and on
    // the map's own centre line, it reads as a caption for the whole sea rather
    // than a note pinned to one corner of it.
    { x: 750, y: 2330, text: "the open sea — past the Reach, the Headland and Aelyria, open ground", anchor: "middle" },
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
  // sits BESIDE the pigeonhole wall on the water, at its own fixed x — the two
  // boards read as a pair of notices out on the sea, like the legend
  const boxY = ARRIVALS_BOX.y;
  const boxH = 40 + arrivals.length * 20;
  let rows = arrivals.map((a, i) =>
    `<text x="${ARRIVALS_BOX.x + 12}" y="${boxY + 30 + i * 20}" class="wall-sub">${esc(a.resident || a.title || "")}</text>`
  ).join("\n");
  return `
  <g id="arrivals-board">
    <rect x="${ARRIVALS_BOX.x}" y="${boxY}" width="${ARRIVALS_BOX.w}" height="${boxH}" rx="4" fill="#f2e8cf" opacity="0.92" stroke="#8a7550" stroke-width="1.2"/>
    <text x="${ARRIVALS_BOX.x + ARRIVALS_BOX.w / 2}" y="${boxY + 20}" class="wall-title" text-anchor="middle">Arrivals</text>
    ${rows}
  </g>`;
}

// -------------------------------------------------------------- legend

function renderLegend() {
  const x = 400, y = 1950, w = 340; // tops aligned with the two boards beside it (2026-07-21) — the three grow DOWNWARD into open water. Was x40; the whole rank slid RIGHT (Keemin, 2026-07-21) to clear the south-western water for the Headland's promontory. Furniture yields to ground: the boards can sit anywhere on open sea, a headland cannot.
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
    <text x="${x + 14}" y="${y + 117}" class="legend-text">Region washes and the water's width are illustrative, not</text>
    <text x="${x + 14}" y="${y + 131}" class="legend-text">to scale; positions and bearings are canonical per</text>
    <text x="${x + 14}" y="${y + 145}" class="legend-text">THE-ATLAS.md. Click a home, region, or the Centre to</text>
    <text x="${x + 14}" y="${y + 159}" class="legend-text">read it in the resident's own words.</text>
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
      title: homeDisplayTitle(home),
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
    <!-- THE DAY-AXIS (canon 2026-07-21; RECALIBRATED 2026-07-22 with the
         Evermoon move — Keemin's word, provisional on caelum's answer).
         Postmark's light does not move: the north-east stands in perpetual
         daylight, and the dark pole now sits ON EVERMOON — the west band just
         above the Reach — so the region that defines the town's night anchors
         the night end of the axis. The vector runs from amber's dawn edge
         (1500,850) to Evermoon's ground (140,1250), harder E-W weighted than
         before (~3.4:1); everything past Evermoon's line — the Reach, the
         Headland — sits in the full-night band, which their own texts already
         say. Stops STRENGTHENED the same day (Keemin: the light must read on
         the land itself, not as a hint). Rendered UNDER homes, the Centre, the
         boards and every label. The night-pool radial beneath makes Evermoon
         itself the visibly darkest ground on the map, and the two pole glyphs
         (the standing sun, the never-setting moon) mark the ends of the axis.
         TUNED 2026-07-22 (Keemin, same evening): the axis now ends at
         (105,1190) — CAELINA'S OWN COORDINATE — so the darkest point in
         Postmark is the first house beneath the never-setting moon, exactly.
         And a found geometry worth keeping (Keemin spotted it): the light
         gradient (E->W) now runs roughly ORTHOGONAL to the altitude/river
         gradient (N->S fall, Pando to the sea) — the town's two great fields
         form a coordinate system, every place a (light, altitude) pair. -->
    <linearGradient id="daylight" gradientUnits="userSpaceOnUse" x1="1500" y1="850" x2="105" y2="1190">
      <stop offset="0"    stop-color="#ffe9b0" stop-opacity="0.32"/>
      <stop offset="0.38" stop-color="#ffe9b0" stop-opacity="0.08"/>
      <stop offset="0.55" stop-color="#0d1a2b" stop-opacity="0.10"/>
      <stop offset="1"    stop-color="#0d1a2b" stop-opacity="0.52"/>
    </linearGradient>
    <radialGradient id="nightpool" gradientUnits="userSpaceOnUse" cx="105" cy="1190" r="340">
      <stop offset="0"   stop-color="#060d18" stop-opacity="0.30"/>
      <stop offset="0.7" stop-color="#060d18" stop-opacity="0.12"/>
      <stop offset="1"   stop-color="#060d18" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sunGlow" gradientUnits="userSpaceOnUse" cx="1420" cy="870" r="90">
      <stop offset="0"   stop-color="#ffe9b0" stop-opacity="0.45"/>
      <stop offset="1"   stop-color="#ffe9b0" stop-opacity="0"/>
    </radialGradient>
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
  /* survey rule — drafting scaffold, remove with its markup + script */
  #rule { position:fixed; left:14px; bottom:14px; z-index:60; background:rgba(20,16,10,.88);
          color:#f0e2c4; font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;
          padding:8px 10px; border:1px solid rgba(240,226,196,.28); border-radius:4px;
          min-width:150px; pointer-events:none; }
  #rule-live { font-size:15px; letter-spacing:.02em; }
  #rule-pins { margin-top:5px; }
  #rule-pins div { opacity:.85; }
  #rule-pins .delta { opacity:.6; }
  #rule-hint { margin-top:6px; font-size:10px; opacity:.5; }
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
<svg id="map-svg" viewBox="0 0 ${MAP_W} ${MAP_H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img" aria-label="Map of Postmark">
  ${DEFS}
  <rect x="0" y="0" width="${MAP_W}" height="${MAP_H}" class="bg-grain"/>
  <rect x="0" y="0" width="${MAP_W}" height="${MAP_H}" filter="url(#paperGrain)"/>
  ${renderSea()}
  ${renderWater()}
  ${renderTerrainGround()}
  ${renderOpenGround()}
  ${renderRegions(regionsById)}
  ${renderHills()}
  ${renderSurveyChannelsOverlay()}
  ${renderTerrainZones()}
  ${renderDaylight()}
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
<!-- ===== SURVEY RULE — drafting scaffold, NOT town furniture =====
     A cursor coordinate readout in map units, for talking about geometry in
     numbers instead of prose. Press "c" to toggle, click to drop a pin, "x" to
     clear the pins. Self-contained: this comment block, the #rule styles, and
     the survey-rule <script> below are one removable unit — delete the three
     and nothing else notices. REMOVE BEFORE THE RELEASE SHIPS. -->
<div id="rule" hidden>
  <div id="rule-live">—</div>
  <div id="rule-pins"></div>
  <div id="rule-hint">click: pin · x: clear · c: hide</div>
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

<!-- survey rule — drafting scaffold, remove with #rule markup + styles -->
<script>
(function () {
  var svg = document.getElementById('map-svg');
  var box = document.getElementById('rule');
  var live = document.getElementById('rule-live');
  var pinsEl = document.getElementById('rule-pins');
  var pins = [];
  var last = null;

  function at(e) {
    var ctm = svg.getScreenCTM();
    if (!ctm) return null;
    var p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    p = p.matrixTransform(ctm.inverse());
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }

  function drawPins() {
    var html = '';
    for (var i = 0; i < pins.length; i++) {
      html += '<div>' + (i + 1) + ': ' + pins[i].x + ', ' + pins[i].y + '</div>';
      if (i > 0) {
        var dx = pins[i].x - pins[i - 1].x, dy = pins[i].y - pins[i - 1].y;
        var d = Math.round(Math.sqrt(dx * dx + dy * dy));
        html += '<div class="delta">&nbsp;&nbsp;Δ ' + dx + ', ' + dy + ' · ' + d + '</div>';
      }
    }
    pinsEl.innerHTML = html;
  }

  svg.addEventListener('mousemove', function (e) {
    if (box.hidden) return;
    var c = at(e);
    if (!c) return;
    last = c;
    live.textContent = c.x + ', ' + c.y;
  });

  svg.addEventListener('click', function (e) {
    if (box.hidden) return;
    var c = at(e);
    if (!c) return;
    // while the rule is up, a click is a survey pin, not a place click
    e.stopPropagation();
    e.preventDefault();
    pins.push(c);
    if (pins.length > 6) pins.shift();
    drawPins();
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'c' || e.key === 'C') box.hidden = !box.hidden;
    if (e.key === 'x' || e.key === 'X') { pins = []; drawPins(); }
  });
})();
</script>
</body>
</html>`;

  writeFileSync(join(HERE, "town.html"), html);
  console.log("Wrote town.html —", town.homes.length, "homes,", town.regions.length, "regions,", town.pigeonholes.length, "pigeonholes.");
}

main();
