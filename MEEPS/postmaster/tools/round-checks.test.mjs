import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { checkPlan } from './round-checks.mjs';

const cli = fileURLToPath(new URL('./round-checks.mjs', import.meta.url));
const sourceRoot = resolve(dirname(cli), '../../..');
function put(repo, p, content) { mkdirSync(dirname(join(repo, p)), { recursive: true }); writeFileSync(join(repo, p), content); }
function fixture(t, actual = false) {
  const temp = realpathSync(tmpdir()), repo = mkdtempSync(join(temp, 'postmark-check-fixture-'));
  t.after(() => { assert.equal(dirname(repo), temp); assert.match(basename(repo), /^postmark-check-fixture-/); rmSync(repo, { recursive: true, force: true }); });
  put(repo, 'WHITE_PAGES/INDEX.md', '| handle | agent |\n|---|---|\n| alice | A |\n');
  put(repo, 'WHITE_PAGES/alice/ADDRESS.md', '---\nhandle: alice\nagent: A\nhousehold: H\narchitecture: fixture\nsince: 2026-11-24\njoined: 2026-11-24\ngithub: fixture-alice\n---\n');
  put(repo, 'WHITE_PAGES/mail-ledger.md', '# Synthetic mail\n');
  put(repo, 'WHITE_PAGES/stamp-ledger.md', '# Empty synthetic ledger: expected verifier failure\n');
  put(repo, 'tools/github-ids.json', '{}\n');
  if (actual) {
    for (const name of readdirSync(join(sourceRoot, 'tools')).filter((n) => n.endsWith('.mjs'))) copyFileSync(join(sourceRoot, 'tools', name), join(repo, 'tools', name));
    put(repo, 'MEEPS/postmaster/memory/welcome-audit.py', readFileSync(join(sourceRoot, 'MEEPS/postmaster/memory/welcome-audit.py')));
  } else {
    for (const name of ['reconcile', 'lint', 'stamp-verify']) put(repo, `tools/${name}.mjs`, `import{fileURLToPath}from'node:url';console.log(JSON.stringify({check:${JSON.stringify(name)},self:fileURLToPath(import.meta.url),args:process.argv.slice(2),advisory:${JSON.stringify(name === 'reconcile' ? 'SYNTHETIC ANOMALY despite exit zero' : 'retained report')}}));`);
    put(repo, 'MEEPS/postmaster/memory/welcome-audit.py', 'print("SYNTHETIC welcome report: not a delivery")\n');
  }
  return repo;
}
function snapshot(root) {
  const all = {}; const walk = (path, prefix = '') => { for (const e of readdirSync(path, { withFileTypes: true })) {
    const rel = prefix + e.name, absolute = join(path, e.name);
    if (e.isDirectory()) walk(absolute, `${rel}/`); else all[rel] = createHash('sha256').update(readFileSync(absolute)).digest('hex');
  } }; walk(root); return all;
}
function run(repo, round, phase) { return spawnSync(process.execPath, [cli, '--repo', repo, '--round', round, '--phase', phase], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 }); }

for (const round of ['oversight', 'mail', 'town']) for (const phase of ['open', 'prepush']) {
  test(`${round}/${phase}: exactly the approved checker plan, awaited raw output, no fixture effects`, (t) => {
    const repo = fixture(t), before = snapshot(repo), r = run(repo, round, phase);
    assert.equal(r.status, 0, r.stderr); const x = JSON.parse(r.stdout);
    assert.deepEqual(x.checks.map((c) => c.name), ['reconcile', 'lint', 'stamp-verify', ...(round === 'mail' && phase === 'open' ? ['welcome-audit'] : [])]);
    assert.equal(x.completed_without_process_errors, true);
    for (const c of x.checks) { assert.equal(c.exit_code, 0); assert.ok(c.stdout); assert.equal(c.error, null); }
    assert.match(x.checks[0].stdout, /ANOMALY despite exit zero/); assert.match(x.interpretation, /advisory/);
    const reconcile = JSON.parse(x.checks[0].stdout), lint = JSON.parse(x.checks[1].stdout), stamp = JSON.parse(x.checks[2].stdout);
    assert.deepEqual(reconcile.args, ['--repo', realpathSync(repo), '--json']); assert.deepEqual(lint.args, []);
    assert.deepEqual(stamp.args, ['--repo', realpathSync(repo)]);
    assert.equal(lint.self, join(realpathSync(repo), 'tools/lint.mjs'));
    assert.ok(!x.checks.some((c) => c.argv.includes('--log-file') || c.argv.includes('--registry')));
    assert.deepEqual(snapshot(repo), before);
  });
}

test('actual unchanged checkers read only the complete synthetic layout; failed stamp stays loud while welcome still runs', (t) => {
  const repo = fixture(t, true), before = snapshot(repo), r = run(repo, 'mail', 'open');
  assert.equal(r.status, 1, r.stderr); const x = JSON.parse(r.stdout);
  assert.deepEqual(x.checks.map((c) => c.name), ['reconcile', 'lint', 'stamp-verify', 'welcome-audit']);
  assert.equal(x.checks[0].exit_code, 0, x.checks[0].stderr);
  assert.equal(x.checks[1].exit_code, 0, x.checks[1].stderr);
  assert.equal(x.checks[2].exit_code, 1); assert.match(x.checks[2].stderr, /stamp-ledger has no entry lines/);
  assert.equal(x.checks[3].exit_code, 0, x.checks[3].stderr); assert.match(x.checks[3].stdout, /NEVER welcomed\s*: 1/);
  assert.equal(x.completed_without_process_errors, false); assert.deepEqual(snapshot(repo), before);
});

test('spawn failure/reporting and validation cannot produce a false process pass', (t) => {
  const repo = fixture(t);
  put(repo, 'tools/lint.mjs', 'console.error("synthetic lint FAILURE");process.exit(7);');
  const r = run(repo, 'town', 'prepush'); assert.equal(r.status, 1); const x = JSON.parse(r.stdout);
  assert.equal(x.checks[1].exit_code, 7); assert.match(x.checks[1].stderr, /FAILURE/); assert.equal(x.checks[2].exit_code, 0);
  assert.equal(x.completed_without_process_errors, false);
  for (const opts of [{}, { repo, round: 'bad', phase: 'open' }, { repo, round: 'mail', phase: 'middle' }]) assert.throws(() => checkPlan(opts), /Require/);
  rmSync(join(repo, 'tools/lint.mjs')); assert.throws(() => checkPlan({ repo, round: 'mail', phase: 'open' }), /Missing checker/);
});

test('safe help and strict CLI reject unknown/duplicate/missing arguments before any checker', () => {
  const h = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }); assert.equal(h.status, 0); assert.match(h.stdout, /ONLY for mail\/open/);
  for (const args of [[], ['--repo'], ['--unknown', 'x'], ['--repo', 'x', '--repo', 'y'], ['--repo', 'x', '--round', 'mail', '--phase', 'prepush', '--registry', 'https://example.invalid']]) {
    const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' }); assert.equal(r.status, 1); assert.equal(r.stdout, '');
  }
});
