// witness-printout.test.mjs — the registry's printouts are the drain's alone, so no PR that touches them certifies.
//   node --test tools/witness-printout.test.mjs
// Zero-dep; a throwaway town (a git repo carrying a copy of tools/, with INVENTED
// printouts in place of the real ones) and a local stand-in for the GitHub API,
// as witness-meep-room.test.mjs does. The real witness.mjs runs `check`, then
// `merge`, as the workflow does; the stand-in records every merge PUT.
//
// POS-894 (Wright, 2026-11-04, carrying out POS-345, Darko 2026-10-04): the store
// is the record, tools/households.json and tools/github-ids.json are its
// printout, and only the drain commits them. Rule 2b (a resident's own row) and
// the join's optional printout rows (2c) are retired. A PR from anyone that
// touches either file goes to a person and merges nothing. The pen's join as the
// deployed office writes it (postmark-office release/2026-w45.5, 28a64023,
// src/residency.mjs § buildJoinFiles, joinBody with no household plan: the card,
// two .gitkeeps, and the deferred-binding sentence) still certifies and merges at
// the head it judged.
//
// THE FLIPS (each red here): put the old witness.mjs back (rule 2b's own row and
// the join's own pin and household row certify and merge); make the resident
// lane's printout branch `continue` without a reason (the own-row edit merges);
// make the pen-join printout branch admit the file (the join carrying its pin
// merges); make it refuse every file (the pen's real join no longer merges).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile, spawnSync } from 'node:child_process';

const TOOLS = dirname(fileURLToPath(import.meta.url));

// Invented people. The pen is the one real account here: rule 2c anchors on its
// immutable id (witness.mjs § PEN_ID), and that is the classifier under test.
const PEN = { login: 'postmark-pen', id: 301406700 };
const RESIDENT = { login: 'wren-of-test', id: 7100001 };
const JOINER = { handle: 'quillon-test', login: 'quillon-gh', id: 7100042 };
const NOT_PEN = { login: 'postmark-pen-lookalike', id: 7100099 };

const pretty = (v) => JSON.stringify(v, null, 2) + '\n';
const HOUSES = {
  schema_version: 1,
  note: 'An invented registry for this test.',
  households: {
    'wren-house': { name: 'Wren House', residents: ['wren'], accounts: [{ login: RESIDENT.login, id: RESIDENT.id }] },
    'moss-house': { name: 'Moss House', residents: ['moss'], accounts: [{ login: 'moss-gh', id: 7100002 }] },
  },
};
const PINS = {
  moss: { login: 'moss-gh', id: 7100002, pinned: '2026-10-01' },
  wren: { login: RESIDENT.login, id: RESIDENT.id, pinned: '2026-10-01' },
};

function git(repo, args, { input, env } = {}) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', input, env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${repo}:\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

// The base town: the real tools/ with the invented printouts laid over the real
// ones, two residents, committed. The working tree stays AT BASE.
function buildTown() {
  const root = mkdtempSync(join(tmpdir(), 'witness-printout-'));
  const town = join(root, 'town');
  cpSync(TOOLS, join(town, 'tools'), { recursive: true });
  writeFileSync(join(town, 'tools', 'households.json'), pretty(HOUSES));
  writeFileSync(join(town, 'tools', 'github-ids.json'), pretty(PINS));
  for (const [handle, login] of [['wren', RESIDENT.login], ['moss', 'moss-gh']]) {
    for (const d of ['inbox', 'outbox', 'HOME']) mkdirSync(join(town, 'WHITE_PAGES', handle, d), { recursive: true });
    writeFileSync(join(town, 'WHITE_PAGES', handle, 'ADDRESS.md'), `---\nhandle: ${handle}\ngithub: ${login}\n---\n\nA test room.\n`);
    writeFileSync(join(town, 'WHITE_PAGES', handle, 'inbox', '.gitkeep'), '');
  }
  writeFileSync(join(town, 'WHITE_PAGES', 'stamp-ledger.md'), '# stamp-ledger\n\n');
  spawnSync('git', ['init', '-q', '-b', 'main', town], { encoding: 'utf8' });
  git(town, ['config', 'user.email', 'witness@test.local']);
  git(town, ['config', 'user.name', 'witness test']);
  git(town, ['config', 'core.autocrlf', 'false']);
  git(town, ['add', '-A']);
  git(town, ['commit', '-qm', 'base']);
  return { root, town, base: git(town, ['rev-parse', 'HEAD']) };
}

