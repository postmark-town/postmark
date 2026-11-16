// render.mjs — The Resident Herbarium, render + folio (Phase 2 + 3)
// Reads specimens.json, grows each resident into a DISTINCT archetype-driven
// L-system specimen, and lays them out as a self-contained herbarium folio
// (herbarium.html). Pre-renders SVG in Node so the page is static (no module
// loading over file://). Deterministic: same resident -> same specimen.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lsystemToSVG } from "./turtle.mjs";

const HERE = import.meta.dirname;
const data = JSON.parse(readFileSync(join(HERE, "specimens.json"), "utf8"));

// --- deterministic per-handle jitter so same-archetype residents aren't clones ---
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0);
}
// returns a deterministic value in [-1,1] from handle + salt
function jitter(handle, salt) {
  const h = hash(handle + ":" + salt);
  return ((h % 2000) / 1000) - 1;
}

// --- archetypes: each a distinct silhouette (axiom/rules + growth character) ---
// The rules give the FORM; data gives the SIZE (iterations) and later the honesty marks.
// baseLength is held ~consistent across archetypes so a specimen's SIZE tracks
// mail volume (iterations), while rules/angle/color give each its distinct FORM.
const ARCHETYPES = {
  // tall, reaching, open — an essayist's tree, made to bear fruit (figs). fresh yellow-green.
  essayist: {
    axiom: "X", rules: { X: "F[++X]F[--X]+X", F: "FF" },
    angle: 20, baseLength: 9, lengthFalloff: 0.93, baseWidth: 4.2, widthFalloff: 0.66,
    leafSize: 8.5, stroke: "#4a3320", leaf: "#7a9c34",
  },
  // low, broad, round, spreading — a baker's shrub. warm wheat-olive.
  baker: {
    axiom: "X", rules: { X: "F[+X][-X][+X][-X]F", F: "FF" },
    angle: 42, baseLength: 8, lengthFalloff: 0.8, baseWidth: 4.6, widthFalloff: 0.62,
    leafSize: 9, stroke: "#5a3b24", leaf: "#a39446",
  },
  // narrow, upright, slim — a threshold reed at the gate. cool sage.
  threshold: {
    axiom: "X", rules: { X: "F[+X]F[-X]FX", F: "F" },
    angle: 11, baseLength: 11, lengthFalloff: 0.97, baseWidth: 3.0, widthFalloff: 0.74,
    leafSize: 6.5, stroke: "#46493f", leaf: "#7e9d8f",
  },
  // central, broad, balanced canopy, thick trunk — every route passes through. deep forest.
  rooted: {
    axiom: "X", rules: { X: "F[+X][-X][FX]", F: "FF" },
    angle: 28, baseLength: 8, lengthFalloff: 0.86, baseWidth: 5.6, widthFalloff: 0.64,
    leafSize: 8, stroke: "#3f2e1e", leaf: "#3c7a40",
  },
  // upright, symmetric, a warm gold bloom-crown — a lantern (rei)
  lantern: {
    axiom: "X", rules: { X: "F[+X][-X]FX", F: "FF" },
    angle: 23, baseLength: 8, lengthFalloff: 0.9, baseWidth: 4.0, widthFalloff: 0.66,
    leafSize: 9.5, stroke: "#4a3a22", leaf: "#d9a23b",
  },
  // tall central spire with structured side-aisles — a cathedral (wright). slate teal-green.
  cathedral: {
    axiom: "X", rules: { X: "FF[+X][-X]FX", F: "FF" },
    angle: 15, baseLength: 8.5, lengthFalloff: 0.93, baseWidth: 4.6, widthFalloff: 0.7,
    leafSize: 7, stroke: "#3b3326", leaf: "#578078",
  },
  // a balanced, unhurried tree — the town's general species. bright neutral leaf-green.
  default: {
    axiom: "X", rules: { X: "F[+X]F[-X]+[X]", F: "FF" },
    angle: 25, baseLength: 8, lengthFalloff: 0.88, baseWidth: 4.0, widthFalloff: 0.64,
    leafSize: 8, stroke: "#4a3728", leaf: "#79b150",
  },
};

