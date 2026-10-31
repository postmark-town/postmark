// envelope-check.test.mjs — the outbox scan, in synthetic towns.
//   node --test tools/envelope-check.test.mjs
// The `scan` job in suite.yml runs `node tools/envelope-check.mjs` BARE every day.
// The bare scan suppresses (path, defect) pairs the ledger already bounced and
// fails on anything new; explicit paths (the witness's changed-path scan) never
// suppress. These pin that split in throwaway towns: the script is copied in,
// because it reads the town above its own folder. No real letter is touched.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const LETTER = (id, to) => `---\nid: ${id}\nfrom: crow\nto: ${to}\ndate: 2026-07-20\n---\n\nSynthetic fixture text.\n`;

function town() {
  const repo = mkdtempSync(join(tmpdir(), 'envelope-scan-'));
  mkdirSync(join(repo, 'tools'));
  for (const f of ['envelope-check.mjs', 'envelope.mjs']) copyFileSync(join(HERE, f), join(repo, 'tools', f));
  for (const h of ['crow', 'vermillion']) {
    mkdirSync(join(repo, 'WHITE_PAGES', h), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', h, 'ADDRESS.md'), `---\nhandle: ${h}\n---\n`);
  }
  mkdirSync(join(repo, 'WHITE_PAGES', 'crow', 'outbox'));
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), '# ledger\n\n');
  return repo;
}

const scan = (repo, ...paths) => {
  const r = spawnSync(process.execPath, [join(repo, 'tools', 'envelope-check.mjs'), ...paths], { cwd: repo, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
};
const done = (repo) => rmSync(repo, { recursive: true, force: true });

test('A CLEAN OUTBOX: the bare scan exits 0', () => {
  const repo = town();
  writeFileSync(join(repo, 'WHITE_PAGES', 'crow', 'outbox', 'letter-2026-07-20-ok.md'), LETTER('crow-2026-07-20-ok', 'vermillion'));
  const r = scan(repo);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /1 item\(s\) sail clean\./);
  assert.match(r.out, /Every pending letter sails/);
  done(repo);
});

test('A NEW INVISIBLE ENCLOSURE: an outbox folder not named letter-* exits 1 and is named', () => {
  const repo = town();
  mkdirSync(join(repo, 'WHITE_PAGES', 'crow', 'outbox', 'stray-folder'));
  writeFileSync(join(repo, 'WHITE_PAGES', 'crow', 'outbox', 'stray-folder', 'letter.md'), LETTER('crow-2026-07-20-stray', 'vermillion'));
  const r = scan(repo);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /WHITE_PAGES\/crow\/outbox\/stray-folder: outbox subfolder not named letter-\*/);
  assert.match(r.out, /1 item\(s\) would NOT survive/);
  done(repo);
});

test('AN ALREADY-BOUNCED PAIR: known and quiet in the bare scan, still a defect for an explicit path, and a new defect beside it still fails', () => {
  const repo = town();
  const rel = 'WHITE_PAGES/crow/outbox/letter-2026-07-20-nobody.md';
  writeFileSync(join(repo, rel), LETTER('crow-2026-07-20-nobody', 'nobody-here'));
  // first: not yet bounced, so the bare scan fails and names the defect
  const first = scan(repo);
  assert.equal(first.code, 1, first.out);
  const defect = new RegExp(`✗ ${rel}: (.+)`).exec(first.out)?.[1];
  assert.ok(defect, `a defect line for ${rel}: ${first.out}`);
  // then the ledger records the ferry's bounce of exactly that pair
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `# ledger\n\n- 2026-07-21 · BOUNCE · ${rel} (from crow): ${defect}\n`);
  const bare = scan(repo);
  assert.equal(bare.code, 0, bare.out);
  assert.match(bare.out, new RegExp(`known-stuck[^\\n]*\\n  ~ ${rel}: `));
  assert.doesNotMatch(bare.out, /would NOT survive/);
  // explicit paths never suppress: the witness's changed-path behaviour
  const explicit = scan(repo, rel);
  assert.equal(explicit.code, 1, explicit.out);
  assert.match(explicit.out, new RegExp(`✗ ${rel}: `));
  // a NEW defect beside the known pair is not masked
  mkdirSync(join(repo, 'WHITE_PAGES', 'crow', 'outbox', 'another-stray'));
  const mixed = scan(repo);
  assert.equal(mixed.code, 1, mixed.out);
  assert.match(mixed.out, /another-stray: outbox subfolder not named letter-\*/);
  assert.match(mixed.out, /known-stuck/);
  done(repo);
});

// ── THE ONE NAMED DELIVERED-ENCLOSURES FOLDER (POS-817, bugpost #4273) ────────
// The real folder holds images a delivered letter links by raw URL, so it stays
// where it is. The checker knows it by NAME, paired with that letter's id, and
// keeps it only while the LEDGER shows the id delivered. These fake towns state
// the name and id as configuration; every address, ledger row, letter and file
// below is new synthetic text (the recipient `crow` is the fixture's, not the
// real letter's).
const NAMED = 'WHITE_PAGES/merrick-nocturne/outbox/enclosures';
const NAMED_ID = 'merrick-nocturne-2026-07-18-saturday-offering';
const ASSET = `${NAMED}/synthetic-offering.png`;
const DELIVERED = `- 2026-07-18 · ${NAMED_ID} · merrick-nocturne → crow\n`;
const LETTER_FROM = (from, id, to) => `---\nid: ${id}\nfrom: ${from}\nto: ${to}\ndate: 2026-07-18\n---\n\nSynthetic fixture text.\n`;

