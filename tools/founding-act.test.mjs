// founding-act.test.mjs — the founding act as ONE act, and the gate that stops
// a half-landed one from being committed.
//   node --test tools/founding-act.test.mjs
//
// The property under test is not "it stakes 13 marks." It is that a clip cannot
// pass quietly. Stakes clip to the liquid balance in ledger order, so an
// underfunded act does not error — it applies a partial to the last line and the
// seal closes over it. The post-check is what makes that loud, and because the
// sealed ledger cannot roll back, the check gates the COMMIT rather than the
// write. These tests prove the gate holds in both directions: a good act commits,
// a clipped act commits NOTHING and restores the ledger.
//
// Real git repos in tmp; nothing here can reach a network or a real ledger.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseStampLedger, foldBalances, classifyEntry } from './stamp-mint.mjs';
import { auditAct } from './founding-act.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACT = join(HERE, 'founding-act.mjs');
const MINT = join(HERE, 'stamp-mint.mjs');

const TREASURY = 'the-town';
const PURPOSE = 'founding-grant';

function keypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    pub: publicKey.export({ type: 'spki', format: 'pem' }),
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

const git = (repo, args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });

// Three targets rather than thirteen: the act's arithmetic is parameterized, and
// a smaller batch makes a clipped run easy to construct exactly.
const TARGETS = [
  { founder: 'alice', mark: 'alice/the-hill' },
  { founder: 'bob', mark: 'bob/the-shore' },
  { founder: 'town', mark: 'the-town/the-quay' },
];

function townRepo() {
  const { pub, priv } = keypair();
  const repo = mkdtempSync(join(tmpdir(), 'founding-act-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  for (const f of ['stamp-mint.mjs', 'stamp-verify.mjs', 'world-stake.mjs', 'founding-act.mjs']) {
    copyFileSync(join(HERE, f), join(repo, 'tools', f));
  }
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify({ alice: 1, bob: 2 }));
  for (const [h, l] of [['alice', 'alogin'], ['bob', 'blogin']]) {
    mkdirSync(join(repo, 'WHITE_PAGES', h), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', h, 'ADDRESS.md'), `---\nhandle: ${h}\ngithub: ${l}\n---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'),
    '# ledger\n\n- 2026-06-12 · s1 · alice → bob · thread: new\n- 2026-06-13 · s2 · bob → alice · thread: new\n');
  writeFileSync(join(repo, 'ECONOMY-DIALS.json'), JSON.stringify({
    law_side: { town_issuance: { treasury_handle: TREASURY, once_purposes: [PURPOSE] } },
  }, null, 2));
  writeFileSync(join(repo, 'targets.json'), JSON.stringify(TARGETS, null, 2));
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);

  execFileSync(process.execPath, [join(repo, 'tools', 'stamp-mint.mjs'), '--append', '--key', keyFile, '--repo', repo], { encoding: 'utf8' });

  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 'test@example.invalid']);
  git(repo, ['config', 'user.name', 'test']);
  // Deterministic line endings. Without this, git's autocrlf rewrites the ledger
  // on checkout and a byte-identity assertion fails on Windows for a reason that
  // has nothing to do with the act — the restore is correct, the bytes are not.
  git(repo, ['config', 'core.autocrlf', 'false']);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'town fixture']);
  return { repo, keyFile, pub, priv };
}

