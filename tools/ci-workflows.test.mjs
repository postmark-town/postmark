// ci-workflows.test.mjs — suite.yml keeps the shape POS-516 gave them.
//   node --test tools/ci-workflows.test.mjs
// No YAML parser here (zero dependencies), so the workflows are read as text with
// their comment lines removed, and each rule is a pattern on what remains. Two
// behaviours are also run for real, in throwaway towns: a failing assertion makes
// `node --test` exit non-zero, and a tampered signed ledger makes the verifier
// exit 1 (not a warning). Nothing here touches the live ledger or any real letter.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
// A nested `node --test` inherits NODE_TEST_CONTEXT from this run and then reports
// a failure without exiting non-zero, so the children below get a clean env.
const cleanEnv = { ...process.env };
delete cleanEnv.NODE_TEST_CONTEXT;
const workflow = (name) => readFileSync(join(ROOT, '.github', 'workflows', name), 'utf8')
  .replace(/\r/g, '')
  .split('\n')
  .filter((l) => !/^\s*#/.test(l))
  .join('\n');

const suite = workflow('suite.yml');
const witness = workflow('witness.yml');
const count = (text, re) => (text.match(re) ?? []).length;

// the text of one job: from its "  name:" line to the next job (or the end)
function job(name) {
  const m = new RegExp('^  ' + name + ':\\n([\\s\\S]*?)(?=^  [a-z][\\w-]*:\\n|(?![\\s\\S]))', 'm').exec(suite.slice(suite.indexOf('\njobs:')));
  assert.ok(m, 'job ' + name + ' exists');
  return m[1];
}
const header = suite.slice(0, suite.indexOf('\njobs:'));
const tools = job('tools');
const scan = job('scan');

test('one workflow file holds both jobs; there is no second one for the scan', () => {
  assert.equal(count(suite, /^name: suite$/gm), 1);
  assert.deepEqual([...suite.matchAll(/^  ([a-z][\w-]*):$/gm)].map((m) => m[1]).filter((n) => ['tools', 'scan'].includes(n)), ['tools', 'scan']);
  assert.equal(existsSync(join(ROOT, '.github', 'workflows', 'outbox-scan.yml')), false);
});

test('triggers: pull_request into main and trains, push to main only, a daily schedule, manual dispatch', () => {
  assert.match(header, /^on:\n  pull_request:\n    branches: \[main, "train\/\*\*"\]\n  push:\n    branches: \[main\]\n  schedule:\n    - cron: "[^"]+"\n  workflow_dispatch:\n/m);
});

test('never pull_request_target; read-only permissions; no secrets, no write scope', () => {
  assert.doesNotMatch(suite, /pull_request_target/);
  assert.match(header, /^permissions:\n  contents: read\n/m);
  assert.doesNotMatch(suite, /:\s*write\b/);
  assert.doesNotMatch(suite, /secrets\./);
});

test('the tools job runs the exact tools wildcard and the standalone verifier, once each, and nothing else', () => {
  assert.equal(count(tools, /^\s+run: node --test tools\/\*\.test\.mjs$/gm), 1);
  assert.equal(count(tools, /^\s+run: node tools\/stamp-verify\.mjs$/gm), 1);
  assert.equal(count(tools, /^\s+run:/gm), 2);
});

test('the tools job is the PR/main gate: it never runs on the schedule', () => {
  assert.match(tools, /^    if: \$\{\{ github\.event_name != 'schedule' \}\}$/m);
  assert.doesNotMatch(tools, /envelope-check/);
});

test('the two tools steps fail independently: the verifier runs even when the tests failed', () => {
  assert.match(tools, /- name: node tools\/stamp-verify\.mjs\n\s+if: \$\{\{ !cancelled\(\) \}\}\n\s+run: node tools\/stamp-verify\.mjs/);
  assert.doesNotMatch(tools, /^\s+if:.*failure\(\)/m);
});

test('the scan job is the BARE scan, only on the schedule or by hand, never on a PR or a push', () => {
  assert.equal(count(scan, /^\s+run: node tools\/envelope-check\.mjs$/gm), 1);
  assert.equal(count(scan, /^\s+run:/gm), 1, 'no other command runs in this job');
  assert.doesNotMatch(scan, /envelope-check\.mjs[ \t]+\S/, 'no path arguments');
  assert.match(scan, /^    if: \$\{\{ github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch' \}\}$/m);
  assert.doesNotMatch(scan, /pull_request|'push'/);
});

test('the schedule is one daily cron on an off-minute', () => {
  const crons = [...header.matchAll(/^\s+- cron: "(\S+) (\S+) (\S+) (\S+) (\S+)"$/gm)];
  assert.equal(crons.length, 1);
  const [, minute, hour, dom, mon, dow] = crons[0];
  assert.match(minute, /^\d+$/);
  assert.match(hour, /^\d+$/);
  assert.deepEqual([dom, mon, dow], ['*', '*', '*'], 'every day');
  const m = Number(minute);
  assert.notEqual(m, 0, ':00 is when the ferry and everyone else fire');
  assert.notEqual(m, 17, ':17 is the witness sweep');
  assert.notEqual(m % 7, 0, "the off-box watch fires on every 7th minute");
});

test('nothing masks a failure anywhere, and nothing installs, signs or mints', () => {
  assert.doesNotMatch(suite, /continue-on-error/);
  assert.doesNotMatch(suite, /\|\|\s*(true|:)/);
  assert.doesNotMatch(suite, /\bset \+e\b/);
  assert.doesNotMatch(suite, /\bnpm\b|\byarn\b|\bpnpm\b/);
  assert.doesNotMatch(suite, /stamp-mint|--append|--key|\.pem/);
});

test('Node 24 as the witness runs it, depth-1 checkout in both jobs', () => {
  const nodeOf = (t) => /node-version:\s*"?(\d+)"?/.exec(t)?.[1];
  assert.equal(nodeOf(tools), '24');
  assert.equal(nodeOf(scan), '24');
  assert.equal(nodeOf(tools), nodeOf(witness), 'the same Node as the witness');
  assert.equal(count(suite, /uses: actions\/checkout@v4\n/g), 2);
  assert.doesNotMatch(suite, /fetch-depth/);
});

test('the witness keeps its explicit-path scan, which does not go through this file', () => {
  assert.match(witness, /xargs -0 node tools\/envelope-check\.mjs < \/tmp\/changed\.z/);
});

test('a failing assertion in a tools test makes `node --test` exit non-zero (CI red), and a passing one exits 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ci-red-'));
  const bad = join(dir, 'bad.test.mjs');
  const good = join(dir, 'good.test.mjs');
  writeFileSync(bad, "import test from 'node:test'; import assert from 'node:assert/strict'; test('x', () => assert.equal(1, 2));\n");
  writeFileSync(good, "import test from 'node:test'; import assert from 'node:assert/strict'; test('x', () => assert.equal(1, 1));\n");
  assert.equal(spawnSync(process.execPath, ['--test', good], { encoding: 'utf8', env: cleanEnv }).status, 0);
  const r = spawnSync(process.execPath, ['--test', bad], { encoding: 'utf8', env: cleanEnv });
  assert.notEqual(r.status, 0, 'a failing assertion must not exit 0');
  rmSync(dir, { recursive: true, force: true });
});

test('a tampered signed ledger makes stamp-verify exit 1, not a warning; the untampered control exits 0', () => {
  const repo = mkdtempSync(join(tmpdir(), 'ci-verify-'));
  mkdirSync(join(repo, 'tools'));
  for (const h of ['alice', 'bob']) {
    mkdirSync(join(repo, 'WHITE_PAGES', h), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', h, 'ADDRESS.md'), `---\nhandle: ${h}\n---\n`);
  }
  writeFileSync(join(repo, 'tools', 'github-ids.json'), '{}');
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'),
    '# ledger\n\n- 2026-07-01 · a-1 · alice → bob · thread: new\n- 2026-07-02 · b-1 · bob → alice · thread: new\n');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
  const keyFile = join(repo, 'throwaway-pen.pem');
  writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const mint = spawnSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  assert.equal(mint.status, 0, `${mint.stdout}${mint.stderr}`);
  const verify = () => spawnSync(process.execPath, [join(HERE, 'stamp-verify.mjs'), '--repo', repo], { encoding: 'utf8' });
  assert.equal(verify().status, 0, 'control: the untampered ledger verifies');

  const ledger = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  const text = readFileSync(ledger, 'utf8');
  assert.ok(text.includes('MINT → alice'), 'the fixture ledger has a mint line to tamper with');
  writeFileSync(ledger, text.replace('MINT → alice', 'MINT → alicf'));
  const tampered = verify();
  assert.equal(tampered.status, 1, `${tampered.stdout}${tampered.stderr}`);
  rmSync(repo, { recursive: true, force: true });
});
