// stamp-quest-pay.test.mjs — a quest the town pays by hand-reviewed pass (POS-632).
//   node --test tools/stamp-quest-pay.test.mjs
// Zero-dep; builds throwaway repos in tmp; throwaway ed25519 keys.
//
// Darko, 2026-10-14 20:48: "quests are always paid by the town mint". Wright's
// Q2 the same night: one generic line, and a by-hand pass with a digest check:
//
//   - <date> · MINT → <handle> · <n> · for: quest:<quest-id>/<household-key> · by: the-town
//
// In order:
//   1. the grammar classifies as its own kind, and no sibling grammar mistakes it;
//   2. the line pins its terms from QUEST_PAY and refuses an unpaid quest and a
//      forging household key;
//   3. the verb writes one signed line that verifies, and refuses a housemate's
//      second line, a lying key, a date outside the window, a meep, and no room;
//   4. the verifier reds a wrong amount, a second line for one household, a
//      by: other than the-town, a quest not in the table, a lying key;
//   5. the registry row says both ways in and once per household (Darko 10-15);
//   6. the Hearth quest (POS-985): 10 once per household, closed until its day
//      is set at ship, and its row.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  classifyEntry, questPayLine, QUEST_PAY, questOpenOn, questWindowWords, parseStampLedger, foldBalances, sealChain, signSeal,
  giftLine, welcomeLine, firstIdeaLine, stageMintLine, mintLine, transferLine,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MINT_CLI = join(HERE, 'stamp-mint.mjs');

function town({ ledgerLines, pins = {}, addresses = {} }) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-quest-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(pins));
  for (const [handle, github] of Object.entries(addresses)) {
    mkdirSync(join(repo, 'WHITE_PAGES', handle), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', handle, 'ADDRESS.md'), `---\nhandle: ${handle}\n${github ? `github: ${github}\n` : ''}---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `# ledger\n\n${ledgerLines.join('\n')}\n`);
  return repo;
}
const D = (date, id, from, to) => `- ${date} · ${id} · ${from} → ${to} · thread: new`;
function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pub: publicKey.export({ type: 'spki', format: 'pem' }), priv: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}
function runMint(repo, args) {
  try { return { ok: true, out: execFileSync(process.execPath, [MINT_CLI, ...args, '--repo', repo], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { ok: false, out: String(e.stdout ?? '') + String(e.stderr ?? '') }; }
}
function forged(repo, pub, priv, lines) {
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const all = ['- 2026-06-12 · rules: stamps-v1', ...lines];
  const seals = sealChain(all);
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), '# stamp-ledger\n\n' + all.map((c, i) => `${c} · sig: ${signSeal(seals[i], priv)}`).join('\n') + '\n');
  return repo;
}
const Q = 'read-v2-feedback';
const PAY = (n = 5, { by = 'the-town', handle = 'alice', household = 'gh:1', quest = Q, date = '2026-10-16' } = {}) =>
  `- ${date} · MINT → ${handle} · ${n} · for: quest:${quest}/${household} · by: ${by}`;

// ── 1 · the grammar ─────────────────────────────────────────────────────────

test('1 · a quest pay classifies as its own kind', () => {
  const line = questPayLine({ date: '2026-10-16', handle: 'alice', quest: Q, household: 'gh:1' });
  assert.equal(line, PAY());
  assert.deepEqual(classifyEntry(line), { kind: 'quest-pay', date: '2026-10-16', handle: 'alice', n: 5, quest: Q, household: 'gh:1', by: 'the-town' });
  assert.equal(classifyEntry(PAY(5, { household: 'hh:cadaeic.space' })).household, 'hh:cadaeic.space', 'a dotted household key');
});

