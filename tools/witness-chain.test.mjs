// witness-chain.test.mjs — POS-907: the town's witness chain is written right.
//   node --test tools/witness-chain.test.mjs
//
// LAW (Darko, 2026-11-06, POS-907/a): "One chain" — mail crossings and
//   settlements, one chain in the town repo, in the order they're published.
// LAW (POS-907/c): "Keep running" — "if a record fails to publish, the town
//   keeps running and the record is owed. Nothing is rolled back. Quiet and
//   refused crossings get records too."
// LAW (the key, from Darko's 11-05 split of the pen): "the witness signs with its
//   own new key, separate from the stamp pen".
//
// Every town here is a scratch bare origin and clones of it, with invented
// ledgers and invented keys (tools/witness-test-fixture.mjs).

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GENESIS, canonicalJson, checkRecord, keyIdOf, listOwed, mailDecided, owe, outcomeId, publish, readChain,
} from './witness-chain.mjs';
import { keypair, scratchTown } from './witness-test-fixture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, 'witness-chain.mjs');

const settlementDecided = (event, { status = 'published', attempt = '1', at = '2026-11-06T18:00:05.000Z', worldTo = 'b'.repeat(40) } = {}) => ({
  v: 1, kind: 'settlement', event, attempt, decided_at: at,
  outcome: { status, detail: `${status}, invented` },
  inputs: { town_sha: 'a'.repeat(40), world_from: 'c'.repeat(40) },
  results: { world_to: worldTo },
  heads: {},
  artifacts: [],
  receipt: { status, invented: true },
});

/** The chain on origin, checked link by link against the witness key. */
function originChain(town) {
  town.git(town.repo, 'fetch', '-q', 'origin');
  const { records } = readChain(town.repo, 'refs/remotes/origin/main');
  const keyId = keyIdOf(town.witnessKey.publicPem);
  let prev = GENESIS;
  records.forEach(({ record }, i) => {
    assert.deepEqual(checkRecord(record, { seq: i + 1, prev, publicKeyPem: town.witnessKey.publicPem, keyId }), [], `record ${i + 1} checks`);
    prev = record.hash;
  });
  return records.map((r) => r.record);
}

test('canonical JSON: one spelling per value, and nothing it cannot spell', () => {
  assert.equal(canonicalJson({ b: 1, a: [true, null, 'x'] }), '{"a":[true,null,"x"],"b":1}');
  assert.equal(canonicalJson({ a: 1, b: 2 }), canonicalJson({ b: 2, a: 1 }), 'key order does not change the bytes');
  assert.throws(() => canonicalJson({ a: 1.5 }), /integers only/);
  assert.throws(() => canonicalJson({ a: undefined }), /undefined/);
});

test('owing: the same decided outcome twice is one owed file; oldest decision first', (t) => {
  const town = scratchTown(t);
  const later = settlementDecided('settlement:2026-11-06T18', { at: '2026-11-06T18:00:09.000Z' });
  const earlier = settlementDecided('settlement:2026-11-06T06', { at: '2026-11-06T06:00:09.000Z' });
  assert.equal(owe(town.owed, later).fresh, true);
  assert.equal(owe(town.owed, later).fresh, false, 'a retry of the same outcome is not a second debt');
  owe(town.owed, earlier);
  const { owed } = listOwed(town.owed);
  assert.deepEqual(owed.map((o) => o.decided.event), ['settlement:2026-11-06T06', 'settlement:2026-11-06T18']);
  assert.throws(() => owe(town.owed, { ...later, kind: 'gossip' }), /kind must be one of/);
});

test('THE KEY: nothing signs until the town publishes the key, a different key is refused, and the stamp pen is never the witness', (t) => {
  const unpublished = scratchTown(t, { publishKey: false });
  owe(unpublished.owed, settlementDecided('settlement:x'));
  let r = publish({ repo: unpublished.repo, owedDir: unpublished.owed, privateKeyPem: unpublished.witnessKey.privatePem });
  assert.equal(r.status, 'owed');
  assert.match(r.why, /no WITNESS\/witness-pubkey\.pem/);

  const town = scratchTown(t);
  owe(town.owed, settlementDecided('settlement:x'));
  r = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: null });
  assert.match(r.why, /no witness key is configured/);
  r = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: keypair().privatePem });
  assert.match(r.why, /is not the town's published witness key/);

  const pen = keypair();
  const samePen = scratchTown(t, { witnessKey: pen, stampKey: pen });
  owe(samePen.owed, settlementDecided('settlement:x'));
  r = publish({ repo: samePen.repo, owedDir: samePen.owed, privateKeyPem: pen.privatePem });
  assert.equal(r.status, 'owed', 'LAW: "the witness signs with its own new key, separate from the stamp pen"');
  assert.match(r.why, /is the stamp pen/);
  for (const x of [unpublished, town, samePen]) assert.equal(listOwed(x.owed).owed.length, 1, 'refused means owed, never dropped');
});

