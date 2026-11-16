// stamp-post.test.mjs — the idea posts' four ledger lines: the grammar, the folds, the verifier, the verb.
//   node --test tools/stamp-post.test.mjs
// Zero-dep; builds throwaway repos in tmp; throwaway ed25519 keys.
//
// POS-290 (Darko's re-scope, 2026-10-09; the grammar ruled by Wright the same
// evening). Ideas become posts, and the ledger learns four lines:
//
//   - <date> · MINT → <handle> · <n> · for: post:<author>/<slug>/<label> · by: <hand>
//   - <date> · <handle> → stake:post/<author>/<slug> · <n> · side: <for|against> · via: <channel>
//   - <date> · stake:post/<author>/<slug> → <handle> · <n> · for: unstake · via: <channel>
//   - <date> · stake:post/<author>/<slug> → <handle> · <n> · for: post-return
//
// The grammar ships inert: nothing writes these lines until the office does. An
// unknown line halts every mint and stake (walkLedger's REPLAY DIVERGES), so the
// grammar lands first. In order:
//   1. each line classifies as its own kind, and no sibling grammar claims it,
//      nor it them; the lookaheads keep a malformed post line out of the ballot's;
//   2. the builders refuse what would forge or misfile a line;
//   3. the three balance holders agree: a `pays:` letter at the edge of a balance
//      built from every new kind settles the same in the mint pass and in the
//      verifier;
//   4. the verifier is green on a lawful sequence and red, by name, on each rule;
//   5. the verb writes one signed award that verifies, and refuses what the law does.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  classifyEntry, parseStampLedger, foldBalances, foldStaked, sealChain, signSeal, appendSigned,
  awardMintLine, postStakeLine, postUnstakeLine, postReturnLine, AWARD_MAX, AWARD_HANDS, STAGE_LADDER,
  stageMintLine, giftLine, transferLine, worldStakeLine, worldUnstakeLine, potStakeLine, potUnstakeLine,
  potReturnLine, stakeLine, returnLine,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MINT_CLI = join(HERE, 'stamp-mint.mjs');

const P = 'alice/a-better-door';
const DATE = '2026-10-07';
const AWARD = (n, label = 'design', by = 'wright', handle = 'alice', post = P) =>
  `- ${DATE} · MINT → ${handle} · ${n} · for: post:${post}/${label} · by: ${by}`;
const STAKE = (handle, n, side = 'for', post = P) => `- ${DATE} · ${handle} → stake:post/${post} · ${n} · side: ${side} · via: api`;
const UNSTAKE = (handle, n, post = P) => `- ${DATE} · stake:post/${post} → ${handle} · ${n} · for: unstake · via: api`;
const RETURN = (handle, n, post = P) => `- ${DATE} · stake:post/${post} → ${handle} · ${n} · for: post-return`;
const GIFT = (handle, n, date = '2026-06-20') => `- ${date} · MINT → ${handle} · ${n} · for: gift:seed · by: keemin`;

// ── 1 · the grammar ─────────────────────────────────────────────────────────

test('1 · each new line classifies as its own kind, with its fields', () => {
  assert.deepEqual(classifyEntry(awardMintLine({ date: DATE, handle: 'alice', n: 7, post: P, label: 'design', by: 'wright' })),
    { kind: 'post-award', date: DATE, handle: 'alice', n: 7, post: P, label: 'design', by: 'wright' });
  assert.deepEqual(classifyEntry(postStakeLine({ date: DATE, handle: 'bob', post: P, n: 3, side: 'against', via: 'mail:b-9' })),
    { kind: 'post-stake', date: DATE, handle: 'bob', post: P, n: 3, side: 'against', via: 'mail:b-9' });
  assert.deepEqual(classifyEntry(postUnstakeLine({ date: DATE, post: P, handle: 'bob', n: 1, via: 'api' })),
    { kind: 'post-unstake', date: DATE, post: P, handle: 'bob', n: 1, via: 'api' });
  assert.deepEqual(classifyEntry(postReturnLine({ date: DATE, post: P, handle: 'bob', n: 2 })),
    { kind: 'post-return', date: DATE, post: P, handle: 'bob', n: 2 });
  // a handle with a dot authors a post; the id still splits from the label at the last slash
  const dotted = classifyEntry(AWARD(5, 'map-drawing', 'keemin', 'bob', 'victor-b.-rose-e./map-drifts'));
  assert.deepEqual([dotted.kind, dotted.post, dotted.label, dotted.by], ['post-award', 'victor-b.-rose-e./map-drifts', 'map-drawing', 'keemin']);
});

