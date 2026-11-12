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
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GENESIS, canonicalJson, checkRecord, keyIdOf, listOwed, mailDecided, owe, owePending, outcomeId, publish, readChain,
} from './witness-chain.mjs';
import { ferryReportOf, keypair, scratchTown } from './witness-test-fixture.mjs';

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
  const quiet = mailDecided(town.repo, { attempt: 'run-q', decidedAt: '2026-11-06T00:00:30.000Z', exit: 0, stage: 'done', ferryReport: ferryReportOf(291) });
  assert.equal(quiet.outcome.status, 'quiet', 'a written report with zero movement is a quiet crossing');

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

test('KEEP RUNNING, at the push: a remote that declines the push leaves the record owed; nothing is deleted before it is out', (t) => {
  const town = scratchTown(t);
  owe(town.owed, settlementDecided('settlement:A'));
  const hook = join(town.origin, 'hooks', 'pre-receive');
  writeFileSync(hook, '#!/bin/sh\necho "declined" >&2\nexit 1\n', { mode: 0o755 });
  const r = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
  assert.equal(r.status, 'owed');
  assert.match(r.why, /push refused/);
  assert.equal(listOwed(town.owed).owed.length, 1, 'LAW: "the record is owed"');
  renameSync(hook, `${hook}.off`);
  assert.deepEqual(publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem }).published, [1]);
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
  // a MAIL crossing on one side, a settlement on the other: the two kinds racing
  owe(mailOwed, mailDecided(town.repo, { attempt: 'ferry-run', decidedAt: '2026-11-06T12:00:00.000Z', exit: 0, stage: 'done', ferryReport: ferryReportOf(293) }));
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
  assert.deepEqual(chain.map((c) => [c.body.decided.kind, c.body.decided.event]), [['mail-crossing', 'crossing:293'], ['settlement', 'settlement:raced']], 'one chain, both kinds, no fork, nothing skipped');
});

test('THE STALE TIP: the other publisher lands between our fetch and our push; we push fast-forward only, so ours is refused and rebuilt, never pushed over theirs', (t) => {
  const town = scratchTown(t);
  const keyFile = writeKey(town);
  const second = town.clone('town-2');
  const mailOwed = join(town.root, 'owed-mail');
  const settleOwed = join(town.root, 'owed-settle');
  owe(mailOwed, settlementDecided('settlement:landed-first', { at: '2026-11-06T12:00:00.000Z' }));
  owe(settleOwed, settlementDecided('settlement:stale', { at: '2026-11-06T18:00:00.000Z' }));
  town.crossing(9); // so the second clone's fetch really moves origin/main, and its hook fires there
  // The second clone's first fetch of origin/main is followed at once, inside a
  // reference-transaction hook, by the first clone publishing: the tip our
  // publisher builds on is stale before its push even starts.
  const marker = join(town.root, 'staled-once');
  const hook = join(second, '.git', 'hooks', 'reference-transaction');
  writeFileSync(hook, `#!/bin/sh\n[ "$1" = committed ] || exit 0\n[ -e "${marker}" ] && exit 0\ngrep -q 'refs/remotes/origin/main' || exit 0\n: > "${marker}"\n"${process.execPath}" "${CLI}" publish --repo "${town.repo}" --owed "${mailOwed}" --key "${keyFile}" >/dev/null 2>&1\nexit 0\n`, { mode: 0o755 });

  const log = [];
  const r = publish({ repo: second, owedDir: settleOwed, privateKeyPem: town.witnessKey.privatePem, log: (m) => log.push(m) });
  assert.equal(r.status, 'published', r.why);
  assert.ok(existsSync(marker), 'the stale tip was made');
  assert.ok(log.some((m) => /someone published first/.test(m)), `our first push was refused:\n${log.join('\n')}`);
  assert.deepEqual(originChain(town).map((c) => c.body.decided.event), ['settlement:landed-first', 'settlement:stale'], 'the record that landed first is still there');
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

test('THE CLI THROUGH A SYMLINK still runs: entered by a linked path, it answers rather than exit 0 having done nothing', (t) => {
  const town = scratchTown(t);
  const link = join(town.root, 'linked-tools');
  symlinkSync(HERE, link, 'dir');
  for (const tool of ['witness-chain.mjs', 'witness-verify.mjs']) {
    const args = tool === 'witness-chain.mjs' ? ['status', '--owed', town.owed] : ['--repo', town.repo];
    const r = spawnSync(process.execPath, [join(link, tool), ...args], { encoding: 'utf8' });
    if (tool === 'witness-chain.mjs') {
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(JSON.parse(r.stdout), { owed: 0, open: 0, unreadable: 0, oldest: null });
    } else {
      assert.equal(r.status, 2, 'the verifier refuses without --key, rather than say nothing');
      assert.match(r.stderr, /--key <pem> is required/);
    }
  }
});

// ── a run is owed BEFORE it acts (the review of 11-06: an outcome must never vanish) ──
//
// LAW (POS-907/c): "the record is owed". The run's open entry is the debt from
// its first moment; its outcome replaces it, and a run that never got that far
// is published as INCOMPLETE rather than leave a hole the next record covers.

const deadPid = () => spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout.trim() * 1;

test('OPEN, THEN DECIDED: the outcome replaces the run\'s open entry in its place, and publishes as one record', (t) => {
  const town = scratchTown(t);
  owePending(town.owed, { kind: 'settlement', event: 'settlement:A', attempt: 'A#1', openedAt: '2026-11-06T18:00:00.000Z', pid: process.pid });
  const before = readdirSync(town.owed);
  const r = owe(town.owed, settlementDecided('settlement:A', { attempt: 'A#1', at: '2026-11-06T18:20:00.000Z' }));
  assert.equal(r.replaced, true);
  assert.deepEqual(readdirSync(town.owed), before, 'the same file, the same place in the queue');
  assert.deepEqual(publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem }).published, [1]);
  assert.equal(originChain(town)[0].body.decided.outcome.status, 'published');
});