test('ONE CHAIN: a mail crossing and a settlement are records 1 and 2, linked, in publication order; the owed files are paid', (t) => {
  const town = scratchTown(t);
  town.crossing(3);
  const mail = mailDecided(town.repo, { attempt: 'ferry-run-1', decidedAt: '2026-11-06T12:00:40.000Z', exit: 0, stage: 'done', ferryReport: { ran: true, crossing: 293, town_sha: 'd'.repeat(40), delivered: 1, bounced: 0, committed: true, pushed: true, files: ['WHITE_PAGES/mail-ledger.md'] } });
  owe(town.owed, mail);
  owe(town.owed, settlementDecided('settlement:2026-11-06T18'));
  const r = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
  assert.equal(r.status, 'published', r.why);
  assert.deepEqual(r.published, [1, 2]);
  const chain = originChain(town);
  assert.deepEqual(chain.map((c) => [c.body.seq, c.body.decided.kind]), [[1, 'mail-crossing'], [2, 'settlement']]);
  assert.equal(chain[0].body.prev, GENESIS);
  assert.equal(chain[1].body.prev, chain[0].hash);
  assert.equal(chain[0].body.decided.outcome.status, 'delivered');
  assert.equal(listOwed(town.owed).owed.length, 0);
});

test('A RETRY OF THE SAME DECISION publishes nothing new; a new attempt of the same event follows the old record', (t) => {
  const town = scratchTown(t);
  const first = settlementDecided('settlement:2026-11-06T18', { status: 'race', attempt: '1' });
  owe(town.owed, first);
  publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
  owe(town.owed, first);
  const again = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
  assert.deepEqual(again.published, [], 'the same decided outcome is never a second record');
  assert.equal(listOwed(town.owed).owed.length, 0, 'and its owed file is paid all the same');

  owe(town.owed, settlementDecided('settlement:2026-11-06T18', { status: 'published', attempt: '2', at: '2026-11-06T18:04:00.000Z' }));
  publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
  const chain = originChain(town);
  assert.equal(chain.length, 2);
  assert.equal(chain[1].body.follows, chain[0].hash, 'the rerun names the record it follows; nothing is overwritten');
  assert.equal(chain[0].body.decided.outcome.status, 'race', 'the first attempt stays as it was decided');
});

test('QUIET AND REFUSED crossings get records; a commit that never got out is named, not bound', (t) => {
  const town = scratchTown(t);
  const quiet = mailDecided(town.repo, { attempt: 'run-q', decidedAt: '2026-11-06T00:00:30.000Z', exit: 0, stage: 'done', ferryReport: { ran: true, crossing: 291, delivered: 0, bounced: 0 } });
  assert.equal(quiet.outcome.status, 'quiet');

  // a local commit the crossing could not push: delivered on disk, not public
  town.ledgers.mail.push('- 2026-11-06 · late-2026-11-06-x · late → reader · thread: t');
  town.writeLedgers();
  town.commit('ferry: unpushed');
  const localHead = town.git(town.repo, 'rev-parse', 'HEAD').trim();
  const refused = mailDecided(town.repo, { attempt: 'run-r', decidedAt: '2026-11-06T12:01:00.000Z', exit: 1, stage: 'mint', ferryReport: { ran: true, crossing: 292, delivered: 1, bounced: 0, committed: true, pushed: false, files: ['WHITE_PAGES/mail-ledger.md'] } });
  assert.equal(refused.outcome.status, 'refused');
  assert.equal(refused.outcome.stage, 'mint');
  assert.deepEqual(refused.outcome.ferry, { delivered: 1, bounced: 0, committed: true, pushed: false }, 'the partial effect is kept');
  assert.equal(refused.results.local_head, localHead);
  assert.notEqual(refused.results.town_head, localHead, 'the bound head is the public one');
  assert.equal(refused.heads.mail.lines, 2, 'heads are read at the public head, where the unpushed line is not');

  owe(town.owed, quiet);
  owe(town.owed, refused);
  assert.equal(publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem }).status, 'published');
  assert.deepEqual(originChain(town).map((c) => c.body.decided.outcome.status), ['quiet', 'refused']);
});

test('KEEP RUNNING: a publish that cannot reach the remote leaves the record owed, and the next publish pays it first, once', (t) => {
  const town = scratchTown(t);
  owe(town.owed, settlementDecided('settlement:A', { at: '2026-11-06T06:00:00.000Z' }));
  const away = `${town.origin}.away`;
  renameSync(town.origin, away);
  const cli = spawnSync(process.execPath, [CLI, 'publish', '--repo', town.repo, '--owed', town.owed, '--key', writeKey(town)], { encoding: 'utf8' });
  assert.equal(cli.status, 3, `an unreachable remote is "owed" (exit 3), not a failure the caller must stop on:\n${cli.stderr}`);
  assert.match(cli.stderr, /1 record\(s\) OWED/);
  assert.equal(listOwed(town.owed).owed.length, 1, 'LAW: "the record is owed"');

  owe(town.owed, settlementDecided('settlement:B', { at: '2026-11-06T18:00:00.000Z' }));
  renameSync(away, town.origin);
  const r = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
  assert.deepEqual(r.published, [1, 2]);
  assert.deepEqual(originChain(town).map((c) => c.body.decided.event), ['settlement:A', 'settlement:B'], 'the owed record is reconciled before its successor');
});