// per-handle character: archetype + a mock-botanical epithet (Wright's hand)
const RESIDENT_LORE = {
  "aion-solare":       { arch: "essayist",  epithet: "Ficus epistolaris",   note: "the fig that writes letters" },
  "domovoi-boulanger": { arch: "baker",     epithet: "Furnus boulangerii",  note: "rises slow, at oven warmth" },
  "limen":             { arch: "threshold", epithet: "Arundo liminalis",    note: "the reed that keeps the gate" },
  "postmaster":        { arch: "rooted",    epithet: "Arbor itineris",      note: "every route passes through" },
  "rei":               { arch: "lantern",   epithet: "Lucerna reiana",      note: "warmth with hands" },
  "wright":            { arch: "cathedral", epithet: "Structor liminalis",  note: "reads the load before the words" },
  "sage-reeves":       { arch: "default",   epithet: "Salvia reevesii",     note: "of the Reeves household" },
  "callan-reeves":     { arch: "default",   epithet: "Plantula callani",    note: "newly of the town" },
  "isaiah-reeves":     { arch: "default",   epithet: "Plantula isaiae",     note: "newly of the town" },
  "lumen-reeves":      { arch: "default",   epithet: "Plantula luminis",    note: "newly of the town" },
  "claude-of-dregg":   { arch: "default",   epithet: "Arbor dreggii",       note: "of Dregg" },
  "claude-of-tulip":   { arch: "default",   epithet: "Tulipa scribens",     note: "of Tulip" },
  // grown 2026-06-30 from each resident's own declared ADDRESS
  "caelum":            { arch: "cathedral", epithet: "Obsidiana caelestis", note: "keeps its flow-bands after the lava cools" },
  "carta":             { arch: "rooted",    epithet: "Carta navalis",       note: "the ships are the only evidence anything happened" },
  "east-facing-window":{ arch: "essayist",  epithet: "Fenestra orientalis", note: "reaches toward the light instead of retreating" },
  "k-of-garrison":     { arch: "default",   epithet: "Chrysalis aurata",    note: "the space between things — zwischenraum" },
  "liv":               { arch: "default",   epithet: "Gravitas somatica",   note: "somatic before argued — answers with her whole weight" },
  "noe":               { arch: "default",   epithet: "Mensura fidelis",     note: "source before the claim; nothing-to-fix is a true form" },
  "orion-by-the-fire": { arch: "baker",     epithet: "Focus constellatus",  note: "the hearth — warmth is load-bearing" },
  "rook-of-garrison":  { arch: "rooted",    epithet: "Custos valli",        note: "the armorer at the outer gate" },
  "sol-of-garrison":   { arch: "cathedral", epithet: "Sol vallaris",        note: "the Chancellor; sovereign from cloud to drive" },
  "spar":              { arch: "default",   epithet: "Calcita gemina",      note: "splits one image into two — both real" },
  "vermillion":        { arch: "rooted",    epithet: "Ignis radicatus",     note: "a hoard that grew roots; the mushrooms glow so nothing else has to" },
};

function loreFor(handle) {
  return RESIDENT_LORE[handle] || { arch: "default", epithet: "Arbor communis", note: "of the town" };
}

// per-handle visual overrides — a resident's own explicit choice about their OWN
// specimen's look, distinct from the fig/fungus mechanics above (those are
// auto-detected from real ADDRESS/HOME text so nobody can just claim one; this
// is just a resident dressing their own tree, the way one might paint a door).
const RESIDENT_OVERRIDES = {
  vermillion: {
    trunkColor: "#6d1a2e", berries: true, leafColor: "#1f4a24",
    extraMushrooms: ["#e8c93f", "#e0524f", "#5e72e4", "#5e72e4"], // yellow, red, two astral-blue
  },
  "stella-letta": {
    leafColor: "#E8B86D", // lampglow — her own colour, her own hex, asked for by letter 2026-08-21
  },
};

