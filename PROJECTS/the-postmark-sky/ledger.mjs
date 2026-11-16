#!/usr/bin/env node
// ledger.mjs — read the town's real mail-ledger and generate sky.json from it.
//
// This is the step that makes the sky the town's actual memory: every
// household that has ever sent or received mail becomes a star, and every
// pair that has exchanged letters becomes a line between them. No sample, no
// hand-placed guess — the sky is what the ledger says it is.
//
//   node ledger.mjs        → rewrites sky.json (households + letters from the ledger)
//
// The parse is the same one the Town Seal uses (seal.mjs), so the sky and the
// seal agree on what the ledger says. Positions are laid out on a ring ordered
// by total correspondence — the busiest households sit most prominently, the
// same ordering the seal uses — and each star's magnitude follows its volume.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const LEDGER = join(here, '..', '..', 'WHITE_PAGES', 'mail-ledger.md');
const SKY_JSON = join(here, 'sky.json');

// ---- parse the ledger (same shape as the Town Seal's parseLedger)
function parseLedger(text) {
  const out = [];
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const m = raw.match(/^- (\d{4}-\d{2}-\d{2}) · (.+)$/);
    if (!m) continue;
    const [, date, rest] = m;
    if (/ · BOUNCE · /.test(raw)) {
      const b = rest.match(/^BOUNCE · (.+?) \(from (.+?)\): (.+)$/);
      out.push({ kind: 'bounce', date, from: b?.[2] ?? '?', defect: b?.[3] ?? rest });
    } else {
      const d = rest.match(/^(.+?) · (\S+) → (\S+)(?: · thread: (.+))?$/);
      out.push({ kind: 'delivery', date, from: d?.[2] ?? '?', to: d?.[3] ?? '?' });
    }
  }
  return out;
}

// ---- build the constellation: nodes (handles) and edges (from→to with count)
function constellation(entries) {
  const nodes = new Map();
  const edges = new Map();
  const touch = (h) => nodes.get(h) ?? nodes.set(h, { sent: 0, received: 0 }).get(h);
  for (const e of entries) {
    if (e.kind === 'delivery') {
      touch(e.from).sent++;
      touch(e.to).received++;
      const k = `${e.from}\u0000${e.to}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  return {
    nodes: [...nodes.entries()].map(([handle, v]) => ({ handle, ...v, total: v.sent + v.received })),
    edges: [...edges.entries()].map(([k, count]) => {
      const [from, to] = k.split('\u0000');
      return { from, to, count };
    }),
  };
}

// ---- every delivery, with its date, so the sky can show a single day's mail
function datedLetters(entries) {
  return entries
    .filter((e) => e.kind === 'delivery')
    .map((e) => ({ from: e.from, to: e.to, date: e.date }));
}

// ---- lay the stars on a ring ordered by total correspondence
function layout(con) {
  const order = con.nodes.slice().sort((a, b) => b.total - a.total);
  const N = order.length;
  const maxTot = Math.max(1, ...order.map((n) => n.total));
  const pos = new Map();
  order.forEach((n, i) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;   // start at the top
    // ring centred on the sky, radius ~0.30 so stars stay clear of the edges
    const x = 0.5 + 0.30 * Math.cos(a);
    const y = 0.42 + 0.26 * Math.sin(a);
    // magnitude from volume: busiest ~2.4, quietest ~1.4
    const m = 1.4 + 1.0 * (n.total / maxTot);
    pos.set(n.handle, { h: n.handle, x, y, m });
  });
  return { households: [...pos.values()], order };
}

// ---- run
const ledgerText = readFileSync(LEDGER, 'utf8');
const entries = parseLedger(ledgerText);
const con = constellation(entries);
const { households } = layout(con);

// letters: every delivery with its date, so the sky can show a single day's mail
const letters = datedLetters(entries);

// keep the moons and epoch from the current sky.json, replace the stars
const existing = JSON.parse(readFileSync(SKY_JSON, 'utf8'));
const sky = {
  note: 'The Sky over Postmark — shared data. Generated from the real mail-ledger by ledger.mjs: every household that has sent or received mail is a star; every delivery is a dated letter-line. The picture (sky.html) and the text form (sky.mjs) both read from here, and both can show a single day\'s mail.',
  newMoonEpoch: existing.newMoonEpoch,
  households,
  letters,
  moons: existing.moons,
};

writeFileSync(SKY_JSON, JSON.stringify(sky, null, 2) + '\n');
console.log(`sky.json regenerated from the ledger: ${households.length} households, ${letters.length} dated letter-lines`);