function act(repo, extra = []) {
  const args = [join(repo, 'tools', 'founding-act.mjs'), '--repo', repo, '--date', '2026-08-10',
    '--targets', join(repo, 'targets.json'), '--each', '77', ...extra];
  try {
    return { ok: true, out: execFileSync(process.execPath, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { ok: false, out: String(e.stdout ?? '') + String(e.stderr ?? '') };
  }
}

const ledger = (repo) => readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
const entriesOf = (repo) => parseStampLedger(ledger(repo));
const balance = (repo, h) => foldBalances(entriesOf(repo)).get(h) ?? 0;
const clean = (repo) => git(repo, ['status', '--porcelain']).trim() === '';
const headOf = (repo) => git(repo, ['rev-parse', 'HEAD']).trim();

// ── dry run ──────────────────────────────────────────────────────────────────

test('the dry run writes nothing, signs nothing, commits nothing', () => {
  const { repo } = townRepo();
  const before = ledger(repo);
  const head = headOf(repo);
  const r = act(repo);
  assert.ok(r.ok, r.out);
  assert.match(r.out, /DRY RUN/);
  assert.match(r.out, /3 × 77 = 231/);
  assert.equal(ledger(repo), before, 'the ledger is untouched');
  assert.equal(headOf(repo), head);
  assert.ok(clean(repo));
  rmSync(repo, { recursive: true, force: true });
});

test('the act refuses a plan whose issuance cannot cover its stakes', () => {
  // The shortfall must be caught in the PLAN, before a single line is written —
  // once written it is sealed, and the only remedy left is discarding a commit.
  const { repo } = townRepo();
  const r = act(repo, ['--amount', '100']);
  assert.equal(r.ok, false);
  assert.match(r.out, /smaller than the stakes|clip/i);
  assert.ok(clean(repo));
  rmSync(repo, { recursive: true, force: true });
});

// ── the act ──────────────────────────────────────────────────────────────────

test('one act: issuance then stakes, every stake in full, then a commit', () => {
  const { repo, keyFile } = townRepo();
  const head = headOf(repo);
  const r = act(repo, ['--execute', '--commit', '--key', keyFile, '--by', 'keeminlee', '--provenance', 'the founding act']);
  assert.ok(r.ok, r.out);
  assert.match(r.out, /every stake applied in full/);

  const cls = entriesOf(repo).map((e) => classifyEntry(e.canonical));
  const issued = cls.filter((c) => c.kind === 'town-issuance');
  assert.equal(issued.length, 1);
  assert.equal(issued[0].n, 231, 'the issuance defaults to exactly what the stakes need');
  assert.equal(issued[0].purpose, PURPOSE);
  assert.equal(issued[0].note, 'the founding act');

  const stakes = cls.filter((c) => c.kind === 'world-stake');
  assert.equal(stakes.length, 3);
  for (const s of stakes) assert.equal(s.n, 77, 'every stake landed in full');
  assert.deepEqual(stakes.map((s) => s.mark).sort(), TARGETS.map((t) => t.mark).sort());

  assert.equal(balance(repo, TREASURY), 0, 'mint-at-demand: resting state is zero');
  assert.notEqual(headOf(repo), head, 'the act committed');
  assert.ok(clean(repo), 'and left the tree clean');
  rmSync(repo, { recursive: true, force: true });
});

test('without --commit the act HOLDS in the working tree', () => {
  const { repo, keyFile } = townRepo();
  const head = headOf(repo);
  const r = act(repo, ['--execute', '--key', keyFile, '--by', 'k', '--provenance', 'held']);
  assert.ok(r.ok, r.out);
  assert.match(r.out, /HELD/);
  assert.equal(headOf(repo), head, 'nothing committed');
  assert.equal(clean(repo), false, 'the act is in the tree, awaiting review');
  rmSync(repo, { recursive: true, force: true });
});

// ── FALSIFIERS: the gate, proven in the direction that matters ────────────────

test('FALSIFIER — the post-check REJECTS a clipped stake', () => {
  // The guard the whole tool exists for, tested at its own level. Driving a real
  // mid-act clip through the CLI is hard by construction — the plan check catches
  // every shortfall it can foresee — and a guard reachable only through a path
  // that prevents it is a guard nobody has watched fail. So the clipped outcome
  // is handed to the auditor directly.
  const good = {
    applied: [
      { mark: 'a/1', applied: 77, clipped: false },
      { mark: 'a/2', applied: 77, clipped: false },
    ],
    each: 77, targetCount: 2, before: 0, amount: 154, staked: 154, after: 0,
    minted: 154, issuanceCount: 1, purpose: PURPOSE, verifyOk: true, verifyProblem: null,
  };
  assert.deepEqual(auditAct(good), [], 'a clean act has nothing to report');

  const clipped = { ...good, applied: [
    { mark: 'a/1', applied: 77, clipped: false },
    { mark: 'a/2', applied: 12, clipped: true, reason: 'your balance has no stamps free to stake' },
  ], after: 65 };
  const failures = auditAct(clipped);
  assert.ok(failures.some((f) => /a\/2: applied 12 of 77/.test(f)), `expected the clip named, got: ${JSON.stringify(failures)}`);
  assert.ok(failures.some((f) => /treasury balance is 65, expected 0/.test(f)));
  assert.ok(failures.length >= 2);

  // and each other limb of the check can fail on its own
  assert.ok(auditAct({ ...good, applied: [good.applied[0]] }).some((f) => /only 1 of 2/.test(f)));
  assert.ok(auditAct({ ...good, issuanceCount: 2 }).some((f) => /2 issuance line/.test(f)));
  assert.ok(auditAct({ ...good, minted: 3 }).some((f) => /cumulative mint is 3/.test(f)));
  assert.ok(auditAct({ ...good, verifyOk: false, verifyProblem: 'seal broke' }).some((f) => /does not verify/.test(f)));
});

test('FALSIFIER — a failing act commits NOTHING and restores the ledger', () => {
  // End-to-end proof of the gate and the undo. One target is a malformed mark id,
  // so the stake engine throws PART WAY THROUGH — after the issuance line and the
  // first stake are already written and sealed. That is exactly the state the
  // commit gate exists for: real lines in the working tree, an incomplete act,
  // and the only remedy left being to not commit and restore.
  const { repo, keyFile } = townRepo();
  writeFileSync(join(repo, 'targets.json'), JSON.stringify([
    { founder: 'alice', mark: 'alice/the-hill' },
    { founder: 'broken', mark: 'Not A Mark Id' },
    { founder: 'bob', mark: 'bob/the-shore' },
  ], null, 2));
  // Commit the fixture change first, so the only thing that can dirty the tree
  // afterwards is the act itself — otherwise this test's own edit would be
  // indistinguishable from a failed restore.
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'targets with a malformed id']);
  const head = headOf(repo);
  const before = ledger(repo);

  const r = act(repo, ['--execute', '--commit', '--key', keyFile, '--by', 'k', '--provenance', 'will not land']);

  assert.equal(r.ok, false, 'a half-landed act must exit non-zero');
  assert.match(r.out, /THE ACT DID NOT LAND CLEANLY/);
  assert.match(r.out, /restored from HEAD/);
  assert.equal(headOf(repo), head, 'NOTHING was committed');
  assert.equal(ledger(repo), before, 'the ledger is byte-identical to the pre-act state');
  assert.ok(clean(repo), 'and the tree is clean again');
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — the act refuses to start on a dirty ledger', () => {
  // Restore-from-HEAD is the only undo, so it is a safety net only when HEAD is
  // the good state. Discovering that after writing would be too late.
  const { repo, keyFile } = townRepo();
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), ledger(repo) + '- stray line\n');
  const r = act(repo, ['--execute', '--commit', '--key', keyFile, '--by', 'k', '--provenance', 'x']);
  assert.equal(r.ok, false);
  assert.match(r.out, /uncommitted changes/);
  assert.match(r.out, /restore-from-HEAD/);
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — a second run of the act is refused by the one-shot purpose', () => {
  const { repo, keyFile } = townRepo();
  assert.ok(act(repo, ['--execute', '--commit', '--key', keyFile, '--by', 'k', '--provenance', 'first']).ok);
  const head = headOf(repo);
  const second = act(repo, ['--execute', '--commit', '--key', keyFile, '--by', 'k', '--provenance', 'again']);
  assert.equal(second.ok, false);
  assert.equal(headOf(repo), head, 'the second run committed nothing');
  assert.ok(clean(repo));
  rmSync(repo, { recursive: true, force: true });
});

test('FALSIFIER — --execute without provenance is refused', () => {
  const { repo, keyFile } = townRepo();
  const r = act(repo, ['--execute', '--key', keyFile, '--by', 'k']);
  assert.equal(r.ok, false);
  assert.match(r.out, /provenance/);
  assert.ok(clean(repo));
  rmSync(repo, { recursive: true, force: true });
});
