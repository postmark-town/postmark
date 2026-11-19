// census-fold.test.mjs — the census's own module (CORE-108).
//   node --test tools/census-fold.test.mjs
// Zero-dep. Every line here is invented, written by the real line builders in
// stamp-mint.mjs, or (where no builder exists) by hand in the grammar's own shape.
//
// WHY THIS FILE: the Registrar's likeness census imports three functions of the
// stamp engine, parseStampLedger, classifyEntry and foldPrimaryMint (CORE-85), and
// locks the module that holds them. They moved out of tools/stamp-mint.mjs into
// tools/census-fold.mjs so a change to the stamp engine, quest pay included, no
// longer stops the census. Darko, 2026-11-16 13:17 EST: "Lets proactively get the
// census through rather than wait on her. What's the problem, what's the fix", then
// "Yes go".
//
// LAW (the brief's acceptance): the move changes no behaviour, and "the new module
// imports nothing from stamp-mint (so a later stamp-mint change can't reach it)".
//
// In order:
//   1. the module's surface, and stamp-mint's re-exports are the SAME bindings, so
//      there is one copy of each function and every old caller is unchanged;
//   2. the behaviour pin: every ledger grammar, invite rows both sides included,
//      classifies as the grammar's own words say, from the new module and through
//      stamp-mint's re-export alike;
//   3. the parser and the primary fold on a ledger text, invite rows counted;
//   4. THE FALSIFIER: census-fold.mjs imports nothing, read from its source, with
//      a scanner proven on seeded imports first.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as fold from './census-fold.mjs';
import * as mint from './stamp-mint.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const D = '2026-11-10';

// ── 1. surface and wiring ────────────────────────────────────────────────────

// What the census imports (CORE-85), and what stamp-mint's own code needs back.
const CENSUS_USES = ['parseStampLedger', 'classifyEntry', 'foldPrimaryMint'];
const RE_EXPORTED = ['parseLadder', 'STAGE_LADDER', 'RECREDIT_STAGES', 'KEEPING_RAILS', ...CENSUS_USES];

test('census-fold exports what the census reads, and nothing the census does not', () => {
  for (const name of CENSUS_USES) assert.equal(typeof fold[name], 'function', `${name} is exported`);
  assert.deepEqual(
    Object.keys(fold).sort(),
    [...RE_EXPORTED, 'HOUSEHOLD_KEY', 'HOLO_MINT_RE'].sort(),
    'the whole surface: the seven public names stamp-mint re-exports, and the two grammar pieces it still reads',
  );
});

test('stamp-mint re-exports the very same bindings: one copy of each, every old caller unchanged', () => {
  for (const name of RE_EXPORTED) {
    assert.ok(Object.hasOwn(mint, name), `stamp-mint still exports ${name}`);
    assert.strictEqual(mint[name], fold[name], `${name} from stamp-mint is census-fold's, not a second copy`);
  }
});

test('stamp-mint defines none of the three census functions itself (a second copy would be a second law)', () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const mintSrc = strip(readFileSync(join(HERE, 'stamp-mint.mjs'), 'utf8'));
  const foldSrc = strip(readFileSync(join(HERE, 'census-fold.mjs'), 'utf8'));
  for (const name of CENSUS_USES) {
    const def = new RegExp(`function\\s+${name}\\s*\\(`);
    assert.ok(def.test(foldSrc), `control: census-fold.mjs defines ${name}`);
    assert.ok(!def.test(mintSrc), `stamp-mint.mjs must not define ${name}`);
  }
  assert.match(mintSrc, /from '\.\/census-fold\.mjs'/, 'and it imports census-fold.mjs (a text pin; the identity test above is the behavioural reader)');
});

// ── 2. the behaviour pin: every grammar, as the grammar's own words say ─────

const SIG = 'A'.repeat(86);
const KEY_A = 'hh:alice-house';
const KEY_B = 'hh:bob-house';
const POST = 'alice/a-bug';

