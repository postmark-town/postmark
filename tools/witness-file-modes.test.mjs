// witness-file-modes.test.mjs — the witness certifies plain files only.
//   node --test tools/witness-file-modes.test.mjs
// Zero-dep; a throwaway town (a git repo carrying a copy of tools/) and a
// local stand-in for the GitHub API that answers from that repo.
//
// Rule 5e (witness.mjs § headModes, modeJudgment): every added or changed file
// is looked up in the PR head's own git tree, and anything that is not a plain
// file — a symbolic link (mode 120000), a submodule (160000), or an entry the
// tree does not show — goes to a person, by name. The files list the witness
// reads names paths and statuses but not modes, so the mode is read from the
// tree.
//
// THE FLIP is the rule 5e loop removed from `evaluate()`: the link PR below
// then prints `certified=true`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile, spawnSync } from 'node:child_process';
import { modeJudgment } from './witness.mjs';

const TOOLS = dirname(fileURLToPath(import.meta.url));

function git(repo, args, { input, env } = {}) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', input, env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${repo}:\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

// The base town: the real tools/, one resident (alice, bound by her `github:`
// login), committed. The working tree stays AT BASE, as the workflow's
// checkout does; the PR head is a second commit built off to the side, so
// nothing the head carries is ever on disk.
function buildTown() {
  const root = mkdtempSync(join(tmpdir(), 'witness-modes-'));
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

// A head commit on top of base adding `entries` ([path, mode, content]),
// written through a private index so the working tree never sees it.
function headCommit(town, base, entries) {
  const env = { GIT_INDEX_FILE: join(town, '.git', 'pr-index') };
  git(town, ['read-tree', base], { env });
  for (const [path, mode, content] of entries) {
    const blob = git(town, ['hash-object', '-w', '--stdin'], { input: content });
    git(town, ['update-index', '--add', '--cacheinfo', `${mode},${blob},${path}`], { env });
  }
  const tree = git(town, ['write-tree'], { env });
  return git(town, ['commit-tree', tree, '-p', base, '-m', 'the PR'], { env });
}

// The API, as far as `witness.mjs check` asks it: the PR, its files, the
// head's trees, and the comment/label writes, recorded.
function fakeApi(town, base, head) {
  const posted = [];
  const status = { A: 'added', M: 'modified', T: 'changed', D: 'removed' };
  const files = git(town, ['diff', '--name-status', '--no-renames', base, head]).split('\n').filter(Boolean)
    .map((l) => { const [s, filename] = l.split('\t'); return { filename, status: status[s[0]] ?? 'modified' }; });
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const p = url.pathname.replace(/^\/repos\/o\/r/, '');
      const send = (code, json) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
      if (req.method !== 'GET') { posted.push({ method: req.method, path: p, body }); return send(201, {}); }
      if (p === '/pulls/1') return send(200, { number: 1, user: { login: 'alice', id: 4242 }, head: { sha: head, ref: 'alice/home' }, body: '' });
      if (p === '/pulls/1/files') return send(200, url.searchParams.get('page') === '1' ? files : []);
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
  return { server, posted };
}

async function check(town, base, head) {
  const { server, posted } = fakeApi(town, base, head);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const out = join(town, '.git', 'gh-output');
  writeFileSync(out, '');
  try {
    const { stdout, stderr, code } = await new Promise((resolveRun) => {
      execFile(process.execPath, [join(town, 'tools', 'witness.mjs'), 'check'], {
        cwd: town,
        env: {
          ...process.env,
          GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
          GITHUB_TOKEN: 'test', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '1', GITHUB_OUTPUT: out,
        },
      }, (error, stdout, stderr) => resolveRun({ stdout, stderr, code: error ? error.code : 0 }));
    });
    return { stdout, stderr, code, output: readFileSync(out, 'utf8'), posted };
  } finally {
    server.close();
  }
}

test('a PR adding a page as a symbolic link goes to a person, by name', async () => {
  const { root, town, base } = buildTown();
  try {
    const head = headCommit(town, base, [['WHITE_PAGES/alice/HOME/HOME.md', '120000', '../../../tools/github-ids.json']]);
    const r = await check(town, base, head);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.output, /^certified=false$/m, `the link PR certified:\n${r.stdout}`);
    const comment = r.posted.find((w) => w.path === '/issues/1/comments');
    assert.ok(comment, 'no comment reached the PR');
    assert.match(JSON.parse(comment.body).body, /`WHITE_PAGES\/alice\/HOME\/HOME\.md` is a symbolic link/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the same PR as a plain file still certifies (the stand-in is not what refuses)', async () => {
  const { root, town, base } = buildTown();
  try {
    const head = headCommit(town, base, [['WHITE_PAGES/alice/HOME/HOME.md', '100644', '# alice\n\nMy home.\n']]);
    const r = await check(town, base, head);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.output, /^certified=true$/m, `the plain PR did not certify:\n${r.stdout}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('modeJudgment passes plain files and names everything else', () => {
  assert.equal(modeJudgment('WHITE_PAGES/a/HOME/HOME.md', '100644'), null);
  assert.equal(modeJudgment('WHITE_PAGES/a/HOME/HOME.md', '100755'), null);
  assert.match(modeJudgment('WHITE_PAGES/a/HOME/HOME.md', '120000'), /`WHITE_PAGES\/a\/HOME\/HOME\.md` is a symbolic link/);
  assert.match(modeJudgment('WHITE_PAGES/a/HOME/x', '160000'), /is a submodule/);
  assert.match(modeJudgment('WHITE_PAGES/a/HOME/x', null), /could not be found in the PR head's tree/);
});
