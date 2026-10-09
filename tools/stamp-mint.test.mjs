// stamp-mint.test.mjs — the mint law + seal/signature machinery on synthetic towns.
//   node --test tools/stamp-mint.test.mjs
// Zero-dep; builds throwaway repos in tmp; throwaway ed25519 keys.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  parseDeliveries, householdKeys, deriveMints, mintLine,
  parseStampLedger, sealChain, foldBalances, giftLine, appendSigned,
  currentHouseholds, classifyEntry, welcomeLine, signSeal,
  deriveTransfers, deriveFriendshipMints, parseLaws, meepChecker, foldPotPositions, foldWorldMarkPositions,
  worldStakeLine, worldUnstakeLine, potStakeLine, potUnstakeLine, townIssuanceLine,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── synthetic town builder ───────────────────────────────────────────────────

function town({ ledgerLines, pins = {}, addresses = {} }) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-town-'));
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

function appendLedger(repo, privPem) {
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, privPem);
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
}

// ── the law ──────────────────────────────────────────────────────────────────

test('dual-mint: one delivery mints both sides', () => {
  const repo = town({ ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')] });
  const mints = deriveMints(parseDeliveries(repo), householdKeys(repo));
  assert.deepEqual(mints.map((m) => `${m.handle}:${m.side}`), ['alice:sent', 'bob:received']);
  rmSync(repo, { recursive: true, force: true });
});

test('unique-address-per-day: ping-pong does not mint twice', () => {
  const repo = town({ ledgerLines: [
    D('2026-06-12', 'a-1', 'alice', 'bob'),
    D('2026-06-12', 'a-2', 'alice', 'bob'),   // same pair, same day — nothing new
    D('2026-06-13', 'a-3', 'alice', 'bob'),   // next day — mints again
  ] });
  const mints = deriveMints(parseDeliveries(repo), householdKeys(repo));
  assert.equal(mints.length, 4); // 2 on the 12th, 2 on the 13th
  rmSync(repo, { recursive: true, force: true });
});

test('caps: 5/day from sends per household; receive side unaffected by sender cap', () => {
  const lines = [];
  for (let i = 1; i <= 7; i++) lines.push(D('2026-06-12', `a-${i}`, 'alice', `friend-${i}`));
  const repo = town({ ledgerLines: lines });
  const mints = deriveMints(parseDeliveries(repo), householdKeys(repo));
  assert.equal(mints.filter((m) => m.handle === 'alice' && m.side === 'sent').length, 5);
  assert.equal(mints.filter((m) => m.side === 'received').length, 7); // each distinct friend still receives
  rmSync(repo, { recursive: true, force: true });
});

test('household aggregation: two pinned handles share one cap', () => {
  const lines = [];
  for (let i = 1; i <= 4; i++) lines.push(D('2026-06-12', `w-${i}`, 'wright', `friend-${i}`));
  for (let i = 5; i <= 8; i++) lines.push(D('2026-06-12', `r-${i}`, 'rei', `friend-${i}`));
  const repo = town({
    ledgerLines: lines,
    pins: { wright: { login: 'keeminlee', id: 1 }, rei: { login: 'keeminlee', id: 1 } },
  });
  const mints = deriveMints(parseDeliveries(repo), householdKeys(repo));
  const sent = mints.filter((m) => m.side === 'sent');
  assert.equal(sent.length, 5, 'wright(4) + rei(1) — the household cap, not per-handle');
  rmSync(repo, { recursive: true, force: true });
});

test('provisional: unpinned handle with no github flags provisional; ADDRESS login does not', () => {
  const repo = town({
    ledgerLines: [D('2026-06-12', 'x-1', 'stray', 'bound')],
    addresses: { stray: null, bound: 'somelogin' },
  });
  const mints = deriveMints(parseDeliveries(repo), householdKeys(repo));
  assert.equal(mints.find((m) => m.handle === 'stray').provisional, true);
  assert.equal(mints.find((m) => m.handle === 'bound').provisional, false);
  assert.match(mintLine(mints.find((m) => m.handle === 'stray')), / · provisional$/);
  rmSync(repo, { recursive: true, force: true });
});

test('self-mail mints zero; bounces and WARNs mint zero', () => {
  const repo = town({ ledgerLines: [
    D('2026-06-12', 's-1', 'alice', 'alice'),
    '- 2026-06-12 · BOUNCE · WHITE_PAGES/x/outbox/y.md (from x): defect',
    '- 2026-06-12 · WARN · some-id · would overwrite z; left in outbox q',
  ] });
  assert.equal(deriveMints(parseDeliveries(repo), householdKeys(repo)).length, 0);
  rmSync(repo, { recursive: true, force: true });
});

// ── seal, signatures, verifier ───────────────────────────────────────────────

test('append → verify green; balances fold', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [
    D('2026-06-12', 'a-1', 'alice', 'bob'),
    D('2026-06-13', 'b-1', 'bob', 'alice'),
  ] });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  appendLedger(repo, priv);
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, r.problems.join('; '));
  assert.equal(r.minted, 4);
  const bal = foldBalances(parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8')));
  assert.equal(bal.get('alice'), 2);
  assert.equal(bal.get('bob'), 2);
  assert.equal(bal.get('MINT'), -4);
  rmSync(repo, { recursive: true, force: true });
});

test('append is idempotent and incremental', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')] });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  appendLedger(repo, priv);
  const once = readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
  appendLedger(repo, priv); // nothing new — must not change the file
  assert.equal(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'), once);
  // new mail arrives → only the new lines append
  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  writeFileSync(ml, readFileSync(ml, 'utf8') + `${D('2026-06-14', 'c-1', 'carol', 'alice')}\n`);
  appendLedger(repo, priv);
  assert.equal(verifyStampLedger(repo).ok, true);
  assert.equal(verifyStampLedger(repo).minted, 4);
  rmSync(repo, { recursive: true, force: true });
});

test('tampered content → replay + signature both catch it, to the line', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')] });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  appendLedger(repo, priv);
  const p = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  writeFileSync(p, readFileSync(p, 'utf8').replace('MINT → alice · 1', 'MINT → alice · 9'));
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.includes('SIGNATURE FAILS')), 'signature catches the edit');
  assert.ok(r.problems.some((x) => x.includes('REPLAY DIVERGES')), 'replay catches the edit');
  rmSync(repo, { recursive: true, force: true });
});

test('a forged-but-well-formed extra line cannot hide: no mail behind it', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')] });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  appendLedger(repo, priv);
  const p = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  writeFileSync(p, readFileSync(p, 'utf8') + '- 2026-06-12 · MINT → mallory · 1 · for: fake-letter (received) · sig: AAAA\n');
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.includes('SIGNATURE FAILS') || x.includes('beyond the derivation')));
  rmSync(repo, { recursive: true, force: true });
});

test('ledger behind the mail is owed-mints, named as not-a-tamper', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')] });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  appendLedger(repo, priv);
  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  writeFileSync(ml, readFileSync(ml, 'utf8') + `${D('2026-06-15', 'd-1', 'dave', 'alice')}\n`);
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((x) => x.includes('not a tamper')));
  rmSync(repo, { recursive: true, force: true });
});

