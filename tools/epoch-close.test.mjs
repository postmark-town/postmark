// epoch-close.test.mjs — falsifiers for the funding seam (keeping pots, S1/S2).
//   node --test tools/epoch-close.test.mjs
// Zero-dep; throwaway towns + ed25519 keys (the ballot.test.mjs pattern).
//
// Every test here is a falsifier: each asserts a refusal, a red verify, or an
// exact number that the ruled law forces — and the forged/tampered cases are the
// standing proof the checks CAN fail. The law's one home is deriveEpochClose
// (stamp-mint.mjs); the verifier replays it; this file tries to break both.
//
// THE VALIDATION RULE (Keemin, 2026-08-21 — the night's lesson): every falsifier
// CITES THE SENTENCE OF LAW IT ASSERTS, quoted verbatim in the test itself. The
// first pass of this suite was green while the engine encoded a paraphrase of the
// matching rule — a mis-brief nobody could see, because the tests asserted the
// paraphrase back. Law-beside-assertion makes that drift visible at diff review:
// if the quote and the number disagree, the reviewer is looking at the bug.
//
// The law: capture doc § 8, "The keeping stake and the pot (the mechanics, as
// ruled tonight)" — G:/Starstory/docs/2026-08-20/postmark-economy-ontology.md.
// Quotes below are verbatim from it (§ 3, § 9 and § 10 where noted).

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseStampLedger, classifyEntry, appendSigned, foldBalances, foldStaked,
  foldMintCount, foldPrimaryMint, foldHolo, foldKeepingMint, foldOwnership, foldPotPositions,
  deriveEpochClose, intakeCheck,
  keepingDial, potFile, householdKeys, keepingLine, giftLine,
  potStakeLine, potReceiptLine, holoMintLine, keepingMintLine,
  potCorrectionLine, foldPotReceipts, potUnstakeLine, foldClosedEpochs, parseLaws,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const D = (date, id, from, to) => `- ${date} · ${id} · ${from} → ${to} · thread: new`;

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ type: 'spki', format: 'pem' }),
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

// A town with a founded, fully-appended stamp ledger, a keeping dial, and pot
// files. Stakers are funded by founder gifts (assertion lines, like the live
// ledger's) — a gift is also the mint-count basis the ρ-cap reads.
// Every pot carries a POSTED NEED: target_usd_per_epoch is the only thing
// dollars are ever priced against, so a pot without one cannot close. 100 is the
// fixture default; tests whose arithmetic turns on it say so out loud.
function seamTown({ pub, priv, pins, pots = {}, gifts = [], dial } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'seam-town-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(pins ?? {}));
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `# ledger\n\n${[
    D('2026-06-12', 'm-1', 'stan', 'paz'),
    D('2026-06-12', 'm-2', 'keeper', 'dot'),
  ].join('\n')}\n`);
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  writeFileSync(join(repo, 'ECONOMY-DIALS.json'), JSON.stringify({
    law_side: {
      town_issuance: { treasury_handle: 'the-town', once_purposes: [] },
      // R10 (Keemin, 2026-08-21 mid-morning): "rho = 0.5 at launch — at the
      // constitutional ceiling". The fixture runs at the launch dial so the
      // suite's arithmetic is the arithmetic the town will actually meet; a
      // test wanting a different rho passes one and says why.
      keeping: { sigma: 0.5, rho: 0.5, rho_constitutional_ceiling: 0.5, ...(dial ?? {}) },
    },
  }));
  for (const [id, meta] of Object.entries(pots)) {
    writeFileSync(join(repo, 'WHITE_PAGES', `pot-${id}.json`),
      JSON.stringify({ pot: id, status: 'open', target_usd_per_epoch: 100, ...meta }));
  }
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  if (gifts.length) {
    appendSigned(repo, gifts.map((g) => giftLine({ date: '2026-07-01', handle: g.handle, n: g.n, slug: 'seed', by: 'keemin' })), priv);
  }
  return repo;
}

const entriesOf = (repo) =>
  parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'));

const closeArgs = ({ repo, pot, epoch, date, key = true }) => {
  const a = [join(HERE, 'epoch-close.mjs'), '--close', '--pot', pot, '--epoch', epoch, '--date', date, '--repo', repo];
  if (key) a.push('--key', join(repo, 'stamp-key.pem'));
  return a;
};

// derive + append a close directly (the tool's core path without the CLI)
function closeDirect(repo, priv, { pot, epoch, date }) {
  const entries = entriesOf(repo);
  const derived = deriveEpochClose({
    entries, households: householdKeys(repo), pot, potMeta: potFile(repo, pot),
    epoch, date, dial: keepingDial(repo),
  });
  assert.equal(derived.ok, true, derived.error);
  appendSigned(repo, derived.rows.map(keepingLine), priv);
  return derived;
}

// fork a town dir by copying its ledger, then append raw canonicals with a key —
// the tamper bench: each fork is its own repo so red cases never poison a green one
function mkForkAppend(repo, privPem, ...canonicals) {
  const fork = mkdtempSync(join(tmpdir(), 'seam-fork-'));
  mkdirSync(join(fork, 'tools'), { recursive: true });
  mkdirSync(join(fork, 'WHITE_PAGES'), { recursive: true });
  for (const f of ['tools/github-ids.json', 'tools/stamp-pubkey.pem', 'ECONOMY-DIALS.json', 'WHITE_PAGES/mail-ledger.md', 'WHITE_PAGES/stamp-ledger.md']) {
    writeFileSync(join(fork, f), readFileSync(join(repo, f)));
  }
  for (const p of ['ec2', 'big', 'over', 'half', 'floors', 'even', 'odd', 'lamp', 'mix', 'untargeted', 'walk']) {
    try { writeFileSync(join(fork, 'WHITE_PAGES', `pot-${p}.json`), readFileSync(join(repo, 'WHITE_PAGES', `pot-${p}.json`))); } catch {}
  }
  appendSigned(fork, canonicals, privPem);
  return fork;
}

const PINS = {
  stan: { login: 's', id: 1 }, paz: { login: 'p', id: 2 }, keeper: { login: 'k', id: 9 },
  kbro: { login: 'k', id: 9 }, dot: { login: 'd', id: 5 }, vic: { login: 'v', id: 6 },
  ann: { login: 'a', id: 11 }, bo: { login: 'b', id: 12 }, cy: { login: 'c', id: 13 },
  del: { login: 'de', id: 14 },
};

// ── the canonical close ──────────────────────────────────────────────────────

test('the canonical close: 300 staked on a fully funded $150 pot → 300 home WHOLE, 300 minted to the giver', () => {
  // DIAL law_side.keeping._what (AMENDED 2026-09-14): "EVERY OPEN STAKE RETURNS
  //   WHOLE (pot-return rows); the funding mint M = floor(fraction × the open
  //   staked mass) is minted as holo rows to the payers, one per receipt, by
  //   dollar share of the roll ... Nothing burns."
  // DIAL law_side.keeping._holo (AMENDED 2026-09-17, the founder verbatim):
  //   "non-spendable is repealed; the stamps are like any other, but are holo to
  //   signify the special source" — so "the givers' reward IS the holo row ...
  //   and holo stamps are LIQUID: they count in the payer's balance and in
  //   minted-cumulative and they stake, vote, pay and transfer like any stamp."
  // THE OLD LAW THIS REPLACES (no close ever ran under it): 300 burned, split
  //   σ/(1−σ) into 150 keeping mint back to stan and 150 soulbound holo to paz.
  //   Kept as a sentence rather than a deleted test, because a deleted test's
  //   scaffolding reads as coverage.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 150 } },
    gifts: [{ handle: 'stan', n: 300 }, { handle: 'paz', n: 1200 }],
  });
  const keyFile = join(repo, 'stamp-key.pem');
  appendSigned(repo, [potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 300, via: 'api' })], priv);

  // the receipt goes through the door, so mint-at-entry is exercised end-to-end
  execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--receipt', '--pot', 'ec2',
    '--rail', 'stripe', '--usd', '150', '--from', 'paz', '--ref', 'stripe:pi_1', '--date', '2026-07-03',
    '--key', keyFile, '--repo', repo], { encoding: 'utf8' });

  // stakes are escrow while open: liquid dips, staked holds them, mint_count is
  // unmoved (stan holds 301 = 300 gift + 1 correspondence mint, stakes 300)
  let entries = entriesOf(repo);
  assert.equal(foldBalances(entries).get('stan') ?? 0, 1);
  assert.equal(foldStaked(entries).get('stan') ?? 0, 300);

  const out = execFileSync(process.execPath, closeArgs({ repo, pot: 'ec2', epoch: '2026-07', date: '2026-08-01' }), { encoding: 'utf8' });
  assert.match(out, /funded fraction:\s+100\.0%/, '$150 against a $150 posted need funds the pot whole');
  assert.match(out, /returned WHOLE:\s+300/, 'a stake is weight lent — all 300 come home');
  assert.match(out, /the mass sizes:\s+300/, 'M = floor(1 × 300) — the mass the stakes lent');
  assert.match(out, /minted to givers:\s+300/, 'paz paid the whole roll and no stake of hers is in the mass');
  assert.doesNotMatch(out, /burned/, 'nothing burns, so the report has no such line to print');

  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));

  entries = entriesOf(repo);
  const kinds = entries.map((e) => classifyEntry(e.canonical).kind);
  for (const k of ['pot-stake', 'pot-receipt', 'pot-return', 'holo'])
    assert.ok(kinds.includes(k), `ledger carries a ${k} row`);
  for (const k of ['keeping-burn', 'keeping-mint'])
    assert.ok(!kinds.includes(k), `nothing burns: no ${k} row is derivable at all`);

  // the stake came HOME: every tense is exactly where it was before the stake
  assert.equal(foldStaked(entries).get('stan') ?? 0, 0);
  assert.equal(foldBalances(entries).get('stan') ?? 0, 301, 'gift + mint, all of it back — nothing was spent');
  assert.equal(foldMintCount(entries).get('stan'), 301, 'and the staker mints nothing from a close');
  assert.equal(foldHolo(entries).get('stan'), undefined, 'the reward is the GIVERS\' — stan gave no dollars');
  assert.equal(foldBalances(entries).get('keeper') ?? 0, 1, 'a close mints the beneficiary no stamps at all');
  assert.equal(foldMintCount(entries).get('keeper'), 1);

  // HOLO IS LIQUID (the founder, 2026-09-17). The same row is in three places at
  // once now: the source readout, the balance, and minted-cumulative. Before the
  // ruling it was in the first alone, and the two asserts below read 1201.
  assert.equal(foldHolo(entries).get('paz'), 300);
  assert.equal(foldBalances(entries).get('paz') ?? 0, 1200 + 1 + 300, 'gift + mint + the reward, spendable');
  assert.equal(foldMintCount(entries).get('paz'), 1200 + 1 + 300, 'and it counts in minted-cumulative');
  assert.equal(foldPrimaryMint(entries).get('paz'), 1201, 'primary alone still reads what she earned');

  // conservation is STRUCTURAL and the arrow-free row does not escape it: the
  // holo credit is drawn from MINT, so every account still sums to zero. This is
  // the assert that would have caught crediting the payer without the debit.
  assert.equal([...foldBalances(entries).values()].reduce((a, b) => a + b, 0), 0);
  assert.equal(-foldBalances(entries).get('MINT'), foldMintCount(entries).get('stan')
    + foldMintCount(entries).get('paz') + foldMintCount(entries).get('keeper')
    + (foldMintCount(entries).get('dot') ?? 0),
    'the MINT account\'s debt is exactly the all-sources mint it issued');

  // total new mint never exceeds the mass the stakes lent
  assert.ok(foldHolo(entries).get('paz') <= 300, 'M = 300 is the ceiling on new mint, not a target');

  const held = execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--holo-held', '--repo', repo], { encoding: 'utf8' });
  assert.match(held, /300\s+gh:2\s+\(paz:300\)/);
  const kept = execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--keeping-held', '--repo', repo], { encoding: 'utf8' });
  assert.match(kept, /σ leg was retired 2026-09-14 before any close ran/,
    'the retired leg has no rows — and says so rather than printing an empty table');

  // D1 (Keemin, 2026-08-21): "ownership is a derived READ — NOT a tense; no
  // fifth tense node." AMENDED 2026-09-17: holo is INSIDE minted now, so
  // ownership IS the all-sources mint and holo is the source column beside it.
  // Adding it again would count paz's 300 twice (the pre-amendment 1501 here
  // would have read 1801).
  const own = foldOwnership(entries);
  assert.equal(own.get('stan').minted_primary, 301);
  assert.equal(own.get('stan').minted_keeping, 0, 'the σ leg is retired — no keeping mint exists');
  assert.equal(own.get('stan').holo, 0);
  assert.equal(own.get('stan').minted, 301, 'minted = primary + keeping + holo');
  assert.equal(own.get('stan').ownership, 301, 'ownership = minted, all sources');
  assert.equal(own.get('paz').minted_primary, 1201);
  assert.equal(own.get('paz').holo, 300);
  assert.equal(own.get('paz').minted, 1501);
  assert.equal(own.get('paz').ownership, 1501, 'NOT 1801 — holo is inside minted, never added twice');
  // and the read is a READ: no tense moved to make it true
  assert.equal(foldStaked(entries).get('stan') ?? 0, 0);
  const ownOut = execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--ownership', '--repo', repo], { encoding: 'utf8' });
  assert.match(ownOut, /ownership = minted, all sources \(primary \+ keeping \+ holo\)/);
  assert.match(ownOut, /paz\s+1201\s+0\s+300\s+1501\s+1501/);
});

// ── matching: priced against the posted need, never against the staked mass ──

