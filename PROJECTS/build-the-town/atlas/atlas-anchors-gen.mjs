#!/usr/bin/env node
// atlas-anchors-gen.mjs — DERIVE the atlas's home anchors from the world record.
//
// GENERATED, NEVER HAND-TYPED. This tool writes two files that are derived
// inputs to the renderer, in exactly the sense town.json is a derived output of
// town-atlas.mjs:
//
//   atlas-anchors.json          the ground — one atlas pixel per home, projected
//                               from that home's world parcel. Regenerate it;
//                               never edit it.
//   atlas-display-offsets.json  the painting's own layer — leaders, legibility
//                               nudges, accumulated drift. SEEDED once by this
//                               tool (--seed-offsets) so that flipping the
//                               renderer's input moves nothing, and hand-tended
//                               thereafter. This file IS a pen; the anchors file
//                               is not.
//
// The arrow this inverts. Until now the world derived itself FROM the atlas:
// tools/seed-manifest-gen.mjs in the world repo regex-extracts HOME_XY out of
// render-town.mjs and converts at 5 m/px. This tool runs that projection
// BACKWARDS — world metres to atlas pixels — so the world's marks tree becomes
// the store of geography and the atlas becomes a render of it. Both directions
// share one constant (K = 5 m/px) and one origin (CENTRE_XY, Ferry's crossing),
// and this file reads that origin out of the renderer rather than restating it,
// for the same reason the world's extractor does: a second copy of an origin is
// a second origin.
//
//   node atlas-anchors-gen.mjs                      # anchors only
//   node atlas-anchors-gen.mjs --seed-offsets       # anchors + seed the offsets
//   node atlas-anchors-gen.mjs --world <path> --atlas <dir> --json
//
// It exits non-zero on a shape change it cannot read. It never guesses a join:
// an atlas home it cannot bind to a world parcel is REPORTED and left to
// HOME_XY, which is what the renderer falls back to.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const argOf = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const has = (flag) => process.argv.includes(flag);

const ATLAS = resolve(argOf("--atlas", HERE));
const WORLD = resolve(argOf("--world", "G:/Postmark/postmark-world/WORLD/world-state.json"));
const OUT_ANCHORS = resolve(argOf("--out", join(ATLAS, "atlas-anchors.json")));
const OUT_OFFSETS = resolve(argOf("--offsets-out", join(ATLAS, "atlas-display-offsets.json")));
const SEED_OFFSETS = has("--seed-offsets");
const JSON_OUT = has("--json");

const K = 5; // m per atlas px (RULED 2026-07-17) — the same constant the world's
             // seed-manifest-gen.mjs converts by, read in the other direction.

