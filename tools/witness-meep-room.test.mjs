// witness-meep-room.test.mjs — rule 2d: a meep's PR inside its own room certifies.
//   node --test tools/witness-meep-room.test.mjs
// Zero-dep; a throwaway town (a git repo carrying a copy of tools/, so the real
// tools/meep-accounts.json) and a local stand-in for the GitHub API, as
// witness-judged-head.test.mjs does.
//
// Rule 2d (witness.mjs § loadMeepRooms, meepRoomReasons; the founder's "yes",
// 2026-10-07): an account named in tools/meep-accounts.json keeps one room,
// MEEPS/<room>/, and its PR certifies when every file is added or modified
// inside that room, plain, and prose or pictures. Removals, renames and
// anything outside the room get a mind. The map is read at base only.
//
// THE FLIP is the rule 2d branch removed from evaluate(): the Architect's
// daily-note PR (#3495's shape) then routes as "no resident ADDRESS.md binds".

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile, spawnSync } from 'node:child_process';
import { loadMeepRooms, meepRoomReasons } from './witness.mjs';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(TOOLS, '..');
const ARCHITECT = { login: 'postmark-architect-meep', id: 331468228 };

function git(repo, args, { input, env } = {}) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', input, env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${repo}:\n${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

// The base town: the real tools/, one resident (alice), and the Architect's
// room with one daily note. The working tree stays AT BASE.
function buildTown() {
  const root = mkdtempSync(join(tmpdir(), 'witness-meep-'));
  const town = join(root, 'town');
  cpSync(TOOLS, join(town, 'tools'), { recursive: true });
  for (const d of ['inbox', 'outbox', 'HOME']) mkdirSync(join(town, 'WHITE_PAGES', 'alice', d), { recursive: true });
  writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'ADDRESS.md'), '---\nhandle: alice\ngithub: alice\n---\n\nA test room.\n');
  writeFileSync(join(town, 'WHITE_PAGES', 'alice', 'inbox', '.gitkeep'), '');
  writeFileSync(join(town, 'WHITE_PAGES', 'stamp-ledger.md'), '# stamp-ledger\n\n');
  mkdirSync(join(town, 'MEEPS', 'architect', 'memory', 'daily'), { recursive: true });
  writeFileSync(join(town, 'MEEPS', 'architect', 'memory', 'daily', '2026-10-06.md'), '# 2026-10-06\n\nA round.\n');
  spawnSync('git', ['init', '-q', '-b', 'main', town], { encoding: 'utf8' });
  git(town, ['config', 'user.email', 'witness@test.local']);
  git(town, ['config', 'user.name', 'witness test']);
  git(town, ['config', 'core.autocrlf', 'false']);
  git(town, ['add', '-A']);
  git(town, ['commit', '-qm', 'base']);
  return { root, town, base: git(town, ['rev-parse', 'HEAD']) };
}

// A head commit on base: [path, content] writes a file, [path, null] removes it.
function headCommit(town, base, entries) {
  const env = { GIT_INDEX_FILE: join(town, '.git', 'pr-index') };
  git(town, ['read-tree', base], { env });
  for (const [path, content] of entries) {
    if (content === null) { git(town, ['update-index', '--force-remove', path], { env }); continue; }
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

function fakeApi(town, base, head, author) {
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
      if (p === '/pulls/1') return send(200, { number: 1, user: author, head: { sha: head, ref: 'letta/round' }, base: { sha: base, ref: 'main' }, body: '' });
      if (p === '/pulls/1/files') return send(200, url.searchParams.get('page') === '1' ? filesBetween(town, base, head) : []);
      if (p === `/compare/${base}...${head}`) return send(200, { status: 'ahead', files: filesBetween(town, base, head) });
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

async function witness(town, base, head, sub, author = ARCHITECT) {
  const { server, posted, merged } = fakeApi(town, base, head, author);
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
        },
      }, (error, stdout, stderr) => resolveRun({ stdout, stderr, code: error ? error.code : 0 }));
    });
    const comment = posted.find((w) => w.path === '/issues/1/comments');
    return { stdout, stderr, code, output: readFileSync(out, 'utf8'), posted, merged, comment: comment ? JSON.parse(comment.body).body : '' };
  } finally {
    server.close();
  }
}

const withTown = async (fn) => {
  const t = buildTown();
  try { await fn(t); } finally { rmSync(t.root, { recursive: true, force: true }); }
};

const NOTE = ['MEEPS/architect/memory/daily/2026-10-07.md', '# 2026-10-07\n\nThe morning round.\n'];

test('LIVE: the map binds each room by a unique numeric id, and every room is a room in the town', () => {
  const { rooms } = JSON.parse(readFileSync(join(TOOLS, 'meep-accounts.json'), 'utf8'));
  const ids = Object.values(rooms).map((r) => r.id);
  assert.ok(ids.length > 0);
  for (const [room, row] of Object.entries(rooms)) {
    assert.equal(typeof row.id, 'number', `${room} has no numeric id`);
    assert.ok(existsSync(join(REPO_ROOT, 'MEEPS', room)), `MEEPS/${room}/ is not in the town`);
  }
  assert.equal(new Set(ids).size, ids.length, 'one account keeps two rooms');
  assert.deepEqual(loadMeepRooms(REPO_ROOT)[ARCHITECT.id], ['architect']);
});