test('1 · a stage line and an award line never claim each other', () => {
  for (const [stage, rung] of Object.entries(STAGE_LADDER)) {
    assert.equal(classifyEntry(stageMintLine({ date: DATE, handle: 'alice', n: rung[0], post: P, stage })).kind, 'post-stage', stage);
    // the same shape with a hand's by: is still a stage line, never an award
    assert.equal(classifyEntry(AWARD(rung[0], stage)).kind, 'post-stage', `${stage} by a hand`);
    // a label that only STARTS with a stage's name is an award
    assert.equal(classifyEntry(AWARD(4, `${stage}-2`)).kind, 'post-award', `${stage}-2`);
  }
});

test('1 · no new line reads as a stake, a return, a transfer or a stage line', () => {
  const lines = [
    AWARD(7), STAKE('alice', 3), STAKE('bob', 3, 'against'), UNSTAKE('alice', 1), RETURN('alice', 2),
    `- ${DATE} · alice → stake:post/${P} · 3 · side: for · via: mail:a-9`,            // carried by a letter
    `- ${DATE} · stake:post/${P} → alice · 1 · for: unstake · via: mail:a-9`,
  ];
  for (const line of lines) {
    const k = classifyEntry(line).kind;
    assert.ok(k.startsWith('post-') && k !== 'post-stage', `${line} → ${k}`);
    assert.ok(!['stake', 'return', 'transfer', 'pot-stake', 'pot-unstake', 'world-stake', 'world-unstake'].includes(k), line);
  }
});

test('1 · the lines the new grammar sits beside classify as before', () => {
  const siblings = [
    [worldStakeLine({ date: DATE, handle: 'alice', mark: 'alice/a-better-door', n: 2, via: 'api' }), 'world-stake'],
    [worldUnstakeLine({ date: DATE, mark: 'alice/a-better-door', handle: 'alice', n: 2 }), 'world-unstake'],
    [potStakeLine({ date: DATE, handle: 'alice', pot: 'darko', n: 2, via: 'api' }), 'pot-stake'],
    [potUnstakeLine({ date: DATE, pot: 'darko', handle: 'alice', n: 2, via: 'api' }), 'pot-unstake'],
    [potReturnLine({ date: DATE, pot: 'darko', handle: 'alice', n: 2, epoch: '2026-10' }), 'pot-return'],
    [stakeLine({ date: DATE, handle: 'alice', topic: 'illuminator-name', candidate: 'Iris', n: 2, via: 'api' }), 'stake'],
    [returnLine({ date: DATE, topic: 'illuminator-name', candidate: 'Iris', handle: 'alice', n: 2 }), 'return'],
    [transferLine({ date: DATE, from: 'alice', to: 'bob', n: 2, id: 'a-1' }), 'transfer'],
    [stageMintLine({ date: DATE, handle: 'alice', n: 2, post: P, stage: 'confirmed' }), 'post-stage'],
    [giftLine({ date: DATE, handle: 'alice', n: 2, slug: 'post', by: 'keemin' }), 'gift'],
  ];
  for (const [line, kind] of siblings) assert.equal(classifyEntry(line).kind, kind, line);
});

test('1 · a post line with its author half dropped is unknown, never a vote stake or return on a topic called "post"', () => {
  // the world-mark lookahead's own lesson: a malformed line must fail as unknown, not parse as the wrong kind
  assert.equal(classifyEntry(`- ${DATE} · wright → stake:post/thebench · 3 · via: api`).kind, 'unknown');
  assert.equal(classifyEntry(`- ${DATE} · stake:post/thebench → wright · 3 · for: close`).kind, 'unknown');
  // and lines that look like the new ones and are not: refused by the grammar, not misread
  for (const bad of [
    `- ${DATE} · alice → stake:post/${P} · 3 · side: maybe · via: api`,     // no such side
    `- ${DATE} · alice → stake:post/${P} · 3 · via: api`,                    // no side at all
    `- ${DATE} · alice → stake:post/${P} · 0 · side: for · via: api`,        // a zero stake is never a line
    `- ${DATE} · stake:post/${P} → alice · 3 · for: post-return · via: api`, // a return names no channel
    AWARD(5, 'Design'),                                                     // a label is lowercase kebab
    AWARD(5, 'a'.repeat(41)),                                               // and at most 40 characters
    AWARD(0),                                                               // a zero award is never a line
    AWARD(5).replace(' · by: wright', ''),                                  // an award names its hand
  ]) assert.equal(classifyEntry(bad).kind, 'unknown', bad);
});