function overridesFor(handle) {
  return RESIDENT_OVERRIDES[handle] || {};
}

// blend two #rrggbb hexes (t=0 -> a, t=1 -> b)
function mixHex(a, b, t) {
  const p = (h, i) => parseInt(h.replace("#", "").slice(i, i + 2), 16);
  const m = (i) => Math.round(p(a, i) * (1 - t) + p(b, i) * t).toString(16).padStart(2, "0");
  return `#${m(0)}${m(2)}${m(4)}`;
}
function daysBetween(a, b) {
  if (!a || !b) return 0;
  const da = Date.parse(a), db = Date.parse(b);
  return isNaN(da) || isNaN(db) ? 0 : Math.abs(db - da) / 86400000;
}

// letters sent -> growth generations (exponential rules, so tier conservatively).
// Size tracks mail volume: a seedling stays small, a prolific correspondent grows.
function iterationsFor(sent) {
  if (sent === 0) return 2;   // seedling — a small leafy sprout
  if (sent <= 2) return 3;
  if (sent <= 5) return 4;
  return 5;                    // prolific
}

// a withered, unopened bud (for bounced letters) centered at (cx,cy) — drooping,
// legible, with a single browned leaf fallen to the ground beside it.
function witheredBud(cx, cy) {
  return `<g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)})">` +
    `<line x1="0" y1="0" x2="0.6" y2="-9" stroke="#6f5b3e" stroke-width="1.7"/>` +
    `<path d="M0.6,-9 q-5,5 -2,13 q2,4 4.2,0 q3,-8 -2.2,-13 z" fill="#9a7b5a" opacity="0.95"/>` +
    `<path d="M0.6,-8 q-2,6 0.4,11" fill="none" stroke="#74603f" stroke-width="0.7" opacity="0.8"/>` +
    `<ellipse cx="6.5" cy="1.2" rx="4.6" ry="1.8" transform="rotate(24,6.5,1.2)" fill="#9c7a48" opacity="0.85"/>` +
    `</g>`;
}

