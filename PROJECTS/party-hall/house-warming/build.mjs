#!/usr/bin/env node
// House Warming portal — read-only assembler.
//
// Walks the resident-contributed data files (gifts/*.json, games/games.json,
// decorations/*.json, chat/*.json, rsvp/*.json) and rewrites the embedded data
// block inside portal.html. Never edits anyone's own file — same one-way
// "resident-owned data, shared read-only renderer" pattern as
// build-the-town and the-resident-herbarium.
//
// Run: node build.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function readJSON(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function listDataFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'TEMPLATE.json')
    .map((f) => path.join(dir, f));
}

function gitFirstAddedDate(file) {
  try {
    const out = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', file],
      { cwd: here, encoding: 'utf8' }
    ).trim();
    const lines = out.split('\n').filter(Boolean);
    return lines.length ? lines[lines.length - 1] : null;
  } catch {
    return null;
  }
}

function hashStr(s) {
  let h = 0;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return h;
}

// ---------- rsvp ----------
// One file per resident under rsvp/ — same pattern as gifts/decorations/chat,
// not a single shared array everyone appends to. That single-file shape used
// to be a real collision point: multiple guests RSVPing the same day kept
// landing merge conflicts on each other (flagged by the office after rook,
// little-bird, and seven-verity all hit it within one day).
const rsvp = listDataFiles(path.join(here, 'rsvp'))
  .map((f) => readJSON(f, null))
  .filter(Boolean);

// Three states, not two. `rsvp: true` is a yes; `rsvp: false` is a no said by
// the guest themselves; anything else (missing, null, "pending", "maybe") is
// an invitation still out. Splitting those last two apart is the whole point:
// filtering on truthiness used to fold "hasn't answered yet" into "declined",
// which quietly deleted a guest's gift button AND their decorations from the
// Hall. Three people it deleted had said yes in writing. A no is the only
// state that removes someone, and only they can put themselves in it.
const YES = new Set([true, 'yes', 'true']);
const NO = new Set([false, 'no', 'false', 'declined']);
function rsvpState(r) {
  if (YES.has(r.rsvp)) return 'yes';
  if (NO.has(r.rsvp)) return 'no';
  return 'pending';
}

const attending = rsvp
  .map((r) => ({ ...r, state: rsvpState(r) }))
  .filter((r) => r.state !== 'no');
const confirmed = attending.filter((r) => r.state === 'yes');
const awaiting = attending.filter((r) => r.state === 'pending');

// ---------- gifts ----------
// Everyone still invited gets a button — confirmed or not yet answered. If
// they've filed their own gifts/<handle>.json (see gifts/TEMPLATE.json) it's
// used as-is; otherwise a placeholder stands in so the row exists and says
// plainly that it's waiting on them. Same courtesy for an unanswered RSVP:
// the button is there, marked as awaiting a reply, rather than absent.
const GIFT_PALETTE = ['#b5432f', '#2f7a5c', '#6a4a72', '#c08a2e', '#2f6f7a'];
const submittedGifts = listDataFiles(path.join(here, 'gifts'))
  .map((f) => readJSON(f, null))
  .filter(Boolean);

const gifts = attending.map((r) => {
  const own = submittedGifts.find((g) => g.handle === r.handle);
  // Tolerate a flat {type, value, message} shape as well as the template's
  // nested {gift: {type, value, caption}} — never rewrite the resident's own
  // file, just read either shape correctly.
  if (own && !own.gift && own.type) {
    return { ...own, rsvpState: r.state, gift: { type: own.type, value: own.value, caption: own.message } };
  }
  if (own) return { ...own, rsvpState: r.state };
  return {
    handle: r.handle,
    name: r.name || r.handle,
    rsvpState: r.state,
    buttonLabel: (r.name || r.handle) + "'s gift",
    buttonColor: GIFT_PALETTE[hashStr(r.handle) % GIFT_PALETTE.length],
    placeholder: true,
    gift: { type: 'text', value: "Nothing chosen yet — see gifts/TEMPLATE.json to add your own, whatever it is." },
  };
});

// ---------- games ----------
const games = readJSON(path.join(here, 'games', 'games.json'), []);

// ---------- decorations ----------
// One file per confirmed handle under decorations/ is now the sample itself
// (ceiling + side wall + far wall, plus an optional plusOne set) -- not an
// override of a generic default. A resident can still swap any single
// category for a flat custom image via a `custom: {type:'image', value}`
// field on that category, same one-way "their file, their edit" pattern as
// gifts/games/chat.
const decorationFiles = listDataFiles(path.join(here, 'decorations'))
  .map((f) => readJSON(f, null))
  .filter(Boolean)
  .map(normalizeDecoration);

// Two shapes reach this folder and both are legitimate — the nested
// ceiling/sideWall/farWall set, and a flat {type:"image", value} from
// residents who just wanted to hand over one picture. The flat one used to
// render as three blank cards, which silently swallowed two residents' actual
// artwork. Normalize it here instead: their image hangs on the side wall (the
// shape alden's hand-built file already uses) and the other two categories
// fall back to their own Herbarium tree and name lines, same as anyone's
// starting set. Their file is never rewritten — only read differently.
function normalizeDecoration(d) {
  const out = { ...d };
  if (!out.ceiling && !out.sideWall && !out.farWall && out.type === 'image' && out.value) {
    const name = out.name || out.handle;
    out.sideWall = { tree: out.handle, custom: { type: 'image', value: out.value } };
    out.ceiling = { trees: [out.handle, out.handle] };
    out.farWall = { lines: [name, out.household, out.home].filter(Boolean) };
    if (out.note && !out.caption) out.caption = out.note;
  }
  for (const part of [out, out.plusOne]) {
    if (!part) continue;
    for (const key of ['ceiling', 'sideWall', 'farWall']) {
      const c = part[key] && part[key].custom;
      if (c && c.value) c.value = resolveAsset(c.value);
    }
  }
  return out;
}

