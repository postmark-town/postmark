// paypal-rail.test.mjs — `rail: paypal` joins the pot-receipt grammar (POS-183 part 2).
//   node --test tools/paypal-rail.test.mjs
// Zero-dep; throwaway towns + ed25519 keys (epoch-close.test.mjs's pattern).
//
// The law, quoted from the grammar (stamp-mint.mjs header): "a witnessed
// real-dollar payment against a pot; ARROW-FREE — mints and moves nothing by
// itself; ref is unique forever: one dollar, one mint chance, a re-recorded
// receipt bounces". PayPal adds a rail's NAME and nothing else, so:
//   1. a paypal receipt parses as a pot-receipt, and a rail the town has not
//      named still does not;
//   2. the door (`epoch-close --receipt --rail paypal`) writes it, the ledger
//      verifies, the close replays it into the givers' mint, and a re-recorded
//      paypal ref bounces;
//   3. the door refuses an unknown rail, and a signed ledger carrying one fails
//      verify.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  classifyEntry, potReceiptLine, KEEPING_RAILS, parseStampLedger, foldPotReceipts, appendSigned,
  giftLine, potStakeLine, sealChain, signSeal,
} from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const D = (date, id, from, to) => `- ${date} · ${id} · ${from} → ${to} · thread: new`;
const PINS = { stan: { login: 's', id: 1 }, paz: { login: 'p', id: 2 }, keeper: { login: 'k', id: 9 } };

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return { pub: publicKey.export({ type: 'spki', format: 'pem' }), priv: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}

function seamTown({ pub, priv }) {
  const repo = mkdtempSync(join(tmpdir(), 'paypal-town-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(PINS));
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `# ledger\n\n${[D('2026-06-12', 'm-1', 'stan', 'paz'), D('2026-06-12', 'm-2', 'keeper', 'paz')].join('\n')}\n`);
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  writeFileSync(join(repo, 'ECONOMY-DIALS.json'), JSON.stringify({ law_side: {
    town_issuance: { treasury_handle: 'the-town', once_purposes: [] },
    keeping: { sigma: 0.5, rho: 0.5, rho_constitutional_ceiling: 0.5 } } }));
  writeFileSync(join(repo, 'WHITE_PAGES', 'pot-ec2.json'), JSON.stringify({ pot: 'ec2', status: 'open', beneficiary: 'keeper', target_usd_per_epoch: 150 }));
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  execFileSync(process.execPath, [join(HERE, 'stamp-mint.mjs'), '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });
  appendSigned(repo, [giftLine({ date: '2026-07-01', handle: 'stan', n: 300, slug: 'seed', by: 'keemin' }),
    giftLine({ date: '2026-07-01', handle: 'paz', n: 1200, slug: 'seed', by: 'keemin' })], priv);
  return { repo, keyFile };
}
const entriesOf = (repo) => parseStampLedger(readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8'));
const run = (args) => {
  try { return { ok: true, out: execFileSync(process.execPath, [join(HERE, 'epoch-close.mjs'), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { ok: false, out: String(e.stdout ?? '') + String(e.stderr ?? '') }; }
};

test('1 · a paypal receipt parses as a pot-receipt; a rail the town has not named does not', () => {
  assert.deepEqual(KEEPING_RAILS, ['stripe', 'usdc', 'paypal', 'grant']);
  const line = potReceiptLine({ date: '2026-09-29', pot: 'ec2', rail: 'paypal', usd: 25, from: 'paz', ref: 'paypal:5O190127TN364715T' });
  assert.deepEqual(classifyEntry(line), { kind: 'pot-receipt', date: '2026-09-29', pot: 'ec2', rail: 'paypal', usd: 25, from: 'paz', ref: 'paypal:5O190127TN364715T' });
  for (const rail of ['venmo', 'Paypal', 'pay-pal', 'paypal2'])
    assert.equal(classifyEntry(potReceiptLine({ date: '2026-09-29', pot: 'ec2', rail, usd: 25, from: 'paz', ref: 'x:1' })).kind, 'unknown', rail);
});

test('2 · the door writes a paypal receipt, the ledger verifies, the close replays it, and a re-recorded ref bounces', () => {
  const { pub, priv } = keypair();
  const { repo, keyFile } = seamTown({ pub, priv });
  appendSigned(repo, [potStakeLine({ date: '2026-07-02', handle: 'stan', pot: 'ec2', n: 300, via: 'api' })], priv);
  const receipt = ['--receipt', '--pot', 'ec2', '--rail', 'paypal', '--usd', '150', '--from', 'paz', '--ref', 'paypal:5O190127TN364715T', '--date', '2026-07-03', '--key', keyFile, '--repo', repo];
  const first = run(receipt);
  assert.equal(first.ok, true, first.out);
  const { receipts } = foldPotReceipts(entriesOf(repo));
  assert.deepEqual(receipts.map((r) => [r.pot, r.rail, r.usd, r.from, r.ref]), [['ec2', 'paypal', 150, 'paz', 'paypal:5O190127TN364715T']]);
  const v1 = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v1.ok, true, v1.problems.join('\n'));

  const again = run(receipt);
  assert.equal(again.ok, false, 'a re-recorded paypal ref was written');
  assert.match(again.out, /already/i);

  // the close replays the paypal dollars into the givers' mint exactly as a card's
  const close = run(['--close', '--pot', 'ec2', '--epoch', '2026-07', '--date', '2026-08-01', '--repo', repo, '--key', keyFile]);
  assert.equal(close.ok, true, close.out);
  assert.match(close.out, /funded fraction:\s+100\.0%/);
  assert.match(close.out, /minted to givers:\s+300/);
  assert.match(close.out, /- 2026-08-01 · holo · paz · 300 · pot:ec2 · epoch:2026-07 · ref: paypal:5O190127TN364715T/,
    "the giver's holo row names the paypal receipt it answers");
  const v2 = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v2.ok, true, v2.problems.join('\n'));
  rmSync(repo, { recursive: true, force: true });
});

test('3 · the door refuses an unknown rail, and a signed ledger carrying one fails verify', () => {
  const { pub, priv } = keypair();
  const { repo, keyFile } = seamTown({ pub, priv });
  const r = run(['--receipt', '--pot', 'ec2', '--rail', 'venmo', '--usd', '10', '--from', 'paz', '--ref', 'venmo:1', '--date', '2026-07-03', '--key', keyFile, '--repo', repo]);
  assert.equal(r.ok, false);
  assert.match(r.out, /--rail must be one of stripe\|usdc\|paypal\|grant \(got "venmo"\)/);

  // a forged-but-signed venmo row: the replay cannot read it, so the ledger is red
  const text = readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
  const recorded = parseStampLedger(text).map((e) => e.canonical);
  const forged = potReceiptLine({ date: '2026-07-03', pot: 'ec2', rail: 'venmo', usd: 10, from: 'paz', ref: 'venmo:1' });
  const all = [...recorded, forged];
  const seals = sealChain(all);
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), '# stamp-ledger\n\n' + all.map((c, i) => `${c} · sig: ${signSeal(seals[i], priv)}`).join('\n') + '\n');
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false);
  assert.ok(!v.problems.some((p) => /SIGNATURE FAILS|UNSIGNED/.test(p)), 'the line must be signed, or this tests the seal instead of the grammar');
  rmSync(repo, { recursive: true, force: true });
});
