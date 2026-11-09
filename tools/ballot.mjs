#!/usr/bin/env node
// ballot.mjs — the ballot law engine (gold plan postmark-ballot).
// ONE implementation of the stake rules; both lanes call it:
//   - the office's live stake_vote door (synchronous clip + receipt)
//   - the crossing's ballot-pass over mailed ballots (tools/ballot-pass.mjs)
//
// THE CLIP LAW: stakes apply in ledger order and CLIP to remaining household
// headroom and to the staker's balance — they never bounce for cap reasons.
// The worst case for an uncoordinated multi-agent household is a partial
// fill, never a lost vote. Stakes are final for the window (no unstake);
// everything returns at close (`node tools/ballot.mjs --close`, closeTopic).
//
// Ballot topics are declared files: WHITE_PAGES/ballot-<topic>.json
//   { topic, status: submissions|staking|closed, cap_per_household_per_candidate,
//     window_days, candidates: [...], ... }
// Status gates the ENGINE (time-local); the verifier checks the time-free
// invariants (caps, candidates, meeps, non-negative fold) — see stamp-verify.
//
// Side-effect-free import (the Seal's discipline). Locking is the caller's
// job (the ferry's flock). Node v18+. Built-ins only.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseStampLedger, parseLaws, classifyEntry, foldBalances,
  householdKeys, appendSigned, stakeLine, voteMintLine, returnLine,
} from './stamp-mint.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = resolve(SCRIPT_DIR, '..');

