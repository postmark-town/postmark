// stamp-issuance.test.mjs — TOWN ISSUANCE: the town minting into its own
// treasury under mint-at-demand, every line naming why.
//   node --test tools/stamp-issuance.test.mjs
//
// Town issuance is not a gift. A gift lands on a resident and needs a
// WHITE_PAGES room; the treasury is not a resident and has no room, which is
// exactly why the gift path refuses it and why this class exists. Mirrors the
// gift's discipline otherwise: MINT-sourced so conservation folds it
// structurally, signed by the office pen (the signature IS the authority), and
// appended only onto a settled tail.
//
// THE TREASURY RUNS MINT-AT-DEMAND (Keemin, 2026-08-10): no operating float,
// resting state zero, a mint only for the shortfall. So the class REPEATS, and
// the test that matters most is not that one line works — it is that N lines
// conserve, verify, and stay legible as a series. The founding grant is simply
// the first instance.
//
// WRITTEN BEFORE THE IMPLEMENTATION, and every falsifier below was run against
// the unmodified stamp-mint.mjs first. The headline result of that run is the
// reason this class cannot be "just a line we write by hand": an unrecognized
// grammar makes walkLedger report REPLAY DIVERGES, so a hand-written grant line
// would brick every later --append, --gift and stamp-verify in the town.
//
// Zero-dep; throwaway repos + ed25519. Nothing here touches a real ledger.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseStampLedger, foldBalances, foldMintCount, classifyEntry, townIssuanceLine, sealChain, signSeal } from './stamp-mint.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MINT = join(HERE, 'stamp-mint.mjs');

const TREASURY = 'the-town';
const PURPOSE = 'founding-grant';
const PROVENANCE = 'the founding act — placeholder until Wright sets the words';

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ type: 'spki', format: 'pem' }),
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

// A town with two corresponding residents and a declared treasury dial.
function town({ meeps = [], dials = undefined } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'stamp-town-founding-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify({ alice: 1, bob: 2 }));
  for (const [handle, login] of [['alice', 'alogin'], ['bob', 'blogin'], ...meeps.map((m) => [m, `${m}-login`])]) {
    mkdirSync(join(repo, 'WHITE_PAGES', handle), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', handle, 'ADDRESS.md'), `---\nhandle: ${handle}\ngithub: ${login}\n---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'),
    `# ledger\n\n- 2026-06-12 · seed-1 · alice → bob · thread: new\n- 2026-06-13 · seed-2 · bob → alice · thread: new\n`);
  writeFileSync(join(repo, 'ECONOMY-DIALS.json'), JSON.stringify(dials ?? {
    law_side: { town_issuance: { treasury_handle: TREASURY, once_purposes: [PURPOSE] } },
  }, null, 2));
  return repo;
}

function keyFile(repo, priv) { const f = join(repo, 'stamp-key.pem'); writeFileSync(f, priv); return f; }
const ledgerText = (repo) => readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
const entriesOf = (repo) => parseStampLedger(ledgerText(repo));

function mintPass(repo, priv) {
  execFileSync(process.execPath, [MINT, '--append', '--key', keyFile(repo, priv), '--repo', repo], { encoding: 'utf8' });
}

// Run the grant verb. Returns { ok, out } — a FATAL is an expected outcome in
// half these tests, so a throw is captured rather than failing the run.
function grant(repo, priv, { amount = 1001, purpose = PURPOSE, by = 'keeminlee', date = '2026-08-10', provenance = PROVENANCE, to = TREASURY } = {}) {
  try {
    const out = execFileSync(process.execPath, [MINT, '--town-issuance', to, '--amount', String(amount),
      '--purpose', purpose, '--by', by, '--date', date, '--provenance', provenance,
      '--key', keyFile(repo, priv), '--repo', repo], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String(e.stderr ?? '') + String(e.stdout ?? '') };
  }
}

function foundedTown() {
  const { pub, priv } = keypair();
  const repo = town();
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);   // found the ledger on the mail so the tail is settled
  return { repo, priv, pub };
}

// ── the shape ────────────────────────────────────────────────────────────────