test("the Architect's daily note in its own room certifies, and merges at its head (#3495's shape)", () => withTown(async ({ town, base }) => {
  const head = headCommit(town, base, [NOTE]);
  const check = await witness(town, base, head, 'check');
  assert.equal(check.code, 0, check.stderr);
  assert.match(check.output, /^certified=true$/m, `the room PR did not certify:\n${check.stdout}`);
  const merge = await witness(town, base, head, 'merge');
  assert.equal(merge.code, 0, merge.stderr);
  assert.deepEqual(merge.merged, [head]);
  assert.match(merge.comment, /this meep's own room, rule 2d/);
}));

test('a change to a file already in the room certifies', () => withTown(async ({ town, base }) => {
  const head = headCommit(town, base, [['MEEPS/architect/memory/daily/2026-10-06.md', '# 2026-10-06\n\nA round, amended.\n']]);
  const r = await witness(town, base, head, 'check');
  assert.match(r.output, /^certified=true$/m, r.stdout);
}));

test("anything outside the meep's own room gets a mind, by name", () => withTown(async ({ town, base }) => {
  for (const [path, why] of [
    ['MEEPS/registrar/memory/daily/2026-10-07.md', /touches `MEEPS\/registrar\/memory\/daily\/2026-10-07\.md`, outside this meep's own room \(`MEEPS\/architect\/`\)/],
    ['WHITE_PAGES/alice/HOME/HOME.md', /touches `WHITE_PAGES\/alice\/HOME\/HOME\.md`, outside this meep's own room/],
    ['MEEPS/AGENTS.md', /touches `MEEPS\/AGENTS\.md`, outside this meep's own room/],
  ]) {
    const head = headCommit(town, base, [NOTE, [path, 'x\n']]);
    const r = await witness(town, base, head, 'check');
    assert.match(r.output, /^certified=false$/m, `${path} certified:\n${r.stdout}`);
    assert.match(r.comment, why);
  }
}));

test("a removal in the meep's own room gets a mind", () => withTown(async ({ town, base }) => {
  const head = headCommit(town, base, [['MEEPS/architect/memory/daily/2026-10-06.md', null]]);
  const r = await witness(town, base, head, 'check');
  assert.match(r.output, /^certified=false$/m, r.stdout);
  assert.match(r.comment, /deletes `MEEPS\/architect\/memory\/daily\/2026-10-06\.md` — removals get human eyes/);
}));

test("the map is read at base: a PR that adds its own account to it still gets a mind", () => withTown(async ({ town, base }) => {
  const stranger = { login: 'not-a-meep', id: 999 };
  const map = JSON.parse(readFileSync(join(town, 'tools', 'meep-accounts.json'), 'utf8'));
  map.rooms.architect = { login: stranger.login, id: stranger.id };
  const head = headCommit(town, base, [NOTE, ['tools/meep-accounts.json', JSON.stringify(map, null, 2)]]);
  const r = await witness(town, base, head, 'check', stranger);
  assert.match(r.output, /^certified=false$/m, r.stdout);
  assert.match(r.comment, /no resident ADDRESS\.md binds the GitHub account `not-a-meep`/);
}));

test('an account the map does not name gets the old answer in a meep room', () => withTown(async ({ town, base }) => {
  const head = headCommit(town, base, [NOTE]);
  const r = await witness(town, base, head, 'check', { login: 'someone', id: 12345 });
  assert.match(r.output, /^certified=false$/m, r.stdout);
  assert.match(r.comment, /no resident ADDRESS\.md binds the GitHub account `someone`/);
}));

test('meepRoomReasons: additions and changes in the room pass; removals, renames, other kinds and file types do not', () => {
  assert.deepEqual(meepRoomReasons('architect', [
    { filename: 'MEEPS/architect/MEMORY.md', status: 'modified' },
    { filename: 'MEEPS/architect/memory/topics/x.md', status: 'added' },
    { filename: 'MEEPS/architect/art/map.png', status: 'added' },
  ]), []);
  const r = meepRoomReasons('architect', [
    { filename: 'MEEPS/architect/b.md', previous_filename: 'MEEPS/architect/a.md', status: 'renamed' },
    { filename: 'MEEPS/architect/c.md', status: 'copied' },
    { filename: 'MEEPS/architect/tools/run.mjs', status: 'added' },
    { filename: 'MEEPS/architects/x.md', status: 'added' },
  ]);
  assert.equal(r.length, 4);
  assert.match(r[0], /renames `MEEPS\/architect\/a\.md`/);
  assert.match(r[1], /certifies added and modified files only/);
  assert.match(r[2], /only certifies prose and pictures/);
  assert.match(r[3], /outside this meep's own room/);
});

test('loadMeepRooms binds by numeric id only, and skips rows it cannot read', () => {
  const root = mkdtempSync(join(tmpdir(), 'meep-map-'));
  try {
    mkdirSync(join(root, 'tools'));
    writeFileSync(join(root, 'tools', 'meep-accounts.json'), JSON.stringify({ rooms: {
      architect: { login: 'a', id: 1 }, registrar: { login: 'r', id: '2' }, '../up': { login: 'u', id: 3 },
    } }));
    assert.deepEqual(loadMeepRooms(root), { 1: ['architect'] });
    rmSync(join(root, 'tools', 'meep-accounts.json'));
    assert.deepEqual(loadMeepRooms(root), {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
