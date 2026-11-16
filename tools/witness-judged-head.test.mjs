// witness-judged-head.test.mjs — the witness merges the head it judged, or nothing.
//   node --test tools/witness-judged-head.test.mjs
// Zero-dep; a throwaway town (a git repo carrying a copy of tools/) and a
// local stand-in for the GitHub API that answers from that repo, as
// witness-file-modes.test.mjs does. No real PR is raced: the stand-in moves
// the head itself, at the moments a push could land.
//
// POS-396 (witness.mjs § filesAtHead, JUDGED_HEAD, the merge's `sha`):
//   - the merge names the head it certified, so GitHub merges that commit or
//     answers 409, and a moved head merges nothing;
//   - the files judged are read at that head, never "the PR's files now";
//   - a run started for one head judges, routes and merges nothing once the
//     PR's head is another (witness.yml passes the event's head);
//   - witness.yml ties the test merge its later checks read to that same head.
//
// THE FLIPS: drop `sha` from the merge body (the push test merges the pushed
// head); read the files from /pulls/N/files (the files test certifies); drop
// the JUDGED_HEAD return in evaluate() (the moved-run test certifies).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile, spawnSync } from 'node:child_process';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TOOLS, '..');

function git(repo, args, { input, env } = {}) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', input, env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${repo}:\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

// The base town: the real tools/, one resident (alice, bound by her `github:`
// login), committed. The working tree stays AT BASE, as the workflow's
// checkout does; PR heads are commits built off to the side.
function buildTown() {
  const root = mkdtempSync(join(tmpdir(), 'witness-head-'));
  const town = join(root, 'town');
  cpSync(TOOLS, join(town, 'tools'), { recursive: true });
  for (const d of ['inbox', 'outbox', 'HOME']) mkdirSync(join(town, 'WHITE_PAGES', 'alice', d), { recursive: true });
  writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'ADDRESS.md'), '---\nhandle: alice\ngithub: alice\n---\n\nA test room.\n');
  writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'inbox', '.gitkeep'), '');
  writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'outbox', '.gitkeep'), '');
  writeFileSync(join(town, 'WHITE_PAGES', 'stamp-ledger.md'), '# stamp-ledger\n\n');
  spawnSync('git', ['init', '-q', '-b', 'main', town], { encoding: 'utf8' });
  git(town, ['config', 'user.email', 'witness@test.local']);
  git(town, ['config', 'user.name', 'witness test']);
  git(town, ['config', 'core.autocrlf', 'false']);
  git(town, ['add', '-A']);
  git(town, ['commit', '-qm', 'base']);
  return { root, town, base: git(town, ['rev-parse', 'HEAD']) };
}

