// stamp-parcel-burn.test.mjs — a parcel bought from the town, burned (POS-762).
//   node --test tools/stamp-parcel-burn.test.mjs
// Zero-dep; builds throwaway repos in tmp; throwaway ed25519 keys.
//
// Darko, 2026-10-22: "any household that joins before the end of the month, so
// before Halloween, gets to register up to 3 parcels. And then after that, it
// will just be 1 parcel per household with extra parcels purchasable with
// stamps", and "let's price parcels at 50 stamps per parcel you already have",
// paid to the town and never returned. The purchase is one line:
//
//   - <date> · <handle> → BURN · <n> · for: parcel:<nth>/<household-key>
//
// In order:
//   1. the grammar: the line classifies as its own kind, the builder writes
//      it, and every other BURN stays dormant (unknown, so the replay refuses it);
//   2. the balances: a purchase leaves the payer's liquid stamps for BURN, in
//      both folds;
//   3. the verifier: green on a house declared after 10-31 buying its 2nd then
//      its 3rd; red before 11-01, for a house declared by 10-31, for a house the
//      registry has no declaration day for, for another house's key, for a meep, out of
//      order or twice, at a price off the law, and on an overdraw.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  classifyEntry, parcelBurnLine, foldBalances, sealChain, signSeal, parseStampLedger,
  deriveTransfers, deriveMints, householdKeys,
  PARCEL_PRICE, PARCEL_SETTLED_BY_DAY, PARCEL_ROOM_FROM, PARCEL_NTHS,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const GENESIS = '- 2026-06-12 · rules: stamps-v1';

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pub: publicKey.export({ type: 'spki', format: 'pem' }), priv: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}
/**
 * A town of three houses: the-rowan (ash, birch; declared 11-02), the-oak (oak;
 * declared 10-31, the last day that keeps three) and the-yew (yew; declared
 * 11-01). Each resident is pinned to their house's account, so their household
 * key is `gh:<id>` and the verifier resolves it to `hh:<slug>`.
 */
function town({ pub, priv }, lines) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-parcel-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  const pins = { ash: { login: 'rowan-gh', id: 101 }, birch: { login: 'rowan-gh', id: 101 }, oak: { login: 'oak-gh', id: 102 }, yew: { login: 'yew-gh', id: 103 }, stray: { login: 'stray-gh', id: 104 } };
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(pins));
  writeFileSync(join(repo, 'tools', 'households.json'), JSON.stringify({ schema_version: 1, households: {
    'the-rowan': { accounts: [{ login: 'rowan-gh', id: 101 }], residents: ['ash', 'birch'], since: '2026-11-02' },
    'the-oak': { accounts: [{ login: 'oak-gh', id: 102 }], residents: ['oak'], since: '2026-10-31' },
    'the-yew': { accounts: [{ login: 'yew-gh', id: 103 }], residents: ['yew'], since: '2026-11-01' },
  } }));
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  for (const h of Object.keys(pins)) {
    mkdirSync(join(repo, 'WHITE_PAGES', h), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', h, 'ADDRESS.md'), `---\nhandle: ${h}\n---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), '# ledger\n\n');
  writeLedger(repo, priv, lines);
  return repo;
}
/** Sign and write the ledger by hand: the only way to put a forged-BUT-SIGNED line in front of the verifier. */
function writeLedger(repo, priv, lines) {
  const all = [GENESIS, ...lines];
  const seals = sealChain(all);
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'),
    '# stamp-ledger\n\n' + all.map((c, i) => `${c} · sig: ${signSeal(seals[i], priv)}`).join('\n') + '\n');
}
const GIFT = (handle, n = 300) => `- 2026-10-20 · MINT → ${handle} · ${n} · for: gift:seed · by: keemin`;
const BUY = ({ handle = 'ash', n = 50, nth = 2, household = 'hh:the-rowan', date = '2026-11-03' } = {}) => parcelBurnLine({ date, handle, n, nth, household });

// ── 1 · the grammar ─────────────────────────────────────────────────────────

test('1 · the purchase classifies as its own kind; the builder writes it; every other BURN stays dormant', () => {
  assert.equal(PARCEL_PRICE, 50);
  assert.equal(PARCEL_SETTLED_BY_DAY, '2026-10-31');
  assert.equal(PARCEL_ROOM_FROM, '2026-11-01');
  assert.deepEqual([...PARCEL_NTHS], [2, 3]);
  assert.equal(BUY(), '- 2026-11-03 · ash → BURN · 50 · for: parcel:2/hh:the-rowan');
  assert.deepEqual(classifyEntry(BUY({ n: 100, nth: 3, household: 'gh:101' })),
    { kind: 'parcel-burn', date: '2026-11-03', handle: 'ash', n: 100, nth: 3, household: 'gh:101' });
  for (const dormant of [
    '- 2026-11-03 · ash → BURN · 50 · for: parcel:1/hh:the-rowan',     // the first parcel is never bought
    '- 2026-11-03 · ash → BURN · 50 · for: parcel:4/hh:the-rowan',     // past the cap
    '- 2026-11-03 · ash → BURN · 50 · for: parcel:2/the-rowan',        // a key with no spelling
    '- 2026-11-03 · ash → BURN · 50 · for: parcel:2/hh:the-rowan · by: wright', // a tail
    '- 2026-11-03 · ash → BURN · 50 · for: blessing · by: wright',
  ]) assert.equal(classifyEntry(dormant).kind, 'unknown', dormant);
});

