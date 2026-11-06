// witness-verify.test.mjs — POS-907: the resident's check of the witness chain.
//   node --test tools/witness-verify.test.mjs
//
// LAW (Darko, 2026-11-06, POS-907/b, "Check the chain"): "a resident can confirm
//   that nothing before the newest record was changed, dropped or reordered,
//   and that each record's files match."
// LAW (NOMOS II.3.1.2): "anyone can check from the public record that nothing
//   before the newest record was changed, dropped or reordered."
//
// Each case builds a chain that is wrong in ONE way and asserts the verifier
// names it; the control is the same chain built right, which passes.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GENESIS, keyIdOf, mailDecided, makeRecord, owe, publish, recordPath, recordText } from './witness-chain.mjs';
import { verifyChain } from './witness-verify.mjs';
import { GIT_ENV, keypair, scratchTown } from './witness-test-fixture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'witness-verify.mjs');
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

const ferryReport = (crossing) => ({ ran: true, crossing, delivered: 1, bounced: 0, committed: true, pushed: true, files: ['WHITE_PAGES/mail-ledger.md'] });

/** A town with three published mail records, one per crossing. */
function publishedTown(t, opts) {
  const town = scratchTown(t, opts);
  for (const [i, n] of [[1, 3], [2, 4], [3, 5]]) {
    town.crossing(n);
    owe(town.owed, mailDecided(town.repo, { attempt: `run-${i}`, decidedAt: `2026-11-0${i}T12:00:30.000Z`, exit: 0, stage: 'done', ferryReport: ferryReport(290 + i) }));
    const r = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
    assert.equal(r.status, 'published', r.why);
  }
  town.git(town.repo, 'pull', '-q', '--rebase', 'origin', 'main');
  return town;
}

/** Rewrite the chain on a side branch: `edit` gets the record texts by seq and returns the new map. */
function sideChain(town, name, edit) {
  const g = (...a) => execFileSync('git', ['-C', town.repo, ...a], { env: GIT_ENV, encoding: 'utf8' });
  g('switch', '-q', '-c', name, 'origin/main');
  const files = Object.fromEntries([1, 2, 3].map((s) => [s, JSON.parse(g('show', `HEAD:${recordPath(s)}`))]));
  const next = edit(files);
  g('rm', '-q', '-r', 'WITNESS/records');
  for (const [seq, rec] of Object.entries(next)) {
    mkdirSync(dirname(join(town.repo, recordPath(Number(seq)))), { recursive: true });
    writeFileSync(join(town.repo, recordPath(Number(seq))), recordText(rec));
  }
  g('add', '-A');
  g('commit', '-q', '-m', `side: ${name}`);
  g('switch', '-q', 'main');
  return name;
}

const verify = (town, at, extra = {}) => verifyChain({ repo: town.repo, at, publicKeyPem: town.witnessKey.publicPem, ...extra });

test('THE CONTROL: a chain built right checks — links, hashes, key, files and ledgers', (t) => {
  const town = publishedTown(t);
  const r = verify(town, 'origin/main');
  assert.deepEqual([r.verdict, r.failures, r.incomplete], ['pass', [], []]);
  assert.equal(r.count, 3);
});