// ── 2 · the builders ────────────────────────────────────────────────────────

test('2 · the builders refuse what would forge or misfile a line', () => {
  const ok = { date: DATE, handle: 'alice', n: 5, post: P, label: 'design', by: 'wright' };
  assert.throws(() => awardMintLine({ ...ok, label: 'fixed' }), /"fixed" is a bug stage's name/);
  assert.throws(() => awardMintLine({ ...ok, label: 'Design' }), /the label must be kebab-case/);
  assert.throws(() => awardMintLine({ ...ok, n: AWARD_MAX + 1 }), /201 is over the most one award may pay \(200\)/);
  assert.throws(() => awardMintLine({ ...ok, n: 0 }), /whole number ≥ 1/);
  assert.throws(() => awardMintLine({ ...ok, by: 'architect' }), /by: must be one of the hands \(keemin, wright\)/);
  assert.throws(() => awardMintLine({ ...ok, post: `${P} · by: keemin` }), /must be a post id/);
  assert.throws(() => postStakeLine({ date: DATE, handle: 'alice', post: P, n: 2, side: 'maybe', via: 'api' }), /for or against/);
  assert.throws(() => postStakeLine({ date: DATE, handle: 'alice', post: P, n: 2, side: 'for', via: 'api · side: against' }), /one token with no "·"/);
  assert.throws(() => postUnstakeLine({ date: DATE, post: 'alice', handle: 'alice', n: 2, via: 'api' }), /must be a post id/);
  assert.throws(() => postReturnLine({ date: DATE, post: P, handle: 'alice', n: 1.5 }), /whole number ≥ 1/);
  assert.equal(AWARD_MAX, 200);
  assert.deepEqual([...AWARD_HANDS], ['keemin', 'wright']);
});

// ── shared rigs ─────────────────────────────────────────────────────────────

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pub: publicKey.export({ type: 'spki', format: 'pem' }), priv: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}
function town(mail, rooms = ['alice', 'bob', 'carol', 'bugcatcher']) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-post-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(Object.fromEntries(rooms.map((h, i) => [h, { id: i + 1 }]))));
  for (const h of rooms) {
    mkdirSync(join(repo, 'WHITE_PAGES', h), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', h, 'ADDRESS.md'), `---\nhandle: ${h}\n---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `# ledger\n\n${mail.join('\n')}\n`);
  return repo;
}
const D = (date, id, from, to, pays = null) => `- ${date} · ${id} · ${from} → ${to}${pays != null ? ` · pays: ${pays}` : ''} · thread: new`;
function runMint(repo, args) {
  try {
    return { ok: true, out: execFileSync(process.execPath, [MINT_CLI, ...args, '--repo', repo], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { ok: false, out: String(e.stdout ?? '') + String(e.stderr ?? '') };
  }
}
const ledgerOf = (repo) => parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'));

// ── 3 · the three holders agree ─────────────────────────────────────────────

test('3 · the mint pass, foldBalances and the verifier settle a pays: letter at the edge of every new kind the same way', () => {
  // Alice's balance is built from every kind the mint fold names. The first
  // letter pays exactly what she holds (a transfer, only if every credit is
  // counted); the second pays 1 from nothing (a void, only if the stake's debit
  // is counted). A holder that misses a kind writes the other decision, and the
  // verifier's ledger-order replay reads SETTLEMENT DIVERGES.
  const { pub, priv } = keypair();
  const repo = town([D('2026-06-12', 'a-1', 'alice', 'bob'), D('2026-06-13', 'b-1', 'bob', 'alice')]);
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  assert.equal(runMint(repo, ['--append', '--key', keyFile]).ok, true);
  appendSigned(repo, [
    GIFT('alice', 20), GIFT('bob', 10),
    AWARD(7),                                                   // +7
    stageMintLine({ date: DATE, handle: 'alice', n: 2, post: P, stage: 'confirmed' }), // +2
    STAKE('alice', 5),                                          // −5
    STAKE('bob', 3, 'against'),
    UNSTAKE('alice', 2),                                        // +2
    RETURN('alice', 3),                                         // +3, the whole of what is left
    RETURN('bob', 3),
  ], priv);
  const liquid = foldBalances(ledgerOf(repo)).get('alice');
  assert.equal(liquid, 2 + 20 + 7 + 2 - 5 + 2 + 3, 'alice: 2 from the mail, 20 gifted, then the post lines');
  // assets = liquid + staked holds through the new kinds (the three tenses)
  assert.equal(foldStaked(ledgerOf(repo)).get('alice') ?? 0, 0);
  // two letters: her own sent-mint lands before the first; the second is the same pair on the same day, so it mints nothing
  appendFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'),
    `${D('2026-10-08', 'c-1', 'alice', 'bob', liquid + 1)}\n${D('2026-10-08', 'c-2', 'alice', 'bob', 1)}\n`);
  const appended = runMint(repo, ['--append', '--key', keyFile]);
  assert.equal(appended.ok, true, appended.out);
  const settled = ledgerOf(repo).map((e) => classifyEntry(e.canonical)).filter((c) => c.kind === 'transfer' || c.kind === 'void');
  assert.deepEqual(settled.map((c) => [c.id, c.kind]), [['c-1', 'transfer'], ['c-2', 'void']]);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, v.problems.join('\n'));
  assert.equal(foldBalances(ledgerOf(repo)).get('alice'), 0);
  rmSync(repo, { recursive: true, force: true });
});

test('3 · an open post stake is in the staked tense, and the post\'s escrow account holds it', () => {
  const entries = [GIFT('alice', 10), STAKE('alice', 4), UNSTAKE('alice', 1)].map((canonical) => ({ canonical }));
  assert.equal(foldStaked(entries).get('alice'), 3);
  assert.equal(foldBalances(entries).get('alice'), 7);
  assert.equal(foldBalances(entries).get(`stake:post/${P}`), 3);
});

// ── 4 · the verifier ────────────────────────────────────────────────────────

function verdict(lines) {
  const { pub, priv } = keypair();
  const repo = town([]);
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const all = ['- 2026-06-12 · rules: stamps-v1', ...lines];
  const seals = sealChain(all);
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'),
    '# stamp-ledger\n\n' + all.map((c, i) => `${c} · sig: ${signSeal(seals[i], priv)}`).join('\n') + '\n');
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  rmSync(repo, { recursive: true, force: true });
  assert.ok(!v.problems.some((p) => /SIGNATURE FAILS|UNSIGNED/.test(p)), 'the lines must be properly signed, or this tests the seal instead of the law');
  return v;
}
const FUNDED = [GIFT('alice', 20), GIFT('bob', 20), GIFT('carol', 20)];
const MEEP_LAW = '- 2026-09-20 · rules: stamps-v2 · meeps: bugcatcher';
function red(lines, re) {
  const v = verdict(lines);
  assert.equal(v.ok, false, 'the verifier stayed green');
  assert.ok(v.problems.some((p) => re.test(p)), v.problems.join('\n'));
}

