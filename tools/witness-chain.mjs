#!/usr/bin/env node
// witness-chain.mjs — the town's witness chain: one public, signed, append-only
// record of every mail crossing and every settlement, in publication order
// (POS-907; NOMOS II.3.1.2). WITNESS.md is the reader's page; this file is the
// grammar, the writer and the publisher. tools/witness-verify.mjs is the
// resident's read-only check.
//
// Not to be confused with tools/witness.mjs, the PR certifier. That witness
// merges residents' pull requests; this one keeps the crossings' record.
//
// ── WHAT DARKO RULED (2026-11-06, POS-907/a–e) ──────────────────────────────
//
//   "One chain"        mail crossings and settlements are two kinds of record
//                      in ONE chain in this repo, in the order published.
//   "Check the chain"  a resident can confirm nothing before the newest record
//                      was changed, dropped or reordered, and that each
//                      record's files match. Rerunning a settlement is not
//                      promised.
//   "Keep running"     a record that fails to publish is OWED; the town keeps
//                      running and nothing is rolled back. Quiet and refused
//                      crossings get records too.
//   The key            the witness signs with its own key, separate from the
//                      stamp pen; Starforge holds it for now.
//
// ── THE SHAPE ───────────────────────────────────────────────────────────────
//
// A DECIDED OUTCOME is what a workflow knows when it has finished deciding: its
// kind, the event it belongs to, which attempt, the outcome, and the exact
// public objects it read and produced. It is written to an OWED directory on
// the box (outside any clone, so no reset can lose it) the moment it is decided.
//
// A RECORD is a decided outcome placed in the chain:
//
//   body   = { chain, seq, prev, key, follows?, decided }
//   hash   = sha256( canonical(body) )             (hex)
//   sig    = ed25519( utf8(hash) ), base64url      (the stamp chain's habit)
//
// `prev` is the previous record's hash (record 1's is the genesis hash below);
// `follows` names the latest earlier record of the same event, when there is
// one, so a rerun or a changed result is linked rather than overwritten. Each
// record is one immutable file, WITNESS/records/<seq, 8 digits>.json.
//
// ── PUBLISHING ──────────────────────────────────────────────────────────────
//
// `publish` builds the next records ON TOP OF THE REMOTE'S TIP with git
// plumbing (no working tree touched) and pushes fast-forward only. The remote
// is the one compare-and-swap: a publisher that lost the race refetches and
// rebuilds on the new tip, so two publishers can never fork the chain. Owed
// outcomes are published oldest first, and a decided outcome is never placed
// after one decided later that is still owed. An owed file is deleted only
// after its record is on the remote; publishing the same outcome twice is a
// no-op, because each record carries its outcome's id.

import { createHash, createPrivateKey, createPublicKey, sign as edSign, verify as edVerify } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  closeSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync,
  realpathSync, renameSync, rmSync, writeSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

import { parseLedger as parseMailLedger, sealLedger } from '../PROJECTS/the-town-seal/seal.mjs';
import { parseStampLedger, sealChain } from './stamp-mint.mjs';
import { crossingAt } from './crossings.mjs';

export const CHAIN = 'postmark-witness-v1';
export const GENESIS = createHash('sha256').update(CHAIN, 'utf8').digest('hex');
export const RECORDS_DIR = 'WITNESS/records';
export const PUBKEY_PATH = 'WITNESS/witness-pubkey.pem';
export const STAMP_PUBKEY_PATH = 'tools/stamp-pubkey.pem';
export const KINDS = Object.freeze(['mail-crossing', 'settlement']);
export const MAIL_STATUSES = Object.freeze(['delivered', 'quiet', 'refused']);
export const SETTLEMENT_STATUSES = Object.freeze(['published', 'quiet', 'refused', 'starving', 'race']);
// The public files a mail record binds by digest, besides the letters it moved.
export const MAIL_ARTIFACTS = Object.freeze([
  'WHITE_PAGES/mail-ledger.md',
  'WHITE_PAGES/stamp-ledger.md',
  'WHITE_PAGES/crossing-ledger.md',
]);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;

