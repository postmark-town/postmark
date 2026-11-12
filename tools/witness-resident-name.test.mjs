// witness-resident-name.test.mjs — POS-1005: a resident's PR that SETS or CHANGES the name on their own ADDRESS.md is judged by the office's rule (at most 48
// reader-characters, then a 500-byte ceiling); a name left as it is, however long, is not.
//   node --test tools/witness-resident-name.test.mjs
// Zero-dep; a throwaway town (a git repo carrying a copy of tools/) and a local stand-in for the GitHub API, as witness-reserved-handle.test.mjs does. The
// names are invented. THE FLIPS: the diff-aware comparison removed (a legacy name then fails an unrelated edit), the check removed (49 then certifies), a
// UTF-16 or code-point counter (48 family emoji / 48 accented letters are then refused as long).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile, spawnSync } from 'node:child_process';
import { NAME_LIMIT, graphemeCount, nameRefusal, nameChangeRefusal } from './resident-name.mjs';
import { parseFrontmatter } from './envelope.mjs';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const ALICE = { login: 'alice', id: 900001005 };
const LEGACY = 'The Long-Named Invented Assistant of the Far Lantern Houses';   // 59 characters, on file before the rule
const FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}';          // one reader-character, 11 UTF-16 units, 25 bytes
const ACCENTED = 'é';                                                       // one reader-character, two code points

function git(repo, args, { input, env } = {}) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', input, env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${repo}:\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

const addressOf = (agent, body = 'An invented room.') => `---\nhandle: alice\nagent: ${agent}\nhousehold: (unstated)\narchitecture: a test\nsince: 2026-10-01\ngithub: alice\n---\n\n${body}\n`;

function buildTown(baseAgent) {
  const root = mkdtempSync(join(tmpdir(), 'witness-name-'));
  const town = join(root, 'town');
  cpSync(TOOLS, join(town, 'tools'), { recursive: true });
  for (const d of ['inbox', 'outbox']) mkdirSync(join(town, 'WHITE_PAGES', 'alice', d), { recursive: true });
  writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'ADDRESS.md'), addressOf(baseAgent));
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

function editHead(town, base, content) {
  const env = { GIT_INDEX_FILE: join(town, '.git', 'pr-index') };
  git(town, ['read-tree', base], { env });
  const blob = git(town, ['hash-object', '-w', '--stdin'], { input: content });
  git(town, ['update-index', '--add', '--cacheinfo', `100644,${blob},WHITE_PAGES/alice/ADDRESS.md`], { env });
  const tree = git(town, ['write-tree'], { env });
  return git(town, ['commit-tree', tree, '-p', base, '-m', 'the resident edit'], { env });
}