test('4 · GREEN on a lawful sequence: a stake for, a stake against by another, a partial unstake, the rest returned, an award', () => {
  const v = verdict([...FUNDED,
    STAKE('alice', 5), STAKE('bob', 3, 'against'), UNSTAKE('alice', 2), RETURN('alice', 3), RETURN('bob', 3),
    AWARD(25, 'the-first-draft', 'keemin', 'carol'), AWARD(200, 'built-it', 'wright', 'alice')]);
  assert.equal(v.ok, true, v.problems.join('\n'));
  assert.equal(v.minted, 60 + 225);
});

test('4 · RED: an unstake above one\'s own position, though the post\'s account could cover it', () => {
  red([...FUNDED, STAKE('alice', 3), STAKE('bob', 5, 'against'), UNSTAKE('alice', 4)],
    /LAWFUL fails — alice unstakes 4 from post alice\/a-better-door but holds only 3 there/);
});

test('4 · RED: an unstake of another resident\'s stake', () => {
  red([...FUNDED, STAKE('bob', 5), UNSTAKE('carol', 2)],
    /LAWFUL fails — carol unstakes 2 from post alice\/a-better-door but holds only 0 there/);
});

test('4 · RED: a second return to the same post and resident, even when it equals a fresh position', () => {
  red([...FUNDED, STAKE('alice', 3), RETURN('alice', 3), STAKE('alice', 2), RETURN('alice', 2)],
    /LAWFUL fails — post alice\/a-better-door already returned alice's stake \(one return per post and resident, ever\)/);
});

test('4 · RED: a return that is not the whole position', () => {
  red([...FUNDED, STAKE('alice', 5), RETURN('alice', 3)],
    /LAWFUL fails — a post return is whole: 3 to alice on post alice\/a-better-door, but the open position is 5/);
});

test('4 · RED: a stake on the other side while one stands', () => {
  red([...FUNDED, STAKE('alice', 3), STAKE('alice', 2, 'against')],
    /LAWFUL fails — alice stakes against on post alice\/a-better-door while holding 3 for there \(a position has one side\)/);
});

test('4 · RED: a meep stake, though the meep holds stamps from before the law', () => {
  red([GIFT('bugcatcher', 10, '2026-06-20'), MEEP_LAW, STAKE('bugcatcher', 3)],
    /LAWFUL fails — meep "bugcatcher" cannot stake/);
});

test('4 · RED: an award to a meep', () => {
  red([MEEP_LAW, AWARD(5, 'design', 'wright', 'bugcatcher')], /LAWFUL fails — award to meep "bugcatcher"/);
});

test('4 · RED: a second award under one label on one post', () => {
  red([AWARD(5), AWARD(5, 'design', 'keemin', 'bob')], /LAWFUL fails — post:alice\/a-better-door\/design is awarded twice/);
});

test('4 · RED: an award under a bug stage\'s name, named for what it is', () => {
  red([AWARD(25, 'fixed')], /LAWFUL fails — post:alice\/a-better-door\/fixed is an award by wright under a bug stage's name/);
});

test('4 · RED: an award over 200', () => {
  red([AWARD(201)], /LAWFUL fails — an award pays at most 200, not 201/);
});

test('4 · RED: an award by anyone but wright or keemin', () => {
  red([AWARD(5, 'design', 'architect')], /LAWFUL fails — an award is paid by a hand \(keemin or wright\), not by "architect"/);
});

// ── 5 · the verb ────────────────────────────────────────────────────────────

function founded() {
  const { pub, priv } = keypair();
  const repo = town([D('2026-06-12', 'a-1', 'alice', 'bob'), D('2026-06-13', 'b-1', 'bob', 'alice')]);
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  assert.equal(runMint(repo, ['--append', '--key', keyFile]).ok, true);
  return { repo, pub, keyFile };
}
const awardLines = (repo) => readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8').split('\n').filter((l) => l.includes('for: post:'));

test('5 · --award-mint writes ONE signed line that verifies; a second for the same post and label is refused and writes nothing', () => {
  const { repo, pub, keyFile } = founded();
  const args = ['--post', P, '--label', 'design', '--amount', '25', '--by', 'wright', '--date', DATE, '--key', keyFile];
  const first = runMint(repo, ['--award-mint', 'carol', ...args]);
  assert.equal(first.ok, true, first.out);
  assert.equal(awardLines(repo).length, 1);
  assert.match(awardLines(repo)[0], /^- 2026-10-07 · MINT → carol · 25 · for: post:alice\/a-better-door\/design · by: wright · sig: /);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, v.problems.join('\n'));
  const again = runMint(repo, ['--award-mint', 'bob', ...args]);
  assert.equal(again.ok, false);
  assert.match(again.out, /post:alice\/a-better-door\/design is already paid .*one line per post and label, ever/);
  assert.equal(awardLines(repo).length, 1, 'a refused award wrote a line');
  rmSync(repo, { recursive: true, force: true });
});

test('5 · --award-mint refuses a stage label, over 200, a hand who is not one, a meep, and a handle with no room', () => {
  const { repo, keyFile } = founded();
  const base = (o = {}) => ['--post', P, '--label', o.label ?? 'design', '--amount', o.amount ?? '5', '--by', o.by ?? 'keemin', '--date', DATE, '--key', keyFile];
  for (const [who, o, re] of [
    ['alice', { label: 'fixed' }, /"fixed" is a bug stage's name/],
    ['alice', { amount: '201' }, /201 is over the most one award may pay \(200\)/],
    ['alice', { by: 'architect' }, /by: must be one of the hands/],
    ['nobody', {}, /no WHITE_PAGES room for "nobody"/],
  ]) {
    const r = runMint(repo, ['--award-mint', who, ...base(o)]);
    assert.equal(r.ok, false, `${who} ${JSON.stringify(o)}`);
    assert.match(r.out, re);
  }
  assert.equal(runMint(repo, ['--declare-rules', 'stamps-v2', '--meeps', 'bugcatcher', '--date', '2026-09-20', '--key', keyFile]).ok, true);
  const meep = runMint(repo, ['--award-mint', 'bugcatcher', ...base()]);
  assert.equal(meep.ok, false);
  assert.match(meep.out, /"bugcatcher" is a meep at 2026-10-07 — meeps stay outside the currency/);
  assert.equal(awardLines(repo).length, 0);
  rmSync(repo, { recursive: true, force: true });
});
