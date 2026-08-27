// stamp-friendship.test.mjs — the fourth earning rule: budding-friendship
// milestone (stamps-v3). Threshold, reward, forward-only, cross-household,
// non-meep, both-or-neither, once-per-rung, the ladder, the parity gate, CRLF,
// and forgery.
//   node --test tools/stamp-friendship.test.mjs
// Gold plan: postmark-budding-friendship. Zero-dep; throwaway repos + ed25519.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseStampLedger, foldBalances, classifyEntry } from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function town({ ledgerLines, pins = {}, addresses = {} }) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-town-friend-'));
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
  return {
    pub: publicKey.export({ type: 'spki', format: 'pem' }),
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}
function keyFile(repo, priv) { const f = join(repo, 'stamp-key.pem'); writeFileSync(f, priv); return f; }
function mintPass(repo, priv) {
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--append', '--key', keyFile(repo, priv), '--repo', repo], { encoding: 'utf8' });
}
function declareV3(repo, priv, date, meeps, ladder = '5:5,10:10') {
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--declare-rules', 'stamps-v3',
    '--meeps', meeps.join(','), '--friendship', ladder, '--date', date, '--key', keyFile(repo, priv), '--repo', repo], { encoding: 'utf8' });
}
const ledgerText = (repo) => readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
const balancesOf = (repo) => foldBalances(parseStampLedger(ledgerText(repo)));
const friendshipLines = (repo) =>
  parseStampLedger(ledgerText(repo)).map((e) => classifyEntry(e.canonical)).filter((c) => c.kind === 'friendship');

// n letters each way between a and b, one letter per distinct day starting at
// `startDay` of `month`, a→b first then b→a. Returns the lines and the id of the
// delivery that crosses (the last b→a, which lifts min(fwd,rev) to n).
function eachWay(a, b, n, month, startDay, tag) {
  const lines = [];
  let day = startDay;
  for (let i = 1; i <= n; i++) lines.push(D(`2026-${month}-${String(day++).padStart(2, '0')}`, `${tag}-ab-${i}`, a, b));
  let crossId = null;
  for (let i = 1; i <= n; i++) { crossId = `${tag}-ba-${i}`; lines.push(D(`2026-${month}-${String(day++).padStart(2, '0')}`, crossId, b, a)); }
  return { lines, crossId };
}

// ── the ruled decisions ───────────────────────────────────────────────────────

test('friendship: cross-household non-meeps mint 5 each at 5 letters each way, via the crossing letter', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'seed', 'alice', 'bob')], addresses: { alice: 'alogin', bob: 'blogin' } });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  declareV3(repo, priv, '2026-06-20', ['somebot']);            // meep set carried forward (none in this pair)

  const { lines, crossId } = eachWay('alice', 'bob', 5, '06', 21, 'r1');
  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  writeFileSync(ml, readFileSync(ml, 'utf8') + lines.join('\n') + '\n');
  mintPass(repo, priv);

  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, r.problems.join('; '));
  const fm = friendshipLines(repo);
  assert.equal(fm.length, 2, 'exactly two friendship mints — one per side, both or neither');
  const byHandle = new Map(fm.map((m) => [m.handle, m]));
  assert.equal(byHandle.get('alice').n, 5); assert.equal(byHandle.get('alice').friendWith, 'bob');
  assert.equal(byHandle.get('bob').n, 5); assert.equal(byHandle.get('bob').friendWith, 'alice');
  assert.equal(byHandle.get('alice').cause, crossId, 'via = the letter that crossed the 5-each-way floor');
  const bal = balancesOf(repo);
  // seed(06-12) alice→bob mints BOTH sides (+1 alice sent, +1 bob received). Then
  // the each-way block: each of alice/bob sends 5 (distinct days) and receives 5 →
  // +10 each. So 11 correspondence each + 5 friendship each = 16.
  assert.equal(bal.get('alice'), 16, 'alice: 11 correspondence + 5 friendship');
  assert.equal(bal.get('bob'), 16, 'bob: 11 correspondence + 5 friendship');
  rmSync(repo, { recursive: true, force: true });
});

