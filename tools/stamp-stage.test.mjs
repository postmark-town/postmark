// stamp-stage.test.mjs — a bug's stage stamps: the grammar, the verb, the verifier.
//   node --test tools/stamp-stage.test.mjs
// Zero-dep; builds throwaway repos in tmp; throwaway ed25519 keys.
//
// The Posts project, phase 2 (Keemin, 2026-09-29): bugs pay the flat ladder —
// confirmed 2, reproduced 3, diagnosed 5, briefed 10 light / 5 heavy, fixed
// 10 / 25 / 50 by size — minted by the office's reviewed stage pass through
// `--stage-mint`, one signed line per post and stage:
//
//   - <date> · MINT → <handle> · <N> · for: post:<post-id>/<stage> · by: the-town
//
// In order:
//   1. the grammar classifies as its own kind, and no sibling grammar mistakes it
//      (nor it them);
//   2. the line refuses what would forge it: an off-ladder amount, an unpaid
//      stage, a post id carrying the field separator;
//   3. the verb writes one signed line that verifies, and refuses a second line
//      for the same post and stage, an off-ladder amount, a meep, and a handle
//      with no room;
//   4. the verifier reds a forged amount, a second line for one stage, and a
//      `by:` other than the-town, and stays green on a lawful line.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  classifyEntry, stageMintLine, STAGE_LADDER, parseStampLedger, foldBalances, sealChain, signSeal,
  giftLine, welcomeLine, firstIdeaLine, townIssuanceLine, mintLine, transferLine, worldStakeLine,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MINT_CLI = join(HERE, 'stamp-mint.mjs');

