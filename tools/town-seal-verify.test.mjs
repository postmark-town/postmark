// town-seal-verify.test.mjs — POS-907: PROJECTS/the-town-seal/verify.mjs says the
// comparison it actually makes, and a missing seal is not a pass.
//   node --test tools/town-seal-verify.test.mjs
//
// From the POS-907 packet, queued by Wright 2026-11-06 ("fix its wording and its
// missing-seal success as part of this, since the verify step depends on it"):
// the verifier recomputes this checkout's ledger and compares this checkout's
// seal.json. It cannot see the pair replaced together, and with no seal.json it
// compared nothing, yet it used to exit 0 and print "the town's record is whole".
//
// The real seal.mjs and verify.mjs are copied into a scratch town's
// PROJECTS/the-town-seal/ beside an invented ledger, and run as files.

import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SEAL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'PROJECTS', 'the-town-seal');
const LEDGER = '# Mail ledger\n\n- 2026-11-01 · a-2026-11-01-hi · a → b · thread: t1\n- 2026-11-02 · b-2026-11-02-re · b → a · thread: t1\n';

function scratch(t) {
  const root = mkdtempSync(join(tmpdir(), 'town-seal-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, 'PROJECTS', 'the-town-seal');
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(root, 'WHITE_PAGES'), { recursive: true });
  for (const f of ['seal.mjs', 'verify.mjs']) copyFileSync(join(SEAL_DIR, f), join(dir, f));
  writeFileSync(join(root, 'WHITE_PAGES', 'mail-ledger.md'), LEDGER);
  const run = (file) => spawnSync(process.execPath, [join(dir, file)], { encoding: 'utf8' });
  return { root, dir, run };
}

test('NO SEAL: with no seal.json nothing was compared, and the verifier fails instead of passing', (t) => {
  const s = scratch(t);
  const r = s.run('verify.mjs');
  assert.equal(r.status, 1, `a missing seal exits non-zero; got ${r.status}:\n${r.stdout}`);
  assert.match(r.stdout, /NO SEAL/);
  assert.match(r.stdout, /nothing was compared and nothing is verified/);
});

test('MATCH: the success line names the two files it compared and what it cannot see', (t) => {
  const s = scratch(t);
  assert.equal(s.run('seal.mjs').status, 0);
  const r = s.run('verify.mjs');
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /this checkout's mail-ledger reseals to this checkout's seal\.json: all 2 deliveries and bounces/);
  assert.match(r.stdout, /cannot show they weren't replaced together, or that this is the newest ledger/);
  assert.doesNotMatch(r.stdout, /the town's record is whole/, 'until 2026-11-06 the match claimed the whole record; it no longer does');
});

test('MISMATCH: a ledger changed after sealing still fails and names the first divergence', (t) => {
  const s = scratch(t);
  s.run('seal.mjs');
  writeFileSync(join(s.root, 'WHITE_PAGES', 'mail-ledger.md'), LEDGER.replace('a → b', 'a → c'));
  const r = s.run('verify.mjs');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /MISMATCH/);
  assert.match(r.stdout, /first divergence at entry #1/);
});
