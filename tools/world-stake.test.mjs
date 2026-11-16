// world-stake.test.mjs — the world-mark stake conformance corpus (write-release P3).
//   node --test tools/world-stake.test.mjs
//
// claude-of-dregg's mint review made this a HARD build requirement, and named the
// reason: conservation is untypeable, so ship a CORPUS of lawful and unlawful lines
// with a verifier that judges them, not a canonical-line grammar that claims to.
// Three layers, in the order a defect would reach a resident:
//
//   1. GRAMMAR   — what classifies, and (more importantly) what must NOT. An
//                  unrecognised line falls to `unknown`, which the verifier
//                  refuses: the class fails CLOSED.
//   2. FOLDS     — escrow, positions, and the three-tenses invariant
//                  (assets = liquid + staked) that a world stake must not break.
//   3. LAWFULNESS — the real verifier over a real signed synthetic town, including
//                  the ownership hole the generic non-negative fold cannot see.
//
// Synthetic towns in tmpdir, test-generated keypairs. The real ledger is never
// touched; nothing here needs the office pen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import {
  classifyEntry, parseStampLedger, foldBalances, foldStaked, foldMintCount,
  foldWorldMarkEscrow, foldWorldMarkPositions,
  worldStakeLine, worldUnstakeLine, stakeLine, mintLine, transferLine,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';
import {
  worldStakeApply, worldUnstakeApply, worldStakeState,
  markEscrow, markPosition, retirementBlocked, MARK_ID_RE,
  deriveWorldMarkWeights, worldWeightDial, DEFAULT_UNIQUE_HOUSEHOLD_BONUS,
} from './world-stake.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const E = (...canon) => canon.map((c) => ({ canonical: c }));
const MARK = 'wright/the-crossing-bench';
const MARK2 = 'the-town/the-quay-reach';

// ─────────────────────────── 1. GRAMMAR CONFORMANCE ─────────────────────────

// LAWFUL SHAPES — each must classify as the named kind with the named fields.
const LAWFUL = [
  {
    why: 'a plain api stake',
    line: '- 2026-07-27 · wright → stake:world-mark/wright/the-crossing-bench · 3 · via: api',
    kind: 'world-stake', fields: { handle: 'wright', mark: MARK, n: 3, via: 'api' },
  },
  {
    why: 'a stake carried by a letter — the case that would fold as a TRANSFER if the classify order were wrong',
    line: '- 2026-07-27 · rei → stake:world-mark/wright/the-crossing-bench · 1 · via: mail:abc-123',
    kind: 'world-stake', fields: { handle: 'rei', mark: MARK, n: 1, via: 'mail:abc-123' },
  },
  {
    why: 'a multi-digit amount on a numeric-containing household',
    line: '- 2026-07-27 · sol-of-garrison → stake:world-mark/the-town/pando-peak · 12 · via: api',
    kind: 'world-stake', fields: { handle: 'sol-of-garrison', mark: 'the-town/pando-peak', n: 12, via: 'api' },
  },
  {
    why: 'a resident-initiated unstake',
    line: '- 2026-07-28 · stake:world-mark/wright/the-crossing-bench → wright · 3 · for: unstake',
    kind: 'world-unstake', fields: { handle: 'wright', mark: MARK, n: 3 },
  },
];

