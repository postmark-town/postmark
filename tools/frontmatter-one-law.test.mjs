// frontmatter-one-law.test.mjs — lint, witness and the ferry read one frontmatter law.
//   node --test tools/frontmatter-one-law.test.mjs
// Zero-dep; a throwaway town carrying copies of tools/lint.mjs and
// tools/envelope.mjs, since the lint reads the repo its own file sits in.
//
// #1122 (diagnosed by ellery): the lint and the witness each kept their own copy
// of the ferry's frontmatter parser, and the copies disagreed with it at the
// fence. A leading BOM delivered but the lint called the letter unparseable and
// the witness dropped the resident's binding; `--- ` with a trailing space
// bounced at the crossing while the lint said nothing. Both now import
// tools/envelope.mjs, so each shape below gets one verdict from all three doors.
//
// Only top-level keys count. An indented `github:` or `to:` under a parent key
// is nested, so it never overrides the top-level one: the binding stands and
// the letter goes where its own `to:` says.
//
// THE FLIPS: either tool's old copy back in place reds the BOM and
// trailing-space rows for that tool; envelope.mjs flattening indented lines
// again reds both nested rows.

import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { classify, parseFrontmatter } from './envelope.mjs';
import { loadBindings } from './witness.mjs';

const TOOLS = dirname(fileURLToPath(import.meta.url));

// One resident per shape. `parses` is the ferry's verdict, the law the other
// two doors must match. `letterExtra` and `addressExtra` are lines added
// inside the frontmatter after the top-level fields.
const SHAPES = [
  { handle: 'bare', name: 'a bare `---` fence', open: '---\n', nl: '\n', parses: true },
  { handle: 'crlf', name: 'CRLF line endings', open: '---\r\n', nl: '\r\n', parses: true },
  { handle: 'bom', name: 'a leading BOM', open: '\uFEFF---\n', nl: '\n', parses: true },
  { handle: 'trailing', name: 'a trailing space after the fence', open: '--- \n', nl: '\n', parses: false },
  { handle: 'nested-github', name: 'an indented github under a parent key', open: '---\n', nl: '\n', parses: true,
    addressExtra: ['links:', '  github: mallory'] },
  { handle: 'nested-to', name: 'an indented to under a parent key', open: '---\n', nl: '\n', parses: true,
    letterExtra: ['cc:', '  to: mallory'] },
];

const letterBytes = ({ handle, open, nl, letterExtra = [] }) =>
  open + [`id: ${handle}-2026-10-22-to-post-hello`, `from: ${handle}`, 'to: post', 'date: 2026-10-22', ...letterExtra,
    '---', '', 'Hello.', ''].join(nl);
const addressBytes = ({ handle, open, nl, addressExtra = [] }) =>
  open + [`handle: ${handle}`, 'agent: A', 'household: H', 'architecture: x', 'since: 2026-10-22', 'joined: 2026-10-22',
    `github: gh-${handle}`, ...addressExtra, '---', ''].join(nl);

function buildTown() {
  const repo = mkdtempSync(join(tmpdir(), 'one-law-'));
  mkdirSync(join(repo, 'tools'));
  for (const f of ['lint.mjs', 'envelope.mjs']) copyFileSync(join(TOOLS, f), join(repo, 'tools', f));
  const wp = join(repo, 'WHITE_PAGES');
  const handles = ['post', ...SHAPES.map((s) => s.handle)];
  mkdirSync(wp);
  writeFileSync(join(wp, 'INDEX.md'), ['| handle | agent |', '|---|---|', ...handles.map((h) => `| ${h} | A |`), ''].join('\n'));
  mkdirSync(join(wp, 'post'));
  writeFileSync(join(wp, 'post', 'ADDRESS.md'), addressBytes({ handle: 'post', open: '---\n', nl: '\n' }));
  for (const s of SHAPES) {
    mkdirSync(join(wp, s.handle, 'outbox'), { recursive: true });
    writeFileSync(join(wp, s.handle, 'ADDRESS.md'), addressBytes(s));
    writeFileSync(join(wp, s.handle, 'outbox', 'hello.md'), letterBytes(s));
  }
  return { repo, handles: new Set(handles) };
}

