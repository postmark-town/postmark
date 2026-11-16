// stamp-tenses.test.mjs — the three stamp tenses (quest gold Phase 1).
//   node --test tools/stamp-tenses.test.mjs
//
// mint_count (cumulative, monotonic) · staked (locked in open stakes) ·
// liquid (= foldBalances, spendable) · assets (= liquid + staked, held).
// All pure folds over the sealed ledger — no new stored state. The folds read
// only `.canonical`, so these cases build entries straight from canonical lines
// (no seals/signatures needed to exercise a fold).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseStampLedger, foldBalances, foldMintCount, foldStaked, classifyEntry,
  mintLine, stakeLine, returnLine, voteMintLine,
} from './stamp-mint.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const E = (...canon) => canon.map((c) => ({ canonical: c }));
const gift = (date, h, n, slug, by) => `- ${date} · MINT → ${h} · ${n} · for: gift:${slug} · by: ${by}`;

test('foldMintCount sums every MINT→handle (correspondence, vote-mint, gift) and is monotonic', () => {
  const entries = E(
    mintLine({ date: '2026-01-01', handle: 'alice', cause: 'l1', side: 'sent' }),
    mintLine({ date: '2026-01-01', handle: 'alice', cause: 'l2', side: 'received' }),
    voteMintLine({ date: '2026-01-02', handle: 'alice', topic: 'naming' }),
    gift('2026-01-03', 'alice', 5, 'door-held', 'keemin'),
    // spending/staking must NOT reduce mint_count — it's what you ever generated
    stakeLine({ date: '2026-01-04', handle: 'alice', topic: 'naming', candidate: 'Foo', n: 3, via: 'api' }),
  );
  assert.equal(foldMintCount(entries).get('alice'), 1 + 1 + 1 + 5); // 8, unaffected by the stake
});

test('foldStaked = stamps in OPEN stakes; a close/return zeroes it back out', () => {
  const open = E(
    stakeLine({ date: '2026-01-01', handle: 'bob', topic: 'naming', candidate: 'Foo', n: 10, via: 'api' }),
    stakeLine({ date: '2026-01-02', handle: 'bob', topic: 'naming', candidate: 'Bar', n: 3, via: 'api' }),
  );
  assert.equal(foldStaked(open).get('bob'), 13);

  const closed = E(
    stakeLine({ date: '2026-01-01', handle: 'bob', topic: 'naming', candidate: 'Foo', n: 10, via: 'api' }),
    returnLine({ date: '2026-01-10', topic: 'naming', candidate: 'Foo', handle: 'bob', n: 10 }),
  );
  assert.equal(foldStaked(closed).get('bob') ?? 0, 0);
});

test('the three tenses reconcile: liquid = foldBalances, assets = liquid + staked', () => {
  // alice generates 15, stakes 13 → liquid 2, staked 13, assets 15, mint_count 15
  // (the exact shape verified on the live ledger for lysander, 2026-07-20)
  const entries = E(
    gift('2026-01-01', 'alice', 15, 'seed', 'keemin'),
    stakeLine({ date: '2026-01-02', handle: 'alice', topic: 'naming', candidate: 'Foo', n: 10, via: 'api' }),
    stakeLine({ date: '2026-01-03', handle: 'alice', topic: 'naming', candidate: 'Bar', n: 3, via: 'api' }),
  );
  const liquid = foldBalances(entries).get('alice') ?? 0;
  const staked = foldStaked(entries).get('alice') ?? 0;
  const mint = foldMintCount(entries).get('alice') ?? 0;
  const assets = liquid + staked;
  assert.equal(liquid, 2);
  assert.equal(staked, 13);
  assert.equal(mint, 15);
  assert.equal(assets, 15);
  assert.equal(assets, liquid + staked);
});

// The live ledger: the invariants must hold for EVERY handle. Written to assert
// RELATIONSHIPS, not values, so it survives the naming vote closing 2026-07-26
// (which returns everyone's stake, flipping staked→liquid) and any future mint.
test('live ledger: the tenses reconcile for every handle', () => {
  const ledgerPath = join(HERE, '..', 'WHITE_PAGES', 'stamp-ledger.md');
  if (!existsSync(ledgerPath)) return; // some clones lack it — skip cleanly
  const raw = readFileSync(ledgerPath, 'utf8');
  const entries = parseStampLedger(raw);
  const liquid = foldBalances(entries);
  const staked = foldStaked(entries);
  const mint = foldMintCount(entries);

  // mint_count ≥ assets holds while the only inflow is minting; a transfer/pays
  // recipient could legitimately hold more than they minted. Guard the inequality
  // on that regime so the marketplace going live can't turn this test red.
  // (The guard originally pattern-matched `pays:`/`id:` after the amount — a
  // shape no recorded transfer ever had (they read `· via: mail:<id>`), so the
  // marketplace going live turned this red anyway, the first time a resident
  // held more than they minted: corwin, paid past his mint count, 2026-08.
  // Classify instead of guessing the shape.)
  const hasNonMintInflow = entries.some((e) => classifyEntry(e.canonical).kind === 'transfer');

  for (const [h, mc] of mint) {
    if (h === 'MINT' || h === 'BURN' || h.startsWith('stake:')) continue;
    const l = liquid.get(h) ?? 0;
    const s = staked.get(h) ?? 0;
    const assets = l + s;
    assert.ok(s >= 0, `${h}: staked went negative (${s}) — a return exceeded stakes`);
    assert.ok(l >= 0, `${h}: liquid went negative (${l})`);
    assert.equal(assets, l + s); // definitional, but pins the relationship
    if (!hasNonMintInflow) assert.ok(mc >= assets, `${h}: mint_count ${mc} < assets ${assets}`);
  }
});