test('no dollar↔stamp rate: a fully funded pot lends its WHOLE staked mass, however large the pile', () => {
  // DIAL law_side.keeping._no_rate: "There is NO dollar-to-stamp exchange rate
  //   anywhere in this system, and the funded fraction is why. Dollars are priced
  //   against the town's own POSTED NEED, never against the staked mass, so a
  //   fully funded pot lends its whole staked mass to the givers' mint however
  //   large the pile and an unfunded one mints nothing."
  // The killed reading is the same one it always was — mint = min(mass, dollars)
  // would invent a 1:1 rate the law never grants — but it now bites on the mint
  // rather than on a burn, because nothing burns.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: {
      big: { beneficiary: 'keeper', target_usd_per_epoch: 150 },
      over: { beneficiary: 'keeper', target_usd_per_epoch: 150 },
    },
    gifts: [{ handle: 'stan', n: 1000 }, { handle: 'dot', n: 100 }, { handle: 'paz', n: 4000 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'big', n: 1000, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'dot', pot: 'over', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'big', rail: 'stripe', usd: 150, from: 'paz', ref: 'stripe:pi_big' }),
    potReceiptLine({ date: '2026-07-03', pot: 'over', rail: 'usdc', usd: 600, from: 'paz', ref: 'usdc:over1' }),
  ], priv);

  const big = closeDirect(repo, priv, { pot: 'big', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(big.report.fundedFraction, 1);
  assert.equal(big.report.fundingMintSized, 1000, '$150 met the $150 need, so the whole mass sizes the mint');
  assert.equal(big.report.fundingMint, 1000, 'and paz, who staked nothing, is sized against all of it');
  assert.notEqual(big.report.fundingMint, 150,
    'the killed reading (mint = min(mass, dollars)) invents a 1:1 dollar↔stamp rate the law never grants');
  assert.deepEqual(big.rows.filter((r) => r.kind === 'pot-return').map((r) => `${r.handle}:${r.n}`),
    ['stan:1000'], 'the mass sized the reward and then went home — every stamp of it');
  assert.equal(foldBalances(entriesOf(repo)).get('stan') ?? 0, 1001, 'stan is exactly where he started');

  // and overfunding never lends more than was staked — the fraction caps at 1
  const over = closeDirect(repo, priv, { pot: 'over', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(over.report.fundedFraction, 1, '$600 against a $150 need is still 100%, not 400%');
  assert.equal(over.report.fundingMintSized, 100, 'the mass is the ceiling — $600 cannot conjure a 101st stamp');
  assert.equal(over.report.fundingMint, 100);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('half-funded: the mass is scaled by the fraction, and EVERY stake still goes home whole', () => {
  // DIAL law_side.keeping._what (AMENDED 2026-09-14): "at close, the funded
  //   fraction is min(1, non-treasury dollars / the pot's posted target ...);
  //   EVERY OPEN STAKE RETURNS WHOLE (pot-return rows); the funding mint
  //   M = floor(fraction × the open staked mass)".
  // THE OLD LAW THIS REPLACES: floor(fraction × stake) burned per staker and
  // only the unfunded remainder went home — dot:50/stan:150 burned,
  // dot:51/stan:150 returned. Half-funding now scales the REWARD, never the
  // stake: the staker is never out of pocket at all.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { half: { beneficiary: 'keeper', target_usd_per_epoch: 150 } },
    gifts: [{ handle: 'stan', n: 300 }, { handle: 'dot', n: 101 }, { handle: 'paz', n: 1200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'half', n: 300, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'dot', pot: 'half', n: 101, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'half', rail: 'stripe', usd: 75, from: 'paz', ref: 'stripe:pi_h' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'half', epoch: '2026-07', date: '2026-08-01' });

  assert.equal(d.report.fundedFraction, 0.5, '$75 of a $150 posted need');
  assert.deepEqual(d.rows.filter((r) => r.kind === 'pot-return').map((r) => `${r.handle}:${r.n}`),
    ['dot:101', 'stan:300'], 'WHOLE — not the unfunded remainder of each stake, all of it');
  assert.equal(d.report.stakesOpen, 401);
  assert.equal(d.report.returned, 401, 'the returns and the open mass are the same number, always');
  assert.equal(d.report.fundingMintSized, 200, 'floor(401 × 75 / 150) — multiplied before divided, on whole numbers');
  assert.equal(d.report.fundingMint, 200, 'paz paid the whole roll and staked nothing');
  assert.equal(d.report.unmintedRemainder, 0);
  assert.deepEqual(d.rows.filter((r) => r.kind === 'holo').map((r) => `${r.handle}:${r.n}`), ['paz:200']);
  const after = entriesOf(repo);
  assert.equal(foldBalances(after).get('stan') ?? 0, 301, 'the half-funded close cost stan nothing');
  assert.equal(foldBalances(after).get('dot') ?? 0, 102);
  assert.equal(foldStaked(after).get('stan') ?? 0, 0);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('a zero-dollar close is pure return — nothing arrived, so nothing is owed', () => {
  // DIAL law_side.keeping._no_rate: "an unfunded one mints nothing."
  // DIAL law_side.keeping._what: "EVERY OPEN STAKE RETURNS WHOLE."
  // Unchanged in outcome from the pre-amendment law, and that is the point of
  // keeping it: the zero case was already the shape the whole amendment
  // generalised to.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { lamp: { beneficiary: 'keeper', target_usd_per_epoch: 150 } },
    gifts: [{ handle: 'stan', n: 20 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'lamp', n: 20, via: 'api' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'lamp', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.fundedFraction, 0);
  assert.equal(d.report.fundingMintSized, 0);
  assert.equal(d.report.fundingMint, 0);
  assert.equal(d.report.returned, 20);
  assert.deepEqual(d.rows.map((r) => r.kind), ['pot-return'], 'the whole close is one stake coming home');
  assert.equal(foldBalances(entriesOf(repo)).get('stan') ?? 0, 21, 'gift + mint, all of it back');
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('a pot with no posted need cannot close — there is nothing to price dollars against', () => {
  // LAW § 8.1: "The town posts a funded need ($N per epoch — e.g. EC2, $150/mo)."
  // No posted need, no funded fraction; the only alternative would be inventing a
  // dollar↔stamp rate, which the law never grants. So the close refuses.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { untargeted: { beneficiary: 'keeper', target_usd_per_epoch: null } },
    gifts: [{ handle: 'stan', n: 50 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'untargeted', n: 50, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'untargeted', rail: 'usdc', usd: 50, from: 'paz', ref: 'usdc:u1' }),
  ], priv);
  const d = deriveEpochClose({
    entries: entriesOf(repo), households: householdKeys(repo), pot: 'untargeted',
    potMeta: potFile(repo, 'untargeted'), epoch: '2026-07', date: '2026-08-01', dial: keepingDial(repo),
  });
  assert.equal(d.ok, false);
  assert.match(d.error, /target_usd_per_epoch/);
});

// ── the split ────────────────────────────────────────────────────────────────

test('R1 floors PER RECEIPT and not on the total — the remainder is un-minted', () => {
  // DIAL law_side.keeping._what (AMENDED 2026-09-14): "... by dollar share of
  //   the roll ... floors per payer, the remainder un-minted."
  // The floor is taken on each giver's OWN dollar share. A floor of the total
  // would hand one giver's rounding to another, and would mint stamps no
  // dollar share paid for.
  // THE OLD LAW THIS REPLACES: the floors fell on the per-staker σ leg
  // (floor(3 × ½) = 1 each, three of them, never floor(σ·B) = 4). There is no σ
  // leg now, so the same lesson is asserted where the floors actually land.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: {
      floors: { beneficiary: 'keeper', target_usd_per_epoch: 10 },
      odd: { beneficiary: 'keeper', target_usd_per_epoch: 100 },
    },
    gifts: [
      { handle: 'ann', n: 3 }, { handle: 'bo', n: 3 }, { handle: 'cy', n: 3 },
      { handle: 'del', n: 100 }, { handle: 'stan', n: 301 }, { handle: 'paz', n: 1200 },
      { handle: 'vic', n: 500 }, { handle: 'dot', n: 100 },
    ],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'ann', pot: 'floors', n: 3, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'bo', pot: 'floors', n: 3, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'cy', pot: 'floors', n: 3, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'odd', n: 301, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'floors', rail: 'usdc', usd: 4, from: 'del', ref: 'usdc:f1' }),
    potReceiptLine({ date: '2026-07-03', pot: 'floors', rail: 'usdc', usd: 3, from: 'dot', ref: 'usdc:f2' }),
    potReceiptLine({ date: '2026-07-03', pot: 'floors', rail: 'usdc', usd: 3, from: 'paz', ref: 'usdc:f3' }),
    potReceiptLine({ date: '2026-07-03', pot: 'odd', rail: 'usdc', usd: 60, from: 'paz', ref: 'usdc:o1' }),
    potReceiptLine({ date: '2026-07-03', pot: 'odd', rail: 'usdc', usd: 40, from: 'vic', ref: 'usdc:o2' }),
  ], priv);

  const f = closeDirect(repo, priv, { pot: 'floors', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(f.report.fundingMintSized, 9, 'three stakes of 3, the pot fully funded at $10 of $10');
  assert.deepEqual(f.rows.filter((r) => r.kind === 'holo').map((r) => `${r.handle}:${r.n}`),
    ['del:3', 'dot:2', 'paz:2'], 'floor(9 · 4/10) = 3, floor(9 · 3/10) = 2, floor(9 · 3/10) = 2');
  assert.equal(f.report.fundingMint, 7);
  assert.notEqual(f.report.fundingMint, 9,
    'a floor taken on the TOTAL would mint 9 — two stamps no giver\'s dollar share paid for');
  assert.equal(f.report.unmintedRemainder, 2, 'every remainder is un-minted — the seam keeps the change');
  assert.ok(f.report.fundingMint <= f.report.fundingMintSized,
    'total new mint never exceeds the mass the stakes lent');
  assert.deepEqual(f.rows.filter((r) => r.kind === 'pot-return').map((r) => `${r.handle}:${r.n}`),
    ['ann:3', 'bo:3', 'cy:3'], 'and all nine stamps went home regardless');

  // and the odd stamp: a mass of 301 split 60/40 mints 180 + 120, with 1 left over
  const o = closeDirect(repo, priv, { pot: 'odd', epoch: '2026-07', date: '2026-08-02' });
  assert.equal(o.report.fundingMintSized, 301);
  assert.deepEqual(o.rows.filter((r) => r.kind === 'holo').map((r) => `${r.handle}:${r.n}`),
    ['paz:180', 'vic:120'], 'floor(301 · 60/100) = 180 and floor(301 · 40/100) = 120');
  assert.equal(o.report.fundingMint, 300);
  assert.equal(o.report.unmintedRemainder, 1, 'the odd stamp nobody\'s share reached');
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('no beneficiary carve-out — the beneficiary\'s stakes size the reward like anyone else\'s, and mint them nothing', () => {
  // DIAL law_side.keeping._exclusions: "Self-stake exclusion is PAYER-SIDE and
  //   by HOUSEHOLD ... There is no beneficiary carve-out — a beneficiary's
  //   stakes count like anyone else's for the other givers."
  // Two things this pins, and they pull in opposite directions on purpose: the
  // beneficiary's 30 stamps are IN the mass that sizes paz's reward, and the
  // beneficiary receives no stamps at all from the close — they keep the
  // DOLLARS. The pre-amendment version of this test asserted the σ leg's
  // per-staker split (dot:10/kbro:25/keeper:15); there is no σ leg now.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'keeper', n: 30 }, { handle: 'kbro', n: 50 }, { handle: 'dot', n: 20 }, { handle: 'paz', n: 1200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'keeper', pot: 'ec2', n: 30, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'kbro', pot: 'ec2', n: 50, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'dot', pot: 'ec2', n: 20, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 100, from: 'paz', ref: 'stripe:pi_2' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });

  assert.deepEqual(d.rows.filter((r) => r.kind === 'pot-return').map((r) => `${r.handle}:${r.n}`),
    ['dot:20', 'kbro:50', 'keeper:30'], 'every stake home whole, the beneficiary household\'s included');
  assert.equal(d.report.stakesOpen, 100);
  assert.equal(d.report.fundingMintSized, 100, 'the beneficiary\'s 30 are IN the mass — no carve-out');
  assert.equal(d.report.payers.find((p) => p.handle === 'paz').massForPayer, 100,
    'and in the mass sized for paz, who staked none of it');
  assert.equal(d.report.fundingMint, 100);
  assert.deepEqual(d.rows.filter((r) => r.kind === 'holo').map((r) => `${r.handle}:${r.n}`), ['paz:100']);
  // the pot's beneficiary receives DOLLARS, never stamps, from a close
  assert.equal(foldMintCount(entriesOf(repo)).get('keeper'), 30 + 1, 'gift + correspondence mint, nothing from the close');
  assert.equal(foldHolo(entriesOf(repo)).get('keeper'), undefined);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('sole staker who is sole payer mints zero — the row still lands, reading 0', () => {
  // DIAL law_side.keeping._exclusions: "a payer's household's stakes are
  //   excluded from the mass that sizes that payer's mint. Sole-staker-sole-payer
  //   mints zero."
  // LAW § 3: "Nothing you fully control can mint for you."
  // DIAL law_side.keeping._holo: the row lands anyway — "one per receipt the
  //   close settles, `<n>` may be 0 (the receipt's one mint chance spent)".
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'vic', n: 200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'vic', pot: 'ec2', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'usdc', usd: 100, from: 'vic', ref: 'usdc:vic1' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.fundingMintSized, 100, 'the posted need was funded, so the whole mass is lent');
  assert.equal(d.report.payers.find((p) => p.handle === 'vic').massForPayer, 0,
    'but the mass sized for vic is the mass minus her own household\'s — nothing');
  assert.equal(d.report.fundingMint, 0, 'vic controlled both the stake and the dollars — zero');
  const vicHolo = d.rows.filter((r) => r.kind === 'holo');
  assert.equal(vicHolo.length, 1, 'the row still lands — the dollars are remembered');
  assert.equal(vicHolo[0].n, 0, 'reading zero, because she cannot trade with herself');
  assert.equal(vicHolo[0].ref, 'usdc:vic1', 'and it names the receipt whose mint chance it spends');
  assert.equal(d.report.unmintedRemainder, 100, 'the whole lent mass is un-minted — the seam keeps the change');
  assert.equal(d.report.returned, 100, 'and her stake comes home whole all the same');
  assert.equal(foldBalances(entriesOf(repo)).get('vic') ?? 0, 200, 'exactly where she started');
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('a payer who also staked: the mass sized for them excludes their own household, nothing else', () => {
  // DIAL law_side.keeping._exclusions: "a payer's household's stakes are
  //   excluded from the mass that sizes that payer's mint."
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { mix: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'vic', n: 200 }, { handle: 'dot', n: 40 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'dot', pot: 'mix', n: 40, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'vic', pot: 'mix', n: 60, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'mix', rail: 'usdc', usd: 100, from: 'vic', ref: 'usdc:vic2' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'mix', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.fundingMintSized, 100, 'the headline mass is the whole 100 that was staked');
  assert.equal(d.report.payers.find((p) => p.handle === 'vic').massForPayer, 40,
    'the mass sized for VIC is 100 minus her own household\'s 60');
  assert.equal(d.report.fundingMint, 40, 'floor(40 · 100/100) = 40');
  assert.notEqual(d.report.fundingMint, 100, 'an unexcluded mass would have paid her for her own stake');
  assert.deepEqual(d.rows.filter((r) => r.kind === 'pot-return').map((r) => `${r.handle}:${r.n}`),
    ['dot:40', 'vic:60'], 'and both stakes come home whole — the exclusion is about SIZING, never about the stake');
  assert.equal(d.report.unmintedRemainder, 60, 'the 60 she could not be sized against is un-minted');
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('the ρ-cap clips the givers\' mint — and never touches the stakes coming home', () => {
  // DIAL law_side.keeping._what (AMENDED 2026-09-17): "a household's holo after
  //   the close is capped at rho × its all-sources mint before it — money's
  //   share of a household may never pass rho".
  // THE SENTENCE THIS REPLACES (the dial's own 2026-09-14 line, kept here so the
  //   diff review can see which shape is asserted): "a household's funding mint
  //   from one close is capped at rho × its earned base." That was a cap on ONE
  //   CLOSE'S MINT; this is a cap on HOLDINGS.
  // A FIRST close cannot tell the two shapes apart, and that is not a hole — it
  //   is why the live instance's arithmetic did not move when the shape did. A
  //   household holding no holo has room == cap, so the two clips agree exactly.
  //   The shapes diverge from the SECOND close on, which is what the next two
  //   falsifiers are for.
  // DIAL law_side.keeping._rho_owner (R10, Keemin 2026-08-21): "THIS FIELD IS
  //   THE OWNER OF THE NUMBER — 'every other surface reads it rather than
  //   restating it'." So the number below is not written here either: it is read
  //   from the dial the fixture declares, and the arithmetic is spelled against it.
  // ρ is the filter on what MONEY may own. It has never applied to the stakes —
  // and now that they all come home whole, there is nothing on that side to clip.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 150 } },
    gifts: [{ handle: 'stan', n: 300 }, { handle: 'paz', n: 100 }],
  });
  // paz has staked nothing, so her ρ base is her earned primary mint alone:
  // 101 (gift + 1 correspondence mint). At the launch ρ, cap = floor(0.5 · 101) = 50.
  const rho = keepingDial(repo).rho;
  assert.equal(rho, 0.5, 'the fixture runs at R10\'s launch dial');
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 300, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 150, from: 'paz', ref: 'stripe:pi_4' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.returned, 300, 'the stakes are untouched by the payer\'s cap — all of them home');
  assert.equal(d.report.fundingMintSized, 300, 'the mass lent 300');
  assert.equal(d.report.fundingMint, Math.floor(rho * 101), 'raw 300 clips to floor(ρ · base) = 50');
  assert.equal(d.report.fundingMint, 50);
  const pazRow = d.report.payers.find((p) => p.handle === 'paz');
  assert.equal(pazRow.capHoldings, 50,
    'and the report SAYS the ceiling, so a clipped giver can see why without re-folding the ledger');
  assert.equal(pazRow.holoHeldBefore, 0, 'she held no holo going in — this is her first close');
  assert.equal(pazRow.roomLeft, 50,
    'so the room left IS the whole ceiling, and the holdings cap and the retired per-close cap agree here');
  assert.equal(d.report.dollarsWitnessed, 150, 'the record remembers every dollar');
  assert.equal(d.rows.find((r) => r.kind === 'holo').n, 50, 'and the holo row exactly what minted');
  assert.equal(d.rows.find((r) => r.kind === 'holo').ref, 'stripe:pi_4', 'pointing at the receipt the dollars rode in on');
  assert.equal(d.report.unmintedRemainder, 250, 'the clipped excess is un-minted');
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('THE RULING\'S OWN FALSIFIER: the base is the ALL-SOURCES mint and the cap is on HOLDINGS — one fixture, four numbers, one lawful', () => {
  // THE FOUNDER, 2026-09-17 04:2x, verbatim: "for POS-33, I'm good to let
  //   funding minted stamps contribute to the max stamps you can get from
  //   another fund. it compounds by design."
  // THE FOUNDER, 2026-09-17 09:0x, verbatim: "ceiling cap is fine."
  // DIAL law_side.keeping._what (AMENDED 2026-09-17): "a household's holo after
  //   the close is capped at rho × its all-sources mint before it — money's
  //   share of a household may never pass rho ... the CAP is on holdings, not on
  //   one close's mint ... so a close mints a household at most the room left:
  //   max(0, floor(rho × base) − the holo it already holds)".
  //
  // TWO ROUNDS, AND THE SAME SECOND CLOSE DERIVES FOUR DIFFERENT NUMBERS — one
  // for each shape the law has worn. The fixture is built so that no two of them
  // collide, which is what makes it a falsifier rather than a green suite:
  //    50 — per-close cap on primary-only base   (the retired 2026-09-14 rule)
  //    75 — per-close cap on all-sources base    (the 2026-09-17 04:2x rule)
  //     0 — holdings cap on primary-only base    (the base the ruling widened)
  //    25 — holdings cap on all-sources base     (THE LAW, both rulings together)
  // Only 25 may pass, and the three rejected numbers are named below so a
  // reviewer reading the diff can see which shape the engine is in.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: {
      one: { beneficiary: 'keeper', target_usd_per_epoch: 100 },
      two: { beneficiary: 'keeper', target_usd_per_epoch: 100 },
    },
    gifts: [{ handle: 'paz', n: 100 }, { handle: 'vic', n: 400 }, { handle: 'stan', n: 400 }],
  });

  // ROUND 1 — paz GIVES, and the close rewards her: capped at floor(0.5 · 101) = 50.
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'vic', pot: 'one', n: 200, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'one', rail: 'usdc', usd: 100, from: 'paz', ref: 'usdc:r1' }),
  ], priv);
  const r1 = closeDirect(repo, priv, { pot: 'one', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(r1.report.fundingMintSized, 200, 'the mass vic lent');
  assert.equal(r1.report.fundingMint, 50, 'raw 200 clipped by her cap of floor(0.5 · 101)');
  assert.equal(foldHolo(entriesOf(repo)).get('paz'), 50);
  assert.equal(foldPrimaryMint(entriesOf(repo)).get('paz'), 101, 'her PRIMARY mint did not move');
  assert.equal(foldMintCount(entriesOf(repo)).get('paz'), 151,
    'but her all-sources mint did — that is the whole of the amendment');
  assert.equal(r1.report.returned, 200, 'and vic\'s stake came home whole');

  // ROUND 2 — paz gives again, to a different pot. Her OWN round-1 reward is in
  // the base her ceiling is computed from AND is subtracted from that ceiling.
  // One number, two roles: that is the whole mechanism of the holdings cap.
  //   primary mint                 = 101
  //   holo from round 1            =  50
  //   ρ base (all sources)         = 151  → ceiling = floor(0.5 · 151) = 75
  //   holo already held            =  50  → ROOM LEFT = 75 − 50            = 25
  //   under the primary-only base  = 101  → ceiling 50, held 50, room       = 0
  //   under the retired per-close shape                                     = 75
  appendSigned(repo, [
    potStakeLine({ date: '2026-08-02', handle: 'stan', pot: 'two', n: 400, via: 'api' }),
    potReceiptLine({ date: '2026-08-03', pot: 'two', rail: 'usdc', usd: 100, from: 'paz', ref: 'usdc:r2' }),
  ], priv);
  const r2 = closeDirect(repo, priv, { pot: 'two', epoch: '2026-08', date: '2026-09-01' });
  assert.equal(r2.report.fundingMintSized, 400);
  assert.equal(r2.report.fundingMint, 25,
    'ceiling = floor(0.5 · (101 + 50)) = 75; she already holds 50; the room left is 25');
  assert.notEqual(r2.report.fundingMint, 75,
    'the RETIRED PER-CLOSE shape would re-offer the whole ceiling — 75, the 09-17 04:2x number');
  assert.notEqual(r2.report.fundingMint, 50,
    'the RETIRED primary-only base under that shape would clip her at 50 — the 09-14 number');
  assert.notEqual(r2.report.fundingMint, 0,
    'a holdings cap over the primary-only base would give her nothing — and the base is all-sources, as ruled');
  const p2 = r2.report.payers.find((p) => p.handle === 'paz');
  assert.equal(p2.basePrimary, 101);
  assert.equal(p2.holoHeldBefore, 50,
    'and the report shows what she held going in, so the clip is auditable from the printout');
  assert.equal(p2.capHoldings, 75, 'the ceiling on her household\'s holo AFTER this close');
  assert.equal(p2.roomLeft, 25, 'ceiling minus held — the number the mint was actually clipped to');
  assert.equal(r2.rows.find((r) => r.kind === 'holo').n, 25);
  assert.equal(verifyStampLedger(repo).ok, true, 'and the verifier re-derives the same two numbers from the same prefix');

  // IT STILL COMPOUNDS, BY DESIGN — the BASE is what the 04:2x ruling widened,
  // and widening it is what raises the ceiling from 50 to 75. R12's retired
  // reason for admitting a source into the base was "the loop cannot compound —
  // verb-less → never re-stakable"; holo is re-stakable now, so that reason is
  // gone and the founder took the trade knowingly. What the 09:0x ruling added
  // is that the ceiling is measured against the HOLDINGS, so the compound has a
  // limit: the convergence falsifier below is where that is proved.
  assert.ok(p2.capHoldings > Math.floor(keepingDial(repo).rho * 101),
    'round 2\'s ceiling is strictly larger than round 1\'s, and round 1\'s own mint is why');
  assert.ok(p2.roomLeft < Math.floor(keepingDial(repo).rho * 101),
    'and the ROOM is strictly smaller than round 1\'s, which is the ceiling doing its work');
  const own = foldOwnership(entriesOf(repo)).get('paz');
  assert.equal(own.holo, 75);
  assert.equal(own.minted, 101 + 75, 'all sources: primary + holo');
  assert.equal(own.ownership, own.minted, 'holo is inside minted, never a second addend');
});

test('THE CEILING HOLDS A HOUSEHOLD ALREADY PAST IT TO ZERO — negative room is not a negative mint', () => {
  // DIAL law_side.keeping._what (AMENDED 2026-09-17): "a close mints a household
  //   at most the room left: max(0, floor(rho × base) − the holo it already
  //   holds)". The clamp at 0 is the part this asserts.
  //
  // THE FIXTURE CANNOT BE A LAWFUL LEDGER, AND THAT IS THE FINDING. Under the
  // holdings cap no close can put a household PAST its ceiling — each close
  // clips to the room, so the room can reach 0 and never go below it. The
  // over-held state is reachable only from holo written under the RETIRED
  // per-close shape (which no close ever ran under — the live ledger holds 0
  // holo rows) or from a hand-written row. So the fixture writes the row by
  // hand, on a fork, and the ledger's own verifier is asserted RED on it: this
  // is a defensive clamp on a branch the town cannot otherwise reach, and
  // saying so is more honest than a fixture that pretends otherwise.
  //
  // The numbers are the brief's own: primary 10, prior holo 100, base 110,
  // ceiling floor(0.5 · 110) = 55, room 55 − 100 = −45 → MINTS 0.
  // The flip (the retired per-close shape) mints 55 and reds this test.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'paz', n: 9 }, { handle: 'stan', n: 400 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 400, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'usdc', usd: 100, from: 'paz', ref: 'usdc:over' }),
  ], priv);

  // the hand-written prior holo — a fork, so the lawful repo above stays clean
  const over = mkForkAppend(repo, priv,
    holoMintLine({ date: '2026-07-15', handle: 'paz', n: 100, pot: 'ec2', epoch: '2026-06', ref: 'usdc:legacy' }));
  assert.equal(verifyStampLedger(over).ok, false,
    'the fixture is deliberately unlawful — no derivation produces that row, and the verifier says so');

  const e = entriesOf(over);
  assert.equal(foldPrimaryMint(e).get('paz'), 10, 'primary 10 — the gift of 9 plus her one correspondence mint');
  assert.equal(foldHolo(e).get('paz'), 100, 'and 100 holo already held');
  assert.equal(foldMintCount(e).get('paz'), 110, 'so the all-sources base is 110');

  const d = deriveEpochClose({
    entries: e, households: householdKeys(over), pot: 'ec2', potMeta: potFile(over, 'ec2'),
    epoch: '2026-07', date: '2026-08-01', dial: keepingDial(over),
  });
  assert.equal(d.ok, true, d.error);
  const p = d.report.payers.find((x) => x.handle === 'paz');
  assert.equal(p.capHoldings, 55, 'the ceiling: floor(0.5 · 110)');
  assert.equal(p.holoHeldBefore, 100, 'and she is already past it');
  assert.equal(p.roomLeft, 0, 'the room is clamped at 0 — the report never shows a negative');
  assert.equal(d.report.fundingMint, 0, 'so this close mints her NOTHING');
  assert.notEqual(d.report.fundingMint, 55,
    'the retired per-close shape would hand her the whole ceiling again — 55 — which is the flip');
  assert.equal(d.rows.find((r) => r.kind === 'holo').n, 0,
    'and the row is still written, at 0: the receipt\'s one mint chance is spent either way');
  assert.equal(d.report.unmintedRemainder, 400, 'the whole mass is un-minted — the seam keeps the change');
  assert.equal(d.report.returned, 400, 'and stan\'s stake still comes home whole; the ceiling never touches a stake');
});

test('CONVERGENCE: iterate the close and money\'s share of a household stops at ρ — holo ≤ primary at ρ = 0.5', () => {
  // THE FOUNDER, 2026-09-17 09:0x, verbatim: "ceiling cap is fine."
  // DIAL law_side.keeping._rho_owner (AMENDED 2026-09-17): "At rho = 0.5 the
  //   iteration converges on holo ≤ primary per household — R10's genesis floor
  //   restored as arithmetic, and the constitution's own sentence ('money can
  //   come to own up to half of Postmark; it can never own more') stated one
  //   household at a time."
  //
  // THIS IS THE FALSIFIER THE SHAPE EXISTS FOR. The per-close cap it replaces
  // was green on every single-close test in this file; it failed only under
  // ITERATION, which is the one thing no other falsifier here does. So: give
  // paz a fresh pot every round, let her fund it, and close it — until the close
  // mints her nothing. Then read her holdings against her primary mint.
  //
  // Under the ruled shape the mints fall 50, 25, 13, 6, 3, 2, 1, 0 and holo
  // settles at 100 against primary 101. Under the flip (the retired per-close
  // shape) the mints RISE — 50, 75, 113, … — the loop never reaches 0, and both
  // assertions below red: the bound on rounds, and holo ≤ primary.
  const { pub, priv } = keypair();
  const ROUNDS = 20; // a bound, not an expectation — reaching it IS the failure
  const pots = {};
  for (let i = 1; i <= ROUNDS; i++) pots[`r${i}`] = { beneficiary: 'keeper', target_usd_per_epoch: 100 };
  const repo = seamTown({
    pub, priv, pins: PINS, pots,
    gifts: [{ handle: 'paz', n: 100 }, { handle: 'stan', n: 400 }],
  });
  const rho = keepingDial(repo).rho;
  assert.equal(rho, 0.5, 'the fixture runs at R10\'s launch dial, which is the constitutional ceiling');
  const primary = foldPrimaryMint(entriesOf(repo)).get('paz');
  assert.equal(primary, 101, 'her primary mint is fixed for the whole iteration — she only ever GIVES');

  const mints = [];
  let round = 0;
  while (round < ROUNDS) {
    round += 1;
    const pot = `r${round}`;
    const mm = String(round).padStart(2, '0');
    appendSigned(repo, [
      // stan's stake comes home whole at each close, so he re-lends the same 400
      potStakeLine({ date: `2026-${mm}-02`, handle: 'stan', pot, n: 400, via: 'api' }),
      potReceiptLine({ date: `2026-${mm}-03`, pot, rail: 'usdc', usd: 100, from: 'paz', ref: `usdc:c${round}` }),
    ], priv);
    const d = closeDirect(repo, priv, { pot, epoch: `2026-${mm}`, date: `2026-${mm}-28` });
    mints.push(d.report.fundingMint);
    if (d.report.fundingMint === 0) break;
  }

  assert.ok(round < ROUNDS,
    `the iteration must REACH a close that mints nothing; it ran ${round} rounds minting ${mints.join(', ')}`);
  assert.deepEqual(mints, [50, 25, 13, 6, 3, 2, 1, 0],
    'and it falls the whole way — each round\'s mint is the room the last one left');
  for (let i = 1; i < mints.length; i++) {
    assert.ok(mints[i] <= mints[i - 1], 'never a round that mints more than the one before it');
  }

  const e = entriesOf(repo);
  const holo = foldHolo(e).get('paz');
  assert.equal(holo, 100, 'her holdings settle exactly one below her primary mint');
  assert.ok(holo <= primary,
    `MONEY'S SHARE STOPS AT ρ: holo ${holo} ≤ primary ${primary} at ρ = ${rho}`);
  assert.ok(holo <= rho * foldMintCount(e).get('paz'),
    'stated the other way: her holo never passes ρ × her all-sources mint');
  assert.equal(verifyStampLedger(repo).ok, true,
    'and the whole iterated ledger verifies — every close in it is derivable, byte for byte');
});

test('D5: intake refuses dollars past the posted target, and names the headroom', () => {
  // LAW D5 (Keemin, 2026-08-21): "intake refuses dollars past a pot's posted
  //         target, mechanically (recording tool / door bounce), except pots
  //         explicitly marked uncapped. Conversion's cap-at-1 stays as backstop."
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: {
      lamp: { beneficiary: 'keeper', target_usd_per_epoch: 100 },
      box: { beneficiary: 'keeper', target_usd_per_epoch: null, uncapped: true },
    },
    gifts: [{ handle: 'paz', n: 100 }],
  });
  const keyFile = join(repo, 'stamp-key.pem');
  const receipt = (pot, usd, ref, from = 'paz', date = '2026-07-03') => execFileSync(
    process.execPath,
    [join(HERE, 'epoch-close.mjs'), '--receipt', '--pot', pot, '--rail', 'usdc', '--usd', String(usd),
      '--from', from, '--ref', ref, '--date', date, '--key', keyFile, '--repo', repo],
    { encoding: 'utf8', stdio: 'pipe' });

  // a first payment inside the posted need lands, and says what is left
  const first = receipt('lamp', 60, 'usdc:d5a');
  assert.match(first, /\$60 of \$100 posted/);
  assert.match(first, /\$40 of headroom left/);

  // the second would take the pot past $100 — refused, with the headroom named
  assert.throws(
    () => receipt('lamp', 60, 'usdc:d5b'),
    (e) => /past pot "lamp"'s posted target/.test(String(e.stderr)) && /only \$40 more/.test(String(e.stderr)),
    'D5: intake refuses dollars past the posted target');

  // exactly the headroom is welcome, and then the pot is closed to more dollars
  receipt('lamp', 40, 'usdc:d5c');
  assert.throws(
    () => receipt('lamp', 1, 'usdc:d5d'),
    (e) => /fully funded for this epoch/.test(String(e.stderr)),
    'a fully funded pot takes no more');

  // D5's own exception: a pot marked uncapped is a standing box
  const box = receipt('box', 5000, 'usdc:d5e');
  assert.match(box, /witnessed/);
  assert.ok(!/headroom/.test(box), 'an uncapped pot posts no headroom because it posts no need');
  const check = intakeCheck({ entries: entriesOf(repo), pot: 'box', potMeta: potFile(repo, 'box'), usd: 999999 });
  assert.equal(check.ok, true);
  assert.match(check.reason, /uncapped/);

  // treasury dollars are exempt both ways — they fund nothing and mint nothing
  const town = intakeCheck({
    entries: entriesOf(repo), pot: 'lamp', potMeta: potFile(repo, 'lamp'),
    usd: 5000, from: 'the-town', treasury: 'the-town',
  });
  assert.equal(town.ok, true, '"Treasury may cover any shortfall — minting nothing"');

  assert.equal(verifyStampLedger(repo).ok, true);
});

test('D5\'s backstop still stands: conversion caps the funded fraction at 1', () => {
  // LAW D5: "Conversion's cap-at-1 stays as backstop."
  // Two gates for one law. If a dollar ever gets past the front gate — a hand-
  // edited ledger, a pot whose target was lowered after the fact — the close
  // still refuses to convert more than the posted need bought.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { lamp: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 100 }, { handle: 'paz', n: 400 }],
  });
  // appended raw, behind the intake gate, exactly as a hand-edit would be
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'lamp', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'lamp', rail: 'usdc', usd: 900, from: 'paz', ref: 'usdc:flood' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'lamp', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.dollarsFunding, 900);
  assert.equal(d.report.fundedFraction, 1, '$900 against a $100 need is still 100%, never 900%');
  assert.equal(d.report.fundingMintSized, 100, 'and it can never lend more mass than was staked');
  assert.equal(d.report.fundingMint, 100, 'paz gets the whole lent mass, not nine times it');
  assert.equal(d.report.returned, 100, 'and stan\'s stake still comes home whole');
  assert.equal(verifyStampLedger(repo).ok, true);
});