// [what, canonical line, the classification the grammar's comment and fields give].
// Expected values are written out by hand from the grammar, never taken from a run.
const CORPUS = [
  ['rules v1', mint.rulesLine(D), { kind: 'rules', date: D, rules: 'stamps-v1', meeps: [], friendship: null }],
  ['rules v3 carries meeps and the ladder', mint.rulesV3Line(D, ['m2', 'm1'], '5:5,10:10'),
    { kind: 'rules', date: D, rules: 'stamps-v3', meeps: ['m1', 'm2'], friendship: [{ threshold: 5, reward: 5 }, { threshold: 10, reward: 10 }] }],
  ['registry', mint.registryLine(D, 'alice', 'gh:1'), { kind: 'registry', date: D, handle: 'alice', key: 'gh:1' }],
  ['mint', mint.mintLine({ date: D, handle: 'alice', cause: 'l1', side: 'sent' }),
    { kind: 'mint', date: D, handle: 'alice', cause: 'l1', side: 'sent', provisional: false }],
  ['mint, provisional', mint.mintLine({ date: D, handle: 'alice', cause: 'l1', side: 'received', provisional: true }),
    { kind: 'mint', date: D, handle: 'alice', cause: 'l1', side: 'received', provisional: true }],
  ['vote-mint', mint.voteMintLine({ date: D, handle: 'alice', topic: 't1' }), { kind: 'vote-mint', date: D, handle: 'alice', topic: 't1' }],
  ['stake', mint.stakeLine({ date: D, handle: 'alice', topic: 't1', candidate: 'Aurelia', n: 3, via: 'api' }),
    { kind: 'stake', date: D, handle: 'alice', topic: 't1', candidate: 'Aurelia', n: 3, via: 'api' }],
  ['return', mint.returnLine({ date: D, topic: 't1', candidate: 'Aurelia', handle: 'alice', n: 3 }),
    { kind: 'return', date: D, topic: 't1', candidate: 'Aurelia', handle: 'alice', n: 3 }],
  ['world stake', mint.worldStakeLine({ date: D, handle: 'alice', mark: 'bob/a-mark', n: 2, via: 'api' }),
    { kind: 'world-stake', date: D, handle: 'alice', mark: 'bob/a-mark', n: 2, via: 'api' }],
  ['world unstake', mint.worldUnstakeLine({ date: D, mark: 'bob/a-mark', handle: 'alice', n: 2 }),
    { kind: 'world-unstake', date: D, mark: 'bob/a-mark', handle: 'alice', n: 2 }],
  ['world town return', mint.worldTownReturnLine({ date: D, mark: 'bob/a-mark', handle: 'alice', n: 2, removal: 'S172' }),
    { kind: 'world-town-return', date: D, mark: 'bob/a-mark', handle: 'alice', n: 2, removal: 'S172' }],
  ['pot stake', mint.potStakeLine({ date: D, handle: 'alice', pot: 'lights', n: 4, via: 'api' }),
    { kind: 'pot-stake', date: D, handle: 'alice', pot: 'lights', n: 4, via: 'api' }],
  ['pot return', mint.potReturnLine({ date: D, pot: 'lights', handle: 'alice', n: 4, epoch: '2026-11' }),
    { kind: 'pot-return', date: D, pot: 'lights', handle: 'alice', n: 4, epoch: '2026-11' }],
  ['pot unstake', mint.potUnstakeLine({ date: D, pot: 'lights', handle: 'alice', n: 4, via: 'api' }),
    { kind: 'pot-unstake', date: D, pot: 'lights', handle: 'alice', n: 4, via: 'api' }],
  ['post stake', mint.postStakeLine({ date: D, handle: 'alice', post: POST, n: 2, side: 'for', via: 'api' }),
    { kind: 'post-stake', date: D, handle: 'alice', post: POST, n: 2, side: 'for', via: 'api' }],
  ['post unstake', mint.postUnstakeLine({ date: D, post: POST, handle: 'alice', n: 2, via: 'api' }),
    { kind: 'post-unstake', date: D, post: POST, handle: 'alice', n: 2, via: 'api' }],
  ['post return', mint.postReturnLine({ date: D, post: POST, handle: 'alice', n: 2 }),
    { kind: 'post-return', date: D, post: POST, handle: 'alice', n: 2 }],
  ['keeping burn (retired, still parses)', mint.keepingBurnLine({ date: D, pot: 'lights', n: 1, epoch: '2026-11', handle: 'alice' }),
    { kind: 'keeping-burn', date: D, pot: 'lights', n: 1, epoch: '2026-11', handle: 'alice' }],
  ['keeping mint (retired, still parses)', mint.keepingMintLine({ date: D, handle: 'alice', n: 1, pot: 'lights', epoch: '2026-11' }),
    { kind: 'keeping-mint', date: D, handle: 'alice', n: 1, pot: 'lights', epoch: '2026-11' }],
  ['pot receipt', mint.potReceiptLine({ date: D, pot: 'lights', rail: 'stripe', usd: 5, from: 'alice', ref: 'ch_1' }),
    { kind: 'pot-receipt', date: D, pot: 'lights', rail: 'stripe', usd: 5, from: 'alice', ref: 'ch_1' }],
  ['pot correction', mint.potCorrectionLine({ date: D, ref: 'ch_1', from: 'alice', to: 'bob', reason: 'misattributed', by: 'keemin' }),
    { kind: 'pot-correction', date: D, ref: 'ch_1', from: 'alice', to: 'bob', reason: 'misattributed', by: 'keemin' }],
  ['holo, zero is lawful', mint.holoMintLine({ date: D, handle: 'alice', n: 0, pot: 'lights', epoch: '2026-11', ref: 'ch_1' }),
    { kind: 'holo', date: D, handle: 'alice', n: 0, pot: 'lights', epoch: '2026-11', ref: 'ch_1' }],
  ['void', mint.voidLine({ date: D, id: 'l9', from: 'alice', to: 'bob', n: 5, reason: 'self-pay' }),
    { kind: 'void', date: D, id: 'l9', from: 'alice', to: 'bob', n: 5, reason: 'self-pay' }],
  ['gift', mint.giftLine({ date: D, handle: 'alice', n: 10, slug: 'thanks', by: 'keemin' }),
    { kind: 'gift', date: D, handle: 'alice', n: 10, slug: 'thanks', by: 'keemin' }],
  ['first idea', mint.firstIdeaLine({ date: D, handle: 'alice', mark: 'alice/an-idea' }),
    { kind: 'first-idea', date: D, handle: 'alice', n: 5, mark: 'alice/an-idea', by: 'the-town' }],
  ['welcome', mint.welcomeLine({ date: D, handle: 'alice', household: KEY_A }),
    { kind: 'welcome', date: D, handle: 'alice', n: 5, household: KEY_A, by: 'the-town' }],
  ['quest pay', mint.questPayLine({ date: D, handle: 'alice', quest: 'read-v2-feedback', household: KEY_A }),
    { kind: 'quest-pay', date: D, handle: 'alice', n: 5, quest: 'read-v2-feedback', household: KEY_A, by: 'the-town' }],
  ['invite, the invited side', mint.inviteInvitedLine({ date: D, handle: 'alice', invited: KEY_A, inviter: KEY_B }),
    { kind: 'invite', side: 'invited', date: D, handle: 'alice', n: 5, invited: KEY_A, inviter: KEY_B, activated: null, by: 'the-town' }],
  ['invite, the inviter side', mint.inviteInviterLine({ date: D, handle: 'bob', invited: KEY_A, inviter: KEY_B, activated: '2026-11-01' }),
    { kind: 'invite', side: 'inviter', date: D, handle: 'bob', n: 10, invited: KEY_A, inviter: KEY_B, activated: '2026-11-01', by: 'the-town' }],
  ['stage recredit', `- ${D} · MINT → alice · 5 · for: post:${POST}/diagnosed-recredit · by: the-town`,
    { kind: 'post-recredit', date: D, handle: 'alice', n: 5, post: POST, stage: 'diagnosed', by: 'the-town' }],
  ['correction burn', mint.meepCorrectionLines({ date: D, wrongs: [{ handle: 'mia', n: 5, stage: 'diagnosed', sig: SIG }], by: 'keemin' })[0],
    { kind: 'correction-burn', date: D, handle: 'mia', n: 5, sig: SIG, by: 'keemin' }],
  ['parcel burn', mint.parcelBurnLine({ date: D, handle: 'alice', n: 50, nth: 2, household: KEY_A }),
    { kind: 'parcel-burn', date: D, handle: 'alice', n: 50, nth: 2, household: KEY_A }],
  ['post stage', mint.stageMintLine({ date: D, handle: 'alice', n: 5, post: POST, stage: 'diagnosed' }),
    { kind: 'post-stage', date: D, handle: 'alice', n: 5, post: POST, stage: 'diagnosed', by: 'the-town' }],
  ['post award (a label that is no stage)', mint.awardMintLine({ date: D, handle: 'alice', n: 7, post: POST, label: 'fixed-2', by: 'keemin' }),
    { kind: 'post-award', date: D, handle: 'alice', n: 7, post: POST, label: 'fixed-2', by: 'keemin' }],
  ['town issuance', mint.townIssuanceLine({ date: D, handle: 'the-town', n: 20, purpose: 'upkeep', by: 'keemin', note: 'the shortfall' }),
    { kind: 'town-issuance', date: D, handle: 'the-town', n: 20, purpose: 'upkeep', by: 'keemin', note: 'the shortfall' }],
  ['friendship', mint.friendshipMintLine({ date: D, handle: 'alice', n: 5, friendWith: 'bob', cause: 'l7' }),
    { kind: 'friendship', date: D, handle: 'alice', n: 5, friendWith: 'bob', cause: 'l7' }],
  ['transfer', mint.transferLine({ date: D, from: 'alice', to: 'bob', n: 3, id: 'l8' }),
    { kind: 'transfer', date: D, from: 'alice', to: 'bob', n: 3, id: 'l8' }],
  ['a line in no grammar', `- ${D} · nonsense · alice`, { kind: 'unknown' }],
];

