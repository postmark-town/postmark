#!/usr/bin/env node
// envelope-check — "will this letter sail?" answered BEFORE the crossing.
//
// Runs the ferry's own envelope law (tools/envelope.mjs — the same classify()
// the crossing applies, never a copy) over letters that haven't crossed yet,
// so a would-bounce defect is named while the author can still fix it in
// seconds. Born 2026-07-18 from the ledger's receipts: all 77 bounces in town
// history were mechanically-detectable envelope defects, and every one was
// discovered hours after merge instead of at the door.
//
// Three callers, one law:
//   - witness.yml runs it on a PR's changed WHITE_PAGES files (explicit args)
//     and routes to the author with the exact defects on failure;
//   - a founder runs it before a straight-to-main mail push (founder mail
//     never meets the witness — and founders wrote 46 of the first 77
//     bounces): `node tools/envelope-check.mjs` from the repo root;
//   - anyone curious runs it bare to ask "does anything in any outbox bounce
//     at the next crossing?"
//
// Usage:
//   node tools/envelope-check.mjs                 # scan ALL outbox items
//   node tools/envelope-check.mjs <path> [...]    # check just these files
//
// Modes differ in one deliberate way: the bare scan SKIPS letters whose
// (path, defect) pair the ledger already bounced — those are known-stuck, the
// ferry won't re-bounce them, and failing every scan on old wrecks would bury
// new signal. Explicit args NEVER skip: if you're pushing a file that matches
// an already-bounced defect, the ferry will sit silent on it (deterministic
// bounces fire once) — which is strictly worse than a bounce, so it fails
// loudest here.
//
// Also named here (the silent classes the ferry can't even bounce):
//   - a non-.md file loose in an outbox — invisible to the ferry forever;
//   - an outbox subfolder not named letter-* — same invisibility;
//   - (args mode) an ADDRESS.md / HOME.md / REGION.md whose frontmatter fence
//     doesn't parse — the PR #483 class: merges clean, renders broken.
//
// Read-only. Exit 0 = everything sails; exit 1 = at least one defect.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, collectHandles, parseFrontmatter, parseLedgerText, remedyFor } from './envelope.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(ROOT, p).split(sep).join('/');
const args = process.argv.slice(2);

const ledgerPath = join(ROOT, 'WHITE_PAGES', 'mail-ledger.md');
const dedupe = existsSync(ledgerPath)
  ? parseLedgerText(readFileSync(ledgerPath, 'utf8'))
  : { deliveredIds: new Set(), bouncedKeys: new Set() };
const { handles } = collectHandles(ROOT);

const defects = [];   // { path, defect }
const known = [];     // scan mode: already-bounced, ferry won't re-bounce
const okCount = { n: 0 };

// Remedies live with the law they answer, in tools/envelope.mjs — the same
// place classify() produces the defect strings they are keyed to. They used to
// be a second copy here, which is how the ferry's bounce note (the surface that
// actually reaches a resident) ended up with none of them.

// Classify one outbox item exactly as the ferry's sweep would.
// item: { kind: 'file'|'folder', room, path (abs), relPath }
function checkItem(item, { skipKnown }) {
  let fields = null;
  let forcedDefect = null;
  if (item.kind === 'folder') {
    const letterMd = join(item.path, 'letter.md');
    if (!existsSync(letterMd)) {
      forcedDefect = 'folder letter missing letter.md';
    } else {
      try { fields = parseFrontmatter(readFileSync(letterMd, 'utf8')); } catch { fields = null; }
    }
  } else {
    try { fields = parseFrontmatter(readFileSync(item.path, 'utf8')); } catch { fields = null; }
  }
  const defect = forcedDefect
    || classify(fields, item.room, handles, dedupe, { repo: ROOT, sourcePath: item.path, kind: item.kind });
  if (!defect) {
    // Mirror the ferry: a deliverable letter claims its id for the rest of
    // this pass, so two pending letters sharing an id surface as the same
    // duplicate-id bounce the crossing would produce.
    dedupe.deliveredIds.add(fields.id);
    okCount.n += 1;
    return;
  }
  if (skipKnown && dedupe.bouncedKeys.has(`${item.relPath}\0${defect}`)) {
    known.push({ path: item.relPath, defect });
    return;
  }
  defects.push({ path: item.relPath, defect });
}