// ── the treasury and the grant ───────────────────────────────────────────────

test('treasury dollars fund nothing and mint nothing — the stakes come home whole', () => {
  // LAW § 8.4: "Treasury may cover any shortfall — minting nothing."
  // LAW § 3:   "treasury spending mints nothing · the town never stands on the
  //             receiving side of the seam."
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 100 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'usdc', usd: 100, from: 'the-town', ref: 'usdc:town1' }),
  ], priv);
  const d = closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.dollarsWitnessed, 100, 'the bill was genuinely paid');
  assert.equal(d.report.dollarsFunding, 0, 'but not by the town\'s payers');
  assert.equal(d.report.fundedFraction, 0, 'so the pot funded 0% of its posted need');
  assert.equal(d.report.fundingMintSized, 0, 'nothing the town paid itself can size a reward');
  assert.equal(d.report.fundingMint, 0);
  assert.equal(d.report.returned, 100, 'and the stake comes home whole — as it does at every close now');
  assert.deepEqual(d.rows.filter((r) => r.kind === 'pot-return').map((r) => `${r.handle}:${r.n}`), ['stan:100']);
  assert.equal(d.rows.find((r) => r.kind === 'holo').n, 0);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('the founding grant lands as ONE ordinary receipt and mints zero holo — a treasury holo row fails', () => {
  // LAW § 11: at entry the grant "minted zero holo (no household, no earned mint
  //           → zero cap — the filter working)".
  // LAW § 10: "Mint-at-entry, never at spend: a dollar mints (or doesn't) exactly
  //            once, when it crosses the seam."
  // The founder's 2026-08-26 ruling: pot-receipt is the only money row, so
  // direct-to-town dollars are a receipt and nothing else.
  const { pub, priv } = keypair();
  const repo = seamTown({ pub, priv, pins: PINS });
  const keyFile = join(repo, 'stamp-key.pem');
  execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--grant',
    '--patron', 'founding-family-grant', '--usd', '10000', '--ref', 'grant:founding-family',
    '--date', '2026-08-20', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });

  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));
  const entries = entriesOf(repo);
  const rows = entries.map((e) => classifyEntry(e.canonical));
  const receipts = rows.filter((c) => c.kind === 'pot-receipt');
  assert.equal(receipts.length, 1, 'ONE row — not a receipt plus a second line restating it');
  assert.equal(receipts[0].pot, 'treasury');
  assert.equal(receipts[0].from, 'founding-family-grant', 'the payer rides the receipt, the only money row');
  assert.equal(receipts[0].usd, 10000, 'and so do the dollars');
  assert.equal(foldHolo(entries).size, 0, 'grant dollars with no household mint ZERO holo');
  // the dollars moved no stamps at all: conservation untouched, no account changed
  assert.equal(foldBalances(entries).get('founding-family-grant') ?? 0, 0);

  // The town never mints from its own seam. The treasury pot never closes, so a
  // holo row against it has no lawful close to have come from.
  const bad = mkForkAppend(repo, priv,
    potReceiptLine({ date: '2026-08-21', pot: 'treasury', rail: 'grant', usd: 5, from: 'aunt', ref: 'grant:aunt' }),
    holoMintLine({ date: '2026-08-21', handle: 'aunt', n: 5, pot: 'treasury', epoch: '2026-08', ref: 'grant:aunt' }));
  const vb = verifyStampLedger(bad);
  assert.equal(vb.ok, false);
  assert.match(vb.problems.join('\n'), /reserved direct-to-town pot/);
});

