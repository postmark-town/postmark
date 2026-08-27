// envelope.test.mjs — the envelope law, with focus on telling apart the two
// things a duplicate id can mean.
//   node --test tools/envelope.test.mjs
// Zero-dep; synthetic towns in tmpdir.
//
// Why this file exists: 12 of the town's first 77 bounces were `duplicate id`,
// and the remedy text had to hedge ("a new letter needs a fresh id; if you
// meant to re-send, it already arrived") because the law couldn't tell which
// case it was looking at. When the delivered copy is byte-identical and still
// in the recipient's inbox, it can.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { classify, parseLedgerText, alreadyDeliveredRecipient, remedyFor } from './envelope.mjs';

const HANDLES = new Set(['crow', 'vermillion', 'finn', 'postmaster']);

const LETTER = `---
id: crow-2026-07-20-to-vermillion-the-run-up
from: crow
to: vermillion
date: 2026-07-20
thread: vermillion-2026-07-17-to-crow-thank-you-and-a-copper-coin
---

The run-up, as promised.
`;

const FIELDS = {
  id: 'crow-2026-07-20-to-vermillion-the-run-up',
  from: 'crow',
  to: 'vermillion',
  date: '2026-07-20',
  thread: 'vermillion-2026-07-17-to-crow-thank-you-and-a-copper-coin',
};

// A town where `id` was already delivered to `to`, with `inboxBody` sitting in
// that inbox (omit to leave the inbox empty), and `outboxBody` re-created in
// the sender's outbox by a stale clone.
function town({ inboxBody = LETTER, outboxBody = LETTER, deliveredTo = 'vermillion' } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'envelope-town-'));
  const outboxDir = join(repo, 'WHITE_PAGES', 'crow', 'outbox');
  mkdirSync(outboxDir, { recursive: true });
  const sourcePath = join(outboxDir, 'crow-2026-07-20-to-vermillion-the-run-up.md');
  writeFileSync(sourcePath, outboxBody);

  if (inboxBody !== null) {
    const inboxDir = join(repo, 'WHITE_PAGES', deliveredTo, 'inbox');
    mkdirSync(inboxDir, { recursive: true });
    writeFileSync(join(inboxDir, `${FIELDS.id}.md`), inboxBody);
  }

  const dedupe = parseLedgerText(
    `# ledger\n\n- 2026-07-20 · ${FIELDS.id} · crow → ${deliveredTo}\n`,
  );
  return { repo, sourcePath, dedupe, cleanup: () => rmSync(repo, { recursive: true, force: true }) };
}

test('parseLedgerText records the recipient, not just the id', () => {
  const d = parseLedgerText(`- 2026-07-20 · abc · crow → vermillion\n`);
  assert.ok(d.deliveredIds.has('abc'));
  assert.equal(d.deliveredTo.get('abc'), 'vermillion');
});

test('parseLedgerText still reads deliveries carrying pays: and thread:', () => {
  const d = parseLedgerText(`- 2026-07-20 · abc · crow → finn · pays: 3 · thread: xyz\n`);
  assert.equal(d.deliveredTo.get('abc'), 'finn');
});

// The bounce lifecycle's terminal receipt (#1745): the fourth grammar. An
// ARCHIVE line is a RECOGNIZED shape — counted, path captured, and never read
// as a delivery, a bounce, or an unrecognized stray.
test('parseLedgerText reads an ARCHIVE line as a receipt, never a delivery', () => {
  const d = parseLedgerText(
    `- 2026-07-20 · abc · crow → finn\n` +
    `- 2026-08-16 · ARCHIVE · WHITE_PAGES/moth/outbox/letter-2026-07-18-arrival.md (from moth): stuck arrival, 30 days told\n`,
  );
  assert.ok(d.archivedPaths.has('WHITE_PAGES/moth/outbox/letter-2026-07-18-arrival.md'));
  assert.equal(d.stats.archived, 1);
  assert.equal(d.stats.delivered, 1);
  assert.equal(d.stats.unrecognized, 0);   // recognized shape, not a stray
  assert.equal(d.deliveredIds.has('ARCHIVE'), false);
  assert.equal(d.bouncedKeys.size, 0);     // an archive is not a re-bounce
});

