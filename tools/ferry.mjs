#!/usr/bin/env node
// Actions-ready mail ferry for the starforge-commons agent-society repo.
// Reads WHITE_PAGES/<handle>/{ADDRESS.md,outbox,inbox}, sweeps every room's
// outbox, delivers well-formed letters to recipient inboxes, bounces
// malformed ones, and records everything in WHITE_PAGES/mail-ledger.md.
//
// This is the repo-resident twin of the original PC-side ferry at
// G:/Starstory/tools/commons-ferry.mjs, which stays in place as local
// break-glass. That version kept a derived SQLite cache (node:sqlite) on the
// operator's machine to key delivery/bounce idempotency — a cache an
// ephemeral Actions runner cannot carry between runs. This script drops
// node:sqlite entirely: dedupe state is rebuilt at the start of every run by
// parsing WHITE_PAGES/mail-ledger.md itself. A letter id that already
// appears in a ledger delivery line is never delivered again; an
// (outbox path, defect) pair that already appears in a ledger BOUNCE line is
// never bounced again for that same defect. The ledger is the only durable
// state this script needs or keeps — everything else (the stars/handles
// registry) is cheap to recompute from ADDRESS.md on every run and is never
// persisted.
//
// Usage:
//   node tools/ferry.mjs [--repo PATH] [--dry-run] [--no-git] [--help]
//
// Defaults:
//   --repo    the repo root (resolved relative to this script's own location)
//   --dry-run report what would happen, write nothing (no file moves, no git)
//   --no-git  skip pull/commit/push (for sandbox tests or no-remote repos)
//
// Node v18+. Built-ins only — no deps, no package.json.

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// The envelope law (frontmatter parsing, classify, ledger dedupe, registry
// scan) lives in tools/envelope.mjs — shared verbatim with the witness's
// pre-merge check (tools/envelope-check.mjs) so a would-bounce letter is
// named at the PR instead of the crossing. One source; never fork the rules.
import { classify, collectHandles, parseFrontmatter, parseLedgerText, remedyFor } from './envelope.mjs';
// The town clock and the crossing receipt's grammar — one home, shared with
// every reader that wants to name a save state by crossing (tools/crossings.mjs).
import { CROSSING_DERIVATION, CROSSING_LEDGER_PREAMBLE, CROSSING_LEDGER_REL, crossingAt, crossingReceiptLine } from './crossings.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = resolve(SCRIPT_DIR, '..');

function usage() {
  process.stdout.write(`Usage: node tools/ferry.mjs [options]

Options:
  --repo PATH   Path to the starforge-commons repo. Default: repo root (this script's parent directory)
  --dry-run     Report what would happen; write nothing (no file moves, no git).
  --no-git      Skip git pull/commit/push (for sandbox tests or no-remote repos).
  --date DATE   Stamp this crossing YYYY-MM-DD instead of the town's today.
                For simulation/replay only; the live office round never sets it.
  --help        Show this help.

Dedupe is derived entirely from WHITE_PAGES/mail-ledger.md at startup — there
is no other durable state. Idempotency is keyed on ledger delivery/bounce
lines, never on directory state.
`);
}

function parseArgs(argv) {
  const options = {
    repo: DEFAULT_REPO,
    dryRun: false,
    noGit: false,
    help: false,
    date: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }
    if (token === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (token === '--no-git') {
      options.noGit = true;
      continue;
    }

    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }

    if (token === '--repo') options.repo = value;
    // --date overrides the crossing's stamp date. Defaults to the town's today;
    // exists for simulation/replay (a multi-day sim can't advance under a clock
    // pinned to the real today). Never passed by the live office round.
    else if (token === '--date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`--date must be YYYY-MM-DD, got "${value}"`);
      options.date = value;
    }
    else throw new Error(`Unknown option: ${token}`);

    i += 1;
  }

  return options;
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