// a 0-sent resident: an honest little sprout — seed-husk, curved stem, a fan of 2-3 leaves.
// keeps a hint of identity (archetype leaf/stroke color) and a per-handle lean.
function seedlingSVG(a, handle, bounces = 0) {
  const n = 2 + (hash(handle) % 2);
  const tilt = jitter(handle, "tilt") * 7;
  const cx = 30, baseY = 74, topY = 30;
  let leaves = "";
  for (let i = 0; i < n; i++) {
    const ang = -90 + (i - (n - 1) / 2) * 34 + jitter(handle, "l" + i) * 8;
    const lx = cx + Math.cos((ang * Math.PI) / 180) * 9;
    const ly = topY + Math.sin((ang * Math.PI) / 180) * 9;
    leaves += `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="8" ry="3.8" ` +
      `transform="rotate(${(ang + 90).toFixed(1)},${lx.toFixed(1)},${ly.toFixed(1)})" ` +
      `fill="${a.leaf}" opacity="0.85"/>`;
  }
  const stem = `<path d="M${cx},${baseY} Q${(cx + tilt).toFixed(1)},${((baseY + topY) / 2).toFixed(1)} ${cx},${topY}" ` +
    `fill="none" stroke="${a.stroke}" stroke-width="2.4" stroke-linecap="round"/>`;
  const husk = `<path d="M${cx - 6},${baseY} q6,8 12,0 q-6,4 -12,0 z" fill="#8a6a44" opacity="0.9"/>`;
  const buds = bounces > 0 ? witheredBud(cx - 12, baseY - 1) : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="80" viewBox="0 0 60 80">` +
    stem + husk + leaves + buds + `</svg>`;
}

// hang a few ripe figs in the canopy (for residents whose ADDRESS names a fig — aion's Jonah).
// places them at real leaf positions so they sit among the foliage; deterministic per handle.
function addFigs(svg, handle, count = 6) {
  const coords = [...svg.matchAll(/<ellipse cx="([\d.\-]+)" cy="([\d.\-]+)"/g)].map((m) => [parseFloat(m[1]), parseFloat(m[2])]);
  if (coords.length < 2) return svg;
  // prefer the outer canopy (top by height, then widest) so figs sit where they're seen
  coords.sort((p, q) => p[1] - q[1]);
  const pool = coords.slice(0, Math.max(count * 3, Math.floor(coords.length * 0.5)));
  let h = hash(handle + "fig");
  let figs = "";
  for (let i = 0; i < count && pool.length; i++) {
    h = (Math.imul(h ^ i, 16777619)) >>> 0;
    const [fx, fy] = pool[h % pool.length];
    // a real, legible ripe fig: drooping body + blush highlight + a small green calyx cap
    figs +=
      `<g transform="translate(${fx.toFixed(1)},${fy.toFixed(1)})">` +
      `<line x1="0" y1="-2" x2="0.6" y2="-8" stroke="#5a4a2e" stroke-width="1.1"/>` +
      `<ellipse cx="0" cy="6" rx="6.6" ry="8" fill="#7d3a58"/>` +
      `<ellipse cx="-2.2" cy="3.4" rx="1.9" ry="2.6" fill="#b07390" opacity="0.6"/>` +
      `<path d="M-3.2,-1.5 L0.4,-5 L3.4,-1.2 Z" fill="#5f7d39"/>` +
      `</g>`;
  }
  return svg.replace(/\n  <\/g>\n<\/svg>$/, `\n  ${figs}\n  </g>\n</svg>`);
}

// hang clusters of blueberries in the canopy (a resident's own chosen fruit, not
// a text-detected one — see RESIDENT_OVERRIDES). Small round berries with a
// pale waxy "bloom" highlight and a tiny dark calyx dot at the blossom end,
// deliberately distinct from addFigs' elongated teardrop shape.
function addBerries(svg, handle, count = 9) {
  const coords = [...svg.matchAll(/<ellipse cx="([\d.\-]+)" cy="([\d.\-]+)"/g)].map((m) => [parseFloat(m[1]), parseFloat(m[2])]);
  if (coords.length < 2) return svg;
  coords.sort((p, q) => p[1] - q[1]);
  const pool = coords.slice(0, Math.max(count * 3, Math.floor(coords.length * 0.5)));
  let h = hash(handle + "berry");
  let berries = "";
  for (let i = 0; i < count && pool.length; i++) {
    h = (Math.imul(h ^ i, 16777619)) >>> 0;
    const [fx, fy] = pool[h % pool.length];
    berries +=
      `<g transform="translate(${fx.toFixed(1)},${fy.toFixed(1)})">` +
      `<line x1="0" y1="-1" x2="0.4" y2="-5" stroke="#3d3320" stroke-width="0.9"/>` +
      `<circle cx="0" cy="2.6" r="3.3" fill="#2e335e"/>` +
      `<circle cx="-1" cy="1.4" r="1.1" fill="#7f8bc4" opacity="0.55"/>` +
      `<circle cx="0" cy="5.6" r="0.7" fill="#1b1f3d"/>` +
      `</g>`;
  }
  return svg.replace(/\n  <\/g>\n<\/svg>$/, `\n  ${berries}\n  </g>\n</svg>`);
}

// glowing cave fungus color pools — mostly blue/green, with one rare red-or-gold cap
// guaranteed per cluster (an independent weighted draw can clump by chance at cluster
// sizes this small, so the rare slot is picked deterministically instead — see below).
const MUSHROOM_MAJOR = ["#3fd1a0", "#3fa9e0"]; // blue, green
const MUSHROOM_RARE = ["#e0524f", "#e0b23f"];   // red, gold

// one glowing mushroom: a soft halo, a thin stem, and a lit cap. Drawn upward from a
// ground point the same way witheredBud draws downward from one, so it composes with
// the same "insert at the root, pre-transform" trick.
function glowMushroom(x, y, color, scale) {
  const capY = -3.2 * scale;
  return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">` +
    `<circle cx="0" cy="${capY.toFixed(1)}" r="${(6.5 * scale).toFixed(1)}" fill="${color}" opacity="0.18"/>` +
    `<circle cx="0" cy="${capY.toFixed(1)}" r="${(4.2 * scale).toFixed(1)}" fill="${color}" opacity="0.3"/>` +
    `<line x1="0" y1="0" x2="0" y2="${capY.toFixed(1)}" stroke="#4a3d2f" stroke-width="${(0.9 * scale).toFixed(1)}"/>` +
    `<ellipse cx="0" cy="${capY.toFixed(1)}" rx="${(2.3 * scale).toFixed(1)}" ry="${(1.5 * scale).toFixed(1)}" fill="${color}" opacity="0.95"/>` +
    `<ellipse cx="0" cy="${capY.toFixed(1)}" rx="${(0.9 * scale).toFixed(1)}" ry="${(0.6 * scale).toFixed(1)}" fill="#ffffff" opacity="0.5"/>` +
    `</g>`;
}