test('an issuance line names its purpose, carries its provenance, and classifies', () => {
  const line = townIssuanceLine({ date: '2026-08-10', handle: TREASURY, n: 1001, purpose: PURPOSE, by: 'keeminlee', note: PROVENANCE });
  assert.equal(line, `- 2026-08-10 · MINT → ${TREASURY} · 1001 · for: issuance:${PURPOSE} · by: keeminlee · note: ${PROVENANCE}`);
  const c = classifyEntry(line);
  assert.equal(c.kind, 'town-issuance');
  assert.equal(c.handle, TREASURY);
  assert.equal(c.n, 1001);
  assert.equal(c.purpose, PURPOSE);
  assert.equal(c.by, 'keeminlee');
  assert.equal(c.note, PROVENANCE);
});

test('a grant mints to the treasury and the ledger stays GREEN', () => {
  const { repo, priv, pub } = foundedTown();
  const before = foldMintCount(entriesOf(repo)).get(TREASURY) ?? 0;
  assert.equal(before, 0, 'the treasury starts with nothing — this is what the act is for');

  const r = grant(repo, priv);
  assert.ok(r.ok, `grant should succeed:\n${r.out}`);

  const entries = entriesOf(repo);
  assert.equal(foldMintCount(entries).get(TREASURY), 1001);
  assert.equal(foldBalances(entries).get(TREASURY), 1001, 'liquid, and therefore stakeable');
  // conservation: every account, including MINT, sums to zero
  assert.equal([...foldBalances(entries).values()].reduce((a, b) => a + b, 0), 0);

  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, `verify must stay green:\n${(v.problems || []).join('\n')}`);
  rmSync(repo, { recursive: true, force: true });
});

test('the grant funds exactly the 13 founding stakes and leaves nothing over', () => {
  // 13 x 77 = 1001. The arithmetic is the design: the treasury ends at zero
  // liquid, so a stake that lands out of order silently clips to a partial
  // rather than failing loudly. Named here so the number is never a surprise.
  const { repo, priv } = foundedTown();
  assert.ok(grant(repo, priv).ok);
  const balance = foldBalances(entriesOf(repo)).get(TREASURY);
  assert.equal(balance, 13 * 77);
  assert.equal(balance - 13 * 77, 0, 'zero margin — the act consumes the grant to the last stamp');
  rmSync(repo, { recursive: true, force: true });
});

// ── FALSIFIERS: every one of these was run against the pre-change tool ────────

test('FALSIFIER — an UNRECOGNIZED grant grammar bricks the replay (why this class must exist)', () => {
  // The headline. Hand-write a founding-shaped line the parser does not know and
  // the ledger stops verifying: walkLedger sees `kind: unknown` and reports
  // REPLAY DIVERGES, which then fails every later --append and --gift. A grant
  // is not something that can be added to the ledger by writing it down.
  const { repo, priv, pub } = foundedTown();
  const path = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  writeFileSync(path, readFileSync(path, 'utf8') +
    `- 2026-08-10 · MINT → ${TREASURY} · 1001 · for: the founding act · sig: not-a-real-signature\n`);
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /REPLAY DIVERGES|unrecognized grammar|signature/i.test(p)),
    `expected a replay/signature failure, got:\n${v.problems.join('\n')}`);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a grant to anyone but the declared treasury is refused', () => {
  // The dial names the treasury. Without this, the grant class is a founder-gift
  // with no room requirement — a mint to any handle at any size.
  const { repo, priv } = foundedTown();
  const r = grant(repo, priv, { to: 'alice' });
  assert.equal(r.ok, false);
  assert.match(r.out, /treasury/i);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a second issuance for a ONE-SHOT purpose is refused', () => {
  // A founding act happens once. Without the one-shot law the founding purpose is
  // an unbounded printing press pointed at the town's own account.
  const { repo, priv } = foundedTown();
  assert.ok(grant(repo, priv).ok);
  const second = grant(repo, priv, { date: '2026-08-11' });
  assert.equal(second.ok, false);
  assert.match(second.out, /purpose/i);
  // and the treasury did not grow
  assert.equal(foldBalances(entriesOf(repo)).get(TREASURY), 1001);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a malformed grant line is refused at every field', () => {
  const { repo, priv } = foundedTown();
  const bad = [
    [{ amount: 0 }, /amount/i],
    [{ amount: -5 }, /amount/i],
    [{ amount: 1.5 }, /amount/i],
    [{ purpose: 'Founding Grant' }, /purpose/i],          // not kebab
    [{ purpose: '' }, /purpose/i],
    [{ provenance: '' }, /provenance/i],
    [{ provenance: 'a · b' }, /provenance|separator/i], // would split the line's fields
    [{ by: '' }, /by/i],
  ];
  for (const [opts, re] of bad) {
    const r = grant(repo, priv, opts);
    assert.equal(r.ok, false, `expected refusal for ${JSON.stringify(opts)}`);
    assert.match(r.out, re, `wrong reason for ${JSON.stringify(opts)}: ${r.out}`);
  }
  // nothing was written by any of them
  assert.equal(foldMintCount(entriesOf(repo)).get(TREASURY) ?? 0, 0);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a grant that would forge the provenance separator cannot be built', () => {
  // The note is the terminal field and the only free text in the grammar. If a
  // `·` could ride inside it, an author could forge trailing fields.
  assert.throws(() => townIssuanceLine({ date: '2026-08-10', handle: TREASURY, n: 1, purpose: PURPOSE, by: 'x', note: 'a · by: someone-else' }),
    /separator|·/);
});

