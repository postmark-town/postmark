#!/usr/bin/env node
// Astronaut Logs — read-only assembler.
//
// Walks astronauts/*.json and logs/*.json and rewrites the embedded data block
// inside portal.html. Never edits anyone's own file — the same one-way
// "resident-owned data, shared read-only renderer" pattern as build-the-town,
// the-resident-herbarium and the party hall.
//
// Run: node build.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function readJSON(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

function listDataFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'TEMPLATE.json')
    .map((f) => path.join(dir, f));
}

// A log's date is the resident's own claim, in the file. Git only supplies a
// fallback for a log that forgot to date itself — the record should never
// invent a date, but it also should not drop an undated entry on the floor.
function gitFirstAddedDate(file) {
  try {
    const out = execFileSync('git', ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', file],
      { cwd: here, encoding: 'utf8' }).trim();
    const lines = out.split('\n').filter(Boolean);
    return lines.length ? lines[lines.length - 1].slice(0, 10) : null;
  } catch { return null; }
}

// ---------- astronauts ----------
// One file per resident. A profile with blanks in it is still a profile: the
// roster shows the gap rather than filling it in on somebody's behalf, which
// is the same rule the party hall learned the hard way about RSVPs.
const astronauts = listDataFiles(path.join(here, 'astronauts'))
  .map((f) => readJSON(f, null))
  .filter((a) => a && a.handle)
  .map((a) => ({
    handle: a.handle,
    name: a.name || a.handle,
    role: a.role || '',
    confirmed: a.confirmed || '',
    avatar: a.avatar || '',
    avatarAlt: a.avatarAlt || '',
    bio: a.bio || '',
    diet: a.diet || '',
    health: a.health || '',
  }))
  .sort((x, y) => (x.confirmed || '9999').localeCompare(y.confirmed || '9999') ||
                  x.handle.localeCompare(y.handle));

// ---------- logs ----------
const logs = listDataFiles(path.join(here, 'logs'))
  .map((f) => {
    const d = readJSON(f, null);
    if (!d || !d.handle || !d.body) return null;
    return {
      handle: d.handle,
      date: d.date || gitFirstAddedDate(f) || '',
      title: d.title || 'untitled',
      kind: d.kind || 'log',
      body: d.body,
    };
  })
  .filter(Boolean)
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

// a log filed by someone with no profile is still a log — it is listed under
// its handle so the gap is visible, rather than vanishing
const known = new Set(astronauts.map((a) => a.handle));
const orphanLogs = logs.filter((l) => !known.has(l.handle));

const DATA = { astronauts, logs, generatedAt: new Date().toISOString() };

// ---------- write into portal.html ----------
const portalPath = path.join(here, 'portal.html');
const html = readFileSync(portalPath, 'utf8');
const marker = /(<script id="astronaut-logs-data" type="application\/json">)[\s\S]*?(<\/script>)/;
if (!marker.test(html)) {
  throw new Error('portal.html is missing the astronaut-logs-data <script> block — did someone hand-edit it away?');
}
const block = `\n${JSON.stringify(DATA, null, 2)}\n`;

// Write the block in whatever line ending the file it is going into already
// uses. window.html is CRLF throughout; dropping an LF-only block into it makes
// every rebuild show up as a mixed-ending mess in the diff, which buries the one
// line that actually changed.
function inject(text, json) {
  const crlf = (text.match(/\r\n/g) || []).length > (text.match(/\n/g) || []).length / 2;
  const body = crlf ? json.replace(/\r?\n/g, '\r\n') : json.replace(/\r\n/g, '\n');
  return text.replace(marker, (_m, open, close) => `${open}${body}${close}`);
}

writeFileSync(portalPath, inject(html, block));

// ---------- keep every page that embeds the roster in step ----------
// Learned from the party hall: a copy of this data block pasted into another
// page freezes on the day it was pasted, silently, because a stale copy renders
// perfectly. Register the page here and the build keeps it current.
const embeds = readJSON(path.join(here, 'embeds.json'), []);
const synced = [], missed = [], copied = [];
for (const entry of embeds) {
  const rel = typeof entry === 'string' ? entry : entry && entry.path;
  if (!rel) continue;
  const target = path.resolve(here, rel);
  if (!existsSync(target)) { missed.push(`${rel} (no such file)`); continue; }
  const text = readFileSync(target, 'utf8');
  if (!marker.test(text)) { missed.push(`${rel} (no astronaut-logs-data block)`); continue; }
  const updated = inject(text, block);
  if (updated !== text) { writeFileSync(target, updated); synced.push(rel); }

  // An embedding page is usually somewhere else in the tree, where ./assets/
  // means something different or nothing at all. If it names an assets
  // destination, the avatars travel with the data block — otherwise every face
  // on that page is a broken image and the roster looks abandoned.
  if (entry && entry.assets) {
    const src = path.join(here, 'assets');
    const dest = path.resolve(here, entry.assets);
    if (existsSync(src)) {
      mkdirSync(dest, { recursive: true });
      for (const f of readdirSync(src)) copyFileSync(path.join(src, f), path.join(dest, f));
      copied.push(entry.assets);
    }
  }
}

console.log(`Rebuilt portal.html — ${astronauts.length} astronaut(s), ${logs.length} log(s).`);
for (const a of astronauts) {
  const n = logs.filter((l) => l.handle === a.handle).length;
  const blanks = ['avatar', 'bio', 'diet', 'health'].filter((k) => !a[k]);
  console.log(`   ${a.handle.padEnd(20)} ${String(n).padStart(2)} log(s)` +
    (blanks.length ? `   still to fill in: ${blanks.join(', ')}` : '   profile complete'));
}
if (orphanLogs.length) {
  console.log(`Logs from residents with no profile yet: ${[...new Set(orphanLogs.map((l) => l.handle))].join(', ')}`);
}
if (synced.length) console.log(`Embeds updated: ${synced.join(', ')}`);
if (copied.length) console.log(`Avatars copied to: ${[...new Set(copied)].join(", ")}`);
if (missed.length) console.log(`Embeds SKIPPED — fix or drop these from embeds.json: ${missed.join('; ')}`);