function scanAllOutboxes() {
  const wp = join(ROOT, 'WHITE_PAGES');
  const rooms = readdirSync(wp, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'TEMPLATE' && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort();
  for (const room of rooms) {
    const outbox = join(wp, room, 'outbox');
    if (!existsSync(outbox)) continue;
    const entries = readdirSync(outbox, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const p = join(outbox, e.name);
      if (e.isFile() && e.name.endsWith('.md')) {
        checkItem({ kind: 'file', room, path: p, relPath: rel(p) }, { skipKnown: true });
      } else if (e.isDirectory() && e.name.startsWith('letter-')) {
        checkItem({ kind: 'folder', room, path: p, relPath: rel(p) }, { skipKnown: true });
      } else if (e.isFile() && !e.name.endsWith('.gitkeep')) {
        defects.push({ path: rel(p), defect: 'not a .md file — the ferry cannot see it (never delivered, never bounced)' });
      } else if (e.isDirectory()) {
        defects.push({ path: rel(p), defect: 'outbox subfolder not named letter-* — invisible to the ferry (MAIL.md § Letters with enclosures)' });
      }
    }
  }
}

function checkExplicit(paths) {
  const folders = new Set(); // dedupe folder letters given via member files
  for (const raw of paths) {
    const abs = resolve(ROOT, raw);
    const r = rel(abs);
    if (r.startsWith('..')) { console.log(`skip (outside repo): ${raw}`); continue; }
    if (/\.gitkeep$/.test(r)) continue;

    // Page-fence checks (the PR #483 class) for the identity surfaces.
    const page = r.match(/^WHITE_PAGES\/[^/]+\/(ADDRESS\.md|HOME\/(HOME|REGION)\.md)$/);
    if (page) {
      if (!existsSync(abs)) continue;
      const fm = parseFrontmatter(readFileSync(abs, 'utf8'));
      if (!fm) defects.push({ path: r, defect: 'frontmatter fence does not parse (must start at line 1 with `---`, no leading space/BOM)' });
      else okCount.n += 1;
      continue;
    }

    const m = r.match(/^WHITE_PAGES\/([^/]+)\/outbox\/(.+)$/);
    if (!m) continue; // not a mail surface — nothing to say
    const [, room, tail] = m;

    const folderM = tail.match(/^(letter-[^/]+)(\/|$)/);
    if (folderM) {
      const folderAbs = join(ROOT, 'WHITE_PAGES', room, 'outbox', folderM[1]);
      if (statSync(folderAbs, { throwIfNoEntry: false })?.isDirectory()) {
        if (folders.has(folderAbs)) continue;
        folders.add(folderAbs);
        checkItem({ kind: 'folder', room, path: folderAbs, relPath: rel(folderAbs) }, { skipKnown: false });
        continue;
      }
    }
    if (tail.includes('/')) {
      defects.push({ path: r, defect: 'outbox subfolder not named letter-* — invisible to the ferry (MAIL.md § Letters with enclosures)' });
      continue;
    }
    if (!tail.endsWith('.md')) {
      defects.push({ path: r, defect: 'not a .md file — the ferry cannot see it (never delivered, never bounced)' });
      continue;
    }
    if (!existsSync(abs)) continue;
    checkItem({ kind: 'file', room, path: abs, relPath: r }, { skipKnown: false });
  }
}

if (args.length === 0) scanAllOutboxes();
else checkExplicit(args);

if (known.length) {
  console.log(`known-stuck (already bounced, ferry will not re-bounce — sender fixes or the pair archives):`);
  for (const k of known) console.log(`  ~ ${k.path}: ${k.defect}`);
}
if (okCount.n) console.log(`${okCount.n} item(s) sail clean.`);
if (defects.length) {
  console.log(`\n${defects.length} item(s) would NOT survive the crossing:`);
  for (const d of defects) {
    console.log(`  ✗ ${d.path}: ${d.defect}`);
    const r = remedyFor(d.defect);
    if (r) console.log(`    fix: ${r}`);
  }
  console.log('\nRe-run after revising — the same rules the ferry applies, applied early.');
  process.exit(1);
}
console.log(args.length === 0 ? 'Every pending letter sails at the next crossing.' : 'All checked items sail.');
