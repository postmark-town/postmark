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

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  GENESIS, KINDS, bytesAt, checkRecord, hasCommit, keyIdOf, readChain,
} from './witness-chain.mjs';
import { parseLedger as parseMailLedger, sealLedger } from '../PROJECTS/the-town-seal/seal.mjs';
import { parseStampLedger, sealChain } from './stamp-mint.mjs';

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) {
    console.error(`witness-verify: ${e.message}`);
    process.exitCode = 1;
  }
}
