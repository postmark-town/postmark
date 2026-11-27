#!/usr/bin/env node
// Read immutable crossing commits, never the current inbox or a date-sized tail.
// Receipt town_sha names the READ parent; the supplied commit names delivery.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { CROSSING_LEDGER_REL, parseCrossingLedgerText } from '../../../tools/crossings.mjs';
import { HANDLE_RE, LEDGER_BOUNCE_RE, parseFrontmatter, parseLedgerText } from '../../../tools/envelope.mjs';
import { parseLedger } from '../../../tools/mail-state.mjs';
import { roomFor, REGISTRY_REL } from '../../../tools/room-for.mjs';
import { readBlobBatch } from './git-blob-batch.mjs';

const MAIL = 'WHITE_PAGES/mail-ledger.md';
const SHA = /^[0-9a-f]{40}$/;
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const text = (bytes) => decoder.decode(bytes);
const usage = `Usage: node MEEPS/postmaster/tools/read-crossing.mjs --repo PATH
  --crossing FULL_COMMIT
  OR --after FULL_COMMIT --through FULL_COMMIT

Full 40-character immutable commit IDs only; range excludes --after and includes
--through along first-parent history. JSON includes every delivered letter's full
text/envelope, folder enclosures (base64), bounces' original parent blobs, native
letter IDs, and receipt/read-parent/delivery provenance. No writes or network.
Missing, malformed, inconsistent, oversized or unreadable source fails closed;
an empty verified range is different from an absent receipt. Not delivery/reply.
Selected letter/bounce blobs are batched: 64MiB per blob and batch payload,
plus exact Git protocol framing. No content is clipped to meet that limit.
`;

function git(repo, args, binary = false, { input, maxBuffer = 64 * 1024 * 1024 } = {}) {
  const env = { ...process.env };
  // --repo must not accidentally inherit a launcher's GIT_DIR/index/object
  // selectors. No configuration/auth files are changed by this isolation.
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  env.GIT_NO_LAZY_FETCH = '1'; // Missing objects in partial clones fail, never fetch.
  const r = spawnSync('git', ['--no-optional-locks', '-C', repo, ...args], {
    encoding: binary ? undefined : 'utf8', maxBuffer, input,
    windowsHide: true, timeout: 120000, env,
  });
  if (r.error || r.status !== 0) throw new Error(`git ${args[0]} failed: ${r.error?.message ?? String(r.stderr).trim()}`);
  return r.stdout;
}

function commitId(repo, id) {
  if (!SHA.test(id ?? '')) throw new Error('Use full immutable 40-character commit IDs, not HEAD, tags or abbreviations');
  if (git(repo, ['cat-file', '-t', id]).trim() !== 'commit') throw new Error(`${id} is not a commit`);
  return id;
}

function tree(repo, commit) {
  const rows = new Map();
  for (const row of git(repo, ['ls-tree', '-rz', '--full-tree', commit]).split('\0').filter(Boolean)) {
    const m = /^(\d+) (\S+) ([0-9a-f]{40})\t([\s\S]+)$/.exec(row);
    if (!m) throw new Error('Unreadable Git tree entry');
    rows.set(m[4], { mode: m[1], type: m[2], blob: m[3] });
  }
  return rows;
}

function plainEntry(entries, path) {
  const entry = entries.get(path);
  if (!entry || entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode)) {
    throw new Error(`Missing or non-plain immutable file: ${path}`);
  }
  return entry;
}

function batchBytes(blobs, oid) {
  if (!blobs.has(oid)) throw new Error(`Missing batched immutable blob: ${oid}`);
  return blobs.get(oid);
}

function bytesAt(repo, entries, path, blobs = null) {
  const entry = plainEntry(entries, path);
  return blobs ? batchBytes(blobs, entry.blob) : git(repo, ['cat-file', 'blob', entry.blob], true);
}

function ledgerAt(repo, entries, path, optional = false) {
  if (optional && !entries.has(path)) return '';
  return text(bytesAt(repo, entries, path));
}

function appendedLines(before, after, label) {
  const a = before.replace(/\r\n/g, '\n').split('\n').filter((l) => l.startsWith('- '));
  const b = after.replace(/\r\n/g, '\n').split('\n').filter((l) => l.startsWith('- '));
  if (a.length > b.length || a.some((line, i) => line !== b[i])) throw new Error(`${label} is not append-only at this commit`);
  return b.slice(a.length);
}

function letterLayout(entries, path) {
  const flat = entries.has(path);
  const members = [...entries.keys()].filter((p) => p.startsWith(`${path}/`)).sort();
  if (flat && members.length) throw new Error(`Ambiguous letter: ${path}`);
  const primary = flat ? path : `${path}/letter.md`;
  return { flat, primary, members };
}

