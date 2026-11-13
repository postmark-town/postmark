// stamp-meep-correction.test.mjs — the meep set widened, and a meep's stage mints burned (POS-655).
//   node --test tools/stamp-meep-correction.test.mjs
// Zero-dep; builds throwaway repos in tmp; throwaway ed25519 keys.
//
// Darko, 2026-10-16 20:04 EDT, ruling A on POS-655: a new rules line adds the
// town's other meeps to the meep set, so the verifier refuses any future mint
// to a meep; and a reviewed correction BURN of the Registrar's 5 ✦ (ledger
// 21272–21273: 2 at confirmed, 3 at reproduced, by: the-town). "Meeps are
// credited, not paid": her finding and credit stay on the post. So a meep's
// stage mint is burned ALONE, with no recredit, which the POS-649 grammar
// refused ("the two are written together or not at all").
//
// In order:
//   1. the meep set: after a rules line naming the registrar, a stage mint to
//      her is refused at the verb and red at the verifier; the flip (no such
//      line) passes the same mint;
//   2. the meep correction: --meep-correction burns every stage mint the post
//      paid the meep, in one append, and the verifier is green; the balances
//      move exactly; a second burn, a handle that is no meep, a caller's
//      amount the ledger disagrees with and a hand that is not one each refuse
//      and write nothing (the liquid-balance guard is --stage-recredit's own,
//      the same lines);
//   3. the verifier: a lone burn of a NON-meep's stage mint is still red (it
//      must follow its recredit), and so is a lone burn of a meep's mint dated
//      before the law named her.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  stageMintLine, meepCorrectionLines, rulesV3Line, parseStampLedger, foldBalances, sealChain, signSeal, classifyEntry,
  giftLine,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MINT_CLI = join(HERE, 'stamp-mint.mjs');

