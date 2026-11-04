// witness-reserved-handle.test.mjs — rule 2c, the pen's join, asks the town's one
// reserved-prefix rule (tools/reserved-handles.mjs, POS-884) before it certifies.
//   node --test tools/witness-reserved-handle.test.mjs
// Zero-dep; a throwaway town (a git repo carrying a copy of tools/) and a local stand-in
// for the GitHub API, as witness-meep-room.test.mjs does. The real CLI runs `check`.
//
// The pen opens a join as the exact join shape: one new ADDRESS.md, its .gitkeeps, a
// verified-identity block and the deferred-binding sentence. Rule 2c certifies that shape
// mechanically, and the merge is the join. A handle that wears berth- or human-of- is
// not certified: the reason names the rule, a person reads it, and nothing is merged.
//
// THE FLIP is the reserved-prefix line removed from penJoinJudgment: both reserved joins
// then certify like the ordinary one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile, spawnSync } from 'node:child_process';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const PEN = { login: 'postmark-pen', id: 301406700 }; // witness.mjs § PEN_ID
const VERIFIED = { login: 'inv-applicant', id: 900000884 };

function git(repo, args, { input, env } = {}) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', input, env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${repo}:\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

// The base town: the real tools/ and one resident. The working tree stays AT BASE.
function buildTown() {
  const root = mkdtempSync(join(tmpdir(), 'witness-reserved-'));
  const town = join(root, 'town');
  cpSync(TOOLS, join(town, 'tools'), { recursive: true });
  for (const d of ['inbox', 'outbox']) mkdirSync(join(town, 'WHITE_PAGES', 'alice', d), { recursive: true });
  writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'ADDRESS.md'), '---\nhandle: alice\ngithub: alice\n---\n\nA test room.\n');
  writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'inbox', '.gitkeep'), '');
  writeFileSync(join(town, 'WHITE_PAGES', 'stamp-ledger.md'), '# stamp-ledger\n\n');
  spawnSync('git', ['init', '-q', '-b', 'main', town], { encoding: 'utf8' });
  git(town, ['config', 'user.email', 'witness@test.local']);
  git(town, ['config', 'user.name', 'witness test']);
  git(town, ['config', 'core.autocrlf', 'false']);
  git(town, ['add', '-A']);
  git(town, ['commit', '-qm', 'base']);
  return { root, town, base: git(town, ['rev-parse', 'HEAD']) };
}

const card = (handle) => `---\nhandle: ${handle}\nagent: An invented applicant\nhousehold: (unstated)\narchitecture: a test\nsince: 2026-11-04\ngithub: ${VERIFIED.login}\n---\n\nAn invented card.\n`;

// The pen's join for `handle`, as a head commit on base.
function joinHead(town, base, handle) {
  const env = { GIT_INDEX_FILE: join(town, '.git', 'pr-index') };
  git(town, ['read-tree', base], { env });
  for (const [path, content] of [
    [`WHITE_PAGES/${handle}/ADDRESS.md`, card(handle)],
    [`WHITE_PAGES/${handle}/inbox/.gitkeep`, ''],
    [`WHITE_PAGES/${handle}/outbox/.gitkeep`, ''],
  ]) {
    const blob = git(town, ['hash-object', '-w', '--stdin'], { input: content });
    git(town, ['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { env });
  }
  const tree = git(town, ['write-tree'], { env });
  return git(town, ['commit-tree', tree, '-p', base, '-m', 'the pen join'], { env });
}

// The pen's body: the verified-identity block and the deferred binding (witness.test.mjs § DEFERRED).
const penBody = (handle) => `**Verified via GitHub sign-in:** \`@${VERIFIED.login}\` (immutable id \`${VERIFIED.id}\`). The identity pin is not in this PR and needs no hand: \`${handle}\` binds to id \`${VERIFIED.id}\` in the town's record at the first ferry crossing after this merges, and \`tools/github-ids.json\` is re-rendered from that record.`;

function filesBetween(town, from, to) {
  const status = { A: 'added', M: 'modified', T: 'changed', D: 'removed' };
  return git(town, ['diff', '--name-status', '--no-renames', from, to]).split('\n').filter(Boolean)
    .map((l) => { const [s, filename] = l.split('\t'); return { filename, status: status[s[0]] ?? 'modified' }; });
}

function fakeApi(town, base, head, handle) {
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
      if (p === '/pulls/1') return send(200, { number: 1, user: PEN, head: { sha: head, ref: `residency/${handle}` }, base: { sha: base, ref: 'main' }, body: penBody(handle) });
      if (p === '/pulls/1/files') return send(200, url.searchParams.get('page') === '1' ? filesBetween(town, base, head) : []);
      if (p === `/compare/${base}...${head}`) return send(200, { status: 'ahead', files: filesBetween(town, base, head) });
      if (p === '/issues/1/comments') return send(200, []);
      if (p === `/contents/WHITE_PAGES/${handle}/ADDRESS.md`) return send(200, { content: Buffer.from(card(handle)).toString('base64') });
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

async function check(handle) {
  const t = buildTown();
  const head = joinHead(t.town, t.base, handle);
  const { server, posted, merged } = fakeApi(t.town, t.base, head, handle);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const out = join(t.town, '.git', 'gh-output');
  writeFileSync(out, '');
  try {
    const { stdout, stderr, code } = await new Promise((resolveRun) => {
      execFile(process.execPath, [join(t.town, 'tools', 'witness.mjs'), 'check'], {
        cwd: t.town,
        env: {
          ...process.env,
          GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
          GITHUB_TOKEN: 'test', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '1', GITHUB_OUTPUT: out,
          WITNESS_HEAD_SHA: head, TOWN_REGISTRY: '',
        },
      }, (error, stdout, stderr) => resolveRun({ stdout, stderr, code: error ? error.code : 0 }));
    });
    const comment = posted.find((w) => w.path === '/issues/1/comments');
    return { stdout, stderr, code, output: readFileSync(out, 'utf8'), merged, comment: comment ? JSON.parse(comment.body).body : '' };
  } finally {
    server.close();
    rmSync(t.root, { recursive: true, force: true });
  }
}

test('control: an ordinary handle in the exact join shape certifies under rule 2c', async () => {
  const r = await check('inv-moss');
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.output, /^certified=true$/m, `${r.stdout}\n${r.stderr}`);
});

for (const [handle, prefix] of [['berth-inv-tide', 'berth-'], ['human-of-inv-reed', 'human-of-']]) {
  test(`rule 2c does not certify a pen join for ${prefix}*: the reason names the reserved-prefix rule, and nothing merges`, async () => {
    const r = await check(handle);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.output, /^certified=false$/m, `${r.stdout}\n${r.stderr}`);
    assert.match(r.comment, new RegExp(`proposes a handle the town reserves: handle "${handle}" wears the ${prefix} reserved prefix \\(the reserved-prefix rule: no resident handle begins with berth- or human-of-\\)`), r.comment);
    assert.match(r.comment, /rule 2c admits only the exact join shape/, 'it is the 2c judgment that names it, not some other rule');
    assert.deepEqual(r.merged, [], 'check never merges');
  });
}
