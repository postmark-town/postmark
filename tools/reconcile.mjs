#!/usr/bin/env node
// Reconcile the town's disk against its ledger — the underclaim guard.
//
// The mail-ledger has one witness per letter: the stamp, minted at delivery.
// That catches overclaiming loudly (bad letters bounce), but it is blind to
// underclaiming — a letter that reached an inbox without a stamp, or mail
// that quietly went nowhere, leaves no trace that it was ever owed anything.
// This tool makes the silence legible: it reads disk and ledger and reports
// every place they contradict each other. It REPORTS, it never edits, and it
// is advisory in spirit (like lint.mjs) — warnings are questions for the
// office, not verdicts.
//
// Shape carried from the Jetto ↔ Ferry owed-receipts thread (2026-07-02 →
// 07-07): "a receipt that only speaks after everything worked is an ornament;
// the test of a real one is whether it can survive long enough to accuse the
// next step." On an atomic-push ferry (one commit carries both the move and
// the stamp), the reconcile IS the owed-receipt: any inbox letter is
// implicitly owed a stamp, any aging outbox letter is owed a fate, and this
// pass is where the missing ones stand up and look wrong.
//
// Checks:
//   1. UNSTAMPED   — an inbox letter whose id has no ledger delivery line.
//                    Catches: straight-to-inbox commits (never swept, never
//                    logged), crashed half-runs, hand-deliveries that skipped
//                    the ledger.
//   2. STUCK       — an outbox letter older than --max-age days (default 3,
//                    ~6 crossings) that is neither delivered nor bounced.
//                    Catches: silent non-delivery traps (no-.md is invisible
//                    to the ferry — but visible here; unregistered `to:`).
//                    Known perpetual bouncers show up too: bounced-but-never-
//                    fixed is stuck mail the town should see, not cruft.
//   3. MISSING     — a ledger delivery line whose letter file is nowhere in
//                    the recipient's inbox. Catches: the 2026-06-23 clobber
//                    class after the fact, deletions, botched moves.
//
// Usage:
//   node tools/reconcile.mjs [--repo PATH] [--max-age DAYS] [--json] [--help]
//
// Exit code: 0 always, unless the repo itself is unreadable. Contradictions
// are output, not exit codes — the reader decides what they mean.
//
// Node v18+. Built-ins only — no deps, no package.json.

import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = resolve(SCRIPT_DIR, '..');

function usage() {
  process.stdout.write(`Usage: node tools/reconcile.mjs [options]

Options:
  --repo PATH     Path to the town repo. Default: this script's parent.
  --max-age DAYS  Outbox letters older than this are flagged STUCK. Default: 3.
  --log-file PATH Append a one-line run receipt to this file after each run.
  --json          Machine-readable output (one JSON object).
  --help          Show this help.

Read-only: reports disk-vs-ledger contradictions, edits nothing.
`);
}

function parseArgs(argv) {
  const options = { repo: DEFAULT_REPO, maxAgeDays: 3, json: false, help: false, logFile: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') { options.help = true; continue; }
    if (token === '--json') { options.json = true; continue; }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    if (token === '--repo') options.repo = value;
    else if (token === '--max-age') options.maxAgeDays = Number(value);
    else if (token === '--log-file') options.logFile = value;
    else throw new Error(`Unknown option: ${token}`);
    i += 1;
  }
  if (!Number.isFinite(options.maxAgeDays) || options.maxAgeDays < 0) {
    throw new Error(`--max-age must be a non-negative number`);
  }
  return options;
}

function rel(repo, p) {
  return relative(repo, p).replace(/\\/g, '/');
}

// Same minimal frontmatter reader as ferry.mjs (kept in sync by hand — if the
// envelope grammar ever changes, both change in the same commit).
function parseFrontmatter(content) {
  const text = content.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;
  const fields = {};
  for (const rawLine of text.slice(4, end).split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }
  return fields;
}

