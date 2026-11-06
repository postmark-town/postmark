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

import { GENESIS, keyIdOf, mailDecided, makeRecord, owe, owePending, publish, recordPath, recordText } from './witness-chain.mjs';
import { verifyChain } from './witness-verify.mjs';
import { GIT_ENV, keypair, scratchTown } from './witness-test-fixture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'witness-verify.mjs');
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const deadPid = () => Number(spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout.trim());

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

test('INCOMPLETE ALONE: a chain whose only gap is bytes you do not have is incomplete (exit 3), not a pass', (t) => {
  const town = publishedTown(t);
  const at = sideChain(town, 'only-missing', (f) => {
    const keyId = keyIdOf(town.witnessKey.publicPem);
    let prev = GENESIS;
    const out = {};
    for (const seq of [1, 2, 3]) {
      const d = structuredClone(f[seq].body.decided);
      if (seq === 2) d.artifacts.push({ repo: 'world', commit: 'f'.repeat(40), path: 'STATE/log/1.jsonl', sha256: sha256('y') });
      out[seq] = makeRecord({ seq, prev, decided: d, privateKeyPem: town.witnessKey.privatePem, keyId });
      prev = out[seq].hash;
    }
    return out;
  });
  const r = verify(town, at);
  assert.deepEqual([r.verdict, r.failures], ['incomplete', []]);
  const keyFile = join(town.root, 'pub.pem');
  writeFileSync(keyFile, town.witnessKey.publicPem);
  const cli = spawnSync(process.execPath, [CLI, '--repo', town.repo, '--at', at, '--key', keyFile], { encoding: 'utf8' });
  assert.equal(cli.status, 3, cli.stdout);
  assert.match(cli.stdout, /INCOMPLETE .*not a pass/);
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

// ── gaps inside a valid chain are never green (Rivet's FIX, 2026-11-06) ─────
//
// LAW (POS-907/c): "the record is owed … before the next one counts as complete".

/** A scratch World: c0 → c1 (settlement A) → c2 (a photograph) → c3 (settlement S, unrecorded) → c4 (settlement B). */
function scratchWorld(t, town) {
  const world = join(town.root, 'world');
  const g = (...a) => execFileSync('git', ['-C', world, ...a], { env: GIT_ENV, encoding: 'utf8' });
  execFileSync('git', ['init', '-q', '-b', 'main', world]);
  const commit = (path, body, subject) => {
    mkdirSync(dirname(join(world, path)), { recursive: true });
    writeFileSync(join(world, path), body);
    g('add', '-A'); g('commit', '-q', '-m', subject);
    return g('rev-parse', 'HEAD').trim();
  };
  const c0 = commit('WORLD/base.md', 'base\n', 'the world');
  const c1 = commit('WORLD/a.md', 'a\n', 'settlement: sweep 1 published');
  const c2 = commit('STATE/log/1.jsonl', '{}\n', 'photograph: windows 1');
  const c3 = commit('WORLD/s.md', 's\n', 'settlement: sweep 2 published');
  const c4 = commit('WORLD/b.md', 'b\n', 'settlement: sweep 3 published');
  const inventory = (from, to) => g('diff', '--name-only', '--no-renames', from, to).split('\n').filter(Boolean)
    .map((path) => ({ repo: 'world', commit: to, path, sha256: sha256(execFileSync('git', ['-C', world, 'cat-file', 'blob', `${to}:${path}`])) }));
  return { world, c0, c1, c2, c3, c4, inventory };
}
const settled = (event, at, from, to, artifacts, inventory = { complete: true }) => ({
  v: 1, kind: 'settlement', event, attempt: `${event}#1`, decided_at: at,
  outcome: { status: 'published', detail: 'invented' }, inputs: { world_from: from }, results: { world_to: to },
  heads: {}, artifacts, inventory,
});
function chainOf(t, decideds) {
  const town = scratchTown(t);
  for (const d of decideds(town)) owe(town.owed, d);
  assert.equal(publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem }).status, 'published');
  town.git(town.repo, 'fetch', '-q', 'origin');
  return town;
}

