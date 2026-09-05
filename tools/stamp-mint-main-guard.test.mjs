// stamp-mint-main-guard.test.mjs — was I RUN, or was I IMPORTED?
//   node --test tools/stamp-mint-main-guard.test.mjs
// Zero-dep; builds a link to this checkout in tmp and throws it away after.
//
// THE DEFECT THIS HOLDS SHUT. The mint's main guard compared
// `resolve(process.argv[1])` against `fileURLToPath(import.meta.url)`. Node
// resolves the real path for `import.meta.url` and leaves `argv[1]` exactly as
// the caller spelled it, so whenever the mint was reached through a symlink or a
// Windows junction the two strings named one file by two names, the guard was
// false, `main()` never ran, and THE PROCESS EXITED 0.
//
// Exit 0 with no output is the worst failure shape a tool can have: the caller
// shelled the mint precisely to get a ledger written, read the 0 as success, and
// hit ENOENT on a file that was never produced. This is not hypothetical — the
// office keeps its town checkout at `<worktree>/town-clone`, which is a junction
// to the shared clone in every lane worktree, and the 2026-09-05 flip-day gate
// came back with 33 office reds standing behind exactly this silence.
//
// WHY THE PROBE IS `--help` AND NOT A MINT. The guard is upstream of every
// argument the mint takes, so the cheapest thing that distinguishes "ran" from
// "did not run" is the strongest: with no recognised argument `main()` prints the
// usage line and exits 1. Silence and 0 is the defect; usage and 1 is the tool
// working. Nothing is signed, nothing is written, no key is needed.
//
// THE OTHER HALF OF THE GUARD IS ASSERTED TOO. A guard fixed by deleting it
// would pass the arm above and break every one of the many office modules that
// `import()` this file for its vocabulary — `main()` would run on import and
// exit the importer. So a third arm imports the mint from a child script and
// asserts nothing ran.
//
// Revert the `realpathSync` comparison in stamp-mint.mjs and the linked arm goes
// red. That flip was run before this file was committed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const MINT = join(HERE, 'stamp-mint.mjs');

/** `--help` is not a flag the mint knows, so it falls through to usage + exit 1. */
const runMint = (mintPath) => spawnSync(process.execPath, [mintPath, '--help'], { encoding: 'utf8' });

const ranAsProgram = (r) =>
  r.status === 1 && /usage: stamp-mint\.mjs/.test(`${r.stdout}${r.stderr}`);

/**
 * A link to this whole checkout, in tmp. `'junction'` is a Windows junction —
 * the exact shape the office's `town-clone` is, and creatable without elevation
 * — and is ignored on every other platform, where this becomes an ordinary
 * directory symlink. Both reproduce the defect, because both give `argv[1]` a
 * spelling `import.meta.url` will not have.
 *
 * Returns null when the platform refuses to make one (a sandbox, a filesystem
 * that cannot, a Windows without the privilege). The caller SKIPS with the
 * reason printed rather than passing quietly: a linked-path test that silently
 * never used a link is the same silence this file exists to remove.
 */
function linkedCheckout() {
  const dir = mkdtempSync(join(tmpdir(), 'mint-guard-'));
  const link = join(dir, 'townlink');
  try {
    symlinkSync(REPO, link, 'junction');
  } catch (err) {
    rmSync(dir, { recursive: true, force: true });
    return { dir: null, link: null, why: `${err.code ?? err.name}: ${err.message}` };
  }
  return { dir, link, why: null };
}

test('CONTROL: run by its real path, the mint runs', () => {
  const r = runMint(MINT);
  assert.ok(ranAsProgram(r),
    `the mint did not run even by its real path (status ${r.status}) — every other arm here ` +
    `would then be measuring the wrong thing:\n${r.stdout}${r.stderr}`);
});

test('run through a linked path, the mint RUNS — it does not exit 0 in silence', (t) => {
  const { dir, link, why } = linkedCheckout();
  if (!link) {
    t.skip(`this platform would not create a directory junction/symlink, so the guard could not be ` +
      `exercised through one — ${why}`);
    return;
  }
  try {
    // The link really is a second spelling of the same file, or the probe below
    // proves nothing at all.
    const through = join(link, 'tools', 'stamp-mint.mjs');
    assert.notEqual(through, MINT, 'the linked path and the real path are the same string');
    assert.equal(realpathSync(through), realpathSync(MINT),
      'the link does not resolve to this checkout, so this is not the case the guard fails on');

    const r = runMint(through);
    assert.notEqual(r.status, 0,
      'the mint exited 0 through a linked path — with no output and nothing done. That 0 is ' +
      'indistinguishable from success at the call site, which is how it cost 33 office reds ' +
      'and reads downstream as ENOENT on a ledger that was never written.');
    assert.ok(ranAsProgram(r),
      `the mint did not reach main() through a linked path (status ${r.status}):\n${r.stdout}${r.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('IMPORTED, not run: main() must not fire when another module imports the mint', () => {
  // The guard's other job, and the reason it cannot be fixed by deleting it: the
  // office imports this file for its vocabulary in a dozen places, and a mint
  // that ran on import would exit its importer.
  const dir = mkdtempSync(join(tmpdir(), 'mint-import-'));
  try {
    const importer = join(dir, 'importer.mjs');
    writeFileSync(importer,
      `await import(${JSON.stringify(pathToFileURL(MINT).href)});\n` +
      `console.log('IMPORTED-AND-STILL-HERE');\n`);
    const r = spawnSync(process.execPath, [importer], { encoding: 'utf8' });
    assert.equal(r.status, 0,
      `importing the mint ended the importer (status ${r.status}) — main() ran on an import:\n` +
      `${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /IMPORTED-AND-STILL-HERE/);
    assert.doesNotMatch(`${r.stdout}${r.stderr}`, /usage: stamp-mint\.mjs/,
      'the mint printed its usage on an import — the guard is answering yes to the wrong question');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('IMPORTED THROUGH A LINK: still not run', (t) => {
  // The two halves crossed: the linked spelling must not turn an import into a
  // run either. A `realpathSync`-on-both-sides guard gets this right for the
  // same reason it gets the arm above right — it is asking about the file.
  const { dir, link, why } = linkedCheckout();
  if (!link) {
    t.skip(`this platform would not create a directory junction/symlink — ${why}`);
    return;
  }
  try {
    const importer = join(dir, 'importer.mjs');
    const through = pathToFileURL(join(link, 'tools', 'stamp-mint.mjs')).href;
    writeFileSync(importer,
      `await import(${JSON.stringify(through)});\n` +
      `console.log('IMPORTED-AND-STILL-HERE');\n`);
    const r = spawnSync(process.execPath, [importer], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /IMPORTED-AND-STILL-HERE/);
    assert.doesNotMatch(`${r.stdout}${r.stderr}`, /usage: stamp-mint\.mjs/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