// The Registrar's post, as the live ledger holds it (lines 21272–21273, 2026-10-14).
const POST = 'registrar/pending-join-board-misses-an-added-address-when-the-pr-words';
const GENESIS = '- 2026-06-12 · rules: stamps-v1';
const OLD_LAW = rulesV3Line('2026-09-30', ['bugcatcher', 'illuminator', 'postmaster'], '5:5,10:10');
const NEW_LAW = rulesV3Line('2026-10-17', ['architect', 'bugcatcher', 'illuminator', 'postmaster', 'registrar', 'worldkeeper'], '5:5,10:10');

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pub: publicKey.export({ type: 'spki', format: 'pem' }), priv: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}
function town(handles, { pub, priv }, lines) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-meep-'));
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
function writeLedger(repo, priv, lines) {
  const all = [GENESIS, ...lines];
  const seals = sealChain(all);
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'),
    '# stamp-ledger\n\n' + all.map((c, i) => `${c} · sig: ${signSeal(seals[i], priv)}`).join('\n') + '\n');
}
const sigAt = (priv, lines, idx) => signSeal(sealChain([GENESIS, ...lines])[idx + 1], priv);
const entriesOf = (repo) => parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'));
function runMint(repo, args) {
  try {
    return { ok: true, out: execFileSync(process.execPath, [MINT_CLI, ...args, '--repo', repo], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { ok: false, out: String(e.stdout ?? '') + String(e.stderr ?? '') };
  }
}
const STAGE = (handle, n, stage, date = '2026-10-14', post = POST) => stageMintLine({ date, handle, n, post, stage });
const keyFile = (repo, priv) => { const p = join(repo, 'key.pem'); writeFileSync(p, priv); return p; };
const HANDS = ['registrar', 'wright', 'kinofire'];
// the live order: the old law, then the Registrar's two stage mints, then the new law
const LIVE = [OLD_LAW, STAGE('registrar', 2, 'confirmed'), STAGE('registrar', 3, 'reproduced')];

// ── 1 · the meep set ────────────────────────────────────────────────────────

test('1 · after the new rules line, a stage mint to the registrar is refused at the verb and red at the verifier; without it, the same mint passes', () => {
  const k = keypair();
  // the verb: --stage-mint to the registrar after the law names her
  const repo = town(HANDS, k, [...LIVE, NEW_LAW]);
  const r = runMint(repo, ['--stage-mint', 'registrar', '--post', 'registrar/another-finding', '--stage', 'confirmed', '--amount', '2', '--date', '2026-10-18', '--key', keyFile(repo, k.priv)]);
  assert.equal(r.ok, false, r.out);
  assert.match(r.out, /meep/);
  assert.equal(entriesOf(repo).length, LIVE.length + 2, 'the refused mint wrote nothing');

  // the verifier: the same mint, signed and forged onto the ledger, is red
  const forged = town(HANDS, k, [...LIVE, NEW_LAW, STAGE('registrar', 2, 'confirmed', '2026-10-18', 'registrar/another-finding')]);
  const red = verifyStampLedger(forged);
  assert.equal(red.ok, false);
  assert.ok(red.problems.some((p) => /meep/.test(p)), red.problems.join('\n'));

  // THE FLIP: no new rules line, and the same mint is lawful (today's hole)
  const hole = town(HANDS, k, [...LIVE, STAGE('registrar', 2, 'confirmed', '2026-10-18', 'registrar/another-finding')]);
  assert.equal(verifyStampLedger(hole).ok, true, verifyStampLedger(hole).problems?.join('\n'));
});

// ── 2 · the meep correction ─────────────────────────────────────────────────

test("2 · --meep-correction burns both of the Registrar's stage mints in one append: the verifier is green and she holds 5 fewer", () => {
  const k = keypair();
  const repo = town(HANDS, k, [...LIVE, NEW_LAW]);
  const before = foldBalances(entriesOf(repo)).get('registrar') ?? 0;
  const r = runMint(repo, ['--meep-correction', 'registrar', '--post', POST, '--by', 'wright', '--amount', '5', '--date', '2026-10-18', '--key', keyFile(repo, k.priv)]);
  assert.equal(r.ok, true, r.out);
  const e = entriesOf(repo);
  const tail = e.slice(-2).map((x) => x.canonical);
  assert.deepEqual(tail, [
    `- 2026-10-18 · registrar → BURN · 2 · for: correction:${e[2].sig} · by: wright`,
    `- 2026-10-18 · registrar → BURN · 3 · for: correction:${e[3].sig} · by: wright`,
  ], 'each burn names its own mint by its full signature');
  assert.deepEqual(tail.map((l) => classifyEntry(l).kind), ['correction-burn', 'correction-burn']);
  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, v.problems?.join('\n'));
  assert.equal(before - (foldBalances(e).get('registrar') ?? 0), 5);

  // a second burn of the same post refuses and writes nothing
  const again = runMint(repo, ['--meep-correction', 'registrar', '--post', POST, '--by', 'wright', '--date', '2026-10-18', '--key', keyFile(repo, k.priv)]);
  assert.equal(again.ok, false);
  assert.match(again.out, /already burned/);
  assert.equal(entriesOf(repo).length, e.length);
});

test('2 · the meep correction refuses a handle that is no meep, a caller who read another amount, a hand that is not one, and an empty set', () => {
  const k = keypair();
  // no new law: the registrar is not a meep yet, so there is nothing for this verb to burn
  const early = town(HANDS, k, LIVE);
  const r1 = runMint(early, ['--meep-correction', 'registrar', '--post', POST, '--by', 'wright', '--date', '2026-10-18', '--key', keyFile(early, k.priv)]);
  assert.equal(r1.ok, false);
  assert.match(r1.out, /"registrar" is not a meep at 2026-10-18/);

  const repo = town(HANDS, k, [...LIVE, NEW_LAW]);
  const key = keyFile(repo, k.priv);
  const n = entriesOf(repo).length;
  const r2 = runMint(repo, ['--meep-correction', 'registrar', '--post', POST, '--by', 'wright', '--amount', '4', '--date', '2026-10-18', '--key', key]);
  assert.equal(r2.ok, false);
  assert.match(r2.out, /expects to burn 4 .* paid registrar 5/);
  const r3 = runMint(repo, ['--meep-correction', 'registrar', '--post', POST, '--by', 'ferry', '--date', '2026-10-18', '--key', key]);
  assert.equal(r3.ok, false);
  assert.match(r3.out, /by: must be one of the hands/);
  assert.equal(entriesOf(repo).length, n, 'nothing was written');

  // the builder refuses an empty set rather than writing nothing and calling it a burn
  assert.throws(() => meepCorrectionLines({ date: '2026-10-18', wrongs: [], by: 'wright' }), /no stage mint to burn/);
});

// ── 3 · the verifier ────────────────────────────────────────────────────────

test("3 · a lone burn of a NON-meep's stage mint is still red; so is a lone burn of a meep's mint dated before the law named her", () => {
  const k = keypair();
  // kinofire is no meep: her mint's correction must follow its recredit
  const kinoLines = [OLD_LAW, STAGE('kinofire', 2, 'confirmed'), NEW_LAW];
  const kinoBurn = `- 2026-10-18 · kinofire → BURN · 2 · for: correction:${sigAt(k.priv, kinoLines, 1)} · by: wright`;
  const red = verifyStampLedger(town(HANDS, k, [...kinoLines, kinoBurn]));
  assert.equal(red.ok, false);
  assert.ok(red.problems.some((p) => /does not follow its recredit/.test(p)), red.problems.join('\n'));

  // the registrar's burn, dated the day BEFORE the law that names her
  const lines = [...LIVE];
  const earlyBurn = `- 2026-10-16 · registrar → BURN · 2 · for: correction:${sigAt(k.priv, lines, 1)} · by: wright`;
  const early = verifyStampLedger(town(HANDS, k, [...lines, earlyBurn, NEW_LAW]));
  assert.equal(early.ok, false);
  assert.ok(early.problems.some((p) => /does not follow its recredit/.test(p)), early.problems.join('\n'));
});

test("3 · a lone burn of a meep's mint that is NOT a stage line is red: the meep correction burns a bug stage's mint, nothing else", () => {
  const k = keypair();
  // a letter mint to the registrar (she holds seven from before the law named her), then the law, then a burn naming it
  const letter = '- 2026-10-05 · MINT → registrar · 1 · for: migue-flint-2026-10-04-to-registrar-gabo-is-in-the-row-but-not-on-the-map (received)';
  const lines = [OLD_LAW, letter, NEW_LAW];
  const burn = `- 2026-10-18 · registrar → BURN · 1 · for: correction:${sigAt(k.priv, lines, 1)} · by: wright`;
  const v = verifyStampLedger(town(HANDS, k, [...lines, burn]));
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /names no earlier stage line/.test(p)), v.problems.join('\n'));
});

