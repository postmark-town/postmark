// stamp-mint.test.mjs — the mint law + seal/signature machinery on synthetic towns.
//   node --test tools/stamp-mint.test.mjs
// Zero-dep; builds throwaway repos in tmp; throwaway ed25519 keys.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  parseDeliveries, householdKeys, deriveMints, mintLine,
  parseStampLedger, sealChain, foldBalances, giftLine, appendSigned,
  currentHouseholds,
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