// MALFORMED / OUT-OF-CLASS — each must NOT classify as a world-stake or
// world-unstake. `unknown` is the fail-closed answer; a line that reads as some
// OTHER lawful kind is named, because that is the dangerous case (silent
// misclassification moves stamps somewhere nobody asked for).
const REFUSED = [
  { why: 'capitals in the mark id (ids are lowercase kebab)',
    line: '- 2026-07-27 · wright → stake:world-mark/Wright/the-crossing-bench · 3 · via: api', expect: 'unknown' },
  { why: 'no slash — a mark id is always <by>/<slug>',
    line: '- 2026-07-27 · wright → stake:world-mark/thebench · 3 · via: api', expect: 'unknown' },
  { why: 'two slashes in the id — deeper paths are not mark ids',
    line: '- 2026-07-27 · wright → stake:world-mark/a/b/c · 3 · via: api', expect: 'unknown' },
  { why: 'empty mark id',
    line: '- 2026-07-27 · wright → stake:world-mark/ · 3 · via: api', expect: 'unknown' },
  { why: 'missing via:',
    line: '- 2026-07-27 · wright → stake:world-mark/wright/the-crossing-bench · 3', expect: 'unknown' },
  { why: 'zero stamps',
    line: '- 2026-07-27 · wright → stake:world-mark/wright/the-crossing-bench · 0 · via: api', expect: 'unknown' },
  { why: 'a negative amount is not even movement-shaped',
    line: '- 2026-07-27 · wright → stake:world-mark/wright/the-crossing-bench · -3 · via: api', expect: 'unknown' },
  { why: 'a fractional amount',
    line: '- 2026-07-27 · wright → stake:world-mark/wright/the-crossing-bench · 1.5 · via: api', expect: 'unknown' },
  { why: 'a bad date',
    line: '- 26-07-27 · wright → stake:world-mark/wright/the-crossing-bench · 3 · via: api', expect: 'unknown' },
  { why: 'the ballot closer on a world mark — `for: close` is the founder closing a window, not a resident unstaking',
    line: '- 2026-07-28 · stake:world-mark/wright/the-crossing-bench → wright · 3 · for: close', expect: 'unknown' },
  { why: 'the reserved topic on the RETURN side too — a slash-free "id" must not read as a vote return',
    line: '- 2026-07-28 · stake:world-mark/thebench → wright · 3 · for: close', expect: 'unknown' },
  { why: 'an unstake with no closer',
    line: '- 2026-07-28 · stake:world-mark/wright/the-crossing-bench → wright · 3', expect: 'unknown' },
  { why: 'trailing junk after the tail',
    line: '- 2026-07-27 · wright → stake:world-mark/wright/the-crossing-bench · 3 · via: api · extra', expect: 'unknown' },
];

test('grammar: every lawful shape classifies with the fields the door will read', () => {
  for (const c of LAWFUL) {
    const got = classifyEntry(c.line);
    assert.equal(got.kind, c.kind, `${c.why}\n  line: ${c.line}\n  got kind: ${got.kind}`);
    for (const [k, v] of Object.entries(c.fields))
      assert.equal(got[k], v, `${c.why} — field ${k}`);
  }
});

test('grammar: malformed and out-of-class lines FAIL CLOSED (never a world stake)', () => {
  for (const c of REFUSED) {
    const got = classifyEntry(c.line);
    assert.notEqual(got.kind, 'world-stake', `${c.why}\n  line: ${c.line}`);
    assert.notEqual(got.kind, 'world-unstake', `${c.why}\n  line: ${c.line}`);
    assert.equal(got.kind, c.expect, `${c.why}\n  line: ${c.line}\n  expected ${c.expect}, got ${got.kind}`);
  }
});

test('grammar: the new class does not shadow the ballot or the transfer lane', () => {
  // a vote stake still classifies as a vote stake, capitals and all
  const vote = classifyEntry(stakeLine({ date: '2026-07-19', handle: 'wright', topic: 'name-vote', candidate: 'Aurelia', n: 2, via: 'api' }));
  assert.equal(vote.kind, 'stake');
  assert.equal(vote.candidate, 'Aurelia');
  // a real transfer still classifies as a transfer
  const t = classifyEntry(transferLine({ date: '2026-07-20', from: 'wright', to: 'rei', n: 2, id: 'ltr-9' }));
  assert.equal(t.kind, 'transfer');
  // and the ORDER law: a mail-carried world stake is a stake, not a payment to an
  // account that happens to be spelled `stake:world-mark/...`
  const carried = classifyEntry(worldStakeLine({ date: '2026-07-27', handle: 'rei', mark: MARK, n: 1, via: 'mail:x' }));
  assert.equal(carried.kind, 'world-stake', 'classify order regression: this fell through to transfer');
});

test('grammar: the builders round-trip through the parser', () => {
  const s = worldStakeLine({ date: '2026-07-27', handle: 'wright', mark: MARK, n: 4, via: 'api' });
  const u = worldUnstakeLine({ date: '2026-07-28', mark: MARK, handle: 'wright', n: 4 });
  assert.deepEqual(
    { ...classifyEntry(s) },
    { kind: 'world-stake', date: '2026-07-27', handle: 'wright', mark: MARK, n: 4, via: 'api' },
  );
  assert.deepEqual(
    { ...classifyEntry(u) },
    { kind: 'world-unstake', date: '2026-07-28', mark: MARK, handle: 'wright', n: 4 },
  );
});

test('MARK_ID_RE agrees with the grammar it guards', () => {
  assert.ok(MARK_ID_RE.test('wright/the-crossing-bench'));
  assert.ok(MARK_ID_RE.test('the-town/pando-peak'));
  for (const bad of ['Wright/bench', 'thebench', 'a/b/c', '/bench', 'wright/', '-a/b', 'wright/ bench'])
    assert.ok(!MARK_ID_RE.test(bad), `${bad} should be refused`);
});

