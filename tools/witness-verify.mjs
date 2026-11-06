#!/usr/bin/env node
// witness-verify.mjs — check the town's witness chain from a checkout, against a
// key or checkpoint YOU chose (POS-907; NOMOS II.3.1.2; WITNESS.md).
//
//   node tools/witness-verify.mjs --key <witness public key pem> [--checkpoint <seq>:<hash>]
//                                 [--at <ref>] [--world <World checkout>]
//
// Read-only: it reads git objects and writes nothing. It checks, for every
// record in WITNESS/records at <ref> (default HEAD):
//
//   1. THE LINKS    records 1..N, none missing or extra; each names the hash of
//                   the one before (record 1 names the genesis hash).
//   2. THE HASHES   each record's hash is the hash of its own body.
//   3. THE KEY      each record is signed by the key you supplied, and the
//                   signature verifies. With --checkpoint, the record at that
//                   seq must have that hash: a replaced history fails here.
//   4. THE FILES    every file a record names is in the named commit with the
//                   named sha256 (or absent where it says absent). A World file
//                   needs --world; without it, or with a commit you don't have,
//                   the answer is INCOMPLETE, never green.
//   5. THE LEDGERS  a mail record's mail and stamp heads recompute from the
//                   ledgers at its commit, and the newest town tip's ledgers
//                   still begin with every head an older record bound: nothing
//                   before the newest record was changed, dropped or reordered.
//
// What it cannot tell you: whether this checkout holds the NEWEST record. A
// chain that checks is a prefix; a newer record could exist and be withheld.
// Compare the latest hash it prints with one you got somewhere else.
//
// Exit: 0 every check passed · 1 a check failed · 3 incomplete (something
// needed to check was missing) · 2 usage.

import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  GENESIS, KINDS, bytesAt, checkRecord, hasCommit, keyIdOf, readChain,
} from './witness-chain.mjs';
import { parseLedger as parseMailLedger, sealLedger } from '../PROJECTS/the-town-seal/seal.mjs';
import { parseStampLedger, sealChain } from './stamp-mint.mjs';

const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const HEX40 = /^[0-9a-f]{40}$/;
// Every commit a settlement makes on World main begins with this subject (the
// settlement sweep and its registry refresh; office world2/tools/marks-ingest.mjs
// names the same pens). A settlement commit outside every recorded range is a
// settlement the chain does not witness.
export const SETTLEMENT_SUBJECT = 'settlement: ';

/** Running seals of the mail ledger at <commit>, index i = seal after i+1 lines. */
function mailSeals(repo, commit) {
  const buf = bytesAt(repo, commit, 'WHITE_PAGES/mail-ledger.md');
  if (!buf) return null;
  return sealLedger(parseMailLedger(buf.toString('utf8'))).entries.map((e) => e.seal);
}
function stampSeals(repo, commit) {
  const buf = bytesAt(repo, commit, 'WHITE_PAGES/stamp-ledger.md');
  if (!buf) return null;
  return sealChain(parseStampLedger(buf.toString('utf8')).map((e) => e.canonical));
}
const MAIL_GENESIS = sha256(Buffer.from('postmark-ledger-v1', 'utf8'));
const STAMP_GENESIS = sha256(Buffer.from('postmark-stamps-v1', 'utf8'));
const sealAt = (seals, genesis, lines) => (lines === 0 ? genesis : seals[lines - 1]);

/**
 * The whole verification, pure over git reads.
 *   { verdict: 'pass' | 'fail' | 'incomplete', failures: [], incomplete: [], count, latest }
 */