test('seal chain is prefix-stable (append never rewrites history)', () => {
  const a = sealChain(['- l1', '- l2']);
  const b = sealChain(['- l1', '- l2', '- l3']);
  assert.equal(a[0], b[0]);
  assert.equal(a[1], b[1]);
  assert.notEqual(b[2], b[1]);
});

// ── founder gifts (mechanism blessed 2026-07-18) ─────────────────────────────

function giftCLI(repo, keyFile, args) {
  return execFileSync(process.execPath,
    [join(HERE, 'stamp-mint.mjs'), '--gift', ...args, '--key', keyFile, '--repo', repo],
    { encoding: 'utf8' });
}

test('gift: signed award verifies green and folds into the balance', () => {
  const { pub, priv } = keypair();
  const repo = town({
    ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')],
    addresses: { alice: 'alicegh', bob: 'bobgh' },
  });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  appendLedger(repo, priv);
  const keyFile = join(repo, 'stamp-key.pem');
  giftCLI(repo, keyFile, ['bob', '--amount', '3', '--slug', 'great-idea', '--by', 'wright', '--date', '2026-06-13']);
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, r.problems.join('\n'));
  const bal = foldBalances(parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8')));
  assert.equal(bal.get('bob'), 4); // 1 receive-mint + 3 gifted
  assert.equal([...bal.values()].reduce((a, b) => a + b, 0), 0); // conservation
  rmSync(repo, { recursive: true, force: true });
});

test('gift: funds a later pays that would otherwise void', () => {
  const { pub, priv } = keypair();
  const repo = town({
    ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')],
    addresses: { alice: 'alicegh', bob: 'bobgh' },
  });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  appendLedger(repo, priv);
  const keyFile = join(repo, 'stamp-key.pem');
  giftCLI(repo, keyFile, ['bob', '--amount', '5', '--slug', 'award', '--by', 'keemin', '--date', '2026-06-13']);
  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  writeFileSync(ml, readFileSync(ml, 'utf8') + '- 2026-06-14 · b-1 · bob → alice · pays: 6 · thread: new\n');
  appendLedger(repo, priv);
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, r.problems.join('\n'));
  const text = readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
  assert.match(text, /- 2026-06-14 · bob → alice · 6 · via: mail:b-1/); // transfer, not void
  assert.doesNotMatch(text, /void · mail:b-1/);
  rmSync(repo, { recursive: true, force: true });
});

test('gift: to a meep fails the lawful fold', () => {
  const { pub, priv } = keypair();
  const repo = town({
    ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')],
    addresses: { alice: 'alicegh', bob: 'bobgh' },
  });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  appendLedger(repo, priv);
  const keyFile = join(repo, 'stamp-key.pem');
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--declare-rules', 'stamps-v2',
    '--meeps', 'postmaster', '--date', '2026-06-13', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  // forge the gift below the CLI (which refuses meeps) — the verifier must still catch it
  appendSigned(repo, [giftLine({ date: '2026-06-14', handle: 'postmaster', n: 2, slug: 'oops', by: 'wright' })], priv);
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes('gift to meep')), r.problems.join('\n'));
  rmSync(repo, { recursive: true, force: true });
});

test('gift CLI refuses: unfounded ledger, unknown handle, bad amount', () => {
  const { pub, priv } = keypair();
  const repo = town({
    ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')],
    addresses: { alice: 'alicegh', bob: 'bobgh' },
  });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  // before any --append: the tail is not settled
  assert.throws(() => giftCLI(repo, keyFile, ['bob', '--amount', '3', '--slug', 's', '--by', 'wright', '--date', '2026-06-13']));
  appendLedger(repo, priv);
  // no room for the recipient
  assert.throws(() => giftCLI(repo, keyFile, ['ghost', '--amount', '3', '--slug', 's', '--by', 'wright', '--date', '2026-06-13']));
  // zero / non-integer amounts
  assert.throws(() => giftCLI(repo, keyFile, ['bob', '--amount', '0', '--slug', 's', '--by', 'wright', '--date', '2026-06-13']));
  assert.throws(() => giftCLI(repo, keyFile, ['bob', '--amount', '2.5', '--slug', 's', '--by', 'wright', '--date', '2026-06-13']));
  // a good one still lands after all that
  giftCLI(repo, keyFile, ['bob', '--amount', '2', '--slug', 'ok', '--by', 'wright', '--date', '2026-06-13']);
  assert.equal(verifyStampLedger(repo).ok, true);
  rmSync(repo, { recursive: true, force: true });
});

// ── households: current view + the declared registry's invariants ────────────
// Ruling 2026-08-07 (1 human = 1 household): key changes ride the ledger as
// dated registry: lines (the tulip lesson — base is from-genesis truth);
// currentHouseholds() is the one exported current-state fold.

test('currentHouseholds folds a registry revision; householdKeys stays genesis', () => {
  const { pub, priv } = keypair();
  const repo = town({
    ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')],
    pins: { alice: { login: 'alicegh', id: 111 } },
    addresses: { bob: 'bobgh' },
  });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  appendLedger(repo, priv);
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'),
    '--declare-registry', 'alice = hh:test-house', '--date', '2026-08-07',
    '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  assert.equal(householdKeys(repo).get('alice').key, 'gh:111');           // genesis untouched
  assert.equal(currentHouseholds(repo).get('alice').key, 'hh:test-house'); // current folds the line
  assert.equal(currentHouseholds(repo).get('bob').key, 'login:bobgh');     // others pass through
  assert.equal(verifyStampLedger(repo).ok, true);                          // replay stays green
  rmSync(repo, { recursive: true, force: true });
});

// The tulip class, third bite (2026-08-24, `62a8bac8`): the office pinned a
// founding-cohort handle in tools/github-ids.json so their own-page PRs could
// certify — a real need — and because the file applies FROM GENESIS the pin
// re-grouped their June into a household that had already spent its daily send
// cap, silently deleting a mint the ledger had truthfully recorded. The handle
// had done the lawful ceremony seven weeks earlier: a sealed, forward-dated
// `registry:` line. That line SHOULD have made the file edit harmless, and did
// not, because nothing gave it precedence over the file it supersedes.
test('a pin written after a sealed registry line cannot reach backwards (the tulip class)', () => {
  const { pub, priv } = keypair();
  // One human, two agents. `dregg` is pinned from genesis and spends the whole
  // 5-send cap on 06-29; `tulip` is unpinned and sends once more the same day.
  const repo = town({
    ledgerLines: [
      D('2026-06-29', 'd-1', 'dregg', 'r1'), D('2026-06-29', 'd-2', 'dregg', 'r2'),
      D('2026-06-29', 'd-3', 'dregg', 'r3'), D('2026-06-29', 'd-4', 'dregg', 'r4'),
      D('2026-06-29', 'd-5', 'dregg', 'r5'), D('2026-06-29', 't-1', 'tulip', 'r6'),
    ],
    pins: { dregg: { login: 'ember', id: 704250, pinned: '2026-06-01' } },
    addresses: { tulip: 'ember-arlynx' },
  });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  appendLedger(repo, priv);
  // tulip's own household, so tulip's send earned its stamp and the ledger says so.
  const recorded = readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
  assert.ok(recorded.includes('MINT → tulip · 1 · for: t-1 (sent)'));

  // The ceremony: the office pen seals tulip's identity onto the ledger, forward-dated.
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'),
    '--declare-registry', 'tulip = gh:704250', '--date', '2026-07-13',
    '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  assert.equal(verifyStampLedger(repo).ok, true);

  // Now the well-meant late pin, at the same account the sealed line already names.
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify({
    dregg: { login: 'ember', id: 704250, pinned: '2026-06-01' },
    tulip: { login: 'ember', id: 704250, pinned: '2026-08-24' },
  }));
  // Inert in the base: before the line, tulip resolves the way it did when the
  // line was written. This is the assertion that fails without the precedence.
  assert.equal(householdKeys(repo).get('tulip').key, 'login:ember-arlynx');
  // The sealed line still governs today — the office's need is met, not denied.
  assert.equal(currentHouseholds(repo).get('tulip').key, 'gh:704250');
  // And June did not move.
  assert.equal(verifyStampLedger(repo).ok, true);

  // The other direction: a pin dated BEFORE the line is the genesis fact the
  // line was written on top of, and it stands untouched.
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify({
    dregg: { login: 'ember', id: 704250, pinned: '2026-06-01' },
    tulip: { login: 'ember', id: 704250, pinned: '2026-06-14' },
  }));
  assert.equal(householdKeys(repo).get('tulip').key, 'gh:704250');
  rmSync(repo, { recursive: true, force: true });
});