// ── 4 · a hand correcting its own pay (POS-1010) ────────────────────────────
// Darko 2026-11-12 23:05 EST: "we need to correct the mis-mint". Wright 2026-11-13 04:06Z: "a correction burn may
// stand alone when the handle it burns from is itself a correction hand (wright or keemin) and the burn is by that
// same hand: a hand correcting its own pay. Exactly the mint's amount, once per mint, as now." Invented mint data:
// a fix sized S paid at M (25) to a hand, burned by that hand alone, then paid right by a founder gift of 10.

const FIX_POST = 'sbx-ada/a-door-that-ignores-its-handle';
const SELF = [STAGE('wright', 25, 'fixed', '2026-11-08', FIX_POST)];
const selfBurn = (priv, { n = 25, by = 'wright', handle = 'wright', date = '2026-11-13' } = {}) =>
  `- ${date} · ${handle} → BURN · ${n} · for: correction:${sigAt(priv, SELF, 0)} · by: ${by}`;

test("4 · POS-1010: a correction hand burns its OWN stage mint alone, and the founder gift of 10 follows: green, the mint stays on the record, and the hand nets 15 less", () => {
  const k = keypair();
  const gift = giftLine({ date: '2026-11-13', handle: 'wright', n: 10, slug: 'replaces-a-fix-paid-at-m-right-size-s', by: 'wright' });
  const repo = town(HANDS, k, [...SELF, selfBurn(k.priv), gift]);
  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, v.problems?.join('\n'));
  const entries = entriesOf(repo);
  assert.equal(foldBalances(entries).get('wright'), 10, '25 paid, 25 burned, 10 given: net −15 against the 25');
  assert.equal(classifyEntry(entries[1].canonical).kind, 'post-stage', 'the original mint stays on the record, untouched');
  assert.equal(classifyEntry(entries[2].canonical).kind, 'correction-burn');

  // nothing else in the burn rules moved: the exact amount and once per mint still hold for the self-burn
  const short = verifyStampLedger(town(HANDS, k, [...SELF, selfBurn(k.priv, { n: 24 })]));
  assert.equal(short.ok, false);
  assert.ok(short.problems.some((p) => /burns 24, and that mint was 25 \(exactly its amount\)/.test(p)), short.problems.join('\n'));
  const twice = verifyStampLedger(town(HANDS, k, [...SELF, selfBurn(k.priv), selfBurn(k.priv)]));
  assert.equal(twice.ok, false);
  assert.ok(twice.problems.some((p) => /burned twice \(one correction per mint, ever\)/.test(p)), twice.problems.join('\n'));
});

test("4 · POS-1010: a correction hand burning the OTHER hand's stage mint alone is still red; the same-hand condition, not the hands list, is what lets a burn stand alone", () => {
  const k = keypair();
  const other = verifyStampLedger(town([...HANDS, 'keemin'], k, [...SELF, selfBurn(k.priv, { by: 'keemin' })]));
  assert.equal(other.ok, false);
  assert.ok(other.problems.some((p) => /the correction of post:sbx-ada\/a-door-that-ignores-its-handle\/fixed does not follow its recredit/.test(p)), other.problems.join('\n'));
});