test('A RUN THAT DIED before its witness step is published as INCOMPLETE, in its place, never skipped', (t) => {
  const town = scratchTown(t);
  owePending(town.owed, { kind: 'mail-crossing', event: 'crossing:293', attempt: 'ferry-dead', openedAt: '2026-11-06T12:00:00.000Z', pid: deadPid() });
  owe(town.owed, settlementDecided('settlement:after', { at: '2026-11-06T18:00:00.000Z' }));
  const r = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
  assert.deepEqual(r.published, [1, 2], r.why);
  const chain = originChain(town);
  assert.deepEqual(chain.map((c) => [c.body.decided.event, c.body.decided.outcome.status]), [['crossing:293', 'incomplete'], ['settlement:after', 'published']],
    'LAW: "the record is owed" — the dead run stands in its place, before its successor');
  assert.match(chain[0].body.decided.outcome.why, /ended without recording its outcome/);
  assert.equal(listOwed(town.owed).entries.length, 0);
});

test('A RUN STILL DECIDING holds only the records after it; once it decides, both publish in their order', (t) => {
  const town = scratchTown(t);
  owe(town.owed, settlementDecided('settlement:before', { at: '2026-11-06T06:00:00.000Z' }));
  owePending(town.owed, { kind: 'mail-crossing', event: 'crossing:293', attempt: 'ferry-live', openedAt: '2026-11-06T12:00:00.000Z', pid: process.pid });
  owe(town.owed, settlementDecided('settlement:after', { at: '2026-11-06T18:00:00.000Z' }));
  const now = Date.parse('2026-11-06T18:05:00.000Z');
  const first = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem, now });
  assert.deepEqual(first.published, [1], 'what came before the live run publishes');
  assert.equal(first.status, 'owed');
  assert.match(first.why, /crossing:293 .* is still deciding/);
  owe(town.owed, mailDecided(town.repo, { attempt: 'ferry-live', decidedAt: '2026-11-06T12:00:40.000Z', exit: 0, stage: 'done', ferryReport: ferryReportOf(293) }));
  const second = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem, now });
  assert.deepEqual(second.published, [2, 3]);
  assert.deepEqual(originChain(town).map((c) => c.body.decided.event), ['settlement:before', 'crossing:293', 'settlement:after']);
});

test('A REUSED PID or an OVERAGE run does not keep the queue waiting: both read as ended', (t) => {
  const town = scratchTown(t);
  const { path } = owePending(town.owed, { kind: 'settlement', event: 'settlement:reused', attempt: 'R#1', openedAt: '2026-11-06T06:00:00.000Z', pid: process.pid });
  const entry = JSON.parse(readFileSync(path, 'utf8'));
  entry.holder.start = 'not-this-process';
  writeFileSync(path, JSON.stringify(entry));
  owePending(town.owed, { kind: 'settlement', event: 'settlement:aged', attempt: 'G#1', openedAt: '2026-11-06T07:00:00.000Z', pid: process.pid });
  const r = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem, now: Date.parse('2026-11-06T20:00:00.000Z') });
  assert.deepEqual(r.published, [1, 2], r.why);
  assert.deepEqual(originChain(town).map((c) => c.body.decided.outcome.status), ['incomplete', 'incomplete']);
});