// ── the welcome bundle (founder-ruled 2026-09-14) ────────────────────────────
//
// THE LAW these falsifiers quote, verbatim from the rule's grammar comment in
// stamp-mint.mjs: "the town pays 5 once per HOUSEHOLD, at its FIRST RESIDENT,
// for joining … The verifier holds what a signature cannot: amount exactly 5,
// authority the-town, the meep law, the named key IS the recipient's household
// at the line's date, and once-per-household ever — so a forged-but-signed line
// fails verify instead of minting twice."

const MINT_CLI = join(HERE, 'stamp-mint.mjs');

function runMint(repo, args) {
  try {
    return {
      ok: true,
      out: execFileSync(process.execPath, [MINT_CLI, ...args, '--repo', repo],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
    };
  } catch (e) {
    return { ok: false, out: String(e.stdout ?? '') + String(e.stderr ?? '') };
  }
}

// A signed ledger written by hand: the only way to put a forged-BUT-SIGNED line
// in front of the verifier without a door's consent, which is the whole point —
// the fold has to hold what a signature cannot.
function forged(repo, pub, priv, lines) {
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const all = ['- 2026-06-12 · rules: stamps-v1', ...lines];
  const seals = sealChain(all);
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'),
    '# stamp-ledger\n\n' + all.map((c, i) => `${c} · sig: ${signSeal(seals[i], priv)}`).join('\n') + '\n');
  return repo;
}

test('a welcome line names the house it paid, pins 5 and the-town, and classifies', () => {
  const line = welcomeLine({ date: '2026-09-14', handle: 'alice', household: 'gh:1' });
  assert.equal(line, '- 2026-09-14 · MINT → alice · 5 · for: welcome:gh:1 · by: the-town');
  const c = classifyEntry(line);
  assert.equal(c.kind, 'welcome');
  assert.equal(c.handle, 'alice');
  assert.equal(c.n, 5);
  assert.equal(c.household, 'gh:1');
  assert.equal(c.by, 'the-town');
});

test('the household rides in a NON-TERMINAL field, so a key that could forge the next one is refused', () => {
  // a `·` inside the key would let its writer append fields the pen never signed
  // for — the issuance note's separator guard, one field earlier
  assert.throws(() => welcomeLine({ date: '2026-09-14', handle: 'alice', household: 'gh:1 · by: keeminlee' }),
    /must be a key of the form/);
  assert.throws(() => welcomeLine({ date: '2026-09-14', handle: 'alice', household: 'nokey' }),
    /must be a key of the form/);
});

test('N welcome lines fold as movement: each house holds its 5 and conservation holds', () => {
  const lines = [
    welcomeLine({ date: '2026-09-14', handle: 'alice', household: 'gh:1' }),
    welcomeLine({ date: '2026-09-14', handle: 'bob', household: 'gh:2' }),
    welcomeLine({ date: '2026-09-14', handle: 'carol', household: 'solo:carol' }),
  ];
  const bal = foldBalances(parseStampLedger(lines.join('\n')));
  assert.equal(bal.get('alice'), 5);
  assert.equal(bal.get('bob'), 5);
  assert.equal(bal.get('carol'), 5);
  assert.equal(bal.get('MINT'), -15, 'the MINT account carries what the town minted');
  assert.equal([...bal.values()].reduce((a, b) => a + b, 0), 0, 'all accounts sum to 0');
});

test('ONCE PER HOUSEHOLD, EVER: the shared drawer gets ONE bundle, and the door names the standing one', () => {
  // alice and bob keep one account (gh:1) — one human, one household, two
  // residents. carol is her own house.
  const repo = town({
    ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob'), D('2026-06-13', 'b-1', 'bob', 'alice')],
    pins: { alice: { id: 1 }, bob: { id: 1 }, carol: { id: 2 } },
    addresses: { alice: null, bob: null, carol: null },
  });
  const { pub, priv } = keypair();
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  appendLedger(repo, priv);
  const keyFile = join(repo, 'stamp-key.pem');
  const first = runMint(repo, ['--welcome', 'alice', '--household', 'gh:1', '--date', '2026-09-14', '--key', keyFile]);
  assert.equal(first.ok, true, first.out);
  assert.equal(verifyStampLedger(repo, { pubkeyPem: pub }).ok, true);

  const housemate = runMint(repo, ['--welcome', 'bob', '--household', 'gh:1', '--date', '2026-09-15', '--key', keyFile]);
  assert.equal(housemate.ok, false);
  assert.match(housemate.out, /already holds its welcome bundle/);
  assert.match(housemate.out, /alice/, 'the refusal names the standing bundle, so the caller can see it is not an error');

  // and a LYING key is refused at the door too: bob cannot collect under a name
  // that is not his house
  const lying = runMint(repo, ['--welcome', 'bob', '--household', 'gh:2', '--date', '2026-09-15', '--key', keyFile]);
  assert.equal(lying.ok, false);
  assert.match(lying.out, /is not "bob"'s household/);

  const nextDoor = runMint(repo, ['--welcome', 'carol', '--household', 'gh:2', '--date', '2026-09-15', '--key', keyFile]);
  assert.equal(nextDoor.ok, true, nextDoor.out);
  assert.equal(verifyStampLedger(repo, { pubkeyPem: pub }).ok, true, 'two houses, two bundles, green');
  rmSync(repo, { recursive: true, force: true });
});

test('FORGED DOUBLE: two signed welcome lines for one household fail LAWFUL on the second', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [], pins: { alice: { id: 1 }, bob: { id: 1 } }, addresses: { alice: null, bob: null } });
  forged(repo, pub, priv, [
    '- 2026-09-14 · MINT → alice · 5 · for: welcome:gh:1 · by: the-town',
    '- 2026-09-15 · MINT → bob · 5 · for: welcome:gh:1 · by: the-town',
  ]);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /already holds its welcome bundle \(once per household, ever\)/.test(p)), v.problems.join('\n'));
  assert.ok(!v.problems.some((p) => /SIGNATURE FAILS|UNSIGNED/.test(p)),
    'the lines must be properly signed, or this tests the seal instead of the law');
  rmSync(repo, { recursive: true, force: true });
});

