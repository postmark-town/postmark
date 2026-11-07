// ferry-report.test.mjs — POS-907: `ferry.mjs --report` says what the crossing
// did, delivered, quiet or failed, for the witness chain to record.
//   node --test tools/ferry-report.test.mjs
//
// LAW (Darko, 2026-11-06, POS-907/c): "Quiet and refused crossings get records
//   too." So the report is written on every path, the failing one included.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const FERRY = resolve(dirname(fileURLToPath(import.meta.url)), 'ferry.mjs');

function git(repo, args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr || r.stdout}`);
  return r.stdout.trim();
}
const address = (h) => `---\nhandle: ${h}\nagent: ${h}\nhousehold: test\narchitecture: synthetic\nsince: 2026-01-01\njoined: 2026-01-01\ngithub: ${h}\n---\n\nA test room.\n`;
const letter = (from, to, id) => `---\nid: ${id}\nfrom: ${from}\nto: ${to}\ndate: 2026-11-06\n---\n\nHello from ${from}.\n`;

function town(t, { withLetter = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ferry-report-'));
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
  const repo = join(root, 'town');
  const bare = join(root, 'remote.git');
  for (const room of ['alice', 'bob']) {
    for (const box of ['inbox', 'outbox']) {
      mkdirSync(join(repo, 'WHITE_PAGES', room, box), { recursive: true });
      writeFileSync(join(repo, 'WHITE_PAGES', room, box, '.gitkeep'), '');
    }
    writeFileSync(join(repo, 'WHITE_PAGES', room, 'ADDRESS.md'), address(room));
  }
  if (withLetter) writeFileSync(join(repo, 'WHITE_PAGES', 'alice', 'outbox', 'letter-2026-11-06-to-bob.md'), letter('alice', 'bob', 'alice-2026-11-06-to-bob-hello'));
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), '# Mail ledger\n\n');
  spawnSync('git', ['init', '-q', '-b', 'main', repo]);
  git(repo, ['config', 'user.email', 'ferry@test.local']);
  git(repo, ['config', 'user.name', 'ferry test']);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'the town']);
  spawnSync('git', ['init', '-q', '--bare', '-b', 'main', bare]);
  git(repo, ['remote', 'add', 'origin', bare]);
  git(repo, ['push', '-q', '-u', 'origin', 'main']);
  return { root, repo, bare, report: join(root, 'report.json') };
}

const ferry = (fx, extra = []) => spawnSync(process.execPath, [FERRY, '--repo', fx.repo, ...extra], { encoding: 'utf8' });

test('a crossing that moved mail reports the sha it read, its counts and the files its commit carried', (t) => {
  const fx = town(t);
  const read = git(fx.repo, ['rev-parse', 'HEAD']);
  const r = ferry(fx, ['--report', fx.report]);
  assert.equal(r.status, 0, r.stderr);
  const rep = JSON.parse(readFileSync(fx.report, 'utf8'));
  assert.equal(rep.ran, true);
  assert.equal(rep.town_sha, read, 'the sha the crossing READ, not the one it made');
  assert.equal(Number.isSafeInteger(rep.crossing), true);
  assert.deepEqual([rep.delivered, rep.bounced, rep.committed, rep.pushed], [1, 0, true, true]);
  assert.ok(rep.files.includes('WHITE_PAGES/bob/inbox/alice-2026-11-06-to-bob-hello.md'), JSON.stringify(rep.files));
  assert.ok(rep.files.includes('WHITE_PAGES/mail-ledger.md'));
  assert.ok(rep.files.includes('WHITE_PAGES/crossing-ledger.md'));
  assert.ok(!rep.files.some((p) => p.includes('/outbox/')), 'a letter that left its outbox is a deletion, not a file the commit carried');
});

test('a quiet crossing reports itself: nothing moved, nothing committed', (t) => {
  const fx = town(t, { withLetter: false });
  const r = ferry(fx, ['--report', fx.report]);
  assert.equal(r.status, 0, r.stderr);
  const rep = JSON.parse(readFileSync(fx.report, 'utf8'));
  assert.deepEqual([rep.ran, rep.delivered, rep.bounced, rep.committed, rep.pushed, rep.files], [true, 0, 0, false, false, []]);
});

test('a crossing whose push is refused still reports: delivered and committed, not pushed, and why', (t) => {
  const fx = town(t);
  writeFileSync(join(fx.bare, 'hooks', 'pre-receive'), '#!/bin/sh\necho "the remote refuses this push" >&2\nexit 1\n', { mode: 0o755 });
  const r = ferry(fx, ['--report', fx.report]);
  assert.equal(r.status, 1, 'the crossing itself still fails, as before');
  const rep = JSON.parse(readFileSync(fx.report, 'utf8'));
  assert.deepEqual([rep.ran, rep.delivered, rep.committed, rep.pushed], [true, 1, true, false], 'the partial effect: mail moved and committed here, not out');
  assert.match(rep.error, /git push failed/);
});

test('a crossing that cannot even pull reports that it never ran', (t) => {
  const fx = town(t);
  renameSync(fx.bare, `${fx.bare}.gone`);
  const r = ferry(fx, ['--report', fx.report]);
  assert.equal(r.status, 1);
  const rep = JSON.parse(readFileSync(fx.report, 'utf8'));
  assert.equal(rep.ran, false, 'no crossing was read, so none is claimed');
  assert.match(rep.error, /git/);
});

test('without --report the ferry writes no report, as before', (t) => {
  const fx = town(t);
  const r = ferry(fx);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(existsSync(fx.report), false);
});

// ── A FAILED CARRIED-FILE READ IS NO "NO FILES" (Wright's fit, POS-907, 2026-11-07) ──
//
// "don't carry the failed file-list read as a low." The ferry reads the files
// its commit carried with `git diff-tree`; when that read fails, the report
// leaves `files` UNSET (never `[]`, which says the commit carried nothing), so
// the witness's report check owes the crossing as incomplete instead of signing
// it without its letters' digests. The read fails for real here: a `git` first
// on PATH answers diff-tree with git's own fatal exit and runs the real git for
// everything else. Then the real owe-mail reads the real report.

const WITNESS_CLI = resolve(dirname(fileURLToPath(import.meta.url)), 'witness-chain.mjs');
const { listOwed } = await import('./witness-chain.mjs');

/** A PATH whose `git` fails `diff-tree` (exit 128, git's fatal) and is the real git otherwise. */
function failingDiffTree(t) {
  const real = process.env.PATH.split(':').map((d) => join(d, 'git')).find((p) => existsSync(p));
  assert.ok(real, 'no git on PATH');
  const dir = mkdtempSync(join(tmpdir(), 'ferry-report-git-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'git'), `#!/bin/sh\nfor a in "$@"; do [ "$a" = diff-tree ] && { echo "fatal: unable to read tree (the read under test)" >&2; exit 128; }; done\nexec "${real}" "$@"\n`, { mode: 0o755 });
  return `${dir}:${process.env.PATH}`;
}
const ferryWith = (fx, env, extra = []) => spawnSync(process.execPath, [FERRY, '--repo', fx.repo, '--report', fx.report, ...extra], { encoding: 'utf8', env: { ...process.env, ...env } });
const oweMail = (fx, owed, exit, stage) => spawnSync(process.execPath, [WITNESS_CLI, 'owe-mail', '--repo', fx.repo, '--owed', owed,
  '--attempt', `ferry-${exit}`, '--exit', String(exit), '--stage', stage, '--ferry-report', fx.report], { encoding: 'utf8' });