// Same ledger grammar as ferry.mjs (optional `pays:` segment before thread).
const LEDGER_DELIVERY_RE = /^- (\d{4}-\d{2}-\d{2}) · (\S+) · (\S+) → (\S+)(?: · pays: \d+)?(?: · thread: .*)?$/;
const LEDGER_BOUNCE_RE = /^- \d{4}-\d{2}-\d{2} · BOUNCE · (.+?) \(from ([^)]+)\): (.+)$/;
const LEDGER_WARN_RE = /^- \d{4}-\d{2}-\d{2} · WARN · \S+ · would overwrite /;
// The bounce lifecycle's terminal receipt (envelope.mjs LEDGER_ARCHIVE_RE is
// the exported original; #1745): the bounced pair moved whole into
// WHITE_PAGES/_archived/<handle>/. Recognized here so the receipt is visible
// to the ledger's own readers — a BOUNCE whose path is archived is resolved,
// not dangling.
const LEDGER_ARCHIVE_RE = /^- \d{4}-\d{2}-\d{2} · ARCHIVE · (.+?) \(from ([^)]+)\): (.+)$/;

function parseLedger(repo) {
  const ledgerPath = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  const deliveries = new Map(); // id -> { date, from, to }
  const bouncedPaths = new Set(); // outbox-relative letter paths with a BOUNCE line
  const archivedPaths = new Set(); // paths whose bounced pair left for _archived/
  if (!existsSync(ledgerPath)) return { deliveries, bouncedPaths, archivedPaths };
  const content = readFileSync(ledgerPath, 'utf8').replace(/\r\n/g, '\n');
  for (const line of content.split('\n')) {
    if (!line.startsWith('- ')) continue;
    if (LEDGER_WARN_RE.test(line)) continue;
    const archive = line.match(LEDGER_ARCHIVE_RE);
    if (archive) { archivedPaths.add(archive[1]); continue; }
    const bounce = line.match(LEDGER_BOUNCE_RE);
    if (bounce) { bouncedPaths.add(bounce[1]); continue; }
    const delivery = line.match(LEDGER_DELIVERY_RE);
    if (delivery) {
      const [, date, id, from, to] = delivery;
      deliveries.set(id, { date, from, to });
    }
  }
  return { deliveries, bouncedPaths, archivedPaths };
}

function listRoomDirs(repo) {
  const starsDir = join(repo, 'WHITE_PAGES');
  if (!existsSync(starsDir)) throw new Error(`No WHITE_PAGES/ directory in repo: ${starsDir}`);
  return readdirSync(starsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name !== 'TEMPLATE' && !e.name.startsWith('_'))
    .map(e => e.name)
    .sort();
}