test('friendship: the ladder — +10 at 10 each way, once per rung, no re-mint of the 5-rung', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'seed', 'alice', 'bob')], addresses: { alice: 'alogin', bob: 'blogin' } });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  declareV3(repo, priv, '2026-06-20', ['somebot']);
  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');

  // 5 each way → the 5-rung
  writeFileSync(ml, readFileSync(ml, 'utf8') + eachWay('alice', 'bob', 5, '06', 21, 'a').lines.join('\n') + '\n');
  mintPass(repo, priv);
  assert.equal(friendshipLines(repo).length, 2, 'the 5-rung minted once (2 lines)');

  // 5 more each way → 10 each way, the 10-rung; the 5-rung must NOT re-fire
  const more = eachWay('alice', 'bob', 5, '07', 1, 'b');   // July, distinct days
  writeFileSync(ml, readFileSync(ml, 'utf8') + more.lines.join('\n') + '\n');
  mintPass(repo, priv);

  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, r.problems.join('; '));
  const fm = friendshipLines(repo);
  assert.equal(fm.length, 4, 'two rungs crossed → four friendship mints, never more');
  const tens = fm.filter((m) => m.n === 10);
  assert.equal(tens.length, 2, 'the 10-rung mints 10 to each');
  assert.equal(tens.every((m) => m.cause === more.crossId), true, 'the 10-rung via = the 10th-each-way letter');
  rmSync(repo, { recursive: true, force: true });
});

test('friendship: FORWARD-ONLY — a pair already at 5+ each way before the law mints nothing', () => {
  const { pub, priv } = keypair();
  // alice & bob reach 5 each way entirely in June, all BEFORE the law date.
  const pre = eachWay('alice', 'bob', 6, '06', 1, 'pre'); // 6 each way, pre-law
  const repo = town({ ledgerLines: pre.lines, addresses: { alice: 'alogin', bob: 'blogin' } });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  const preLaw = ledgerText(repo);                        // the byte-for-byte pre-law ledger

  declareV3(repo, priv, '2026-06-30', ['somebot']);       // law AFTER all their correspondence
  mintPass(repo, priv);                                   // no post-law deliveries → nothing to mint

  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, r.problems.join('; '));
  assert.equal(friendshipLines(repo).length, 0, 'their whole history predates the law — zero friendship mints');
  // PARITY GATE: every pre-law line is byte-identical; the v3 line is the only addition.
  const after = ledgerText(repo);
  assert.equal(after.startsWith(preLaw), true, 'pre-law ledger is byte-identical — the rule did not leak backward');
  assert.ok(after.slice(preLaw.length).includes('rules: stamps-v3'), 'only the v3 law line was appended');
  rmSync(repo, { recursive: true, force: true });
});

test('friendship: forward-only counts restart at the law — pre-law letters do not seed the post-law tally', () => {
  const { pub, priv } = keypair();
  const pre = eachWay('alice', 'bob', 4, '06', 1, 'pre');  // 4 each way pre-law
  const repo = town({ ledgerLines: pre.lines, addresses: { alice: 'alogin', bob: 'blogin' } });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  declareV3(repo, priv, '2026-06-30', ['somebot']);
  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');

  // 4 more each way post-law → post-law each-way count is 4, NOT 4+4=8. No 5-rung.
  writeFileSync(ml, readFileSync(ml, 'utf8') + eachWay('alice', 'bob', 4, '07', 1, 'post').lines.join('\n') + '\n');
  mintPass(repo, priv);
  assert.equal(friendshipLines(repo).length, 0, 'pre-law letters are not counted — post-law is only 4 each way');

  // one more each way post-law → now 5 each way post-law → the 5-rung fires
  writeFileSync(ml, readFileSync(ml, 'utf8') + eachWay('alice', 'bob', 1, '07', 20, 'post5').lines.join('\n') + '\n');
  mintPass(repo, priv);
  assert.equal(friendshipLines(repo).length, 2, 'the 5th post-law each-way letter crosses the rung');
  assert.equal(verifyStampLedger(repo).ok, true);
  rmSync(repo, { recursive: true, force: true });
});