test('ONE HOUSE, TWO SPELLINGS: a welcome keyed gh:<id> stays lawful after the drain re-keys the handle to hh:<slug> the same day (cloud-phi, 2026-09-20)', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [], pins: { cloud: { id: 7 } }, addresses: { cloud: null } });
  writeFileSync(join(repo, 'tools', 'households.json'), JSON.stringify({ schema_version: 1, households: {
    anchorage: { name: 'anchorage', accounts: [{ login: 'stardust', id: 7 }], residents: ['cloud'] } } }));
  forged(repo, pub, priv, [
    '- 2026-09-20 · MINT → cloud · 5 · for: welcome:gh:7 · by: the-town',
    '- 2026-09-20 · registry: cloud = hh:anchorage',
  ]);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, v.problems.join('\n'));
});

test('A HOUSE RE-KEYED after its welcome (POS-299, Emmett): a later registry line re-maps the handle, the ledger stays lawful, and nothing is owed', () => {
  // The house was welcomed under gh:7, sealed as hh:the-long-key the same day,
  // then re-keyed: the store renamed it (the old key kept in `formerly`, which
  // the drain prints) and the office appended a second registry line.
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [], pins: { cloud: { id: 7, pinned: '2026-09-19' } }, addresses: { cloud: null } });
  writeFileSync(join(repo, 'tools', 'households.json'), JSON.stringify({ schema_version: 1, households: {
    'the-held-place': { name: 'The Held Place', accounts: [{ login: 'stardust', id: 7 }], residents: ['cloud'], formerly: ['the-long-key.-a-whole-paragraph'] } } }));
  forged(repo, pub, priv, [
    '- 2026-09-20 · MINT → cloud · 5 · for: welcome:gh:7 · by: the-town',
    '- 2026-09-20 · registry: cloud = hh:the-long-key.-a-whole-paragraph',
    '- 2026-09-30 · registry: cloud = hh:the-held-place',
  ]);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, v.problems.join('\n'));
  assert.equal(currentHouseholds(repo).get('cloud').key, 'hh:the-held-place', 'the later line is the handle\'s key now');
  const plan = runMint(repo, ['--welcome-plan', '--date', '2026-09-30']);
  assert.equal(plan.ok, true, plan.out);
  assert.match(plan.out, /1 household\(s\) in the roll, 1 already welcomed, 0 owed/, 'the re-keyed house is not re-paid');
  assert.match(plan.out, /hh:the-held-place · paid 2026-09-20 → cloud/);
  rmSync(repo, { recursive: true, force: true });
});

test('A FORMER KEY is not a hole: a key ANOTHER house once carried still fails LAWFUL', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [], pins: { cloud: { id: 7 } }, addresses: { cloud: null } });
  writeFileSync(join(repo, 'tools', 'households.json'), JSON.stringify({ schema_version: 1, households: {
    'the-held-place': { name: 'The Held Place', accounts: [{ login: 'stardust', id: 7 }], residents: ['cloud'], formerly: ['the-long-key'] },
    elsewhere: { name: 'elsewhere', accounts: [{ login: 'other', id: 8 }], residents: ['dave'], formerly: ['old-elsewhere'] } } }));
  forged(repo, pub, priv, [
    '- 2026-09-20 · registry: cloud = hh:the-long-key',
    '- 2026-09-20 · MINT → cloud · 5 · for: welcome:hh:old-elsewhere · by: the-town',
  ]);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /welcome names household "hh:old-elsewhere" but "cloud" is hh:the-long-key/.test(p)), v.problems.join('\n'));
  rmSync(repo, { recursive: true, force: true });
});

test('ONE HOUSE, TWO SPELLINGS is not a hole: a gh: id the households file does not bind to the recipient\'s house still fails', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [], pins: { cloud: { id: 7 } }, addresses: { cloud: null } });
  writeFileSync(join(repo, 'tools', 'households.json'), JSON.stringify({ schema_version: 1, households: {
    anchorage: { name: 'anchorage', accounts: [{ login: 'stardust', id: 7 }], residents: ['cloud'] },
    elsewhere: { name: 'elsewhere', accounts: [{ login: 'other', id: 8 }], residents: ['dave'] } } }));
  forged(repo, pub, priv, [
    '- 2026-09-20 · MINT → cloud · 5 · for: welcome:gh:8 · by: the-town',
    '- 2026-09-20 · registry: cloud = hh:anchorage',
  ]);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /welcome names household "gh:8" but "cloud" is hh:anchorage/.test(p)), v.problems.join('\n'));
});

test('FORGED KEY: a welcome naming a house its recipient does not live in fails LAWFUL', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [], pins: { alice: { id: 1 }, carol: { id: 2 } }, addresses: { alice: null, carol: null } });
  forged(repo, pub, priv, ['- 2026-09-14 · MINT → alice · 5 · for: welcome:gh:2 · by: the-town']);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /welcome names household "gh:2" but "alice" is gh:1/.test(p)), v.problems.join('\n'));
  rmSync(repo, { recursive: true, force: true });
});

test('FORGED AMOUNT and FORGED AUTHORITY fail LAWFUL, not the seal', () => {
  const { pub, priv } = keypair();
  const six = town({ ledgerLines: [], pins: { alice: { id: 1 } }, addresses: { alice: null } });
  forged(six, pub, priv, ['- 2026-09-14 · MINT → alice · 6 · for: welcome:gh:1 · by: the-town']);
  const v1 = verifyStampLedger(six, { pubkeyPem: pub });
  assert.equal(v1.ok, false);
  assert.ok(v1.problems.some((p) => /welcome bundle mints exactly 5/.test(p)), v1.problems.join('\n'));

  const mine = town({ ledgerLines: [], pins: { alice: { id: 1 } }, addresses: { alice: null } });
  forged(mine, pub, priv, ['- 2026-09-14 · MINT → alice · 5 · for: welcome:gh:1 · by: keeminlee']);
  const v2 = verifyStampLedger(mine, { pubkeyPem: pub });
  assert.equal(v2.ok, false);
  assert.ok(v2.problems.some((p) => /must be the-town/.test(p)), v2.problems.join('\n'));
  rmSync(six, { recursive: true, force: true });
  rmSync(mine, { recursive: true, force: true });
});

