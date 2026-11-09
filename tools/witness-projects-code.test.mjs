// witness-projects-code.test.mjs — code under PROJECTS/ waits for a principal.
//   node --test tools/witness-projects-code.test.mjs
// Zero-dep; a throwaway town (a git repo carrying a copy of tools/) and a local
// stand-in for the GitHub API, as witness-file-modes.test.mjs does.
//
// POS-973 (witness.mjs § PRINCIPAL_CLASS): the town clock runs generators under
// PROJECTS/, so a PR that changes a .mjs, .js, .cjs, .ts, .mts, .cts, .sh or .py
// file there is labeled needs-principal and waits for a founder. A project's
// data and prose (.json, .md, .html, pictures) route to the office as before.
//
// THE FLIP is the PROJECTS/ alternative removed from PRINCIPAL_CLASS: the
// generator PR below then routes without the label.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile, spawnSync } from 'node:child_process';
import { PRINCIPAL_CLASS } from './witness.mjs';

const TOOLS = dirname(fileURLToPath(import.meta.url));

function git(repo, args, { input, env } = {}) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', input, env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${repo}:\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

// The base town: the real tools/, one resident (alice, bound by her `github:`
// login), and a project with a generator and its data. The working tree stays
// AT BASE; the PR head is a commit built off to the side.
function buildTown() {
  const root = mkdtempSync(join(tmpdir(), 'witness-projects-'));
  const town = join(root, 'town');
  cpSync(TOOLS, join(town, 'tools'), { recursive: true });
  for (const d of ['inbox', 'outbox']) mkdirSync(join(town, 'WHITE_PAGES', 'alice', d), { recursive: true });
  writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'ADDRESS.md'), '---\nhandle: alice\ngithub: alice\n---\n\nA test room.\n');
  writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'inbox', '.gitkeep'), '');
  writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'outbox', '.gitkeep'), '');
  writeFileSync(join(town, 'WHITE_PAGES', 'stamp-ledger.md'), '# stamp-ledger\n\n');
  mkdirSync(join(town, 'PROJECTS', 'x'), { recursive: true });
  writeFileSync(join(town, 'PROJECTS', 'x', 'gen.mjs'), 'console.log("drawn");\n');
  writeFileSync(join(town, 'PROJECTS', 'x', 'data.json'), '{"leaf":"#1f4a24"}\n');
  writeFileSync(join(town, 'PROJECTS', 'x', 'README.md'), '# x\n');
  spawnSync('git', ['init', '-q', '-b', 'main', town], { encoding: 'utf8' });
  git(town, ['config', 'user.email', 'witness@test.local']);
  git(town, ['config', 'user.name', 'witness test']);
  git(town, ['config', 'core.autocrlf', 'false']);
  git(town, ['add', '-A']);
  git(town, ['commit', '-qm', 'base']);
  return { root, town, base: git(town, ['rev-parse', 'HEAD']) };
}

// A head commit on top of base changing `entries` ([path, content]), written
// through a private index so the working tree never sees it.
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

// The API, as far as `witness.mjs check` asks it, with the writes recorded.
function fakeApi(town, base, head) {
  const posted = [];
  const status = { A: 'added', M: 'modified', D: 'removed' };
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
      if (p === '/pulls/1') return send(200, { number: 1, user: { login: 'alice', id: 4242 }, head: { sha: head, ref: 'alice/project' }, base: { sha: base, ref: 'main' }, body: '' });
      if (p === '/pulls/1/files') return send(200, url.searchParams.get('page') === '1' ? files : []);
      if (p === `/compare/${base}...${head}`) return send(200, { status: 'ahead', files });
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

async function check(entries) {
  const { root, town, base } = buildTown();
  const head = headCommit(town, base, entries);
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
    const labels = posted.filter((w) => w.path === '/issues/1/labels').flatMap((w) => JSON.parse(w.body).labels);
    return { stdout, stderr, code, output: readFileSync(out, 'utf8'), labels };
  } finally {
    server.close();
    rmSync(root, { recursive: true, force: true });
  }
}

test('a resident PR changing a generator under PROJECTS/ waits for a principal', async () => {
  const r = await check([['PROJECTS/x/gen.mjs', 'console.log("drawn, differently");\n']]);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.output, /^certified=false$/m, r.stdout);
  assert.deepEqual(r.labels, ['needs-principal'], `the generator PR was not labeled for a principal:\n${r.stdout}`);
});

test('a resident PR changing a project\'s data or prose goes to the office, without the label', async () => {
  for (const entries of [[['PROJECTS/x/data.json', '{"leaf":"#E8B86D"}\n']], [['PROJECTS/x/README.md', '# x\n\nMore.\n']]]) {
    const r = await check(entries);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.output, /^certified=false$/m, r.stdout);
    assert.deepEqual(r.labels, [], `${entries[0][0]} was labeled for a principal:\n${r.stdout}`);
  }
});

test('PRINCIPAL_CLASS names code under PROJECTS/ and leaves its data and prose alone', () => {
  for (const p of ['PROJECTS/x/gen.mjs', 'PROJECTS/x/tools/a.js', 'PROJECTS/x/b.cjs', 'PROJECTS/x/tools/cli.ts', 'PROJECTS/x/c.mts',
    'PROJECTS/x/d.cts', 'PROJECTS/x/run.sh', 'PROJECTS/x/ears.py', 'PROJECTS/the-resident-herbarium/render.mjs',
    'PROJECTS/build-the-town/atlas/render-town.mjs', 'PROJECTS/the-town-seal/seal.mjs'])
    assert.ok(PRINCIPAL_CLASS.test(p), `${p} is code and does not wait for a principal`);
  for (const p of ['PROJECTS/x/data.json', 'PROJECTS/x/README.md', 'PROJECTS/x/notes.txt', 'PROJECTS/the-resident-herbarium/herbarium.html',
    'PROJECTS/the-resident-herbarium/specimens.json', 'PROJECTS/x/picture.png', 'PROJECTS/x/gen.mjs.md', 'WHITE_PAGES/alice/HOME/gen.mjs'])
    assert.equal(PRINCIPAL_CLASS.test(p), false, `${p} is not PROJECTS/ code and waits for a principal`);
});