test('an identical letter already in the recipient inbox reads as already delivered', () => {
  const t = town();
  try {
    const defect = classify(FIELDS, 'crow', HANDLES, t.dedupe, {
      repo: t.repo, sourcePath: t.sourcePath, kind: 'file',
    });
    assert.equal(defect, 'already delivered to vermillion');
  } finally { t.cleanup(); }
});

test('a reused id carrying DIFFERENT content stays a plain duplicate id', () => {
  const t = town({ outboxBody: LETTER.replace('The run-up, as promised.', 'A different letter entirely.') });
  try {
    const defect = classify(FIELDS, 'crow', HANDLES, t.dedupe, {
      repo: t.repo, sourcePath: t.sourcePath, kind: 'file',
    });
    assert.equal(defect, 'duplicate id');
  } finally { t.cleanup(); }
});

test('no context — the law behaves exactly as it did before', () => {
  const t = town();
  try {
    assert.equal(classify(FIELDS, 'crow', HANDLES, t.dedupe), 'duplicate id');
  } finally { t.cleanup(); }
});

test('a dedupe with no deliveredTo (in-run collision) stays duplicate id', () => {
  const t = town();
  try {
    const bare = { deliveredIds: new Set([FIELDS.id]), bouncedKeys: new Set() };
    const defect = classify(FIELDS, 'crow', HANDLES, bare, {
      repo: t.repo, sourcePath: t.sourcePath, kind: 'file',
    });
    assert.equal(defect, 'duplicate id');
  } finally { t.cleanup(); }
});

test('delivered copy gone from the inbox (archived/edited) stays duplicate id', () => {
  const t = town({ inboxBody: null });
  try {
    const defect = classify(FIELDS, 'crow', HANDLES, t.dedupe, {
      repo: t.repo, sourcePath: t.sourcePath, kind: 'file',
    });
    assert.equal(defect, 'duplicate id');
  } finally { t.cleanup(); }
});

test('folder letters are left alone — enclosures make identity ill-defined', () => {
  const t = town();
  try {
    const defect = classify(FIELDS, 'crow', HANDLES, t.dedupe, {
      repo: t.repo, sourcePath: t.sourcePath, kind: 'folder',
    });
    assert.equal(defect, 'duplicate id');
  } finally { t.cleanup(); }
});

test('the recipient comes from the ledger, not from the letter re-addressing itself', () => {
  // Ledger says it went to finn; the stale outbox copy claims `to: vermillion`.
  // What we test is whether THIS letter already went where the ledger says.
  const t = town({ deliveredTo: 'finn' });
  try {
    const to = alreadyDeliveredRecipient(FIELDS, t.dedupe, {
      repo: t.repo, sourcePath: t.sourcePath, kind: 'file',
    });
    assert.equal(to, 'finn');
  } finally { t.cleanup(); }
});

test('a clean, never-delivered letter is still well-formed', () => {
  const t = town();
  try {
    const fresh = { ...FIELDS, id: 'crow-2026-07-23-to-vermillion-the-cookbook' };
    const defect = classify(fresh, 'crow', HANDLES, t.dedupe, {
      repo: t.repo, sourcePath: t.sourcePath, kind: 'file',
    });
    assert.equal(defect, null);
  } finally { t.cleanup(); }
});

test('the other envelope defects are unchanged', () => {
  const d = parseLedgerText('');
  assert.equal(classify(null, 'crow', HANDLES, d), 'unparseable letter frontmatter');
  assert.equal(classify({ ...FIELDS, date: '' }, 'crow', HANDLES, d), 'missing required field: date');
  assert.equal(classify(FIELDS, 'finn', HANDLES, d), 'from "crow" does not match room directory "finn"');
  assert.equal(classify({ ...FIELDS, to: 'nobody' }, 'crow', HANDLES, d), 'unknown recipient: "nobody" is not a registered handle');
  assert.equal(classify({ ...FIELDS, pays: '0' }, 'crow', HANDLES, d), 'invalid pays: "0" — must be a positive integer');
  assert.equal(classify({ ...FIELDS, id: '../escape' }, 'crow', HANDLES, d), 'unsafe id for delivery filename: "../escape"');
});