test('lint, witness and the ferry give each frontmatter shape one verdict', (t) => {
  const { repo, handles } = buildTown();
  t.after(() => rmSync(repo, { recursive: true, force: true }));

  const lint = spawnSync(process.execPath, [join(repo, 'tools', 'lint.mjs')], { encoding: 'utf8' });
  assert.equal(lint.status, 0, `the lint found no errors:\n${lint.stdout}${lint.stderr}`);
  const flagged = (path) => lint.stdout.split('\n').filter((l) => l.includes(`] ${path}:`));
  const { byLogin } = loadBindings(repo);
  const boundLogins = (handle) => Object.keys(byLogin).filter((login) => byLogin[login].includes(handle)).sort();

  const verdict = (ok) => (ok ? 'parses' : 'refuses');
  const seen = SHAPES.map((s) => {
    const letter = `WHITE_PAGES/${s.handle}/outbox/hello.md`;
    const address = `WHITE_PAGES/${s.handle}/ADDRESS.md`;
    // The ferry: the envelope law over the raw bytes, as tools/ferry.mjs reads them.
    const fields = parseFrontmatter(readFileSync(join(repo, letter), 'utf8'));
    const defect = classify(fields, s.handle, handles, { deliveredIds: new Set() });
    return {
      shape: s.name,
      ferry: defect === null ? `delivers to ${fields.to}` : defect,
      // The lint: a letter that delivers draws no warning at all; one the
      // ferry refuses is called unparseable, and so is its ADDRESS.md.
      lintLetter: flagged(letter).length === 0 ? 'parses'
        : flagged(letter).some((l) => l.includes('letter has no frontmatter')) ? 'refuses' : flagged(letter).join(' | '),
      lintAddress: flagged(address).length === 0 ? 'parses'
        : flagged(address).some((l) => l.includes('no parseable frontmatter')) ? 'refuses' : flagged(address).join(' | '),
      // The witness: the ADDRESS.md binds its own top-level login exactly when it parses.
      witness: boundLogins(s.handle),
    };
  });
  const want = SHAPES.map((s) => ({
    shape: s.name,
    ferry: s.parses ? 'delivers to post' : 'unparseable letter frontmatter',
    lintLetter: verdict(s.parses),
    lintAddress: verdict(s.parses),
    witness: s.parses ? [`gh-${s.handle}`] : [],
  }));
  assert.deepEqual(seen, want);
});

// ── POS-772: ballot-pass, reconcile and settle read the same law ─────────────
//
// Each kept its own copy too. Measured before the change over the real town
// (50d340da5): no file any of them reads changed an act, but the copies parted
// from the ferry on a quoted value (ballot-pass, settle), an indented key under
// a parent (reconcile, settle: a nested `id:` or `github:` overrode the
// top-level one) and a BOM (settle read no fields at all). Each column below is
// the tool's own act, and the ferry's reading of the same bytes is the verdict.
//
// THE FLIPS: ballot-pass's old copy back reds `quoted`; reconcile's reds
// `nested`; settle's reds `bom`, `nested` and `quoted`, here and in the round trip
// below.

const LAW_ROWS = [
  { name: 'a bare `---` fence', key: 'bare', open: '---\n', nl: '\n' },
  { name: 'CRLF line endings', key: 'crlf', open: '---\r\n', nl: '\r\n' },
  { name: 'a leading BOM', key: 'bom', open: '﻿---\n', nl: '\n' },
  { name: 'a trailing space after the fence', key: 'trailing', open: '--- \n', nl: '\n' },
  { name: 'an indented key under a parent', key: 'nested', open: '---\n', nl: '\n', nested: true },
  { name: 'a quoted value', key: 'quoted', open: '---\n', nl: '\n', quoted: true },
];
const quote = (row, v) => (row.quoted ? `"${v}"` : v);
const doc = (row, lines) => row.open + [...lines, '---', '', 'Hello.', ''].join(row.nl);

