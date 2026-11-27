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
  worldTownReturnLine, returnLine, postReturnLine, potReturnLine,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';
import {
  worldStakeApply, worldUnstakeApply, worldStakeState,
  markEscrow, markPosition, retirementBlocked, MARK_ID_RE,
  deriveWorldMarkWeights, worldWeightDial, DEFAULT_UNIQUE_HOUSEHOLD_BONUS,
  worldTownReturnPlan, worldTownReturnApply,
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

// ─────────────── 4. THE TOWN'S RETURN ON A REMOVED MARK (POS-1139) ───────────
// Darko 2026-11-18 16:3x: "Town-authored return"; earlier, "Back to each
// staker", owner included. The town's act, recorded as the town's, paying each
// actual staker their own whole remaining principal and nothing else. The same
// three layers: grammar, folds, and the real verifier over a signed town.

const ledgerOf = (repo) => readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
const balanceOf = (repo, handle) => foldBalances(parseStampLedger(ledgerOf(repo))).get(handle) ?? 0;
const TR = (handle, n, removal = 'S172', mark = MARK) => worldTownReturnLine({ date: '2026-06-25', mark, handle, n, removal });

test('town return grammar: the lawful line classifies as the town\'s act, with the removal named', () => {
  const line = '- 2026-06-25 · stake:world-mark/wright/the-crossing-bench → dot · 2 · for: town-return:S172';
  assert.equal(TR('dot', 2), line, 'the builder writes exactly the grammar');
  assert.deepEqual(classifyEntry(line), { kind: 'world-town-return', date: '2026-06-25', mark: MARK, handle: 'dot', n: 2, removal: 'S172' });
  // the resident's own way out is still the resident's, and every sibling return keeps its kind
  assert.equal(classifyEntry(worldUnstakeLine({ date: '2026-06-25', mark: MARK, handle: 'dot', n: 2 })).kind, 'world-unstake');
  assert.equal(classifyEntry(returnLine({ date: '2026-06-25', topic: 'name-vote', candidate: 'Iris', handle: 'dot', n: 2 })).kind, 'return');
  assert.equal(classifyEntry(postReturnLine({ date: '2026-06-25', post: 'alice/a-post', handle: 'dot', n: 2 })).kind, 'post-return');
  assert.equal(classifyEntry(potReturnLine({ date: '2026-06-25', pot: 'darko', handle: 'dot', n: 2, epoch: '2026-06' })).kind, 'pot-return');
});

test('town return grammar: malformed and out-of-class lines FAIL CLOSED, and no other grammar absorbs them', () => {
  const W = 'stake:world-mark/wright/the-crossing-bench';
  const refused = [
    [`- 2026-06-25 · ${W} → dot · 2 · for: town-return:S0`, 'settlement zero'],
    [`- 2026-06-25 · ${W} → dot · 2 · for: town-return:S01`, 'a leading zero'],
    [`- 2026-06-25 · ${W} → dot · 2 · for: town-return:172`, 'no S'],
    [`- 2026-06-25 · ${W} → dot · 2 · for: town-return:s172`, 'a lowercase s'],
    [`- 2026-06-25 · ${W} → dot · 2 · for: town-return:`, 'no removal'],
    [`- 2026-06-25 · ${W} → dot · 2 · for: town-return`, 'no removal, no colon'],
    [`- 2026-06-25 · ${W} → dot · 2 · for: town-return:S172 · by: wright`, 'trailing fields'],
    [`- 2026-06-25 · ${W} → dot · 2 · for: town-return:S172 · via: mail:abc`, 'a letter tail'],
    [`- 2026-06-25 · ${W} → dot · 0 · for: town-return:S172`, 'zero stamps'],
    [`- 2026-06-25 · ${W} → dot · -2 · for: town-return:S172`, 'a negative amount'],
    [`- 2026-06-25 · ${W} → dot · 1.5 · for: town-return:S172`, 'a fractional amount'],
    [`- 26-06-25 · ${W} → dot · 2 · for: town-return:S172`, 'a bad date'],
    ['- 2026-06-25 · stake:world-mark/Wright/the-crossing-bench → dot · 2 · for: town-return:S172', 'capitals in the mark id'],
    ['- 2026-06-25 · stake:world-mark/thebench → dot · 2 · for: town-return:S172', 'a slash-free mark id'],
    ['- 2026-06-25 · stake:world-mark/a/b/c → dot · 2 · for: town-return:S172', 'a deeper path'],
    ['- 2026-06-25 · stake:name-vote/Iris → dot · 2 · for: town-return:S172', 'a ballot topic'],
    ['- 2026-06-25 · stake:post/alice/a-post → dot · 2 · for: town-return:S172', 'a post'],
    ['- 2026-06-25 · stake:pot/darko → dot · 2 · for: town-return:S172', 'a pot'],
    [`- 2026-06-25 · dot → ${W} · 2 · for: town-return:S172`, 'the arrow reversed'],
  ];
  for (const [line, why] of refused)
    assert.equal(classifyEntry(line).kind, 'unknown', `${why}\n  line: ${line}\n  got: ${classifyEntry(line).kind}`);
});

test('town return builder refuses what would misfile or forge the line', () => {
  const ok = { date: '2026-06-25', mark: MARK, handle: 'dot', n: 2, removal: 'S172' };
  for (const [bad, re] of [
    [{ n: 0 }, /whole number/], [{ n: -2 }, /whole number/], [{ n: 1.5 }, /whole number/], [{ n: '2' }, /whole number/],
    [{ removal: 'S0' }, /S<n>/], [{ removal: '172' }, /S<n>/], [{ removal: 'S1 · by: x' }, /S<n>/], [{ removal: undefined }, /S<n>/],
    [{ mark: 'Wright/x' }, /mark id/], [{ mark: 'thebench' }, /mark id/],
    [{ handle: 'dot · 9' }, /plain handle/], [{ handle: 'a b' }, /plain handle/], [{ handle: 'stake:world-mark/a/b' }, /plain handle/],
    [{ date: '26-06-25' }, /YYYY-MM-DD/],
  ]) assert.throws(() => worldTownReturnLine({ ...ok, ...bad }), re, JSON.stringify(bad));
});

test('town return folds: escrow, positions and the staked tense close; liquid comes home; conservation holds', () => {
  const entries = E(
    '- 2026-06-21 · MINT → wright · 5 · for: gift:float · by: keemin',
    '- 2026-06-21 · MINT → dot · 4 · for: gift:float · by: keemin',
    worldStakeLine({ date: '2026-06-21', handle: 'wright', mark: MARK, n: 3, via: 'api' }),
    worldStakeLine({ date: '2026-06-21', handle: 'dot', mark: MARK, n: 4, via: 'api' }),
    worldUnstakeLine({ date: '2026-06-22', mark: MARK, handle: 'dot', n: 1 }),
    TR('wright', 3), TR('dot', 3),
  );
  assert.equal(foldWorldMarkEscrow(entries).has(MARK), false, 'the mark carries no escrow');
  assert.equal(foldWorldMarkPositions(entries).size, 0, 'no position stays open');
  const staked = foldStaked(entries);
  assert.equal(staked.get('wright') ?? 0, 0);
  assert.equal(staked.get('dot') ?? 0, 0);
  const bal = foldBalances(entries);
  assert.equal(bal.get('wright'), 5);
  assert.equal(bal.get('dot'), 4);
  assert.equal(bal.get(`stake:world-mark/${MARK}`), 0);
  assert.equal([...bal.values()].reduce((a, b) => a + b, 0), 0, 'every line is a movement; the whole fold sums to zero');
});

test('THE FALSIFIER: the owner and several stakers get back exactly their remaining deposits, a prior partial unstake included', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    const before = { wright: balanceOf(repo, 'wright'), rei: balanceOf(repo, 'rei'), dot: balanceOf(repo, 'dot') };
    assert.deepEqual(before, { wright: 5, rei: 5, dot: 2 });
    // wright owns MARK. rei shares wright's household; dot is outside it.
    worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 3, via: 'api', date: '2026-06-21' }, priv);
    worldStakeApply(repo, { handle: 'rei', mark: MARK, n: 4, via: 'api', date: '2026-06-21' }, priv);
    worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
    worldStakeApply(repo, { handle: 'rei', mark: MARK2, n: 1, via: 'api', date: '2026-06-21' }, priv);
    worldUnstakeApply(repo, { handle: 'wright', mark: MARK, n: 1, date: '2026-06-22' }, priv);   // the owner's own partial way out
    assert.ok(deriveWorldMarkWeights(repo).rows.some((r) => r.mark === MARK && r.weight > r.n), 'a bonus rides the weight, and must not ride the return');

    const r = worldTownReturnApply(repo, { marks: [MARK, MARK2], removal: 'S172', date: '2026-06-25' }, priv);
    assert.deepEqual(r, {
      removal: 'S172', date: '2026-06-25', marks: [MARK2, MARK],
      returned: [
        { mark: MARK2, handle: 'rei', n: 1 },
        { mark: MARK, handle: 'dot', n: 2 },
        { mark: MARK, handle: 'rei', n: 4 },
        { mark: MARK, handle: 'wright', n: 2 },
      ],
      nothing_open: [], total: 9,
      proof: { escrow_before: { [MARK2]: 1, [MARK]: 8 }, escrow_after: { [MARK2]: 0, [MARK]: 0 }, conserved: true },
      appended: true,
    });
    // each actual staker, by handle (rei and wright share a household; they are paid apart), whole again
    assert.deepEqual({ wright: balanceOf(repo, 'wright'), rei: balanceOf(repo, 'rei'), dot: balanceOf(repo, 'dot') }, before);
    assert.equal(markEscrow(repo, MARK), 0);
    assert.equal(markEscrow(repo, MARK2), 0);
    assert.equal(retirementBlocked(repo, MARK).blocked, false);
    assert.equal(deriveWorldMarkWeights(repo).rows.length, 0, 'the world\'s stake input no longer lists the removed marks');
    // recorded as the town's act: four town-return lines, and the resident's one unstake is the only unstake
    const text = ledgerOf(repo);
    assert.equal((text.match(/ · for: town-return:S172 · sig: /g) ?? []).length, 4);
    assert.equal((text.match(/ · for: unstake · sig: /g) ?? []).length, 1);
    const v = verifyStampLedger(repo);
    assert.equal(v.ok, true, v.problems.join('; '));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('replay and retry: a second call finds the positions closed and writes NOTHING', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
    const first = worldTownReturnApply(repo, { marks: [MARK], removal: 'S172', date: '2026-06-25' }, priv);
    assert.equal(first.appended, true);
    const after = ledgerOf(repo);
    for (const removal of ['S172', 'S173']) {
      const again = worldTownReturnApply(repo, { marks: [MARK, MARK], removal, date: '2026-06-26' }, priv);
      assert.deepEqual(again, {
        removal, date: '2026-06-26', marks: [MARK], returned: [], nothing_open: [MARK], total: 0,
        proof: { escrow_before: { [MARK]: 0 }, escrow_after: { [MARK]: 0 }, conserved: true }, appended: false,
      });
      assert.equal(ledgerOf(repo), after, 'the ledger is byte-for-byte unchanged');
    }
    assert.equal(balanceOf(repo, 'dot'), 2, 'paid once');
    assert.equal(verifyStampLedger(repo).ok, true);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('late positions are not orphaned: the write reads the ledger at apply time, never a list handed in', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
    const early = worldTownReturnPlan(repo, { marks: [MARK], removal: 'S172', date: '2026-06-25' });
    assert.deepEqual(early.returned, [{ mark: MARK, handle: 'wright', n: 2 }]);
    // a stake lands after the world's fold was read
    worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 2, via: 'api', date: '2026-06-24' }, priv);
    worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 1, via: 'api', date: '2026-06-24' }, priv);
    // a stale list handed in is not an input at all
    const r = worldTownReturnApply(repo, {
      marks: [MARK], removal: 'S172', date: '2026-06-25', returned: [{ mark: MARK, handle: 'wright', n: 2 }],
    }, priv);
    assert.deepEqual(r.returned, [{ mark: MARK, handle: 'dot', n: 2 }, { mark: MARK, handle: 'wright', n: 3 }]);
    // and a stake on the removed mark after the return is returned by the next call, not left inert
    worldStakeApply(repo, { handle: 'rei', mark: MARK, n: 1, via: 'api', date: '2026-06-26' }, priv);
    const later = worldTownReturnApply(repo, { marks: [MARK], removal: 'S172', date: '2026-06-26' }, priv);
    assert.deepEqual(later.returned, [{ mark: MARK, handle: 'rei', n: 1 }]);
    assert.equal(markEscrow(repo, MARK), 0);
    const v = verifyStampLedger(repo);
    assert.equal(v.ok, true, v.problems.join('; '));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('the plan refuses malformed input and writes nothing; its proof refuses a state that would not conserve', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
    const before = ledgerOf(repo);
    for (const [args, re] of [
      [{ marks: [], removal: 'S172', date: '2026-06-25' }, /incomplete/],
      [{ marks: MARK, removal: 'S172', date: '2026-06-25' }, /incomplete/],
      [{ marks: [MARK], date: '2026-06-25' }, /incomplete/],
      [{ marks: ['Wright/x'], removal: 'S172', date: '2026-06-25' }, /not a mark id/],
      [{ marks: [MARK, 7], removal: 'S172', date: '2026-06-25' }, /not a mark id/],
      [{ marks: [MARK], removal: 'S0', date: '2026-06-25' }, /does not name a removal/],
      [{ marks: [MARK], removal: 172, date: '2026-06-25' }, /does not name a removal/],
      [{ marks: [MARK], removal: 'S172', date: 'tomorrow' }, /not a date/],
    ]) {
      assert.throws(() => worldTownReturnApply(repo, args, priv), (e) => e.code === 422 && re.test(e.message), JSON.stringify(args));
    }
    // A position map that disagrees with the escrow it came from (a stale or
    // doctored read) fails the proof before anything is written.
    const state = worldStakeState(repo);
    const doctored = { ...state, positions: new Map([[`${MARK}|dot`, 5]]) };
    assert.throws(() => worldTownReturnPlan(repo, { marks: [MARK], removal: 'S172', date: '2026-06-25' }, doctored), /does not conserve; nothing written/);
    assert.equal(ledgerOf(repo), before);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('UNLAWFUL: forged town returns are REFUSED by the verifier — overdraw, part, wrong beneficiary, twice, a staker left behind', () => {
  const cases = [
    { why: 'an overdraw past dot\'s own position (the mark holds 5, dot 2)', lines: [TR('dot', 3)], re: /a town return is whole: 3 to dot .* open position is 2/ },
    { why: 'a part of a position', lines: [TR('dot', 1)], re: /a town return is whole: 1 to dot .* open position is 2/ },
    { why: 'a beneficiary with no stake there, though their household has one', lines: [TR('rei', 2)], re: /a town return is whole: 2 to rei .* open position is 0/ },
    { why: 'the owner paid another\'s stake', lines: [TR('wright', 5)], re: /a town return is whole: 5 to wright .* open position is 3/ },
    { why: 'the same position returned twice', lines: [TR('dot', 2), TR('wright', 3), TR('dot', 2, 'S173')], re: /a town return is whole: 2 to dot .* \(S173\), but the open position is 0/ },
    { why: 'a removal that returns one staker and leaves the owner\'s stake behind', lines: [TR('dot', 2)], re: /town return S172 on world-mark wright\/the-crossing-bench leaves 3 stamp\(s\) of other stakers behind/ },
    { why: 'a removal split by another line', lines: [TR('dot', 2), worldStakeLine({ date: '2026-06-25', handle: 'rei', mark: MARK2, n: 1, via: 'api' }), TR('wright', 3)], re: /leaves 3 stamp\(s\) of other stakers behind/ },
    { why: 'a removal split across two settlements', lines: [TR('dot', 2), TR('wright', 3, 'S173')], re: /town return S172 .* leaves 3 stamp\(s\)/ },
  ];
  for (const c of cases) {
    const { pub, priv } = keypair();
    const repo = stakeTown(pub, priv);
    try {
      worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 3, via: 'api', date: '2026-06-21' }, priv);
      worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
      mintMod.appendSigned(repo, c.lines, priv);
      const v = verifyStampLedger(repo);
      assert.equal(v.ok, false, c.why);
      assert.match(v.problems.join(' '), c.re, c.why);
    } finally { rmSync(repo, { recursive: true, force: true }); }
  }
});