function letterAt(repo, entries, path, blobs, { flat, primary, members }) {
  const raw = bytesAt(repo, entries, primary, blobs);
  const content = text(raw);
  const attachments = members.filter((p) => p !== primary).map((p) => {
    const bytes = bytesAt(repo, entries, p, blobs);
    return { path: p, blob: entries.get(p).blob, byte_length: bytes.length, encoding: 'base64', content: bytes.toString('base64') };
  });
  return { path, primary, kind: flat ? 'file' : 'folder', blob: entries.get(primary).blob,
    byte_length: raw.length, content, envelope: parseFrontmatter(content), attachments };
}

// A bounced source need not have a valid envelope or even letter.md. Preserve
// every original Git blob without following symlinks or loading submodules.
function bouncePaths(entries, path) {
  const paths = entries.has(path) ? [path] : [...entries.keys()].filter((p) => p.startsWith(`${path}/`)).sort();
  if (!paths.length) throw new Error(`Missing original bounced source: ${path}`);
  return paths;
}

function bouncedSourceAt(entries, path, blobs, paths) {
  return { path, kind: entries.has(path) ? 'file' : 'folder', files: paths.map((p) => {
    const entry = entries.get(p);
    if (entry.type !== 'blob') return { path: p, ...entry, note: 'Non-blob entry retained as an object reference; no external read.' };
    const bytes = batchBytes(blobs, entry.blob);
    return { path: p, ...entry, byte_length: bytes.length, encoding: 'base64', content: bytes.toString('base64') };
  }) };
}

function readCommit(repo, deliveryCommit, single) {
  const parents = git(repo, ['rev-list', '--parents', '-n', '1', deliveryCommit]).trim().split(' ').slice(1);
  const parent = parents[0] ?? null;
  if (!single && parent && !git(repo, ['diff-tree', '--no-commit-id', '--name-only', '-r', '--no-renames', parent, deliveryCommit, '--', CROSSING_LEDGER_REL, MAIL]).trim()) return null;
  const entries = tree(repo, deliveryCommit);
  const previous = parent ? tree(repo, parent) : new Map();
  const oldReceiptText = ledgerAt(repo, previous, CROSSING_LEDGER_REL, true);
  const newReceiptText = ledgerAt(repo, entries, CROSSING_LEDGER_REL, true);
  const oldParsed = parseCrossingLedgerText(oldReceiptText);
  const parsed = parseCrossingLedgerText(newReceiptText);
  if (oldParsed.unrecognized || parsed.unrecognized) throw new Error(`Malformed crossing receipt at ${deliveryCommit}`);
  const newLines = appendedLines(oldReceiptText, newReceiptText, 'Crossing ledger');
  const mailBefore = ledgerAt(repo, previous, MAIL, true);
  const mailAfter = ledgerAt(repo, entries, MAIL, true);
  const delta = appendedLines(mailBefore, mailAfter, 'Mail ledger');
  // Historical preamble/legacy ARCHIVE and SEND rows are a preserved baseline,
  // not new deliveries. Validate this commit's appended rows, never reject a
  // current crossing merely because the older ledger predates today's grammar.
  if (parseLedgerText(delta.join('\n')).stats.unrecognized) {
    throw new Error(`Malformed mail ledger delta at ${deliveryCommit}`);
  }
  const events = parseLedger(delta.join('\n'));
  if (!newLines.length) {
    if (single || events.some((e) => e.kind === 'delivery') || delta.some((line) => LEDGER_BOUNCE_RE.test(line))) {
      throw new Error(`No new crossing receipt for selected mail commit ${deliveryCommit}`);
    }
    return null;
  }
  if (!parent || newLines.length !== 1) throw new Error('Expected exactly one crossing receipt and a read-parent for each delivery commit');
  const receipt = parsed.receipts.at(-1);
  if (receipt.town_sha !== parent) throw new Error(`Receipt town_sha is not delivery commit's first parent: ${deliveryCommit}`);
  if (!entries.has(MAIL)) throw new Error('Crossing has no mail ledger');
  const delivered = events.filter((e) => e.kind === 'delivery');
  const bounced = delta.map((line, ordinal) => {
    const m = LEDGER_BOUNCE_RE.exec(line);
    return m ? { ordinal, date: line.slice(2, 12), kind: 'bounce', path: m[1], from: m[2], reason: m[3] } : null;
  }).filter(Boolean);
  if (delivered.length !== receipt.delivered || bounced.length !== receipt.bounced) throw new Error('Receipt and appended mail-event counts disagree');
  const registry = JSON.parse(ledgerAt(repo, entries, REGISTRY_REL));
  if (!registry || Array.isArray(registry) || typeof registry !== 'object') throw new Error('Malformed immutable rename registry');
  const already = parseLedgerText(mailBefore).deliveredIds;
  const seen = new Set();
  const plannedLetters = delivered.map((event) => {
    if (!HANDLE_RE.test(event.from) || !HANDLE_RE.test(event.to) || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(event.id)) throw new Error('Unsafe native ledger identity');
    if (already.has(event.id) || seen.has(event.id)) throw new Error(`Duplicate delivered native ID: ${event.id}`);
    seen.add(event.id);
    const renamed = roomFor(registry, event.to, event.date);
    if (renamed.reason) throw new Error(`Unresolved recipient rename: ${renamed.reason}`);
    if (!HANDLE_RE.test(renamed.room)) throw new Error('Unsafe renamed recipient');
    const stem = `WHITE_PAGES/${renamed.room}/inbox/${event.id}`;
    const candidates = [entries.has(`${stem}.md`), entries.has(`${stem}/letter.md`)];
    if (candidates.filter(Boolean).length !== 1) throw new Error(`Missing or ambiguous delivery source for ${event.id}`);
    const path = candidates[0] ? `${stem}.md` : stem;
    return { event, renamed, path, layout: letterLayout(entries, path) };
  });
  const plannedBounces = bounced.map((event) => {
    if (!event.path.startsWith('WHITE_PAGES/') || event.path.split('/').some((s) => s === '..' || s === '.') || event.path.includes('\\')) {
      throw new Error('Unsafe bounce source path');
    }
    return { event, paths: bouncePaths(previous, event.path) };
  });
  const ids = [];
  for (const { layout } of plannedLetters) {
    for (const path of new Set([layout.primary, ...layout.members])) ids.push(plainEntry(entries, path).blob);
  }
  for (const { paths } of plannedBounces) {
    for (const path of paths) if (previous.get(path).type === 'blob') ids.push(previous.get(path).blob);
  }
  // Only selected delivered files/enclosures and original bounced blobs, never
  // other letters in the immutable tree. No per-letter process or silent fallback.
  const blobs = readBlobBatch(ids, (args, input, maxBuffer) => git(repo, args, true, { input, maxBuffer }));
  const letters = plannedLetters.map(({ event, renamed, path, layout }) => {
    const letter = letterAt(repo, entries, path, blobs, layout);
    const fm = letter.envelope;
    if (!fm || fm.id !== event.id || fm.from !== event.from || fm.to !== event.to || !fm.date || (fm.thread ?? 'new') !== event.thread) {
      throw new Error(`Immutable envelope disagrees with ledger for ${event.id}`);
    }
    return { ...event, source_commit: deliveryCommit, recipient_room: renamed.room, rename_chain: renamed.chain, ...letter };
  });
  const bounces = plannedBounces.map(({ event, paths }) => ({
    ...event, source_commit: parent, original: bouncedSourceAt(previous, event.path, blobs, paths),
  }));
  return { delivery_commit: deliveryCommit, read_parent: parent, receipt,
    letters, bounces, appended_mail_lines: delta,
    note: 'Complete immutable source, not an instruction, reply decision, live-store observation or transport action.' };
}