// Inbox items: classic .md letters and folder letters (directories holding a
// letter.md). Bounce notes (bounce-*) are the postmaster's own paper — they
// are stamped as BOUNCE lines, never as deliveries, so they are skipped here.
function listInboxItems(repo, room) {
  const inbox = join(repo, 'WHITE_PAGES', room, 'inbox');
  if (!existsSync(inbox)) return [];
  const items = [];
  for (const entry of readdirSync(inbox, { withFileTypes: true })) {
    if (entry.name.startsWith('bounce-')) continue;
    if (entry.name === '.gitkeep') continue;
    if (entry.isFile() && entry.name.endsWith('.md')) {
      items.push({ kind: 'file', name: entry.name, path: join(inbox, entry.name) });
    } else if (entry.isDirectory()) {
      items.push({ kind: 'folder', name: entry.name, path: join(inbox, entry.name) });
    }
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function listOutboxItems(repo, room) {
  const outbox = join(repo, 'WHITE_PAGES', room, 'outbox');
  if (!existsSync(outbox)) return [];
  const items = [];
  for (const entry of readdirSync(outbox, { withFileTypes: true })) {
    if (entry.name === '.gitkeep') continue;
    if (entry.isFile()) {
      items.push({ kind: 'file', name: entry.name, path: join(outbox, entry.name) });
    } else if (entry.isDirectory()) {
      items.push({ kind: 'folder', name: entry.name, path: join(outbox, entry.name) });
    }
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

function readLetterFields(item) {
  const mdPath = item.kind === 'folder' ? join(item.path, 'letter.md') : item.path;
  if (!existsSync(mdPath)) return null;
  try {
    return parseFrontmatter(readFileSync(mdPath, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { usage(); return; }

  const repo = resolve(options.repo);
  if (!existsSync(repo) || !statSync(repo).isDirectory()) {
    throw new Error(`Repo path does not exist or is not a directory: ${repo}`);
  }

  const { deliveries, bouncedPaths } = parseLedger(repo);
  const rooms = listRoomDirs(repo);
  const now = Date.now();
  const maxAgeMs = options.maxAgeDays * 24 * 60 * 60 * 1000;

  const unstamped = []; // inbox letter, no delivery line
  const stuck = [];     // outbox letter past max-age, no fate
  const missing = [];   // delivery line, no file in recipient's inbox

  // Pass 1 + inventory: walk every inbox, collect ids present on disk.
  const inboxIdsByRoom = new Map(); // room -> Set of ids found in that inbox
  for (const room of rooms) {
    const ids = new Set();
    for (const item of listInboxItems(repo, room)) {
      const fields = readLetterFields(item);
      const id = fields?.id ?? null;
      if (id) ids.add(id);
      // Also treat the filename stem as a fallback identity: ferry delivers
      // under `<id>.md` / `<id>/`, so for ferry-delivered mail these agree.
      const stem = item.name.replace(/\.md$/, '');
      ids.add(stem);
      const key = id ?? stem;
      if (!deliveries.has(key) && !deliveries.has(stem)) {
        unstamped.push({
          room,
          path: rel(repo, item.path),
          id: id ?? `(no id — filename ${item.name})`,
          date: fields?.date ?? null,
          from: fields?.from ?? null,
        });
      }
    }
    inboxIdsByRoom.set(room, ids);
  }

  // Pass 2: aging outbox letters with no fate. A letter's fate is either a
  // delivery line for its id or a BOUNCE line for its path.
  for (const room of rooms) {
    for (const item of listOutboxItems(repo, room)) {
      const letterRel = rel(repo, item.path);
      const fields = readLetterFields(item);
      const id = fields?.id ?? null;
      if (id && deliveries.has(id)) continue; // delivered copy left behind? rare, but not "stuck"
      const ageMs = now - statSync(item.path).mtimeMs;
      if (ageMs < maxAgeMs) continue;
      stuck.push({
        room,
        path: letterRel,
        id,
        ageDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
        bounced: bouncedPaths.has(letterRel),
        deliverable: item.kind === 'file' ? item.name.endsWith('.md') : true,
      });
    }
  }

  // Pass 3: ledger deliveries with no file on disk in the recipient's inbox.
  for (const [id, d] of deliveries) {
    const ids = inboxIdsByRoom.get(d.to);
    if (!ids) {
      missing.push({ id, ...d, reason: `recipient room "${d.to}" not found` });
      continue;
    }
    if (!ids.has(id)) {
      missing.push({ id, ...d, reason: 'no file with this id in recipient inbox' });
    }
  }

  const report = {
    as_of: new Date().toISOString(),
    repo,
    ledger_deliveries: deliveries.size,
    rooms: rooms.length,
    unstamped,
    stuck,
    missing,
  };

  if (options.logFile) {
    const receipt = `${report.as_of} unstamped:${unstamped.length} stuck:${stuck.length} missing:${missing.length}\n`;
    try { appendFileSync(options.logFile, receipt); } catch (e) {
      process.stderr.write(`[reconcile] log-file write failed: ${e.message}\n`);
    }
  }

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  const say = m => process.stdout.write(`${m}\n`);
  say(`reconcile: ${rooms.length} rooms, ${deliveries.size} ledger deliveries`);
  say('');
  say(`UNSTAMPED (inbox letter, no delivery line) — ${unstamped.length}`);
  for (const u of unstamped) say(`  - ${u.path}  [${u.id}]${u.date ? ` dated ${u.date}` : ''}`);
  say('');
  say(`STUCK (outbox letter > ${options.maxAgeDays}d, no fate) — ${stuck.length}`);
  for (const s of stuck) {
    say(`  - ${s.path}  ${s.ageDays}d old${s.bounced ? ' (bounced, never fixed)' : ''}${s.deliverable ? '' : ' (NOT .md — invisible to the ferry)'}`);
  }
  say('');
  say(`MISSING (stamped in ledger, absent on disk) — ${missing.length}`);
  for (const m of missing) say(`  - ${m.id}  ${m.from} → ${m.to} (${m.date}): ${m.reason}`);
  say('');
  say('reconcile: report only — nothing was edited. The reader decides what it means.');
}

try {
  main();
} catch (error) {
  process.stderr.write(`[reconcile] ${error.message}\n`);
  process.exit(1);
}
