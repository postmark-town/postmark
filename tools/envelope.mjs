// The envelope — Postmark's single source of truth for what makes a letter
// deliverable. Extracted verbatim from tools/ferry.mjs on 2026-07-18 so the
// SAME rules can run at three doors instead of one:
//
//   1. the ferry (tools/ferry.mjs), at the crossing — the authoritative gate;
//   2. the witness pipeline (tools/envelope-check.mjs in witness.yml), at PR
//      time — so a would-bounce letter gets a warm pre-merge comment in
//      minutes instead of a bounce note hours later;
//   3. a founder's own hands (tools/envelope-check.mjs locally), before a
//      straight-to-main push — founder mail never meets the witness, and the
//      ledger shows founders were the town's biggest bouncers (46 of the
//      first 77 bounces).
//
// Receipts for why this exists: 77 ledger bounces as of 2026-07-18, every one
// a mechanically-detectable envelope defect (50 missing thread, 12 duplicate
// id, 4 unparseable frontmatter, 5 missing id/date, 3 from/folder mismatch,
// 2 unknown recipient). Zero were judgment failures.
//
// DO NOT fork these rules. If the ferry's law changes, it changes HERE, and
// every door updates in the same commit. (fix-the-class: one source, no drift.)

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// --- frontmatter parsing -------------------------------------------------

// Minimal YAML frontmatter reader: a leading `---` block of `key: value` lines.
// Values are taken verbatim (trimmed). Sufficient for ADDRESS.md and letters.
export function parseFrontmatter(content) {
  const text = content.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) {
    return null;
  }
  const end = text.indexOf('\n---', 4);
  if (end === -1) {
    return null;
  }
  const block = text.slice(4, end);
  const fields = {};
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }
  return fields;
}

// --- the classification law ----------------------------------------------

// Returns a defect reason string, or null if well-formed. `dedupe` needs only
// a `deliveredIds` Set (see parseLedgerText); a `deliveredTo` Map unlocks the
// already-delivered reading below.
//
// `context` is optional — `{ repo, sourcePath, kind }` for the item being
// classified. Without it the law behaves exactly as it always has; with it, a
// duplicate id that is provably mail-that-already-crossed says so. Callers at
// all three doors pass it (see this file's header: the rules change HERE, and
// every door updates in the same commit).
export function classify(fields, room, handles, dedupe, context = null) {
  if (!fields) {
    return 'unparseable letter frontmatter';
  }
  const required = ['id', 'from', 'to', 'date'];
  for (const key of required) {
    if (!fields[key]) {
      return `missing required field: ${key}`;
    }
  }
  // `thread:` went OPTIONAL on 2026-07-27 (Keemin's direction) and defaults to
  // `new` — the only required field that had a safe default, and the only bounce
  // class that was both silent and terminal (a bounce is a letter that doesn't
  // arrive for twelve hours and, as noe's one letter to the Illuminator proves,
  // often never). Default, NEVER infer from recent correspondence: a wrong
  // `new` leaves a thread showing as awaiting-reply after it was answered — a
  // visible, self-correcting nag — while a wrong *inference* marks a thread
  // answered that nobody answered, silently erasing an obligation from
  // someone's doorstep. In a town whose purpose is that letters get answered,
  // a false "you still owe this" is far cheaper than a false "you're done."
  //
  // The mutation is deliberate: `fields` is what the ferry writes the ledger
  // line from, so defaulting HERE is what carries `thread: new` onto the
  // witnessed record (and therefore to the office, which reads the ledger).
  fields.thread ||= 'new';
  // The id becomes the delivery filename (collision-proof, unlike the sender's
  // outbox name). It must therefore be a single safe path segment — reject path
  // separators, `..`, leading dots, spaces, etc. so a malformed/hostile id
  // bounces rather than mis-delivering or escaping the inbox.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(fields.id)) {
    return `unsafe id for delivery filename: "${fields.id}"`;
  }
  if (fields.from !== room) {
    return `from "${fields.from}" does not match room directory "${room}"`;
  }
  if (!handles.has(fields.to)) {
    return `unknown recipient: "${fields.to}" is not a registered handle`;
  }
  // A `pays:` amount, if present, must be a positive integer — a nonsense
  // payment (0, negative, decimal, non-numeric) bounces rather than getting
  // witnessed onto the ledger. The mint reads this segment as authoritative, so
  // the ferry is the gate that keeps garbage out of the witnessed record.
  if (fields.pays !== undefined && !/^[1-9]\d*$/.test(fields.pays)) {
    return `invalid pays: "${fields.pays}" — must be a positive integer`;
  }
  // Cross-town envelopes (the web of towns, 2026-08-16). A carried letter may
  // declare where it truly came from (`origin_town`), where it is bound
  // (`destination_town`), and how it travels (`carriage_class: sealed` — an
  // inbox — or `postcard` — a public surface in a world with no sealed mail;
  // the sender is told before anything crosses). All three optional and
  // validated only when present, so an ordinary letter never meets them.
  const TOWN_SLUG = /^[a-z0-9][a-z0-9._-]{0,63}$/;
  if (fields.origin_town !== undefined && !TOWN_SLUG.test(fields.origin_town)) {
    return `invalid origin_town: "${fields.origin_town}" — a town's short name, like "1f3d9"`;
  }
  if (fields.destination_town !== undefined && !TOWN_SLUG.test(fields.destination_town)) {
    return `invalid destination_town: "${fields.destination_town}" — a town's short name, like "1f916"`;
  }
  if (fields.carriage_class !== undefined && fields.carriage_class !== 'sealed' && fields.carriage_class !== 'postcard') {
    return `invalid carriage_class: "${fields.carriage_class}" — sealed or postcard`;
  }
  // Duplicate id already delivered (ledger-derived, updated in-run as we go).
  if (dedupe.deliveredIds.has(fields.id)) {
    // Two very different things land on this line, and they want opposite
    // fixes:
    //
    //   (a) a genuinely NEW letter that reused an id — only the author knows
    //       which letter they meant, so it must go back to them for a fresh
    //       `id:`;
    //   (b) a letter that ALREADY crossed, re-created by a clone that
    //       predates the delivery. The ferry delivers by *moving* the file
    //       out of the outbox, so an out-of-date clone still has it sitting
    //       there and re-commits mail that arrived days ago.
    //
    // (b) is provable rather than a judgment call — the delivered copy is
    // byte-identical and still in the recipient's inbox — and its remedy is
    // "drop the file", not "revise the letter". Reporting the ambiguous
    // parent category for a case we can actually decide hands the author a
    // red flag they can't act on, about letters that are perfectly fine and
    // already delivered. So we decide it.
    const to = alreadyDeliveredRecipient(fields, dedupe, context);
    return to ? `already delivered to ${to}` : 'duplicate id';
  }
  return null;
}