test('1 · no sibling grammar mistakes a quest pay, and a quest pay mistakes none of them', () => {
  const siblings = [
    [giftLine({ date: '2026-10-16', handle: 'alice', n: 5, slug: 'quest', by: 'keeminlee' }), 'gift'],
    [firstIdeaLine({ date: '2026-10-16', handle: 'alice', mark: 'alice/quest' }), 'first-idea'],
    [welcomeLine({ date: '2026-10-16', handle: 'alice', household: 'gh:1' }), 'welcome'],
    [stageMintLine({ date: '2026-10-16', handle: 'alice', n: 2, post: 'alice/quest', stage: 'confirmed' }), 'post-stage'],
    [mintLine({ date: '2026-10-16', handle: 'alice', cause: 'a-1', side: 'sent' }), 'mint'],
    [transferLine({ date: '2026-10-16', from: 'alice', to: 'bob', n: 2, id: 'a-1' }), 'transfer'],
  ];
  for (const [line, kind] of siblings) assert.equal(classifyEntry(line).kind, kind, line);
  for (const bad of [
    PAY().replace(' · by: the-town', ''),                          // no authority
    PAY(0),                                                         // a zero amount is never a line
    `- 2026-10-16 · MINT → alice · 5 · for: quest:${Q} · by: the-town`, // no household
  ]) assert.notEqual(classifyEntry(bad).kind, 'quest-pay', bad);
});

// ── 2 · the line ────────────────────────────────────────────────────────────

test('2 · the line pins the amount from QUEST_PAY and refuses an unpaid quest and a forging key', () => {
  assert.deepEqual(QUEST_PAY[Q], { amount: 5, once_per: 'household', from: '2026-10-15', until: null });
  assert.throws(() => questPayLine({ date: '2026-10-16', handle: 'alice', quest: 'nope', household: 'gh:1' }), /not a paid quest/);
  assert.throws(() => questPayLine({ date: '2026-10-16', handle: 'alice', quest: Q, household: 'gh:1 · by: keeminlee' }), /must be a key/);
});

// ── 3 · the verb ────────────────────────────────────────────────────────────

