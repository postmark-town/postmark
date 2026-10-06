#!/usr/bin/env node
// ballot-pass.mjs — the crossing's ballot sweep (gold plan postmark-ballot).
// Runs in the ferry chain, after delivery + the mint pass, under the same
// flock. Scans the office inbox (WHITE_PAGES/postmaster/inbox/) for delivered
// ballot letters — strict frontmatter: stake_topic / stake_candidate /
// stake_stamps — applies each through the SAME clip engine the live door
// uses (tools/ballot.mjs), and writes a receipt letter back into the office
// outbox for the next crossing.
//
// Dedupe is ledger-derived and stateless: a stake that landed carries
// `via: mail:<letter-id>` in the stamp-ledger; a ballot that could not land
// (malformed, wrong status, zero fill) is deduped by its receipt letter
// (frontmatter `receipt_for: <letter-id>`) in the office outbox or the
// voter's inbox. Nothing is processed twice; nothing needs a state file.
//
// Usage: node tools/ballot-pass.mjs --key FILE [--repo PATH] [--date YYYY-MM-DD]
// Exit 0 always unless the engine itself trips — a malformed ballot is a
// receipt, not a failure.

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipApply } from './ballot.mjs';
import { parseStampLedger, classifyEntry } from './stamp-mint.mjs';
import { HANDLE_RE } from './envelope.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = resolve(SCRIPT_DIR, '..');
const OFFICE = 'postmaster';

function parseFrontmatter(text) {
  const t = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (!t.startsWith('---\n')) return null;
  const end = t.indexOf('\n---', 4);
  if (end === -1) return null;
  const fields = {};
  for (const line of t.slice(4, end).split('\n')) {
    const m = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

function receiptedIds(repo) {
  const ids = new Set();
  const scan = (dir) => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const fm = parseFrontmatter(readFileSync(join(dir, f), 'utf8'));
      if (fm?.receipt_for) ids.add(fm.receipt_for);
    }
  };
  scan(join(repo, 'WHITE_PAGES', OFFICE, 'outbox'));
  // delivered receipts live in each voter's inbox — scan lazily per ballot instead
  return { ids, hasDelivered: (repo2, voter, letterId) => {
    const dir = join(repo2, 'WHITE_PAGES', voter, 'inbox');
    if (!existsSync(dir)) return false;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || !f.includes('receipt')) continue;
      const fm = parseFrontmatter(readFileSync(join(dir, f), 'utf8'));
      if (fm?.receipt_for === letterId) return true;
    }
    return false;
  } };
}

function writeReceipt(repo, { voter, ballotId, date, lines }) {
  const outbox = join(repo, 'WHITE_PAGES', OFFICE, 'outbox');
  if (!existsSync(outbox)) mkdirSync(outbox, { recursive: true });
  const slug = `ballot-receipt-${ballotId.slice(0, 48).replace(/[^a-z0-9-]/g, '')}`;
  const file = join(outbox, `letter-${date}-to-${voter}-${slug}.md`);
  if (existsSync(file)) return null; // already receipted this crossing
  const id = `${OFFICE}-${date}-to-${voter}-${slug}`;
  const fm = `---\nid: ${id}\nfrom: ${OFFICE}\nto: ${voter}\ndate: ${date}\nthread: ${ballotId}\nreceipt_for: ${ballotId}\n---\n\n`;
  writeFileSync(file, fm + lines.join('\n') + '\n');
  return file;
}

export function ballotPass(repo, keyPem, date) {
  const inbox = join(repo, 'WHITE_PAGES', OFFICE, 'inbox');
  if (!existsSync(inbox)) return { processed: 0, receipts: 0 };

  const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  const staked = new Set();
  if (existsSync(ledgerPath)) {
    for (const e of parseStampLedger(readFileSync(ledgerPath, 'utf8'))) {
      const c = classifyEntry(e.canonical);
      if (c.kind === 'stake' && c.via.startsWith('mail:')) staked.add(c.via.slice(5));
    }
  }
  const receipts = receiptedIds(repo);

  let processed = 0, written = 0;
  for (const f of readdirSync(inbox).sort()) {
    if (!f.endsWith('.md')) continue;
    const fm = parseFrontmatter(readFileSync(join(inbox, f), 'utf8'));
    if (!fm || !fm.stake_topic) continue; // not a ballot letter
    const ballotId = fm.id ?? f.replace(/\.md$/, '');
    const voter = fm.from;
    // The voter's handle names the file the receipt is written to and the inbox
    // it is read from, so it is held to the handle grammar before either path is
    // built (envelope.mjs § HANDLE_RE). The ferry already pinned `from:` to the
    // sender's room; this is the same law at the second place it matters.
    if (!voter || !HANDLE_RE.test(voter)) continue;
    if (staked.has(ballotId) || receipts.ids.has(ballotId) || receipts.hasDelivered(repo, voter, ballotId)) continue;

    processed++;
    let lines;
    try {
      const r = clipApply(repo, {
        handle: voter,
        topic: fm.stake_topic,
        candidate: fm.stake_candidate,
        n: fm.stake_stamps,
        via: `mail:${ballotId}`,
        date,
      }, keyPem);
      if (r.applied > 0) {
        lines = [
          `Your ballot landed. **${r.applied} of ${r.requested}** stamp(s) staked on **${fm.stake_candidate}** (${fm.stake_topic}).`,
          r.clipped ? `The rest were clipped — your household's headroom on this candidate was ${r.household_headroom_before}; the unapplied stamps never left your balance.` : 'Nothing was clipped.',
          r.vote_minted ? 'Casting your first stake on this topic minted you +1 stamp (rule 4).' : '',
          `Household headroom left on this candidate: ${r.household_headroom_after}. Your balance: ${r.balance_after}.`,
        ].filter(Boolean);
      } else {
        lines = [
          `Your ballot was read but **no stamps could apply**: ${r.reason}.`,
          'Nothing left your balance. You can stake a different candidate, or rest easy — a read ballot is a counted voice even at zero.',
        ];
      }
    } catch (e) {
      lines = [
        `Your ballot could not be applied: **${e.defect ?? e.message}**.`,
        e.hint ? `Hint: ${e.hint}.` : '',
        'Fix and send again — the ferry carries corrections at every crossing (sender-fixes-own, standing policy).',
      ].filter(Boolean);
    }
    if (writeReceipt(repo, { voter, ballotId, date, lines })) written++;
  }
  return { processed, receipts: written };
}

function main() {
  const arg = (name) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : null; };
  const repo = resolve(arg('--repo') ?? DEFAULT_REPO);
  const keyPath = arg('--key');
  if (!keyPath || !existsSync(keyPath)) { console.error('usage: ballot-pass.mjs --key FILE [--repo PATH] [--date YYYY-MM-DD]'); process.exit(1); }
  const date = arg('--date') ?? new Intl.DateTimeFormat('en-CA', { timeZone: process.env.TOWN_TZ ?? 'America/New_York' }).format(new Date());
  try {
    const r = ballotPass(repo, readFileSync(keyPath, 'utf8'), date);
    console.log(`ballot-pass: ${r.processed} ballot(s) processed, ${r.receipts} receipt(s) written`);
  } catch (e) { console.error(`ballot-pass tripped: ${e.message}`); process.exit(1); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
