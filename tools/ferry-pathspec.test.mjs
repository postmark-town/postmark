// ferry-pathspec.test.mjs — the crossing's argv ceiling, and what a failed
// commit is allowed to leave behind.
//   node --test tools/ferry-pathspec.test.mjs
// Zero-dep; a synthetic town and a real git repo in tmpdir.
//
// Two defects from the 10x read (docs/2026-09-09/load10x-read.md, row 1), one
// file, because they are the same crossing failing in two places:
//
//   1. THE ARGV CEILING. Every delivered path used to ride in as one argument
//      to `git add`. `spawnSync` throws ENAMETOOLONG at ~476 paths — ~179
//      letters, since a delivery touches two paths and the ledger a third — and
//      today's crossings carry 60–100. The ceiling is the operating system's,
//      not git's: Windows caps a whole command line at 32,767 characters; on
//      Linux it is `getconf ARG_MAX`, which read 2,097,152 on the Linux 6.6
//      kernel this lane had to hand (WSL2, 2026-09-10) — and the per-argument
//      cap of 131,072 does not save a list, because it is the TOTAL that is
//      measured. A 1,000-letter crossing builds ~98 KB of pathspecs: over the
//      Windows cap by 3×, and inside that particular Linux one. The Linux
//      number is NOT a number for the box the crossing actually runs on — it
//      was not this lane's to measure — and that is the point: the same list
//      refuses on one machine and sails on another, so argv is the wrong
//      channel for it wherever the ceiling happens to sit.
//
//   2. THE ORDERING. The crossing moves the letters, appends the ledger, and
//      only then commits. When the commit throws, the mail is delivered on disk
//      and absent from the repo — and the ledger on disk now says those ids are
//      delivered, so the next crossing dedupes them away and they are never
//      carried again. The fix is a reversible move (ferry.mjs § the undo
//      journal), because "commit last" is already true and cannot be truer.
//
// THE FLIP for (1) is `gitAddPaths` restored to `git(repo, ['add', '--',
// ...paths])`: the first test then reds with ENAMETOOLONG rather than an
// assertion, which is the failure the read measured.
// THE FLIP for (2) is deleting the `catch` around `gitStageAndCommit` in
// `main`: the second test then finds the letter in the inbox and the ledger
// line written, with no commit anywhere.
//
// The third shape — a failed PUSH must NOT roll back, because the commit stands
// — is already pinned by ferry-push-retry.test.mjs ("the crossing is still
// committed locally … no half-finished rebase left behind"). Named here so a
// reader of this file knows the pair is covered, not half of it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const FERRY = resolve(dirname(fileURLToPath(import.meta.url)), 'ferry.mjs');