function founded({ meeps = false } = {}) {
  // alice and bob keep one account (gh:1); carol is her own house (gh:2)
  const repo = town({
    ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob'), D('2026-06-13', 'b-1', 'bob', 'alice')],
    pins: { alice: { id: 1 }, bob: { id: 1 }, carol: { id: 2 }, ferry: { id: 3 } },
    addresses: { alice: null, bob: null, carol: null, ferry: null },
  });
  const { pub, priv } = keypair();
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  execFileSync(process.execPath, [MINT_CLI, '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  if (meeps) runMint(repo, ['--declare-rules', 'stamps-v2', '--meeps', 'ferry', '--date', '2026-10-15', '--key', keyFile]);
  return { repo, pub, keyFile };
}
const questLines = (repo) => readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8').split('\n').filter((l) => l.includes('for: quest:'));

test('3 · --quest-mint writes ONE signed line per household that verifies; a housemate and a lying key are refused', () => {
  const { repo, pub, keyFile } = founded();
  const at = ['--date', '2026-10-16', '--key', keyFile, '--quest', Q];
  const first = runMint(repo, ['--quest-mint', 'alice', '--household', 'gh:1', ...at]);
  assert.equal(first.ok, true, first.out);
  assert.match(questLines(repo)[0], /^- 2026-10-16 · MINT → alice · 5 · for: quest:read-v2-feedback\/gh:1 · by: the-town · sig: /);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, v.problems.join('\n'));
  assert.ok(foldBalances(parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'))).get('alice') >= 5);

  const housemate = runMint(repo, ['--quest-mint', 'bob', '--household', 'gh:1', ...at]);
  assert.equal(housemate.ok, false);
  assert.match(housemate.out, /household already paid for quest:read-v2-feedback .*one line per quest and household, ever/);
  const lying = runMint(repo, ['--quest-mint', 'bob', '--household', 'gh:2', ...at]);
  assert.equal(lying.ok, false);
  assert.match(lying.out, /is not "bob"'s household/);
  const nextDoor = runMint(repo, ['--quest-mint', 'carol', '--household', 'gh:2', ...at]);
  assert.equal(nextDoor.ok, true, nextDoor.out);
  assert.equal(questLines(repo).length, 2);
  assert.equal(verifyStampLedger(repo, { pubkeyPem: pub }).ok, true, 'two houses, two lines, green');
  rmSync(repo, { recursive: true, force: true });
});

test('3 · --quest-mint refuses a date before the quest opens, an unpaid quest, a meep and a handle with no room', () => {
  const { repo, keyFile } = founded({ meeps: true });
  const early = runMint(repo, ['--quest-mint', 'alice', '--household', 'gh:1', '--quest', Q, '--date', '2026-10-14', '--key', keyFile]);
  assert.equal(early.ok, false);
  assert.match(early.out, /pays from 2026-10-15, not on 2026-10-14/);
  const unpaid = runMint(repo, ['--quest-mint', 'alice', '--household', 'gh:1', '--quest', 'nope', '--date', '2026-10-16', '--key', keyFile]);
  assert.equal(unpaid.ok, false);
  assert.match(unpaid.out, /"nope" is not a paid quest/);
  const meep = runMint(repo, ['--quest-mint', 'ferry', '--household', 'gh:3', '--quest', Q, '--date', '2026-10-16', '--key', keyFile]);
  assert.equal(meep.ok, false);
  assert.match(meep.out, /"ferry" is a meep at 2026-10-16/);
  const ghost = runMint(repo, ['--quest-mint', 'nobody', '--household', 'gh:9', '--quest', Q, '--date', '2026-10-16', '--key', keyFile]);
  assert.equal(ghost.ok, false);
  assert.match(ghost.out, /no WHITE_PAGES room for "nobody"/);
  assert.equal(questLines(repo).length, 0);
  rmSync(repo, { recursive: true, force: true });
});

// ── 4 · the verifier ────────────────────────────────────────────────────────

function verdict(lines) {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [], pins: { alice: { id: 1 }, bob: { id: 1 }, carol: { id: 2 } }, addresses: { alice: null, bob: null, carol: null } });
  forged(repo, pub, priv, lines);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  rmSync(repo, { recursive: true, force: true });
  assert.ok(!v.problems.some((p) => /SIGNATURE FAILS|UNSIGNED/.test(p)), 'the lines must be properly signed, or this tests the seal instead of the law');
  return v;
}

test('4 · the verifier stays GREEN on lawful quest pays, one per household', () => {
  const v = verdict([PAY(), PAY(5, { handle: 'carol', household: 'gh:2' })]);
  assert.equal(v.ok, true, v.problems.join('\n'));
  assert.equal(v.minted, 10);
});

test('4 · the verifier REDS a wrong amount, a second line for one household, a hand\'s by:, an unpaid quest, an early date and a lying key', () => {
  const reds = [
    [[PAY(6)], /quest:read-v2-feedback pays exactly 5 \(got 6\)/],
    [[PAY(), PAY(5, { handle: 'bob' })], /quest:read-v2-feedback is paid twice to household/],
    [[PAY(5, { by: 'keeminlee' })], /a quest is the town's mint \(by: "keeminlee", must be the-town\)/],
    [[PAY(5, { quest: 'nope' })], /quest:nope is not a paid quest/],
    [[PAY(5, { date: '2026-10-14' })], /pays from 2026-10-15, not on 2026-10-14/],
    [[PAY(5, { handle: 'bob', household: 'gh:2' })], /names household "gh:2" but "bob" is/],
  ];
  for (const [lines, re] of reds) {
    const v = verdict(lines);
    assert.equal(v.ok, false, String(re));
    assert.ok(v.problems.some((p) => re.test(p)), `${re}\n${v.problems.join('\n')}`);
  }
});

// 5. Darko 2026-10-15 11:17 (Q1/Q3): the quest's own words, on its registry row
//    (the quest card reads `source`), say both ways in and that a household is
//    paid once; nothing on the row or in the table pays per resident.
test('the read-v2-feedback row says both ways (the designated discussion, a letter to the postmaster) and once per household', () => {
  const reg = JSON.parse(readFileSync(join(HERE, '..', 'quest-registry.json'), 'utf8'));
  const row = reg.quests.find((q) => q.id === 'read-v2-feedback');
  assert.match(row.source, /comment on the "Read v2 feedback" discussion in postmark-town\/postmark-blueprints/);
  assert.match(row.source, /or write to the postmaster with the title "v2 feedback"/);
  assert.match(row.source, /once per household: a household that does both is paid once/);
  assert.match(row.awaits, /designated discussion.*or a letter to the postmaster/);
  assert.equal(row.reward, '5 stamps, once per household');
  assert.equal(QUEST_PAY['read-v2-feedback'].once_per, 'household');
  for (const text of [row.source, row.awaits, row.reward, row.resets, row.derivation])
    assert.doesNotMatch(text.replace(/never per resident/g, ''), /per[- ]resident|each resident/i, 'no text on the row suggests paying per resident');
});

// ── 6 · the Hearth quest (POS-985) ──────────────────────────────────────────
// LAW (Darko 2026-11-01 20:08 EST, POS-845): "let's say 10 stamps for entering
// and 100 to the winner". The 10 is this quest, once per household; the 100 is
// the founder gift, not a quest line. Its `from` is the town day the contest is
// announced, set at ship (POS-684 call 3 and 5e); until then the quest is closed.

const H = 'hearth-entry';
const OPENS = QUEST_PAY[H].from;
const HPAY = (n = 10, { handle = 'alice', household = 'gh:1', date = OPENS ?? '2026-11-10' } = {}) => PAY(n, { handle, household, quest: H, date });
const dayBefore = (d) => new Date(Date.parse(`${d}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);

test('6 · the Hearth quest pays exactly 10, once per household, and opens on a day set at ship', () => {
  const t = QUEST_PAY[H];
  assert.deepEqual([t.amount, t.once_per, t.until], [10, 'household', null], 'LAW: "10 stamps for entering"');
  assert.ok(t.from === null || /^\d{4}-\d{2}-\d{2}$/.test(t.from), `from is null (closed) or a town day, got ${JSON.stringify(t.from)}`);
  const line = questPayLine({ date: '2026-11-10', handle: 'alice', quest: H, household: 'gh:1' });
  assert.equal(line, '- 2026-11-10 · MINT → alice · 10 · for: quest:hearth-entry/gh:1 · by: the-town');
  assert.deepEqual(classifyEntry(line), { kind: 'quest-pay', date: '2026-11-10', handle: 'alice', n: 10, quest: H, household: 'gh:1', by: 'the-town' });
});

test('6 · questOpenOn: a quest with no `from` is closed on every day; a set one opens on its day and closes after `until`', () => {
  // the control: the bare comparison this judge replaces reads a null `from` as open
  assert.equal('2026-11-10' < null, false, 'date < null is false, so `date < from` alone would let a closed quest pay');
  for (const d of ['2026-01-01', '2026-11-10', '2099-12-31']) assert.equal(questOpenOn({ from: null, until: null }, d), false, d);
  assert.equal(questOpenOn({ from: '2026-11-10', until: null }, '2026-11-09'), false);
  assert.equal(questOpenOn({ from: '2026-11-10', until: null }, '2026-11-10'), true);
  assert.equal(questOpenOn({ from: '2026-11-10', until: '2026-12-08' }, '2026-12-08'), true);
  assert.equal(questOpenOn({ from: '2026-11-10', until: '2026-12-08' }, '2026-12-09'), false);
  assert.equal(questWindowWords({ from: null, until: null }), 'is not open (QUEST_PAY names no opening day)');
  assert.equal(questWindowWords(QUEST_PAY[Q]), 'pays from 2026-10-15', 'the v2 refusal reads as it always did');
});

test('6 · while its day is unset the Hearth quest is CLOSED: the verb refuses it and the verifier reds it, and v2 still pays',
  { skip: OPENS != null && `opened at ship (from ${OPENS}); the open-path test below runs instead` }, () => {
    const { repo, pub, keyFile } = founded();
    const closed = runMint(repo, ['--quest-mint', 'alice', '--household', 'gh:1', '--quest', H, '--date', '2026-11-10', '--key', keyFile]);
    assert.equal(closed.ok, false);
    assert.match(closed.out, /hearth-entry is not open \(QUEST_PAY names no opening day\), not on 2026-11-10/);
    const v2 = runMint(repo, ['--quest-mint', 'alice', '--household', 'gh:1', '--quest', Q, '--date', '2026-11-10', '--key', keyFile]);
    assert.equal(v2.ok, true, `the control: the same verb, house and day pay an open quest\n${v2.out}`);
    assert.equal(questLines(repo).length, 1);
    assert.equal(verifyStampLedger(repo, { pubkeyPem: pub }).ok, true);
    rmSync(repo, { recursive: true, force: true });
    const v = verdict([HPAY()]);
    assert.equal(v.ok, false);
    assert.ok(v.problems.some((p) => /quest:hearth-entry is not open \(QUEST_PAY names no opening day\), not on 2026-11-10/.test(p)), v.problems.join('\n'));
  });

test('6 · once open, the Hearth quest pays 10 from its day, once per household; the verifier reds 9 and a second line',
  { skip: OPENS == null && 'closed until its from is set at ship (QUEST_PAY, tools/stamp-mint.mjs); the closed-path test above runs instead' }, () => {
    const { repo, pub, keyFile } = founded();
    const at = ['--quest', H, '--key', keyFile];
    const early = runMint(repo, ['--quest-mint', 'alice', '--household', 'gh:1', '--date', dayBefore(OPENS), ...at]);
    assert.equal(early.ok, false);
    assert.match(early.out, new RegExp(`hearth-entry pays from ${OPENS}, not on ${dayBefore(OPENS)}`));
    const first = runMint(repo, ['--quest-mint', 'alice', '--household', 'gh:1', '--date', OPENS, ...at]);
    assert.equal(first.ok, true, first.out);
    assert.match(questLines(repo)[0], new RegExp(`^- ${OPENS} · MINT → alice · 10 · for: quest:hearth-entry/gh:1 · by: the-town · sig: `));
    const housemate = runMint(repo, ['--quest-mint', 'bob', '--household', 'gh:1', '--date', OPENS, ...at]);
    assert.equal(housemate.ok, false);
    assert.match(housemate.out, /household already paid for quest:hearth-entry/);
    assert.equal(verifyStampLedger(repo, { pubkeyPem: pub }).ok, true);
    rmSync(repo, { recursive: true, force: true });
    assert.equal(verdict([HPAY(), HPAY(10, { handle: 'carol', household: 'gh:2' })]).ok, true, 'two houses, green');
    for (const [lines, re] of [
      [[HPAY(9)], /quest:hearth-entry pays exactly 10 \(got 9\)/],
      [[HPAY(), HPAY(10, { handle: 'bob' })], /quest:hearth-entry is paid twice to household/],
    ]) {
      const v = verdict(lines);
      assert.equal(v.ok, false, String(re));
      assert.ok(v.problems.some((p) => re.test(p)), `${re}\n${v.problems.join('\n')}`);
    }
  });

test('the hearth-entry row names the folder, once per household, and the winner\'s 100 as the founder\'s gift', () => {
  const reg = JSON.parse(readFileSync(join(HERE, '..', 'quest-registry.json'), 'utf8'));
  const row = reg.quests.find((q) => q.id === H);
  assert.equal(row.validation, 'needs-review');
  assert.match(row.source, /PROJECTS\/household-hearths\//);
  // what the pass pays by, in the words a resident reads (Truey's FIX on #4586): the author line
  assert.match(row.source, /the author: line takes your handle, or your household's slug/);
  const readme = readFileSync(join(HERE, '..', 'PROJECTS', 'household-hearths', 'README.md'), 'utf8');
  assert.match(readme, /hearth\.md +← title, author \(your handle, or your household's slug\)/, 'the README says the same');
  assert.doesNotMatch(readme, /author \(you\)/);
  assert.match(row.source, /10 stamps, paid once per household/);
  assert.match(row.source, /100 stamps, the founder's gift/);
  assert.equal(row.reward, '10 stamps, once per household');
  assert.match(row.derivation, /quest:hearth-entry\/<household-key>/);
  for (const text of [row.source, row.awaits, row.reward, row.resets, row.derivation])
    assert.doesNotMatch(text.replace(/never per resident/g, ''), /per[- ]resident|each resident/i, 'no text on the row suggests paying per resident');
});