test('UNLAWFUL: a malformed, zero or negative town return, or one signed by another key, fails verification', () => {
  const W = 'stake:world-mark/wright/the-crossing-bench';
  const malformed = [
    `- 2026-06-25 · ${W} → dot · 2 · for: town-return:S0`,
    `- 2026-06-25 · ${W} → dot · 2 · for: town-return:172`,
    `- 2026-06-25 · ${W} → dot · 0 · for: town-return:S172`,
    `- 2026-06-25 · ${W} → dot · -2 · for: town-return:S172`,
  ];
  for (const line of malformed) {
    const { pub, priv } = keypair();
    const repo = stakeTown(pub, priv);
    try {
      worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
      mintMod.appendSigned(repo, [line], priv);
      const v = verifyStampLedger(repo);
      assert.equal(v.ok, false, line);
      assert.match(v.problems.join(' '), /unrecognized grammar/, line);
    } finally { rmSync(repo, { recursive: true, force: true }); }
  }
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    worldStakeApply(repo, { handle: 'dot', mark: MARK, n: 2, via: 'api', date: '2026-06-21' }, priv);
    mintMod.appendSigned(repo, [TR('dot', 2)], keypair().priv);   // the right shape, the wrong pen
    assert.equal(verifyStampLedger(repo).ok, false, 'only the office pen writes a town return');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('the resident\'s unstake stays the resident\'s: clipped to their own position, written `for: unstake`', () => {
  const { pub, priv } = keypair();
  const repo = stakeTown(pub, priv);
  try {
    worldStakeApply(repo, { handle: 'wright', mark: MARK, n: 3, via: 'api', date: '2026-06-21' }, priv);
    worldStakeApply(repo, { handle: 'dot', mark: MARK2, n: 2, via: 'api', date: '2026-06-21' }, priv);
    worldTownReturnApply(repo, { marks: [MARK2], removal: 'S172', date: '2026-06-22' }, priv);
    const r = worldUnstakeApply(repo, { handle: 'wright', mark: MARK, n: 9, date: '2026-06-23' }, priv);
    assert.equal(r.applied, 3, 'clipped to the resident\'s own position');
    const lines = ledgerOf(repo).trimEnd().split('\n');
    assert.match(lines.at(-1), /^- 2026-06-23 · stake:world-mark\/wright\/the-crossing-bench → wright · 3 · for: unstake · sig: /);
    assert.equal(worldUnstakeApply(repo, { handle: 'dot', mark: MARK2, n: 2, date: '2026-06-23' }, priv).applied, 0, 'the town already returned it; nothing left to unstake');
    assert.equal(verifyStampLedger(repo).ok, true);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
