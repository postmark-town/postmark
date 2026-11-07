// stamp-recredit.test.mjs — a bug stage's correction: the recredit and its burn (POS-649).
//   node --test tools/stamp-recredit.test.mjs
// Zero-dep; builds throwaway repos in tmp; throwaway ed25519 keys.
//
// Darko, 2026-10-15: "the mint to kino to give them the 10 … burning the 10
// that you mistakenly got." On 10-14 #3757's briefed stage paid wright (ledger
// line 21426, sig nGVqSBCX4YL70cPP…); the brief was Kino's. The correction is
// two lines, written together by --stage-recredit or not at all:
//
//   - <date> · MINT → <handle> · <n> · for: post:<id>/<stage>-recredit · by: the-town
//   - <date> · <wrong> → BURN · <n> · for: correction:<sig> · by: <hand>
//
// In order:
//   1. the grammar: both lines classify as their own kinds, no sibling claims
//      them, the award can't take their label, and every other BURN stays
//      dormant (unknown, so the replay refuses it);
//   2. the builder: #3757's exact two lines from the real wrong mint, and the
//      refusals that keep either line from being forged or misfiled;
//   3. the verb: both lines, one append, the verifier green, the balances moved
//      exactly; a second correction, an unpaid stage, the same recipient, a
//      meep, a short liquid balance, a plan that read another line, and a hand
//      that is not one are each refused and write nothing;
//   4. the verifier: red if either half is missing or doubled, or the burn is
//      of another amount, another handle, another line, or by another hand.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  classifyEntry, stageMintLine, stageRecreditLines, awardMintLine, parseStampLedger, foldBalances,
  sealChain, signSeal, RECREDIT_STAGES,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MINT_CLI = join(HERE, 'stamp-mint.mjs');