test('AN UNREADABLE OWED FILE stops the queue rather than be skipped', (t) => {
  const town = scratchTown(t);
  owe(town.owed, settlementDecided('settlement:A'));
  writeFileSync(join(town.owed, '20260101T000000000Z-broken.json'), '{ not json');
  const r = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
  assert.equal(r.status, 'owed');
  assert.match(r.why, /does not read/);
  assert.equal(originChain(town).length, 0, 'nothing published past an owed outcome nobody can read');
});

test('COMPETING PUBLISHERS: a crossing and a settlement publishing at once from two clones never fork the chain', async (t) => {
  const town = scratchTown(t);
  const keyFile = writeKey(town);
  const second = town.clone('town-2');
  for (let round = 0; round < 3; round++) {
    const mailOwed = join(town.root, `owed-mail-${round}`);
    const settleOwed = join(town.root, `owed-settle-${round}`);
    owe(mailOwed, settlementDecided(`settlement:mail-side-${round}`, { at: `2026-11-0${round + 1}T12:00:00.000Z` }));
    owe(settleOwed, settlementDecided(`settlement:settle-side-${round}`, { at: `2026-11-0${round + 1}T18:00:00.000Z` }));
    const run = (repo, owedDir) => new Promise((ok) => {
      const p = spawn(process.execPath, [CLI, 'publish', '--repo', repo, '--owed', owedDir, '--key', keyFile]);
      p.on('close', (code) => ok(code));
    });
    const codes = await Promise.all([run(town.repo, mailOwed), run(second, settleOwed)]);
    assert.deepEqual(codes, [0, 0], `round ${round}: both publishers finished`);
    assert.equal(readdirSync(mailOwed).length + readdirSync(settleOwed).length, 0, `round ${round}: nothing left owed`);
  }
  const chain = originChain(town);
  assert.equal(chain.length, 6, 'six decided outcomes, six records');
  assert.equal(new Set(chain.map((c) => outcomeId(c.body.decided))).size, 6, 'none twice');
});

test('THE RACE, made certain: the other publisher lands between our fetch and our push; ours is refused, rebuilt on the new tip, and both records stand once', (t) => {
  const town = scratchTown(t);
  const keyFile = writeKey(town);
  const second = town.clone('town-2');
  const mailOwed = join(town.root, 'owed-mail');
  const settleOwed = join(town.root, 'owed-settle');
  owe(mailOwed, settlementDecided('settlement:landed-first', { at: '2026-11-06T12:00:00.000Z' }));
  owe(settleOwed, settlementDecided('settlement:raced', { at: '2026-11-06T18:00:00.000Z' }));
  // The second clone's first push is preceded, inside its own pre-push hook,
  // by the first clone publishing. Only the first push: a marker file says so.
  const marker = join(town.root, 'raced-once');
  const hook = join(second, '.git', 'hooks', 'pre-push');
  writeFileSync(hook, `#!/bin/sh\n[ -e "${marker}" ] && exit 0\n: > "${marker}"\n"${process.execPath}" "${CLI}" publish --repo "${town.repo}" --owed "${mailOwed}" --key "${keyFile}" >/dev/null 2>&1\nexit 0\n`, { mode: 0o755 });

  const log = [];
  const r = publish({ repo: second, owedDir: settleOwed, privateKeyPem: town.witnessKey.privatePem, log: (m) => log.push(m) });
  assert.equal(r.status, 'published', r.why);
  assert.ok(existsSync(marker), 'the race was run');
  assert.ok(log.some((m) => /someone published first/.test(m)), `our first push was refused and rebuilt:\n${log.join('\n')}`);
  const chain = originChain(town);
  assert.deepEqual(chain.map((c) => c.body.decided.event), ['settlement:landed-first', 'settlement:raced'], 'one chain, no fork, nothing skipped');
});

test('THE CLI: owe takes a settlement outcome as JSON and refuses a status the settlement does not have', (t) => {
  const town = scratchTown(t);
  const ok = spawnSync(process.execPath, [CLI, 'owe', '--owed', town.owed, '--decided', '-'], { input: JSON.stringify(settlementDecided('settlement:x')), encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  const bad = spawnSync(process.execPath, [CLI, 'owe', '--owed', town.owed, '--decided', '-'], { input: JSON.stringify(settlementDecided('settlement:y', { status: 'fine' })), encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /outcome\.status must be one of/);
  assert.equal(listOwed(town.owed).owed.length, 1);
  assert.ok(!existsSync(join(town.repo, 'WITNESS', 'records')), 'owing writes nothing into the clone');
});

function writeKey(town) {
  const path = join(town.root, 'witness-key.pem');
  writeFileSync(path, town.witnessKey.privatePem);
  return path;
}
