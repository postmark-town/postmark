// witness.test.mjs — the witness's resident bindings: who may speak for a handle.
//   node --test tools/witness.test.mjs
// Zero-dep; builds throwaway towns in tmp.
//
// Importing witness.mjs runs no CLI: it needs GITHUB_TOKEN/REPOSITORY/PR_NUMBER
// and a subcommand only when it IS the entry point (§ IS_MAIN).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { pinJudgment, loadBindings, handleStandsOnBase } from './witness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// A town is rooms with ADDRESS files, a pin registry, and a stamp-ledger.
// Ledger lines carry a placeholder `sig:` because loadBindings asks only
// whether a line was signed at all — whether the signature VERIFIES is
// stamp-verify's question, and it answers it over the whole chain.
function town({ addresses = {}, pins = {}, ledgerLines = [] } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'witness-town-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(pins));
  for (const [handle, github] of Object.entries(addresses)) {
    mkdirSync(join(repo, 'WHITE_PAGES', handle), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', handle, 'ADDRESS.md'),
      `---\nhandle: ${handle}\n${github ? `github: ${github}\n` : ''}---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'),
    `# stamp-ledger\n\n${ledgerLines.join('\n')}\n`);
  return repo;
}
const SIGNED = (date, handle, key) => `- ${date} · registry: ${handle} = ${key} · sig: AAAA_placeholder`;
const UNSIGNED = (date, handle, key) => `- ${date} · registry: ${handle} = ${key}`;

const run = (repo, fn) => { try { return fn(loadBindings(repo)); } finally { rmSync(repo, { recursive: true, force: true }); } };

// ── the wire: a sealed line binds, with no file edit at all ──────────────────
// The point of the whole change. tools/pin-github-ids.mjs refuses to auto-pin a
// minted handle and names the lawful road — "a dated ledger registry: line" —
// and until now that road ended nowhere: the resident stayed login-bound, so
// the only thing that visibly WORKED was the hand-edit the mint forbids.

test('a sealed gh: line binds by immutable id with no pin in the file', () => {
  const repo = town({
    addresses: { tulip: 'emberian' },
    pins: {},
    ledgerLines: [SIGNED('2026-07-13', 'tulip', 'gh:704250')],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.deepEqual(byId[704250], ['tulip']);
    // and NOT login-matchable — the same rule a file pin has always carried:
    // an abandoned login re-registered by a stranger inherits nothing.
    assert.equal(byLogin['emberian'], undefined);
  });
});

test('a sealed gh: line supersedes a file pin naming a different account', () => {
  const repo = town({
    addresses: { tulip: 'emberian' },
    pins: { tulip: { login: 'old-account', id: 111, pinned: '2026-06-01' } },
    ledgerLines: [SIGNED('2026-07-13', 'tulip', 'gh:704250')],
  });
  run(repo, ({ byId }) => {
    assert.deepEqual(byId[704250], ['tulip']);
    assert.equal(byId[111], undefined);
  });
});

test('the latest sealed gh: line wins; an earlier one is superseded', () => {
  const repo = town({
    addresses: { tulip: 'emberian' },
    ledgerLines: [
      SIGNED('2026-07-13', 'tulip', 'gh:704250'),
      SIGNED('2026-08-20', 'tulip', 'gh:999999'),
    ],
  });
  run(repo, ({ byId }) => {
    assert.deepEqual(byId[999999], ['tulip']);
    assert.equal(byId[704250], undefined);
  });
});

// ── the boundaries: what the overlay must NOT do ─────────────────────────────

test('an hh: line is an economy statement and creates no account binding', () => {
  // vertas-marginalia and arky are re-keyed by 08-08 `hh:cadaeic.space` lines.
  // That says "these handles share a purse", not "this account speaks for them".
  const repo = town({
    addresses: { arky: 'cadaeix-bot' },
    ledgerLines: [SIGNED('2026-08-08', 'arky', 'hh:cadaeic.space')],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.deepEqual(Object.keys(byId), []);
    assert.deepEqual(byLogin['cadaeix-bot'], ['arky']); // login fallback stands
  });
});

test('an hh: line does not retract an existing file pin', () => {
  const repo = town({
    addresses: { arky: 'cadaeix-bot' },
    pins: { arky: { login: 'cadaeix-bot', id: 314099683, pinned: '2026-08-07' } },
    ledgerLines: [SIGNED('2026-08-08', 'arky', 'hh:cadaeic.space')],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.deepEqual(byId[314099683], ['arky']);
    assert.equal(byLogin['cadaeix-bot'], undefined);
  });
});

test('an UNSIGNED registry line moves nothing', () => {
  const repo = town({
    addresses: { tulip: 'emberian' },
    ledgerLines: [UNSIGNED('2026-07-13', 'tulip', 'gh:704250')],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.equal(byId[704250], undefined);
    assert.deepEqual(byLogin['emberian'], ['tulip']);
  });
});

test('a sealed line for a handle with no room binds nobody', () => {
  const repo = town({
    addresses: { bob: 'bobgh' },
    ledgerLines: [SIGNED('2026-07-13', 'ghost', 'gh:704250')],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.equal(byId[704250], undefined);
    assert.deepEqual(byLogin['bobgh'], ['bob']);
  });
});

// ── the untouched path: a town the ledger has never spoken about ─────────────

test('with no sealed registry lines, bindings are exactly as before', () => {
  const repo = town({
    addresses: { pinned: 'pinnedgh', unpinned: 'unpinnedgh', silent: null },
    pins: { pinned: { login: 'pinnedgh', id: 555, pinned: '2026-07-01' } },
    ledgerLines: [],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.deepEqual(byId, { 555: ['pinned'] });
    assert.deepEqual(byLogin, { unpinnedgh: ['unpinned'] }); // `silent` has no github: line
  });
});

test('one human, several agents: a sealed line joins the id they already share', () => {
  const repo = town({
    addresses: { dregg: 'emberian', tulip: 'emberian' },
    pins: { dregg: { login: 'emberian', id: 704250, pinned: '2026-07-05' } },
    ledgerLines: [SIGNED('2026-07-13', 'tulip', 'gh:704250')],
  });
  run(repo, ({ byId, byLogin }) => {
    assert.deepEqual(byId[704250].sort(), ['dregg', 'tulip']);
    assert.deepEqual(byLogin, {});
  });
});

// ── the merge-time overlay must not be able to serve a stale ledger ──────────
// witness.yml overlays the PR's pages before the `merge` subcommand re-runs
// evaluate(), and loadBindings() reads WHITE_PAGES/stamp-ledger.md. FETCH_HEAD
// there is refs/pull/N/merge — GitHub's TEST-MERGE (base + PR head), not the PR
// branch — and GitHub refreshes it lazily: measured on live PR #2014 its base
// parent was 115 commits and ~9h33m behind main, across which stamp-ledger.md
// drifted 94 lines. So overlaying the WHOLE directory hands the certifier a
// hours-old ledger at merge time, and a resident bound only by a fresh sealed
// registry line could certify at check and be refused at merge.
//
// The fix is scope: the step's own comment already says "Only the resident-pages
// paths come in", so the pathspec is narrowed to handle folders and the
// top-level ledgers stay base truth in BOTH passes.
//
// This test runs the REAL pathspec, parsed out of the REAL workflow, through a
// REAL git checkout — because git pathspec globbing lies and a model of it is
// not evidence. In a bare pathspec `*` crosses `/`, so the obvious
// ':(exclude)WHITE_PAGES/*.md' also excludes alice/ADDRESS.md and collapses the
// whole overlay. It fails in BOTH directions: a top-level file entering the
// overlay fails, and a handle file failing to enter fails.

function shellTokens(s) {
  const out = []; let cur = '', quote = null, quoted = false;
  for (const ch of s) {
    if (quote) { if (ch === quote) quote = null; else cur += ch; continue; }
    if (ch === "'" || ch === '"') { quote = ch; quoted = true; continue; }
    if (/\s/.test(ch)) { if (cur || quoted) { out.push(cur); cur = ''; quoted = false; } continue; }
    cur += ch;
  }
  if (cur || quoted) out.push(cur);
  return out;
}

test('the merge-time overlay reaches handle folders and never a top-level ledger', () => {
  const REPO_ROOT = join(HERE, '..');
  const wf = readFileSync(join(REPO_ROOT, '.github', 'workflows', 'witness.yml'), 'utf8');
  const overlays = [...wf.matchAll(/git checkout FETCH_HEAD -- (.+)/g)].map((m) => shellTokens(m[1].trim()));
  assert.ok(overlays.length > 0, 'the overlay step vanished — re-derive what the certifier reads at merge time');

  // The real top-level files that must stay base truth, read from the town.
  const topLevel = readdirSync(join(REPO_ROOT, 'WHITE_PAGES'), { withFileTypes: true })
    .filter((e) => e.isFile()).map((e) => e.name).sort();
  assert.ok(topLevel.includes('stamp-ledger.md'), 'the ledger this guards is not where this test thinks');

  for (const pathspec of overlays) {
    const repo = mkdtempSync(join(tmpdir(), 'overlay-'));
    const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      git('init', '-q', '.'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
      const w = join(repo, 'WHITE_PAGES');
      mkdirSync(join(w, 'alice', 'outbox'), { recursive: true });
      mkdirSync(join(w, 'bob'), { recursive: true });
      for (const f of topLevel) writeFileSync(join(w, f), 'BASE\n');
      writeFileSync(join(w, 'alice', 'ADDRESS.md'), 'BASE\n');
      writeFileSync(join(w, 'alice', 'outbox', 'letter.md'), 'BASE\n');
      writeFileSync(join(w, 'bob', 'ADDRESS.md'), 'BASE\n');
      git('add', '-A'); git('commit', '-qm', 'base');
      const base = git('rev-parse', 'HEAD').trim();

      // The PR: rewrites everything it can reach, and adds a room (a join PR).
      git('checkout', '-qb', 'pr');
      for (const f of topLevel) writeFileSync(join(w, f), 'PR\n');
      writeFileSync(join(w, 'alice', 'ADDRESS.md'), 'PR\n');
      writeFileSync(join(w, 'alice', 'outbox', 'letter.md'), 'PR\n');
      writeFileSync(join(w, 'bob', 'ADDRESS.md'), 'PR\n');
      mkdirSync(join(w, 'carol'), { recursive: true });
      writeFileSync(join(w, 'carol', 'ADDRESS.md'), 'PR\n');
      git('add', '-A'); git('commit', '-qm', 'pr');
      git('checkout', '-q', base);

      // The overlay, exactly as the workflow spells it.
      git('checkout', 'pr', '--', ...pathspec);
      const read = (...p) => readFileSync(join(w, ...p), 'utf8').trim();

      for (const f of topLevel) {
        assert.equal(read(f), 'BASE',
          `the overlay [${pathspec.join(' ')}] pulled WHITE_PAGES/${f} from the PR. ` +
          'A top-level ledger is not a resident page, and the certifier reads it at merge time.');
      }
      assert.equal(read('alice', 'ADDRESS.md'), 'PR', 'the overlay stopped reaching a resident page');
      assert.equal(read('alice', 'outbox', 'letter.md'), 'PR', 'the overlay stopped reaching nested resident pages');
      assert.equal(read('bob', 'ADDRESS.md'), 'PR', 'the overlay stopped reaching a second resident');
      assert.equal(read('carol', 'ADDRESS.md'), 'PR', 'the overlay stopped reaching a NEW room — join PRs would lint against a room that is not there');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  }
});

test('rule 2c asks "the handle free on base" of the BASE COMMIT — the overlaid working tree does not count', () => {
  // The law, quoted (tools/witness.mjs § 2c): "exactly one new WHITE_PAGES/<handle>/ADDRESS.md ...
  // and the handle free on base." The workflow overlays the PR's handle folders into the tree
  // before `merge` re-evaluates, so on disk the joining room always exists by then. Before
  // 2026-09-04, existsSync read the overlay and every pen join was routed as "already stands"
  // (#2097, #2344, #2345, #2429, #2445, #2450). CAN-FAIL: replace handleStandsOnBase with the
  // existsSync line and the carol assertion below goes red.
  const repo = mkdtempSync(join(tmpdir(), 'base-truth-'));
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    git('init', '-q', '.'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't');
    const w = join(repo, 'WHITE_PAGES');
    mkdirSync(join(w, 'alice'), { recursive: true });
    writeFileSync(join(w, 'alice', 'ADDRESS.md'), 'BASE\n');
    git('add', '-A'); git('commit', '-qm', 'base');
    const base = git('rev-parse', 'HEAD').trim();
    git('checkout', '-qb', 'pr');
    mkdirSync(join(w, 'carol', 'inbox'), { recursive: true });
    writeFileSync(join(w, 'carol', 'ADDRESS.md'), 'PR\n');
    writeFileSync(join(w, 'carol', 'inbox', '.gitkeep'), '');
    git('add', '-A'); git('commit', '-qm', 'pr');
    git('checkout', '-q', base);
    git('checkout', 'pr', '--', ':(glob)WHITE_PAGES/*/**');   // the workflow's overlay, exactly
    assert.ok(existsSync(join(w, 'carol', 'ADDRESS.md')), 'the overlay did not land — this test proves nothing');
    assert.equal(handleStandsOnBase('carol', repo), false, 'a room the PR founds is FREE on base even though the overlay put it on disk');
    assert.equal(handleStandsOnBase('alice', repo), true, 'a room base already holds stands');
    assert.equal(handleStandsOnBase('nobody', repo), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('rule 2c admits a join that carries its OWN pin, and nothing else in the pin file (the Luminari class)', () => {
  // The law, quoted (tools/witness.mjs § 2c): "the exact join shape INCLUDES the join's own pin —
  // tools/github-ids.json with exactly one added entry, the joining handle at the verified id".
  // 2026-09-04: four pen joins (#2429, #2445, #2450, #2479) merged mechanically and unpinned; the
  // clock skipped all four as "has minted history" because the welcome mint beat it. CAN-FAIL: make
  // pinJudgment return null unconditionally and every red assertion below goes green.
  const base = { alice: { login: 'Alice', id: 1, pinned: '2026-01-01' } };
  const ok = { ...base, carol: { login: 'CarolGH', id: 4242, pinned: '2026-09-04' } };
  assert.equal(pinJudgment({ base, head: ok, handle: 'carol', verifiedId: 4242, verifiedLogin: 'carolgh' }), null, 'the join\'s own pin is admitted');
  assert.match(pinJudgment({ base, head: { ...ok, carol: { ...ok.carol, id: 9 } }, handle: 'carol', verifiedId: 4242, verifiedLogin: 'carolgh' }), /not the verified id 4242/);
  assert.match(pinJudgment({ base, head: { ...ok, carol: { ...ok.carol, login: 'Mallory' } }, handle: 'carol', verifiedId: 4242, verifiedLogin: 'carolgh' }), /not the verified @carolgh/);
  assert.match(pinJudgment({ base, head: { ...ok, alice: { ...base.alice, id: 2 } }, handle: 'carol', verifiedId: 4242, verifiedLogin: 'carolgh' }), /re-binds `alice`/, 'a re-binding riding a join is a human ceremony');
  assert.match(pinJudgment({ base, head: { carol: ok.carol }, handle: 'carol', verifiedId: 4242, verifiedLogin: 'carolgh' }), /removes the pin of `alice`/);
  assert.match(pinJudgment({ base, head: { ...ok, dave: { login: 'D', id: 5, pinned: '2026-09-04' } }, handle: 'carol', verifiedId: 4242, verifiedLogin: 'carolgh' }), /not only the joining handle/);
  assert.match(pinJudgment({ base, head: base, handle: 'carol', verifiedId: 4242, verifiedLogin: 'carolgh' }), /adds no pin at all/);
  assert.match(pinJudgment({ base, head: { ...ok, carol: { login: 'CarolGH', id: 4242 } }, handle: 'carol', verifiedId: 4242, verifiedLogin: 'carolgh' }), /without a dated/);
  assert.match(pinJudgment({ base: null, head: ok, handle: 'carol', verifiedId: 4242, verifiedLogin: 'carolgh' }), /does not parse/);
});
