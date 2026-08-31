// stamp-first-idea.test.mjs — the first-idea quest's witnessed mint, held to
// its own terms.   node --test tools/stamp-first-idea.test.mjs
//
// THE LAW these falsifiers quote (the rule's grammar comment, stamp-mint.mjs,
// founder-ruled 2026-08-30, the Think Tank): "the town pays 5 once per
// HOUSEHOLD for its first published idea mark … The verifier holds what a
// signature cannot: amount exactly 5, authority the-town, the meep law, and
// once-per-household ever — so a forged-but-signed line fails verify instead
// of minting twice." And the quest's deliberate scope: it "pays for the
// CROSSING OF THE THRESHOLD, not the quality or novelty of the thought" —
// novelty judgment is the lifecycle's (the Architect's desk at the blueprint
// bottleneck), never this mint's, so no falsifier here inspects an idea's
// content and none ever should.
//
// Zero-dep; throwaway repos + ed25519, the stamp-issuance harness's shape.
// Nothing here touches a real ledger.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseStampLedger, foldBalances, foldMintCount, classifyEntry, firstIdeaLine, sealChain, signSeal } from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MINT = join(HERE, 'stamp-mint.mjs');

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ type: 'spki', format: 'pem' }),
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

// A town with two corresponding residents (separate households: distinct gh ids).
function town({ meeps = [] } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-town-firstidea-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify({ alice: 1, bob: 2 }));
  for (const [handle, login] of [['alice', 'alogin'], ['bob', 'blogin'], ...meeps.map((m) => [m, `${m}-login`])]) {
    mkdirSync(join(repo, 'WHITE_PAGES', handle), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', handle, 'ADDRESS.md'), `---\nhandle: ${handle}\ngithub: ${login}\n---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'),
    `# ledger\n\n- 2026-06-12 · seed-1 · alice → bob · thread: new\n- 2026-06-13 · seed-2 · bob → alice · thread: new\n`);
  return repo;
}

function keyFile(repo, priv) { const f = join(repo, 'stamp-key.pem'); writeFileSync(f, priv); return f; }
const ledgerText = (repo) => readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
const entriesOf = (repo) => parseStampLedger(ledgerText(repo));

function mintPass(repo, priv) {
  execFileSync(process.execPath, [MINT, '--append', '--key', keyFile(repo, priv), '--repo', repo], { encoding: 'utf8' });
}

function firstIdea(repo, priv, { handle = 'alice', mark = 'alice/a-town-calendar', date = '2026-08-30' } = {}) {
  try {
    const out = execFileSync(process.execPath, [MINT, '--first-idea', handle, '--mark', mark,
      '--date', date, '--key', keyFile(repo, priv), '--repo', repo], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String(e.stderr ?? '') + String(e.stdout ?? '') };
  }
}

function foundedTown(opts) {
  const { pub, priv } = keypair();
  const repo = town(opts);
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  return { repo, priv, pub };
}

// ── the shape ────────────────────────────────────────────────────────────────

test('a first-idea line carries its mark receipt, pins 5 and the-town, and classifies', () => {
  const line = firstIdeaLine({ date: '2026-08-30', handle: 'alice', mark: 'alice/a-town-calendar' });
  assert.equal(line, '- 2026-08-30 · MINT → alice · 5 · for: first-idea:alice/a-town-calendar · by: the-town');
  const c = classifyEntry(line);
  assert.equal(c.kind, 'first-idea');
  assert.equal(c.handle, 'alice');
  assert.equal(c.n, 5);
  assert.equal(c.mark, 'alice/a-town-calendar');
  assert.equal(c.by, 'the-town');
});

// ── the ceremony ─────────────────────────────────────────────────────────────