export function verifyChain({ repo, at = 'HEAD', publicKeyPem, checkpoint = null, world = null }) {
  const failures = [];
  const incomplete = [];
  const keyId = keyIdOf(publicKeyPem);
  const { records, names } = readChain(repo, at);
  if (!records.length) {
    incomplete.push(`no records under WITNESS/records at ${at}: there is nothing to check`);
    return { verdict: 'incomplete', failures, incomplete, count: 0, latest: null };
  }

  // 1–3: links, hashes, key.
  let prev = GENESIS;
  const good = [];
  for (let i = 0; i < records.length; i++) {
    const seq = i + 1;
    const expectedName = `${String(seq).padStart(8, '0')}.json`;
    if (names[i] !== expectedName) {
      failures.push(`record #${seq}: expected file ${expectedName}, found ${names[i]} (a record is missing, extra or misnamed)`);
      break;
    }
    const { record } = records[i];
    const problems = checkRecord(record, { seq, prev, publicKeyPem, keyId });
    if (problems.length) { failures.push(`record #${seq}: ${problems.join('; ')}`); break; }
    good.push(record);
    prev = record.hash;
  }
  if (checkpoint) {
    const r = good[checkpoint.seq - 1];
    if (!r) {
      if (!failures.length) failures.push(`checkpoint #${checkpoint.seq}: this chain has only ${good.length} record(s), so it does not reach your checkpoint`);
    } else if (r.hash !== checkpoint.hash) {
      failures.push(`checkpoint #${checkpoint.seq}: your checkpoint is ${checkpoint.hash.slice(0, 16)}…, this chain has ${r.hash.slice(0, 16)}… — this is not the history you trusted`);
    }
  }
  if (failures.length) return { verdict: 'fail', failures, incomplete, count: good.length, latest: good.at(-1) ?? null };

  // 4: the files.
  const worldRepo = world ? resolve(world) : null;
  for (const r of good) {
    const d = r.body.decided;
    for (const a of d.artifacts) {
      const where = a.repo === 'town' ? repo : worldRepo;
      const label = `record #${r.body.seq} ${a.repo}:${a.commit.slice(0, 8)}:${a.path}`;
      if (!where) { incomplete.push(`${label}: a World file, and no --world checkout was given`); continue; }
      if (!hasCommit(where, a.commit)) { incomplete.push(`${label}: that commit is not in your ${a.repo} checkout (fetch it, or the record names bytes nobody published)`); continue; }
      const buf = bytesAt(where, a.commit, a.path);
      const got = buf ? sha256(buf) : null;
      if (got !== a.sha256) {
        failures.push(`${label}: the record says ${a.sha256 ? a.sha256.slice(0, 16) + '…' : 'absent'}, the commit has ${got ? got.slice(0, 16) + '…' : 'nothing there'}`);
      }
    }
  }

  // 4b: GAPS INSIDE THE CHAIN. A valid chain of records can still leave events
  // out, and a gap is never a pass (Rivet's FIX of 2026-11-06 on POS-907).
  const settlements = good.filter((r) => r.body.decided.kind === 'settlement');
  for (const r of good) {
    const d = r.body.decided;
    if (d.outcome.status === 'incomplete') {
      incomplete.push(`record #${r.body.seq}: ${d.event} (attempt ${d.attempt}) never recorded its outcome — ${d.outcome.why ?? 'no reason given'}`);
    }
  }
  //   every crossing between the first and the last mail record has a record
  const crossings = new Set(good.filter((r) => r.body.decided.kind === 'mail-crossing')
    .map((r) => Number(/^crossing:(\d+)$/.exec(r.body.decided.event)?.[1])).filter(Number.isSafeInteger));
  if (crossings.size) {
    const lo = Math.min(...crossings);
    const hi = Math.max(...crossings);
    const missing = [];
    for (let n = lo; n <= hi; n++) if (!crossings.has(n)) missing.push(n);
    if (missing.length) incomplete.push(`crossing${missing.length > 1 ? 's' : ''} ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ` (+${missing.length - 20})` : ''} between ${lo} and ${hi} ha${missing.length > 1 ? 've' : 's'} no record: the ferry did not run, or its record is missing`);
  }
  //   a settlement that moved World says what it changed, all of it
  const moved = settlements.filter((r) => {
    const d = r.body.decided;
    return HEX40.test(d.results?.world_to ?? '') && d.results.world_to !== d.inputs?.world_from;
  });
  for (const r of settlements) {
    const d = r.body.decided;
    if (d.outcome.status === 'published' && !HEX40.test(d.results?.world_to ?? '')) {
      incomplete.push(`record #${r.body.seq}: a published settlement that names no world_to`);
    }
  }
  for (const r of moved) {
    const d = r.body.decided;
    const label = `record #${r.body.seq} (${d.event})`;
    if (d.inventory?.complete !== true) {
      incomplete.push(`${label}: its World inventory was not read — ${d.inventory?.why ?? 'the record carries no inventory'}`);
      continue;
    }
    if (!worldRepo) continue; // its World artifacts are already incomplete above
    if (!HEX40.test(d.inputs?.world_from ?? '') || !hasCommit(worldRepo, d.inputs.world_from) || !hasCommit(worldRepo, d.results.world_to)) {
      incomplete.push(`${label}: its World range is not in your --world checkout`);
      continue;
    }
    const diff = spawnSync('git', ['-C', worldRepo, 'diff', '--name-only', '--no-renames', '-z', d.inputs.world_from, d.results.world_to], { encoding: 'utf8' });
    const changed = new Set(diff.stdout.split('\0').filter(Boolean));
    const bound = new Set(d.artifacts.filter((a) => a.repo === 'world').map((a) => a.path));
    const omitted = [...changed].filter((p) => !bound.has(p));
    const extra = [...bound].filter((p) => !changed.has(p));
    if (omitted.length || extra.length) {
      failures.push(`${label}: its World inventory is not the change it names — ${omitted.length} file(s) changed and not bound${omitted.length ? ` (${omitted.slice(0, 3).join(', ')}…)` : ''}, ${extra.length} bound and not changed`);
    }
  }
  //   no settlement commit on World falls between the records
  if (moved.length) {
    if (!worldRepo) {
      incomplete.push('World continuity unchecked: settlement records name World commits, and no --world checkout was given');
    } else {
      const firstFrom = moved[0].body.decided.inputs?.world_from;
      const lastTo = moved.at(-1).body.decided.results.world_to;
      if (HEX40.test(firstFrom ?? '') && hasCommit(worldRepo, firstFrom) && hasCommit(worldRepo, lastTo)) {
        const covered = new Set();
        for (const r of moved) {
          const d = r.body.decided;
          if (!HEX40.test(d.inputs?.world_from ?? '')) continue;
          const list = spawnSync('git', ['-C', worldRepo, 'rev-list', d.results.world_to, `^${d.inputs.world_from}`], { encoding: 'utf8' });
          for (const sha of list.stdout.split('\n').filter(Boolean)) covered.add(sha);
        }
        const log = spawnSync('git', ['-C', worldRepo, 'log', '--format=%H%x09%s', `--grep=^${SETTLEMENT_SUBJECT}`, lastTo, `^${firstFrom}`], { encoding: 'utf8' });
        for (const line of log.stdout.split('\n').filter(Boolean)) {
          const [sha, subject] = line.split('\t');
          if (!covered.has(sha)) incomplete.push(`World commit ${sha.slice(0, 8)} ("${subject.slice(0, 60)}") is a settlement's, and no record binds it`);
        }
      } else {
        incomplete.push('World continuity unchecked: the settlement records\' World range is not in your --world checkout');
      }
    }
  }

  // 5: the ledgers. Each mail record's heads at its own commit, then every
  // head against the newest town tip any mail record names.
  const mails = good.filter((r) => r.body.decided.kind === 'mail-crossing');
  for (const r of mails) {
    const d = r.body.decided;
    const commit = d.results?.town_head;
    if (!commit || !hasCommit(repo, commit)) { incomplete.push(`record #${r.body.seq}: its town head ${String(commit).slice(0, 8)} is not in your checkout`); continue; }
    for (const [name, seals, genesis] of [['mail', mailSeals(repo, commit), MAIL_GENESIS], ['stamps', stampSeals(repo, commit), STAMP_GENESIS]]) {
      const head = d.heads?.[name];
      if (!head) continue;
      if (!seals) { failures.push(`record #${r.body.seq}: binds a ${name} head, but the ${name} ledger is not at ${commit.slice(0, 8)}`); continue; }
      if (seals.length !== head.lines || sealAt(seals, genesis, head.lines) !== head.seal) {
        failures.push(`record #${r.body.seq}: its ${name} head (${head.lines} lines, ${String(head.seal).slice(0, 12)}…) does not recompute at ${commit.slice(0, 8)} (${seals.length} lines, ${sealAt(seals, genesis, seals.length).slice(0, 12)}…)`);
      }
    }
  }
  const newest = mails.at(-1);
  const tip = newest?.body.decided.results?.town_head;
  if (tip && hasCommit(repo, tip)) {
    const ledgers = [['mail', mailSeals(repo, tip), MAIL_GENESIS], ['stamps', stampSeals(repo, tip), STAMP_GENESIS]];
    for (const r of mails) {
      for (const [name, seals, genesis] of ledgers) {
        const head = r.body.decided.heads?.[name];
        if (!head || !seals) continue;
        if (head.lines > seals.length || sealAt(seals, genesis, head.lines) !== head.seal) {
          failures.push(`record #${r.body.seq}: the ${name} ledger at the newest record's commit (#${newest.body.seq}) no longer begins with the ${head.lines} lines record #${r.body.seq} bound — an earlier line was changed, dropped or reordered`);
        }
      }
    }
  }

  const verdict = failures.length ? 'fail' : incomplete.length ? 'incomplete' : 'pass';
  return { verdict, failures, incomplete, count: good.length, latest: good.at(-1) ?? null };
}