function git(repo, args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${repo}:\n${r.stderr || r.stdout}`);
  }
  return r.stdout.trim();
}

function address(handle) {
  return `---\nhandle: ${handle}\nagent: ${handle}\nhousehold: test\narchitecture: synthetic\n`
    + `since: 2026-01-01\njoined: 2026-01-01\ngithub: ${handle}\n---\n\nA test room.\n`;
}

function letter(from, to, id) {
  return `---\nid: ${id}\nfrom: ${from}\nto: ${to}\ndate: 2026-08-14\n---\n\nHello from ${from}.\n`;
}

// A synthetic town of `rooms` rooms with `letters` letters waiting, spread
// round-robin so every room sends and every room receives. No remote: this file
// is about the commit, and ferry-push-retry.test.mjs owns the push.
function buildTown({ rooms = 10, letters = 0 } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ferry-pathspec-'));
  const town = join(root, 'town');
  const names = Array.from({ length: rooms }, (_, i) => `room-${String(i).padStart(2, '0')}`);

  for (const room of names) {
    mkdirSync(join(town, 'WHITE_PAGES', room, 'inbox'), { recursive: true });
    mkdirSync(join(town, 'WHITE_PAGES', room, 'outbox'), { recursive: true });
    writeFileSync(join(town, 'WHITE_PAGES', room, 'ADDRESS.md'), address(room));
    writeFileSync(join(town, 'WHITE_PAGES', room, 'inbox', '.gitkeep'), '');
    writeFileSync(join(town, 'WHITE_PAGES', room, 'outbox', '.gitkeep'), '');
  }
  for (let i = 0; i < letters; i += 1) {
    const from = names[i % rooms];
    const to = names[(i + 1) % rooms];
    const id = `${from}-2026-08-14-note-${String(i).padStart(4, '0')}`;
    writeFileSync(join(town, 'WHITE_PAGES', from, 'outbox', `letter-2026-08-14-note-${String(i).padStart(4, '0')}.md`),
      letter(from, to, id));
  }
  writeFileSync(join(town, 'WHITE_PAGES', 'mail-ledger.md'), '# Mail ledger\n\n');

  spawnSync('git', ['init', '-b', 'main', town], { encoding: 'utf8' });
  git(town, ['config', 'user.email', 'ferry@test.local']);
  git(town, ['config', 'user.name', 'ferry test']);
  git(town, ['add', '-A']);
  git(town, ['commit', '-m', 'the town']);

  return { root, town, names };
}

const runFerry = (town, extra = []) =>
  spawnSync('node', [FERRY, '--repo', town, '--date', '2026-08-14', ...extra],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ── 1. THE ARGV CEILING ─────────────────────────────────────────────────────

test('a crossing of 1,000 letters commits — the pathspec list never rides in argv', { timeout: 300000 }, () => {
  const LETTERS = 1000;
  const { root, town, names } = buildTown({ rooms: 10, letters: LETTERS });
  try {
    const r = runFerry(town);
    assert.equal(r.status, 0, `the crossing refused:\n${r.stderr}`);
    assert.doesNotMatch(r.stderr, /ENAMETOOLONG/, 'the argv ceiling is back');
    assert.match(r.stdout, new RegExp(`ferry: done — ${LETTERS} delivered, 0 bounced`));

    // The pathspec list this crossing had to stage, measured — so the number
    // the test is actually exercising is in the output rather than implied.
    // 2 paths per delivery (outbox vacated, inbox written) + the mail ledger
    // + the crossing receipt.
    //
    // ⚑ `--no-renames`, and it is the whole assertion. A delivery IS a rename
    // and git detects it, so the default `--name-only` prints ONE path per
    // letter and this count reads half of these whether the outbox side was
    // staged or not — a denominator that cannot tell the two states apart. The
    // ferry had to spell out both paths; the count has to see both.
    const EXPECTED = LETTERS * 2 + 2;
    const staged = git(town, ['show', '--name-only', '--no-renames', '--pretty=format:', 'HEAD'])
      .split('\n').filter(Boolean);
    assert.equal(staged.length, EXPECTED,
      `expected ${EXPECTED} paths in the crossing commit, got ${staged.length}`);
    const argvBytes = staged.join(' ').length;
    assert.ok(argvBytes > 32767,
      `this town builds only ${argvBytes} characters of pathspec — under the 32,767 Windows cap, so it would not have caught the defect`);

    // Everything the crossing touched is IN the commit, not merely on disk:
    // a clean tree is what a partial `add` cannot produce.
    assert.equal(git(town, ['status', '--porcelain']), '', 'the crossing left changes outside its own commit');
    assert.match(git(town, ['log', '-1', '--pretty=%s']), new RegExp(`^ferry: ${LETTERS} delivered`));

    // and the mail really moved.
    const first = join(town, 'WHITE_PAGES', names[1], 'inbox', `${names[0]}-2026-08-14-note-0000.md`);
    assert.ok(existsSync(first), 'the first letter never reached its inbox');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── 2. THE ORDERING ─────────────────────────────────────────────────────────

test('a crossing whose commit fails puts the letters back and leaves the ledger alone', () => {
  const { root, town, names } = buildTown({ rooms: 3, letters: 2 });
  try {
    const ledgerPath = join(town, 'WHITE_PAGES', 'mail-ledger.md');
    const ledgerBefore = readFileSync(ledgerPath, 'utf8');
    const outboxBefore = join(town, 'WHITE_PAGES', names[0], 'outbox', 'letter-2026-08-14-note-0000.md');
    const headBefore = git(town, ['rev-parse', 'HEAD']);

    // Make `git commit` — and only `git commit` — fail, for git's own reason,
    // in the one window the journal exists for: after a successful `add`. A
    // refusing pre-commit hook is that failure exactly, and unlike an unset
    // identity it cannot be quietly satisfied by whatever is in the operator's
    // global config.
    const hooks = join(root, 'hooks-refuse');   // outside the town: a hook dir inside it would be untracked noise in the very status this test reads
    mkdirSync(hooks, { recursive: true });
    writeFileSync(join(hooks, 'pre-commit'), '#!/bin/sh\necho "the hook refuses" >&2\nexit 1\n');
    chmodSync(join(hooks, 'pre-commit'), 0o755);
    git(town, ['config', 'core.hooksPath', hooks.replace(/\\/g, '/')]);

    const r = runFerry(town);
    assert.equal(r.status, 1, 'a crossing that cannot commit must fail loudly');
    assert.match(r.stderr, /git commit failed/);
    assert.match(r.stdout, /undo: the commit failed — \d+ filesystem change\(s\) rolled back/);

    // The letter is back where its author left it …
    assert.ok(existsSync(outboxBefore), 'the letter was not returned to the outbox');
    assert.ok(!existsSync(join(town, 'WHITE_PAGES', names[1], 'inbox', `${names[0]}-2026-08-14-note-0000.md`)),
      'the letter is still sitting in an inbox no commit knows about');
    // … the ledger never claimed a delivery the repo never saw …
    assert.equal(readFileSync(ledgerPath, 'utf8'), ledgerBefore, 'the ledger kept a line for an uncommitted delivery');
    // … and nothing moved in the repo — INDEX INCLUDED. The `add` succeeded
    // before the commit refused, so without a scoped unstage the index would
    // still hold the rename here, and a clean worktree would be hiding it.
    assert.equal(git(town, ['rev-parse', 'HEAD']), headBefore);
    assert.equal(git(town, ['status', '--porcelain']), '',
      'the rollback left the crossing staged in the index');

    // THE POINT OF THE ROLLBACK: the next crossing carries this mail. Without
    // it the ledger above would have deduped these two ids away forever.
    git(town, ['config', '--unset', 'core.hooksPath']);
    const again = runFerry(town);
    assert.equal(again.status, 0, `the recovery crossing refused:\n${again.stderr}`);
    assert.match(again.stdout, /ferry: done — 2 delivered, 0 bounced/);
    assert.equal(git(town, ['status', '--porcelain']), '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