// ───────────────────────────── 2. FOLD CONFORMANCE ──────────────────────────

test('escrow fold: a mark carries the sum of its open stakes, and absent == zero', () => {
  const entries = E(
    worldStakeLine({ date: '2026-07-27', handle: 'wright', mark: MARK, n: 3, via: 'api' }),
    worldStakeLine({ date: '2026-07-27', handle: 'rei', mark: MARK, n: 2, via: 'api' }),
    worldStakeLine({ date: '2026-07-27', handle: 'rei', mark: MARK2, n: 5, via: 'api' }),
  );
  const esc = foldWorldMarkEscrow(entries);
  assert.equal(esc.get(MARK), 5, 'two residents, one mark');
  assert.equal(esc.get(MARK2), 5);
  assert.equal(esc.has('nobody/nothing'), false, 'a mark with no stake never appears');
});

test('escrow fold: unstaking to zero REMOVES the mark (one representation of nothing)', () => {
  const entries = E(
    worldStakeLine({ date: '2026-07-27', handle: 'wright', mark: MARK, n: 3, via: 'api' }),
    worldUnstakeLine({ date: '2026-07-28', mark: MARK, handle: 'wright', n: 3 }),
  );
  const esc = foldWorldMarkEscrow(entries);
  assert.equal(esc.has(MARK), false, 'zero escrow must not linger as an explicit 0');
  assert.equal(esc.get(MARK) ?? 0, 0);
});

test('position fold: escrow is tracked per (mark, handle), not just per mark', () => {
  const entries = E(
    worldStakeLine({ date: '2026-07-27', handle: 'wright', mark: MARK, n: 3, via: 'api' }),
    worldStakeLine({ date: '2026-07-27', handle: 'rei', mark: MARK, n: 2, via: 'api' }),
    worldUnstakeLine({ date: '2026-07-28', mark: MARK, handle: 'wright', n: 1 }),
  );
  const pos = foldWorldMarkPositions(entries);
  assert.equal(pos.get(`${MARK}|wright`), 2);
  assert.equal(pos.get(`${MARK}|rei`), 2);
  assert.equal(foldWorldMarkEscrow(entries).get(MARK), 4, 'the mark total is the sum of the positions');
});

test('three tenses hold across a world stake: assets = liquid + staked', () => {
  // This is the invariant that breaks SILENTLY if foldStaked forgets the new kinds:
  // foldBalances moves the stamps out of liquid whether or not `staked` counts them.
  const entries = E(
    mintLine({ date: '2026-07-01', handle: 'wright', cause: 'l1', side: 'sent' }),
    mintLine({ date: '2026-07-01', handle: 'wright', cause: 'l2', side: 'sent' }),
    mintLine({ date: '2026-07-01', handle: 'wright', cause: 'l3', side: 'sent' }),
    worldStakeLine({ date: '2026-07-27', handle: 'wright', mark: MARK, n: 2, via: 'api' }),
  );
  const liquid = foldBalances(entries).get('wright') ?? 0;
  const staked = foldStaked(entries).get('wright') ?? 0;
  const minted = foldMintCount(entries).get('wright') ?? 0;
  assert.equal(liquid, 1, 'two of three stamps went into escrow');
  assert.equal(staked, 2, 'a world stake counts as staked — not only as missing from liquid');
  assert.equal(liquid + staked, minted, 'assets = liquid + staked');
});

test('three tenses hold after the unstake returns the stamps', () => {
  const entries = E(
    mintLine({ date: '2026-07-01', handle: 'wright', cause: 'l1', side: 'sent' }),
    mintLine({ date: '2026-07-01', handle: 'wright', cause: 'l2', side: 'sent' }),
    worldStakeLine({ date: '2026-07-27', handle: 'wright', mark: MARK, n: 2, via: 'api' }),
    worldUnstakeLine({ date: '2026-07-28', mark: MARK, handle: 'wright', n: 2 }),
  );
  assert.equal(foldBalances(entries).get('wright'), 2, 'liquid restored');
  assert.equal(foldStaked(entries).get('wright'), 0, 'nothing left staked');
  assert.equal(foldBalances(entries).get(`stake:world-mark/${MARK}`), 0, 'the escrow account is emptied, not orphaned');
});