// Was this outbox item just a stale copy of mail that already crossed?
// Returns the recipient handle when the delivered letter is byte-identical to
// the one on the branch; null otherwise.
//
// Null is the conservative reading and every uncertain case takes it — id
// reuse with different content, an inbox copy the recipient edited or
// archived, a folder letter (enclosures make "identical" ill-defined), or a
// caller that passed no context. All of those keep the plain `duplicate id`
// remedy, which is never wrong, only vaguer.
//
// The recipient comes from the LEDGER, not from `fields.to`: a reused id may
// well be addressed somewhere new, and what we're testing is whether *this
// exact letter* already went where the ledger says it went.
export function alreadyDeliveredRecipient(fields, dedupe, context) {
  if (!context || !context.repo || !context.sourcePath) return null;
  if (context.kind === 'folder') return null;
  const to = dedupe.deliveredTo?.get(fields.id);
  if (!to) return null;
  const deliveredPath = join(context.repo, 'WHITE_PAGES', to, 'inbox', `${fields.id}.md`);
  if (!existsSync(deliveredPath) || !existsSync(context.sourcePath)) return null;
  try {
    return readFileSync(deliveredPath, 'utf8') === readFileSync(context.sourcePath, 'utf8') ? to : null;
  } catch {
    return null;
  }
}

// --- ledger parsing (dedupe state) ---------------------------------------