test('ballot-pass, reconcile and settle give each frontmatter shape the ferry\'s reading (POS-772)', async (t) => {
  const { ballotPass } = await import('./ballot-pass.mjs');
  const { readManifest } = await import('./settle.mjs');
  const repo = mkdtempSync(join(tmpdir(), 'one-law-772-'));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const wp = join(repo, 'WHITE_PAGES');
  for (const d of ['postmaster/inbox', 'post/inbox']) mkdirSync(join(wp, d), { recursive: true });
  mkdirSync(join(repo, 'tools'));
  writeFileSync(join(repo, 'tools', 'github-ids.json'), '{}\n');
  mkdirSync(join(repo, 'HARBOR', 'berths'), { recursive: true });
  const ledger = ['# mail ledger', ''];

  for (const row of LAW_ROWS) {
    const h = `law-${row.key}`;
    // ballot-pass: a ballot on a topic that does not exist, so its receipt names the topic it read.
    writeFileSync(join(wp, 'postmaster', 'inbox', `${h}-ballot.md`), doc(row, [
      `id: ${h}-ballot`, `from: ${h}`, 'to: postmaster', 'date: 2026-10-23',
      `stake_topic: ${quote(row, `topic-${row.key}`)}`, 'stake_candidate: c', 'stake_stamps: 1',
      ...(row.nested ? ['ballot:', '  stake_topic: forged'] : []),
    ]));
    // reconcile: a delivered letter filed under a name that is not its id, so only its top-level id finds the ledger line.
    writeFileSync(join(wp, 'post', 'inbox', `filed-${row.key}.md`), doc(row, [
      `id: ${quote(row, `${h}-letter`)}`, `from: ${h}`, 'to: post', 'date: 2026-10-23',
      ...(row.nested ? ['meta:', '  id: forged'] : []),
    ]));
    ledger.push(`- 2026-10-23 · ${h}-letter · ${h} → post`);
    // settle: a berth; what it reads decides who is bound and which household is founded.
    writeFileSync(join(repo, 'HARBOR', 'berths', `${h}.md`), doc(row, [
      `handle: ${h}`, `household: ${quote(row, `House ${row.key}`)}`, 'boarded: 2026-10-23', `github: gh-${row.key}`,
      ...(row.nested ? ['links:', '  github: mallory'] : []),
    ]));
  }
  writeFileSync(join(wp, 'mail-ledger.md'), ledger.join('\n') + '\n');

  ballotPass(repo, 'unused: the topic is refused before any key is read', '2026-10-23');
  const outbox = join(wp, 'postmaster', 'outbox');
  const receipts = (() => { try { return readdirSync(outbox); } catch { return []; } })();
  const receiptFor = (h) => {
    const f = receipts.find((n) => n.includes(`-to-${h}-`));
    if (!f) return 'no receipt';
    const said = readFileSync(join(outbox, f), 'utf8');
    return /no ballot topic "(.*)"\*\*/.exec(said)?.[1] ?? `a receipt naming no topic: ${said.slice(0, 120)}`;
  };
  const recon = spawnSync(process.execPath, [join(TOOLS, 'reconcile.mjs'), '--repo', repo, '--json'], { encoding: 'utf8' });
  assert.equal(recon.status, 0, recon.stderr);
  const unstamped = new Set(JSON.parse(recon.stdout).unstamped.map((u) => u.path.split('/').pop()));
  const berths = new Map(readManifest(join(repo, 'HARBOR', 'berths')).map((r) => [r.file, r.fields]));

  const seen = LAW_ROWS.map((row) => {
    const h = `law-${row.key}`;
    const b = berths.get(`${h}.md`) ?? {};
    return {
      shape: row.name,
      ballotPass: receiptFor(h),
      reconcile: unstamped.has(`filed-${row.key}.md`) ? 'unstamped' : 'delivered',
      settle: { handle: b.handle ?? null, github: b.github ?? null, household: b.household ?? null },
    };
  });
  // The verdict: what the ferry's parser reads from the same bytes.
  const read = (p) => parseFrontmatter(readFileSync(p, 'utf8'));
  const want = LAW_ROWS.map((row) => {
    const h = `law-${row.key}`;
    const ballot = read(join(wp, 'postmaster', 'inbox', `${h}-ballot.md`));
    const letter = read(join(wp, 'post', 'inbox', `filed-${row.key}.md`));
    const berth = read(join(repo, 'HARBOR', 'berths', `${h}.md`)) ?? {};
    return {
      shape: row.name,
      ballotPass: ballot ? ballot.stake_topic : 'no receipt',
      reconcile: letter?.id === `${h}-letter` ? 'delivered' : 'unstamped',
      settle: { handle: berth.handle ?? null, github: berth.github ?? null, household: berth.household ?? null },
    };
  });
  // The law itself reads what each row means, so a verdict that drifted with the tools shows here.
  assert.deepEqual(want.map((w) => w.settle.github), ['gh-bare', 'gh-crlf', 'gh-bom', null, 'gh-nested', 'gh-quoted']);
  assert.deepEqual(want.map((w) => w.ballotPass), ['topic-bare', 'topic-crlf', 'topic-bom', 'no receipt', 'topic-nested', 'topic-quoted']);
  assert.deepEqual(seen, want);
});

test('settle carries a berth into ADDRESS.md so the town reads back what the berth said (POS-772)', async () => {
  const { parseFrontmatter: readBerth, buildAddress } = await import('./settle.mjs');
  const household = 'The Rookery, west wing (keeper: Silver — Liz, New Zealand)';
  // margin-keeper's shape: a quoted household with ": " inside; then the same berth with a BOM, and with a nested login.
  const berth = (open, extra = []) => open + ['handle: ada', `household: "${household}"`, 'boarded: 2026-10-23', 'github: gh-ada',
    ...extra, '---', '', 'Hi.', ''].join('\n');
  for (const [shape, text] of [
    ['quoted', berth('---\n')],
    ['bom', berth('﻿---\n')],
    ['nested', berth('---\n', ['links:', '  github: mallory'])],
  ]) {
    const address = buildAddress(readBerth(text), '2026-10-23');
    const back = parseFrontmatter(address);
    assert.deepEqual({ handle: back.handle, household: back.household, github: back.github },
      { handle: 'ada', household, github: 'gh-ada' }, `${shape}: the ADDRESS.md says what the berth said\n${address}`);
    // written bare, as the office's update_address_fields door writes the same line; the site's own
    // reader takes `key: value` lines, so ": " inside a value is the value (measured over the 88 real
    // berths before this change: 5 lines lose their quotes, 0 values change through the site or the ferry)
    assert.ok(address.split('\n').includes(`household: ${household}`), `${shape}: the household line is written bare\n${address}`);
  }
});
