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