function town({ ledgerLines, pins = {}, addresses = {} }) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-stage-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(pins));
  for (const [handle, github] of Object.entries(addresses)) {
    mkdirSync(join(repo, 'WHITE_PAGES', handle), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', handle, 'ADDRESS.md'),
      `---\nhandle: ${handle}\n${github ? `github: ${github}\n` : ''}---\n`);
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
  try {
    return { ok: true, out: execFileSync(process.execPath, [MINT_CLI, ...args, '--repo', repo], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { ok: false, out: String(e.stdout ?? '') + String(e.stderr ?? '') };
  }
}
/** A signed ledger written by hand: the only way to put a forged-BUT-SIGNED line in front of the verifier. */
function forged(repo, pub, priv, lines) {
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const all = ['- 2026-06-12 · rules: stamps-v1', ...lines];
  const seals = sealChain(all);
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'),
    '# stamp-ledger\n\n' + all.map((c, i) => `${c} · sig: ${signSeal(seals[i], priv)}`).join('\n') + '\n');
  return repo;
}
const STAGE = (n, stage = 'confirmed', by = 'the-town', handle = 'alice', post = 'alice/the-door-sticks') =>
  `- 2026-09-29 · MINT → ${handle} · ${n} · for: post:${post}/${stage} · by: ${by}`;

// ── 1 · the grammar ─────────────────────────────────────────────────────────

test('1 · a stage line classifies as post-stage, the post id and the stage split at the last slash', () => {
  const line = stageMintLine({ date: '2026-09-29', handle: 'alice', n: 2, post: 'alice/the-door-sticks', stage: 'confirmed' });
  assert.equal(line, '- 2026-09-29 · MINT → alice · 2 · for: post:alice/the-door-sticks/confirmed · by: the-town');
  assert.deepEqual(classifyEntry(line),
    { kind: 'post-stage', date: '2026-09-29', handle: 'alice', n: 2, post: 'alice/the-door-sticks', stage: 'confirmed', by: 'the-town' });
  // a handle with a dot authors a post; the id still splits cleanly
  const dotted = classifyEntry(stageMintLine({ date: '2026-09-29', handle: 'bob', n: 25, post: 'victor-b.-rose-e./map-drifts', stage: 'fixed' }));
  assert.deepEqual([dotted.kind, dotted.post, dotted.stage, dotted.n], ['post-stage', 'victor-b.-rose-e./map-drifts', 'fixed', 25]);
  for (const stage of Object.keys(STAGE_LADDER))
    assert.equal(classifyEntry(STAGE(STAGE_LADDER[stage][0], stage)).kind, 'post-stage', stage);
});

test('1 · no sibling grammar mistakes a stage line, and a stage line mistakes none of them', () => {
  const siblings = [
    [giftLine({ date: '2026-09-29', handle: 'alice', n: 2, slug: 'post', by: 'keeminlee' }), 'gift'],
    [firstIdeaLine({ date: '2026-09-29', handle: 'alice', mark: 'alice/confirmed' }), 'first-idea'],
    [welcomeLine({ date: '2026-09-29', handle: 'alice', household: 'hh:post' }), 'welcome'],
    [townIssuanceLine({ date: '2026-09-29', handle: 'the-town', n: 2, purpose: 'post', by: 'the-town', note: 'post:alice/x/confirmed' }), 'town-issuance'],
    ['- 2026-09-29 · MINT → alice · 5 · for: friendship:bob (via a-1)', 'friendship'],
    [mintLine({ date: '2026-09-29', handle: 'alice', cause: 'a-1', side: 'sent' }), 'mint'],
    [transferLine({ date: '2026-09-29', from: 'alice', to: 'bob', n: 2, id: 'a-1' }), 'transfer'],
    [worldStakeLine({ date: '2026-09-29', handle: 'alice', mark: 'alice/the-door-sticks', n: 2, via: 'api' }), 'world-stake'],
  ];
  for (const [line, kind] of siblings) assert.equal(classifyEntry(line).kind, kind, line);
  // lines that look like a stage line and are not one: each is refused by the grammar, not misread
  for (const bad of [
    STAGE(2, 'shipped'),                                      // an unpaid stage
    STAGE(2, 'confirmed').replace(' · by: the-town', ''),     // no authority
    STAGE(0, 'confirmed'),                                    // a zero amount is never a line
    '- 2026-09-29 · MINT → alice · 2 · for: post:alice/confirmed · by: the-town',   // no slug: an id is <author>/<slug>
  ]) assert.notEqual(classifyEntry(bad).kind, 'post-stage', bad);
});

// ── 2 · the line refuses what would forge it ────────────────────────────────

test('2 · the line pins the-town and refuses an off-ladder amount, an unpaid stage and a forging post id', () => {
  assert.throws(() => stageMintLine({ date: '2026-09-29', handle: 'alice', n: 6, post: 'alice/x', stage: 'confirmed' }), /confirmed pays 2, not 6/);
  assert.throws(() => stageMintLine({ date: '2026-09-29', handle: 'alice', n: 20, post: 'alice/x', stage: 'fixed' }), /fixed pays 10 or 25 or 50/);
  assert.throws(() => stageMintLine({ date: '2026-09-29', handle: 'alice', n: 0, post: 'alice/x', stage: 'shipped' }), /not a paid stage/);
  assert.throws(() => stageMintLine({ date: '2026-09-29', handle: 'alice', n: 2, post: 'alice/x · by: keeminlee', stage: 'confirmed' }), /must be a post id/);
  assert.deepEqual(STAGE_LADDER, { confirmed: [2], reproduced: [3], diagnosed: [5], briefed: [10, 5], fixed: [10, 25, 50] });
});

// ── 3 · the verb ────────────────────────────────────────────────────────────

function founded() {
  const repo = town({
    ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob'), D('2026-06-13', 'b-1', 'bob', 'alice')],
    pins: { alice: { id: 1 }, bob: { id: 2 } },
    addresses: { alice: null, bob: null, bugcatcher: null },
  });
  const { pub, priv } = keypair();
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  execFileSync(process.execPath, [MINT_CLI, '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  return { repo, pub, keyFile };
}
const stageLines = (repo) => readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8').split('\n').filter((l) => l.includes('for: post:'));

test('3 · --stage-mint writes ONE signed line that verifies; a second for the same post and stage is refused and writes nothing', () => {
  const { repo, pub, keyFile } = founded();
  const args = ['--stage-mint', 'alice', '--post', 'alice/the-door-sticks', '--stage', 'confirmed', '--amount', '2', '--date', '2026-09-29', '--key', keyFile];
  const first = runMint(repo, args);
  assert.equal(first.ok, true, first.out);
  assert.equal(stageLines(repo).length, 1);
  assert.match(stageLines(repo)[0], /^- 2026-09-29 · MINT → alice · 2 · for: post:alice\/the-door-sticks\/confirmed · by: the-town · sig: /);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, v.problems.join('\n'));
  assert.equal(foldBalances(parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'))).get('alice') >= 2, true);

  const again = runMint(repo, args);
  assert.equal(again.ok, false);
  assert.match(again.out, /post:alice\/the-door-sticks\/confirmed is already paid .*one line per post and stage, ever/);
  // even to another hand: the stage is paid once, whoever it would credit
  const other = runMint(repo, ['--stage-mint', 'bob', ...args.slice(2)]);
  assert.equal(other.ok, false);
  assert.match(other.out, /already paid/);
  assert.equal(stageLines(repo).length, 1, 'a refused mint wrote a line');
  rmSync(repo, { recursive: true, force: true });
});

test('3 · --stage-mint refuses an off-ladder amount, a meep, and a handle with no room', () => {
  const { repo, keyFile } = founded();
  const base = ['--post', 'alice/the-door-sticks', '--date', '2026-09-29', '--key', keyFile];
  const six = runMint(repo, ['--stage-mint', 'alice', '--stage', 'confirmed', '--amount', '6', ...base]);
  assert.equal(six.ok, false);
  assert.match(six.out, /confirmed pays 2, not 6/);
  const heavy = runMint(repo, ['--stage-mint', 'alice', '--stage', 'briefed', '--amount', '7', ...base]);
  assert.equal(heavy.ok, false);
  assert.match(heavy.out, /briefed pays 10 or 5, not 7/);
  const ghost = runMint(repo, ['--stage-mint', 'nobody', '--stage', 'confirmed', '--amount', '2', ...base]);
  assert.equal(ghost.ok, false);
  assert.match(ghost.out, /no WHITE_PAGES room for "nobody"/);
  // bugcatcher is declared a meep from 09-20: the stamps are refused, by the town's law
  const keyed = runMint(repo, ['--declare-rules', 'stamps-v2', '--meeps', 'bugcatcher', '--date', '2026-09-20', '--key', keyFile]);
  assert.equal(keyed.ok, true, keyed.out);
  const meep = runMint(repo, ['--stage-mint', 'bugcatcher', '--stage', 'reproduced', '--amount', '3', ...base]);
  assert.equal(meep.ok, false);
  assert.match(meep.out, /"bugcatcher" is a meep at 2026-09-29 — meeps stay outside the currency/);
  assert.equal(stageLines(repo).length, 0);
  rmSync(repo, { recursive: true, force: true });
});

// ── 4 · the verifier ────────────────────────────────────────────────────────

function verdict(lines) {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [], pins: { alice: { id: 1 }, bob: { id: 2 } }, addresses: { alice: null, bob: null } });
  forged(repo, pub, priv, lines);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  rmSync(repo, { recursive: true, force: true });
  assert.ok(!v.problems.some((p) => /SIGNATURE FAILS|UNSIGNED/.test(p)), 'the lines must be properly signed, or this tests the seal instead of the law');
  return v;
}

test('4 · the verifier stays GREEN on lawful stage lines, each stage once, and conservation holds', () => {
  const v = verdict([STAGE(2), STAGE(3, 'reproduced', 'the-town', 'bob'), STAGE(5, 'briefed'), STAGE(50, 'fixed', 'the-town', 'bob')]);
  assert.equal(v.ok, true, v.problems.join('\n'));
  assert.equal(v.minted, 60);
});

test('4 · the verifier REDS a forged amount (6 at confirmed)', () => {
  const v = verdict([STAGE(6)]);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /LAWFUL fails — confirmed pays 2, not 6/.test(p)), v.problems.join('\n'));
});

test('4 · the verifier REDS a second line for the same post and stage', () => {
  const v = verdict([STAGE(2), STAGE(2, 'confirmed', 'the-town', 'bob')]);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /LAWFUL fails — post:alice\/the-door-sticks\/confirmed is paid twice/.test(p)), v.problems.join('\n'));
});

test('4 · the verifier REDS a by: other than the-town', () => {
  const v = verdict([STAGE(2, 'confirmed', 'keeminlee')]);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /stage stamps are the town's mint \(by: "keeminlee", must be the-town\)/.test(p)), v.problems.join('\n'));
});

test('4 · the verifier REDS stage stamps to a meep', () => {
  const v = verdict(['- 2026-09-20 · rules: stamps-v2 · meeps: bugcatcher', STAGE(3, 'reproduced', 'the-town', 'bugcatcher')]);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /stage stamps to meep "bugcatcher"/.test(p)), v.problems.join('\n'));
});