function main(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[++i];
  if (!o.key) {
    console.error('witness-verify: --key <pem> is required. Choose the key you trust (the town publishes one at WITNESS/witness-pubkey.pem; trusting it means trusting this checkout). See WITNESS.md.');
    return 2;
  }
  let checkpoint = null;
  if (o.checkpoint) {
    const m = /^(\d+):([0-9a-f]{64})$/.exec(o.checkpoint);
    if (!m) { console.error('witness-verify: --checkpoint is <seq>:<64-hex hash>'); return 2; }
    checkpoint = { seq: Number(m[1]), hash: m[2] };
  }
  const repo = resolve(o.repo ?? '.');
  const pem = readFileSync(o.key, 'utf8');
  const r = verifyChain({ repo, at: o.at ?? 'HEAD', publicKeyPem: pem, checkpoint, world: o.world ?? null });

  console.log(`witness chain at ${o.at ?? 'HEAD'}: ${r.count} record(s) checked against key ${keyIdOf(pem)}`);
  const kinds = r.latest ? KINDS.map((k) => `${k}`).join(' + ') : '';
  for (const f of r.failures) console.log(`  ✗ ${f}`);
  for (const i of r.incomplete) console.log(`  ? ${i}`);
  if (r.verdict === 'pass') {
    console.log(`✓ every record checks: links, hashes, signatures, files and ledgers (${kinds}).`);
  } else if (r.verdict === 'incomplete') {
    console.log(`? INCOMPLETE — ${r.incomplete.length} thing(s) above could not be checked, so this is not a pass.`);
  } else {
    console.log(`✗ FAILED — ${r.failures.length} check(s) above.`);
  }
  if (r.latest) {
    console.log(`latest record checked: #${r.latest.body.seq} ${r.latest.hash}`);
    console.log('This says nothing about records after it: a chain that checks can still be missing its newest records. Compare that hash with one from elsewhere.');
  }
  return r.verdict === 'pass' ? 0 : r.verdict === 'incomplete' ? 3 : 1;
}

// Entered through a symlink, argv[1] is the link and import.meta.url the
// target: compare real paths, or the check does nothing and exits 0.
const isMain = (() => {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return pathToFileURL(process.argv[1]).href === import.meta.url; }
})();

if (isMain) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) {
    console.error(`witness-verify: ${e.message}`);
    process.exitCode = 1;
  }
}