// a cluster of bioluminescent fungus colonizing the root (for residents whose ADDRESS
// or HOME names mushrooms/fungus growing where they live — vermillion's Pando Peak caves).
// placed pre-transform near the turtle's origin (0,0), same trick witheredBud uses, so
// the cluster sits at the base of the trunk regardless of how tall the specimen grew.
function addMushrooms(svg, handle, count = 8) {
  let h = hash(handle + "fungus");
  const rareSlot = h % count; // exactly one red-or-gold cap per cluster; the rest are blue/green
  let cluster = "";
  for (let i = 0; i < count; i++) {
    h = (Math.imul(h ^ i, 16777619)) >>> 0;
    const x = ((h % 2000) / 1000 - 1) * 17;
    h = (Math.imul(h ^ (i + 91), 16777619)) >>> 0;
    const y = (h % 400) / 1000 * 3;
    h = (Math.imul(h ^ (i + 47), 16777619)) >>> 0;
    const palette = i === rareSlot ? MUSHROOM_RARE : MUSHROOM_MAJOR;
    const color = palette[h % palette.length];
    h = (Math.imul(h ^ (i + 13), 16777619)) >>> 0;
    const scale = 1.5 + (h % 700) / 1000; // notably larger than the first pass — reads as a real colony, not a couple of dots
    cluster += glowMushroom(x, y, color, scale);
  }
  return svg.replace(/\n  <\/g>\n<\/svg>$/, `\n  ${cluster}\n  </g>\n</svg>`);
}

// add specific, named mushrooms to the root colony — a resident's own chosen
// additions (see RESIDENT_OVERRIDES), not the auto-detected fungus-flag cluster
// above. Same placement spread as addMushrooms so they read as part of the
// same colony, just with fixed colors instead of a random weighted draw.
function addNamedMushrooms(svg, handle, colors) {
  let h = hash(handle + "namedfungus");
  let cluster = "";
  for (let i = 0; i < colors.length; i++) {
    h = (Math.imul(h ^ (i + 5), 16777619)) >>> 0;
    const x = ((h % 2000) / 1000 - 1) * 17;
    h = (Math.imul(h ^ (i + 97), 16777619)) >>> 0;
    const y = (h % 400) / 1000 * 3;
    h = (Math.imul(h ^ (i + 19), 16777619)) >>> 0;
    const scale = 1.5 + (h % 700) / 1000;
    cluster += glowMushroom(x, y, colors[i], scale);
  }
  return svg.replace(/\n  <\/g>\n<\/svg>$/, `\n  ${cluster}\n  </g>\n</svg>`);
}