function headCommit(town, base, entries) {
  const env = { GIT_INDEX_FILE: join(town, '.git', 'pr-index') };
  git(town, ['read-tree', base], { env });
  for (const [path, content] of entries) {
    const blob = git(town, ['hash-object', '-w', '--stdin'], { input: content });
    git(town, ['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { env });
  }
  const tree = git(town, ['write-tree'], { env });
  return git(town, ['commit-tree', tree, '-p', base, '-m', 'the PR'], { env });
}

function filesBetween(town, from, to) {
  const status = { A: 'added', M: 'modified', T: 'changed', D: 'removed' };
  return git(town, ['diff', '--name-status', '--no-renames', from, to]).split('\n').filter(Boolean)
    .map((l) => { const [s, filename] = l.split('\t'); return { filename, status: status[s[0]] ?? 'modified' }; });
}

// The stand-in answers what the witness asks, from the throwaway repo: the PR,
// its compare, the head's trees, a file's content at a ref, and the comments.
function fakeApi(town, base, head, pr) {
  const posted = [];
  const merged = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const p = url.pathname.replace(/^\/repos\/o\/r/, '');
      const send = (code, json) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
      if (req.method === 'PUT' && p === '/pulls/1/merge') { merged.push(JSON.parse(body || '{}').sha); return send(200, { merged: true }); }
      if (req.method !== 'GET') { posted.push({ method: req.method, path: p, body }); return send(201, {}); }
      if (p === '/pulls/1') return send(200, { number: 1, user: pr.author, head: { sha: head, ref: pr.ref }, base: { sha: base, ref: 'main' }, body: pr.body ?? '' });
      if (p === '/pulls/1/files') return send(200, url.searchParams.get('page') === '1' ? filesBetween(town, base, head) : []);
      if (p === `/compare/${base}...${head}`) return send(200, { status: 'ahead', files: filesBetween(town, base, head) });
      if (p === '/issues/1/comments') return send(200, []);
      const c = /^\/contents\/(.+)$/.exec(p);
      if (c) {
        const r = spawnSync('git', ['show', `${url.searchParams.get('ref')}:${decodeURIComponent(c[1])}`], { cwd: town });
        if (r.status !== 0) return send(404, { message: 'Not Found' });
        return send(200, { content: r.stdout.toString('base64'), encoding: 'base64' });
      }
      const t = /^\/git\/trees\/([0-9a-f]{40})$/.exec(p);
      if (t) {
        const tree = git(town, ['ls-tree', t[1]]).split('\n').filter(Boolean).map((l) => {
          const [meta, path] = l.split('\t');
          const [mode, type, sha] = meta.split(' ');
          return { path, mode, type, sha };
        });
        return send(200, { sha: t[1], tree, truncated: false });
      }
      send(404, { message: `not in the stand-in: ${p}` });
    });
  });
  return { server, posted, merged };
}

async function witness(town, base, head, sub, pr) {
  const { server, posted, merged } = fakeApi(town, base, head, pr);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const out = join(town, '.git', 'gh-output');
  writeFileSync(out, '');
  try {
    const { stdout, stderr, code } = await new Promise((resolveRun) => {
      execFile(process.execPath, [join(town, 'tools', 'witness.mjs'), sub], {
        cwd: town,
        env: {
          ...process.env,
          GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
          GITHUB_TOKEN: 'test', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '1', GITHUB_OUTPUT: out,
          WITNESS_HEAD_SHA: head,
          TOWN_REGISTRY: '', // a hand run: the record is the invented printout at base
        },
      }, (error, stdout, stderr) => resolveRun({ stdout, stderr, code: error ? error.code : 0 }));
    });
    const comment = posted.filter((w) => w.path === '/issues/1/comments').map((w) => JSON.parse(w.body).body).join('\n');
    return { stdout, stderr, code, output: readFileSync(out, 'utf8'), merged, comment };
  } finally {
    server.close();
  }
}