test('a crossing whose carried-file read FAILS reports no files list at all, never []; the witness then owes it as incomplete, never signs it', (t) => {
  const fx = town(t);
  const r = ferryWith(fx, { PATH: failingDiffTree(t) });
  assert.equal(r.status, 0, `the crossing itself is unchanged: ${r.stderr}`);
  const rep = JSON.parse(readFileSync(fx.report, 'utf8'));
  assert.deepEqual([rep.ran, rep.delivered, rep.committed, rep.pushed], [true, 1, true, true], 'the mail moved, committed and pushed');
  assert.equal(Object.hasOwn(rep, 'files'), false, `a failed read is no "no files": ${JSON.stringify(rep.files)}`);

  const owed = mkdtempSync(join(fx.root, 'owed-'));
  const w = oweMail(fx, owed, 0, 'done');
  assert.equal(w.status, 1, 'owe-mail stops, and the unit owes the run as incomplete');
  assert.match(w.stderr, /exited 0, so its ferry ran, and its report does not say what its commit carried \(committed, pushed, files\)/);
  assert.equal(listOwed(owed).owed.length, 0, 'nothing was owed as decided: no record would sign the crossing without its letters');
});

test('the same failed read on a crossing that then fails (its push refused): files unset, and the witness owes it incomplete rather than a refused record with no files', (t) => {
  const fx = town(t);
  writeFileSync(join(fx.bare, 'hooks', 'pre-receive'), '#!/bin/sh\necho "the remote refuses this push" >&2\nexit 1\n', { mode: 0o755 });
  const r = ferryWith(fx, { PATH: failingDiffTree(t) });
  assert.equal(r.status, 1, 'the crossing itself still fails, as before');
  const rep = JSON.parse(readFileSync(fx.report, 'utf8'));
  assert.deepEqual([rep.ran, rep.delivered, rep.committed, rep.pushed], [true, 1, true, false]);
  assert.equal(Object.hasOwn(rep, 'files'), false);
  const owed = mkdtempSync(join(fx.root, 'owed-'));
  const w = oweMail(fx, owed, 1, 'ferry');
  assert.equal(w.status, 1, w.stderr);
  assert.match(w.stderr, /exited 1 after its ferry ran, and its report does not say what its commit carried/);
  assert.equal(listOwed(owed).owed.length, 0);
});