test('the happy path: mints 5, verifies green, and counts as generated equity', () => {
  const { repo, priv, pub } = foundedTown();
  const before = foldBalances(entriesOf(repo)).get('alice') ?? 0;
  const r = firstIdea(repo, priv);
  assert.equal(r.ok, true, r.out);
  const entries = entriesOf(repo);
  assert.equal(foldBalances(entries).get('alice'), before + 5, 'the 5 lands as liquid');
  assert.ok((foldMintCount(entries).get('alice') ?? 0) >= 5, 'and as minted equity');
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, v.problems?.join('\n'));
  rmSync(repo, { recursive: true, force: true });
});

test('ONCE PER HOUSEHOLD, EVER: the second mint is refused at the door, naming the first', () => {
  const { repo, priv } = foundedTown();
  assert.equal(firstIdea(repo, priv).ok, true);
  const again = firstIdea(repo, priv, { mark: 'alice/a-second-thought', date: '2026-08-31' });
  assert.equal(again.ok, false);
  assert.match(again.out, /household already holds its first-idea mint/);
  assert.match(again.out, /alice\/a-town-calendar/, 'the refusal names the standing first, so the caller can see it is not an error');
});

test('…and a second household is untouched by the first household\'s mint', () => {
  const { repo, priv, pub } = foundedTown();
  assert.equal(firstIdea(repo, priv).ok, true);
  const bob = firstIdea(repo, priv, { handle: 'bob', mark: 'bob/a-harbor-bell', date: '2026-08-31' });
  assert.equal(bob.ok, true, bob.out);
  assert.equal(verifyStampLedger(repo, { pubkeyPem: pub }).ok, true);
});

test('the door refuses a roomless handle and a malformed mark id', () => {
  const { repo, priv } = foundedTown();
  const ghost = firstIdea(repo, priv, { handle: 'nobody', mark: 'nobody/idea' });
  assert.equal(ghost.ok, false);
  assert.match(ghost.out, /no WHITE_PAGES room/);
  const bad = firstIdea(repo, priv, { mark: 'not-a-mark-id' });
  assert.equal(bad.ok, false);
  assert.match(bad.out, /--mark must be a mark id/);
});

// ── the fold's teeth: forged-but-signed lines fail VERIFY ────────────────────

const forge = (lines, priv, pub) => {
  const repo = town();
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const all = ['- 2026-06-12 · rules: stamps-v1', ...lines];
  const seals = sealChain(all);
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'),
    '# stamp-ledger\n\n' + all.map((c, i) => `${c} · sig: ${signSeal(seals[i], priv)}`).join('\n') + '\n');
  return repo;
};

test('FORGED AMOUNT: a properly signed 6-stamp first-idea line fails LAWFUL, not the seal', () => {
  const { pub, priv } = keypair();
  const repo = forge(['- 2026-08-30 · MINT → alice · 6 · for: first-idea:alice/a-town-calendar · by: the-town'], priv, pub);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /first-idea mints exactly 5/.test(p)), v.problems.join('\n'));
  assert.ok(!v.problems.some((p) => /SIGNATURE FAILS|UNSIGNED/.test(p)), 'the line must be properly signed, or this tests the seal instead of the law');
  rmSync(repo, { recursive: true, force: true });
});

test('FORGED AUTHORITY: by: anyone-but-the-town fails LAWFUL', () => {
  const { pub, priv } = keypair();
  const repo = forge(['- 2026-08-30 · MINT → alice · 5 · for: first-idea:alice/a-town-calendar · by: keeminlee'], priv, pub);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /must be the-town/.test(p)), v.problems.join('\n'));
  rmSync(repo, { recursive: true, force: true });
});

test('FORGED DOUBLE: two signed first-idea lines for one household fail LAWFUL on the second', () => {
  const { pub, priv } = keypair();
  const repo = forge([
    '- 2026-08-30 · MINT → alice · 5 · for: first-idea:alice/a-town-calendar · by: the-town',
    '- 2026-08-31 · MINT → alice · 5 · for: first-idea:alice/a-second-thought · by: the-town',
  ], priv, pub);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /already holds its first-idea mint \(once per household, ever\)/.test(p)), v.problems.join('\n'));
  rmSync(repo, { recursive: true, force: true });
});