test('THE CLI: owe-open, owe-incomplete with its reason, owe-close for a run that decided nothing', (t) => {
  const town = scratchTown(t);
  const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' });
  assert.equal(run('owe-open', '--owed', town.owed, '--kind', 'mail-crossing', '--attempt', 'ferry-x').status, 0);
  const open = listOwed(town.owed).entries[0].open;
  assert.match(open.event, /^crossing:\d+$/, 'a mail crossing names itself from the clock');
  assert.equal(open.holder.pid, process.pid, 'the holder is the caller, the long-lived process that ran the CLI');
  const inc = run('owe-incomplete', '--owed', town.owed, '--kind', 'mail-crossing', '--attempt', 'ferry-x', '--why', 'owe-mail failed (exit 1)');
  assert.equal(inc.status, 0, inc.stderr);
  const [only] = listOwed(town.owed).entries;
  assert.deepEqual([only.decided.outcome.status, only.decided.outcome.why, only.decided.event], ['incomplete', 'owe-mail failed (exit 1)', open.event]);

  assert.equal(run('owe-open', '--owed', town.owed, '--kind', 'settlement', '--event', 'settlement:R', '--attempt', 'R#2', '--pid', String(process.pid)).status, 0);
  assert.equal(run('owe-close', '--owed', town.owed, '--kind', 'settlement', '--attempt', 'R#2').status, 0);
  assert.equal(listOwed(town.owed).entries.length, 1, 'a lost race inside the retry leaves no debt');
});

test('THE KEY FILE: a missing or unreadable WITNESS_KEY leaves the record owed (exit 3) and says which file', (t) => {
  const town = scratchTown(t);
  owe(town.owed, settlementDecided('settlement:x'));
  const r = spawnSync(process.execPath, [CLI, 'publish', '--repo', town.repo, '--owed', town.owed, '--key', join(town.root, 'no-such-key.pem')], { encoding: 'utf8' });
  assert.equal(r.status, 3, r.stderr);
  assert.match(r.stderr, /the witness key file .*no-such-key\.pem \(WITNESS_KEY\) cannot be read: ENOENT/);
});

// ── "COULDN'T READ" IS NEVER "NOT THERE", AND IT STOPS RATHER THAN SIGNS ─────
//
// LAW (Wright, 2026-11-07 00:51Z, AUTHORITY): "walk every read in the verifier
// and the composer once, under one rule: 'couldn't read' is never 'not there',
// and it stops rather than signs."
//
// Each case removes a real git object from a scratch repo, so the read truly
// fails, and checks the failure is never taken for absence. Each has its
// control: the same thing genuinely absent, or genuinely empty.

/** Remove one loose object (a scratch repo's own), so reading it fails as a missing object does. */
function dropObject(repo, sha) {
  const p = join(repo, '.git', 'objects', sha.slice(0, 2), sha.slice(2));
  assert.ok(existsSync(p), `the object ${sha.slice(0, 8)} is loose in the scratch repo`);
  rmSync(p);
}
const blobAt = (town, ref, path) => town.git(town.repo, 'rev-parse', `${ref}:${path}`).trim();

test('UNREAD HISTORY IS NOT "NO HISTORY": a record that cannot be read stops the publisher, which never starts again at record 1', (t) => {
  const town = scratchTown(t);
  assert.deepEqual(readChain(town.repo, 'HEAD'), { ok: true, records: [], names: [] }, 'the control: genuinely no records');
  owe(town.owed, settlementDecided('settlement:first', { at: '2026-11-06T06:00:00.000Z' }));
  publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
  town.git(town.repo, 'fetch', '-q', 'origin');
  const before = town.git(town.origin, 'rev-parse', 'main').trim();
  dropObject(town.repo, blobAt(town, 'refs/remotes/origin/main', 'WITNESS/records/00000001.json'));
  const chain = readChain(town.repo, 'refs/remotes/origin/main');
  assert.equal(chain.ok, false, 'a record git cannot read is not an empty chain');
  owe(town.owed, settlementDecided('settlement:second', { at: '2026-11-06T18:00:00.000Z' }));
  const r = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
  assert.equal(r.status, 'owed');
  assert.match(r.why, /the published chain could not be read, so nothing is added to it/);
  assert.equal(town.git(town.origin, 'rev-parse', 'main').trim(), before, 'nothing was published over the record it could not read');
  assert.equal(listOwed(town.owed).owed.length, 1, 'and the outcome stays owed');
});