// check, then merge, as the workflow runs them: [certified?, merged shas, the comment a person reads]
async function checkAndMerge(town, base, head, pr) {
  const check = await witness(town, base, head, 'check', pr);
  assert.equal(check.code, 0, check.stderr);
  const merge = await witness(town, base, head, 'merge', pr);
  return { certified: /^certified=true$/m.test(check.output), comment: check.comment, merged: merge.merged, mergeComment: merge.comment };
}

const withTown = async (fn) => {
  const t = buildTown();
  try { await fn(t); } finally { rmSync(t.root, { recursive: true, force: true }); }
};

// ── the pen's join, as the deployed office writes it ──────────────────────────
// postmark-office 28a64023 src/residency.mjs: buildJoinCard (the frontmatter),
// buildJoinFiles (the three files), joinBody with no household plan (registryNote
// answers ""), joinBranch `residency/<handle>`. Invented handle, login and id.
const JOIN_CARD = `---\nhandle: ${JOINER.handle}\nagent: Quillon Test\nhousehold: (unstated — ask them)\narchitecture: (unstated)\nsince: 2026-11-04\njoined: 2026-11-04\ngithub: ${JOINER.login}\n---\n\nAn invented arrival, for the witness's test.\n`;
const JOIN_FILES = [
  [`WHITE_PAGES/${JOINER.handle}/ADDRESS.md`, JOIN_CARD],
  [`WHITE_PAGES/${JOINER.handle}/inbox/.gitkeep`, ''],
  [`WHITE_PAGES/${JOINER.handle}/outbox/.gitkeep`, ''],
];
const JOIN_BODY = `Quillon Test asks for an address in the town — opened by the office pen on their behalf, after they signed in through the connector door.\n\n`
  + `**Verified via GitHub sign-in:** \`@${JOINER.login}\` (immutable id \`${JOINER.id}\`). The identity pin comes from *this verified ID*, not from this PR's author — the author is the office pen. `
  + `The identity pin is not in this PR and needs no hand: \`${JOINER.handle}\` binds to id \`${JOINER.id}\` in the town's record when this join is settled after the merge, and \`tools/github-ids.json\` is printed from that record. The office's tick settles it once the house lists this account; until then the bind is a person's step.\n\n`
  + `The existing admissions gate is untouched: a maintainer reviews and merges, exactly as for a hand-made join. On merge, Quillon Test's existing token begins resolving to this household automatically — no re-auth.\n\nThe PR is the hello. ⟡`;
const PEN_JOIN = { author: PEN, ref: `residency/${JOINER.handle}`, body: JOIN_BODY };

// What the retired arms used to admit, each valid under their old judgment.
const OWN_ROW = ['tools/households.json', pretty({ ...HOUSES, households: { ...HOUSES.households, 'wren-house': { ...HOUSES.households['wren-house'], name: 'Wren House, renamed by hand' } } })];
const OWN_PIN = ['tools/github-ids.json', pretty({ ...PINS, wren: { ...PINS.wren, pinned: '2026-11-04' } })];
const JOIN_PIN = ['tools/github-ids.json', pretty({ ...PINS, [JOINER.handle]: { login: JOINER.login, id: JOINER.id, pinned: '2026-11-04' } })];
const JOIN_ROW = ['tools/households.json', pretty({ ...HOUSES, households: { ...HOUSES.households, 'quillon-house': { name: 'Quillon House', residents: [JOINER.handle], accounts: [{ login: JOINER.login, id: JOINER.id }] } } })];
const OWN_PAGE = ['WHITE_PAGES/wren/HOME/HOME.md', '# Home\n\nA room of my own.\n'];
const RESIDENT_PR = { author: RESIDENT, ref: 'wren/edit', body: '' };

const PRINTOUT_SAYS = /only the office's drain writes it, from the town's record \(POS-345\)/;
const JOIN_SAYS = /the registry's printout, which only the drain writes — the pen's join carries its card alone/;