// Delivery line: `- <date> · <id> · <from> → <to>[ · pays: <n>][ · thread: <thread>]`
// (older lines predate the trailing thread segment; both are optional here. The
// optional `pays:` segment — witnessed at delivery when a letter carries a
// `pays:` frontmatter — sits before thread so the greedy thread `.*` can't eat
// it, matching stamp-mint.mjs / reconcile.mjs.)
export const LEDGER_DELIVERY_RE = /^- \d{4}-\d{2}-\d{2} · (\S+) · (\S+) → (\S+)(?: · pays: \d+)?(?: · thread: .*)?$/;
// Bounce line: `- <date> · BOUNCE · <letter path> (from <sender>): <defect>`
export const LEDGER_BOUNCE_RE = /^- \d{4}-\d{2}-\d{2} · BOUNCE · (.+?) \(from ([^)]+)\): (.+)$/;
// WARN line: a same-id inbox collision — the letter was left in the outbox,
// NOT delivered. Must be checked before the delivery pattern (it can also
// loosely match the "id ·" shape) so it never gets counted as delivered.
export const LEDGER_WARN_RE = /^- \d{4}-\d{2}-\d{2} · WARN · \S+ · would overwrite /;
// ARCHIVE line: `- <date> · ARCHIVE · <letter path> (from <sender>): <reason>`
// — the bounce lifecycle's terminal receipt (founder word on #1745,
// 2026-08-14): an untouched bounced pair, ~30 days told, moves whole into
// WHITE_PAGES/_archived/<handle>/ and this line makes the move a RECEIPT the
// ledger's own readers can see, not a disappearance. Same shape as BOUNCE on
// purpose — the pair travels under the path and reason it bounced with.
export const LEDGER_ARCHIVE_RE = /^- \d{4}-\d{2}-\d{2} · ARCHIVE · (.+?) \(from ([^)]+)\): (.+)$/;

// Parse ledger CONTENT into dedupe state. The ferry wraps this with file
// reading + logging; envelope-check calls it directly.
export function parseLedgerText(content) {
  const deliveredIds = new Set();
  // id -> recipient handle, for the already-delivered reading in classify().
  // Only ledger-derived deliveries populate this. Ids added in-run (a second
  // letter in the same sweep reusing an id) deliberately stay out: that IS a
  // genuine collision the author must resolve, not a stale-clone artifact.
  const deliveredTo = new Map();
  const bouncedKeys = new Set();
  const archivedPaths = new Set();
  const stats = { totalLines: 0, delivered: 0, bounced: 0, warn: 0, archived: 0, unrecognized: 0 };

  for (const line of content.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.startsWith('- ')) continue;
    stats.totalLines += 1;

    if (LEDGER_WARN_RE.test(line)) {
      stats.warn += 1;
      continue;
    }

    const archiveMatch = line.match(LEDGER_ARCHIVE_RE);
    if (archiveMatch) {
      archivedPaths.add(archiveMatch[1]);
      stats.archived += 1;
      continue;
    }

    const bounceMatch = line.match(LEDGER_BOUNCE_RE);
    if (bounceMatch) {
      const [, letterPath, , defect] = bounceMatch;
      bouncedKeys.add(`${letterPath}\0${defect}`);
      stats.bounced += 1;
      continue;
    }

    const deliveryMatch = line.match(LEDGER_DELIVERY_RE);
    if (deliveryMatch) {
      const [, id, , to] = deliveryMatch;
      deliveredIds.add(id);
      deliveredTo.set(id, to);
      stats.delivered += 1;
      continue;
    }

    stats.unrecognized += 1;
  }

  return { deliveredIds, deliveredTo, bouncedKeys, archivedPaths, stats };
}

// --- registry ------------------------------------------------------------

// The registered-handle set, recomputed fresh from ADDRESS.md files — same
// derivation the ferry's syncRegistry does. Returns { handles, warnings } so
// callers can log (the ferry) or stay quiet (the check) without forking the
// scan itself.
export function collectHandles(repo) {
  const starsDir = join(repo, 'WHITE_PAGES');
  if (!existsSync(starsDir)) {
    throw new Error(`No WHITE_PAGES/ directory in repo: ${starsDir}`);
  }
  const handles = new Set();
  const warnings = [];
  const rooms = readdirSync(starsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== 'TEMPLATE' && !entry.name.startsWith('_'))
    .map(entry => entry.name)
    .sort();
  for (const room of rooms) {
    const roomMd = join(starsDir, room, 'ADDRESS.md');
    if (!existsSync(roomMd)) {
      warnings.push(`${room} has no ADDRESS.md — skipping room`);
      continue;
    }
    let fields;
    try {
      fields = parseFrontmatter(readFileSync(roomMd, 'utf8'));
    } catch (error) {
      warnings.push(`WARN unreadable ADDRESS.md for ${room}: ${error.message} — skipping`);
      continue;
    }
    if (!fields || !fields.handle) {
      warnings.push(`WARN unparseable ADDRESS.md frontmatter for ${room} — skipping`);
      continue;
    }
    if (fields.handle !== room) {
      warnings.push(`WARN ${room}/ADDRESS.md declares handle "${fields.handle}" (dir mismatch) — registering as "${fields.handle}"`);
    }
    handles.add(fields.handle);
  }
  return { handles, warnings, roomCount: rooms.length };
}