// ── canonical JSON ──────────────────────────────────────────────────────────
//
// One spelling per value, so a hash means one thing: object keys sorted by
// code unit, no whitespace, strings as JSON.stringify writes them. Only JSON's
// own values, and only safe integers for numbers, so no float can print two ways.
export function canonicalJson(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error(`canonical JSON carries integers only, got ${value}`);
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const parts = [];
    for (const k of keys) {
      if (value[k] === undefined) throw new Error(`canonical JSON has no undefined (key ${k})`);
      parts.push(`${JSON.stringify(k)}:${canonicalJson(value[k])}`);
    }
    return `{${parts.join(',')}}`;
  }
  throw new Error(`canonical JSON cannot carry a ${typeof value}`);
}

export const hashOf = (value) => sha256(Buffer.from(canonicalJson(value), 'utf8'));
export const outcomeId = (decided) => hashOf(decided);

// A key is named by the sha256 of its public key's DER (SPKI) bytes.
export function keyIdOf(publicKeyPem) {
  const der = createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  return `sha256:${sha256(der)}`;
}
export const publicPemOf = (privateKeyPem) =>
  createPublicKey(createPrivateKey(privateKeyPem)).export({ type: 'spki', format: 'pem' });

// ── the decided outcome ─────────────────────────────────────────────────────

/** Problems with a decided outcome's shape, or [] when it may be owed. */
export function checkDecided(d) {
  const p = [];
  if (!d || typeof d !== 'object' || Array.isArray(d)) return ['a decided outcome is an object'];
  if (d.v !== 1) p.push('v must be 1');
  if (!KINDS.includes(d.kind)) p.push(`kind must be one of ${KINDS.join(', ')}`);
  for (const f of ['event', 'attempt', 'decided_at']) {
    if (typeof d[f] !== 'string' || !d[f]) p.push(`${f} must be a non-empty string`);
  }
  if (d.decided_at && Number.isNaN(Date.parse(d.decided_at))) p.push('decided_at must be an ISO instant');
  const statuses = d.kind === 'settlement' ? SETTLEMENT_STATUSES : MAIL_STATUSES;
  if (!d.outcome || !statuses.includes(d.outcome.status)) p.push(`outcome.status must be one of ${statuses.join(', ')}`);
  for (const f of ['inputs', 'results', 'heads']) {
    if (!d[f] || typeof d[f] !== 'object' || Array.isArray(d[f])) p.push(`${f} must be an object`);
  }
  if (!Array.isArray(d.artifacts)) p.push('artifacts must be a list');
  else for (const a of d.artifacts) {
    if (!a || !['town', 'world'].includes(a.repo) || !HEX40.test(a.commit ?? '') || typeof a.path !== 'string' || !a.path
      || !(a.sha256 === null || HEX64.test(a.sha256 ?? ''))) {
      p.push(`an artifact is { repo: town|world, commit: <40 hex>, path, sha256: <64 hex> | null (absent) }, got ${JSON.stringify(a)}`);
      break;
    }
  }
  try { canonicalJson(d); } catch (e) { p.push(e.message); }
  return p;
}

// ── the owed directory ──────────────────────────────────────────────────────

const owedName = (decided) =>
  `${decided.decided_at.replace(/[^0-9TZ]/g, '')}-${outcomeId(decided).slice(0, 16)}.json`;