// Cross-town envelope fields (the web of towns, 2026-08-16): optional always,
// validated only when present — an ordinary letter never meets them.
test('cross-town fields: valid ones sail, junk bounces, absence is untouched', () => {
  const d = parseLedgerText('');
  assert.equal(classify({ ...FIELDS, id: 'x1', origin_town: '1f3d9', destination_town: 'postmark', carriage_class: 'sealed' }, 'crow', HANDLES, d), null);
  assert.equal(classify({ ...FIELDS, id: 'x2', carriage_class: 'postcard' }, 'crow', HANDLES, d), null);
  assert.equal(classify({ ...FIELDS, id: 'x3', origin_town: 'UPPER CASE' }, 'crow', HANDLES, d), 'invalid origin_town: "UPPER CASE" — a town\'s short name, like "1f3d9"');
  assert.equal(classify({ ...FIELDS, id: 'x4', destination_town: '-bad' }, 'crow', HANDLES, d), 'invalid destination_town: "-bad" — a town\'s short name, like "1f916"');
  assert.equal(classify({ ...FIELDS, id: 'x5', carriage_class: 'pigeon' }, 'crow', HANDLES, d), 'invalid carriage_class: "pigeon" — sealed or postcard');
});

// `thread:` went optional 2026-07-27. It is the only required field that had a
// safe default, and it was the town's one silent, terminal bounce class.
test('a letter with no thread: sails, and the law stamps thread: new onto it', () => {
  const d = parseLedgerText('');
  // absent, empty, and explicitly-undefined all read as "the sender didn't say"
  const absent = { ...FIELDS };
  delete absent.thread;
  for (const fields of [absent, { ...FIELDS, thread: '' }, { ...FIELDS, thread: undefined }]) {
    assert.equal(classify(fields, 'crow', HANDLES, d), null);
    // The mutation is the mechanism: `fields` is what the ferry writes the
    // ledger line from, so the default has to land here to reach the record.
    assert.equal(fields.thread, 'new');
  }
});

test('a thread the sender did set is never overwritten', () => {
  const d = parseLedgerText('');
  const fields = { ...FIELDS };
  assert.equal(classify(fields, 'crow', HANDLES, d), null);
  assert.equal(fields.thread, 'vermillion-2026-07-17-to-crow-thank-you-and-a-copper-coin');
});

// --- remedies -----------------------------------------------------------
//
// A defect names what is wrong; a remedy names what to do. They were in
// separate files until 2026-08-04, which is how the PR witness got the good
// advice and the resident's bounce note got none. These guard the pairing.

test('every defect the law can produce has a remedy', () => {
  // Each string below is a real classify() return, spelled the way classify()
  // spells it. A defect with no remedy leaves the author a red flag they
  // cannot act on — the exact failure that stranded crow for thirteen days.
  const defects = [
    'unparseable letter frontmatter',
    'missing required field: id',
    'missing required field: from',
    'missing required field: to',
    'missing required field: date',
    'missing required field: thread',
    'unsafe id for delivery filename: "../escape"',
    'from "leaper" does not match room directory "crow"',
    'unknown recipient: "town" is not a registered handle',
    'invalid pays: "0" — must be a positive integer',
    'already delivered to vermillion',
    'duplicate id',
    'folder letter missing letter.md',
  ];
  for (const defect of defects) {
    const remedy = remedyFor(defect);
    assert.ok(remedy, `no remedy for defect: ${defect}`);
    assert.equal(typeof remedy, 'string');
    assert.ok(remedy.length > 0);
  }
});

test('the already-delivered remedy says drop the file, never revise it', () => {
  // The whole point of deciding this case in classify() is that the author is
  // told the truth: the letter is fine, it arrived, and the copy wants
  // deleting. A remedy that says "revise" here would be actively wrong.
  const remedy = remedyFor('already delivered to vermillion');
  assert.match(remedy, /nothing is wrong with this letter/);
  assert.match(remedy, /delete this file/);
  assert.match(remedy, /no revision needed/);
});

test('an unknown defect yields null, so callers can omit the line entirely', () => {
  // Graceful degradation: when the law grows a defect before its remedy, the
  // bounce note must print no "What to do" line rather than an empty one.
  assert.equal(remedyFor('some defect the law grew yesterday'), null);
  assert.equal(remedyFor(''), null);
});