test('FALSIFIER — a grant to a meep is refused (meeps stay outside the currency)', () => {
  const { pub, priv } = keypair();
  const repo = town({ meeps: ['botty'], dials: { law_side: { town_issuance: { treasury_handle: 'botty', once_purposes: [PURPOSE] } } } });
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  execFileSync(process.execPath, [MINT, '--declare-rules', 'stamps-v2', '--meeps', 'botty',
    '--date', '2026-06-20', '--key', keyFile(repo, priv), '--repo', repo], { encoding: 'utf8' });
  const r = grant(repo, priv, { to: 'botty' });
  assert.equal(r.ok, false);
  assert.match(r.out, /meep/i);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a back-dated grant is refused (the ledger is append-only)', () => {
  const { repo, priv } = foundedTown();
  const r = grant(repo, priv, { date: '2026-01-01' });
  assert.equal(r.ok, false);
  assert.match(r.out, /precedes|append-only/i);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a tampered grant line fails the signature chain', () => {
  const { repo, priv, pub } = foundedTown();
  assert.ok(grant(repo, priv).ok);
  const path = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  // change the amount after signing: 1001 -> 9001
  writeFileSync(path, readFileSync(path, 'utf8').replace(`· 1001 · for: issuance:`, `· 9001 · for: issuance:`));
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false, 'a re-written amount must not verify');
  rmSync(repo, { recursive: true, force: true });
});


// ── MINT-AT-DEMAND: the class is a SERIES, not a one-off ─────────────────────

test('N issuances conserve, verify, and read back as a series', () => {
  // The load-bearing property of a repeating class. One line conserving proves
  // almost nothing — the fold is double-entry, so a single MINT line balances by
  // construction. What must hold is that N of them conserve, that the replay
  // still walks, and that each keeps its own purpose and provenance.
  const { repo, priv, pub } = foundedTown();
  const runs = [
    { amount: 1001, purpose: PURPOSE, provenance: 'the founding act', date: '2026-08-10' },
    { amount: 40, purpose: 'ferry-repairs', provenance: 'the gangway plank split', date: '2026-08-11' },
    { amount: 12, purpose: 'ferry-repairs', provenance: 'the second plank, same week', date: '2026-08-12' },
    { amount: 300, purpose: 'quest-pot', provenance: 'seeding the autumn bounties', date: '2026-08-13' },
  ];
  for (const r of runs) assert.ok(grant(repo, priv, r).ok, `issuance should succeed: ${r.purpose}`);

  const entries = entriesOf(repo);
  const issued = entries.map((e) => classifyEntry(e.canonical)).filter((c) => c.kind === 'town-issuance');
  assert.equal(issued.length, 4);
  assert.deepEqual(issued.map((c) => c.purpose), [PURPOSE, 'ferry-repairs', 'ferry-repairs', 'quest-pot']);
  assert.deepEqual(issued.map((c) => c.n), [1001, 40, 12, 300]);
  assert.equal(new Set(issued.map((c) => c.note)).size, 4, 'a series is only legible if each line keeps its own reason');

  const total = runs.reduce((s, r) => s + r.amount, 0);
  assert.equal(foldMintCount(entries).get(TREASURY), total);
  assert.equal(foldBalances(entries).get(TREASURY), total);
  assert.equal([...foldBalances(entries).values()].reduce((a, b) => a + b, 0), 0, 'conservation at N instances');

  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, `verify must stay green at N instances:\n${(v.problems || []).join('\n')}`);
  rmSync(repo, { recursive: true, force: true });
});

