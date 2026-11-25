import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { CROSSING_LEDGER_PREAMBLE, crossingReceiptLine } from '../../../tools/crossings.mjs';
import { readCrossings } from './read-crossing.mjs';

const cli = fileURLToPath(new URL('./read-crossing.mjs', import.meta.url));
// Exact real-ledger preamble; legacy examples keep their old grammar but use
// synthetic names, not copied correspondence or a dependency on a moving roll.
const REAL_MAIL_BASELINE = `# Mail ledger

Append-only record of every delivery **and every bounce**. The mailman alone writes here.

- Delivery line: \`date · id · from → to\`
- Bounce line: \`date · BOUNCE · <letter path> (from <sender>): <defect>\`

- 2026-07-14 · ARCHIVE · alice/outbox/old.md + inbox/bounce-old.md · abandoned pair retired
- 2026-07-16 · ARCHIVE · bob/outbox/old.md + inbox/bounce-old.md · abandoned pair retired
- 2026-08-27 · SEND · alice-old-sent (alice → bob)
`;
const env = { ...process.env, GIT_AUTHOR_NAME: 'Synthetic Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Synthetic Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid', GIT_CONFIG_NOSYSTEM: '1' };
for (const key of Object.keys(env)) if (key.startsWith('GIT_') && !/^(GIT_AUTHOR_|GIT_COMMITTER_|GIT_CONFIG_NOSYSTEM$)/.test(key)) delete env[key];
function git(repo, args, input) {
  const r = spawnSync('git', ['--no-optional-locks', '-C', repo, '-c', 'core.autocrlf=false', '-c', 'core.fsmonitor=false', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=disabled-fixture-hooks', ...args], { encoding: 'utf8', env, input, windowsHide: true, timeout: 30000 });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
function put(repo, path, value) { mkdirSync(dirname(join(repo, path)), { recursive: true }); writeFileSync(join(repo, path), value); }
function save(repo) { git(repo, ['add', '-A']); git(repo, ['commit', '-q', '-m', 'Synthetic crossing fixture']); return git(repo, ['rev-parse', 'HEAD']); }
function fixture(t) {
  const temp = realpathSync(tmpdir()), repo = mkdtempSync(join(temp, 'postmark-crossing-fixture-'));
  t.after(() => { assert.equal(dirname(repo), temp); assert.match(basename(repo), /^postmark-crossing-fixture-/); rmSync(repo, { recursive: true, force: true }); });
  git(repo, ['init', '-q']);
  put(repo, 'WHITE_PAGES/crossing-ledger.md', CROSSING_LEDGER_PREAMBLE);
  put(repo, 'WHITE_PAGES/mail-ledger.md', '# Synthetic mail\n');
  put(repo, 'tools/github-ids.json', '{}\n');
  const initial = save(repo); return { repo, initial };
}
const letter = (id, body, to = 'bob') => `---\nid: ${id}\nfrom: alice\nto: ${to}\ndate: 2026-11-23\nthread: new\n---\n\n${body}`;
function crossing(repo, { id = 'alice-one', body = 'Whole first letter.\n', number = 10, room = 'bob', folder = false, bounce = null, beforeSave = () => {} } = {}) {
  const parent = git(repo, ['rev-parse', 'HEAD']);
  let mail = readFileSync(join(repo, 'WHITE_PAGES/mail-ledger.md'), 'utf8');
  if (id) {
    const path = `WHITE_PAGES/${room}/inbox/${id}${folder ? '/letter.md' : '.md'}`;
    put(repo, path, letter(id, body));
    if (folder) put(repo, `WHITE_PAGES/${room}/inbox/${id}/art/pixels.bin`, Buffer.from([0, 255, 10, 128]));
    mail += `- 2026-11-24 · ${id} · alice → bob · thread: new\n`;
  }
  if (bounce) mail += `- 2026-11-24 · BOUNCE · ${bounce} (from alice): missing required field: to\n`;
  put(repo, 'WHITE_PAGES/mail-ledger.md', mail);
  const old = readFileSync(join(repo, 'WHITE_PAGES/crossing-ledger.md'), 'utf8');
  put(repo, 'WHITE_PAGES/crossing-ledger.md', old + crossingReceiptLine({ date: '2026-11-24', crossing: number, townSha: parent, delivered: id ? 1 : 0, bounced: bounce ? 1 : 0 }) + '\n');
  beforeSave(); return save(repo);
}
function snapshot(repo) {
  const out = {};
  const walk = (dir, prefix = '') => { for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name), rel = prefix + e.name;
    if (e.isDirectory()) walk(path, `${rel}/`); else out[rel] = createHash('sha256').update(readFileSync(path)).digest('hex');
  } }; walk(repo); return out;
}
function run(repo, args) { return spawnSync(process.execPath, [cli, '--repo', repo, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 }); }

test('single CLI returns untruncated immutable text, envelope, native ID and read-parent provenance without effects', (t) => {
  const { repo, initial } = fixture(t), body = `First line.\r\n${'λ whole sentence\n'.repeat(7000)}END 🔦\r\n`;
  const commit = crossing(repo, { body });
  const before = snapshot(repo), result = run(repo, ['--crossing', commit]);
  assert.equal(result.status, 0, result.stderr);
  const x = JSON.parse(result.stdout), c = x.crossings[0];
  assert.equal(c.delivery_commit, commit); assert.equal(c.read_parent, initial); assert.equal(c.receipt.town_sha, initial);
  assert.equal(c.letters[0].id, 'alice-one'); assert.equal(c.letters[0].content, letter('alice-one', body));
  assert.equal(c.letters[0].envelope.to, 'bob'); assert.equal(x.delivered, 1);
  put(repo, 'WHITE_PAGES/bob/inbox/alice-one.md', 'MUTATED WORKTREE — NOT THE SOURCE');
  const reread = readCrossings({ repo, crossing: commit });
  assert.equal(reread.crossings[0].letters[0].content, letter('alice-one', body));
  put(repo, 'WHITE_PAGES/bob/inbox/alice-one.md', letter('alice-one', body));
  assert.deepEqual(snapshot(repo), before);
});

test('first-parent range includes both full crossings, folder enclosure bytes, and dated rename folding', (t) => {
  const { repo, initial } = fixture(t); const first = crossing(repo);
  put(repo, 'unrelated.txt', 'Synthetic non-mail commit\n'); save(repo);
  renameSync(join(repo, 'WHITE_PAGES/bob'), join(repo, 'WHITE_PAGES/robin'));
  put(repo, 'tools/github-ids.json', JSON.stringify({ bob: { renamed_to: 'robin', retired: '2026-11-24' } }));
  const last = crossing(repo, { id: 'alice-two', body: 'Complete second letter\n', number: 11, room: 'robin', folder: true });
  const result = run(repo, ['--after', initial, '--through', last]); assert.equal(result.status, 0, result.stderr);
  const x = JSON.parse(result.stdout); assert.equal(x.inspected_commits, 3); assert.equal(x.crossings.length, 2);
  assert.equal(x.crossings[0].delivery_commit, first); assert.equal(x.crossings[1].letters[0].kind, 'folder');
  assert.equal(x.crossings[1].letters[0].recipient_room, 'robin');
  assert.deepEqual(x.crossings[1].letters[0].rename_chain, ['bob', 'robin']);
  assert.equal(x.crossings[1].letters[0].attachments[0].content, Buffer.from([0, 255, 10, 128]).toString('base64'));
  const empty = readCrossings({ repo, after: last, through: last }); assert.equal(empty.inspected_commits, 0); assert.deepEqual(empty.crossings, []);
});

test('bounces retain all original immutable bytes even a malformed folder without letter.md and spaces in its name', (t) => {
  const { repo } = fixture(t), path = 'WHITE_PAGES/alice/outbox/letter-bad folder';
  put(repo, `${path}/unreadable.bin`, Buffer.from([255, 0, 128])); save(repo);
  const commit = crossing(repo, { id: null, bounce: path });
  const x = readCrossings({ repo, crossing: commit }); assert.equal(x.bounced, 1);
  assert.equal(x.crossings[0].bounces[0].path, path);
  assert.equal(x.crossings[0].bounces[0].original.files[0].content, Buffer.from([255, 0, 128]).toString('base64'));
});

test('real preamble and old-format rows survive as baseline; new malformed rows still fail', (t) => {
  const { repo } = fixture(t);
  put(repo, 'WHITE_PAGES/mail-ledger.md', REAL_MAIL_BASELINE); save(repo);
  const first = crossing(repo);
  const single = run(repo, ['--crossing', first]); assert.equal(single.status, 0, single.stderr);
  assert.equal(JSON.parse(single.stdout).delivered, 1);
  const second = crossing(repo, { id: 'alice-two', number: 11 });
  const range = readCrossings({ repo, after: first, through: second });
  assert.equal(range.delivered, 1); assert.equal(range.crossings[0].delivery_commit, second);
  assert.deepEqual(readCrossings({ repo, after: second, through: second }).crossings, []);
  const broken = crossing(repo, { id: 'alice-three', number: 12, beforeSave: () => {
    const path = 'WHITE_PAGES/mail-ledger.md';
    put(repo, path, readFileSync(join(repo, path), 'utf8') + '- newly malformed mail row\n');
  } });
  const bad = run(repo, ['--crossing', broken]);
  assert.equal(bad.status, 1); assert.equal(bad.stdout, ''); assert.match(bad.stderr, /Malformed mail ledger delta/);
});

for (const sameDelta of [false, true]) test(`duplicate-ID guard rejects ${sameDelta ? 'two deliveries in one delta' : 'an ID delivered in the baseline'}`, (t) => {
  const { repo } = fixture(t);
  if (!sameDelta) crossing(repo);
  const repeated = crossing(repo, { number: sameDelta ? 10 : 11, beforeSave: () => {
    if (!sameDelta) return;
    const mail = 'WHITE_PAGES/mail-ledger.md', receipts = 'WHITE_PAGES/crossing-ledger.md';
    put(repo, mail, readFileSync(join(repo, mail), 'utf8') + '- 2026-11-24 · alice-one · alice → bob · thread: new\n');
    put(repo, receipts, readFileSync(join(repo, receipts), 'utf8').replace('1 delivered', '2 delivered'));
  } });
  const result = run(repo, ['--crossing', repeated]);
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.match(result.stderr, /Duplicate delivered native ID: alice-one/);
});

for (const [name, mutate, pattern] of [
  ['missing letter', (r) => { rmSync(join(r, 'WHITE_PAGES/bob/inbox/alice-one.md')); }, /Missing or ambiguous/],
  ['malformed receipt', (r) => put(r, 'WHITE_PAGES/crossing-ledger.md', '- invalid receipt\n'), /Malformed crossing/],
  ['receipt count mismatch', (r) => { const p = join(r, 'WHITE_PAGES/crossing-ledger.md'); put(r, 'WHITE_PAGES/crossing-ledger.md', readFileSync(p, 'utf8').replace('1 delivered', '2 delivered')); }, /counts disagree/],
  ['envelope mismatch', (r) => put(r, 'WHITE_PAGES/bob/inbox/alice-one.md', letter('wrong-id', 'Wrong native ID')), /envelope disagrees/],
  ['missing registry', (r) => rmSync(join(r, 'tools/github-ids.json')), /Missing or non-plain/],
  ['unrecognized mail row', (r) => { const p = join(r, 'WHITE_PAGES/mail-ledger.md'); put(r, 'WHITE_PAGES/mail-ledger.md', readFileSync(p, 'utf8') + '- malformed mail row\n'); }, /Malformed mail/],
]) test(`fails loudly on ${name}, never emitting a partial corpus`, (t) => {
  const { repo } = fixture(t); const parent = git(repo, ['rev-parse', 'HEAD']);
  const commit = crossing(repo, { beforeSave: () => mutate(repo) });
  const result = run(repo, ['--crossing', commit]); assert.equal(result.status, 1);
  assert.equal(result.stdout, ''); assert.match(result.stderr, pattern); assert.ok(parent);
});

test('refuses incorrect read-parent, non-first-parent selection and unreceipted delivery', (t) => {
  const { repo, initial } = fixture(t); const first = crossing(repo);
  const second = crossing(repo, { id: 'alice-two', number: 11, beforeSave: () => {
    const path = 'WHITE_PAGES/crossing-ledger.md';
    put(repo, path, readFileSync(join(repo, path), 'utf8').replace(`town: ${first}`, `town: ${initial}`));
  } });
  assert.throws(() => readCrossings({ repo, crossing: second }), /not delivery commit's first parent/);
  const fork = git(repo, ['commit-tree', `${initial}^{tree}`, '-p', initial, '-m', 'Distinct synthetic history']);
  assert.throws(() => readCrossings({ repo, after: fork, through: first }), /first-parent history/);
  // The fork IS an ancestor through the merge's SECOND parent. Plain rev-list
  // admits it; the contractual first-parent selector must still reject it.
  const merge = git(repo, ['commit-tree', `${first}^{tree}`, '-p', first, '-p', fork, '-m', 'Synthetic two-parent merge']);
  git(repo, ['merge-base', '--is-ancestor', fork, merge]);
  assert.ok(git(repo, ['rev-list', merge]).split('\n').includes(fork));
  assert.throws(() => readCrossings({ repo, after: fork, through: merge }), /first-parent history/);
  assert.deepEqual(readCrossings({ repo, after: first, through: merge }).crossings, []);
  assert.throws(() => readCrossings({ repo, crossing: 'HEAD' }), /immutable/);
  assert.throws(() => readCrossings({ repo, crossing: second, after: initial, through: second }), /Choose/);
  const f = fixture(t), parent = f.initial;
  put(f.repo, 'WHITE_PAGES/mail-ledger.md', '# Synthetic mail\n- 2026-11-24 · alice-orphan · alice → bob · thread: new\n');
  put(f.repo, 'WHITE_PAGES/bob/inbox/alice-orphan.md', letter('alice-orphan', 'No receipt'));
  const orphan = save(f.repo); assert.throws(() => readCrossings({ repo: f.repo, after: parent, through: orphan }), /No new crossing/);
});

test('refuses a non-plain immutable delivered source without following a Git symlink', (t) => {
  const s = fixture(t);
  // Git-only synthetic link: no actual OS link or external file is followed.
  const p = 'WHITE_PAGES/bob/inbox/alice-link.md';
  put(s.repo, 'WHITE_PAGES/mail-ledger.md', '# Synthetic mail\n- 2026-11-24 · alice-link · alice → bob · thread: new\n');
  put(s.repo, 'WHITE_PAGES/crossing-ledger.md', CROSSING_LEDGER_PREAMBLE + crossingReceiptLine({ date: '2026-11-24', crossing: 10, townSha: s.initial, delivered: 1, bounced: 0 }) + '\n');
  git(s.repo, ['add', '-A']);
  const blob = git(s.repo, ['hash-object', '-w', '--stdin'], '../outside');
  git(s.repo, ['update-index', '--add', '--cacheinfo', `120000,${blob},${p}`]);
  git(s.repo, ['commit', '-q', '-m', 'Synthetic unsafe immutable file']);
  assert.throws(() => readCrossings({ repo: s.repo, crossing: git(s.repo, ['rev-parse', 'HEAD']) }), /non-plain immutable file/);
});

test('missing endpoint ledger is not an empty range; unreceipted space-path bounce is not skipped', (t) => {
  const { repo, initial } = fixture(t);
  rmSync(join(repo, 'WHITE_PAGES/crossing-ledger.md')); const missing = save(repo);
  assert.throws(() => readCrossings({ repo, after: missing, through: missing }), /Missing or non-plain/);
  const b = fixture(t);
  put(b.repo, 'WHITE_PAGES/mail-ledger.md', '# Synthetic mail\n- 2026-11-24 · BOUNCE · WHITE_PAGES/alice/outbox/letter-bad name (from alice): malformed\n');
  const orphan = save(b.repo);
  assert.throws(() => readCrossings({ repo: b.repo, after: b.initial, through: orphan }), /No new crossing/);
  assert.ok(initial);
});

test('safe help and strict CLI reject unknown, duplicate, mutable and incomplete selectors', () => {
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }); assert.equal(help.status, 0); assert.match(help.stdout, /Full 40-character/);
  for (const args of [[], ['--repo'], ['--unknown', 'x'], ['--repo', 'x', '--repo', 'y']]) {
    const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' }); assert.equal(r.status, 1); assert.equal(r.stdout, '');
  }
});