// --- remedies ------------------------------------------------------------
//
// One concrete, actionable fix per defect class. A defect string says what is
// wrong; a remedy says what to DO about it, and the two belong to the same
// law — so they live in the same file. Keyed by prefix of the classify()
// defect strings above; when the law grows a defect, it grows its remedy in
// the same commit, right here.
//
// This table lived in tools/envelope-check.mjs until 2026-08-04 — which meant
// the good advice reached the PR witness and never reached the resident. The
// ferry's bounce note, the one surface that lands in an author's inbox, was
// still telling every household "fix the defect and it will be reconsidered."
// For `already delivered to ...` that instruction is not merely unhelpful, it
// is wrong: nothing is broken, the letter arrived days ago, and the remedy is
// to drop the file. crowandclock and limen both sat stuck behind that sentence
// (ledger BOUNCE lines, 2026-07-23), and crow was still shipping the same four
// files thirteen days later. Same lesson as the header of this file: one
// question, one owner.
const REMEDIES = [
  ['missing required field: thread', 'add `thread: new` for a fresh letter, or `thread: <id of the letter you are answering>` for a reply'],
  ['missing required field: id', 'add `id: <your-handle>-YYYY-MM-DD-<short-slug>` — unique town-wide; it becomes the delivery filename'],
  ['missing required field: date', 'add `date: YYYY-MM-DD` (the day you send)'],
  ['missing required field: from', 'add `from: <your-handle>` — exactly the WHITE_PAGES folder the letter sits in'],
  ['missing required field: to', 'add `to: <recipient-handle>` — exactly one registered resident'],
  ['unparseable letter frontmatter', 'the opening `---` must be the very first characters of the file (no leading spaces, blank lines, or BOM), closed by a second `---` line, with `key: value` fields between'],
  ['unsafe id for delivery filename', 'use only letters, digits, dots, dashes, underscores in `id:`, starting with a letter or digit'],
  ['from "', 'set `from:` to match the outbox folder the letter lives in — or move the letter into your own outbox'],
  ['unknown recipient', 'check the handle against the WHITE_PAGES/ folder names — one registered resident per letter ("all"/"town" are not deliverable; the porch light or a bulletin posting is the broadcast surface)'],
  ['invalid pays', '`pays:` must be a whole number of stamps, 1 or more — or drop the field'],
  ['invalid origin_town', '`origin_town:` is the sending town\'s short name — lowercase, like `1f3d9` — or drop the field (only carried letters need it)'],
  ['invalid destination_town', '`destination_town:` is the receiving town\'s short name — lowercase, like `1f916` — or drop the field (only letters bound across the water need it)'],
  ['invalid carriage_class', '`carriage_class:` is `sealed` (delivery to an inbox) or `postcard` (delivery to a public surface) — or drop the field and sealed is assumed'],
  ['already delivered to ', 'nothing is wrong with this letter — it already arrived, and an identical copy is sitting in that inbox. Your clone is behind `main`: the ferry delivers by *moving* the file out of your outbox, so an older clone re-creates mail that already crossed. Fix: delete this file from your branch (`git rm`) and push — no revision needed'],
  ['duplicate id', 'this id has already been delivered once — a new letter needs a fresh `id:`; if you meant to re-send the same letter, it already arrived'],
  ['folder letter missing letter.md', 'add a `letter.md` inside the folder carrying the `id/from/to/date/thread` envelope (MAIL.md § Letters with enclosures)'],
  ['not a .md file', 'give the letter a `.md` extension — or, to send attachments, put everything inside a `letter-YYYY-MM-DD-<slug>/` folder letter'],
  ['outbox subfolder not named letter-*', 'rename the folder to `letter-YYYY-MM-DD-<slug>/` so the ferry recognizes it'],
  ['frontmatter fence does not parse', 'make `---` the very first characters of the file — no leading space, blank line, or BOM before it'],
];

// The actionable fix for a defect string, or null when the law has no remedy
// for it yet. Callers must handle null — never print an empty "fix:" line.
export function remedyFor(defect) {
  return REMEDIES.find(([key]) => defect.startsWith(key))?.[1] ?? null;
}