test('a REPEATING purpose is allowed — mint-at-demand would be broken otherwise', () => {
  // The complement of the one-shot falsifier. It exists because the obvious
  // over-generalization (one line per purpose, ever) would forbid the town from
  // minting twice for the same recurring need — which is the ordinary case.
  const { repo, priv, pub } = foundedTown();
  assert.ok(grant(repo, priv, { purpose: 'ferry-repairs', amount: 10, provenance: 'first', date: '2026-08-10' }).ok);
  const second = grant(repo, priv, { purpose: 'ferry-repairs', amount: 10, provenance: 'second', date: '2026-08-11' });
  assert.equal(second.ok, true, `a non-one-shot purpose must repeat:\n${second.out}`);
  assert.equal(foldBalances(entriesOf(repo)).get(TREASURY), 20);
  assert.equal(verifyStampLedger(repo, { pubkeyPem: pub }).ok, true);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a duplicated one-shot line fails the VERIFIER, not just the door', () => {
  // The door can be bypassed; the ledger cannot. The duplicate here is PROPERLY
  // SIGNED and sealed — built line by line with the same pen. That matters:
  // pasting the first line's raw text again fails on the seal chain instead,
  // which would leave the LAWFUL rule untested while the test still went green.
  // A falsifier that passes for the wrong reason is not a falsifier.
  const { pub, priv } = keypair();
  const repo = town();
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const lines = [
    '- 2026-06-12 · rules: stamps-v1',
    `- 2026-08-10 · MINT → ${TREASURY} · 1001 · for: issuance:${PURPOSE} · by: keeminlee · note: the founding act`,
    `- 2026-08-11 · MINT → ${TREASURY} · 500 · for: issuance:${PURPOSE} · by: keeminlee · note: and again`,
  ];
  const seals = sealChain(lines);
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'),
    '# stamp-ledger\n\n' + lines.map((c, i) => `${c} · sig: ${signSeal(seals[i], priv)}`).join('\n') + '\n');

  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /declared one-shot but is issued twice/.test(p)),
    `expected the one-shot LAWFUL failure specifically, got:\n${v.problems.join('\n')}`);
  assert.ok(!v.problems.some((p) => /SIGNATURE FAILS|UNSIGNED/.test(p)),
    'the duplicate must be properly signed, or this tests the seal instead of the law');
  rmSync(repo, { recursive: true, force: true });
});

test('an unreadable issuance dial makes the verifier SAY the check was skipped', () => {
  // A verifier that silently stops checking is worse than one that admits it
  // cannot: green-with-a-skipped-check is a weaker claim than green, and the note
  // is what keeps the two from looking identical.
  const { pub, priv } = keypair();
  const repo = town();
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  mintPass(repo, priv);
  assert.ok(grant(repo, priv).ok);
  writeFileSync(join(repo, 'ECONOMY-DIALS.json'), '{ not json');
  const v = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(v.ok, true, 'an unreadable dial is not itself a ledger defect');
  assert.ok((v.notes ?? []).some((n) => /UNCHECKED/.test(n)), `expected a skipped-check note, got: ${JSON.stringify(v.notes)}`);
  rmSync(repo, { recursive: true, force: true });
});