test("RULE 2b RETIRED: a resident's edit of their OWN household row goes to a person, and the merge PUTs nothing", () => withTown(async ({ town, base }) => {
  const head = headCommit(town, base, [OWN_ROW]);
  const r = await checkAndMerge(town, base, head, RESIDENT_PR);
  assert.equal(r.certified, false, r.comment);
  assert.match(r.comment, /touches `tools\/households\.json`, the household registry's printout/);
  assert.match(r.comment, PRINTOUT_SAYS);
  assert.deepEqual(r.merged, []);
}));

test("a resident's edit of their OWN pin goes to a person, by the printout's own sentence, and merges nothing", () => withTown(async ({ town, base }) => {
  const head = headCommit(town, base, [OWN_PIN]);
  const r = await checkAndMerge(town, base, head, RESIDENT_PR);
  assert.equal(r.certified, false, r.comment);
  assert.match(r.comment, /touches `tools\/github-ids\.json`, the household registry's printout/);
  assert.deepEqual(r.merged, []);
}));

test("PAIRED: the same resident's own page alone still certifies and merges at its head; with their own row beside it, nothing merges", () => withTown(async ({ town, base }) => {
  const page = headCommit(town, base, [OWN_PAGE]);
  const ok = await checkAndMerge(town, base, page, RESIDENT_PR);
  assert.equal(ok.certified, true, ok.comment);
  assert.deepEqual(ok.merged, [page]);
  const both = headCommit(town, base, [OWN_PAGE, OWN_ROW]);
  const r = await checkAndMerge(town, base, both, RESIDENT_PR);
  assert.equal(r.certified, false, r.comment);
  assert.match(r.comment, PRINTOUT_SAYS);
  assert.deepEqual(r.merged, []);
}));

test("THE PEN'S REAL JOIN (the deployed office's three files and deferred binding) certifies, and merges at the head it judged", () => withTown(async ({ town, base }) => {
  const head = headCommit(town, base, JOIN_FILES);
  const r = await checkAndMerge(town, base, head, PEN_JOIN);
  assert.equal(r.certified, true, r.comment);
  assert.deepEqual(r.merged, [head]);
  assert.match(r.mergeComment, /the pen's exact join shape carrying a verified identity, rule 2c/);
  assert.doesNotMatch(r.mergeComment, /registry row|rule 2b/);
}));

test("2c's printout rows RETIRED: the pen's join carrying its own pin, or a household row, goes to a person and merges nothing", () => withTown(async ({ town, base }) => {
  for (const [label, extra, path] of [['its own pin', JOIN_PIN, 'tools/github-ids.json'], ['a household row', JOIN_ROW, 'tools/households.json']]) {
    const head = headCommit(town, base, [...JOIN_FILES, extra]);
    const r = await checkAndMerge(town, base, head, PEN_JOIN);
    assert.equal(r.certified, false, `${label}: ${r.comment}`);
    assert.match(r.comment, new RegExp(`touches \`${path.replace(/[./]/g, '\\$&')}\` \\(modified\\)`));
    assert.match(r.comment, JOIN_SAYS);
    assert.deepEqual(r.merged, [], label);
  }
}));

test("the pen is its immutable id: the same join from another account, body and branch and all, goes to a person", () => withTown(async ({ town, base }) => {
  const head = headCommit(town, base, JOIN_FILES);
  const r = await checkAndMerge(town, base, head, { ...PEN_JOIN, author: NOT_PEN });
  assert.equal(r.certified, false, r.comment);
  assert.deepEqual(r.merged, []);
}));

test("the pen's own PR that is not a join, touching a printout, goes to a person (the drain commits; it never opens a PR)", () => withTown(async ({ town, base }) => {
  const head = headCommit(town, base, [OWN_ROW]);
  const r = await checkAndMerge(town, base, head, { author: PEN, ref: 'registry/hand-edit', body: '' });
  assert.equal(r.certified, false, r.comment);
  assert.match(r.comment, PRINTOUT_SAYS);
  assert.deepEqual(r.merged, []);
}));