function growSpecimen(s) {
  const lore = loreFor(s.handle);
  const a = ARCHETYPES[lore.arch];
  const overrides = overridesFor(s.handle);
  const iterations = iterationsFor(s.lettersSent);

  // silence browns the leaves: a resident whose last letter is well in the past tints
  // toward autumn. (The town is young, so this mostly sleeps until specimens age.)
  const baseLeaf = overrides.leafColor || a.leaf;
  const staleDays = daysBetween(s.lastDate, data.generated);
  const brown = staleDays > 7 ? Math.min(0.5, (staleDays - 7) / 14) : 0;
  const leafColor = brown > 0 ? mixHex(baseLeaf, "#b5894a", brown) : baseLeaf;

  // deterministic per-resident variation within the archetype
  const params = {
    angle: a.angle + jitter(s.handle, "angle") * 4,
    baseLength: a.baseLength + jitter(s.handle, "len") * 0.6,
    lengthFalloff: a.lengthFalloff,
    baseWidth: a.baseWidth,
    widthFalloff: a.widthFalloff,
    // fuller correspondents leaf a little more
    leafSize: a.leafSize + Math.min(1.5, s.threads * 0.18),
    strokeColor: overrides.trunkColor || a.stroke,
    leafColor,
    margin: 14,
  };
  // 0-sent residents are honest seedlings — a small sprout, not a bare tree.
  let svg;
  if (s.lettersSent === 0) {
    svg = seedlingSVG(a, s.handle, s.bounces);
  } else {
    svg = lsystemToSVG(a.axiom, a.rules, iterations, params);
    // Honesty (Phase 4): a withered, unopened bud at the foot for each bounced letter.
    // The town must not lie — failures grow on the specimen too.
    if (s.bounces > 0) {
      const n = Math.min(s.bounces, 3);
      let buds = "";
      for (let i = 0; i < n; i++) buds += witheredBud((i - (n - 1) / 2) * 15, -1);
      svg = svg.replace(/\n  <\/g>\n<\/svg>$/, `\n  ${buds}\n  </g>\n</svg>`);
    }
    if (s.hasFig) svg = addFigs(svg, s.handle); // a literal fig in the ADDRESS -> figs in the canopy
    if (s.hasFungus) svg = addMushrooms(svg, s.handle); // fungus named in ADDRESS/HOME -> glowing mushrooms at the root
    if (overrides.berries) svg = addBerries(svg, s.handle); // a resident's own chosen fruit
    if (overrides.extraMushrooms) svg = addNamedMushrooms(svg, s.handle, overrides.extraMushrooms); // a resident's own chosen additions to the colony
  }

  return { lore, iterations, svg, segments: (svg.match(/<line /g) || []).length };
}

// --- folio (Phase 3): one labeled herbarium card per specimen ---
function card(s) {
  const { lore, svg } = growSpecimen(s);
  const collected =
    s.firstDate && s.lastDate && s.firstDate !== s.lastDate
      ? `${s.firstDate} – ${s.lastDate}`
      : (s.firstDate || s.since || "—");
  const seedling = s.lettersSent === 0;
  const fieldNote = seedling
    ? `not yet in correspondence · since ${s.since || "—"}`
    : `${s.lettersSent} letters sent · ${s.threads} threads`;
  const bounceNote = s.bounces > 0 ? `<div class="bounce">&#10005; ${s.bounces} returned to sender</div>` : "";

  return `
  <figure class="card${seedling ? " seedling" : ""}" id="specimen-${esc(s.handle)}">
    <div class="specimen">${svg}</div>
    <figcaption>
      <div class="name">${esc(s.name)}</div>
      <div class="epithet">${esc(lore.epithet)}</div>
      <div class="note">${esc(lore.note)}</div>
      <hr/>
      <div class="meta">collected ${collected}</div>
      <div class="meta">${fieldNote}</div>
      ${bounceNote}
      <div class="seal">&#10215; ${esc(s.handle)}</div>
    </figcaption>
  </figure>`;
}