// ── the wall: no deed grammar survives anywhere in a close ───────────────────

test('THE WALL: a close with stakes and dollars speaks no deed, in any row, line, or usage', () => {
  // THE RULING (the founder, 2026-08-26): the 2026-08-24 deeds proposal was
  // ideation, never shipped. "Holo stays. There is NO replacement noun —
  // `pot-receipt` remains the only money row, the close's payer lines say holo,
  // and the record-of-dollars concept lives as plain prose."
  //
  // This test is the keeper of that wall, and it stands in front of the first
  // epoch close: once a close is signed, its rows are replay-permanent, so deed
  // grammar that reaches the ledger can never be taken back out.
  //
  // The fixture is deliberately BOTH kinds of dollar — one payer who mints holo
  // and one whose dollars mint nothing — because the zero case is the one the
  // old deed row used to carry alone, and it is the one a careless purge drops.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { wall: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 200 }, { handle: 'paz', n: 200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'wall', n: 100, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'paz', pot: 'wall', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'wall', rail: 'stripe', usd: 60, from: 'paz', ref: 'stripe:wall1' }),
    potReceiptLine({ date: '2026-07-03', pot: 'wall', rail: 'grant', usd: 40, from: 'the-town', ref: 'grant:wall2' }),
  ], priv);

  const d = closeDirect(repo, priv, { pot: 'wall', epoch: '2026-07', date: '2026-08-01' });

  // the fixture must really exercise the thing — a vacuous pass is not a pass
  const holos = d.rows.filter((r) => r.kind === 'holo');
  assert.ok(d.rows.length > 0, 'the close emits a block');
  assert.ok(holos.some((r) => r.n > 0), 'a payer who mints — the ordinary case');
  assert.ok(holos.some((r) => r.n === 0), 'AND a payer whose dollars mint nothing — the case the deed row used to carry');
  assert.equal(holos.length, 2, 'one holo row per receipt the close settles, zeros included');

  // 1. every row OBJECT — kind names, field names, and values alike
  const asJson = JSON.stringify(d.rows);
  assert.ok(!/deed/i.test(asJson), `a close row still speaks deed: ${asJson}`);

  // 2. every row as it RENDERS into the ledger
  for (const line of d.rows.map(keepingLine))
    assert.ok(!/deed/i.test(line), `a rendered close line still speaks deed: ${line}`);

  // 3. every line as it actually LANDED in the sealed ledger
  const landed = entriesOf(repo).map((e) => e.canonical).filter((c) => /wall/.test(c));
  assert.ok(landed.length > 0, 'the block really reached the ledger');
  for (const c of landed)
    assert.ok(!/deed/i.test(c), `a recorded ledger line still speaks deed: ${c}`);

  // 4. and the tool's own mouth — the verb is --grant now, and says so
  let usage = '';
  try {
    execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--repo', repo], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) { usage = String(e.stderr ?? ''); }
  assert.ok(usage.length > 0, 'the tool prints a usage line to stderr');
  assert.ok(!/deed/i.test(usage), `the usage line still speaks deed: ${usage}`);
  assert.match(usage, /--grant/, 'and offers the verb that replaced it');

  assert.equal(verifyStampLedger(repo).ok, true);
});

// ── tamper bench: every check proves it can go red ───────────────────────────

test('a forged holo row fails the chain; an office-signed wrong one fails the keeping replay', () => {
  // DIAL law_side.keeping._holo (AMENDED 2026-09-17): the holo row IS the
  //   givers' reward, and those stamps are LIQUID. The stakes on this test went
  //   UP with that ruling, not down: a forged holo row used to mint an unspendable
  //   record, and now it mints spendable stamps out of the MINT account. So it
  //   must be exactly what the derivation produces — no signature, however
  //   authentic, can substitute. (The retired § 9 line this once quoted,
  //   "Soulbound equity denomination: no stake, no vote, no transfer", is the
  //   sentence the founder repealed.)
  const { pub, priv } = keypair();
  const intruder = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 100 }, { handle: 'paz', n: 400 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 100, from: 'paz', ref: 'stripe:pi_9' }),
  ], priv);

  // (a) an intruder's key: the signature chain goes red
  const forged = mkForkAppend(repo, intruder.priv,
    holoMintLine({ date: '2026-08-01', handle: 'paz', n: 999, pot: 'ec2', epoch: '2026-07', ref: 'stripe:pi_9' }));
  let v = verifyStampLedger(forged);
  assert.equal(v.ok, false, 'a holo row not signed by the office pen must fail');
  assert.match(v.problems.join('\n'), /SIGNATURE FAILS/);

  // (b) the office pen itself writing an unlawful holo row: the keeping replay goes red
  const orphan = mkForkAppend(repo, priv,
    holoMintLine({ date: '2026-08-01', handle: 'paz', n: 999, pot: 'ec2', epoch: '2026-07', ref: 'stripe:pi_9' }));
  v = verifyStampLedger(orphan);
  assert.equal(v.ok, false, 'even the office pen cannot write a holo row the derivation does not produce');
  assert.match(v.problems.join('\n'), /KEEPING REPLAY DIVERGES|derives no lawful block/);

  // (c) a real close with one holo amount nudged: byte-exact replay catches it
  const entries = entriesOf(repo);
  const derived = deriveEpochClose({
    entries, households: householdKeys(repo), pot: 'ec2', potMeta: potFile(repo, 'ec2'),
    epoch: '2026-07', date: '2026-08-01', dial: keepingDial(repo),
  });
  assert.equal(derived.ok, true, derived.error);
  const rows = derived.rows.map((r) => (r.kind === 'holo' ? { ...r, n: r.n + 1 } : r));
  const nudged = mkForkAppend(repo, priv, ...rows.map(keepingLine));
  v = verifyStampLedger(nudged);
  assert.equal(v.ok, false, 'a close block with a wrong holo amount must fail');
  assert.match(v.problems.join('\n'), /KEEPING REPLAY DIVERGES/);
});

