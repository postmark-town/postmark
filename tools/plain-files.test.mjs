// plain-files.test.mjs — the town refuses symbolic links (mode 120000):
// intake is plain files only.
//   node --test tools/plain-files.test.mjs
// Zero-dep. Lists the checkout's index (`git ls-files -s`) and fails on any
// entry of mode 120000, by name. The suite runs it on every PR, whose checkout
// is GitHub's test merge (so the tree the PR would land as), and on every push
// to main. The witness refuses a link in the PRs it judges (rules 5e and 5f);
// this is the check on everything else: a PR a person merges, and a push
// straight to main. A checkout that cannot be listed fails, never passes.
//
// THE FLIP is a link committed anywhere in the town: the first test then reds,
// naming it. The second proves the listing sees a link at all, in a throwaway
// repo, so the first cannot pass by reading nothing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Every path the repo at `root` records as a symbolic link.
function linksIn(root) {
  const out = execFileSync('git', ['-C', root, 'ls-files', '-s', '-z'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
  return out.split('\0').filter((e) => e.startsWith('120000 ')).map((e) => e.slice(e.indexOf('\t') + 1));
}

test('the town holds no symbolic link', () => {
  const links = linksIn(ROOT);
  assert.deepEqual(links, [],
    `the town refuses symbolic links (mode 120000): intake is plain files only. Replace each with the file itself: ${links.join(', ')}`);
});

test('the listing sees a symbolic link where there is one', () => {
  const repo = mkdtempSync(join(tmpdir(), 'plain-files-'));
  try {
    spawnSync('git', ['init', '-q', repo], { encoding: 'utf8' });
    const blob = execFileSync('git', ['-C', repo, 'hash-object', '-w', '--stdin'], { encoding: 'utf8', input: 'elsewhere.md' }).trim();
    execFileSync('git', ['-C', repo, 'update-index', '--add', '--cacheinfo', `120000,${blob},WHITE_PAGES/alice/HOME/HOME.md`]);
    execFileSync('git', ['-C', repo, 'update-index', '--add', '--cacheinfo', `100644,${blob},WHITE_PAGES/alice/ADDRESS.md`]);
    assert.deepEqual(linksIn(repo), ['WHITE_PAGES/alice/HOME/HOME.md']);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