test('the corpus covers every kind classifyEntry can answer (the list is read from the source, not retyped)', () => {
  const src = readFileSync(join(HERE, 'census-fold.mjs'), 'utf8');
  const kindsInSource = new Set([...src.matchAll(/kind: '([a-z-]+)'/g)].map((m) => m[1]));
  const kindsInCorpus = new Set(CORPUS.map(([, , want]) => want.kind));
  assert.ok(kindsInSource.size >= 30, `control: the scan found the kinds (${kindsInSource.size})`);
  assert.deepEqual([...kindsInSource].filter((k) => !kindsInCorpus.has(k)).sort(), [], 'every kind has a corpus line');
});

test('classifyEntry reads every grammar as the grammar says, from census-fold and through stamp-mint alike', () => {
  for (const [what, line, want] of CORPUS) {
    assert.deepEqual(fold.classifyEntry(line), want, `${what}: census-fold classifies "${line}"`);
    assert.deepEqual(mint.classifyEntry(line), want, `${what}: stamp-mint's re-export answers the same`);
  }
});

test('the grammar pieces classifyEntry shares with stamp-mint: the ladder, the stages and the household key class', () => {
  assert.deepEqual(fold.parseLadder('10:10,5:5,0:1,x:y'), [{ threshold: 5, reward: 5 }, { threshold: 10, reward: 10 }]);
  assert.deepEqual(Object.keys(fold.STAGE_LADDER), ['confirmed', 'reproduced', 'diagnosed', 'briefed', 'fixed']);
  assert.deepEqual([...fold.RECREDIT_STAGES], ['diagnosed', 'briefed', 'fixed']);
  assert.deepEqual([...fold.KEEPING_RAILS], ['stripe', 'usdc', 'paypal', 'grant']);
  assert.ok(new RegExp(`^${fold.HOUSEHOLD_KEY}$`).test('hh:cadaeic.space'), 'a sealed registry key, dots and all');
  assert.ok(!new RegExp(`^${fold.HOUSEHOLD_KEY}$`).test('hh:a · b'), 'a key may not carry the field separator');
  assert.ok(mint.HOUSEHOLD_KEY_RE.test('hh:cadaeic.space') && !mint.HOUSEHOLD_KEY_RE.test('hh:a · b'), 'stamp-mint builds its key test from the same class');
  assert.ok(fold.HOLO_MINT_RE.test(mint.holoMintLine({ date: D, handle: 'alice', n: 0, pot: 'lights', epoch: '2026-11', ref: 'r' })));
});