test('a forged keeping-mint row fails — the retired σ leg is still replayed, not trusted', () => {
  // DIAL law_side.keeping._keeping_mint: "RETIRED 2026-09-14 ... no stake burns,
  //   so there is no σ leg and no keeping mint. The retired row's grammar stays
  //   lawful so a smuggled one parses and fails the close replay BY NAME."
  // That is what this falsifier proves, and retiring the leg made it stronger:
  // no derived block contains a keeping-mint row at all any more, so every one
  // that reaches the ledger is outside its block by construction.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 50 }, { handle: 'paz', n: 200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 50, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 50, from: 'paz', ref: 'stripe:pi_7' }),
  ], priv);
  const solo = mkForkAppend(repo, priv,
    keepingMintLine({ date: '2026-08-01', handle: 'stan', n: 9999, pot: 'ec2', epoch: '2026-07' }));
  const v = verifyStampLedger(solo);
  assert.equal(v.ok, false, 'a keeping mint row outside its derived block must fail');
  assert.match(v.problems.join('\n'), /KEEPING REPLAY DIVERGES|derives no lawful block/);
});

test('every retired σ-row shape is unknown grammar — and none can be smuggled back in', () => {
  // LAW R12 (Keemin, 2026-08-21 afternoon): "the σ leg IS ORDINARY MINT,
  //          source-tagged (`minted · for: keeping:<pot>`), with NO liquid coin
  //          (the coin was paid when the stake burned; the row stays
  //          purpose-tagged so balance folds never hand liquid back)."
  // Three shapes are retired, and each was wrong in its own way:
  //   (a) `MINT → keeper · n · for: keeper-equity:…` — the first pass's row, paid
  //       to the BENEFICIARY, and liquid.
  //   (b) `keeping-equity · …` — the second pass's row: right recipient, right
  //       non-liquidity, but the noun R12 retires ("keeping-equity" is gone from
  //       every surface).
  //   (c) `MINT → staker · n · for: keeping:<pot>` — the tempting smuggle, and
  //       the DANGEROUS one: it wears R12's own source tag, so it reads lawful,
  //       but its arrow puts it inside foldBalances AND foldMintCount — liquid
  //       coin handed back for a coin already paid when the stake burned. Only
  //       the arrow-free shape can carry this leg.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 50 }],
  });
  const retired = {
    'the first pass\'s MINT-to-beneficiary row': '- 2026-08-01 · MINT → keeper · 25 · for: keeper-equity:ec2/2026-07',
    'the retired keeping-equity noun': '- 2026-08-01 · keeping-equity · stan · 25 · pot:ec2 · epoch:2026-07',
    'the arrow-bearing keeping smuggle': '- 2026-08-01 · MINT → stan · 25 · for: keeping:ec2 · epoch:2026-07',
  };
  for (const [what, line] of Object.entries(retired)) {
    assert.equal(classifyEntry(line).kind, 'unknown', `${what} parses as nothing at all`);
    const smuggled = mkForkAppend(repo, priv, line);
    const v = verifyStampLedger(smuggled);
    assert.equal(v.ok, false, `${what} must not verify`);
    assert.match(v.problems.join('\n'), /unrecognized grammar/);
  }

  // The `for: keeping:` smuggle (c) stays banned for its original reason, and
  // the 2026-09-17 ruling did NOT re-license it: the givers' reward is the
  // arrow-free holo row, so nothing in this seam ever needs an arrow-bearing
  // MINT row. The retired keeping-mint shape is still arrow-free and still
  // invisible to the raw movement folds.
  const lawful = keepingMintLine({ date: '2026-08-01', handle: 'stan', n: 25, pot: 'ec2', epoch: '2026-07' });
  assert.equal(classifyEntry(lawful).kind, 'keeping-mint');
  assert.ok(!lawful.includes('→'), 'the retired row carries no arrow, so no movement fold can see it');
  const asEntries = [{ canonical: lawful }];
  assert.equal(foldBalances(asEntries).size, 0, 'foldBalances sees nothing');
  assert.equal(foldMintCount(asEntries).size, 0, 'foldMintCount sees nothing');
  assert.equal(foldKeepingMint(asEntries).get('stan'), 25, 'only the reader that opts in sees it');

  // AND THE MIRROR, which is what the 2026-09-17 ruling changed: the HOLO row is
  // equally arrow-free and the same two folds DO see it — by kind, not by shape.
  // This is the pair of asserts that reads 0/0 before the amendment and would go
  // red if either arm were dropped.
  const reward = holoMintLine({ date: '2026-08-01', handle: 'paz', n: 25, pot: 'ec2', epoch: '2026-07', ref: 'stripe:x' });
  assert.ok(!reward.includes('→'), 'a mint is not a movement — the shape stays arrow-free');
  const holoEntries = [{ canonical: reward }];
  assert.equal(foldBalances(holoEntries).get('paz'), 25, 'the balance credits it BY KIND');
  assert.equal(foldBalances(holoEntries).get('MINT'), -25, 'drawn from MINT, so conservation still holds');
  assert.equal([...foldBalances(holoEntries).values()].reduce((a, b) => a + b, 0), 0);
  assert.equal(foldMintCount(holoEntries).get('paz'), 25, 'and it counts in minted-cumulative');
  assert.equal(foldPrimaryMint(holoEntries).size, 0, 'while primary mint alone still sees nothing');
});

test('a re-recorded receipt bounces — at the door and in the replay (one dollar, one mint chance)', () => {
  // LAW § 10: "Mint-at-entry, never at spend: a dollar mints (or doesn't) exactly
  //            once, when it crosses the seam."
  const { pub, priv } = keypair();
  const repo = seamTown({ pub, priv, pins: PINS, pots: { ec2: { beneficiary: 'keeper' } } });
  const keyFile = join(repo, 'stamp-key.pem');
  const rcpt = ['--receipt', '--pot', 'ec2', '--rail', 'stripe', '--usd', '50', '--from', 'paz',
    '--ref', 'stripe:pi_dup', '--date', '2026-07-03', '--key', keyFile, '--repo', repo];
  execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), ...rcpt], { encoding: 'utf8' });
  assert.throws(
    () => execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), ...rcpt], { encoding: 'utf8', stdio: 'pipe' }),
    (e) => /already recorded/.test(String(e.stderr)),
    'the door bounces a re-recorded ref');
  const dup = mkForkAppend(repo, priv,
    potReceiptLine({ date: '2026-07-04', pot: 'ec2', rail: 'usdc', usd: 999, from: 'vic', ref: 'stripe:pi_dup' }));
  const v = verifyStampLedger(dup);
  assert.equal(v.ok, false, 'a duplicate ref slipped past any door must still fail verify');
  assert.match(v.problems.join('\n'), /already recorded/);
});

test('one epoch, one close — and the reserved namespaces hold', () => {
  // LAW § 8.5: "The matched pot converts to equity exactly once."
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 50 }, { handle: 'paz', n: 200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 50, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 50, from: 'paz', ref: 'stripe:pi_6' }),
  ], priv);
  closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  const again = deriveEpochClose({
    entries: entriesOf(repo), households: householdKeys(repo), pot: 'ec2',
    potMeta: potFile(repo, 'ec2'), epoch: '2026-07', date: '2026-08-02', dial: keepingDial(repo),
  });
  assert.equal(again.ok, false);
  assert.match(again.error, /already closed/);

  // a keeping stake is never a ballot stake: the pot/ namespace is reserved
  const c = classifyEntry(potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'x', n: 1, via: 'api' }));
  assert.equal(c.kind, 'pot-stake', 'stake:pot/… must never parse as a vote on a topic called "pot"');
  // and a stake against a pot no file declares fails verify
  const ghost = mkForkAppend(repo, priv, potStakeLine({ date: '2026-08-03', handle: 'paz', pot: 'ghost', n: 1, via: 'api' }));
  const v = verifyStampLedger(ghost);
  assert.equal(v.ok, false);
  assert.match(v.problems.join('\n'), /unknown pot "ghost"/);
});

test('a held keeping-stake survives epochs it doesn\'t close in, inert', () => {
  // LAW § 8.2: "Households stake keeping-stakes on it (the want signal + the
  //             pricing mass)." A stake is per pot; closing one pot's epoch is
  //             not an event in any other pot's life.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: {
      ec2: { beneficiary: 'keeper', target_usd_per_epoch: 150 },
      lamp: { beneficiary: 'dot', target_usd_per_epoch: 40 },
    },
    gifts: [{ handle: 'stan', n: 150 }, { handle: 'vic', n: 40 }, { handle: 'paz', n: 600 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'vic', pot: 'lamp', n: 40, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 150, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 150, from: 'paz', ref: 'stripe:pi_5' }),
  ], priv);
  closeDirect(repo, priv, { pot: 'ec2', epoch: '2026-07', date: '2026-08-01' });
  let v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));
  assert.equal(foldPotPositions(entriesOf(repo)).get('lamp|vic'), 40,
    'ec2 closing its epoch did not touch the lamp stake');
  assert.equal(foldStaked(entriesOf(repo)).get('vic'), 40, 'still escrowed, still vic\'s');

  // and the held stake closes fine in ITS epoch, months later
  appendSigned(repo, [
    potReceiptLine({ date: '2026-09-03', pot: 'lamp', rail: 'usdc', usd: 40, from: 'paz', ref: 'usdc:tx9' }),
  ], priv);
  closeDirect(repo, priv, { pot: 'lamp', epoch: '2026-09', date: '2026-10-01' });
  v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));
});


// ════════════════════════════════════════════════════════════════════════════
// THE HAND, CORRECTED — the pot-receipt correction row
// ════════════════════════════════════════════════════════════════════════════
//
// Founder-ruled 2026-08-27, on being shown that a donation witnessed to the
// wrong hand was unfixable: "there's no way we can correct it by hand later?"
// There was not. The ledger is append-only and signature-linked and had no row
// kind that could speak about an earlier receipt, so a mistyped or unresolvable
// payer was permanent.
//
// What follows corrects THE HAND and nothing else. The amount and the pot are
// the payment itself; a correction is not a re-payment, and the grammar has no
// field to express either, which is why the last falsifier here can assert
// immutability by showing the row CANNOT BE WRITTEN rather than by trusting a
// rule someone has to remember.

const corrTown = () => {
  const { pub, priv } = keypair();
  const repo = seamTown({ pub, priv, pots: { ec2: 100 }, gifts: [{ handle: 'stan', n: 400 }] });
  return { repo, priv };
};
const corrEntries = (repo) => parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'));

test('a correction reattributes the dollar: the fold answers with the new hand, and says what it was', () => {
  // LAW (stamp-mint.mjs, the pot-receipt's own line, verbatim): the receipt is
  //     "a witnessed real-dollar payment against a pot ... ref is unique
  //     forever: one dollar, one mint chance". The dollar and its ref are
  //     fixed; WHOSE it was is the one thing a correction may move.
  const { repo, priv } = corrTown();
  appendSigned(repo, [potReceiptLine({ date: '2026-08-25', pot: 'ec2', rail: 'stripe', usd: 10, from: 'outside:stripe', ref: 'stripe:cs_live_x' })], priv);

  const before = foldPotReceipts(corrEntries(repo));
  assert.equal(before.receipts.length, 1);
  assert.equal(before.receipts[0].from, 'outside:stripe', 'the gift, as witnessed');

  appendSigned(repo, [potCorrectionLine({
    date: '2026-08-27', ref: 'stripe:cs_live_x',
    from: 'outside:stripe', to: 'stan', reason: 'unknown-hand', by: 'keemin',
  })], priv);

  const after = foldPotReceipts(corrEntries(repo));
  assert.equal(after.receipts.length, 1, 'still ONE receipt — a correction is not a second payment');
  assert.equal(after.receipts[0].from, 'stan', 'the hand is corrected');
  assert.equal(after.receipts[0].corrected_from, 'outside:stripe', 'and what it used to say is kept, never erased');
  assert.equal(after.receipts[0].usd, 10, 'the dollars are untouched');
  assert.equal(after.receipts[0].pot, 'ec2', 'and so is the pot');
  assert.equal(after.receipts[0].correction.reason, 'unknown-hand');
  assert.equal(after.receipts[0].correction.by, 'keemin');
  assert.ok(after.corrections.some((c) => c.ref === 'stripe:cs_live_x' && c.applied));

  // and the ledger still verifies — a correction is an ordinary signed row
  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, v.problems?.join('\n'));
});

test('THE ANTI-DOUBLE-MINT LAW IS UNTOUCHED: a corrected ref still bounces when re-witnessed', () => {
  // LAW (tools/epoch-close.mjs --receipt, verbatim): `receipt ref "${ref}"
  //     already recorded (...) — one dollar, one mint chance; a re-recorded
  //     receipt bounces`.
  //
  // This is the falsifier the whole piece hangs on. That guard reads the very
  // fold this lane changed (`foldPotReceipts(entries)` then
  // `receipts.find(...)`), so an implementation that "applied" a correction by
  // appending a SECOND receipt, or by dropping the corrected row out of the
  // fold, would open a second mint chance on a spent dollar — and would look
  // perfectly reasonable in a diff.
  const { repo, priv } = corrTown();
  appendSigned(repo, [potReceiptLine({ date: '2026-08-25', pot: 'ec2', rail: 'stripe', usd: 10, from: 'outside:stripe', ref: 'stripe:cs_dup' })], priv);
  appendSigned(repo, [potCorrectionLine({ date: '2026-08-27', ref: 'stripe:cs_dup', from: 'outside:stripe', to: 'stan', reason: 'mistyped-handle', by: 'keemin' })], priv);

  // the guard's own two lines, run here exactly as the CLI runs them
  const { receipts } = foldPotReceipts(corrEntries(repo));
  const prior = receipts.find((r) => r.ref === 'stripe:cs_dup');
  assert.ok(prior, 'the corrected receipt is STILL findable by its ref — this is what makes the re-record bounce');
  assert.equal(receipts.filter((r) => r.ref === 'stripe:cs_dup').length, 1, 'and there is exactly one of it');

  // the CLI itself refuses, correction or no correction
  const key = join(repo, 'k.pem'); writeFileSync(key, priv);
  assert.throws(() => execFileSync(process.execPath, [
    join(HERE, 'epoch-close.mjs'), '--receipt', '--pot', 'ec2', '--rail', 'stripe',
    '--usd', '10', '--from', 'stan', '--ref', 'stripe:cs_dup', '--date', '2026-08-28',
    '--key', key, '--repo', repo,
  ], { encoding: 'utf8', stdio: 'pipe' }), /already recorded|one mint chance/);
});