/** Write a decided outcome to the owed directory, durably. The same outcome twice is one file. */
export function owe(owedDir, decided) {
  const problems = checkDecided(decided);
  if (problems.length) throw new Error(`not a decided outcome: ${problems.join('; ')}`);
  mkdirSync(owedDir, { recursive: true });
  const name = owedName(decided);
  const path = join(owedDir, name);
  if (existsSync(path)) return { path, fresh: false };
  const tmp = join(owedDir, `.${name}.${process.pid}.tmp`);
  const fd = openSync(tmp, 'w');
  try { writeSync(fd, `${canonicalJson(decided)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(tmp, path);
  const dfd = openSync(owedDir, 'r');
  try { fsyncSync(dfd); } catch { /* not every filesystem syncs a directory */ } finally { closeSync(dfd); }
  return { path, fresh: true };
}

/** The owed outcomes, oldest decision first. A file that does not parse is reported, never skipped. */
export function listOwed(owedDir) {
  if (!existsSync(owedDir)) return { owed: [], unreadable: [] };
  const owed = [];
  const unreadable = [];
  for (const name of readdirSync(owedDir).filter((n) => !n.startsWith('.') && n.endsWith('.json')).sort()) {
    const path = join(owedDir, name);
    try {
      const decided = JSON.parse(readFileSync(path, 'utf8'));
      const problems = checkDecided(decided);
      if (problems.length) unreadable.push({ path, why: problems.join('; ') });
      else owed.push({ path, decided, id: outcomeId(decided) });
    } catch (e) {
      unreadable.push({ path, why: e.message });
    }
  }
  owed.sort((a, b) => Date.parse(a.decided.decided_at) - Date.parse(b.decided.decided_at) || (a.path < b.path ? -1 : 1));
  return { owed, unreadable };
}

// ── records ─────────────────────────────────────────────────────────────────

export const recordPath = (seq) => `${RECORDS_DIR}/${String(seq).padStart(8, '0')}.json`;

export function makeRecord({ seq, prev, follows = null, decided, privateKeyPem, keyId }) {
  const body = { chain: CHAIN, seq, prev, key: keyId, decided };
  if (follows) body.follows = follows;
  const hash = hashOf(body);
  const sig = edSign(null, Buffer.from(hash, 'utf8'), createPrivateKey(privateKeyPem)).toString('base64url');
  return { body, hash, sig };
}

export const recordText = (record) => `${JSON.stringify(record, null, 1)}\n`;

/**
 * Problems with one record against what the chain says should come before it:
 * the expected seq and prev, and the trusted key. [] when it holds.
 */
export function checkRecord(record, { seq, prev, publicKeyPem, keyId }) {
  const p = [];
  const b = record?.body;
  if (!b || typeof b !== 'object') return ['no body'];
  if (b.chain !== CHAIN) p.push(`chain is ${JSON.stringify(b.chain)}, not ${CHAIN}`);
  if (b.seq !== seq) p.push(`seq is ${b.seq}, expected ${seq} (a record is missing, extra or out of order)`);
  if (b.prev !== prev) p.push(`prev is ${String(b.prev).slice(0, 12)}…, expected ${String(prev).slice(0, 12)}… (the link to the record before is broken)`);
  let hash = null;
  try { hash = hashOf(b); } catch (e) { p.push(`body is not canonical JSON: ${e.message}`); }
  if (hash && record.hash !== hash) p.push(`hash is ${String(record.hash).slice(0, 12)}…, but the body hashes to ${hash.slice(0, 12)}… (the body was changed)`);
  if (b.key !== keyId) p.push(`signed by key ${b.key}, not the trusted key ${keyId}`);
  else if (hash) {
    let ok = false;
    try { ok = edVerify(null, Buffer.from(hash, 'utf8'), createPublicKey(publicKeyPem), Buffer.from(String(record.sig ?? ''), 'base64url')); } catch { ok = false; }
    if (!ok) p.push('signature does not verify under the trusted key');
  }
  const d = checkDecided(b.decided);
  if (d.length) p.push(`decided outcome: ${d.join('; ')}`);
  return p;
}

// ── git ─────────────────────────────────────────────────────────────────────

function git(repo, args, { input = null, env = {}, encoding = 'utf8' } = {}) {
  const r = spawnSync('git', ['-C', repo, ...args], {
    input, encoding, env: { ...process.env, ...env }, maxBuffer: 512 * 1024 * 1024,
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
function gitOk(repo, args, opts) {
  const r = git(repo, args, opts);
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || r.stdout).toString().trim()}`);
  return r.stdout;
}

/** The bytes of <path> at <commit>, or null when the commit or the path is not there. */
export function bytesAt(repo, commit, path) {
  const r = spawnSync('git', ['-C', repo, 'cat-file', 'blob', `${commit}:${path}`], { maxBuffer: 512 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}
export const hasCommit = (repo, commit) => git(repo, ['cat-file', '-e', `${commit}^{commit}`]).status === 0;

/** Every record at <ref>, in file order, read through one cat-file batch. */
export function readChain(repo, ref) {
  const ls = git(repo, ['ls-tree', '--name-only', `${ref}:${RECORDS_DIR}`]);
  if (ls.status !== 0) return { records: [], names: [] };
  const names = ls.stdout.split('\n').filter(Boolean).sort();
  const records = [];
  for (const name of names) {
    const buf = bytesAt(repo, ref, `${RECORDS_DIR}/${name}`);
    let record = null;
    try { record = JSON.parse(buf.toString('utf8')); } catch { record = { unreadable: true }; }
    records.push({ name, record });
  }
  return { records, names };
}

// ── the heads a mail record binds ───────────────────────────────────────────

/** The mail ledger's running head at <commit>: line count and Town Seal. */
export function mailHeadAt(repo, commit) {
  const buf = bytesAt(repo, commit, 'WHITE_PAGES/mail-ledger.md');
  if (!buf) return null;
  const sealed = sealLedger(parseMailLedger(buf.toString('utf8')));
  return { lines: sealed.entries.length, seal: sealed.townSeal };
}

/** The stamp ledger's running head at <commit>: line count and running seal (hex). */
export function stampHeadAt(repo, commit) {
  const buf = bytesAt(repo, commit, 'WHITE_PAGES/stamp-ledger.md');
  if (!buf) return null;
  const entries = parseStampLedger(buf.toString('utf8'));
  const seals = sealChain(entries.map((e) => e.canonical));
  return { lines: entries.length, seal: seals.length ? seals[seals.length - 1] : sha256(Buffer.from('postmark-stamps-v1', 'utf8')) };
}

const artifactAt = (repo, repoName, commit, path) => {
  const buf = bytesAt(repo, commit, path);
  return { repo: repoName, commit, path, sha256: buf ? sha256(buf) : null };
};

/**
 * A mail crossing's decided outcome, read from the town clone.
 *
 * It binds what is PUBLIC at the moment of decision: `town_head` is the
 * remote's tip after a fetch, and every head and digest is read there. A
 * commit the crossing made but could not push is named as `local_head` and
 * bound to nothing, because its bytes are not public yet; the next crossing's
 * record covers them once they are.
 */
export function mailDecided(repo, {
  attempt, decidedAt, exit, stage, ferryReport = null, remote = 'origin', branch = 'main', fetch = true,
}) {
  if (fetch) git(repo, ['fetch', '--quiet', remote, branch]);
  const publicRef = `refs/remotes/${remote}/${branch}`;
  const townHead = git(repo, ['rev-parse', '--verify', '--quiet', `${publicRef}^{commit}`]).stdout.trim();
  if (!HEX40.test(townHead)) throw new Error(`no public head at ${publicRef}`);
  const local = git(repo, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']).stdout.trim();
  const localUnpublished = HEX40.test(local) && git(repo, ['merge-base', '--is-ancestor', local, townHead]).status !== 0;

  const report = ferryReport ?? {};
  const delivered = Number.isSafeInteger(report.delivered) ? report.delivered : 0;
  const bounced = Number.isSafeInteger(report.bounced) ? report.bounced : 0;
  const status = exit === 0 ? (delivered + bounced > 0 ? 'delivered' : 'quiet') : 'refused';
  const crossing = Number.isSafeInteger(report.crossing) ? report.crossing : crossingAt(Date.parse(decidedAt));

  const outcome = { status, exit, stage: stage || (exit === 0 ? 'done' : 'unknown') };
  if (report.ran === true) {
    outcome.ferry = { delivered, bounced, committed: report.committed === true, pushed: report.pushed === true };
    if (report.error) outcome.ferry.error = String(report.error).slice(0, 500);
  }
  const results = { town_head: townHead };
  if (localUnpublished) results.local_head = local;

  // The files the ferry's own commit carried (letters, bounce notes, ledgers),
  // bound at the public head, where they are absent if that commit is not yet
  // public; `local_head` then says so.
  const carried = Array.isArray(report.files) ? report.files.filter((p) => typeof p === 'string' && p) : [];
  const paths = [...MAIL_ARTIFACTS, 'PROJECTS/the-town-seal/seal.json', ...carried];
  return {
    v: 1,
    kind: 'mail-crossing',
    event: `crossing:${crossing}`,
    attempt,
    decided_at: decidedAt,
    outcome,
    inputs: HEX40.test(report.town_sha ?? '') ? { town_sha: report.town_sha } : {},
    results,
    heads: { mail: mailHeadAt(repo, townHead), stamps: stampHeadAt(repo, townHead) },
    artifacts: [...new Set(paths)].map((p) => artifactAt(repo, 'town', townHead, p)),
  };
}

// ── publishing ──────────────────────────────────────────────────────────────

export const WITNESS_GIT_ENV = {
  GIT_AUTHOR_NAME: 'the town witness', GIT_AUTHOR_EMAIL: 'witness@postmark.invalid',
  GIT_COMMITTER_NAME: 'the town witness', GIT_COMMITTER_EMAIL: 'witness@postmark.invalid',
};

function isRejection(text) {
  return /\[rejected\]|non-fast-forward|fetch first|stale info|failed to update ref|cannot lock ref/i.test(text);
}

/**
 * Publish every owed outcome, oldest first. Returns
 *   { status: 'published' | 'nothing-owed' | 'owed', published: [seq…], owed: n, why? }
 * and never throws for an ordinary failure: an outcome that could not be
 * published stays owed, and `why` says why.
 */
export function publish({
  repo, owedDir, privateKeyPem, remote = 'origin', branch = 'main', attempts = 5, log = () => {},
}) {
  const { owed, unreadable } = listOwed(owedDir);
  for (const u of unreadable) log(`witness: an owed file does not read and blocks the queue: ${u.path} (${u.why})`);
  if (unreadable.length) {
    return { status: 'owed', published: [], owed: owed.length + unreadable.length, why: 'an owed file does not read; the queue waits for a person rather than skip it' };
  }
  if (!owed.length) return { status: 'nothing-owed', published: [], owed: 0 };
  if (!privateKeyPem) return { status: 'owed', published: [], owed: owed.length, why: 'no witness key is configured (WITNESS_KEY)' };

  let keyId;
  let publicPem;
  try { publicPem = publicPemOf(privateKeyPem); keyId = keyIdOf(publicPem); } catch (e) {
    return { status: 'owed', published: [], owed: owed.length, why: `the witness key does not read: ${e.message}` };
  }

  let lastWhy = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const f = git(repo, ['fetch', '--quiet', remote, branch]);
    if (f.status !== 0) { lastWhy = `fetch failed: ${f.stderr.trim()}`; continue; }
    const base = git(repo, ['rev-parse', '--verify', '--quiet', `refs/remotes/${remote}/${branch}^{commit}`]).stdout.trim();
    if (!HEX40.test(base)) return { status: 'owed', published: [], owed: owed.length, why: `no ${remote}/${branch} to publish onto` };

    // THE KEY BINDING. The town's own published key must be this key, and it
    // must not be the stamp pen's: the witness signs with its own (Darko's
    // 11-05 split of the pen). Until a person publishes the key, nothing signs.
    const bound = bytesAt(repo, base, PUBKEY_PATH);
    if (!bound) return { status: 'owed', published: [], owed: owed.length, why: `the town has no ${PUBKEY_PATH} yet, so no record can be bound to a public key` };
    let boundId;
    try { boundId = keyIdOf(bound.toString('utf8')); } catch (e) {
      return { status: 'owed', published: [], owed: owed.length, why: `${PUBKEY_PATH} does not read: ${e.message}` };
    }
    if (boundId !== keyId) return { status: 'owed', published: [], owed: owed.length, why: `the configured key (${keyId}) is not the town's published witness key (${boundId})` };
    const stampPub = bytesAt(repo, base, STAMP_PUBKEY_PATH);
    if (stampPub) {
      let stampId = null;
      try { stampId = keyIdOf(stampPub.toString('utf8')); } catch { /* an unreadable stamp key is the stamp verifier's to name */ }
      if (stampId === keyId) return { status: 'owed', published: [], owed: owed.length, why: 'the witness key is the stamp pen; the witness signs with its own key' };
    }

    // The chain as published, checked enough to extend it honestly.
    const { records } = readChain(repo, base);
    let tip = { seq: 0, hash: GENESIS };
    const ids = new Set();
    const latestOfEvent = new Map();
    for (let i = 0; i < records.length; i++) {
      const r = records[i].record;
      const problems = checkRecord(r, { seq: i + 1, prev: tip.hash, publicKeyPem: publicPem, keyId });
      if (problems.length) {
        return { status: 'owed', published: [], owed: owed.length, why: `the published chain does not check at ${records[i].name}: ${problems.join('; ')}; nothing is added to a chain that does not check` };
      }
      tip = { seq: r.body.seq, hash: r.hash };
      ids.add(outcomeId(r.body.decided));
      latestOfEvent.set(`${r.body.decided.kind} ${r.body.decided.event}`, r.hash);
    }

    const already = owed.filter((o) => ids.has(o.id));
    const fresh = owed.filter((o) => !ids.has(o.id));
    if (!fresh.length) {
      for (const o of already) rmSync(o.path, { force: true });
      return { status: 'published', published: [], owed: 0 };
    }

    const added = [];
    for (const o of fresh) {
      const follows = latestOfEvent.get(`${o.decided.kind} ${o.decided.event}`) ?? null;
      const record = makeRecord({ seq: tip.seq + 1, prev: tip.hash, follows, decided: o.decided, privateKeyPem, keyId });
      added.push({ path: recordPath(record.body.seq), text: recordText(record), seq: record.body.seq });
      latestOfEvent.set(`${o.decided.kind} ${o.decided.event}`, record.hash);
      tip = { seq: record.body.seq, hash: record.hash };
    }

    // The commit, built beside the working tree: a private index, the remote's
    // tree, the new files, one commit whose only parent is the remote's tip.
    const index = join(tmpdir(), `witness-index-${process.pid}-${Date.now()}`);
    let commit;
    try {
      const env = { GIT_INDEX_FILE: index, ...WITNESS_GIT_ENV };
      gitOk(repo, ['read-tree', base], { env });
      for (const a of added) {
        const blob = gitOk(repo, ['hash-object', '-w', '--stdin'], { input: a.text }).trim();
        gitOk(repo, ['update-index', '--add', '--cacheinfo', `100644,${blob},${a.path}`], { env });
      }
      const tree = gitOk(repo, ['write-tree'], { env }).trim();
      const first = added[0].seq;
      const last = added[added.length - 1].seq;
      const msg = `witness: record${first === last ? ` ${first}` : `s ${first}–${last}`} (${fresh.map((o) => o.decided.event).join(', ')})`;
      commit = gitOk(repo, ['commit-tree', tree, '-p', base, '-m', msg], { env }).trim();
    } catch (e) {
      lastWhy = e.message;
      break;
    } finally {
      rmSync(index, { force: true });
    }

    const push = git(repo, ['push', '--quiet', remote, `${commit}:refs/heads/${branch}`]);
    if (push.status === 0) {
      for (const o of owed) rmSync(o.path, { force: true });
      // Best effort: let the clone's remote-tracking ref see what it pushed.
      git(repo, ['update-ref', `refs/remotes/${remote}/${branch}`, commit, base]);
      log(`witness: published ${added.map((a) => `#${a.seq}`).join(', ')} at ${commit.slice(0, 8)}`);
      return { status: 'published', published: added.map((a) => a.seq), owed: 0, commit };
    }
    lastWhy = `push refused: ${(push.stderr || push.stdout).trim()}`;
    if (!isRejection(push.stderr + push.stdout)) break;
    log(`witness: someone published first (attempt ${attempt}/${attempts}); rebuilding on the new tip`);
  }
  return { status: 'owed', published: [], owed: owed.length, why: lastWhy || 'publication did not complete' };
}

/** What is owed, for a person: count, oldest decision, and anything unreadable. */
export function owedStatus(owedDir) {
  const { owed, unreadable } = listOwed(owedDir);
  return {
    owed: owed.length,
    unreadable: unreadable.length,
    oldest: owed[0] ? { event: owed[0].decided.event, decided_at: owed[0].decided.decided_at } : null,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const USAGE = `witness-chain.mjs — the town's witness chain (WITNESS.md)

  owe-mail  --repo <town clone> --owed <dir> --attempt <id> --exit <n> [--stage <s>] [--ferry-report <json>] [--decided-at <iso>] [--no-fetch]
  owe       --owed <dir> --decided <json file, or - for stdin>
  publish   --repo <town clone> --owed <dir> --key <witness private key pem> [--remote origin] [--branch main]
  status    --owed <dir>

Every verb but status exits 0 when it did its part and 3 when an outcome is
left OWED (the town keeps running; the next publish pays it). 2 is a usage
error, 1 anything else.`;

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-fetch') out.noFetch = true;
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}

function main(argv) {
  const o = args(argv);
  const verb = o._[0];
  const log = (m) => process.stderr.write(`[witness] ${m}\n`);
  if (!verb || verb === 'help' || o.help !== undefined) { console.log(USAGE); return 0; }
  if (verb === 'status') {
    if (!o.owed) { log('status needs --owed'); return 2; }
    console.log(JSON.stringify(owedStatus(resolve(o.owed))));
    return 0;
  }
  if (verb === 'owe-mail') {
    if (!o.repo || !o.owed || !o.attempt || o.exit === undefined) { log('owe-mail needs --repo, --owed, --attempt and --exit'); return 2; }
    let report = null;
    if (o['ferry-report'] && existsSync(o['ferry-report'])) {
      try { report = JSON.parse(readFileSync(o['ferry-report'], 'utf8')); } catch { report = null; }
    }
    const decided = mailDecided(resolve(o.repo), {
      attempt: o.attempt, decidedAt: o['decided-at'] ?? new Date().toISOString(), exit: Number(o.exit),
      stage: o.stage, ferryReport: report, fetch: !o.noFetch,
    });
    const { path, fresh } = owe(resolve(o.owed), decided);
    log(`${fresh ? 'owed' : 'already owed'}: ${decided.kind} ${decided.event} (${decided.outcome.status}) → ${path}`);
    return 0;
  }
  if (verb === 'owe') {
    if (!o.owed || !o.decided) { log('owe needs --owed and --decided'); return 2; }
    const text = o.decided === '-' ? readFileSync(0, 'utf8') : readFileSync(o.decided, 'utf8');
    const decided = JSON.parse(text);
    const { path, fresh } = owe(resolve(o.owed), decided);
    log(`${fresh ? 'owed' : 'already owed'}: ${decided.kind} ${decided.event} (${decided.outcome.status}) → ${path}`);
    return 0;
  }
  if (verb === 'publish') {
    if (!o.repo || !o.owed) { log('publish needs --repo and --owed'); return 2; }
    const pem = o.key && existsSync(o.key) ? readFileSync(o.key, 'utf8') : null;
    const r = publish({
      repo: resolve(o.repo), owedDir: resolve(o.owed), privateKeyPem: pem,
      remote: o.remote ?? 'origin', branch: o.branch ?? 'main', log,
    });
    if (r.status === 'owed') { log(`${r.owed} record(s) OWED, not published: ${r.why}`); return 3; }
    if (r.status === 'nothing-owed') log('nothing owed');
    return 0;
  }
  log(`unknown verb ${JSON.stringify(verb)}\n${USAGE}`);
  return 2;
}

// Entered through a symlink, argv[1] is the link and import.meta.url the
// target: compare real paths, or the CLI does nothing and exits 0.
const isMain = (() => {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return pathToFileURL(process.argv[1]).href === import.meta.url; }
})();

if (isMain) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) {
    process.stderr.write(`[witness] ${e.message}\n`);
    process.exitCode = 1;
  }
}