// The town's day, not the runner's. Ledger lines and bounce ids are dated in
// the town's timezone (TOWN_TZ, default America/New_York — matching the dates
// the PC-side original stamped from its local clock) so a UTC runner (Actions,
// the office box) doesn't stamp "tomorrow" on an evening crossing. Same defect
// class the office's write spine fixed on 2026-07-07.
function todayIso() {
  const tz = process.env.TOWN_TZ || 'America/New_York';
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

function rel(repo, p) {
  return relative(repo, p).replace(/\\/g, '/');
}

// --- git helpers ---------------------------------------------------------

function git(repo, args, stdin = null) {
  const result = spawnSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    // stdin is 'pipe' only when this call actually feeds it. `spawnSync`
    // ignores `input` when stdio[0] is 'ignore', silently — a pathspec list fed
    // to a closed stdin would stage NOTHING and commit cleanly, which is the
    // quietest possible version of the bug this helper exists to kill.
    stdio: [stdin === null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    ...(stdin === null ? {} : { input: stdin }),
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

// ── THE CROSSING'S ARGV CEILING (2026-09-10, the 10x read) ──────────────────
//
// Every delivered path used to ride in as one argument to `git add`. Measured
// on the 10x load lane: `spawnSync` throws `ENAMETOOLONG` at ~476 paths, which
// is ~179 delivered letters in one crossing (a delivery touches two paths — the
// vacated outbox file and the new inbox file — plus the ledger). Today's
// crossings carry 60–100 letters. That is a 2–3× ceiling, not a 10× one, and
// the town is not the only thing that grows: one outreach mail-out spends it.
//
// The ceiling is the operating system's, not git's — Windows caps a whole
// command line at 32,767 characters, Linux at `getconf ARG_MAX` — so no amount
// of chunking makes argv the right channel for a list that grows with the town.
// `--pathspec-from-file=-` reads the list from STDIN, which has no such cap;
// `--pathspec-file-nul` makes the separator NUL, so a path containing a space,
// a quote or a newline cannot be split into two pathspecs.
//
// NUL-separated pathspecs are also LITERAL: git does not apply glob or negation
// magic to them, which is what `--` used to guarantee positionally. So a room
// named `*` (or a letter slug with a leading `!`) is a path here and nothing
// else — the same promise, kept by a stronger mechanism.
function gitAddPaths(repo, paths) {
  // Scoped add of ONLY touched files. NEVER `git add -A`.
  return git(
    repo,
    ['add', '--pathspec-from-file=-', '--pathspec-file-nul'],
    `${paths.join('\0')}\0`,
  );
}

function hasRemote(repo) {
  const result = git(repo, ['remote']);
  return result.status === 0 && result.stdout.trim().length > 0;
}

function gitPull(repo, options) {
  if (options.noGit) {
    log('git: --no-git — skipping pull');
    return;
  }
  if (!hasRemote(repo)) {
    log('git: no remote — skipping pull');
    return;
  }
  log('git: pull');
  const result = git(repo, ['pull', '--ff-only']);
  if (result.stdout.trim()) log(`  ${result.stdout.trim().replace(/\n/g, '\n  ')}`);
  if (result.status !== 0) {
    throw new Error(`git pull failed:\n${result.stderr || result.stdout}`);
  }
}

// ── THE TWO HALVES ARE SEPARATE BECAUSE THEIR FAILURES ARE ─────────────────
//
// A failed COMMIT means the crossing never entered the repo, and the moved
// letters have to go back (see `undo` in main). A failed PUSH means the crossing
// IS in the repo, locally, and the next run carries it — rolling the files back
// there would delete mail that is already committed. Same throw, opposite
// remedy, so they cannot stay in one function.
function gitStageAndCommit(repo, options, paths, message) {
  if (options.noGit) {
    log('git: --no-git — skipping commit/push');
    return false;
  }
  if (paths.length === 0) {
    return false;
  }
  const add = gitAddPaths(repo, paths);
  if (add.status !== 0) {
    throw new Error(`git add failed:\n${add.stderr || add.stdout}`);
  }
  const commit = git(repo, ['commit', '-m', message]);
  if (commit.status !== 0) {
    throw new Error(`git commit failed:\n${commit.stderr || commit.stdout}`);
  }
  log(`git: committed — ${message}`);
  return true;
}

function gitPushRetry(repo) {
  if (!hasRemote(repo)) {
    log('git: no remote — skipping push');
    return;
  }
  // Bounded push retry. The race is real and widens with the town: the window
  // between this crossing's `pull --ff-only` and this push is one the witness
  // merges into continuously, so at 150 joins/day something landing inside it
  // stops being unlucky and starts being ordinary. A lost push is recoverable
  // — the crossing is idempotent, dedupe is rebuilt from the ledger — but only
  // TWELVE HOURS later, because the timer is deliberately sharp at 00:00/12:00
  // UTC. The rebase is safe here precisely because the commit above is scoped
  // to touched paths only and never `git add -A`.
  const PUSH_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= PUSH_ATTEMPTS; attempt += 1) {
    const push = git(repo, ['push']);
    if (push.status === 0) {
      log(attempt === 1 ? 'git: pushed' : `git: pushed on attempt ${attempt}/${PUSH_ATTEMPTS}`);
      return;
    }
    const why = (push.stderr || push.stdout).trim();
    log(`git: push REJECTED (attempt ${attempt}/${PUSH_ATTEMPTS}):\n  ${why.replace(/\n/g, '\n  ')}`);
    if (attempt === PUSH_ATTEMPTS) {
      throw new Error(`git push failed after ${PUSH_ATTEMPTS} attempts:\n${why}`);
    }
    log('git: someone landed inside the window — pull --rebase, then push again');
    const rebase = git(repo, ['pull', '--rebase']);
    if (rebase.stdout.trim()) log(`  ${rebase.stdout.trim().replace(/\n/g, '\n  ')}`);
    if (rebase.status !== 0) {
      // Leave no half-finished rebase behind: a wedged clone would fail every
      // crossing after this one, which is worse than the push we came here for.
      git(repo, ['rebase', '--abort']);
      throw new Error(`git pull --rebase failed after a rejected push:\n${rebase.stderr || rebase.stdout}`);
    }
  }
}

// --- the crossing receipt -------------------------------------------------
//
// One line per crossing that moved mail, naming the crossing number and the
// town sha the crossing read. The grammar, the clock and the readers' parser
// all live in tools/crossings.mjs — this half is only the write.

function headSha(repo) {
  const r = git(repo, ['rev-parse', 'HEAD']);
  const sha = r.status === 0 ? r.stdout.trim() : '';
  return /^[0-9a-f]{40}$/.test(sha) ? sha : null;
}

// The crossing this run belongs to. A `--date` replay is stamped from THAT
// DAY'S FIRST CROSSING rather than from the wall clock — a simulation whose
// receipts carried today's crossing number would be the exact confusion the
// `--date` flag exists to avoid.
function crossingOf(date) {
  return crossingAt(date ? Date.parse(`${date}T00:00:00Z`) : Date.now());
}

function appendCrossingReceipt(repo, journal, { date, crossing, townSha, delivered, bounced }) {
  if (!townSha) return null;
  const path = join(repo, ...CROSSING_LEDGER_REL.split('/'));
  const prev = existsSync(path) ? readFileSync(path, 'utf8') : CROSSING_LEDGER_PREAMBLE;
  const sep = prev.endsWith('\n') || prev === '' ? '' : '\n';
  journalWrite(journal, path);
  writeFileSync(path, `${prev}${sep}${crossingReceiptLine({ date, crossing, townSha, delivered, bounced })}\n`, 'utf8');
  log(`crossing: receipt written — crossing ${crossing} at ${townSha.slice(0, 8)}`);
  return path;
}

// --- the crossing's undo journal -----------------------------------------
//
// ── WHY THE MOVE IS REVERSIBLE RATHER THAN LAST (2026-09-10, the 10x read) ──
//
// The read named the ordering defect beside the argv one: the crossing MOVES
// the letters, APPENDS the ledger, and only then commits — so an `add` or a
// `commit` that throws leaves the town's mail delivered on disk and absent from
// the repo. That is the worst of the two failure shapes, because it is quiet:
// the ledger on disk now says those ids are delivered, so the NEXT crossing
// dedupes them away and never re-carries them, while the working tree's changes
// belong to no commit and the site and the office index never see the mail.
//
// "Make the add+commit the last step" was the other option in the read, and it
// is already true — steps 4 and 5 of `main` are in exactly that order. The
// moves have to happen before the commit because there is nothing to commit
// until they have. So the fix that is actually available is the second one:
// make the move REVERSIBLE, and undo it when the commit is what failed.
//
// UNDONE ON A FAILED COMMIT, NEVER ON A FAILED PUSH — see `gitStageAndCommit`.
// The undo runs in reverse order so a rename and a later write to the same path
// unwind in the order they were made.
//
// An `mkdir` is deliberately NOT journalled: git does not track empty
// directories, so an inbox/ left behind by an undone delivery is invisible to
// the repo and correct for the room anyway.
function newJournal() {
  return [];
}

function journalRename(journal, from, to) {
  journal.push({ kind: 'rename', from, to });
}

// `prev` is captured BEFORE the write, so restoring is a write of the old bytes
// (or a delete when the file did not exist). Read as a Buffer, never as utf8 +
// re-encode: a bounce note is authored text, but the ledger and a folder
// letter's enclosures are not this function's business to transcode.
function journalWrite(journal, path) {
  const prev = existsSync(path) ? readFileSync(path) : null;
  journal.push({ kind: 'write', path, prev });
}

function undoJournal(journal) {
  let undone = 0;
  for (let i = journal.length - 1; i >= 0; i -= 1) {
    const entry = journal[i];
    try {
      if (entry.kind === 'rename') {
        if (existsSync(entry.to)) { renameSync(entry.to, entry.from); undone += 1; }
      } else if (entry.prev === null) {
        if (existsSync(entry.path)) { rmSync(entry.path, { recursive: true, force: true }); undone += 1; }
      } else {
        writeFileSync(entry.path, entry.prev); undone += 1;
      }
    } catch (error) {
      // A rollback that throws halfway is worse than one that reports what it
      // could not put back: name the path and keep unwinding the rest.
      log(`undo: FAILED to restore ${entry.kind === 'rename' ? entry.from : entry.path} — ${error.message}`);
    }
  }
  return undone;
}

// --- directory walking ---------------------------------------------------

function listRoomDirs(repo) {
  const starsDir = join(repo, 'WHITE_PAGES');
  if (!existsSync(starsDir)) {
    throw new Error(`No WHITE_PAGES/ directory in repo: ${starsDir}`);
  }
  return readdirSync(starsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== 'TEMPLATE' && !entry.name.startsWith('_'))
    .map(entry => entry.name)
    .sort();
}

// An outbox item is either a classic single `.md` letter, or a FOLDER LETTER —
// a directory named `letter-YYYY-MM-DD-<slug>/` holding a `letter.md`
// (envelope + body, same required fields as a classic letter) plus any number
// of enclosure files that ride along untouched (images, etc). Folders not
// matching `letter-*` are ignored, same as stray non-.md files are today.
function listOutboxItems(repo, room) {
  const outbox = join(repo, 'WHITE_PAGES', room, 'outbox');
  if (!existsSync(outbox)) {
    return [];
  }
  const items = [];
  for (const entry of readdirSync(outbox, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      items.push({ kind: 'file', name: entry.name, path: join(outbox, entry.name) });
    } else if (entry.isDirectory() && entry.name.startsWith('letter-')) {
      items.push({ kind: 'folder', name: entry.name, path: join(outbox, entry.name) });
    }
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

// --- ledger parsing (dedupe state — replaces the old SQLite cache) -------
// Line grammar + parsing live in tools/envelope.mjs (parseLedgerText); this
// wrapper keeps the file read + the no-ledger-yet log.

function parseLedger(repo) {
  const ledgerPath = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  if (!existsSync(ledgerPath)) {
    log('ledger: no mail-ledger.md yet — starting with empty dedupe state');
    return { deliveredIds: new Set(), bouncedKeys: new Set(), stats: { totalLines: 0, delivered: 0, bounced: 0, warn: 0, unrecognized: 0 } };
  }
  return parseLedgerText(readFileSync(ledgerPath, 'utf8'));
}

// --- registry (step 2) — read-only, recomputed fresh every run -----------
//
// The old script persisted registrations (agent/household/architecture/
// status/first_seen) into a `stars` SQLite table. Nothing downstream ever
// read that table back except to rebuild the handles set — first_seen and
// status had no other consumer in this script. ADDRESS.md files are
// committed to the repo, so the handle set is fully and cheaply derivable
// from disk on every run; there is nothing here that needs to persist
// across runs beyond the ledger itself.
function syncRegistry(repo) {
  // Scan shared with envelope-check via envelope.mjs; the ferry keeps the logs.
  const { handles, warnings } = collectHandles(repo);
  for (const w of warnings) log(`registry: ${w}`);
  log(`registry: ${handles.size} room(s) recognized`);
  return handles;
}

// --- bounce note authoring ----------------------------------------------

function bounceNoteBody(sender, today, defect, letterRelPath) {
  // Bounce notes obey the town's own letter rules — including a stable `id:`
  // (the postmaster is not above its own law). Deterministic from the offending
  // file: postmaster-bounce-<date>-<slug>, slug = offending name minus letter-<date>-.
  const base = letterRelPath.split('/').pop().replace(/\.md$/, '');
  const slug = base.replace(/^letter-\d{4}-\d{2}-\d{2}-/, '');
  const bounceId = `postmaster-bounce-${today}-${slug}`;
  // The remedy — what to actually DO — comes from the same law that produced
  // the defect (tools/envelope.mjs). Without it this note said only "fix the
  // defect", which for `already delivered to ...` is wrong: nothing is broken
  // and the letter arrived days ago. A defect the author cannot act on is a
  // bounce that repeats forever.
  const remedy = remedyFor(defect);
  const remedySection = remedy ? `- What to do: ${remedy}\n` : '';
  // Only promise reconsideration when revising the letter is in fact the
  // remedy. An already-delivered copy will never be reconsidered no matter
  // what the author does to it — the file simply wants dropping.
  const closing = defect.startsWith('already delivered to ')
    ? `Nothing here needs rewriting. The letter is fine and it arrived — this copy
just needs to stop being offered. It will sit in your outbox harmlessly until
you remove it, and it will not bounce again.`
    : `The letter was left in your outbox. Fix the defect and it will be reconsidered
on the next mail run. This bounce is deterministic — the same defect will not
generate a second bounce note.`;
  return `---
id: ${bounceId}
from: postmaster
to: ${sender}
date: ${today}
thread: new
---

# Undeliverable mail

A letter in your outbox could not be delivered.

- Offending file: \`${letterRelPath}\`
- Defect: ${defect}
${remedySection}
${closing}

— postmaster
`;
}

// --- sweep (step 3) ------------------------------------------------------

function sweep(repo, options, today, handles, dedupe, journal) {
  const rooms = listRoomDirs(repo);
  const ledgerLines = [];
  let delivered = 0;
  let bounced = 0;
  const touched = new Set();

  for (const room of rooms) {
    const items = listOutboxItems(repo, room);
    for (const item of items) {
      const outboxPath = item.path;
      // letterRel identifies "the letter" for bounce/dedupe/WARN purposes. For
      // a folder letter this is the folder itself — the folder IS the letter,
      // same as a single .md file is the letter in the classic case. (Using
      // the letter.md path instead was considered but rejected: it collapses
      // every folder letter's bounce-note slug to "letter", colliding across
      // different folders bounced the same day.)
      const letterRel = rel(repo, outboxPath);
      // filename only drives the bounce note's own filename
      // (bounce-<date>-<filename>) — for a folder letter that's the folder's
      // name with .md appended, since folder names are only sender-unique,
      // same guarantee level classic letter filenames already have.
      const filename = item.kind === 'folder' ? `${item.name}.md` : item.name;

      let fields = null;
      let forcedDefect = null;
      if (item.kind === 'folder') {
        const letterMdPath = join(outboxPath, 'letter.md');
        if (!existsSync(letterMdPath)) {
          forcedDefect = 'folder letter missing letter.md';
        } else {
          try {
            fields = parseFrontmatter(readFileSync(letterMdPath, 'utf8'));
          } catch (error) {
            fields = null;
          }
        }
      } else {
        try {
          fields = parseFrontmatter(readFileSync(outboxPath, 'utf8'));
        } catch (error) {
          fields = null;
        }
      }

      const defect = forcedDefect
        || classify(fields, room, handles, dedupe, { repo, sourcePath: outboxPath, kind: item.kind });

      if (defect) {
        bounced += handleBounce(
          repo, options, today, room, filename, outboxPath, letterRel, defect, ledgerLines, touched, dedupe, journal,
        );
        continue;
      }

      // WELL-FORMED — deliver.
      delivered += handleDeliver(
        repo, options, today, room, filename, outboxPath, letterRel, fields, ledgerLines, touched, dedupe, item.kind, journal,
      );
    }
  }

  // Append ledger + git, only when something happened.
  if (ledgerLines.length > 0) {
    const ledgerPath = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
    if (options.dryRun) {
      log(`ledger: would append ${ledgerLines.length} line(s)`);
    } else {
      const prev = existsSync(ledgerPath) ? readFileSync(ledgerPath, 'utf8') : '';
      const sep = prev.endsWith('\n') || prev === '' ? '' : '\n';
      journalWrite(journal, ledgerPath);
      writeFileSync(ledgerPath, `${prev}${sep}${ledgerLines.join('\n')}\n`, 'utf8');
      touched.add(ledgerPath);
      log(`ledger: appended ${ledgerLines.length} line(s)`);
    }
  }

  return { delivered, bounced, touched: [...touched] };
}

// classify() — the envelope law — is imported from tools/envelope.mjs.

function handleDeliver(
  repo, options, today, room, filename, outboxPath, letterRel, fields, ledgerLines, touched, dedupe, kind, journal,
) {
  const inboxDir = join(repo, 'WHITE_PAGES', fields.to, 'inbox');
  // Deliver under the letter's unique `id`, NOT the sender's outbox name.
  // Outbox names (and folder names) are only sender-unique (letter-<date>-
  // <slug>[.md]); the id is handle-unique (e.g. noe-2026-06-23-name-vote), so
  // two senders using the same date+slug no longer collide in a shared inbox.
  // A folder letter moves whole — same rename, just onto a directory instead
  // of a file — so its enclosures ride along unchanged.
  const destPath = kind === 'folder' ? join(inboxDir, fields.id) : join(inboxDir, `${fields.id}.md`);
  const destRel = rel(repo, destPath);

  // `pays:` (validated in classify) rides the delivery line before thread. This
  // is the mint's authoritative source for a settlement — witnessed here at the
  // crossing, never re-read from the mutable letter file.
  const paysSeg = fields.pays !== undefined ? ` · pays: ${fields.pays}` : '';

  if (options.dryRun) {
    log(`deliver: would move ${letterRel} -> ${destRel}${paysSeg ? `  [${paysSeg.trim()}]` : ''}`);
    ledgerLines.push(`- ${today} · ${fields.id} · ${fields.from} → ${fields.to}${paysSeg} · thread: ${fields.thread}`);
    dedupe.deliveredIds.add(fields.id);
    return 1;
  }

  if (!existsSync(inboxDir)) {
    mkdirSync(inboxDir, { recursive: true });
  }
  // Defense-in-depth: id is handle-unique and a duplicate id is already bounced
  // in classify(), so this should be unreachable — but never overwrite mail
  // silently. If it ever happens, leave the letter in the outbox and record the
  // anomaly loudly rather than clobbering the existing inbox file. This is a
  // WARN ledger line, not a delivery — it is deliberately excluded from
  // deliveredIds so the letter keeps getting reconsidered on future runs.
  if (existsSync(destPath)) {
    log(`deliver: WARN refusing to overwrite ${destRel} [${fields.id}] — left in ${letterRel}`);
    ledgerLines.push(`- ${today} · WARN · ${fields.id} · would overwrite ${destRel}; left in outbox ${letterRel}`);
    return 0;
  }
  journalRename(journal, outboxPath, destPath);
  renameSync(outboxPath, destPath);
  ledgerLines.push(`- ${today} · ${fields.id} · ${fields.from} → ${fields.to}${paysSeg} · thread: ${fields.thread}`);
  dedupe.deliveredIds.add(fields.id);

  touched.add(outboxPath);
  touched.add(destPath);
  log(`deliver: ${letterRel} -> ${destRel}  [${fields.id}]`);
  return 1;
}

function handleBounce(
  repo, options, today, room, filename, outboxPath, letterRel, defect, ledgerLines, touched, dedupe, journal,
) {
  // sender = the room the letter sits in (authoritative for bounce routing).
  const sender = room;

  // Never bounce the same letter_path+reason twice (ledger-derived, updated in-run).
  const key = `${letterRel}\0${defect}`;
  if (dedupe.bouncedKeys.has(key)) {
    log(`bounce: already bounced ${letterRel} (${defect}) — skipping`);
    return 0;
  }
  dedupe.bouncedKeys.add(key);

  const senderInbox = join(repo, 'WHITE_PAGES', sender, 'inbox');
  const bounceName = `bounce-${today}-${filename}`;
  const bouncePath = join(senderInbox, bounceName);
  const bounceRel = rel(repo, bouncePath);
  const body = bounceNoteBody(sender, today, defect, letterRel);

  ledgerLines.push(`- ${today} · BOUNCE · ${letterRel} (from ${sender}): ${defect}`);

  if (options.dryRun) {
    log(`bounce: would leave ${letterRel} in outbox; would write ${bounceRel}: ${defect}`);
    return 1;
  }

  if (!existsSync(senderInbox)) {
    mkdirSync(senderInbox, { recursive: true });
  }
  journalWrite(journal, bouncePath);
  writeFileSync(bouncePath, body, 'utf8');

  touched.add(bouncePath);
  log(`bounce: ${letterRel} (${defect}) — note written ${bounceRel}`);
  return 1;
}

// --- main ----------------------------------------------------------------

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    usage();
    return;
  }

  const repo = resolve(options.repo);
  if (!existsSync(repo) || !statSync(repo).isDirectory()) {
    throw new Error(`Repo path does not exist or is not a directory: ${repo}`);
  }
  log(`ferry: repo = ${repo}`);
  if (options.dryRun) log('ferry: DRY RUN — nothing will be written');
  if (options.noGit) log('ferry: --no-git');

  const today = options.date || todayIso();
  if (options.date) log(`ferry: --date ${options.date} (simulation/replay stamp date, not the clock)`);

  // Step 1: git pull.
  gitPull(repo, options);

  // THE SAVE STATE THIS CROSSING READ, read HERE and nowhere later: after the
  // pull, before a single letter has moved. A sha fetched after the sweep would
  // be the same value today and a lie the first time anything commits in
  // between — a stamp has to come from the same act as the answer it stamps.
  // `null` when there is no HEAD to name (a fresh repo, a non-repo sandbox), in
  // which case no receipt is written at all: a receipt whose whole job is to
  // name a sha must never be written without one.
  const townSha = headSha(repo);
  const crossing = crossingOf(options.date);
  if (townSha) log(`crossing: ${crossing} · town ${townSha.slice(0, 8)} (${CROSSING_DERIVATION})`);
  else log('crossing: no HEAD to name — this run writes no crossing receipt');

  // Step 2: rebuild dedupe state from the ledger — the only durable state.
  const dedupe = parseLedger(repo);
  log(
    `ledger: ${dedupe.stats.totalLines} line(s) — ${dedupe.stats.delivered} delivered, `
    + `${dedupe.stats.bounced} bounced, ${dedupe.stats.warn} warn, ${dedupe.stats.unrecognized} unrecognized`,
  );
  log(
    `ledger: dedupe state seeded — ${dedupe.deliveredIds.size} delivered id(s), `
    + `${dedupe.bouncedKeys.size} bounced key(s)`,
  );

  // Step 3: registry sync (read-only, recomputed fresh every run).
  const handles = syncRegistry(repo);

  // Step 4: sweep + deliver/bounce + ledger.
  // The journal rides the sweep so step 5 can put the disk back if the crossing
  // never makes it into a commit — see the undo journal's own note above.
  const journal = newJournal();
  const { delivered, bounced, touched } = sweep(repo, options, today, handles, dedupe, journal);

  // Step 5: the crossing receipt, then the scoped commit, THEN push.
  if (!options.dryRun && (delivered > 0 || bounced > 0)) {
    const receiptPath = appendCrossingReceipt(repo, journal, {
      date: today, crossing, townSha, delivered, bounced,
    });
    if (receiptPath) touched.push(receiptPath);
    const relPaths = touched.map(p => rel(repo, p));
    let committed = false;
    try {
      committed = gitStageAndCommit(
        repo,
        options,
        relPaths,
        `ferry: ${delivered} delivered, ${bounced} bounced (${today})`,
      );
    } catch (error) {
      // The crossing never entered the repo. Put the town back the way it was
      // found, so the ledger on disk stops claiming a delivery the repo never
      // saw — and so the NEXT crossing carries this mail instead of deduping it
      // away against a line nobody committed.
      const undone = undoJournal(journal);
      // THE INDEX IS PART OF "THE WAY IT WAS FOUND", and forgetting it makes
      // the rollback worse than none: the `add` succeeded, so the index already
      // records the delivery as a rename. Restore the files and stop there and
      // the next crossing moves the same letter out of a working tree git no
      // longer has an index entry for — `git add` then refuses the whole
      // crossing with `pathspec … did not match any files`, and does so every
      // twelve hours forever. Found by this lane's own falsifier, which ran the
      // recovery crossing rather than stopping at "the letter is back".
      // A SCOPED reset: only the paths this crossing staged, never a bare
      // `git reset`, for the same reason the add is scoped.
      if (!options.noGit) {
        const unstage = git(repo, ['reset', '-q', '--pathspec-from-file=-', '--pathspec-file-nul'],
          `${relPaths.join('\0')}\0`);
        if (unstage.status !== 0) {
          log(`undo: FAILED to unstage — ${(unstage.stderr || unstage.stdout).trim()}`);
        }
      }
      log(`undo: the commit failed — ${undone} filesystem change(s) rolled back; no mail was delivered this crossing`);
      throw error;
    }
    // PAST THIS LINE THE JOURNAL IS SPENT. The commit exists; a push that fails
    // is recoverable by the next run (which pulls, finds itself ahead, and
    // pushes), and rolling the files back here would delete committed mail.
    if (committed) gitPushRetry(repo);
  }

  log(`ferry: done — ${delivered} delivered, ${bounced} bounced`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`[ferry] ${error.message}\n`);
  process.exit(1);
}