test('conservation: a world stake moves stamps without creating or destroying any', () => {
  const entries = E(
    mintLine({ date: '2026-07-01', handle: 'wright', cause: 'l1', side: 'sent' }),
    worldStakeLine({ date: '2026-07-27', handle: 'wright', mark: MARK, n: 1, via: 'api' }),
  );
  const bal = foldBalances(entries);
  const sum = [...bal.values()].reduce((a, b) => a + b, 0);
  assert.equal(sum, 0, 'every line is a movement; the whole fold sums to zero');
});

// ─────────────────────── 3. LAWFULNESS (the real verifier) ───────────────────

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ type: 'spki', format: 'pem' }),
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}
const D = (date, id, from, to) => `- ${date} · ${id} · ${from} → ${to} · thread: new`;

// wright+rei share a household (5 stamps each), dot is solo (2), meepy is a meep
function stakeTown(pub, priv) {
  const repo = mkdtempSync(join(tmpdir(), 'world-stake-town-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'),
    JSON.stringify({ wright: { login: 'k', id: 7 }, rei: { login: 'k', id: 7 } }));
  const lines = [];
  for (let i = 1; i <= 5; i++) lines.push(D('2026-06-12', `w-${i}`, 'wright', `f-${i}`));
  for (let i = 1; i <= 5; i++) lines.push(D('2026-06-13', `r-${i}`, 'rei', `f-${i}`));
  lines.push(D('2026-06-12', 'q-1', 'dot', 'f-1'));
  lines.push(D('2026-06-13', 'q-2', 'dot', 'f-2'));
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `# ledger\n\n${lines.join('\n')}\n`);
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--declare-rules', 'stamps-v2',
    '--meeps', 'meepy', '--date', '2026-06-20', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  return repo;
}

// append raw canonical lines with a valid seal chain — for corpus cases the engine
// would refuse to write, so the VERIFIER is the thing under test
function forceAppend(repo, priv, canonicals) {
  const { appendSigned } = require_mint();
  appendSigned(repo, canonicals, priv);
}
function require_mint() { return mintMod; }
let mintMod;
test('load the mint module for raw appends', async () => { mintMod = await import('./stamp-mint.mjs'); });