// ── extraction: the renderer's own constants, read as text, never copied ─────
// Same pattern (and same refusal) as the world's tools/seed-manifest-gen.mjs:36.
const RT = join(ATLAS, "render-town.mjs");
if (!existsSync(RT)) {
  console.error(`atlas-anchors-gen: no render-town.mjs at ${RT} — wrong --atlas?`);
  process.exit(2);
}
const rtSrc = readFileSync(RT, "utf8");
function extractObjMultiline(name) {
  const m = rtSrc.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`));
  if (!m) throw new Error(`extraction failed: const ${name} not found in render-town.mjs — the renderer changed shape; fix the extractor, do not guess`);
  return new Function("return " + m[1])();
}
function extractObjInline(name) {
  const m = rtSrc.match(new RegExp(`const ${name} = (\\{[^;]*\\});`));
  if (!m) throw new Error(`extraction failed: const ${name} not found in render-town.mjs — the renderer changed shape; fix the extractor, do not guess`);
  return new Function("return " + m[1])();
}
const HOME_XY = extractObjMultiline("HOME_XY");
const ORIGIN = extractObjInline("CENTRE_XY"); // Ferry's crossing — the grid origin

// ── the display-only anchors: pixels that are a drawing convention, not ground ─
// Promoted here from a comment in the world's seeder (seed-manifest-gen.mjs:62)
// to first-class data, which is what the machinery map asks for (§4.2: "that
// list must survive the flip as first-class data, not as a comment in a
// seeder"). A home named here KEEPS its hand-authored HOME_XY pixel in both
// modes and is never given a derived anchor, however good the world join looks.
const DISPLAY_ONLY = {
  "the-post-office": "the post office is the BOAT (Keemin, 2026-07-21) — the office is the crossing itself, not a building on a bank. The renderer already draws no house icon for it (render-town.mjs:1220).",
  "the-pando-peak": "the HOME_XY anchor is the INSET (survey decision 006, the Alaska-style box), a drawing convention rather than geography. Decision 008 puts Pando ~135 km NW of the crossing; the world mark is at (-95458,-95458). Projecting either number draws the mountain in the wrong place — the pixel is not the ground and the ground is not on the map.",
  "the-drift": "little-bird's household claims that NO position is canonical — 'the visible marker is a first approximation, not a berth' (render-town.mjs:1086, placements.json). A derived coordinate would convert a declared non-position into an address.",
  "storm-of-the-porch": "the Porch has no canonical position by the resident's own claim — it appears wherever a visitor needs the open door (Wright #2189, applying the Drift/#322 precedent). Intentionally absent from HOME_XY.",
};

// ── the world record ─────────────────────────────────────────────────────────
if (!existsSync(WORLD)) {
  console.error(`atlas-anchors-gen: no world-state at ${WORLD} — pass --world <path to world-state.json>`);
  process.exit(2);
}
const world = JSON.parse(readFileSync(WORLD, "utf8"));
const marks = world.marks;
if (!Array.isArray(marks) || !marks.length) {
  throw new Error(`${WORLD} carries no marks[] — that is not a world-state fold; refusing to derive an empty atlas`);
}
// `at` on a folded mark is WORLD coordinates whatever frame the files were
// written in — the loader composes the frame chain before it emits (the world's
// tools/marks-fold.mjs:299, "Every record comes back in WORLD coordinates").
// This tool consumes the fold, so it must NOT re-walk placementParent; doing so
// would subtract each container's origin a second time.
const byId = new Map(marks.map((m) => [m.id, m]));
const parcels = marks.filter((m) => m.kind === "parcel");

// ── the join ────────────────────────────────────────────────────────────────
// Priority 1 — the `slot: home` predicate. This is the binding the census asks
// for and the only machine-readable one: its `value` IS the atlas home id and
// its container is the parcel that holds the ground. Nothing is inferred.
// Priority 2 — an exact parcel-id match, `<household>/<atlas-id>-parcel` or
// `<household>/<atlas-id>`. A slug equality, still not a guess.
// Anything else is REPORTED unjoined and keeps its hand-authored pixel.
//
// There is deliberately NO third rule of the form "the household owns exactly
// one parcel, so that parcel is the home". It looks safe and it is not: six
// atlas homes are keyed by handle rather than home-id, and for one of them —
// domovoi-boulanger — the household's single parcel is `the-flour-table`, which
// the atlas states outright is NOT the dwelling ("the Grove flour-table mark is
// a visit, not home ground", render-town.mjs). `tier:` cannot separate the two
// cases: all 87 parcels in the fold are `tier: home`, so the flour-table is
// filed exactly like Alden's fox hearth. A cardinality-of-one rule would
// therefore have produced one known-wrong join out of six and moved a resident's
// house 2 km on the strength of it. Those six are reported instead, as the
// worklist they actually are: what the world is missing is the `slot: home`
// predicate, which is the census's own step 1.
const joins = new Map();   // atlas id -> { parcel, via }
const homePreds = marks.filter((m) => m.kind === "predicated" && m.slot === "home");
for (const p of homePreds) {
  const atlasId = p.value;
  if (typeof atlasId !== "string" || !atlasId) continue;
  const parcel = byId.get(p.placementParent);
  if (!parcel || parcel.kind !== "parcel") continue;
  if (!joins.has(atlasId)) joins.set(atlasId, { parcel, via: `slot:home predicate ${p.id}` });
}
for (const id of Object.keys(HOME_XY)) {
  if (joins.has(id)) continue;
  const hits = parcels.filter((p) => {
    const slug = p.id.split("/").slice(1).join("/");
    return slug === `${id}-parcel` || slug === id;
  });
  if (hits.length === 1) joins.set(id, { parcel: hits[0], via: `parcel id ${hits[0].id}` });
  else if (hits.length > 1) joins.set(id, { ambiguous: hits.map((h) => h.id) });
}

// The near-miss class: the atlas id names a HOUSEHOLD that owns parcels, but
// nothing binds one of them to this home. Named, never joined.
const householdParcels = new Map();
for (const p of parcels) {
  const hh = p.household ?? p.by ?? p.id.split("/")[0];
  if (!householdParcels.has(hh)) householdParcels.set(hh, []);
  householdParcels.get(hh).push(p);
}

// ── project ─────────────────────────────────────────────────────────────────
// The inverse of the world's seeder: px = world_m / K + ORIGIN.
// Rounded to 3dp so the file is byte-stable across runs (float tails are not
// geography, and a file that differs every run cannot gate anything).
const r3 = (n) => Math.round(n * 1000) / 1000;
const toPx = (at) => ({ x: r3(at.x / K + ORIGIN.x), y: r3(at.y / K + ORIGIN.y) });

const anchors = {};
const provenance = {};
const unjoined = [];
const displayOnly = [];
const ambiguous = [];

const noteUnjoined = (id, why) => {
  const cands = householdParcels.get(id) ?? [];
  unjoined.push({
    id,
    atlas_px: HOME_XY[id],
    ...(why ? { why } : {}),
    class: cands.length ? "needs-slot-home-predicate" : "no-world-parcel",
    ...(cands.length ? {
      candidate_parcels: cands.map((p) => ({ id: p.id, world_m: { x: p.at?.x ?? null, y: p.at?.y ?? null } })),
      note: "NOT joined. The household owns parcel(s) but no `slot: home` predicate names this atlas id, and `tier:` cannot tell a dwelling from a visit (every parcel in the fold is tier:home). Write the predicate in the world and this home derives on the next run.",
    } : {}),
  });
};

for (const id of Object.keys(HOME_XY)) {
  if (DISPLAY_ONLY[id]) { displayOnly.push({ id, why: DISPLAY_ONLY[id] }); continue; }
  const j = joins.get(id);
  if (!j) { noteUnjoined(id); continue; }
  if (j.ambiguous) { ambiguous.push({ id, candidates: j.ambiguous }); continue; }
  const at = j.parcel.at;
  if (!at || typeof at.x !== "number" || typeof at.y !== "number") {
    noteUnjoined(id, `world parcel ${j.parcel.id} carries no numeric at:`);
    continue;
  }
  anchors[id] = toPx(at);
  provenance[id] = { world_parcel: j.parcel.id, world_m: { x: at.x, y: at.y }, via: j.via };
}

// World homes the atlas has never drawn. Not an error and not silently added:
// the renderer's home SET comes from town.json, not from this file, so these
// cannot appear on the map by accident. Named so the gap is visible.
const worldOnly = [];
for (const [atlasId, j] of joins) {
  if (j.ambiguous) continue;
  if (!(atlasId in HOME_XY) && !DISPLAY_ONLY[atlasId]) worldOnly.push({ id: atlasId, world_parcel: j.parcel.id });
}

const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

const anchorsDoc = {
  _generated: "GENERATED by atlas-anchors-gen.mjs — never hand-edit. Regenerate: node atlas-anchors-gen.mjs",
  _what: "The GROUND. One atlas pixel per home, projected from that home's world parcel at px = world_m / 5 + CENTRE_XY. The world's marks tree is the store; this is a render of it. Legibility lives in atlas-display-offsets.json, never here.",
  generated_by: "atlas-anchors-gen.mjs",
  world_source: WORLD.replace(/\\/g, "/"),
  world_tick: world.tick ?? null,
  projection: { m_per_px: K, origin_px: { x: ORIGIN.x, y: ORIGIN.y }, formula: "px = world_m / m_per_px + origin_px" },
  counts: {
    atlas_homes: Object.keys(HOME_XY).length,
    derived: Object.keys(anchors).length,
    display_only: displayOnly.length,
    unjoined: unjoined.length,
    unjoined_needs_slot_home_predicate: unjoined.filter((u) => u.class === "needs-slot-home-predicate").length,
    unjoined_no_world_parcel: unjoined.filter((u) => u.class === "no-world-parcel").length,
    ambiguous: ambiguous.length,
    world_only: worldOnly.length,
  },
  anchors: sortKeys(anchors),
  provenance: sortKeys(provenance),
  display_only: displayOnly.sort((a, b) => a.id.localeCompare(b.id)),
  unjoined: unjoined.sort((a, b) => a.id.localeCompare(b.id)),
  ambiguous: ambiguous.sort((a, b) => a.id.localeCompare(b.id)),
  world_only: worldOnly.sort((a, b) => a.id.localeCompare(b.id)),
};

writeFileSync(OUT_ANCHORS, JSON.stringify(anchorsDoc, null, 2) + "\n");

// ── the seeded display layer ────────────────────────────────────────────────
// offset = HOME_XY - derived, so that anchor + offset lands exactly on today's
// hand-authored pixel and the flip moves nothing. Every non-zero entry is a
// statement that the painting and the ground disagree by that much, which is
// the drift table the report carries.
let offsetsDoc = null;
const drift = [];
for (const id of Object.keys(anchors)) {
  const d = { x: r3(HOME_XY[id].x - anchors[id].x), y: r3(HOME_XY[id].y - anchors[id].y) };
  const px = Math.hypot(d.x, d.y);
  drift.push({ id, offset: d, px: r3(px), m: r3(px * K) });
}
drift.sort((a, b) => b.px - a.px);

if (SEED_OFFSETS) {
  const seeded = {};
  for (const { id, offset } of drift) if (offset.x !== 0 || offset.y !== 0) seeded[id] = offset;
  offsetsDoc = {
    _seeded: `SEEDED ${new Date().toISOString().slice(0, 10)} by atlas-anchors-gen.mjs --seed-offsets, then hand-tended. Unlike atlas-anchors.json this file IS a pen: regenerating it would erase every legibility decision made since the seed.`,
    _what: "The PAINTING's own layer. offset = the hand-authored HOME_XY pixel minus the world-derived anchor, captured at the flip so that drawn = anchor + offset reproduces today's map exactly. Thereafter it holds leaders and legibility nudges — the 'may say less, never other' allowance. A large offset is a statement that the painting and the ground disagree, and is a question for the Illuminator, not a fact.",
    _units: "atlas px (5 m each)",
    seeded_from: { world_source: WORLD.replace(/\\/g, "/"), world_tick: world.tick ?? null, atlas: "render-town.mjs HOME_XY" },
    offsets: sortKeys(seeded),
  };
  writeFileSync(OUT_OFFSETS, JSON.stringify(offsetsDoc, null, 2) + "\n");
}

// ── report ──────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({ counts: anchorsDoc.counts, drift, unjoined, ambiguous, worldOnly }, null, 2));
} else {
  console.log(`atlas source: ${ATLAS}`);
  console.log(`world source: ${WORLD}${world.tick != null ? ` (tick ${world.tick})` : ""}`);
  console.log(`extracted: ${Object.keys(HOME_XY).length} home anchors, origin (${ORIGIN.x},${ORIGIN.y}), ${K} m/px`);
  console.log(`joined: ${Object.keys(anchors).length} derived · ${displayOnly.length} display-only · ${unjoined.length} unjoined · ${ambiguous.length} ambiguous · ${worldOnly.length} world-only`);
  console.log(`wrote ${OUT_ANCHORS}`);
  if (SEED_OFFSETS) console.log(`wrote ${OUT_OFFSETS} (${Object.keys(offsetsDoc.offsets).length} non-zero offsets)`);
  const over = drift.filter((d) => d.px > 4);
  console.log(`\ndrift over 4 px (20 m) — ${over.length} of ${drift.length} derived:`);
  for (const d of over) console.log(`  ${d.id.padEnd(38)} ${String(d.m).padStart(9)} m   offset (${d.offset.x}, ${d.offset.y}) px`);
  const needsPred = unjoined.filter((u) => u.class === "needs-slot-home-predicate");
  const noParcel = unjoined.filter((u) => u.class === "no-world-parcel");
  if (needsPred.length) {
    console.log(`\nUNJOINED, fixable in the world — ${needsPred.length} home(s) whose household owns a parcel that nothing binds to the atlas id.`);
    console.log(`  Write a 'slot: home' predicate under the parcel and these derive on the next run. NOT guessed here: tier: cannot`);
    console.log(`  tell a dwelling from a visit (domovoi-boulanger's only parcel is the flour-table, which the atlas calls a visit).`);
    for (const u of needsPred) console.log(`  ${u.id.padEnd(28)} candidate: ${u.candidate_parcels.map((c) => c.id).join(", ")}`);
  }
  if (noParcel.length) {
    console.log(`\nUNJOINED, absent from the world — ${noParcel.length} home(s) with no parcel at all; these keep their hand-authored pixel:`);
    for (const u of noParcel) console.log(`  ${u.id}${u.why ? ` — ${u.why}` : ""}`);
  }
  if (ambiguous.length) {
    console.log(`\nAMBIGUOUS — more than one candidate parcel, so no join was made:`);
    for (const a of ambiguous) console.log(`  ${a.id} -> ${a.candidates.join(", ")}`);
  }
  if (worldOnly.length) {
    console.log(`\nWORLD-ONLY — a world home with no atlas anchor (not drawn; the home set comes from town.json):`);
    for (const w of worldOnly) console.log(`  ${w.id} (${w.world_parcel})`);
  }
}