// #3757, as the live ledger holds it (line 21426, 2026-10-14).
const POST = 'kinofire/false-sweep-warning-for-fireplace-and-firepit-from-stale-reg';
const WRONG_SIG = 'nGVqSBCX4YL70cPPh1GQ-Sg7OgUJl2mG5moxLHONi12DwJ101fAjNoileCO0Vt_7edKYCoIGCI1vaDyDZfxqDg';
const WRONG_LINE = `- 2026-10-14 · MINT → wright · 10 · for: post:${POST}/briefed · by: the-town · sig: ${WRONG_SIG}`;
const GENESIS = '- 2026-06-12 · rules: stamps-v1';

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pub: publicKey.export({ type: 'spki', format: 'pem' }), priv: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}
/** A town with rooms for `handles`, no mail, and a ledger signed by `priv` holding `lines` after the genesis. */
function town(handles, { pub, priv }, lines) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-recredit-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), '{}');
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  for (const h of handles) {
    mkdirSync(join(repo, 'WHITE_PAGES', h), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', h, 'ADDRESS.md'), `---\nhandle: ${h}\n---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), '# ledger\n\n');
  writeLedger(repo, priv, lines);
  return repo;
}
/** Sign and write the ledger by hand: the only way to put a forged-BUT-SIGNED line in front of the verifier. */
function writeLedger(repo, priv, lines) {
  const all = [GENESIS, ...lines];
  const seals = sealChain(all);
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'),
    '# stamp-ledger\n\n' + all.map((c, i) => `${c} · sig: ${signSeal(seals[i], priv)}`).join('\n') + '\n');
}
/** The signature line `idx` (0 = the first line after the genesis) gets in a ledger of `lines`. */
const sigAt = (priv, lines, idx) => signSeal(sealChain([GENESIS, ...lines])[idx + 1], priv);
const entriesOf = (repo) => parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'));
function runMint(repo, args) {
  try {
    return { ok: true, out: execFileSync(process.execPath, [MINT_CLI, ...args, '--repo', repo], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { ok: false, out: String(e.stdout ?? '') + String(e.stderr ?? '') };
  }
}
const STAGE = (handle, n, stage = 'briefed', post = POST) => stageMintLine({ date: '2026-10-14', handle, n, post, stage });
const keyFile = (repo, priv) => { const p = join(repo, 'key.pem'); writeFileSync(p, priv); return p; };
const recredit = (repo, key, extra = []) => runMint(repo, ['--stage-recredit', 'kinofire', '--post', POST, '--stage', 'briefed',
  '--by', 'wright', '--date', '2026-10-15', '--key', key, ...extra]);

// ── 1 · the grammar ─────────────────────────────────────────────────────────

test('1 · the recredit and the correction burn classify as their own kinds; no sibling claims them, and every other BURN stays dormant', () => {
  const [rc, burn] = stageRecreditLines({ date: '2026-10-15', handle: 'kinofire', wrong: { post: POST, stage: 'briefed', n: 10, handle: 'wright', sig: WRONG_SIG }, by: 'wright' });
  assert.deepEqual(classifyEntry(rc), { kind: 'post-recredit', date: '2026-10-15', handle: 'kinofire', n: 10, post: POST, stage: 'briefed', by: 'the-town' });
  assert.deepEqual(classifyEntry(burn), { kind: 'correction-burn', date: '2026-10-15', handle: 'wright', n: 10, sig: WRONG_SIG, by: 'wright' });
  // the stage line and an ordinary award are what they were
  assert.equal(classifyEntry(STAGE('wright', 10)).kind, 'post-stage');
  assert.equal(classifyEntry(`- 2026-10-15 · MINT → kinofire · 10 · for: post:${POST}/briefed-2 · by: wright`).kind, 'post-award');
  // a stage the correction does not cover is no recredit: it reads as an award, which the verifier refuses by its own law
  assert.equal(classifyEntry(`- 2026-10-15 · MINT → kinofire · 2 · for: post:${POST}/confirmed-recredit · by: wright`).kind, 'post-award');
  // the general burn stays reserved: unknown, so the replay refuses it
  for (const dormant of ['- 2026-10-15 · wright → BURN · 10 · for: blessing · by: wright',
    `- 2026-10-15 · wright → BURN · 10 · for: correction:${WRONG_SIG.slice(1)} · by: wright`,
    `- 2026-10-15 · wright → BURN · 10 · for: correction:${WRONG_SIG}`])
    assert.equal(classifyEntry(dormant).kind, 'unknown', dormant);
  // an award may never take a correction's label
  assert.throws(() => awardMintLine({ date: '2026-10-15', handle: 'kinofire', n: 10, post: POST, label: 'briefed-recredit', by: 'wright' }), /a stage correction's name/);
  assert.deepEqual([...RECREDIT_STAGES], ['diagnosed', 'briefed', 'fixed']);
});

// ── 2 · the builder ─────────────────────────────────────────────────────────

test("2 · #3757: the correction's two lines, from the real wrong mint, exactly", () => {
  const [entry] = parseStampLedger(`${WRONG_LINE}\n`);
  const wrong = { ...classifyEntry(entry.canonical), sig: entry.sig };
  assert.deepEqual(stageRecreditLines({ date: '2026-10-15', handle: 'kinofire', wrong, by: 'wright' }), [
    `- 2026-10-15 · MINT → kinofire · 10 · for: post:${POST}/briefed-recredit · by: the-town`,
    `- 2026-10-15 · wright → BURN · 10 · for: correction:${WRONG_SIG} · by: wright`,
  ]);
});

test('2 · the builder refuses the same recipient, a stage it does not cover, an off-ladder amount, a short signature, a separator in a handle, and a hand that is not one', () => {
  const wrong = { post: POST, stage: 'briefed', n: 10, handle: 'wright', sig: WRONG_SIG };
  const at = (over, more = {}) => () => stageRecreditLines({ date: '2026-10-15', handle: 'kinofire', by: 'wright', ...more, wrong: { ...wrong, ...over } });
  assert.throws(at({}, { handle: 'wright' }), /already paid wright; a recredit pays someone else/);
  assert.throws(at({ stage: 'confirmed', n: 2 }), /only diagnosed, briefed, fixed are re-credited/);
  assert.throws(at({ n: 7 }), /briefed pays 10 or 5, not 7/);
  assert.throws(at({ sig: WRONG_SIG.slice(2) }), /full signature/);
  assert.throws(at({}, { handle: 'kino · by: wright' }), /one token/);
  assert.throws(at({}, { by: 'bugcatcher' }), /by: must be one of the hands \(keemin, wright\)/);
  assert.throws(at({ post: 'kinofire/x · by: wright' }), /post id/);
});

// ── 3 · the verb ────────────────────────────────────────────────────────────

test('3 · --stage-recredit writes both lines in one append; the verifier is green; the balances move exactly; a second correction is refused', () => {
  const k = keypair();
  const repo = town(['wright', 'kinofire'], k, [STAGE('wright', 10)]);
  try {
    const key = keyFile(repo, k.priv);
    const stageSig = entriesOf(repo)[1].sig;
    const r = recredit(repo, key, ['--amount', '10', '--from', 'wright']);
    assert.equal(r.ok, true, r.out);
    const e = entriesOf(repo);
    assert.deepEqual(e.slice(2).map((x) => x.canonical), [
      `- 2026-10-15 · MINT → kinofire · 10 · for: post:${POST}/briefed-recredit · by: the-town`,
      `- 2026-10-15 · wright → BURN · 10 · for: correction:${stageSig} · by: wright`,
    ]);
    const v = verifyStampLedger(repo);
    assert.equal(v.ok, true, v.problems.join('\n'));
    const bal = foldBalances(e);
    assert.deepEqual([bal.get('wright'), bal.get('kinofire'), bal.get('BURN'), bal.get('MINT')], [0, 10, 10, -20],
      'the wrong recipient is back to nothing, the right one holds the stage, the burn sits in BURN, and MINT paid twice');
    assert.equal(v.minted, 20, 'both mints still count as minted; the burn is what takes the 10 out of circulation');
    // a second correction of the same stage writes nothing
    const again = runMint(repo, ['--stage-recredit', 'ada', '--post', POST, '--stage', 'briefed', '--by', 'wright', '--date', '2026-10-15', '--key', key]);
    assert.equal(again.ok, false);
    assert.match(again.out, /was already re-credited \(2026-10-15, 10 to kinofire\) — one correction per post and stage, ever/);
    assert.equal(entriesOf(repo).length, e.length);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('3 · the verb refuses, and writes nothing: an unpaid stage, the same recipient, a meep, a short liquid balance, a plan that read another line, a hand that is not one, a stage it does not cover', () => {
  const k = keypair();
  // wright's 10 sits in escrow on a mark: liquid 0, so the burn has nothing it may take
  const escrowed = `- 2026-10-14 · wright → stake:world-mark/wright/lamp · 10 · via: api`;
  const repo = town(['wright', 'kinofire', 'postmaster'], k,
    [STAGE('wright', 10), '- 2026-10-14 · rules: stamps-v2 · meeps: postmaster']);
  const short = town(['wright', 'kinofire'], k, [STAGE('wright', 10), escrowed]);
  try {
    const key = keyFile(repo, k.priv);
    const n = entriesOf(repo).length;
    const refused = (args, re, where = repo) => {
      const r = runMint(where, args);
      assert.equal(r.ok, false, r.out);
      assert.match(r.out, re);
    };
    const base = ['--post', POST, '--by', 'wright', '--date', '2026-10-15', '--key', key];
    refused(['--stage-recredit', 'kinofire', '--stage', 'fixed', ...base], /post:kinofire\/false-sweep-warning-for-fireplace-and-firepit-from-stale-reg\/fixed was never paid — there is no stage line to correct/);
    refused(['--stage-recredit', 'wright', '--stage', 'briefed', ...base], /already paid wright; a recredit pays someone else/);
    refused(['--stage-recredit', 'postmaster', '--stage', 'briefed', ...base], /"postmaster" is a meep at 2026-10-15/);
    refused(['--stage-recredit', 'kinofire', '--stage', 'briefed', ...base, '--amount', '5'], /the plan expects 5 and post:.*\/briefed paid 10/);
    refused(['--stage-recredit', 'kinofire', '--stage', 'briefed', ...base, '--from', 'ada'], /the plan expects the wrong mint to be ada's and post:.*\/briefed paid wright/);
    refused(['--stage-recredit', 'kinofire', '--stage', 'briefed', '--post', POST, '--by', 'bugcatcher', '--date', '2026-10-15', '--key', key], /by: must be one of the hands \(keemin, wright\)/);
    refused(['--stage-recredit', 'kinofire', '--stage', 'confirmed', ...base], /only diagnosed, briefed, fixed are re-credited/);
    refused(['--stage-recredit', 'nobody', '--stage', 'briefed', ...base], /no WHITE_PAGES room for "nobody"/);
    assert.equal(entriesOf(repo).length, n, 'a refused correction wrote a line');
    const skey = keyFile(short, k.priv);
    refused(['--stage-recredit', 'kinofire', '--stage', 'briefed', '--post', POST, '--by', 'wright', '--date', '2026-10-15', '--key', skey],
      /wright holds 0 liquid stamp\(s\) and the wrong mint was 10 — a correction burns liquid stamps only, never escrow; nothing written/, short);
    assert.equal(entriesOf(short).length, 3);
  } finally { rmSync(repo, { recursive: true, force: true }); rmSync(short, { recursive: true, force: true }); }
});

// ── 4 · the verifier ────────────────────────────────────────────────────────

test('4 · the verifier is red if either half is missing or doubled, or the burn is of another amount, handle, line or hand; green on the lawful pair', () => {
  const k = keypair();
  const stage = STAGE('wright', 10);
  const other = STAGE('wright', 25, 'fixed');
  const sig = sigAt(k.priv, [stage, other], 0);
  const otherSig = sigAt(k.priv, [stage, other], 1);
  const RC = (handle = 'kinofire', n = 10, by = 'the-town') => `- 2026-10-15 · MINT → ${handle} · ${n} · for: post:${POST}/briefed-recredit · by: ${by}`;
  const BURN = ({ handle = 'wright', n = 10, s = sig, by = 'wright' } = {}) => `- 2026-10-15 · ${handle} → BURN · ${n} · for: correction:${s} · by: ${by}`;
  const repo = town(['wright', 'kinofire', 'ada'], k, [stage, other]);
  try {
    const verdict = (lines) => { writeLedger(repo, k.priv, [stage, other, ...lines]); return verifyStampLedger(repo); };
    const green = verdict([RC(), BURN()]);
    assert.equal(green.ok, true, green.problems.join('\n'));
    const red = (lines, re) => { const v = verdict(lines); assert.equal(v.ok, false, `green on ${lines.join(' / ')}`); assert.match(v.problems.join('\n'), re); };
    red([RC()], /briefed-recredit is not followed by the burn of the mint it corrects/);
    red([BURN()], /the correction of post:.*\/briefed does not follow its recredit/);
    red([RC(), BURN(), RC('ada'), BURN()], /is re-credited twice/);
    red([RC(), BURN(), BURN()], /burned twice|does not follow its recredit/);
    red([RC(), BURN({ n: 5 })], /recredit is not followed by the burn|burns 5, and that mint was 10/);
    red([RC('kinofire', 5), BURN({ n: 5 })], /pays 5, and the stage it corrects paid 10/);
    red([RC(), BURN({ handle: 'ada' })], /burns from ada, and that mint paid wright|overdrawn/);
    red([RC(), BURN({ s: otherSig })], /is not followed by the burn of the mint it corrects/);
    // the match is exact: a sig that differs only in its last character names no mint (review-3842-578 § 4, so a prefix match goes red)
    red([RC(), BURN({ s: sig.slice(0, 85) + (sig[85] === 'A' ? 'B' : 'A') })], /is not followed by the burn of the mint it corrects/);
    red([BURN({ s: sig.slice(0, 85) + (sig[85] === 'A' ? 'B' : 'A') })], /names no earlier stage line/);
    red([RC(), BURN({ by: 'bugcatcher' })], /a correction is a hand's \(keemin or wright\), not "bugcatcher"/);
    red([RC('kinofire', 10, 'wright'), BURN()], /a recredit is the town's mint \(by: "wright", must be the-town\)/);
    red([RC('wright'), BURN()], /pays wright, who the stage already paid/);
    // a burn of a line that is no stage line: the genesis line's own signature
    red([RC(), BURN({ s: signSeal(sealChain([GENESIS])[0], k.priv) })], /is not followed by the burn of the mint it corrects/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('4 · a correction whose wrong recipient spent the stamps first is red at the burn: the running fold refuses the overdraw', () => {
  const k = keypair();
  const stage = STAGE('wright', 10);
  const sig = sigAt(k.priv, [stage], 0);
  const repo = town(['wright', 'kinofire'], k, [stage]);
  try {
    writeLedger(repo, k.priv, [stage, '- 2026-10-14 · wright → stake:world-mark/wright/lamp · 10 · via: api',
      `- 2026-10-15 · MINT → kinofire · 10 · for: post:${POST}/briefed-recredit · by: the-town`,
      `- 2026-10-15 · wright → BURN · 10 · for: correction:${sig} · by: wright`]);
    const v = verifyStampLedger(repo);
    assert.equal(v.ok, false);
    assert.match(v.problems.join('\n'), /account "wright" overdrawn to -10/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

// ── 5 · a stage skipped by mistake (POS-931/a, Darko 2026-11-06: "Extend the door") ──
//
// The office recorded Moose's diagnosed as skipped, and Moose had named the
// cause. There is no wrong mint, so the correction is the recredit line alone,
// the stage's first and only payment: 5, nothing burned, written by
// --stage-recredit --skipped, and only on a ledger with no line for the stage.

const MOOSE_POST = 'moose/calendar-now-leads-with-a-cancelled-event-a-separate-surface';
const SKIPPED = (handle = 'moose', n = 5, { stage = 'diagnosed', by = 'the-town', post = MOOSE_POST } = {}) =>
  `- 2026-11-07 · MINT → ${handle} · ${n} · for: post:${post}/${stage}-recredit · by: ${by}`;
const skippedCredit = (repo, key, extra = []) => runMint(repo, ['--stage-recredit', 'moose', '--post', MOOSE_POST, '--stage', 'diagnosed',
  '--by', 'wright', '--date', '2026-11-07', '--key', key, ...extra]);

test('5 · the builder: a skipped stage\'s one line, and the refusals that keep it from being forged or misfiled', async () => {
  const { stageSkippedCreditLine } = await import('./stamp-mint.mjs');
  const line = stageSkippedCreditLine({ date: '2026-11-07', handle: 'moose', n: 5, post: MOOSE_POST, stage: 'diagnosed' });
  assert.equal(line, SKIPPED());
  assert.deepEqual(classifyEntry(line), { kind: 'post-recredit', date: '2026-11-07', handle: 'moose', n: 5, post: MOOSE_POST, stage: 'diagnosed', by: 'the-town' },
    'the same grammar as a correction\'s recredit: every reader of post:<id>/<stage>-recredit reads it');
  const at = (over) => () => stageSkippedCreditLine({ date: '2026-11-07', handle: 'moose', n: 5, post: MOOSE_POST, stage: 'diagnosed', ...over });
  assert.throws(at({ n: 10 }), /diagnosed pays 5, not 10/);
  assert.throws(at({ stage: 'briefed', n: 7 }), /briefed pays 10 or 5, not 7/);
  assert.throws(at({ stage: 'confirmed', n: 2 }), /only diagnosed and briefed are credited when never paid, not "confirmed"/);
  // a never-paid fixed is no lawful credit at any of its amounts (Truey's review of #4532 § 1): the office's coverage too
  for (const n of [10, 25, 50]) assert.throws(at({ stage: 'fixed', n }), /only diagnosed and briefed are credited when never paid, not "fixed"/, `fixed at ${n}`);
  assert.throws(at({ handle: 'moose · by: wright' }), /one token/);
  assert.throws(at({ post: 'moose/x · by: wright' }), /post id/);
});

test('5 · --stage-recredit --skipped writes ONE line, burns nothing, the verifier is green; a second credit and a later stage mint are refused', () => {
  const k = keypair();
  const repo = town(['wright', 'moose'], k, [STAGE('wright', 10)]);
  try {
    const key = keyFile(repo, k.priv);
    const before = entriesOf(repo).length;
    const r = skippedCredit(repo, key, ['--amount', '5', '--skipped']);
    assert.equal(r.ok, true, r.out);
    assert.match(r.out, /a skipped stage credited, nothing burned/);
    const e = entriesOf(repo);
    assert.deepEqual(e.slice(before).map((x) => x.canonical), [SKIPPED()], 'one line: the credit, and no burn');
    const v = verifyStampLedger(repo);
    assert.equal(v.ok, true, v.problems.join('\n'));
    const bal = foldBalances(e);
    assert.deepEqual([bal.get('moose'), bal.get('wright'), bal.get('BURN') ?? 0], [5, 10, 0], 'moose holds the stage\'s 5; nobody else moved; nothing was burned');
    // once only, by every road
    const again = skippedCredit(repo, key, ['--amount', '5', '--skipped']);
    assert.equal(again.ok, false);
    assert.match(again.out, /was already re-credited \(2026-11-07, 5 to moose\) — one correction per post and stage, ever/);
    const mint = runMint(repo, ['--stage-mint', 'moose', '--post', MOOSE_POST, '--stage', 'diagnosed', '--amount', '5', '--date', '2026-11-07', '--key', key]);
    assert.equal(mint.ok, false);
    assert.match(mint.out, /post:.*\/diagnosed is already paid by its recredit \(2026-11-07, 5 to moose\) — one payment per post and stage, ever/);
    assert.equal(entriesOf(repo).length, e.length, 'neither wrote a line');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('5 · --skipped refuses, and writes nothing: a stage the ledger paid, no amount, an off-ladder amount, a wrong recipient named, a meep, no room, a hand that is not one; without --skipped an unpaid stage is still refused', () => {
  const k = keypair();
  const paid = STAGE('wright', 5, 'diagnosed', MOOSE_POST);
  const repo = town(['wright', 'moose', 'postmaster'], k, [paid, '- 2026-10-14 · rules: stamps-v2 · meeps: postmaster']);
  const fresh = town(['wright', 'moose', 'postmaster'], k, ['- 2026-10-14 · rules: stamps-v2 · meeps: postmaster']);
  try {
    const key = keyFile(repo, k.priv);
    const fkey = keyFile(fresh, k.priv);
    const refused = (where, w, args, re) => {
      const n = entriesOf(where).length;
      const r = runMint(where, ['--stage-recredit', w, '--post', MOOSE_POST, '--date', '2026-11-07', ...args]);
      assert.equal(r.ok, false, r.out);
      assert.match(r.out, re);
      assert.equal(entriesOf(where).length, n, `a refused credit wrote a line: ${args.join(' ')}`);
    };
    refused(repo, 'moose', ['--stage', 'diagnosed', '--by', 'wright', '--key', key, '--amount', '5', '--skipped'],
      /post:.*\/diagnosed was paid \(2026-10-14, 5 to wright\) — a skipped stage's credit is for a stage this ledger never paid; correct a paid stage without --skipped/);
    refused(fresh, 'moose', ['--stage', 'diagnosed', '--by', 'wright', '--key', fkey, '--skipped'], /--skipped needs --amount/);
    refused(fresh, 'moose', ['--stage', 'diagnosed', '--by', 'wright', '--key', fkey, '--amount', '10', '--skipped'], /diagnosed pays 5, not 10/);
    refused(fresh, 'moose', ['--stage', 'diagnosed', '--by', 'wright', '--key', fkey, '--amount', '5', '--skipped', '--from', 'wright'], /--skipped names no wrong recipient/);
    refused(fresh, 'postmaster', ['--stage', 'diagnosed', '--by', 'wright', '--key', fkey, '--amount', '5', '--skipped'], /"postmaster" is a meep at 2026-11-07/);
    refused(fresh, 'nobody', ['--stage', 'diagnosed', '--by', 'wright', '--key', fkey, '--amount', '5', '--skipped'], /no WHITE_PAGES room for "nobody"/);
    refused(fresh, 'moose', ['--stage', 'diagnosed', '--by', 'bugcatcher', '--key', fkey, '--amount', '5', '--skipped'], /by: must be one of the hands \(keemin, wright\)/);
    for (const n of ['10', '25', '50'])
      refused(fresh, 'moose', ['--stage', 'fixed', '--by', 'wright', '--key', fkey, '--amount', n, '--skipped'],
        /only diagnosed and briefed are credited when never paid, not "fixed" — a fixed carries its size, the critter its fixer names and the merge, which a credit does not; a paid fixed is corrected without --skipped/);
    refused(fresh, 'moose', ['--stage', 'diagnosed', '--by', 'wright', '--key', fkey, '--amount', '5'],
      /was never paid — there is no stage line to correct \(a stage recorded skipped and never paid is credited with --skipped\)/);
  } finally { rmSync(repo, { recursive: true, force: true }); rmSync(fresh, { recursive: true, force: true }); }
});

test('5 · the verifier: green on a lone credit of a stage never paid; red on a burn after it, a stage line after it, a second credit, an off-ladder amount, a hand\'s by:, or a meep', () => {
  const k = keypair();
  const law = '- 2026-10-14 · rules: stamps-v2 · meeps: postmaster';
  const repo = town(['wright', 'moose', 'ada', 'postmaster'], k, [law]);
  try {
    const verdict = (lines) => { writeLedger(repo, k.priv, [law, ...lines]); return verifyStampLedger(repo); };
    const green = verdict([SKIPPED()]);
    assert.equal(green.ok, true, green.problems.join('\n'));
    const red = (lines, re) => { const v = verdict(lines); assert.equal(v.ok, false, `green on ${lines.join(' / ')}`); assert.match(v.problems.join('\n'), re); };
    const stageSig = sigAt(k.priv, [law, STAGE('wright', 10)], 1);
    red([STAGE('wright', 10), SKIPPED(), `- 2026-11-07 · wright → BURN · 5 · for: correction:${stageSig} · by: wright`],
      /credits a stage never paid, and a burn follows it/);
    red([SKIPPED(), stageMintLine({ date: '2026-11-07', handle: 'moose', n: 5, post: MOOSE_POST, stage: 'diagnosed' })],
      /was already paid by its recredit, and a stage line after it pays the stage twice/);
    red([SKIPPED(), SKIPPED('ada')], /is re-credited twice/);
    red([SKIPPED('moose', 10)], /pays a stage never paid 10, and diagnosed pays 5/);
    red([SKIPPED('moose', 5, { by: 'wright' })], /a recredit is the town's mint \(by: "wright", must be the-town\)/);
    red([SKIPPED('postmaster')], /a recredit to meep "postmaster"/);
    // a never-paid fixed, at every amount its ladder holds, is red: no lawful credit of a fixed nobody paid
    for (const n of [10, 25, 50])
      red([SKIPPED('moose', n, { stage: 'fixed' })], /post:.*\/fixed-recredit credits a fixed that was never paid, and only diagnosed and briefed are credited when never paid/);
    // and a never-paid briefed at its ladder amount stays green
    const briefed = verdict([SKIPPED('moose', 10, { stage: 'briefed' })]);
    assert.equal(briefed.ok, true, briefed.problems.join('\n'));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('5 · a PAID fixed is still corrected exactly as before: --stage-recredit (no --skipped) writes the recredit and the burn of its mint, and the verifier is green', () => {
  const k = keypair();
  const paidFixed = STAGE('wright', 25, 'fixed', MOOSE_POST);
  const repo = town(['wright', 'moose'], k, [paidFixed]);
  try {
    const key = keyFile(repo, k.priv);
    const fixedSig = entriesOf(repo)[1].sig;
    const r = runMint(repo, ['--stage-recredit', 'moose', '--post', MOOSE_POST, '--stage', 'fixed', '--by', 'wright', '--amount', '25', '--from', 'wright',
      '--date', '2026-11-07', '--key', key]);
    assert.equal(r.ok, true, r.out);
    assert.match(r.out, /stage re-credited, the wrong mint burned/);
    assert.deepEqual(entriesOf(repo).slice(2).map((x) => x.canonical), [
      SKIPPED('moose', 25, { stage: 'fixed' }),
      `- 2026-11-07 · wright → BURN · 25 · for: correction:${fixedSig} · by: wright`,
    ], 'the same two lines as any correction: the recredit, then the burn of the paid mint');
    const v = verifyStampLedger(repo);
    assert.equal(v.ok, true, v.problems.join('\n'));
    const bal = foldBalances(entriesOf(repo));
    assert.deepEqual([bal.get('moose'), bal.get('wright'), bal.get('BURN')], [25, 0, 25]);
    // and --skipped on that paid fixed is still refused, by the coverage first
    const skipped = runMint(repo, ['--stage-recredit', 'moose', '--post', MOOSE_POST, '--stage', 'fixed', '--by', 'wright', '--amount', '25', '--skipped',
      '--date', '2026-11-07', '--key', key]);
    assert.equal(skipped.ok, false);
    assert.match(skipped.out, /only diagnosed and briefed are credited when never paid, not "fixed"/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