test('the controls through the same owe-mail: a crossing whose read worked binds its files; a refused one with its full report is refused with its counts; one refused before its ferry claims none', (t) => {
  // the read works: delivered, with the carried files bound as artifacts
  const ok = town(t);
  assert.equal(ferryWith(ok, {}).status, 0);
  const okOwed = mkdtempSync(join(ok.root, 'owed-'));
  const w = oweMail(ok, okOwed, 0, 'done');
  assert.equal(w.status, 0, w.stderr);
  const d = listOwed(okOwed).owed[0].decided;
  assert.equal(d.outcome.status, 'delivered');
  assert.ok(d.artifacts.some((a) => a.path === 'WHITE_PAGES/bob/inbox/alice-2026-11-06-to-bob-hello.md'), 'the carried letter is bound');

  // the push refused, the read fine: refused, keeping what it did
  const refused = town(t);
  writeFileSync(join(refused.bare, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  assert.equal(ferryWith(refused, {}).status, 1);
  const rOwed = mkdtempSync(join(refused.root, 'owed-'));
  assert.equal(oweMail(refused, rOwed, 1, 'ferry').status, 0);
  const rd = listOwed(rOwed).owed[0].decided;
  assert.deepEqual([rd.outcome.status, rd.outcome.ferry?.committed, rd.outcome.ferry?.pushed], ['refused', true, false]);

  // refused before its ferry: no report (the unit empties it), and a pull that never ran (ran: false)
  for (const [label, write] of [['no report', () => writeFileSync(refused.report, '')], ['ran: false', () => writeFileSync(refused.report, JSON.stringify({ ran: false, error: 'git pull failed' }))]]) {
    write();
    const pOwed = mkdtempSync(join(refused.root, 'owed-'));
    const p = oweMail(refused, pOwed, 1, 'drain');
    assert.equal(p.status, 0, `${label}: ${p.stderr}`);
    const pd = listOwed(pOwed).owed[0].decided;
    assert.deepEqual([pd.outcome.status, pd.outcome.stage, pd.outcome.ferry], ['refused', 'drain', undefined], `${label}: refused before its ferry claims no counts`);
  }
});