// A head commit on `parent` adding `entries` ([path, content]), written
// through a private index so the working tree never sees it.
function headCommit(town, parent, entries) {
  const env = { GIT_INDEX_FILE: join(town, '.git', 'pr-index') };
  git(town, ['read-tree', parent], { env });
  for (const [path, content] of entries) {
    const blob = git(town, ['hash-object', '-w', '--stdin'], { input: content });
    git(town, ['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { env });
  }
  const tree = git(town, ['write-tree'], { env });
  return git(town, ['commit-tree', tree, '-p', parent, '-m', 'the PR'], { env });
}

const PAGE = ['WHITE_PAGES/alice/HOME/HOME.md', '# alice\n\nMy home.\n'];
const MACHINE = ['tools/ferry.mjs', '// not alice\'s to change\n'];

function filesBetween(town, from, to) {
  const status = { A: 'added', M: 'modified', T: 'changed', D: 'removed' };
  return git(town, ['diff', '--name-status', '--no-renames', from, to]).split('\n').filter(Boolean)
    .map((l) => { const [s, filename] = l.split('\t'); return { filename, status: status[s[0]] ?? 'modified' }; });
}

// The API as the witness asks it. `state.head` is the PR's head as GitHub
// would report it right now; `state.filesHead` (default: the head) is the
// commit /pulls/1/files answers for; `state.pushAtMerge` is a push that lands
// just before the merge PUT is handled. The merge honours `sha` the way
// GitHub's does: a mismatch is 409 and nothing merges.
function fakeApi(town, base, state) {
  const posted = [];
  const merged = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const p = url.pathname.replace(/^\/repos\/o\/r/, '');
      const send = (code, json) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
      if (req.method === 'PUT' && p === '/pulls/1/merge') {
        if (state.pushAtMerge) state.head = state.pushAtMerge;
        const want = JSON.parse(body || '{}').sha;
        if (want && want !== state.head) return send(409, { message: 'Head branch was modified. Review and try the merge again.' });
        merged.push(state.head);
        return send(200, { merged: true, sha: 'f'.repeat(40) });
      }
      if (req.method !== 'GET') { posted.push({ method: req.method, path: p, body }); return send(201, {}); }
      if (p === '/pulls/1') return send(200, { number: 1, user: { login: 'alice', id: 4242 }, head: { sha: state.head, ref: 'alice/home' }, base: { sha: base, ref: 'main' }, body: '' });
      if (p === '/pulls/1/files') return send(200, url.searchParams.get('page') === '1' ? filesBetween(town, base, state.filesHead ?? state.head) : []);
      const c = /^\/compare\/([0-9a-f]{40})\.\.\.([0-9a-f]{40})$/.exec(p);
      if (c) return send(200, { status: 'ahead', files: filesBetween(town, git(town, ['merge-base', c[1], c[2]]), c[2]) });
      if (p === '/issues/1/comments') return send(200, []);
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

async function witness(town, base, state, args, extraEnv = {}) {
  const { server, posted, merged } = fakeApi(town, base, state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const out = join(town, '.git', 'gh-output');
  writeFileSync(out, '');
  try {
    const { stdout, stderr, code } = await new Promise((resolveRun) => {
      execFile(process.execPath, [join(town, 'tools', 'witness.mjs'), ...args], {
        cwd: town,
        env: {
          ...process.env,
          GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
          GITHUB_TOKEN: 'test', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '1', GITHUB_OUTPUT: out,
          WITNESS_HEAD_SHA: '',
          ...extraEnv,
        },
      }, (error, stdout, stderr) => resolveRun({ stdout, stderr, code: error ? error.code : 0 }));
    });
    return { stdout, stderr, code, output: readFileSync(out, 'utf8'), posted, merged };
  } finally {
    server.close();
  }
}

const withTown = async (fn) => {
  const t = buildTown();
  try { await fn(t); } finally { rmSync(t.root, { recursive: true, force: true }); }
};

test('the merge names the head it judged, and that head is what merges', () => withTown(async ({ town, base }) => {
  const head = headCommit(town, base, [PAGE]);
  const r = await witness(town, base, { head }, ['merge']);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.merged, [head]);
  assert.match(r.stdout, /witness: merged\./);
}));

test('a push between the judgment and the merge merges nothing, and routes nothing', () => withTown(async ({ town, base }) => {
  const judged = headCommit(town, base, [PAGE]);
  const pushed = headCommit(town, judged, [MACHINE]);
  const r = await witness(town, base, { head: judged, pushAtMerge: pushed }, ['merge']);
  assert.deepEqual(r.merged, [], `the witness merged a head it never judged:\n${r.stdout}${r.stderr}`);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /refused to merge — the head moved after [0-9a-f]{40} was judged/);
  assert.deepEqual(r.posted, [], 'a moved head is the new push\'s run to speak for, not this one\'s');
}));

test('the files judged are the files of the head that merges, not the PR\'s files a moment later', () => withTown(async ({ town, base }) => {
  // The PR read names head A (it reaches into tools/); by the time the files
  // list is asked for, a push has made the PR's files only alice's page.
  const a = headCommit(town, base, [PAGE, MACHINE]);
  const b = headCommit(town, base, [PAGE]);
  const r = await witness(town, base, { head: a, filesHead: b }, ['check']);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.output, /^certified=false$/m, `head A certified on head B's files:\n${r.stdout}`);
  assert.match(r.stdout, /touches `tools\/ferry\.mjs`/);
}));

test('a run started for one head judges, merges and routes nothing once the PR\'s head is another', () => withTown(async ({ town, base }) => {
  const started = headCommit(town, base, [PAGE, MACHINE]);
  const now = headCommit(town, base, [PAGE]);
  const env = { WITNESS_HEAD_SHA: started };

  const check = await witness(town, base, { head: now }, ['check'], env);
  assert.equal(check.code, 0, check.stderr);
  assert.match(check.output, /^certified=false$/m, `the run certified a head it was not started for:\n${check.stdout}`);
  assert.match(check.stdout, /not judged — the PR's head is [0-9a-f]{40}, not [0-9a-f]{40}/);
  assert.deepEqual(check.posted, []);

  const merge = await witness(town, base, { head: now }, ['merge'], env);
  assert.equal(merge.code, 1);
  assert.deepEqual(merge.merged, []);
  assert.deepEqual(merge.posted, []);

  const route = await witness(town, base, { head: now }, ['route', 'lint found ERRORs'], env);
  assert.equal(route.code, 0, route.stderr);
  assert.match(route.stdout, /not routed/);
  assert.deepEqual(route.posted, []);

  // The same run on its own head is unchanged: it judges and merges.
  const own = await witness(town, base, { head: now }, ['merge'], { WITNESS_HEAD_SHA: now });
  assert.equal(own.code, 0, own.stderr);
  assert.deepEqual(own.merged, [now]);
}));

// witness.yml: the step that ties GitHub's test merge (what lint, size and
// envelope read) to the judged head. Its shell is taken from the workflow
// itself and run against a scratch origin carrying refs/pull/1/merge.
function stepRun(wf, id) {
  const lines = wf.split('\n');
  const at = lines.findIndex((l) => l.trim() === `id: ${id}`);
  assert.ok(at > 0, `witness.yml has no step with id ${id}`);
  const runAt = lines.findIndex((l, i) => i > at && /^\s+run: \|\s*$/.test(l));
  const indent = lines[runAt + 1].match(/^\s*/)[0].length;
  const body = [];
  for (let i = runAt + 1; i < lines.length; i++) {
    if (lines[i].trim() && lines[i].match(/^\s*/)[0].length < indent) break;
    body.push(lines[i].slice(indent));
  }
  return body.join('\n');
}

test('witness.yml ties the test merge to the judged head, and nothing after it fetches again', () => withTown(async ({ root, town, base }) => {
  const wf = readFileSync(join(REPO_ROOT, '.github', 'workflows', 'witness.yml'), 'utf8').replace(/\r/g, '');
  assert.match(wf, /WITNESS_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  const script = stepRun(wf, 'pin');

  // GitHub's test merge: base + the PR head, at refs/pull/1/merge on origin.
  const judged = headCommit(town, base, [PAGE]);
  const tree = git(town, ['rev-parse', `${judged}^{tree}`]);
  const testMerge = git(town, ['commit-tree', tree, '-p', base, '-p', judged, '-m', 'test merge']);
  git(town, ['update-ref', 'refs/pull/1/merge', testMerge]);
  const runner = join(root, 'runner');
  git(root, ['clone', '-q', town, runner]);

  const pin = (head) => {
    const out = join(root, `out-${head.slice(0, 7)}`);
    writeFileSync(out, '');
    const r = spawnSync('bash', ['-e', '-c', script], {
      cwd: runner, encoding: 'utf8',
      env: { ...process.env, PR_NUMBER: '1', WITNESS_HEAD_SHA: head, GITHUB_OUTPUT: out },
    });
    return { ...r, output: readFileSync(out, 'utf8') };
  };
  const same = pin(judged);
  assert.equal(same.status, 0, same.stderr);
  assert.match(same.output, /^judged=true$/m);
  assert.equal(git(runner, ['rev-parse', 'FETCH_HEAD']), testMerge, 'FETCH_HEAD is not the test merge the later steps read');

  const other = pin(headCommit(town, base, [MACHINE]));
  assert.equal(other.status, 0, other.stderr);
  assert.match(other.output, /^judged=false$/m, `a test merge of another head passed:\n${other.stdout}`);

  // Every later reader of FETCH_HEAD runs only on a tied merge, and none fetches.
  const lint = stepRun(wf, 'lint');
  assert.doesNotMatch(lint, /git fetch/);
  assert.match(wf, /id: lint\n\s+if: .*steps\.pin\.outputs\.judged == 'true'/);
  assert.equal([...wf.matchAll(/git fetch/g)].length, 1, 'a second fetch could move FETCH_HEAD off the tied merge');
}));