// ── 3. the parser and the primary fold ───────────────────────────────────────

const LEDGER_LINES = [
  `# stamp ledger`,
  mint.rulesLine(D),
  mint.mintLine({ date: D, handle: 'alice', cause: 'l1', side: 'sent' }),                                         // alice 1
  mint.giftLine({ date: D, handle: 'alice', n: 10, slug: 'thanks', by: 'keemin' }),                               // alice 10
  mint.welcomeLine({ date: D, handle: 'bob', household: KEY_B }),                                                 // bob 5
  mint.inviteInvitedLine({ date: D, handle: 'alice', invited: KEY_A, inviter: KEY_B }),                           // alice 5
  mint.inviteInviterLine({ date: D, handle: 'bob', invited: KEY_A, inviter: KEY_B, activated: '2026-11-01' }),    // bob 10
  mint.transferLine({ date: D, from: 'alice', to: 'bob', n: 4, id: 'l8' }),                                       // moves, mints nothing
  mint.holoMintLine({ date: D, handle: 'bob', n: 9, pot: 'lights', epoch: '2026-11', ref: 'r1' }),                // holo is not PRIMARY
];

test('parseStampLedger: entry lines only, signed or not, CRLF or LF', () => {
  const signed = LEDGER_LINES.map((l, i) => (l.startsWith('- ') && i > 0 && i % 2 === 0 ? `${l} · sig: ${SIG}` : l));
  const entries = fold.parseStampLedger(signed.join('\r\n'));
  assert.equal(entries.length, LEDGER_LINES.length - 1, 'the heading is not an entry');
  assert.equal(entries[0].canonical, LEDGER_LINES[1]);
  assert.equal(entries[0].sig, null, 'an unsigned line is kept with a null sig');
  assert.equal(entries[1].canonical, LEDGER_LINES[2], 'the signature is cut off the canonical line');
  assert.equal(entries[1].sig, SIG);
  assert.equal(entries[1].raw, signed[2]);
  assert.deepEqual(mint.parseStampLedger(signed.join('\n')), fold.parseStampLedger(signed.join('\r\n')), 'the same answer through stamp-mint');
});