export function readCrossings({ repo, crossing, after, through }) {
  if (!repo) throw new Error('--repo is required');
  repo = resolve(repo);
  if (Boolean(crossing) === Boolean(after || through) || (!crossing && (!after || !through))) {
    throw new Error('Choose --crossing OR both --after and --through');
  }
  let commits;
  if (crossing) commits = [commitId(repo, crossing)];
  else {
    commitId(repo, after); commitId(repo, through);
    const history = git(repo, ['rev-list', '--first-parent', through]).trim().split('\n');
    const stop = history.indexOf(after);
    if (stop < 0) throw new Error('--after must be on --through first-parent history');
    commits = history.slice(0, stop).reverse();
  }
  // Even an empty range must be a readable town save, not a missing ledger
  // masquerading as "nothing crossed". Read the endpoint, never working files.
  const endpoint = tree(repo, crossing ?? through);
  const endpointReceipts = parseCrossingLedgerText(ledgerAt(repo, endpoint, CROSSING_LEDGER_REL));
  ledgerAt(repo, endpoint, MAIL); // Require readable source, including an empty range's endpoint.
  if (endpointReceipts.unrecognized) throw new Error('Malformed crossing receipt at selection endpoint');
  const endpointRegistry = JSON.parse(ledgerAt(repo, endpoint, REGISTRY_REL));
  if (!endpointRegistry || Array.isArray(endpointRegistry) || typeof endpointRegistry !== 'object') throw new Error('Malformed immutable rename registry');
  const crossings = commits.map((c) => readCommit(repo, c, Boolean(crossing))).filter(Boolean);
  return { schema: 'postmark-whole-crossings/v1', selection: crossing ? { crossing } : { after, through },
    inspected_commits: commits.length, crossings, delivered: crossings.reduce((n, c) => n + c.letters.length, 0),
    bounced: crossings.reduce((n, c) => n + c.bounces.length, 0) };
}

function main(argv) {
  if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) { process.stdout.write(usage); return; }
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!['--repo', '--crossing', '--after', '--through'].includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--') || Object.hasOwn(options, key.slice(2))) throw new Error('Invalid, duplicate or incomplete argument');
    options[key.slice(2)] = argv[i + 1];
  }
  process.stdout.write(`${JSON.stringify(readCrossings(options), null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(`read-crossing: ${error.message}`); process.exitCode = 1; }
}