test('UNREAD KEYS: an unreadable witness key is not "never published"; an unreadable stamp key does not skip the stamp-pen check', (t) => {
  const town = scratchTown(t);
  owe(town.owed, settlementDecided('settlement:x'));
  dropObject(town.repo, blobAt(town, 'refs/remotes/origin/main', 'tools/stamp-pubkey.pem'));
  let r = publish({ repo: town.repo, owedDir: town.owed, privateKeyPem: town.witnessKey.privatePem });
  assert.equal(r.status, 'owed', 'LAW: "the witness signs with its own new key, separate from the stamp pen" — unchecked is not separate');
  assert.match(r.why, /could not read tools\/stamp-pubkey\.pem, so the witness key cannot be told apart from the stamp pen/);

  const other = scratchTown(t);
  owe(other.owed, settlementDecided('settlement:x'));
  dropObject(other.repo, blobAt(other, 'refs/remotes/origin/main', 'WITNESS/witness-pubkey.pem'));
  r = publish({ repo: other.repo, owedDir: other.owed, privateKeyPem: other.witnessKey.privatePem });
  assert.equal(r.status, 'owed');
  assert.match(r.why, /could not read the town's WITNESS\/witness-pubkey\.pem/);
  assert.doesNotMatch(r.why, /has no WITNESS\/witness-pubkey\.pem yet/, 'an unread key is not an unpublished one');
});

test('UNREAD LEDGERS AND FILES stop the composing: no null head, no "absent" artifact, is ever signed for a read that failed', (t) => {
  const town = scratchTown(t);
  const compose = () => mailDecided(town.repo, { attempt: 'r', decidedAt: '2026-11-06T12:00:30.000Z', exit: 0, stage: 'done', ferryReport: ferryReportOf(293, { files: ['WHITE_PAGES/crossing-ledger.md'] }) });
  const ok = compose();
  assert.deepEqual(Object.keys(ok.heads.mail), ['lines', 'seal'], 'the control: a ledger read is a head');
  dropObject(town.repo, blobAt(town, 'refs/remotes/origin/main', 'WHITE_PAGES/crossing-ledger.md'));
  assert.throws(compose, /could not read WHITE_PAGES\/crossing-ledger\.md/, 'an artifact that cannot be read is never signed as absent');

  const ledger = scratchTown(t);
  dropObject(ledger.repo, blobAt(ledger, 'refs/remotes/origin/main', 'WHITE_PAGES/stamp-ledger.md'));
  assert.throws(() => mailDecided(ledger.repo, { attempt: 'r', decidedAt: '2026-11-06T12:00:30.000Z', exit: 0, stage: 'done', ferryReport: ferryReportOf(293) }),
    /could not read WHITE_PAGES\/stamp-ledger\.md/, 'an unread ledger is never a null head');

  const gone = scratchTown(t);
  gone.git(gone.repo, 'rm', '-q', 'WHITE_PAGES/stamp-ledger.md');
  gone.commit('no stamp ledger');
  gone.git(gone.repo, 'push', '-q', 'origin', 'HEAD:main');
  const absent = mailDecided(gone.repo, { attempt: 'r', decidedAt: '2026-11-06T12:00:30.000Z', exit: 0, stage: 'done', ferryReport: ferryReportOf(293) });
  assert.deepEqual(absent.heads.stamps, { absent: true }, 'the control: a ledger git shows is not there is recorded as absent, positively');
  assert.throws(() => owe(town.owed, { ...ok, heads: { mail: ok.heads.mail, stamps: null } }), /heads\.stamps must be \{ lines, seal \} or \{ absent: true \}/, 'and a null head cannot even be owed');
});

// AT EXIT 0 THE FERRY RAN (Wright and the lead, 2026-11-07). The unit runs the
// ferry inside one `&&` chain, so a crossing exits 0 only past it, and the
// ferry's report write only logs its own failure. A report that is missing,
// empty, unparseable or without the ferry's fields is an outcome nobody read:
// owe-mail stops (exit 1), and the unit owes the run as incomplete. Only a
// written report with zero movement is quiet. A non-zero exit with no report
// is a crossing refused before its ferry wrote one: refused, claiming no counts.
test('AN UNWRITTEN OR UNUSABLE FERRY REPORT at exit 0 is never "quiet": owe-mail stops; a written zero report is the quiet control', (t) => {
  const town = scratchTown(t);
  const reportFile = join(town.root, 'report.json');
  const oweMail = (exit = '0', stage = 'done', file = reportFile) => spawnSync(process.execPath, [CLI, 'owe-mail', '--repo', town.repo, '--owed', town.owed, '--attempt', `ferry-${exit}-${stage}`, '--exit', exit, '--stage', stage, '--ferry-report', file], { encoding: 'utf8' });
  const stops = (r, why, label) => {
    assert.equal(r.status, 1, `${label}: composing stops, and the unit owes the run as incomplete`);
    assert.match(r.stderr, why, label);
    assert.equal(listOwed(town.owed).owed.length, 0, `${label}: nothing signed as quiet`);
  };

  writeFileSync(reportFile, '{"ran": true, "delivered": 4');
  stops(oweMail(), /is there and does not parse, so what the crossing did is unknown/, 'an unparseable report');
  writeFileSync(reportFile, '');
  stops(oweMail(), /exited 0, so its ferry ran, and its report .*report\.json is missing or empty: what it delivered is unknown/, 'an empty report at exit 0');
  stops(oweMail('0', 'done', join(town.root, 'never-written.json')), /never-written\.json is missing or empty/, 'a missing report at exit 0');
  writeFileSync(reportFile, JSON.stringify({ ran: true, crossing: 293 }));
  stops(oweMail(), /carries no delivered and bounced counts/, 'a report without its counts at exit 0');
  writeFileSync(reportFile, JSON.stringify({ ran: false }));
  stops(oweMail(), /does not say the ferry ran/, 'a report that says the ferry never ran, at exit 0');

  writeFileSync(reportFile, `${JSON.stringify(ferryReportOf(293), null, 1)}\n`);
  assert.equal(oweMail().status, 0, 'the control: the report the ferry writes on a crossing that moved nothing');
  assert.equal(listOwed(town.owed).owed[0].decided.outcome.status, 'quiet', 'and that crossing is quiet');

  writeFileSync(reportFile, '');
  const refused = oweMail('1', 'drain');
  assert.equal(refused.status, 0, `the control: refused before its ferry wrote a report — ${refused.stderr}`);
  const decided = listOwed(town.owed).owed.map((e) => e.decided).find((d) => d.attempt === 'ferry-1-drain');
  assert.deepEqual([decided.outcome.status, decided.outcome.stage, decided.outcome.ferry], ['refused', 'drain', undefined], 'refused at its stage, and it claims no counts: not "nothing was delivered"');
});

test('THE COMPOSER ITSELF requires an exit-0 crossing\'s report: no report and no counts are never defaulted to a quiet zero', (t) => {
  const town = scratchTown(t);
  const compose = (exit, ferryReport) => mailDecided(town.repo, { attempt: 'r', decidedAt: '2026-11-06T12:00:30.000Z', exit, stage: exit === 0 ? 'done' : 'drain', ferryReport });
  assert.throws(() => compose(0, null), /exited 0, so its ferry ran, and its report is missing or empty/);
  assert.throws(() => compose(0, { ran: true, crossing: 293 }), /carries no delivered and bounced counts/);
  assert.throws(() => compose(0, { ...ferryReportOf(293), delivered: -1 }), /carries no delivered and bounced counts/);
  assert.throws(() => compose(0, { ...ferryReportOf(293), files: undefined }), /does not say what its commit carried/);
  assert.equal(compose(0, ferryReportOf(293)).outcome.status, 'quiet', 'the control: a written zero report is quiet');
  assert.equal(compose(0, ferryReportOf(293, { delivered: 2, committed: true, pushed: true, files: ['WHITE_PAGES/mail-ledger.md'] })).outcome.status, 'delivered');
  const refused = compose(1, null);
  assert.deepEqual([refused.outcome.status, refused.outcome.ferry], ['refused', undefined], 'the control: a pre-ferry refusal composes, and claims no counts');
  // A FAILED CARRIED-FILE READ (Wright's fit, 2026-11-07): the ferry leaves `files` unset, at either exit.
  // After a non-zero exit, a report that says the ferry ran is judged by the same fields.
  const noFiles = { ...ferryReportOf(293, { delivered: 1, committed: true, pushed: true }) };
  delete noFiles.files;
  assert.throws(() => compose(0, noFiles), /exited 0, so its ferry ran, and its report does not say what its commit carried/);
  assert.throws(() => compose(1, { ...noFiles, pushed: false }), /exited 1 after its ferry ran, and its report does not say what its commit carried/);
  assert.throws(() => compose(1, { ran: true, crossing: 293 }), /exited 1 after its ferry ran, and its report carries no delivered and bounced counts/);
  const partial = compose(1, ferryReportOf(293, { delivered: 1, committed: true, files: ['WHITE_PAGES/mail-ledger.md'] }));
  assert.deepEqual([partial.outcome.status, partial.outcome.ferry], ['refused', { delivered: 1, bounced: 0, committed: true, pushed: false }], 'the control: a refused crossing with its full report keeps what it did');
  const neverRan = compose(1, { ran: false, error: 'git pull failed' });
  assert.deepEqual([neverRan.outcome.status, neverRan.outcome.ferry], ['refused', undefined], 'the control: a ferry that never ran claims no counts');
});

test('AN UNREAD LOCAL HEAD stops the composing: whether the crossing left a commit unpublished is never silently dropped', (t) => {
  const town = scratchTown(t);
  // no fetch: git's fetch walks the local branch too, and would stop first; the read under test is HEAD's
  const compose = () => mailDecided(town.repo, { attempt: 'r', decidedAt: '2026-11-06T12:01:00.000Z', exit: 1, stage: 'mint', fetch: false, ferryReport: ferryReportOf(293, { delivered: 1, committed: true, files: ['WHITE_PAGES/mail-ledger.md'] }) });
  town.ledgers.mail.push('- 2026-11-06 · late-2026-11-06-x · late → reader · thread: t');
  town.writeLedgers();
  town.commit('ferry: unpushed');
  const localHead = town.git(town.repo, 'rev-parse', 'HEAD').trim();
  assert.equal(compose().results.local_head, localHead, 'the control: a commit not yet public is named');
  dropObject(town.repo, localHead);
  assert.throws(compose, /could not read the town clone's HEAD, so whether this crossing left a commit unpublished is unknown/,
    'an unread HEAD is never "nothing unpublished": no record omits local_head for a read that failed');
});

// THE ANCESTRY WALK, UNREAD (Wright, 2026-11-07 05:22Z: "the same check as POS-922 … on the same box … git 2.43").
// `merge-base --is-ancestor` exits 1 for "is not" — and Git 2.43 also exits 1, with an error on stderr, when its
// walk cannot read a commit between the two. Only a 1 with nothing on stderr is a clean "is not"; anything else
// is unknown, and unknown is never unpublished. Asserted as a throw whatever the exit, so a newer Git that answers
// the unread walk otherwise holds the same law. The clean "is not" is the control above: an unpushed HEAD is named.
test('AN UNREAD ANCESTRY WALK is never "unpublished": the clone at a public commit, an intermediate commit unreadable, stops the composing', (t) => {
  const town = scratchTown(t);
  const compose = () => mailDecided(town.repo, { attempt: 'r', decidedAt: '2026-11-06T12:01:00.000Z', exit: 1, stage: 'mint', fetch: false, ferryReport: ferryReportOf(293, { delivered: 1, committed: true, files: ['WHITE_PAGES/mail-ledger.md'] }) });
  const public1 = town.git(town.repo, 'rev-parse', 'HEAD').trim();   // the town's commit, already public
  const between = town.crossing(1);                                    // B: public, on top of it
  town.crossing(2);                                                    // C: public, the remote's tip
  town.git(town.repo, 'checkout', '-q', '--detach', public1);          // the clone stands at the public commit beneath B and C
  assert.equal(compose().results.local_head, undefined, 'the control: a HEAD that is public names nothing unpublished');
  dropObject(town.repo, between);                                      // both endpoints stay readable; the walk between them doesn't
  assert.throws(compose, new RegExp(`could not tell whether ${public1.slice(0, 8)} is public`),
    'an ancestry walk that could not be read is unknown, never "this commit is not public"');
});

function writeKey(town) {
  const path = join(town.root, 'witness-key.pem');
  writeFileSync(path, town.witnessKey.privatePem);
  return path;
}