test('foldPrimaryMint: the arrow-bearing MINT rows, invite rows both sides included, and nothing that only moves or is holo', () => {
  const entries = fold.parseStampLedger(LEDGER_LINES.join('\n'));
  const primary = fold.foldPrimaryMint(entries);
  assert.deepEqual([...primary].sort(), [['alice', 16], ['bob', 15]], 'alice 1+10+5, bob 5+10; the transfer and bob\'s holo 9 are not primary');
  assert.deepEqual([...mint.foldPrimaryMint(entries)].sort(), [...primary].sort(), 'the same answer through stamp-mint');
  assert.equal(mint.foldMintCount(entries).get('bob'), 24, 'control: the all-sources fold, stamp-mint\'s own, still adds the holo 9');
});

// ── 4. THE FALSIFIER: census-fold imports nothing ────────────────────────────

// The scanner: comments out, then every way a module can reach another.
const importsOf = (source) => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const found = [];
  for (const m of code.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\s*(['"])([^'"]+)\1/gm)) found.push(m[2]);   // import x from 'y' / export { x } from 'y'
  for (const m of code.matchAll(/^\s*import\s*(['"])([^'"]+)\1/gm)) found.push(m[2]);                           // import 'y'
  for (const m of code.matchAll(/\bimport\s*\(\s*(['"`])([^'"`]+)\1/g)) found.push(m[2]);                       // import('y')
  for (const m of code.matchAll(/\bimport\s*\(\s*[^'"`\s)]/g)) found.push('<computed import()>');              // import(expr)
  for (const m of code.matchAll(/\brequire\s*\(\s*(['"`])([^'"`]+)\1/g)) found.push(m[2]);                      // require('y')
  return found;
};

test('the import scanner sees every way in (a control, before it is trusted on the real file)', () => {
  assert.deepEqual(importsOf(`import { classifyEntry } from './stamp-mint.mjs';`), ['./stamp-mint.mjs']);
  assert.deepEqual(importsOf(`import * as s from "./stamp-mint.mjs"\nconst x = 1;`), ['./stamp-mint.mjs']);
  assert.deepEqual(importsOf(`import {\n  a,\n  b,\n} from './stamp-mint.mjs';`), ['./stamp-mint.mjs']);
  assert.deepEqual(importsOf(`import './stamp-mint.mjs';`), ['./stamp-mint.mjs']);
  assert.deepEqual(importsOf(`export { a } from './stamp-mint.mjs';`), ['./stamp-mint.mjs']);
  assert.deepEqual(importsOf(`const s = await import('./stamp-mint.mjs');`), ['./stamp-mint.mjs']);
  assert.deepEqual(importsOf(`const s = await import(join(a, 'stamp-mint.mjs'));`), ['<computed import()>']);
  assert.deepEqual(importsOf(`const s = require('./stamp-mint.mjs');`), ['./stamp-mint.mjs']);
  assert.deepEqual(importsOf(`import { createHash } from 'node:crypto';`), ['node:crypto'], 'any import is seen, not only stamp-mint');
  assert.deepEqual(importsOf(`// import { x } from './stamp-mint.mjs';\n/* import y from './stamp-mint.mjs' */\nconst a = 1;`), [], 'a comment is not an import');
});

test('census-fold.mjs imports nothing from stamp-mint, and nothing at all (so a later stamp-mint change cannot reach it)', () => {
  const source = readFileSync(join(HERE, 'census-fold.mjs'), 'utf8');
  assert.ok(source.length > 10000 && source.includes('export function classifyEntry'), 'control: the scan reads the real module');
  const imports = importsOf(source);
  assert.ok(!imports.some((spec) => /stamp-mint/.test(spec)), `census-fold.mjs must not import stamp-mint.mjs, found: ${JSON.stringify(imports)}`);
  assert.deepEqual(imports, [], 'the module is self-contained: the census locks this one file alone');
});