test('two corrections on one ref: the LATEST DATED wins, and neither row is rewritten', () => {
  // LAW (the town's append-only supersession doctrine, as the ledger practises
  //     it everywhere else): nothing is edited in place; a later row supersedes
  //     an earlier one and both stay readable.
  const { repo, priv } = corrTown();
  appendSigned(repo, [potReceiptLine({ date: '2026-08-25', pot: 'ec2', rail: 'stripe', usd: 10, from: 'outside:stripe', ref: 'stripe:cs_two' })], priv);
  appendSigned(repo, [potCorrectionLine({ date: '2026-08-26', ref: 'stripe:cs_two', from: 'outside:stripe', to: 'stan', reason: 'unknown-hand', by: 'keemin' })], priv);
  appendSigned(repo, [potCorrectionLine({ date: '2026-08-27', ref: 'stripe:cs_two', from: 'outside:stripe', to: 'paz', reason: 'wrong-household', by: 'keemin' })], priv);

  const { receipts } = foldPotReceipts(corrEntries(repo));
  assert.equal(receipts[0].from, 'paz', 'the later correction governs');
  assert.equal(receipts[0].correction.date, '2026-08-27');

  // both rows are still on the ledger, verbatim — supersession, not erasure
  const text = readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
  assert.match(text, /2026-08-26 · pot-correction · ref: stripe:cs_two · from outside:stripe to stan/);
  assert.match(text, /2026-08-27 · pot-correction · ref: stripe:cs_two · from outside:stripe to paz/);
});

test('a correction that does not match the row it corrects is REFUSED BY NAME, never applied quietly', () => {
  // LAW (this row's own grammar, stamp-mint.mjs): the correction "names the
  //     ORIGINAL ref verbatim and both hands, so a reader can check the
  //     correction against the row it corrects".
  //
  // The `from` is there to be checked. A correction whose `from` is not what
  // the receipt currently says is about a state that does not exist, and
  // applying it anyway would be the engine choosing whose deed grew. Refused —
  // and NAMED, because a silent no-op reads to the operator exactly like a
  // correction that worked.
  const { repo, priv } = corrTown();
  appendSigned(repo, [potReceiptLine({ date: '2026-08-25', pot: 'ec2', rail: 'stripe', usd: 10, from: 'outside:stripe', ref: 'stripe:cs_stale' })], priv);
  appendSigned(repo, [potCorrectionLine({ date: '2026-08-27', ref: 'stripe:cs_stale', from: 'somebody-else', to: 'stan', reason: 'unknown-hand', by: 'keemin' })], priv);

  const { receipts, corrections } = foldPotReceipts(corrEntries(repo));
  assert.equal(receipts[0].from, 'outside:stripe', 'the receipt is untouched');
  assert.equal(receipts[0].correction, undefined);
  const row = corrections.find((c) => c.ref === 'stripe:cs_stale');
  assert.ok(row, 'the refusal is reported, not swallowed');
  assert.equal(row.applied, false);
  assert.equal(row.refused, 'stale-from');

  // a correction naming a ref no receipt carries is surfaced the same way
  appendSigned(repo, [potCorrectionLine({ date: '2026-08-27', ref: 'stripe:cs_nothere', from: 'a', to: 'b', reason: 'typo', by: 'keemin' })], priv);
  const again = foldPotReceipts(corrEntries(repo));
  assert.equal(again.corrections.find((c) => c.ref === 'stripe:cs_nothere')?.refused, 'no-such-receipt');
});

test('the amount and the pot cannot be corrected, because the row has no way to say them', () => {
  // LAW (stamp-mint.mjs, this row's own comment, verbatim): "It carries NO usd
  //     and NO pot ... this corrects WHOSE dollar it was, never how many or
  //     which pot — those are the payment itself and a correction is not a
  //     re-payment."
  //
  // Asserted against the GRAMMAR rather than against a guard: a line that tries
  // to carry either field does not parse as a correction at all, so there is no
  // rule for anyone to forget and no code path to reach.
  const good = potCorrectionLine({ date: '2026-08-27', ref: 'stripe:x', from: 'a', to: 'b', reason: 'r', by: 'keemin' });
  assert.equal(classifyEntry(good).kind, 'pot-correction');
  assert.equal(classifyEntry(good).usd, undefined);
  assert.equal(classifyEntry(good).pot, undefined);

  for (const smuggle of [
    '- 2026-08-27 · pot-correction · ref: stripe:x · from a to b · usd: 20 · r · by: keemin',
    '- 2026-08-27 · pot-correction · ref: stripe:x · pot:ec2 · from a to b · r · by: keemin',
    '- 2026-08-27 · pot-correction · ref: stripe:x · from a → b · r · by: keemin',
  ]) assert.equal(classifyEntry(smuggle).kind, 'unknown', `refused: ${smuggle}`);

  // ARROW-FREE, so no movement fold can ever see it as money moving
  assert.ok(!good.includes(' → '), 'a correction carries no arrow');
});

test('NOTHING BUT A HAND CAN EMIT ONE — no door, no watcher, no automatic caller', () => {
  // The gate is not a field on the row: the town has ONE pen (appendSigned,
  // shared by --append, --declare-* and the office pen) and no per-writer
  // identity anywhere in the grammar. `by:` is provenance in the gift/issuance
  // sense — it records WHO, it does not enforce. So the real gate is that the
  // ONLY thing able to emit this row is a hand-run CLI flag, and that is what
  // this asserts: a source scan, because it is the only thing that can see a
  // caller nobody wrote a test for.
  const emitters = readdirSync(HERE)
    .filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'))
    .filter((f) => /potCorrectionLine|pot-correction ·/.test(readFileSync(join(HERE, f), 'utf8')));
  assert.deepEqual(
    emitters.sort(), ['epoch-close.mjs', 'stamp-mint.mjs'].sort(),
    'exactly two files may name this row: the grammar that defines it and the hand-run CLI that writes it',
  );

  // and within the CLI, it hangs off an explicit flag rather than any automatic path
  const cli = readFileSync(join(HERE, 'epoch-close.mjs'), 'utf8');
  assert.match(cli, /--correct-hand/, 'the flag exists');
  assert.match(cli, /has\('--correct-hand'\)/, 'and the emitter sits behind it');
});

test('a correction AFTER a close moves the hand and NOT the holo, and says so by name', () => {
  // LAW (stamp-mint.mjs, the holo row's own line, verbatim): "the row naming
  //     the ref is what marks that dollar's one mint chance as spent."
  //
  // Correcting the hand after a close would otherwise mean minting holo to a
  // new hand for a dollar whose one mint chance is already spent — which is the
  // anti-double-mint law itself. That is a founder ruling about the mint law,
  // not something a fold may decide quietly, so the fold corrects the HAND (so
  // every reader shows who really paid), leaves the holo row exactly where it
  // is, and FLAGS the case rather than papering it over.
  //
  // No close has ever run on the live ledger (zero holo rows, verified
  // 2026-08-27), so this is the case the town has not met yet — which is
  // precisely when it is cheap to decide and impossible to test later.
  const { repo, priv } = corrTown();
  appendSigned(repo, [potReceiptLine({ date: '2026-08-25', pot: 'ec2', rail: 'stripe', usd: 10, from: 'outside:stripe', ref: 'stripe:cs_closed' })], priv);
  appendSigned(repo, [holoMintLine({ date: '2026-08-26', handle: 'outside:stripe', n: 0, pot: 'ec2', epoch: '2026-08', ref: 'stripe:cs_closed' })], priv);
  appendSigned(repo, [potCorrectionLine({ date: '2026-08-27', ref: 'stripe:cs_closed', from: 'outside:stripe', to: 'stan', reason: 'unknown-hand', by: 'keemin' })], priv);

  const { receipts, settled } = foldPotReceipts(corrEntries(repo));
  assert.ok(settled.has('stripe:cs_closed'), 'the ref is settled — its mint chance is spent');
  assert.equal(receipts[0].from, 'stan', 'the hand is still corrected: the record should say who really paid');
  assert.equal(receipts[0].correction.after_close, true, 'and the fold NAMES that this one landed after the close');

  // the holo the close wrote is untouched — nothing re-mints
  assert.equal(foldHolo(corrEntries(repo)).get('stan') ?? 0, 0, 'no holo appeared for the corrected hand');
});

// ── the resident's own way out (pot-unstake, ruled 2026-09-17) ───────────────
// LAW (Keemin, 2026-09-17, after a site bug placed the same keeping stake
//      twice): "just unstake it by hand please, we don't need a whole engine
//      for it."
// LAW (the world-mark precedent this row is cut from, stamp-mint.mjs § world
//      stakes): "Unstake is resident-initiated (`for: unstake`), which is what
//      distinguishes it from the ballot's `for: close` — there the founder
//      closes a window and every escrow returns at once; here the staker takes
//      their own stamps back."

// A town with one pot and two funded stakers, both already staked on it.
function walkTown() {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { walk: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 60 }, { handle: 'paz', n: 60 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'walk', n: 40, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'paz', pot: 'walk', n: 25, via: 'api' }),
  ], priv);
  return { repo, priv, pub };
}

test('an unstake hands the staker their own stamps back — liquid up, staked down, escrow down', () => {
  // LAW (2026-09-17): "just unstake it by hand please".
  // The three tenses must move together or `assets = liquid + staked` is broken
  // with every number still looking plausible — the same invariant the
  // world-mark unstake had to satisfy.
  const { repo, priv } = walkTown();
  const before = entriesOf(repo);
  assert.equal(foldPotPositions(before).get('walk|stan'), 40, 'stan is staked 40 to begin with');
  const liquidBefore = foldBalances(before).get('stan');
  const stakedBefore = foldStaked(before).get('stan');
  const escrowBefore = foldBalances(before).get('stake:pot/walk');

  appendSigned(repo, [potUnstakeLine({ date: '2026-07-03', pot: 'walk', handle: 'stan', n: 15, via: 'hand' })], priv);
  const after = entriesOf(repo);

  assert.equal(foldBalances(after).get('stan'), liquidBefore + 15, 'liquid up by exactly the unstaked amount');
  assert.equal(foldStaked(after).get('stan'), stakedBefore - 15, 'staked down by the same amount');
  assert.equal(foldBalances(after).get('stake:pot/walk'), escrowBefore - 15, 'the pot escrow account gave it back');
  assert.equal(foldPotPositions(after).get('walk|stan'), 25, 'and stan still holds the rest of his own position');
  assert.equal(foldPotPositions(after).get('walk|paz'), 25, 'while paz is untouched');
  assert.equal(verifyStampLedger(repo).ok, true, 'the ledger still verifies — chain, conservation and lawful all green');
});

test('an unstake is NOT a close: the epoch stays open, and the close still runs afterwards', () => {
  // LAW (ECONOMY-DIALS.json law_side.keeping._what, amended 2026-09-14): "EVERY
  //      OPEN STAKE RETURNS WHOLE (pot-return rows)" — a close is the ceremony
  //      that ends an epoch. An unstake ends nobody's epoch; it names none.
  // This is the whole reason the row exists rather than reusing pot-return:
  // foldClosedEpochs keys on any close row, so a pot-return would let a staker
  // close the epoch by walking away, and "one epoch, one close" would then
  // refuse the real close with the givers unpaid.
  const { repo, priv } = walkTown();
  appendSigned(repo, [potUnstakeLine({ date: '2026-07-03', pot: 'walk', handle: 'stan', n: 40, via: 'hand' })], priv);

  const closedAfterUnstake = foldClosedEpochs(entriesOf(repo));
  assert.equal(closedAfterUnstake.has('walk|2026-07'), false, 'the unstake closed no epoch');
  assert.equal(closedAfterUnstake.size, 0, 'and closed nothing else either');
  assert.equal(foldPotPositions(entriesOf(repo)).get('walk|stan'), undefined, 'stan is fully out — absent means zero');

  // the real close still runs, and sees only what is still staked
  appendSigned(repo, [potReceiptLine({ date: '2026-07-04', pot: 'walk', rail: 'stripe', usd: 100, from: 'paz', ref: 'stripe:cs_walk' })], priv);
  const derived = deriveEpochClose({
    entries: entriesOf(repo), households: householdKeys(repo), pot: 'walk',
    potMeta: potFile(repo, 'walk'), epoch: '2026-07', date: '2026-08-01', dial: keepingDial(repo),
  });
  assert.equal(derived.ok, true, derived.error);
  assert.equal(derived.report.stakesOpen, 25, 'the close sees paz 25 and none of the 40 stan took back');
  appendSigned(repo, derived.rows.map(keepingLine), priv);
  assert.equal(foldClosedEpochs(entriesOf(repo)).has('walk|2026-07'), true, 'NOW the epoch is closed');
  assert.equal(verifyStampLedger(repo).ok, true, 'and an unstake sitting in the prefix does not disturb the close replay');
});

test('an unstake above the staker OWN open position is refused — at the door and in the replay', () => {
  // LAW (2026-09-17, the clip): an unstake draws from the staker's own open
  //      position and nothing else. The escrow ACCOUNT is per pot, so the
  //      generic conservation fold cannot see this — it is ownership, not
  //      arithmetic, exactly as with world-mark unstakes.
  const { repo, priv } = walkTown();
  const keyFile = join(repo, 'stamp-key.pem');

  assert.throws(
    () => execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--unstake',
      '--pot', 'walk', '--handle', 'stan', '--n', '41', '--date', '2026-07-03',
      '--key', keyFile, '--repo', repo], { encoding: 'utf8', stdio: 'pipe' }),
    (e) => /holds 40 .*so 41 cannot come out/.test(String(e.stderr)),
    'the door refuses before a single unlawful byte is written');

  // and a line forged past the door still fails the replay
  const forged = mkForkAppend(repo, priv,
    potUnstakeLine({ date: '2026-07-03', pot: 'walk', handle: 'stan', n: 41, via: 'hand' }));
  const v = verifyStampLedger(forged);
  assert.equal(v.ok, false, 'the verifier is the second net, not the first');
  assert.match(v.problems.join('\n'), /unstakes 41 from pot walk but holds only 40/);
});

test('an unstake cannot reach another resident position — the hole the clip exists for', () => {
  // LAW (stamp-mint.mjs, the world-unstake branch this mirrors): "the escrow
  //      account is per MARK while a position is per (mark, handle), so without
  //      the check below one resident could unstake another's stamps and every
  //      account would still be non-negative."
  // The pot case is identical with `pot` for `mark`, and this is the falsifier
  // that proves the clip is load-bearing rather than decorative: stan asks for
  // 60, which is more than HIS 40 but less than the pot's 65 of escrow, so the
  // conservation fold alone would wave it through.
  const { repo, priv } = walkTown();
  assert.equal(foldBalances(entriesOf(repo)).get('stake:pot/walk'), 65, 'the pot holds 65 across two stakers');

  const forged = mkForkAppend(repo, priv,
    potUnstakeLine({ date: '2026-07-03', pot: 'walk', handle: 'stan', n: 60, via: 'hand' }));
  const v = verifyStampLedger(forged);
  assert.equal(v.ok, false, 'taking 60 out of a 65 pot leaves every ACCOUNT non-negative, and is still theft');
  assert.match(v.problems.join('\n'), /unstakes 60 from pot walk but holds only 40/);
});