function namedTown(ledger) {
  const repo = town();
  mkdirSync(join(repo, 'WHITE_PAGES', 'merrick-nocturne'), { recursive: true });
  writeFileSync(join(repo, 'WHITE_PAGES', 'merrick-nocturne', 'ADDRESS.md'), '---\nhandle: merrick-nocturne\n---\n');
  mkdirSync(join(repo, NAMED), { recursive: true });
  writeFileSync(join(repo, ASSET), 'synthetic placeholder bytes\n');
  if (ledger == null) rmSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'));
  else writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `# ledger\n\n${ledger}`);
  return repo;
}
const flagged = (out, path) => new RegExp(`✗ ${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `).test(out);

test('THE NAMED DELIVERED ENCLOSURES: with its letter delivered in the ledger, the folder is kept, in the bare scan and for the folder or a file in it', () => {
  const repo = namedTown(DELIVERED);
  for (const [mode, args] of [['bare', []], ['the folder', [NAMED]], ['a file in it', [ASSET]], ['the folder with a trailing slash', [`${NAMED}/`]]]) {
    const r = scan(repo, ...args);
    assert.equal(r.code, 0, `${mode}: ${r.out}`);
    assert.ok(!flagged(r.out, NAMED) && !flagged(r.out, ASSET), `${mode}: not flagged\n${r.out}`);
    assert.match(r.out, new RegExp(`kept in place: ${NAMED} — the enclosures of the delivered letter ${NAMED_ID}`), `${mode}: said\n${r.out}`);
  }
  done(repo);
});

test('THE NAMED FOLDER WITHOUT ITS DELIVERY still fails: no ledger row, a bounce, warn or archive line for the id, or no ledger at all', () => {
  const lines = [
    ['no row for the id', ''],
    ['a bounce line', `- 2026-07-18 · BOUNCE · WHITE_PAGES/merrick-nocturne/outbox/letter-2026-07-18-x.md (from merrick-nocturne): duplicate id ${NAMED_ID}\n`],
    ['a warn line', `- 2026-07-18 · WARN · ${NAMED_ID} · would overwrite WHITE_PAGES/crow/inbox/${NAMED_ID}.md\n`],
    ['an archive line', `- 2026-08-18 · ARCHIVE · WHITE_PAGES/merrick-nocturne/outbox/letter-2026-07-18-x.md (from merrick-nocturne): ${NAMED_ID} untouched 30 days\n`],
    ['another id delivered', `- 2026-07-18 · ${NAMED_ID}-two · merrick-nocturne → crow\n`],
    ['no ledger file', null],
  ];
  for (const [what, ledger] of lines) {
    const repo = namedTown(ledger);
    const bare = scan(repo);
    assert.equal(bare.code, 1, `${what}, bare: ${bare.out}`);
    assert.ok(flagged(bare.out, NAMED), `${what}, bare: the folder is named\n${bare.out}`);
    for (const p of [NAMED, ASSET]) assert.equal(scan(repo, p).code, 1, `${what}, explicit ${p}`);
    done(repo);
  }
});

test('THE EXCEPTION IS ONE NAME: a new non-letter folder, a sibling prefix, another room\'s enclosures and a ../ path out of the named folder all still fail beside it', () => {
  const repo = namedTown(DELIVERED);
  const others = ['WHITE_PAGES/merrick-nocturne/outbox/gallery', 'WHITE_PAGES/merrick-nocturne/outbox/enclosures-new', 'WHITE_PAGES/crow/outbox/enclosures'];
  for (const d of others) { mkdirSync(join(repo, d), { recursive: true }); writeFileSync(join(repo, d, 'synthetic.png'), 'synthetic\n'); }
  const bare = scan(repo);
  assert.equal(bare.code, 1, bare.out);
  for (const d of others) assert.ok(flagged(bare.out, d), `bare names ${d}\n${bare.out}`);
  for (const d of others) {
    for (const p of [d, `${d}/synthetic.png`]) assert.equal(scan(repo, p).code, 1, `explicit ${p}`);
  }
  const escape = scan(repo, `${NAMED}/../gallery/synthetic.png`);
  assert.equal(escape.code, 1, `a ../ path out of the named folder: ${escape.out}`);
  assert.ok(flagged(escape.out, 'WHITE_PAGES/merrick-nocturne/outbox/gallery/synthetic.png'), escape.out);
  done(repo);
});

test('A LETTER ACCEPTED IN THIS SWEEP GRANTS NOTHING: a pending letter carrying the named id, checked first, does not keep the folder', () => {
  const repo = namedTown('');
  const pending = 'WHITE_PAGES/merrick-nocturne/outbox/letter-2026-07-18-saturday-offering.md';
  writeFileSync(join(repo, pending), LETTER_FROM('merrick-nocturne', NAMED_ID, 'crow'));
  const r = scan(repo, pending, ASSET);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /1 item\(s\) sail clean\./, `the pending letter itself is deliverable\n${r.out}`);
  assert.ok(flagged(r.out, ASSET), `the folder's file still fails\n${r.out}`);
  const bare = scan(repo);
  assert.equal(bare.code, 1, bare.out);
  assert.ok(flagged(bare.out, NAMED), bare.out);
  done(repo);
});