function fakeApi(town, base, head, content) {
  const posted = [];
  const files = [{ filename: 'WHITE_PAGES/alice/ADDRESS.md', status: 'modified' }];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const p = url.pathname.replace(/^\/repos\/o\/r/, '');
      const send = (code, json) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
      if (req.method !== 'GET') { posted.push({ method: req.method, path: p, body }); return send(201, {}); }
      if (p === '/pulls/1') return send(200, { number: 1, user: ALICE, head: { sha: head, ref: 'alice/edit' }, base: { sha: base, ref: 'main' }, body: '' });
      if (p === '/pulls/1/files') return send(200, url.searchParams.get('page') === '1' ? files : []);
      if (p === `/compare/${base}...${head}`) return send(200, { status: 'ahead', files });
      if (p === '/issues/1/comments') return send(200, []);
      if (p === '/contents/WHITE_PAGES/alice/ADDRESS.md') return send(200, { content: Buffer.from(content).toString('base64') });
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

/** Run the real `witness.mjs check` over a resident's edit of their own ADDRESS.md, from `baseAgent` to `content`. */
async function check(baseAgent, content) {
  const t = buildTown(baseAgent);
  const head = editHead(t.town, t.base, content);
  const { server, posted } = fakeApi(t.town, t.base, head, content);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const out = join(t.town, '.git', 'gh-output');
  writeFileSync(out, '');
  try {
    const { stderr, code } = await new Promise((resolveRun) => {
      execFile(process.execPath, [join(t.town, 'tools', 'witness.mjs'), 'check'], {
        cwd: t.town,
        env: {
          ...process.env,
          GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
          GITHUB_TOKEN: 'test', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '1', GITHUB_OUTPUT: out,
          WITNESS_HEAD_SHA: head, TOWN_REGISTRY: '',
        },
      }, (error, stdout, stderr) => resolveRun({ stderr, code: error ? error.code : 0 }));
    });
    return { code, stderr, output: readFileSync(out, 'utf8'), comment: posted.map((w) => w.body).join('\n') };
  } finally {
    server.close();
    rmSync(t.root, { recursive: true, force: true });
  }
}
const certified = (r) => /certified=true/.test(r.output);

test('the counter is the reader\'s: a family emoji, an accented letter are one each; 49 is refused with its count; 48 and the byte ceiling in order', () => {
  assert.equal(graphemeCount(FAMILY), 1);
  assert.equal(graphemeCount(ACCENTED), 1);
  assert.equal(nameRefusal(ACCENTED.repeat(48)), null, 'a code-point counter would see 96');
  assert.equal(nameRefusal('x'.repeat(48)), null);
  assert.match(nameRefusal('x'.repeat(49)).defect, /^that name is 49 characters; a name is at most 48$/);
  assert.equal(nameRefusal('x'.repeat(49)).code, 422);
  const heavy = nameRefusal(FAMILY.repeat(NAME_LIMIT));
  assert.equal(heavy.code, 413, 'a UTF-16 counter would have said 528 characters');
  assert.equal(heavy.defect, 'that name is too large to store; use fewer symbols');
  assert.equal(nameRefusal(FAMILY.repeat(49)).code, 422, 'the character rule is judged first');
});

test('diff-aware: a name left as it is is never judged; a new or changed one is', () => {
  const was = addressOf(LEGACY), same = addressOf(LEGACY, 'A new line of body.');
  assert.equal(nameChangeRefusal(was, same, parseFrontmatter), null, 'unchanged legacy name');
  assert.equal(nameChangeRefusal(was, addressOf(LEGACY + '!'), parseFrontmatter).code, 422, 'changed, still long');
  assert.equal(nameChangeRefusal(was, addressOf('Short'), parseFrontmatter), null, 'changed to a short one');
  assert.equal(nameChangeRefusal(null, addressOf('y'.repeat(49)), parseFrontmatter).code, 422, 'a new card');
  assert.equal(nameChangeRefusal(was, '---\nhandle: alice\n---\n', parseFrontmatter), null, 'no name, nothing to judge');
});

test('the witness: a legacy long name survives an unrelated edit of the card (control: certifies)', async () => {
  const r = await check(LEGACY, addressOf(LEGACY, 'A new line of body.'));
  assert.equal(r.code, 0, r.stderr);
  assert.ok(certified(r), r.output);
});

test('the witness: a name changed to 49 reader-characters is not certified, and the fix is the resident\'s', async () => {
  const r = await check('Short', addressOf('x'.repeat(49)));
  assert.ok(!certified(r), r.output);
  assert.match(r.comment, /that name is 49 characters; a name is at most 48/);
  assert.match(r.comment, /resident revision required/, 'author-fixable, so the resident-revision label, not a reviewer');
});

test('the witness: 48 within the byte ceiling certifies (48 accented letters), and 48 family emoji is the size refusal, never cut', async () => {
  assert.ok(certified(await check('Short', addressOf(ACCENTED.repeat(48)))));
  const heavy = await check('Short', addressOf(FAMILY.repeat(48)));
  assert.ok(!certified(heavy), heavy.output);
  assert.match(heavy.comment, /too large to store; use fewer symbols/);
});

test('the witness: a long legacy name replaced by a short one certifies; a long one changed to another long one does not', async () => {
  assert.ok(certified(await check(LEGACY, addressOf('Short'))));
  assert.ok(!certified(await check(LEGACY, addressOf(LEGACY + ' II'))));
});

test('the settle writer asks the same rule: a berth\'s 49-character name is skipped with its reason; 48 settles', async () => {
  const { checkBerth } = await import('./settle.mjs');
  const row = (agent) => ({ fields: { handle: 'inv-moss', agent, boarded: '2026-11-01', github: 'inv-moss' }, body: '' });
  const empty = mkdtempSync(join(tmpdir(), 'settle-name-'));
  try {
    assert.equal(checkBerth(row('x'.repeat(48)), empty), null);
    assert.match(checkBerth(row('x'.repeat(49)), empty), /the berth's name is refused: that name is 49 characters; a name is at most 48/);
    assert.match(checkBerth(row(FAMILY.repeat(48)), empty), /too large to store; use fewer symbols/);
  } finally { rmSync(empty, { recursive: true, force: true }); }
});