// ── 2 · the balances ────────────────────────────────────────────────────────

test('2 · a purchase leaves the payer for BURN, in the raw fold and the kind-named one alike', () => {
  const k = keypair();
  const lines = [GIFT('ash'), BUY(), BUY({ handle: 'birch', n: 100, nth: 3 })];
  const repo = town(k, [GIFT('birch'), ...lines]);
  try {
    const entries = parseStampLedger(['# l', '', GENESIS, GIFT('birch'), ...lines].join('\n'));
    const bal = foldBalances(entries);
    assert.deepEqual([bal.get('ash'), bal.get('birch'), bal.get('BURN')], [250, 200, 150]);
    // the kind-named fold the mint pass decides a `pays:` letter by: ash may pay
    // exactly what is left after the purchase, and not one stamp more
    const households = householdKeys(repo);
    const probe = (pays) => ({ date: '2026-11-04', id: `probe-${pays}`, from: 'ash', to: 'oak', pays, thread: 'new' });
    const own = deriveMints([probe(0)], households, {}).filter((m) => m.handle === 'ash').length;
    const decide = (pays) => deriveTransfers([probe(pays)], households, {}, entries).find((x) => x.id === probe(pays).id)?.kind;
    assert.equal(decide(250 + own), 'transfer', 'the purchase took 50, and the rest is spendable');
    assert.equal(decide(251 + own), 'void', 'the 50 burned is not spendable');
    const v = verifyStampLedger(repo);
    assert.equal(v.ok, true, v.problems.join('\n'));
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

// ── 3 · the verifier ────────────────────────────────────────────────────────

test('3 · green on the 2nd then the 3rd; red off the law in every way the line can be', () => {
  const k = keypair();
  const funded = [GIFT('ash'), GIFT('birch'), GIFT('oak'), GIFT('yew'), GIFT('stray')];
  const repo = town(k, funded);
  try {
    const verdict = (lines) => { writeLedger(repo, k.priv, [...funded, ...lines]); return verifyStampLedger(repo); };
    const green = (lines) => { const v = verdict(lines); assert.equal(v.ok, true, v.problems.join('\n')); };
    const red = (lines, re) => { const v = verdict(lines); assert.equal(v.ok, false, `green on ${lines.join(' / ')}`); assert.match(v.problems.join('\n'), re); };

    green([BUY()]);
    green([BUY(), BUY({ handle: 'birch', n: 100, nth: 3 })]);
    green([BUY({ household: 'gh:101' })]);                                        // the house's other spelling
    green([BUY({ handle: 'yew', household: 'hh:the-yew', date: '2026-11-01' })]); // declared 11-01, buying on the first day

    red([BUY({ date: '2026-10-31' })], /dated 2026-10-31, and no parcel is bought before 2026-11-01/);
    red([BUY({ handle: 'oak', household: 'hh:the-oak' })], /hh:the-oak was declared on 2026-10-31, on or before 2026-10-31, so it keeps three parcels/);
    red([BUY({ handle: 'stray', household: 'gh:104' })], /gh:104 has no declaration day in the registry/);
    red([BUY({ household: 'hh:the-yew' })], /names household "hh:the-yew" but "ash" is gh:101/);
    red([BUY({ nth: 3, n: 100 })], /has bought 0 parcels, so its next purchase is parcel 2/);
    red([BUY(), BUY({ handle: 'birch' })], /has bought 1 parcel, so its next purchase is parcel 3/);
    red([BUY(), BUY({ nth: 3, n: 100 }), BUY({ nth: 3, n: 100 })], /has bought 2 parcels, so its next purchase is parcel 4, past the cap of three/);
    // the price is the room already bought (POS-762/f, "Room bought"): room 1→2 costs 50, 2→3 costs 100, whatever is held
    red([BUY({ n: 100 })], /burns 100; room for parcel 2 costs exactly 50 \(50 × the room already bought, 1, whatever is held\)/);
    red([BUY({ n: 75 })], /burns 75; room for parcel 2 costs exactly 50/);
    red([BUY(), BUY({ nth: 3, n: 50 })], /burns 50; room for parcel 3 costs exactly 100/);
    red([BUY(), BUY({ nth: 3, n: 150 })], /burns 150; room for parcel 3 costs exactly 100/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('3 · a meep never buys, and a purchase past the payer\'s liquid stamps is the running fold\'s overdraw', () => {
  const k = keypair();
  const repo = town(k, []);
  try {
    writeLedger(repo, k.priv, ['- 2026-07-13 · rules: stamps-v2 · meeps: ash', GIFT('birch'), BUY()]);
    let v = verifyStampLedger(repo);
    assert.equal(v.ok, false);
    assert.match(v.problems.join('\n'), /paid by meep "ash"/);
    writeLedger(repo, k.priv, [GIFT('ash', 30), BUY()]);
    v = verifyStampLedger(repo);
    assert.equal(v.ok, false);
    assert.match(v.problems.join('\n'), /account "ash" overdrawn to -20/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