test('--dry-run prints the row and appends nothing', () => {
  // LAW (the tool's standing shape, shared with --close): "--dry-run (or no
  //      --key) prints the report and the would-be lines, appends nothing."
  const { repo } = walkTown();
  const lengthBefore = entriesOf(repo).length;
  const out = execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--unstake',
    '--pot', 'walk', '--handle', 'stan', '--n', '15', '--date', '2026-07-03',
    '--dry-run', '--repo', repo], { encoding: 'utf8' });

  assert.match(out, /for: unstake · via: hand/, 'it shows the row it would write');
  assert.match(out, /not a close/, 'and says out loud that the epoch survives it');
  assert.equal(entriesOf(repo).length, lengthBefore, 'nothing was appended');
  assert.equal(foldPotPositions(entriesOf(repo)).get('walk|stan'), 40, 'and the position is untouched');
});

test('a resident with no position on the pot is told so, rather than writing a zero', () => {
  // LAW (2026-09-17): an unstake gives back what you put in. Someone who put in
  //      nothing is not owed a row saying so — the ledger records acts, and a
  //      refusal is not an act.
  const { repo } = walkTown();
  const keyFile = join(repo, 'stamp-key.pem');
  assert.throws(
    () => execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--unstake',
      '--pot', 'walk', '--handle', 'dot', '--n', '1', '--date', '2026-07-03',
      '--key', keyFile, '--repo', repo], { encoding: 'utf8', stdio: 'pipe' }),
    (e) => /holds no open stake/.test(String(e.stderr)));
});

// ════════════════════════════════════════════════════════════════════════════
// THE CLOSE UNDER THE HOLO-IS-LIQUID RULING (POS-33, 2026-09-17)
// ════════════════════════════════════════════════════════════════════════════
// THE FOUNDER, verbatim: "for POS-33, I'm good to let funding minted stamps
//   contribute to the max stamps you can get from another fund. it compounds by
//   design. non-spendable is repealed; the stamps are like any other, but are
//   holo to signify the special source."
// Everything above this line was rewritten to the amended law where it spoke the
// old one. Everything below is new ground the amendment opened.

const ELASTIC_BOX = { beneficiary: 'keeper', target_usd_per_epoch: null, close: 'elastic', min_close_usd: 5, uncapped: true };

test('ELASTIC: the roll gates the ceremony, and below the floor NOTHING happens', () => {
  // POT FILE pot-darko-fund.json § _close (the founder's ruling, 2026-08-23):
  //   "a month's close runs only if the accumulated roll — carried dollars plus
  //   this month's — totals at least min_close_usd; otherwise dollars and stakes
  //   both stand and ride to the next month ... A February $2 still earns its
  //   share when April finally closes."
  // The refusal has to leave NO trace, or "ride to the next month" is a promise
  // the machinery cannot keep: a settled ref or a returned stake would be spent.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { box: ELASTIC_BOX, noFloor: { beneficiary: 'keeper', target_usd_per_epoch: null, close: 'elastic' } },
    gifts: [{ handle: 'stan', n: 40 }, { handle: 'paz', n: 100 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'box', n: 40, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'box', rail: 'stripe', usd: 3, from: 'paz', ref: 'stripe:e1' }),
  ], priv);
  const derive = (pot, epoch, date) => deriveEpochClose({
    entries: entriesOf(repo), households: householdKeys(repo), pot,
    potMeta: potFile(repo, pot), epoch, date, dial: keepingDial(repo),
  });

  const below = derive('box', '2026-07', '2026-08-01');
  assert.equal(below.ok, false, '$3 has not met the $5 floor');
  assert.match(below.error, /rolled \$3 of the \$5/);
  assert.equal(foldPotPositions(entriesOf(repo)).get('box|stan'), 40, 'the stake still stands');
  assert.equal(foldPotReceipts(entriesOf(repo)).settled.size, 0, 'and the dollar is still unspent — it rides');

  // an elastic pot with no floor at all cannot close: the floor is its only gate
  assert.match(derive('noFloor', '2026-07', '2026-08-01').error, /min_close_usd/);

  // the next month's $2 carries the roll over the floor, and BOTH dollars count
  appendSigned(repo, [potReceiptLine({ date: '2026-08-03', pot: 'box', rail: 'stripe', usd: 2, from: 'paz', ref: 'stripe:e2' })], priv);
  const d = closeDirect(repo, priv, { pot: 'box', epoch: '2026-08', date: '2026-09-01' });
  assert.equal(d.report.elastic, true);
  assert.equal(d.report.closeFloor, 5);
  assert.equal(d.report.potTarget, null, 'an elastic pot posts no target, and the report says so rather than printing a 0');
  assert.equal(d.report.dollarsFunding, 5, 'the WHOLE accumulated roll, not just this month\'s');
  assert.equal(d.report.fundedFraction, 1, 'an elastic pot\'s need IS whatever arrived');
  assert.equal(d.report.fundingMintSized, 40, 'so the whole staked mass sizes the reward');
  assert.deepEqual(d.rows.filter((r) => r.kind === 'holo').map((r) => `${r.handle}:${r.n}`),
    ['paz:24', 'paz:16'], 'floor(40 · 3/5) = 24 for July\'s dollars and floor(40 · 2/5) = 16 for August\'s');
  assert.deepEqual(d.rows.filter((r) => r.kind === 'holo').map((r) => r.ref), ['stripe:e1', 'stripe:e2'],
    'one row per receipt, in ledger order — the carried dollar earns its share');
  assert.equal(d.report.returned, 40);
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('THE MARK: a receipt settled at ZERO is never counted or minted again', () => {
  // DIAL law_side.keeping._holo (2026-09-17): the row is written "one per receipt
  //   the close settles, `<n>` may be 0 (the receipt's one mint chance spent)".
  // stamp-mint.mjs § foldPotReceipts: "A receipt whose ref a holo row names has
  //   had its one mint chance."
  // This is the falsifier for the failure mode the earlier POS-33 lane measured
  // and returned on: a carry-forward pot whose settled dollars are re-counted
  // would re-fund and re-mint the same roll every month, for ever. The ZERO row
  // is the only thing standing between the town and that.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { roll: ELASTIC_BOX },
    gifts: [{ handle: 'vic', n: 100 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-09-02', handle: 'vic', pot: 'roll', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-09-03', pot: 'roll', rail: 'stripe', usd: 10, from: 'vic', ref: 'stripe:m1' }),
  ], priv);
  const sept = closeDirect(repo, priv, { pot: 'roll', epoch: '2026-09', date: '2026-09-30' });
  assert.equal(sept.report.dollarsFunding, 10);
  assert.equal(sept.report.fundingMint, 0, 'sole staker, sole payer — she cannot trade with herself');
  const row = sept.rows.find((r) => r.kind === 'holo');
  assert.equal(row.n, 0, 'and the row lands reading zero');
  assert.ok(foldPotReceipts(entriesOf(repo)).settled.has('stripe:m1'),
    'the ZERO row is what spends the mint chance — nothing else marks it');

  // October: her stake came home, she stakes it again, and no new dollars arrive.
  appendSigned(repo, [potStakeLine({ date: '2026-10-02', handle: 'vic', pot: 'roll', n: 100, via: 'api' })], priv);
  const oct = deriveEpochClose({
    entries: entriesOf(repo), households: householdKeys(repo), pot: 'roll',
    potMeta: potFile(repo, 'roll'), epoch: '2026-10', date: '2026-10-31', dial: keepingDial(repo),
  });
  assert.equal(oct.ok, false);
  assert.match(oct.error, /rolled \$0 of the \$5/,
    'September\'s $10 is SPENT — re-counting it would put the roll at $10 and run a second close on the same dollars');
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('LIQUID: a giver stakes out of their reward, and the whole ledger still verifies', () => {
  // THE FOUNDER, 2026-09-17: "non-spendable is repealed; the stamps are like any
  //   other, but are holo to signify the special source."
  // DIAL law_side.keeping._holo: "they count in the payer's balance and in
  //   minted-cumulative and they stake, vote, pay and transfer like any stamp."
  // The proof is a stake STRICTLY LARGER than the giver could have made before
  // the close. Drop the holo arm from foldBalances and the derive is unchanged;
  // drop it from stamp-verify's running fold and this stake reads as an overdraw
  // — a forgery verdict on a lawful row. Both flips red this test.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { one: { beneficiary: 'keeper', target_usd_per_epoch: 100 }, two: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 100 }, { handle: 'dot', n: 6 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'one', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'one', rail: 'stripe', usd: 100, from: 'dot', ref: 'stripe:l1' }),
  ], priv);
  const before = foldBalances(entriesOf(repo)).get('dot');
  assert.equal(before, 7, 'gift 6 + one correspondence mint — and not a stamp more');

  const d = closeDirect(repo, priv, { pot: 'one', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(d.report.fundingMint, 3, 'raw 100 clipped to floor(ρ × 7) = 3');
  const after = entriesOf(repo);
  assert.equal(foldHolo(after).get('dot'), 3);
  assert.equal(foldBalances(after).get('dot'), 10, 'the reward is IN her spendable balance');
  assert.equal(foldMintCount(after).get('dot'), 10, 'and in minted-cumulative');
  assert.equal(foldPrimaryMint(after).get('dot'), 7, 'her primary mint did not move');

  // THE PROOF: ten staked, three more than she could have staked an hour ago.
  appendSigned(repo, [potStakeLine({ date: '2026-08-02', handle: 'dot', pot: 'two', n: 10, via: 'api' })], priv);
  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));
  assert.ok(10 > before, 'strictly more than her pre-close balance — the stake could not have been funded without the reward');
  assert.equal(foldStaked(entriesOf(repo)).get('dot'), 10);
  assert.equal(foldBalances(entriesOf(repo)).get('dot'), 0, 'she spent every stamp she had, reward included');
  assert.equal([...foldBalances(entriesOf(repo)).values()].reduce((a, b) => a + b, 0), 0, 'and conservation still holds');
});

test('LIQUID, THE SECOND HOLDER: a giver PAYS a letter out of their reward, and the mint pass agrees with the verifier', () => {
  // DIAL law_side.keeping._holo (2026-09-17): holo stamps "stake, vote, PAY and
  //   transfer like any stamp."
  // THIS TEST EXISTS BECAUSE ONE FLIP PROVES ONE FILE. The liquidity law has
  // THREE holders — foldBalances, stamp-verify's own running fold, and
  // deriveTransfers' settlement balance — and dropping the arm from the third
  // left the whole suite cheerfully green, because no falsifier here had ever
  // sent a paying letter funded by a reward. The two sides decide the SAME
  // question from opposite ends: deriveTransfers picks transfer-or-void when the
  // mint pass appends, and stamp-verify replays that pick in ledger order. If
  // only one of them credits holo, the mint writes `void: insufficient-balance`
  // where the verifier expects a transfer, and the town's ledger fails
  // SETTLEMENT DIVERGES on a letter that was perfectly lawful.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { one: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 100 }, { handle: 'dot', n: 6 }],
  });
  const keyFile = join(repo, 'stamp-key.pem');
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'one', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'one', rail: 'stripe', usd: 100, from: 'dot', ref: 'stripe:p1' }),
  ], priv);
  closeDirect(repo, priv, { pot: 'one', epoch: '2026-07', date: '2026-08-01' });
  assert.equal(foldHolo(entriesOf(repo)).get('dot'), 3, 'her reward, clipped to floor(ρ × 7)');

  // A paying letter she could NOT have afforded before the close: her balance
  // without the reward would be 7 + 1 (this letter's own mint) = 8, and she pays 10.
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `# ledger\n\n${[
    D('2026-06-12', 'm-1', 'stan', 'paz'),
    D('2026-06-12', 'm-2', 'keeper', 'dot'),
    '- 2026-08-05 · m-3 · dot → stan · pays: 10 · thread: new',
  ].join('\n')}\n`);
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });

  const settlement = entriesOf(repo).map((e) => classifyEntry(e.canonical)).find((c) => c.id === 'm-3');
  assert.ok(settlement, 'the mint pass settled the paying letter');
  assert.equal(settlement.kind, 'transfer',
    'a TRANSFER — a void:insufficient-balance here would mean the mint pass cannot see her reward');
  assert.equal(settlement.n, 10);
  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));
  assert.equal(foldBalances(entriesOf(repo)).get('dot'), 1, '7 + 3 reward + 1 mint, less the 10 she paid');
  assert.equal([...foldBalances(entriesOf(repo)).values()].reduce((a, b) => a + b, 0), 0);
});

test('THE RETIRED ROWS: no burn, no keeping mint, no BURN account — in any block a close can derive', () => {
  // DIAL law_side.keeping._what (2026-09-14): "Nothing burns."
  // DIAL law_side.keeping._keeping_mint (2026-09-14): "no stake burns, so there
  //   is no σ leg and no keeping mint."
  // Three shapes of close in one fixture — fully funded, half funded, zero-dollar
  // — because a purge that misses one shape is exactly the kind that passes.
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: {
      full: { beneficiary: 'keeper', target_usd_per_epoch: 100 },
      half: { beneficiary: 'keeper', target_usd_per_epoch: 100 },
      dry: { beneficiary: 'keeper', target_usd_per_epoch: 100 },
    },
    gifts: [{ handle: 'stan', n: 300 }, { handle: 'paz', n: 600 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'full', n: 100, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'half', n: 100, via: 'api' }),
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'dry', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'full', rail: 'stripe', usd: 100, from: 'paz', ref: 'stripe:w1' }),
    potReceiptLine({ date: '2026-07-03', pot: 'half', rail: 'stripe', usd: 50, from: 'paz', ref: 'stripe:w2' }),
  ], priv);

  let sawMint = false;
  for (const pot of ['full', 'half', 'dry']) {
    const d = closeDirect(repo, priv, { pot, epoch: '2026-07', date: '2026-08-01' });
    assert.ok(d.rows.length > 0, `the ${pot} close emits a block`);
    if (d.report.fundingMint > 0) sawMint = true;
    for (const r of d.rows)
      assert.ok(r.kind === 'pot-return' || r.kind === 'holo', `${pot}: a close derives two kinds, got ${r.kind}`);
    for (const line of d.rows.map(keepingLine)) {
      assert.ok(!/BURN/.test(line), `${pot}: a rendered close line still speaks BURN: ${line}`);
      assert.ok(!/for: keeping:/.test(line), `${pot}: a rendered close line still speaks the σ leg: ${line}`);
    }
    assert.equal(d.report.returned, d.report.stakesOpen,
      `${pot}: every open stake goes home, whatever the funding`);
  }
  assert.ok(sawMint, 'the fixture is not vacuous — at least one of the three closes really minted');

  // and the same over every line that actually LANDED in the sealed ledger
  const landed = entriesOf(repo).map((e) => e.canonical);
  assert.ok(!landed.some((c) => classifyEntry(c).kind === 'keeping-burn'));
  assert.ok(!landed.some((c) => classifyEntry(c).kind === 'keeping-mint'));
  assert.equal(foldBalances(entriesOf(repo)).get('BURN'), undefined, 'the BURN account was never touched');
  assert.equal(verifyStampLedger(repo).ok, true);
});

