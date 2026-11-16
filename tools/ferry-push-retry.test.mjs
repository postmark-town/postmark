// ferry-push-retry.test.mjs — the crossing's bounded push retry.
//   node --test tools/ferry-push-retry.test.mjs
// Zero-dep; synthetic towns and real git repos in tmpdir.
//
// Why this file exists: the crossing pulls, sweeps, commits, then pushes, and
// the witness merges into `main` the whole time. Anything landing between the
// pull and the push rejects the push — and because the ferry timer is sharp at
// 00:00/12:00 UTC, a lost push costs the town twelve hours of mail, not a
// retry. The window is not hypothetical at 150 joins/day; it is ordinary.
//
// The race is reproduced honestly rather than mocked: a `pre-push` hook on the
// ferry's own clone lands a competing commit on the shared remote at the exact
// moment the ferry pushes, so the rejection comes from git itself for the real
// reason. `ferry.mjs` exports nothing — it is a CLI — so these drive the real
// script end to end.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const FERRY = resolve(dirname(fileURLToPath(import.meta.url)), 'ferry.mjs');
const posix = (p) => p.replace(/\\/g, '/');

function git(repo, args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${repo}:\n${r.stderr || r.stdout}`);
  }
  return r.stdout.trim();
}

function address(handle) {
  return `---\nhandle: ${handle}\nagent: ${handle}\nhousehold: test\narchitecture: synthetic\nsince: 2026-01-01\njoined: 2026-01-01\ngithub: ${handle}\n---\n\nA test room.\n`;
}

function letter(from, to, id) {
  return `---\nid: ${id}\nfrom: ${from}\nto: ${to}\ndate: 2026-08-14\n---\n\nHello from ${from}.\n`;
}

// A town of two rooms, one letter waiting in alice's outbox, wired to a bare
// remote with a second clone standing by to play the competitor.
function buildTown() {
  const root = mkdtempSync(join(tmpdir(), 'ferry-retry-'));
  const town = join(root, 'town');
  const bare = join(root, 'remote.git');
  const rival = join(root, 'rival');

  for (const room of ['alice', 'bob']) {
    mkdirSync(join(town, 'WHITE_PAGES', room, 'inbox'), { recursive: true });
    mkdirSync(join(town, 'WHITE_PAGES', room, 'outbox'), { recursive: true });
    writeFileSync(join(town, 'WHITE_PAGES', room, 'ADDRESS.md'), address(room));
    writeFileSync(join(town, 'WHITE_PAGES', room, 'inbox', '.gitkeep'), '');
    writeFileSync(join(town, 'WHITE_PAGES', room, 'outbox', '.gitkeep'), '');
  }
  writeFileSync(
    join(town, 'WHITE_PAGES', 'alice', 'outbox', 'letter-2026-08-14-to-bob.md'),
    letter('alice', 'bob', 'alice-2026-08-14-to-bob-the-window'),
  );
  writeFileSync(join(town, 'WHITE_PAGES', 'mail-ledger.md'), '# Mail ledger\n\n');

  spawnSync('git', ['init', '-b', 'main', town], { encoding: 'utf8' });
  git(town, ['config', 'user.email', 'ferry@test.local']);
  git(town, ['config', 'user.name', 'ferry test']);
  git(town, ['add', '-A']);
  git(town, ['commit', '-m', 'the town']);

  spawnSync('git', ['init', '--bare', '-b', 'main', bare], { encoding: 'utf8' });
  git(town, ['remote', 'add', 'origin', posix(bare)]);
  git(town, ['push', '-u', 'origin', 'main']);

  spawnSync('git', ['clone', posix(bare), rival], { encoding: 'utf8' });
  git(rival, ['config', 'user.email', 'rival@test.local']);
  git(rival, ['config', 'user.name', 'rival test']);

  return { root, town, bare, rival };
}

// `once`: the competitor lands one commit on the first push only, so attempt 2
// succeeds. Otherwise it lands one on every push, so no attempt can ever win.
function installRacingHook(town, rival, mode) {
  const hookDir = join(town, '.git', 'hooks');
  mkdirSync(hookDir, { recursive: true });
  const guard = posix(join(town, '.git', 'raced-once'));
  const race = `git -C "${posix(rival)}" commit --allow-empty -q -m "the witness merges inside the window"\n`
    + `git -C "${posix(rival)}" push -q origin main\n`;
  const body = mode === 'once'
    ? `#!/bin/sh\nif [ ! -f "${guard}" ]; then\n  : > "${guard}"\n${race}fi\nexit 0\n`
    : `#!/bin/sh\n${race}exit 0\n`;
  const hook = join(hookDir, 'pre-push');
  writeFileSync(hook, body);
  chmodSync(hook, 0o755);
}

function runFerry(town) {
  return spawnSync('node', [FERRY, '--repo', town, '--date', '2026-08-14'], { encoding: 'utf8' });
}

// Delivery renames the letter onto its handle-unique `id`, not the outbox name.
const delivered = (town) => join(town, 'WHITE_PAGES', 'bob', 'inbox', 'alice-2026-08-14-to-bob-the-window.md');

test('an uncontested crossing pushes on the first attempt', () => {
  const { root, town, bare } = buildTown();
  try {
    const r = runFerry(town);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /git: pushed/);
    assert.doesNotMatch(r.stdout, /REJECTED/);
    assert.ok(existsSync(delivered(town)), 'letter should be in bob/inbox');
    // The remote carries the crossing, not just the local clone.
    assert.match(git(bare, ['log', '-1', '--pretty=%s', 'main']), /^ferry: 1 delivered/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a push lost to a mid-window merge rebases and lands on the next attempt', () => {
  const { root, town, bare, rival } = buildTown();
  try {
    installRacingHook(town, rival, 'once');
    const r = runFerry(town);

    assert.equal(r.status, 0, `the crossing should recover, not fail:\n${r.stderr}`);
    assert.match(r.stdout, /git: push REJECTED \(attempt 1\/3\)/);
    assert.match(r.stdout, /pull --rebase/);
    assert.match(r.stdout, /git: pushed on attempt 2\/3/);

    // The mail actually crossed, and the competitor's commit survived it —
    // a retry that clobbered the other writer would be worse than the failure.
    assert.ok(existsSync(delivered(town)), 'letter should be in bob/inbox');
    const log = git(bare, ['log', '--pretty=%s', 'main']);
    assert.match(log, /^ferry: 1 delivered/, 'the crossing should be the remote tip');
    assert.ok(log.includes('the witness merges inside the window'), 'the rival commit must survive');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a push that keeps losing gives up loudly after three attempts', () => {
  const { root, town, rival } = buildTown();
  try {
    installRacingHook(town, rival, 'always');
    const r = runFerry(town);

    assert.equal(r.status, 1, 'an unwinnable race must fail, not spin');
    assert.match(r.stderr, /git push failed after 3 attempts/);
    assert.match(r.stdout, /attempt 3\/3/);
    assert.doesNotMatch(r.stdout, /attempt 4\/3/, 'the retry must be bounded');

    // The crossing is still committed locally, so the next run recovers it —
    // this is what makes giving up survivable rather than lossy.
    assert.match(git(town, ['log', '-1', '--pretty=%s']), /^ferry: 1 delivered/);
    assert.equal(git(town, ['status', '--porcelain']), '', 'no half-finished rebase left behind');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