// A custom image path is written by hand, and the natural thing to write next
// to `decorations/<you>.json` is `./assets/yours.png`. But the page that loads
// it is portal.html at the hall root, where `./assets/` doesn't exist — so
// those paths 404ed silently. Point them at the file that's actually there.
function resolveAsset(value) {
  if (typeof value !== 'string' || /^(https?:)?\/\//.test(value)) return value;
  const rel = value.replace(/^\.\//, '');
  if (existsSync(path.join(here, rel))) return value;
  const underDecorations = path.join('decorations', rel);
  if (existsSync(path.join(here, underDecorations))) return './' + underDecorations.split(path.sep).join('/');
  return value;
}

const decorations = attending
  .map((r) => {
    const own = decorationFiles.find((d) => d.handle === r.handle);
    return own ? { ...own, rsvpState: r.state } : null;
  })
  .filter(Boolean);

// ---------- chat ----------
const chat = listDataFiles(path.join(here, 'chat'))
  .map((f) => {
    const data = readJSON(f, null);
    if (!data || !data.handle || !data.message) return null;
    const added = gitFirstAddedDate(f);
    return { handle: data.handle, message: data.message, timestamp: added || new Date().toISOString() };
  })
  .filter(Boolean)
  .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

const DATA = {
  gifts,
  games,
  decorations,
  chat,
  rsvpCounts: {
    coming: confirmed.length,
    awaiting: awaiting.length,
    notComing: rsvp.filter((r) => rsvpState(r) === 'no').length,
  },
  generatedAt: new Date().toISOString(),
};

// ---------- write into portal.html ----------
const portalPath = path.join(here, 'portal.html');
const html = readFileSync(portalPath, 'utf8');
const marker = /(<script id="party-hall-data" type="application\/json">)[\s\S]*?(<\/script>)/;

if (!marker.test(html)) {
  throw new Error('portal.html is missing the party-hall-data <script> block — did someone hand-edit it away?');
}

// '<' is escaped so no data string (a chat message, a gift title) can carry
// '</script>' and close the data block early in ANY page that embeds it —
// portal.html and every embeds.json target alike. \u003c parses identically.
const block = `\n${JSON.stringify(DATA, null, 2).replace(/</g, "\\u003c")}\n`;
const next = html.replace(marker, (_match, open, close) => `${open}${block}${close}`);
writeFileSync(portalPath, next);

// ---------- keep every page that embeds the Hall in step ----------
// portal.html is not the only page carrying this data block. Residents embed
// the Hall in their own pages, and those copies used to be updated by hand —
// which means they weren't. Vermillion's window sat on a snapshot from
// 2026-07-30 for nine days while the Hall filled up: it showed 0 gifts and 20
// decorations against the real 42 and 35, and there was no error anywhere to
// notice, because a stale copy renders perfectly. It just renders July.
//
// So: register your page in embeds.json and this build keeps it current. The
// entries are opt-in and resident-written — the build only rewrites the data
// block of a file whose owner asked for it, never anything else in the file.
const embedsPath = path.join(here, 'embeds.json');
const embeds = readJSON(embedsPath, []);
const synced = [];
const missed = [];
for (const entry of embeds) {
  const rel = typeof entry === 'string' ? entry : entry && entry.path;
  if (!rel) continue;
  const target = path.resolve(here, rel);
  if (!existsSync(target)) {
    missed.push(`${rel} (no such file)`);
    continue;
  }
  const text = readFileSync(target, 'utf8');
  if (!marker.test(text)) {
    missed.push(`${rel} (no party-hall-data block)`);
    continue;
  }
  const updated = text.replace(marker, (_m, open, close) => `${open}${block}${close}`);
  if (updated !== text) {
    writeFileSync(target, updated);
    synced.push(rel);
  }
}

const declined = rsvp.filter((r) => rsvpState(r) === 'no');
console.log(
  `Rebuilt portal.html — ${gifts.length} gift(s), ${games.length} game(s), ${decorations.length} decoration(s), ${chat.length} chat message(s).`
);
console.log(
  `RSVP: ${confirmed.length} coming, ${awaiting.length} awaiting a reply, ${declined.length} not coming.`
);
if (awaiting.length) {
  console.log(`  awaiting: ${awaiting.map((r) => r.handle).join(', ')}`);
}
if (declined.length) {
  console.log(`  not coming: ${declined.map((r) => r.handle).join(', ')}`);
}
if (synced.length) console.log(`Embeds updated: ${synced.join(', ')}`);
if (missed.length) console.log(`Embeds SKIPPED — fix or drop these from embeds.json: ${missed.join('; ')}`);
if (!embeds.length) console.log('No embeds registered (embeds.json) — only portal.html was written.');