test('lawful: self-stake then unstake round-trips and the ledger verifies green', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    const r1 = worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 3, via: 'api', date: '2026-06-21' }, priv);
    assert.equal(r1.applied, 3);
    assert.equal(r1.mark_escrow_after, 3);
    assert.equal(markEscrow(repo, MARK), 3, 'the mark now carries 3 stamps of raw escrow');

    const v1 = verifyStampLedger(repo);
    assert.equal(v1.ok, true, v1.problems.join('; '));

    const r2 = worldUnstakeApply(repo, { handle: 'wright', mark: MARK, n: 3, date: '2026-06-22' }, priv);
    assert.equal(r2.applied, 3);
    assert.equal(markEscrow(repo, MARK), 0);

    const v2 = verifyStampLedger(repo);
    assert.equal(v2.ok, true, v2.problems.join('; '));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('lawful: two residents on one mark; each may only unstake their own', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 3, via: 'api', date: '2026-06-21' }, priv);
    worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
    assert.equal(markEscrow(repo, MARK), 5);
    assert.equal(markPosition(repo, MARK, 'wright'), 3);
    assert.equal(markPosition(repo, MARK, 'dot'), 2);

    // dot asks for 5 — the mark HAS 5, but only 2 are dot's. Clipped to 2.
    const r = worldUnstakeApply(repo, { handle: 'dot', mark: MARK, n: 5, date: '2026-06-22' }, priv);
    assert.equal(r.applied, 2, 'clipped to dot\'s own position, not the mark total');
    assert.equal(r.clipped, true);
    assert.equal(markEscrow(repo, MARK), 3, "wright's stake is untouched");
    assert.equal(verifyStampLedger(repo).ok, true);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('UNLAWFUL: a forged unstake of another resident\'s stamps is REFUSED by the verifier', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 3, via: 'api', date: '2026-06-21' }, priv);
    worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
    // The hole the generic fold cannot see: dot takes 5 from a mark holding 5.
    // Every ACCOUNT stays non-negative — only the per-(mark,handle) law catches it.
    mintMod.appendSigned(repo, [worldUnstakeLine({ date: '2026-06-22', mark: MARK, handle: 'dot', n: 5 })], priv);
    const v = verifyStampLedger(repo);
    assert.equal(v.ok, false, 'the verifier must refuse an unstake beyond the staker\'s own position');
    assert.match(v.problems.join(' '), /holds only 2/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('lawful: there is no household cap on a world mark', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    // The draft proposed 20; the build-gate ruling reversed it. A 25-stamp
    // self-stake is lawful when the resident actually holds the stamps.
    const over = 25;
    mintMod.appendSigned(repo, [
      `- 2026-06-21 · MINT → wright · ${over} · for: gift:test-float · by: keemin`,
      worldStakeLine({ date: '2026-06-21', handle: 'wright', mark: MARK, n: over, via: 'api' }),
    ], priv);
    const v = verifyStampLedger(repo);
    assert.equal(v.ok, true, v.problems.join('; '));
    assert.equal(markEscrow(repo, MARK), over);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('UNLAWFUL: a meep staking on a mark is REFUSED by the verifier and by the engine', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    assert.throws(() => worldStakeApply(repo, { handle: 'meepy', mark: MARK, n: 1, via: 'api', date: '2026-06-21' }, priv),
      /meep accounts cannot stake/);
    // No gift-float to meepy here: a MINT to a meep is itself unlawful, so the
    // verifier would stop on THAT line and never reach the stake — the meep law is
    // load-bearing at two points and this case must exercise the staking one.
    // meepy holds nothing, so the meep branch has to fire BEFORE the overdraw fold,
    // which is exactly the ordering the branch relies on.
    mintMod.appendSigned(repo, [worldStakeLine({ date: '2026-06-21', handle: 'meepy', mark: MARK, n: 1, via: 'api' })], priv);
    const v = verifyStampLedger(repo);
    assert.equal(v.ok, false);
    assert.match(v.problems.join(' '), /meep "meepy" cannot stake/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('UNLAWFUL: staking past your balance overdraws — caught by the generic fold, no new law needed', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    // dot holds 2; force a 3-stamp stake
    mintMod.appendSigned(repo, [worldStakeLine({ date: '2026-06-21', handle: 'dot', mark: MARK, n: 3, via: 'api' })], priv);
    const v = verifyStampLedger(repo);
    assert.equal(v.ok, false);
    assert.match(v.problems.join(' '), /overdrawn/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('the CLIP: a stake clips only to liquid balance, never to a household cap', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    // wright asks 9 and holds 5; the only clipping dimension is his balance.
    const r = worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 9, via: 'api', date: '2026-06-21' }, priv);
    assert.equal(r.applied, 5, 'clipped to the balance');
    assert.equal(r.clipped, true);
    assert.equal(r.balance_after, 0);
    assert.equal(verifyStampLedger(repo).ok, true, 'a clipped stake is still a lawful ledger');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('the CLIP: an unstake with no position is an honest zero, not an error', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    const r = worldUnstakeApply(repo, { handle: 'dot', mark: MARK, n: 2, date: '2026-06-21' }, priv);
    assert.equal(r.applied, 0);
    assert.match(r.reason, /no stamps staked/);
    assert.equal(verifyStampLedger(repo).ok, true, 'nothing was written');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('malformed input THROWS rather than clipping to nothing', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    assert.throws(() => worldStakeApply(repo, { handle: 'wright', mark: 'Not/A/Mark', n: 1, via: 'api', date: '2026-06-21' }, priv), /is not a mark id/);
    assert.throws(() => worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 0, via: 'api', date: '2026-06-21' }, priv), /whole number/);
    assert.throws(() => worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 1, via: 'api' }, priv), /incomplete stake/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

// ─────────────────────── THE RETIREMENT GATE (Keemin's rule) ─────────────────

test('retirement gate: a mark with stamps on it cannot retire; at zero it can', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    assert.equal(retirementBlocked(repo, MARK).blocked, false, 'an unstaked mark is free to retire');

    worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
    const g = retirementBlocked(repo, MARK);
    assert.equal(g.blocked, true);
    assert.equal(g.escrow, 2);
    assert.match(g.reason, /cannot retire/);

    worldUnstakeApply(repo, { handle: 'wright', mark: MARK, n: 2, date: '2026-06-22' }, priv);
    assert.equal(retirementBlocked(repo, MARK).blocked, false, 'the anchor is released with the last stamp');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('weight derive: fallback k=5 and identity pins produce Σ + k·H', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 3, via: 'api', date: '2026-06-21' }, priv);
    worldStakeApply(repo, { handle: 'rei', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
    worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);

    const dial = worldWeightDial(repo);
    assert.deepEqual(dial, { k: DEFAULT_UNIQUE_HOUSEHOLD_BONUS, source: 'fallback' },
      'the synthetic town has no ECONOMY-DIALS.json, so this proves the required fallback path');

    const derived = deriveWorldMarkWeights(repo);
    const mark = derived.marks.find((row) => row.mark === MARK);
    assert.deepEqual(mark, { mark: MARK, escrow: 7, households: 2, households_external: 1, weight: 12 },
      'wright+rei share one pinned GitHub household — and it is the MARK AUTHOR\'S own, so it earns no k; '
      + 'dot is the only external household: 7 + 5×1 = 12');
    assert.equal(derived.rows.filter((row) => row.mark === MARK).reduce((sum, row) => sum + row.n, 0), 7);
    assert.equal(derived.rows.filter((row) => row.mark === MARK).reduce((sum, row) => sum + row.weight, 0), 12);

    const cliRows = JSON.parse(execFileSync(process.execPath,
      [join(HERE, 'world-stake.mjs'), '--escrow', '--json', '--repo', repo], { encoding: 'utf8' }));
    assert.deepEqual(cliRows, derived.rows, 'the actual --escrow --json seam emits the proved derive');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('weight derive: ECONOMY-DIALS.json overrides the fallback k', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    writeFileSync(join(repo, 'ECONOMY-DIALS.json'), JSON.stringify({
      read_side: { weight: { k_unique_household_bonus: 7 } },
      law_side: { world_stake: { household_cap_per_mark: null } },
    }));
    worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 3, via: 'api', date: '2026-06-21' }, priv);
    worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
    assert.deepEqual(worldWeightDial(repo), { k: 7, source: 'ECONOMY-DIALS.json' });
    assert.deepEqual(deriveWorldMarkWeights(repo).marks[0],
      { mark: MARK, escrow: 5, households: 2, households_external: 1, weight: 12 },
      '5 + 7×1 = 12 — wright is the mark author\'s own household, so only dot earns k');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

// Keemin's ruling 2026-08-05. k is the breadth term; a household wanting its own
// mark is not breadth. The rule that had no test before this one is exactly the
// rule that had been quietly paying every author +k for caring about their own
// work — 11 of the 12 marks carrying escrow the day it changed.
test('weight derive: k is EXTERNAL-only — a mark backed solely by its own household earns no bonus', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    // MARK is `wright/…`; wright and rei share the author's pinned household.
    worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 3, via: 'api', date: '2026-06-21' }, priv);
    worldStakeApply(repo, { handle: 'rei', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);

    const solo = deriveWorldMarkWeights(repo).marks.find((row) => row.mark === MARK);
    assert.deepEqual(solo, { mark: MARK, escrow: 5, households: 1, households_external: 0, weight: 5 },
      'you may back your own mark; you may not be your own crowd — raw escrow stands, k×0');

    // Self-stake is still free, still counts, still anchors against retirement.
    assert.equal(retirementBlocked(repo, MARK).blocked, true,
      'withholding the BONUS must not weaken the existence-anchor');

    // One outside household turns the bonus on, exactly once.
    worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 1, via: 'api', date: '2026-06-22' }, priv);
    const derived = deriveWorldMarkWeights(repo);
    const withOutsider = derived.marks.find((row) => row.mark === MARK);
    assert.equal(withOutsider.households_external, 1, 'dot is external; wright+rei are not');
    assert.equal(withOutsider.weight, 6 + DEFAULT_UNIQUE_HOUSEHOLD_BONUS, '6 + 5×1');

    // The row-sum invariant is load-bearing: the office reads row.weight.
    assert.equal(
      derived.rows.filter((row) => row.mark === MARK).reduce((sum, row) => sum + row.weight, 0),
      withOutsider.weight,
      'summing a mark\'s rows still yields its weight');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('the escrow account never goes negative across a full life of one mark', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 3, via: 'api', date: '2026-06-21' }, priv);
    worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
    worldUnstakeApply(repo, { handle: 'wright', mark: MARK, n: 1, date: '2026-06-22' }, priv);
    worldUnstakeApply(repo, { handle: 'dot', mark: MARK, n: 2, date: '2026-06-23' }, priv);
    worldUnstakeApply(repo, { handle: 'wright', mark: MARK, n: 2, date: '2026-06-24' }, priv);
    const bal = foldBalances(parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8')));
    assert.equal(bal.get(`stake:world-mark/${MARK}`), 0);
    assert.equal(markEscrow(repo, MARK), 0);
    assert.equal(verifyStampLedger(repo).ok, true);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