test('AN INCOMPLETE RECORD is a gap the chain admits: incomplete, never a pass', (t) => {
  const town = chainOf(t, (tw) => [mailDecided(tw.repo, { attempt: 'a', decidedAt: '2026-11-06T00:00:30.000Z', exit: 0, stage: 'done', ferryReport: { ran: true, crossing: 291 } })]);
  owePending(town.owed, { kind: 'mail-crossing', event: 'crossing:292', attempt: 'b', openedAt: '2026-11-06T12:00:00.000Z', pid: deadPid() });
  publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
  const r = verify(town, 'origin/main');
  assert.equal(r.verdict, 'incomplete');
  assert.match(r.incomplete.join('\n'), /record #2: crossing:292 \(attempt b\) never recorded its outcome/);
});

test('A MISSING CROSSING between two records is incomplete, named by number', (t) => {
  const town = chainOf(t, (tw) => [291, 293].map((n) => mailDecided(tw.repo, { attempt: `r${n}`, decidedAt: `2026-11-0${n - 290}T00:00:30.000Z`, exit: 0, stage: 'done', ferryReport: { ran: true, crossing: n } })));
  const r = verify(town, 'origin/main');
  assert.equal(r.verdict, 'incomplete');
  assert.match(r.incomplete.join('\n'), /crossing 292 between 291 and 293 has no record/);
});

test('A SETTLEMENT\'S INVENTORY: unread is incomplete, a record with none is incomplete, a wrong one fails (the whole one is WORLD CONTINUITY\'s control)', (t) => {
  let w;
  const town = chainOf(t, (tw) => {
    w = scratchWorld(t, tw);
    return [
      settled('settlement:A', '2026-11-06T06:00:00.000Z', w.c0, w.c1, [], { complete: false, why: 'no sweep clone was given' }),
      settled('settlement:S', '2026-11-06T12:00:00.000Z', w.c2, w.c3, w.inventory(w.c2, w.c3).slice(1)),
      { ...settled('settlement:B', '2026-11-06T18:00:00.000Z', w.c3, w.c4, w.inventory(w.c3, w.c4)), inventory: undefined },
    ].map((d) => JSON.parse(JSON.stringify(d)));
  });
  const r = verify(town, 'origin/main', { world: w.world });
  assert.equal(r.verdict, 'fail');
  assert.match(r.incomplete.join('\n'), /record #1 \(settlement:A\): its World inventory was not read — no sweep clone was given/);
  assert.match(r.incomplete.join('\n'), /record #3 \(settlement:B\): its World inventory was not read — the record carries no inventory/);
  assert.match(r.failures.join('\n'), /record #2 \(settlement:S\): its World inventory is not the change it names — 1 file\(s\) changed and not bound/);
});

test('WORLD CONTINUITY: a settlement commit no record binds is incomplete; without --world it is unchecked, not green; recorded whole, it passes', (t) => {
  let w;
  const gap = chainOf(t, (tw) => {
    w = scratchWorld(t, tw);
    return [settled('settlement:A', '2026-11-06T06:00:00.000Z', w.c0, w.c1, w.inventory(w.c0, w.c1)),
      settled('settlement:B', '2026-11-06T18:00:00.000Z', w.c3, w.c4, w.inventory(w.c3, w.c4))];
  });
  const r = verify(gap, 'origin/main', { world: w.world });
  assert.deepEqual([r.verdict, r.failures], ['incomplete', []]);
  assert.match(r.incomplete.join('\n'), new RegExp(`World commit ${w.c3.slice(0, 8)} \\("settlement: sweep 2 published"\\) is a settlement's, and no record binds it`));
  assert.ok(!r.incomplete.join('\n').includes(w.c2.slice(0, 8)), 'a photograph is not a settlement');
  assert.match(verify(gap, 'origin/main').incomplete.join('\n'), /World continuity unchecked/);

  let w2;
  const whole = chainOf(t, (tw) => {
    w2 = scratchWorld(t, tw);
    return [settled('settlement:A', '2026-11-06T06:00:00.000Z', w2.c0, w2.c1, w2.inventory(w2.c0, w2.c1)),
      settled('settlement:S', '2026-11-06T12:00:00.000Z', w2.c2, w2.c3, w2.inventory(w2.c2, w2.c3)),
      settled('settlement:B', '2026-11-06T18:00:00.000Z', w2.c3, w2.c4, w2.inventory(w2.c3, w2.c4))];
  });
  const ok = verify(whole, 'origin/main', { world: w2.world });
  assert.deepEqual([ok.verdict, ok.failures, ok.incomplete], ['pass', [], []], 'the control: every settlement recorded, every inventory whole');
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