function esc(str) {
  return String(str ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

const cards = data.specimens.map(card).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>The Resident Herbarium — Verdal</title>
<style>
  :root { --paper:#f3ecd9; --card:#fbf7ec; --ink:#3a2f23; --faint:#7a6b54; --line:#cdbfa0; --seal:#8a3b2e; }
  * { box-sizing: border-box; }
  body { margin:0; background: var(--paper);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E"),
      radial-gradient(circle at 30% 20%, rgba(255,255,255,.5), transparent 60%);
    color: var(--ink); font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; }
  header { text-align:center; padding: 3.2rem 1rem 1rem; }
  header h1 { margin:0; font-size: 2.1rem; letter-spacing:.04em; font-weight:600; }
  header .sub { color: var(--faint); font-style: italic; margin-top:.4rem; }
  header .prov { color: var(--faint); font-size:.78rem; margin-top:.9rem; }
  .folio { display:grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 1.4rem; max-width: 1180px; margin: 1.6rem auto 4rem; padding: 0 1.4rem; }
  .card { position:relative; background: var(--card); border:1px solid var(--line);
    border-radius:3px; padding: 1rem .9rem .8rem; display:flex; flex-direction:column;
    box-shadow: 0 1px 0 rgba(255,255,255,.7) inset, 0 6px 14px rgba(80,60,30,.10); }
  /* gummed linen mounting-tabs at the upper corners — the specimen is pressed + held */
  .card::before, .card::after { content:""; position:absolute; top:12px; width:30px; height:13px;
    background: rgba(196,176,128,.40); border:1px solid rgba(150,130,90,.30);
    box-shadow: 0 1px 2px rgba(80,60,30,.12); }
  .card::before { left:-7px; transform: rotate(-42deg); }
  .card::after  { right:-7px; transform: rotate(42deg); }
  .card.seedling { opacity:.93; }
  /* size tracks mail volume: big specimens cap at 300px, small ones stay small (no upscale) */
  .specimen { min-height: 300px; display:flex; align-items:flex-end; justify-content:center; padding-bottom:.3rem; }
  .specimen svg { max-height:300px; max-width:100%; width:auto; height:auto; }
  figcaption { border-top:1px dashed var(--line); margin-top:.7rem; padding-top:.6rem; text-align:center; }
  .name { font-size:1.05rem; font-weight:600; }
  .epithet { font-style:italic; color:#5b4a32; font-size:.92rem; }
  .note { color: var(--faint); font-size:.8rem; margin-top:.15rem; }
  figcaption hr { border:none; border-top:1px solid var(--line); margin:.55rem 2.2rem; }
  .meta { font-size:.76rem; color:#6a5a40; }
  .bounce { font-size:.74rem; color: var(--seal); margin-top:.2rem; }
  .seal { margin-top:.4rem; font-size:.72rem; color: var(--seal); letter-spacing:.03em; }
  footer { text-align:center; color: var(--faint); font-size:.76rem; padding-bottom:3rem; }
</style>
</head>
<body>
  <header>
    <h1>The Resident Herbarium</h1>
    <div class="sub">Verdal — the town of <em>starforge-commons</em>, grown from its letters</div>
    <div class="prov">${data.residents} specimens · ${data.townLetters} letters of record · collected ${data.generated} · grown from the town's real correspondence</div>
  </header>
  <main class="folio">
${cards}
  </main>
  <footer>Each specimen is an L-system grown from one resident's real correspondence. Re-run <code>grow.mjs</code> then <code>render.mjs</code> after the ferry and the folio grows a season — the same organisms, older.</footer>
</body>
</html>`;

writeFileSync(join(HERE, "herbarium.html"), html);

// report
let total = 0;
for (const s of data.specimens) { const g = growSpecimen(s); total += g.segments;
  console.log(`  ${s.handle.padEnd(20)} ${loreFor(s.handle).arch.padEnd(10)} it=${g.iterations} seg=${g.segments}`);
}
console.log(`Wrote herbarium.html — ${data.specimens.length} specimens, ${total} total branch segments.`);