test('CHANGED: a record whose body was edited fails on its hash', (t) => {
  const town = publishedTown(t);
  const at = sideChain(town, 'changed', (f) => { f[2].body.decided.outcome.status = 'quiet'; return f; });
  const r = verify(town, at);
  assert.equal(r.verdict, 'fail');
  assert.match(r.failures.join('\n'), /record #2: .*the body was changed/);
});

test('REORDERED: two records swapped fail on their links', (t) => {
  const town = publishedTown(t);
  const at = sideChain(town, 'reordered', (f) => ({ 1: f[2], 2: f[1], 3: f[3] }));
  const r = verify(town, at);
  assert.equal(r.verdict, 'fail');
  assert.match(r.failures[0], /record #1: seq is 2, expected 1/);
});

test('DROPPED: a record removed from the middle fails, and one removed from the end needs your checkpoint', (t) => {
  const town = publishedTown(t);
  const middle = sideChain(town, 'dropped-middle', (f) => ({ 1: f[1], 2: f[3] }));
  assert.match(verify(town, middle).failures[0], /record #2: seq is 3, expected 2/);

  const tail = sideChain(town, 'dropped-tail', (f) => ({ 1: f[1], 2: f[2] }));
  const blind = verify(town, tail);
  assert.equal(blind.verdict, 'pass', 'a withheld newest record is invisible to the chain alone — the documented limit');
  const full = verify(town, 'origin/main');
  const checkpoint = { seq: 3, hash: full.latest.hash };
  const r = verify(town, tail, { checkpoint });
  assert.equal(r.verdict, 'fail');
  assert.match(r.failures[0], /does not reach your checkpoint/);
});

test('SPLICED: a validly signed record from another history, at the right number, fails on its link', (t) => {
  const town = publishedTown(t);
  const keyId = keyIdOf(town.witnessKey.publicPem);
  const at = sideChain(town, 'spliced', (f) => {
    const other1 = makeRecord({ seq: 1, prev: GENESIS, decided: { ...f[1].body.decided, attempt: 'elsewhere' }, privateKeyPem: town.witnessKey.privatePem, keyId });
    const other2 = makeRecord({ seq: 2, prev: other1.hash, decided: f[2].body.decided, privateKeyPem: town.witnessKey.privatePem, keyId });
    return { 1: f[1], 2: other2, 3: f[3] };
  });
  const r = verify(town, at);
  assert.equal(r.verdict, 'fail');
  assert.match(r.failures[0], /record #2: prev is .*the link to the record before is broken/);
});

test('ANOTHER HISTORY: a whole chain re-signed by the same key fails against a checkpoint taken from the real one', (t) => {
  const town = publishedTown(t);
  const real = verify(town, 'origin/main');
  const forged = sideChain(town, 'forged', (f) => {
    const out = {};
    let prev = GENESIS;
    for (const seq of [1, 2, 3]) {
      const decided = { ...f[seq].body.decided, attempt: `forged-${seq}` };
      const rec = makeRecord({ seq, prev, decided, privateKeyPem: town.witnessKey.privatePem, keyId: keyIdOf(town.witnessKey.publicPem) });
      out[seq] = rec;
      prev = rec.hash;
    }
    return out;
  });
  assert.equal(verify(town, forged).verdict, 'pass', 'on its own a re-signed history is a valid chain');
  const r = verify(town, forged, { checkpoint: { seq: 2, hash: real.latest.body.prev } });
  assert.equal(r.verdict, 'fail');
  assert.match(r.failures[0], /checkpoint #2: .*not the history you trusted/);
});

test('THE WRONG KEY: a chain checked against a key you did not trust fails on every record it reaches', (t) => {
  const town = publishedTown(t);
  const r = verifyChain({ repo: town.repo, at: 'origin/main', publicKeyPem: keypair().publicPem });
  assert.equal(r.verdict, 'fail');
  assert.match(r.failures[0], /record #1: signed by key sha256:[0-9a-f]+, not the trusted key/);
});

test('THE FILES: wrong bytes fail; bytes you do not have are INCOMPLETE, never green', (t) => {
  const town = publishedTown(t);
  const at = sideChain(town, 'files', (f) => {
    const keyId = keyIdOf(town.witnessKey.publicPem);
    const d1 = structuredClone(f[1].body.decided);
    d1.artifacts[0].sha256 = sha256('not the ledger');
    const r1 = makeRecord({ seq: 1, prev: GENESIS, decided: d1, privateKeyPem: town.witnessKey.privatePem, keyId });
    const d2 = structuredClone(f[2].body.decided);
    d2.artifacts.push({ repo: 'town', commit: 'e'.repeat(40), path: 'WHITE_PAGES/mail-ledger.md', sha256: sha256('x') });
    const r2 = makeRecord({ seq: 2, prev: r1.hash, decided: d2, privateKeyPem: town.witnessKey.privatePem, keyId });
    const d3 = structuredClone(f[3].body.decided);
    d3.artifacts.push({ repo: 'world', commit: 'f'.repeat(40), path: 'STATE/log/1.jsonl', sha256: sha256('y') });
    const r3 = makeRecord({ seq: 3, prev: r2.hash, decided: d3, privateKeyPem: town.witnessKey.privatePem, keyId });
    return { 1: r1, 2: r2, 3: r3 };
  });
  const r = verify(town, at);
  assert.equal(r.verdict, 'fail');
  assert.equal(r.failures.length, 1);
  assert.match(r.failures[0], /record #1 town:[0-9a-f]{8}:WHITE_PAGES\/mail-ledger\.md: the record says/);
  assert.match(r.incomplete.join('\n'), /record #2 .*that commit is not in your town checkout/);
  assert.match(r.incomplete.join('\n'), /record #3 .*no --world checkout was given/);
});

test('THE LEDGERS: an earlier mail line rewritten after its record was published fails every record that bound it', (t) => {
  const town = publishedTown(t);
  town.ledgers.mail[0] = '- 2026-11-01 · rewritten-2026-11-01-note · writer-1 → reader-1 · thread: t1';
  town.writeLedgers();
  town.commit('rewrite an old line');
  town.git(town.repo, 'push', '-q', 'origin', 'HEAD:main');
  owe(town.owed, mailDecided(town.repo, { attempt: 'run-4', decidedAt: '2026-11-04T12:00:30.000Z', exit: 0, stage: 'done', ferryReport: { ran: true, crossing: 294 } }));
  assert.equal(publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem }).status, 'published');
  const r = verify(town, 'origin/main');
  assert.equal(r.verdict, 'fail');
  assert.equal(r.failures.length, 3);
  for (const f of r.failures) assert.match(f, /the mail ledger at the newest record's commit \(#4\) no longer begins with/);
});

test('THE CLI: --key is required, exit codes name the verdict, and the freshness limit is always said', (t) => {
  const town = publishedTown(t);
  const keyFile = join(town.root, 'pub.pem');
  writeFileSync(keyFile, town.witnessKey.publicPem);
  const none = spawnSync(process.execPath, [CLI, '--repo', town.repo], { encoding: 'utf8' });
  assert.equal(none.status, 2);
  assert.match(none.stderr, /--key <pem> is required/);
  const ok = spawnSync(process.execPath, [CLI, '--repo', town.repo, '--at', 'origin/main', '--key', keyFile], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /✓ every record checks/);
  assert.match(ok.stdout, /says nothing about records after it/);
  const bad = spawnSync(process.execPath, [CLI, '--repo', town.repo, '--at', 'origin/main', '--key', keyFile, '--checkpoint', `1:${'0'.repeat(64)}`], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /✗ FAILED/);
});