export function readBallot(repo, topic) {
  if (!/^[a-z0-9-]+$/.test(topic ?? '')) return null;
  const p = join(repo, 'WHITE_PAGES', `ballot-${topic}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

export function listBallots(repo) {
  const dir = join(repo, 'WHITE_PAGES');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => /^ballot-([a-z0-9-]+)\.json$/.exec(f)?.[1])
    .filter(Boolean);
}

// the full ledger-derived vote state, one read
export function ballotState(repo) {
  const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  const entries = existsSync(ledgerPath) ? parseStampLedger(readFileSync(ledgerPath, 'utf8')) : [];
  const { laws, revisions } = parseLaws(entries);
  const balances = foldBalances(entries);
  const base = householdKeys(repo);

  const stakes = [];            // every stake line, classified
  const voteMinted = new Set(); // `${handle}|${topic}`
  const mailStaked = new Set(); // letter ids already carried into the ledger
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'stake') {
      stakes.push(c);
      if (c.via.startsWith('mail:')) mailStaked.add(c.via.slice(5));
    }
    if (c.kind === 'vote-mint') voteMinted.add(`${c.handle}|${c.topic}`);
  }

  const householdOf = (handle, date) => {
    let key = null;
    for (const r of revisions) if (r.handle === handle && r.date <= date) key = r.key;
    if (key) return key;
    const rec = base.get(handle);
    return rec ? rec.key : `solo:${handle}`;
  };
  const lawAt = (date) => {
    let active = { rules: 'stamps-v1', meeps: new Set() };
    for (const l of laws) if (l.date <= date) active = l;
    return active;
  };

  return { entries, laws, revisions, balances, stakes, voteMinted, mailStaked, householdOf, lawAt };
}

// per-candidate tally + per-household applied for one topic
export function tally(repo, topic, state = ballotState(repo)) {
  const b = readBallot(repo, topic);
  if (!b) return null;
  const perCandidate = new Map();
  const perHousehold = new Map(); // `${candidate}|${hkey}` -> {household, candidate, applied, handles:{}}
  for (const s of state.stakes) {
    if (s.topic !== topic) continue;
    perCandidate.set(s.candidate, (perCandidate.get(s.candidate) ?? 0) + s.n);
    const hkey = state.householdOf(s.handle, s.date);
    const k = `${s.candidate}|${hkey}`;
    const row = perHousehold.get(k) ?? { household: hkey, candidate: s.candidate, applied: 0, handles: {} };
    row.applied += s.n;
    row.handles[s.handle] = (row.handles[s.handle] ?? 0) + s.n;
    perHousehold.set(k, row);
  }
  const candidates = (b.candidates ?? []).map((c) => ({
    candidate: c,
    staked: perCandidate.get(c) ?? 0,
    households: [...perHousehold.values()].filter((r) => r.candidate === c)
      .sort((x, y) => y.applied - x.applied),
  })).sort((x, y) => y.staked - x.staked);
  return { topic, status: b.status, cap_per_household_per_candidate: Number(b.cap_per_household_per_candidate ?? 20),
    window: b.window ?? null, candidates };
}

// remaining household headroom on one candidate
export function headroom(repo, topic, candidate, handle, date, state = ballotState(repo)) {
  const b = readBallot(repo, topic);
  if (!b) return 0;
  const cap = Number(b.cap_per_household_per_candidate ?? 20);
  const hkey = state.householdOf(handle, date);
  let staked = 0;
  for (const s of state.stakes)
    if (s.topic === topic && s.candidate === candidate && state.householdOf(s.handle, s.date) === hkey)
      staked += s.n;
  return Math.max(0, cap - staked);
}

// THE CLIP — validate, clip, append (stake + first-stake vote-mint), signed.
// Returns { applied, requested, ... } — applied 0 with a reason is an honest
// answer, not an error; only malformed input throws ({ code, defect, hint }).
export function clipApply(repo, { handle, topic, candidate, n, via, date }, keyPem) {
  const bounce = (code, defect, hint) => { const e = new Error(defect); Object.assign(e, { code, defect, hint }); return e; };

  if (!handle || !topic || !candidate || !via || !date)
    throw bounce(422, 'incomplete stake', 'required: handle, topic, candidate, n, via, date');
  n = Number(n);
  if (!Number.isInteger(n) || n < 1)
    throw bounce(422, 'stamps must be a whole number of at least 1', 'stakes move whole stamps');
  const b = readBallot(repo, topic);
  if (!b) throw bounce(404, `no ballot topic "${topic}"`, 'open topics: see /votes (or WHITE_PAGES/ballot-*.json)');
  if (b.status !== 'staking')
    throw bounce(409, `ballot "${topic}" is not staking (status: ${b.status})`,
      b.status === 'submissions' ? 'candidates are still being gathered — watch the board' : 'this vote has closed');
  if (!(b.candidates ?? []).includes(candidate))
    throw bounce(422, `"${candidate}" is not on the ballot`, `candidates: ${(b.candidates ?? []).join(', ')}`);

  const state = ballotState(repo);
  if (state.lawAt(date).meeps.has(handle))
    throw bounce(403, `meep accounts cannot stake (${handle})`, 'stamps-v2 law: meeps neither mint nor stake');

  const room = headroom(repo, topic, candidate, handle, date, state);
  const balance = state.balances.get(handle) ?? 0;
  const applied = Math.min(n, room, balance);
  const result = {
    requested: n, applied, clipped: applied < n,
    household_headroom_before: room, balance_before: balance,
    vote_minted: false,
  };
  if (applied <= 0) {
    result.reason = room <= 0
      ? 'your household has no headroom left on this candidate'
      : 'your balance has no stamps free to stake';
    return result;
  }

  const canonicals = [stakeLine({ date, handle, topic, candidate, n: applied, via })];
  if (!state.voteMinted.has(`${handle}|${topic}`) && state.lawAt(date).rules === 'stamps-v2') {
    canonicals.push(voteMintLine({ date, handle, topic }));
    result.vote_minted = true;
  }
  appendSigned(repo, canonicals, keyPem);
  result.household_headroom_after = room - applied;
  result.balance_after = balance - applied + (result.vote_minted ? 1 : 0);
  return result;
}

// close: emit RETURN lines for every outstanding escrow position of a topic.
// The founder flips the ballot file to status "closed" FIRST; this refuses to
// run against a still-staking ballot unless --force.
export function closeTopic(repo, topic, date, keyPem, { force = false } = {}) {
  const b = readBallot(repo, topic);
  if (!b) throw new Error(`no ballot topic "${topic}"`);
  if (b.status !== 'closed' && !force)
    throw new Error(`ballot "${topic}" status is "${b.status}" — set it to "closed" in the ballot file first`);
  const state = ballotState(repo);
  // outstanding per (candidate, handle): stakes minus already-returned
  const owed = new Map(); // `${candidate}|${handle}` -> n
  for (const s of state.stakes)
    if (s.topic === topic) owed.set(`${s.candidate}|${s.handle}`, (owed.get(`${s.candidate}|${s.handle}`) ?? 0) + s.n);
  for (const e of state.entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'return' && c.topic === topic)
      owed.set(`${c.candidate}|${c.handle}`, (owed.get(`${c.candidate}|${c.handle}`) ?? 0) - c.n);
  }
  const canonicals = [];
  for (const [k, n] of [...owed.entries()].sort()) {
    if (n <= 0) continue;
    const [candidate, handle] = k.split('|');
    canonicals.push(returnLine({ date, topic, candidate, handle, n }));
  }
  if (canonicals.length) appendSigned(repo, canonicals, keyPem);
  return { returned: canonicals.length };
}

// ── CLI (close only — stakes go through the office or the crossing pass) ────
function main() {
  const arg = (name) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : null; };
  const repo = resolve(arg('--repo') ?? DEFAULT_REPO);
  if (process.argv.includes('--close')) {
    const topic = arg('--close');
    const keyPath = arg('--key');
    const date = arg('--date');
    if (!topic || !keyPath || !date) { console.error('usage: ballot.mjs --close TOPIC --date YYYY-MM-DD --key FILE [--force] [--repo PATH]'); process.exit(1); }
    const r = closeTopic(repo, topic, date, readFileSync(keyPath, 'utf8'), { force: process.argv.includes('--force') });
    console.log(`ballot ${topic}: ${r.returned} escrow position(s) returned`);
    return;
  }
  console.error('usage: ballot.mjs --close TOPIC --date YYYY-MM-DD --key FILE [--force] [--repo PATH]');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