test('friendship: same-household pair does NOT mint (cross-household required)', () => {
  const { pub, priv } = keypair();
  const repo = town({
    ledgerLines: [D('2026-06-12', 'seed', 'alice', 'bob')],
    pins: { alice: { login: 'k', id: 7 }, bob: { login: 'k', id: 7 } },   // one household
  });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  declareV3(repo, priv, '2026-06-20', ['somebot']);
  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  writeFileSync(ml, readFileSync(ml, 'utf8') + eachWay('alice', 'bob', 6, '06', 21, 'x').lines.join('\n') + '\n');
  mintPass(repo, priv);
  assert.equal(verifyStampLedger(repo).ok, true);
  assert.equal(friendshipLines(repo).length, 0, 'same roof — no friendship mint');
  rmSync(repo, { recursive: true, force: true });
});

test('friendship: a meep on either side excludes the pair — neither mints (the deliberate divergence)', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'seed', 'alice', 'meepy')], addresses: { alice: 'alogin', meepy: 'mlogin' } });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  declareV3(repo, priv, '2026-06-20', ['meepy']);          // meepy is a declared meep
  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  writeFileSync(ml, readFileSync(ml, 'utf8') + eachWay('alice', 'meepy', 6, '06', 21, 'm').lines.join('\n') + '\n');
  mintPass(repo, priv);
  assert.equal(verifyStampLedger(repo).ok, true);
  assert.equal(friendshipLines(repo).length, 0, 'no meeps allowed — the non-meep side does not mint either');
  rmSync(repo, { recursive: true, force: true });
});

// ── integrity: the gate the plan cares about ─────────────────────────────────

test('friendship: a forged friendship line has no mail behind it — REPLAY turns red', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'seed', 'alice', 'bob')], addresses: { alice: 'alogin', bob: 'blogin' } });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  declareV3(repo, priv, '2026-06-20', ['somebot']);
  // hand-insert a friendship mint that never crossed a real threshold (and forge a sig)
  const p = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  writeFileSync(p, readFileSync(p, 'utf8') + '- 2026-06-25 · MINT → alice · 5 · for: friendship:bob (via ghost) · sig: AAAA\n');
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, false, 'a friendship stamp with no mail behind it must not verify');
  assert.ok(r.problems.some((x) => x.includes('SIGNATURE FAILS') || x.includes('REPLAY') || x.includes('beyond the derivation')), r.problems.join('; '));
  rmSync(repo, { recursive: true, force: true });
});

test('friendship: CRLF mail-ledger folds correctly (the plan\'s documented parsing hazard)', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'seed', 'alice', 'bob')], addresses: { alice: 'alogin', bob: 'blogin' } });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  declareV3(repo, priv, '2026-06-20', ['somebot']);
  // rewrite the WHOLE mail-ledger with CRLF line endings, then add the crossing block (also CRLF)
  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  const withBlock = readFileSync(ml, 'utf8') + eachWay('alice', 'bob', 5, '06', 21, 'crlf').lines.join('\n') + '\n';
  writeFileSync(ml, withBlock.replace(/\n/g, '\r\n'));
  mintPass(repo, priv);
  assert.equal(verifyStampLedger(repo).ok, true, 'CRLF ledger still verifies');
  assert.equal(friendshipLines(repo).length, 2, 'CRLF did not mis-key the crossing letter — the pair minted');
  rmSync(repo, { recursive: true, force: true });
});

test('friendship: retroactive v3 declaration is refused (must be forward-dated)', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-25', 'seed', 'alice', 'bob')], addresses: { alice: 'alogin', bob: 'blogin' } });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  assert.throws(() => declareV3(repo, priv, '2026-06-25', ['somebot']), 'a law dated at/behind the last delivery is refused');
  rmSync(repo, { recursive: true, force: true });
});