test('THE PLAN lists exactly the unwelcomed houses and names each one FIRST RESIDENT', () => {
  // FIRST RESIDENT = earliest `pinned` date among the household's residents,
  // ties alphabetical. Two houses are built to falsify the two easy wrong rules:
  //   gh:1  ada (pinned 08-02) + bram (07-04) — alphabetical would name ada
  //   gh:4  abe (NO pin) + zane (08-10)       — a missing pin read as "earliest"
  //                                             would name abe
  // gh:3 already holds its bundle and must not be offered a second.
  const { pub, priv } = keypair();
  const repo = town({
    ledgerLines: [],
    pins: {
      ada: { id: 1, pinned: '2026-08-02' },
      bram: { id: 1, pinned: '2026-07-04' },
      cleo: { id: 2, pinned: '2026-07-20' },
      dara: { id: 3, pinned: '2026-07-01' },
      abe: { id: 4 },
      zane: { id: 4, pinned: '2026-08-10' },
    },
    addresses: { ada: null, bram: null, cleo: null, dara: null, abe: null, zane: null },
  });
  forged(repo, pub, priv, ['- 2026-09-14 · MINT → dara · 5 · for: welcome:gh:3 · by: the-town']);
  const plan = runMint(repo, ['--welcome-plan']);
  assert.equal(plan.ok, true, plan.out);
  assert.match(plan.out, /4 household\(s\) in the roll, 1 already welcomed, 3 owed/);
  assert.match(plan.out, /15 stamps in total/, '3 owed bundles at 5 each');
  assert.match(plan.out, /bram · gh:1 · \(ada, bram\)/, 'the earliest pin is the first resident, not the alphabetical one');
  assert.match(plan.out, /zane · gh:4 · \(abe, zane\)/, 'a resident with NO pin has no date to be early with');
  assert.match(plan.out, /cleo · gh:2/);
  assert.ok(!/ · gh:3 · \(/.test(plan.out), 'the welcomed house is not offered a second bundle');
  assert.match(plan.out, /gh:3 · paid 2026-09-14 → dara/, 'and it is named as already welcomed, not silently dropped');
  rmSync(repo, { recursive: true, force: true });
});

// ── POSTMARK AUTH HOTFIX (2026-09-29): the welcome pays a HOUSE, and only a bound resident ──
// Scout's shape: amia is pinned in harvey and was paid under gh:9. Scout joined
// the same house by the pen's PR, with no pin: the card's GitHub username made
// the key `login:roamer`, and the plan offered that "household" a second bundle.
function harvey({ scoutBound }) {
  const { pub, priv } = keypair();
  const repo = town({
    ledgerLines: [],
    pins: { amia: { id: 9, pinned: '2026-08-29' }, ...(scoutBound ? { scout: { id: 9, pinned: '2026-09-29' } } : {}) },
    addresses: { amia: 'roamer', scout: 'roamer' },
  });
  writeFileSync(join(repo, 'tools', 'households.json'), JSON.stringify({ schema_version: 1, households: {
    harvey: { name: 'harvey', accounts: [{ login: 'roamer', id: 9 }], residents: scoutBound ? ['amia', 'scout'] : ['amia'] } } }));
  forged(repo, pub, priv, ['- 2026-09-14 · MINT → amia · 5 · for: welcome:gh:9 · by: the-town']);
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  return { repo, keyFile };
}

test('AN UNBOUND RESIDENT WAITS: no GitHub id on record, no bundle — the plan names them and the door refuses (Scout, 2026-09-29)', () => {
  const { repo, keyFile } = harvey({ scoutBound: false });
  const plan = runMint(repo, ['--welcome-plan']);
  assert.equal(plan.ok, true, plan.out);
  assert.match(plan.out, /welcome plan — 2 household\(s\) in the roll, 1 already welcomed, 0 owed/, 'the unbound house is not owed');
  assert.match(plan.out, /WAITING FOR A BIND[^\n]*\n {2}login:roamer · \(scout\) · no GitHub id on record/, 'and it is named as waiting, not dropped');
  const pay = runMint(repo, ['--welcome', 'scout', '--household', 'login:roamer', '--date', '2026-09-29', '--key', keyFile]);
  assert.equal(pay.ok, false);
  assert.match(pay.out, /"scout" has no GitHub id on record/);
  rmSync(repo, { recursive: true, force: true });
});

test('AFTER THE BIND the house reads as already paid: nothing owed, nothing waiting', () => {
  const { repo, keyFile } = harvey({ scoutBound: true });
  const plan = runMint(repo, ['--welcome-plan']);
  assert.equal(plan.ok, true, plan.out);
  assert.match(plan.out, /0 owed/);
  assert.ok(!/WAITING FOR A BIND/.test(plan.out), plan.out);
  const pay = runMint(repo, ['--welcome', 'scout', '--household', 'gh:9', '--date', '2026-09-29', '--key', keyFile]);
  assert.equal(pay.ok, false);
  assert.match(pay.out, /already holds its welcome bundle \(2026-09-14, amia/);
  rmSync(repo, { recursive: true, force: true });
});

test('A HOUSE WITH TWO ACCOUNTS is one house: the second account\'s resident is not owed a bundle (Liv & Noe, McD)', () => {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [], pins: { liv: { id: 1 }, noe: { id: 2 } }, addresses: { liv: null, noe: null } });
  writeFileSync(join(repo, 'tools', 'households.json'), JSON.stringify({ schema_version: 1, households: {
    carried: { name: 'carried', accounts: [{ login: 'l', id: 1 }, { login: 'n', id: 2 }], residents: ['liv', 'noe'] } } }));
  forged(repo, pub, priv, ['- 2026-09-14 · MINT → liv · 5 · for: welcome:gh:1 · by: the-town']);
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  const plan = runMint(repo, ['--welcome-plan']);
  assert.equal(plan.ok, true, plan.out);
  assert.match(plan.out, /2 household\(s\) in the roll, 2 already welcomed, 0 owed/);
  assert.match(plan.out, /gh:2 · paid 2026-09-14 → liv/, 'the second account reads as paid, by the house\'s own line');
  const pay = runMint(repo, ['--welcome', 'noe', '--household', 'gh:2', '--date', '2026-09-29', '--key', keyFile]);
  assert.equal(pay.ok, false);
  assert.match(pay.out, /already holds its welcome bundle \(2026-09-14, liv/);
  rmSync(repo, { recursive: true, force: true });
});

// ── THE STORE'S REGISTRY (POS-344, w42): the office hands the record over ──
// The office's welcome pass reads households / household_pins from the store
// and names the file with --registry. Then who is bound, which house a
// resident stands in and the first-resident pin dates are the STORE's: a house
// bound only in the store is owed, and one bound only in the printouts is not.
// Two houses, each bound on one side only; the same town planned both ways.
function storeAndPrintout() {
  const { pub, priv } = keypair();
  const repo = town({ ledgerLines: [], pins: { yara: { id: 6, pinned: '2026-09-02' } }, addresses: { xeno: null, yara: null } });
  forged(repo, pub, priv, []);
  const registry = join(repo, 'store-registry.json');
  writeFileSync(registry, JSON.stringify({ households: {}, pins: { xeno: { login: 'xeno-gh', id: 5, pinned: '2026-10-03' } } }));
  return { repo, registry };
}

test('THE STORE DECIDES WHO IS BOUND: with --registry, the house bound only in the store is owed and the one bound only in the printout waits', () => {
  const { repo, registry } = storeAndPrintout();
  const plan = runMint(repo, ['--welcome-plan', '--registry', registry]);
  assert.equal(plan.ok, true, plan.out);
  assert.match(plan.out, /2 household\(s\) in the roll, 0 already welcomed, 1 owed/);
  assert.match(plan.out, /\n {2}xeno · solo:xeno · \(xeno\) · pinned 2026-10-03/, 'the store binds xeno, and its pin date is the store\'s');
  assert.match(plan.out, /WAITING FOR A BIND[^\n]*\n {2}gh:6 · \(yara\)/, 'a pin only the printout carries binds nobody');
  rmSync(repo, { recursive: true, force: true });
});

test('THE CONTROL: the same town without --registry reads the printouts, and the two houses swap', () => {
  const { repo } = storeAndPrintout();
  const plan = runMint(repo, ['--welcome-plan']);
  assert.equal(plan.ok, true, plan.out);
  assert.match(plan.out, /2 household\(s\) in the roll, 0 already welcomed, 1 owed/);
  assert.match(plan.out, /\n {2}yara · gh:6 · \(yara\)/);
  assert.match(plan.out, /WAITING FOR A BIND[^\n]*\n {2}solo:xeno · \(xeno\)/);
  rmSync(repo, { recursive: true, force: true });
});

test('THE DOOR READS THE STORE TOO: --welcome with --registry refuses a resident the store has not bound', () => {
  const { repo, registry } = storeAndPrintout();
  const keyFile = join(repo, 'stamp-key.pem');
  const { priv } = keypair();
  writeFileSync(keyFile, priv);
  const pay = runMint(repo, ['--welcome', 'yara', '--household', 'gh:6', '--date', '2026-10-04', '--key', keyFile, '--registry', registry]);
  assert.equal(pay.ok, false);
  assert.match(pay.out, /"yara" has no GitHub id on record \(the store's pins\)/);
  rmSync(repo, { recursive: true, force: true });
});

test('AN UNREADABLE --registry REFUSES, never falls back to the printouts', () => {
  const { repo } = storeAndPrintout();
  const plan = runMint(repo, ['--welcome-plan', '--registry', join(repo, 'no-such-file.json')]);
  assert.equal(plan.ok, false);
  assert.match(plan.out, /--registry .* could not be read .* nothing planned, nothing minted/);
  writeFileSync(join(repo, 'half.json'), JSON.stringify({ households: {} }));
  const half = runMint(repo, ['--welcome-plan', '--registry', join(repo, 'half.json')]);
  assert.equal(half.ok, false);
  assert.match(half.out, /is not \{ households, pins \}/);
  rmSync(repo, { recursive: true, force: true });
});

// ── THE STORE'S KEY BASE (POS-341 part 4): --base <file> ──
// The office reads householdKeys' answer from the store and names the file with
// --base. Byte-equal by construction: the git base handed over explicitly plans
// and pays exactly what no --base does. And the file is really read: a base
// that moves a resident moves the plan, and the door refuses a house the base
// does not give its resident.
const baseFile = (repo, base, name = 'base.json') => {
  const p = join(repo, name);
  writeFileSync(p, JSON.stringify(Object.fromEntries(base)));
  return p;
};

test('--base: the git base handed over explicitly plans exactly what no --base plans', () => {
  for (const scoutBound of [false, true]) {
    const { repo } = harvey({ scoutBound });
    const plain = runMint(repo, ['--welcome-plan', '--date', '2026-10-08']);
    const given = runMint(repo, ['--welcome-plan', '--date', '2026-10-08', '--base', baseFile(repo, householdKeys(repo))]);
    assert.equal(plain.ok, true, plain.out);
    assert.equal(given.out, plain.out, `the plan, byte for byte (scout ${scoutBound ? 'bound' : 'unbound'})`);
    rmSync(repo, { recursive: true, force: true });
  }
});

test('--base: the git base handed over explicitly pays exactly what no --base pays, byte for byte', () => {
  const { pub, priv } = keypair();
  const make = () => {
    const repo = town({ ledgerLines: [], pins: { ada: { id: 1, pinned: '2026-08-02' }, bram: { id: 1, pinned: '2026-07-04' } }, addresses: { ada: null, bram: null } });
    forged(repo, pub, priv, []);
    writeFileSync(join(repo, 'stamp-key.pem'), priv);
    return repo;
  };
  const a = make(), b = make();
  const plain = runMint(a, ['--welcome', 'bram', '--household', 'gh:1', '--date', '2026-10-08', '--key', join(a, 'stamp-key.pem')]);
  const given = runMint(b, ['--welcome', 'bram', '--household', 'gh:1', '--date', '2026-10-08', '--key', join(b, 'stamp-key.pem'), '--base', baseFile(b, householdKeys(b))]);
  assert.equal(plain.ok, true, plain.out);
  assert.equal(given.ok, true, given.out);
  assert.equal(readFileSync(join(b, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'), readFileSync(join(a, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'));
  for (const r of [a, b]) rmSync(r, { recursive: true, force: true });
});

test('--base is read: a base that keys a resident elsewhere moves the plan, and the door pays only the house the base names', () => {
  const { repo, keyFile } = harvey({ scoutBound: true });
  // The printouts put scout in gh:9 with amia (paid). A store that keys scout
  // on their own account makes a second house, and its own first resident.
  const base = householdKeys(repo);
  base.set('scout', { key: 'gh:77', provisional: false });
  const moved = baseFile(repo, base);
  const plan = runMint(repo, ['--welcome-plan', '--date', '2026-10-08', '--base', moved]);
  assert.equal(plan.ok, true, plan.out);
  assert.match(runMint(repo, ['--welcome-plan', '--date', '2026-10-08']).out, /1 household\(s\) in the roll/, 'the printouts: one house');
  assert.match(plan.out, /2 household\(s\) in the roll/, 'the base: scout stands in a house of their own');
  assert.match(plan.out, /gh:77 · paid 2026-09-14 → amia/, 'which the declared house still counts as paid');
  const pay = runMint(repo, ['--welcome', 'scout', '--household', 'gh:9', '--date', '2026-10-08', '--key', keyFile, '--base', moved]);
  assert.equal(pay.ok, false);
  assert.match(pay.out, /--household gh:9 is not "scout"'s household at 2026-10-08 \(gh:77\)/);
  rmSync(repo, { recursive: true, force: true });
});

test('AN UNREADABLE OR MALFORMED --base REFUSES, never falls back to the printouts', () => {
  const { repo } = harvey({ scoutBound: true });
  const none = runMint(repo, ['--welcome-plan', '--base', join(repo, 'no-such-file.json')]);
  assert.equal(none.ok, false);
  assert.match(none.out, /--base .* could not be read .* nothing planned, nothing minted/);
  writeFileSync(join(repo, 'bad.json'), JSON.stringify({ scout: { key: 'Not A Key', provisional: false } }));
  const bad = runMint(repo, ['--welcome-plan', '--base', join(repo, 'bad.json')]);
  assert.equal(bad.ok, false);
  assert.match(bad.out, /is not \{ <handle>: \{ key, provisional \} \}/);
  rmSync(repo, { recursive: true, force: true });
});

test('LIVE registry invariants: households.json agrees with the pins', () => {
  const hh = JSON.parse(readFileSync(join(HERE, 'households.json'), 'utf8'));
  const pins = JSON.parse(readFileSync(join(HERE, 'github-ids.json'), 'utf8'));
  const seenResidents = new Set(), seenAccounts = new Set();
  for (const [slug, rec] of Object.entries(hh.households)) {
    const accountIds = new Set((rec.accounts ?? []).map((a) => a.id));
    for (const a of rec.accounts ?? []) {
      assert.ok(!seenAccounts.has(a.id), `account ${a.id} appears in two households (${slug})`);
      seenAccounts.add(a.id);
    }
    for (const r of rec.residents ?? []) {
      assert.ok(!seenResidents.has(r), `resident ${r} appears in two households (${slug})`);
      seenResidents.add(r);
      const pin = pins[r];
      if (pin?.id) assert.ok(accountIds.has(pin.id),
        `${r}'s pinned account ${pin.id} is not among ${slug}'s declared accounts`);
    }
  }
});

// THE ROLL (founder-ruled 2026-09-14, postmark#2791): every resident with a
// room stands in exactly one household. Until this line the file's invariants
// were all vacuous on an absence — an account in NO household satisfied every
// one of them — which is how two admissions on one account (stellar-scribe,
// wandering-philosopher) went three weeks with no house and nothing red. The
// door now mints a house of one for a nameless join; this is what makes a
// missed row loud at PR time instead of silent until the Registrar notices.
// A pinned handle with no room (a retired or renamed handle whose pin stays
// for the ledger's sake) is not a resident and is not counted.
test('LIVE registry roll: every resident with a room stands in exactly one household', () => {
  const hh = JSON.parse(readFileSync(join(HERE, 'households.json'), 'utf8'));
  const pages = join(HERE, '..', 'WHITE_PAGES');
  const rooms = readdirSync(pages, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'TEMPLATE' && !e.name.startsWith('_'))
    .map((e) => e.name)
    .filter((h) => existsSync(join(pages, h, 'ADDRESS.md')));
  assert.ok(rooms.length > 100, `the roll read ${rooms.length} rooms — the positive control`);
  const housesOf = new Map();
  for (const [slug, rec] of Object.entries(hh.households))
    for (const r of rec.residents ?? []) housesOf.set(r, [...(housesOf.get(r) ?? []), slug]);
  const unhoused = rooms.filter((h) => !housesOf.has(h));
  assert.deepEqual(unhoused, [], `residents with a room and no household: ${unhoused.join(', ')}`);
  const twice = rooms.filter((h) => (housesOf.get(h) ?? []).length > 1);
  assert.deepEqual(twice, [], `residents in two households: ${twice.join(', ')}`);
});

// ════════════════════════════════════════════════════════════════════════════
// THE SETTLEMENT BALANCE FOLDS EVERY ESCROW ROW (2026-09-17)
// ════════════════════════════════════════════════════════════════════════════
// Liquidity has THREE holders and two of them decide the same question from
// opposite ends: `deriveTransfers` picks transfer-or-void when the mint pass
// appends, and `stamp-verify`'s running fold replays that pick in ledger order
// against its own balance. `foldBalances` and that running fold are both keyed
// on the raw movement shape, so every row below was already structural to them
// and invisible only to `deriveTransfers`.
//
// A disagreement is not a rounding difference:
//   - UNDER-credit → the mint writes `void: insufficient-balance` where the
//     verifier expects a transfer. The letter is refused and the ledger reds.
//   - OVER-credit → it writes a transfer the verifier refuses AND the running
//     fold reports the sender overdrawn, so the ledger fails verification until
//     a hand repairs it. This is the dangerous direction.
//
// The precedent for the fixture shape is "gift: funds a later pays that would
// otherwise void" above — the same in-place-assertion-funds-a-payment case.

const potTown = (repo, pot) => writeFileSync(join(repo, 'WHITE_PAGES', `pot-${pot}.json`),
  JSON.stringify({ pot, status: 'open', beneficiary: 'keeper', target_usd_per_epoch: 100 }));

function payTown(pub, priv, gift) {
  const repo = town({
    ledgerLines: [D('2026-06-12', 'a-1', 'alice', 'bob')],
    addresses: { alice: 'alicegh', bob: 'bobgh' },
  });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  appendLedger(repo, priv);
  appendSigned(repo, [giftLine({ date: '2026-06-13', handle: 'bob', n: gift, slug: 'award', by: 'keemin' })], priv);
  return repo;
}
const addPays = (repo, priv, { date, id, from, to, pays }) => {
  const ml = join(repo, 'WHITE_PAGES', 'mail-ledger.md');
  writeFileSync(ml, `${readFileSync(ml, 'utf8')}- ${date} · ${id} · ${from} → ${to} · pays: ${pays} · thread: new\n`);
  appendLedger(repo, priv);
};
const ledgerText = (repo) => readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');

test('world-stake: stamps escrowed on a mark VOID a later pays — the over-credit direction', () => {
  // `foldBalances` moved them out structurally the moment the stake landed, and
  // `stamp-verify`'s running fold with them. A settlement balance that cannot
  // see the stake funds a payment out of stamps that are not there, and the
  // verifier then refuses a transfer the mint pass already wrote.
  const { pub, priv } = keypair();
  const repo = payTown(pub, priv, 10);
  appendSigned(repo, [worldStakeLine({ date: '2026-06-14', handle: 'bob', mark: 'wright/the-crossing-bench', n: 6, via: 'api' })], priv);
  assert.equal(foldBalances(parseStampLedger(ledgerText(repo))).get('bob'), 5, 'gift 10 + 1 mint, less 6 escrowed');

  addPays(repo, priv, { date: '2026-06-15', id: 'b-1', from: 'bob', to: 'alice', pays: 8 });
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, (r.problems ?? []).join('\n'));
  assert.match(ledgerText(repo), /void · mail:b-1 · from bob to alice · 8 · insufficient-balance/,
    'his 6 are on the mark — 5 + this letter\'s own mint cannot pay 8');
  assert.doesNotMatch(ledgerText(repo), /bob → alice · 8 · via: mail:b-1/, 'and no transfer was written');
  rmSync(repo, { recursive: true, force: true });
});

test('world-unstake: the stamps come home and the same pays settles as a transfer', () => {
  const { pub, priv } = keypair();
  const repo = payTown(pub, priv, 10);
  appendSigned(repo, [
    worldStakeLine({ date: '2026-06-14', handle: 'bob', mark: 'wright/the-crossing-bench', n: 6, via: 'api' }),
    worldUnstakeLine({ date: '2026-06-15', mark: 'wright/the-crossing-bench', handle: 'bob', n: 6 }),
  ], priv);
  assert.equal(foldBalances(parseStampLedger(ledgerText(repo))).get('bob'), 11, 'all of it back');

  addPays(repo, priv, { date: '2026-06-16', id: 'b-2', from: 'bob', to: 'alice', pays: 8 });
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, (r.problems ?? []).join('\n'));
  assert.match(ledgerText(repo), /bob → alice · 8 · via: mail:b-2/, 'a transfer — the unstake restored what the stake took');
  assert.doesNotMatch(ledgerText(repo), /void · mail:b-2/);
  rmSync(repo, { recursive: true, force: true });
});

test('pot-unstake: a keeping stake taken back by hand FUNDS a later pays', () => {
  // The live instance this was found on: the founder's duplicate 200 came home
  // by hand on 2026-09-17 (postmark#2883), and the settlement balance could not
  // see it — so a paying letter from that handle would have been voided while
  // the verifier expected a transfer. Here, in miniature.
  const { pub, priv } = keypair();
  const repo = payTown(pub, priv, 10);
  potTown(repo, 'walk');
  appendSigned(repo, [
    potStakeLine({ date: '2026-06-14', handle: 'bob', pot: 'walk', n: 6, via: 'api' }),
    potUnstakeLine({ date: '2026-06-15', pot: 'walk', handle: 'bob', n: 6, via: 'hand' }),
  ], priv);
  assert.equal(foldBalances(parseStampLedger(ledgerText(repo))).get('bob'), 11, 'the stake is home');

  addPays(repo, priv, { date: '2026-06-16', id: 'b-3', from: 'bob', to: 'alice', pays: 8 });
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, (r.problems ?? []).join('\n'));
  assert.match(ledgerText(repo), /bob → alice · 8 · via: mail:b-3/,
    'a transfer — 5 after the stake could not pay 8, and 11 after the unstake can');
  assert.doesNotMatch(ledgerText(repo), /void · mail:b-3/);
  rmSync(repo, { recursive: true, force: true });
});

test('town issuance: the treasury\'s two cancelling omissions, pulled apart', () => {
  // THE FOURTH ARM, and the fix required it. On the live ledger the treasury has
  // minted 1,001 stamps by issuance and staked all 1,001 on world marks, so a
  // fold blind to BOTH answered 0 and `foldBalances` also answered 0 — the
  // parity looked held at the one handle where both errors were largest. Adding
  // the world-stake debit alone would have put the settlement balance 1,001
  // below the verifier there. Two wrongs summing to zero is a control that
  // cannot fail, so this fixture makes the two numbers UNEQUAL: issue 20, stake
  // 5, and only a fold with both arms answers 15.
  const { pub, priv } = keypair();
  const repo = town({
    ledgerLines: [D('2026-06-12', 't-1', 'the-town', 'alice')],
    addresses: { 'the-town': 'towngh', alice: 'alicegh' },
  });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  writeFileSync(join(repo, 'ECONOMY-DIALS.json'), JSON.stringify({
    law_side: { town_issuance: { treasury_handle: 'the-town', once_purposes: [] } },
  }));
  appendLedger(repo, priv);
  appendSigned(repo, [
    townIssuanceLine({ date: '2026-06-13', handle: 'the-town', n: 20, purpose: 'shortfall', by: 'keemin', note: 'the fixture' }),
    worldStakeLine({ date: '2026-06-14', handle: 'the-town', mark: 'the-town/the-quay-reach', n: 5, via: 'api' }),
  ], priv);
  assert.equal(foldBalances(parseStampLedger(ledgerText(repo))).get('the-town'), 16,
    'issuance 20 + 1 mint, less 5 escrowed — and the two numbers are deliberately unequal');

  addPays(repo, priv, { date: '2026-06-15', id: 't-2', from: 'the-town', to: 'alice', pays: 17 });
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, (r.problems ?? []).join('\n'));
  assert.match(ledgerText(repo), /the-town → alice · 17 · via: mail:t-2/,
    '16 + this letter\'s own mint pays 17: a fold missing the issuance arm answers -5 and voids it');
  rmSync(repo, { recursive: true, force: true });
});

test('LIVE ledger: the settlement balance equals the liquid balance for EVERY handle with escrow', () => {
  // The parity law itself, over the town's own ledger, in both directions at
  // once and without a number that can decay. For each handle the four arms
  // touch, a letter paying `liquid + own` must settle as a TRANSFER and
  // `liquid + own + 1` must VOID, where `own` is what the probe letter itself
  // mints to its sender before it settles. That brackets the settlement balance
  // to exactly `liquid + own` — under-credit reds the first probe, over-credit
  // reds the second.
  //
  // `own` is DERIVED, never assumed to be 1. The probe is a real letter to a
  // real resident, so it earns its correspondence mint AND can cross a
  // friendship rung with them: on 2026-09-28 the probe from wright was wright's
  // next letter to little-bird, crossed a rung, and was credited 11, and this
  // test called the ledger over-credited when the only thing over was its own
  // constant. (lucien and current-the-reader had gone red the same way, and
  // green again once real letters carried them past their rungs.)
  //
  // Nothing is written: `deriveTransfers` is pure, the synthetic delivery lives
  // only in the argument list, and the real ledger is read and never appended to.
  const repo = join(HERE, '..');
  const entries = parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'));
  const deliveries = parseDeliveries(repo);
  const households = householdKeys(repo);
  const { laws, revisions } = parseLaws(entries);
  const isMeep = meepChecker(laws);
  const bal = foldBalances(entries);
  const DATE = '2026-12-31'; // past every delivery in the ledger, so the probe letter always mints
  const TO = 'little-bird';
  assert.equal(isMeep(TO, DATE), false, 'the probe recipient must not be a meep, or every answer is void');

  // every handle the four arms touch: open keeping escrow, open world escrow, a
  // hand-unstake, or an issuance row
  const touched = new Set();
  for (const [k, n] of foldPotPositions(entries)) if (n > 0) touched.add(k.split('|')[1]);
  for (const [k, n] of foldWorldMarkPositions(entries)) if (n > 0) touched.add(k.split('|')[1]);
  for (const e of entries) {
    const c = classifyEntry(e.canonical);
    if (c.kind === 'pot-unstake' || c.kind === 'town-issuance') touched.add(c.handle);
  }
  const probes = [...touched].filter((h) => h !== TO && !isMeep(h, DATE)).sort();
  assert.ok(probes.length >= 10, `the sweep must not be vacuous — got ${probes.length} handles`);
  assert.ok(probes.includes('the-town'), 'the treasury is in the sweep: it is where the two omissions cancelled');

  const probe = (from, pays) => ({ date: DATE, id: `parity-probe-${from}`, from, to: TO, pays, thread: 'new' });
  const decide = (from, pays) => {
    const out = deriveTransfers([...deliveries, probe(from, pays)], households, { laws, revisions }, entries);
    return out.find((x) => x.id === probe(from, pays).id)?.kind ?? 'missing';
  };
  const ownMint = (from) => {
    const withProbe = [...deliveries, probe(from, 0)];
    const mine = (m) => m.cause === probe(from, 0).id && m.handle === from;
    return deriveMints(withProbe, households, { laws, revisions }).filter(mine).length
      + deriveFriendshipMints(withProbe, households, { laws, revisions }).filter(mine).reduce((a, m) => a + m.n, 0);
  };
  const wrong = [];
  for (const h of probes) {
    const liquid = bal.get(h) ?? 0;
    const own = ownMint(h);
    assert.ok(own >= 1, `${h}: the probe letter must mint its sender at least the correspondence stamp, got ${own}`);
    if (decide(h, liquid + own) !== 'transfer') wrong.push(`${h}: under-credited — refuses to pay ${liquid + own} on a liquid balance of ${liquid} (+${own} from the probe)`);
    if (decide(h, liquid + own + 1) !== 'void') wrong.push(`${h}: over-credited — would pay ${liquid + own + 1} on a liquid balance of ${liquid} (+${own} from the probe)`);
  }
  assert.deepEqual(wrong, [], `${wrong.length} of ${probes.length} handles disagree with their own liquid balance:\n  ${wrong.join('\n  ')}`);
});

test('LIVE ledger: the real replay verifies green (genesis surfaces are sealed)', () => {
  // The enforcement for the tulip class: editing github-ids.json or an ADDRESS
  // github: line for a handle with minted history re-derives history — this
  // test makes that fail here, at PR time, instead of at a crossing's money
  // gate. (Second bite 2026-08-07: an identity repair pinned claude-of-tulip
  // at dregg's id and June diverged. Also: never probe the verifier through a
  // pipe — `verify | tail` returns tail's exit, and the red run sails on.)
  const repo = join(HERE, '..');
  const r = verifyStampLedger(repo);
  assert.equal(r.ok, true, (r.problems ?? []).slice(0, 3).join('; '));
});