test('--close --dry-run prints the block and appends NOTHING; the readers read the same history back', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { ec2: { beneficiary: 'keeper', target_usd_per_epoch: 100 } },
    gifts: [{ handle: 'stan', n: 100 }, { handle: 'paz', n: 200 }],
  });
  appendSigned(repo, [
    potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 100, via: 'api' }),
    potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'stripe', usd: 100, from: 'paz', ref: 'stripe:dry1' }),
  ], priv);
  const lengthBefore = entriesOf(repo).length;
  const out = execFileSync(process.execPath, [...closeArgs({ repo, pot: 'ec2', epoch: '2026-07', date: '2026-08-01', key: false }), '--dry-run'], { encoding: 'utf8' });
  assert.match(out, /dry run — nothing appended/);
  assert.match(out, /for: pot-return:2026-07/, 'it shows the rows it would write');
  assert.match(out, /· holo · paz ·/);
  assert.equal(entriesOf(repo).length, lengthBefore, 'and the ledger is untouched');
  assert.equal(foldPotReceipts(entriesOf(repo)).settled.size, 0, 'no ref was spent by looking at it');

  // now for real, and the readers read it back
  execFileSync(process.execPath, closeArgs({ repo, pot: 'ec2', epoch: '2026-07', date: '2026-08-01' }), { encoding: 'utf8' });
  const held = execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--holo-held', 'paz', '--repo', repo], { encoding: 'utf8' });
  assert.match(held, /100\s+gh:2\s+\(paz:100\)/, '--holo-held names the source of the reward');
  const own = execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), '--ownership', 'paz', '--repo', repo], { encoding: 'utf8' });
  assert.match(own, /paz\s+201\s+0\s+100\s+301\s+301/, 'primary, keeping, holo, minted, ownership — holo inside minted, once');
});

// ── the live instance: the town's own ledger, at whatever tip this runs on ───
// The brief asked for THIS THREAD'S INSTANCE pinned. It is asserted as RELATIONS
// recomputed from the exports rather than as a table of today's numbers, because
// a fixture pinned to a live record decays with the next receipt, the next stake,
// or the founder's own close. At town main 9468d6e34 (2026-09-17) the arm below
// read: roll $62 across 6 receipts, mass 210 (rei 10 + wright 200), M = 210,
// minted 181, un-minted 29, soren clipped to his cap of 9. Those are the numbers
// the report to #2811 carries; this test checks the LAW that produced them.
const TOWN = join(HERE, '..');

test('THE LIVE INSTANCE: the town\'s ledger verifies, and darko-fund closes by the ruled arithmetic', () => {
  const entries = parseStampLedger(readFileSync(join(TOWN, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'));
  const v = verifyStampLedger(TOWN);
  assert.equal(v.ok, true, (v.problems ?? []).join('\n'));
  assert.equal(entries.filter((e) => classifyEntry(e.canonical).kind === 'unknown').length, 0,
    'every line of the live ledger still parses — the amendment added no grammar and retired none');

  const pot = 'darko-fund';
  const meta = potFile(TOWN, pot);
  const dial = keepingDial(TOWN);
  const epoch = '2026-09';
  const closed = foldClosedEpochs(entries).has(`${pot}|${epoch}`);

  if (closed) {
    // The founder has run it. The block is then replay-permanent and stamp-verify
    // above has already re-derived it byte-for-byte; what is left to check is the
    // mark: exactly one holo row per settled ref, and no retired row aboard.
    const { settled } = foldPotReceipts(entries);
    const holos = entries.map((e) => classifyEntry(e.canonical))
      .filter((c) => c.kind === 'holo' && c.pot === pot && c.epoch === epoch);
    assert.ok(holos.length > 0, 'a closed epoch wrote its rows');
    assert.equal(new Set(holos.map((h) => h.ref)).size, holos.length, 'one row per ref, never two');
    for (const h of holos) assert.ok(settled.has(h.ref));
    return;
  }

  const d = deriveEpochClose({
    entries, households: householdKeys(TOWN), pot, potMeta: meta,
    epoch, date: `${epoch}-30`, dial,
  });
  assert.equal(d.ok, true, d.error);

  // recomputed independently of deriveEpochClose's own arithmetic: the folds are
  // the shared instruments, the arithmetic below is this test's own claim.
  const { revisions } = parseLaws(entries);
  const base = householdKeys(TOWN);
  const hhKey = (handle) => {
    let key = base.get(handle)?.key ?? null;
    for (const r of revisions) if (r.handle === handle && r.date <= `${epoch}-30`) key = r.key;
    return key ?? `solo:${handle}`;
  };
  const { receipts: all, settled } = foldPotReceipts(entries);
  const mine = all.filter((r) => r.pot === pot && !settled.has(r.ref));
  const funding = (r) => !(dial.treasury && r.from === dial.treasury);
  const D = mine.filter(funding).reduce((a, r) => a + r.usd, 0);
  const positions = [...foldPotPositions(entries)]
    .filter(([k, n]) => k.split('|')[0] === pot && n > 0)
    .map(([k, n]) => ({ handle: k.split('|')[1], n }));
  const S = positions.reduce((a, p) => a + p.n, 0);
  const stakedByHH = new Map();
  for (const p of positions) stakedByHH.set(hhKey(p.handle), (stakedByHH.get(hhKey(p.handle)) ?? 0) + p.n);
  const mintByHH = new Map();
  for (const [h, n] of foldMintCount(entries)) mintByHH.set(hhKey(h), (mintByHH.get(hhKey(h)) ?? 0) + n);

  assert.equal(meta.close, 'elastic', 'the donation box closes elastic');
  assert.ok(D >= meta.min_close_usd, `the roll ($${D}) has met the $${meta.min_close_usd} floor`);
  assert.equal(d.report.fundedFraction, 1, 'an elastic pot past its floor reads 1');
  assert.equal(d.report.dollarsFunding, D);
  assert.equal(d.report.stakesOpen, S);
  assert.equal(d.report.returned, S, 'every open stake home whole — the returns and the mass are one number');
  assert.equal(d.report.fundingMintSized, S, 'fraction 1, so M is the mass itself');

  const returns = d.rows.filter((r) => r.kind === 'pot-return');
  assert.equal(returns.length, positions.length);
  assert.equal(returns.reduce((a, r) => a + r.n, 0), S);

  const holos = d.rows.filter((r) => r.kind === 'holo');
  assert.deepEqual(holos.map((r) => r.ref), mine.map((r) => r.ref),
    'ONE row per unsettled receipt, in ledger order, zeros included');

  const granted = new Map();
  let expectedTotal = 0;
  let sawCap = false;
  for (const r of mine) {
    const k = hhKey(r.from);
    const resident = base.has(r.from) || revisions.some((x) => x.handle === r.from);
    let want = 0;
    if (funding(r) && resident && D > 0 && S > 0) {
      const raw = Math.floor(((S - (stakedByHH.get(k) ?? 0)) * r.usd) / D);
      const cap = Math.floor(dial.rho * (mintByHH.get(k) ?? 0));
      want = Math.max(0, Math.min(raw, cap - (granted.get(k) ?? 0)));
      if (want < raw) sawCap = true;
      if (want > 0) granted.set(k, (granted.get(k) ?? 0) + want);
    }
    const got = holos.find((h) => h.ref === r.ref);
    assert.equal(got.n, want, `${r.from}'s reward for ${r.ref}`);
    assert.equal(got.handle, r.from, 'and it is paid to the hand the receipt names TODAY (corrections applied)');
    expectedTotal += want;
  }
  assert.equal(d.report.fundingMint, expectedTotal);
  assert.ok(d.report.fundingMint <= d.report.fundingMintSized, 'new mint never exceeds the mass lent');
  assert.equal(d.report.unmintedRemainder, S - expectedTotal);
  assert.ok(sawCap, 'the live instance really exercises the ρ cap — if it stops doing so, this assert says so out loud');
  assert.equal(d.rows.filter((r) => r.kind === 'keeping-burn' || r.kind === 'keeping-mint').length, 0);
});

// ── CLOSES AT FILL (POS-653; Darko 2026-10-16 20:04 EDT: "new, no close date (closes at fill)") ──

test('POS-653 · a pot that closes at fill: a partial never closes it; the filling receipt closes it in the same act; the next is refused, and stays refused after its keeping close', () => {
  // LAW (Darko, 2026-10-16 20:04 EDT): "new, no close date (closes at fill)".
  //     The act that takes the pot to its need also sets it closed, so intake
  //     can never take the need twice (POS-653's ruling comment).
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: {
      home: { beneficiary: 'keeper', target_usd_per_epoch: 100, close: 'epoch', epoch_cadence: 'once', closes_at_fill: true },
      lamp: { beneficiary: 'keeper', target_usd_per_epoch: 100, close: 'epoch' },
    },
    gifts: [{ handle: 'stan', n: 300 }, { handle: 'paz', n: 100 }],
  });
  const keyFile = join(repo, 'stamp-key.pem');
  appendSigned(repo, [potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'home', n: 300, via: 'api' })], priv);
  const receipt = (pot, usd, ref, date = '2026-07-03') => execFileSync(process.execPath,
    [join(HERE, 'epoch-close.mjs'), '--receipt', '--pot', pot, '--rail', 'stripe', '--usd', String(usd),
      '--from', 'paz', '--ref', ref, '--date', date, '--key', keyFile, '--repo', repo],
    { encoding: 'utf8', stdio: 'pipe' });
  const statusOf = (pot) => potFile(repo, pot).status;

  // a partial gift never closes it
  const first = receipt('home', 60, 'stripe:f1');
  assert.doesNotMatch(first, /filled/);
  assert.equal(statusOf('home'), 'open', 'a partial gift never closes the pot');

  // the gift that reaches the need closes it, in the same act
  const filling = receipt('home', 40, 'stripe:f2');
  assert.match(filling, /pot home: filled — closed in the same act/);
  assert.equal(statusOf('home'), 'closed', 'the filling receipt closes the pot');
  assert.match(potFile(repo, 'home')._closed, /^CLOSED AT FILL 2026-07-03: the receipt stripe:f2 took it to \$100 of \$100/);
  assert.equal(potFile(repo, 'home').received_usd, 100);

  // the next dollar is refused, by the pot's own status
  assert.throws(() => receipt('home', 1, 'stripe:f3'),
    (e) => /pot "home" is closed, not open — a draft or closed pot takes no dollars/.test(String(e.stderr)));

  // the keeping close still runs, once, on a pot closed at fill: every stake home whole
  const out = execFileSync(process.execPath, closeArgs({ repo, pot: 'home', epoch: '2026-07', date: '2026-08-01' }), { encoding: 'utf8' });
  assert.match(out, /funded fraction:\s+100\.0%/);
  assert.match(out, /returned WHOLE:\s+300/);
  assert.throws(() => execFileSync(process.execPath, closeArgs({ repo, pot: 'home', epoch: '2026-08', date: '2026-09-01' }), { encoding: 'utf8', stdio: 'pipe' }),
    (e) => /takes its need once and has already closed — one fill, one close/.test(String(e.stderr)));

  // and after the close, when D5's headroom would read the full need again, the
  // LEDGER still refuses it: a pot reopened by hand cannot take its need twice
  const p = join(repo, 'WHITE_PAGES', 'pot-home.json');
  writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, 'utf8')), status: 'open' }));
  assert.equal(intakeCheck({ entries: entriesOf(repo), pot: 'home', potMeta: potFile(repo, 'home'), usd: 100 }).ok, true,
    "D5 alone would take the need again after the close — this is the hole the ledger guard closes");
  assert.throws(() => receipt('home', 100, 'stripe:f4', '2026-08-02'),
    (e) => /takes its need once and has already closed — it takes its need once, ever/.test(String(e.stderr)));
  // and with closes_at_fill edited off as well, its once cadence still refuses it (review-3896)
  writeFileSync(p, JSON.stringify({ ...JSON.parse(readFileSync(p, 'utf8')), status: 'open', closes_at_fill: false }));
  assert.throws(() => receipt('home', 100, 'stripe:f5', '2026-08-02'),
    (e) => /takes its need once and has already closed/.test(String(e.stderr)));

  // a pot that does not close at fill is untouched: full, it stays open for the founder's close
  receipt('lamp', 100, 'stripe:l1', '2026-08-02');
  assert.equal(statusOf('lamp'), 'open');

  assert.equal(verifyStampLedger(repo).ok, true);
});

test('POS-653 · a draft pot takes no dollars at the receipt verb, as at the office door', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({ pub, priv, pins: PINS, pots: { home: { beneficiary: 'keeper', status: 'draft', closes_at_fill: true } }, gifts: [{ handle: 'paz', n: 10 }] });
  assert.throws(() => execFileSync(process.execPath,
    [join(HERE, 'epoch-close.mjs'), '--receipt', '--pot', 'home', '--rail', 'stripe', '--usd', '10',
      '--from', 'paz', '--ref', 'stripe:d1', '--date', '2026-07-03', '--key', join(repo, 'stamp-key.pem'), '--repo', repo],
    { encoding: 'utf8', stdio: 'pipe' }),
  (e) => /pot "home" is draft, not open/.test(String(e.stderr)));
  assert.equal(foldPotReceipts(entriesOf(repo)).receipts.length, 0, 'nothing was witnessed');
});

test('POS-653 · (review-3896) --close on an OPEN, partly funded closes_at_fill pot is refused, and the pot keeps taking dollars: a close never strands a payer', () => {
  const { pub, priv } = keypair();
  const repo = seamTown({
    pub, priv, pins: PINS,
    pots: { home: { beneficiary: 'keeper', target_usd_per_epoch: 100, close: 'epoch', epoch_cadence: 'once', closes_at_fill: true } },
    gifts: [{ handle: 'paz', n: 100 }],
  });
  const keyFile = join(repo, 'stamp-key.pem');
  const receipt = (usd, ref, date) => execFileSync(process.execPath,
    [join(HERE, 'epoch-close.mjs'), '--receipt', '--pot', 'home', '--rail', 'stripe', '--usd', String(usd),
      '--from', 'paz', '--ref', ref, '--date', date, '--key', keyFile, '--repo', repo],
    { encoding: 'utf8', stdio: 'pipe' });
  receipt(30, 'stripe:p1', '2026-07-03');
  assert.throws(() => execFileSync(process.execPath, closeArgs({ repo, pot: 'home', epoch: '2026-07', date: '2026-08-01' }), { encoding: 'utf8', stdio: 'pipe' }),
    (e) => /pot "home" closes at fill — its one keeping close runs after the fill closes it/.test(String(e.stderr)));
  assert.equal(foldClosedEpochs(entriesOf(repo)).size, 0, 'the refused close wrote nothing');
  assert.equal(potFile(repo, 'home').status, 'open');
  // the next payer is witnessed, and the fill still closes it
  receipt(70, 'stripe:p2', '2026-08-02');
  assert.equal(potFile(repo, 'home').status, 'closed');
  assert.equal(verifyStampLedger(repo).ok, true);
});
