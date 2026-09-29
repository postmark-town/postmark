// stamp-meep-law.test.mjs — `--meep-law <handle>`: a meep joins the meep law.
//   node --test tools/stamp-meep-law.test.mjs
// lawAt reads only the latest law, so a new meep is a whole restated law. The
// verb carries the set and the friendship ladder forward, refuses a handle
// already in it, and a letter to the new meep after the line mints him nothing.
// Zero-dep; throwaway towns in tmp; throwaway ed25519 keys.

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync, copyFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseStampLedger, foldBalances, parseDeliveries } from './stamp-mint.mjs';
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

function runMint(repo, args) {
  try {
    return { ok: true, out: execFileSync(process.execPath, [MINT, ...args, '--repo', repo], { encoding: 'utf8', stdio: 'pipe' }) };
  } catch (e) {
    return { ok: false, out: String(e.stdout ?? '') + String(e.stderr ?? '') };
  }
}

const D = (date, id, from, to) => `- ${date} · ${id} · ${from} → ${to} · thread: new`;
const ledgerText = (repo) => readFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), 'utf8');
const lastLine = (repo) => parseStampLedger(ledgerText(repo)).at(-1).canonical;

// A founded town whose latest law is the live one's shape: stamps-v3 with the
// town's two meeps and the 5:5,10:10 ladder.
function foundedTown() {
  const repo = mkdtempSync(join(tmpdir(), 'meep-law-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  for (const h of ['alice', 'bob', 'illuminator', 'postmaster', 'bugcatcher']) {
    mkdirSync(join(repo, 'WHITE_PAGES', h), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', h, 'ADDRESS.md'), `---\nhandle: ${h}\n---\n`);
  }
  writeFileSync(join(repo, 'tools', 'github-ids.json'), '{}');
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'),
    `# ledger\n\n${[D('2026-07-01', 'a-1', 'alice', 'bob'), D('2026-07-02', 'b-1', 'bob', 'alice')].join('\n')}\n`);
  const { pub, priv } = keypair();
  writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
  const keyFile = join(repo, 'stamp-key.pem');
  writeFileSync(keyFile, priv);
  const founded = runMint(repo, ['--append', '--key', keyFile]);
  assert.equal(founded.ok, true, founded.out);
  const law = runMint(repo, ['--declare-rules', 'stamps-v3', '--meeps', 'illuminator,postmaster',
    '--friendship', '5:5,10:10', '--date', '2026-07-25', '--key', keyFile]);
  assert.equal(law.ok, true, law.out);
  assert.equal(verifyStampLedger(repo).ok, true);
  return { repo, keyFile };
}

test('CARRIES THE SET FORWARD: the new law restates every meep, the rules and the ladder, with one handle added', () => {
  const { repo, keyFile } = foundedTown();
  const r = runMint(repo, ['--meep-law', 'bugcatcher', '--date', '2026-09-30', '--key', keyFile]);
  assert.equal(r.ok, true, r.out);
  assert.equal(lastLine(repo), '- 2026-09-30 · rules: stamps-v3 · meeps: bugcatcher,illuminator,postmaster · friendship: 5:5,10:10');
  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('; '));
  rmSync(repo, { recursive: true, force: true });
});

test('REFUSES A DUPLICATE: a handle already in the set declares nothing, and the ledger is untouched', () => {
  const { repo, keyFile } = foundedTown();
  const before = ledgerText(repo);
  const r = runMint(repo, ['--meep-law', 'postmaster', '--date', '2026-09-30', '--key', keyFile]);
  assert.equal(r.ok, false, r.out);
  assert.match(r.out, /"postmaster" is already in the meep set/);
  assert.equal(ledgerText(repo), before);
  rmSync(repo, { recursive: true, force: true });
});

test('A LAW IS FORWARD-DATED: a date on or before the last delivery is refused', () => {
  const { repo, keyFile } = foundedTown();
  const before = ledgerText(repo);
  const r = runMint(repo, ['--meep-law', 'bugcatcher', '--date', '2026-07-02', '--key', keyFile]);
  assert.equal(r.ok, false, r.out);
  assert.match(r.out, /not after the last delivery/);
  assert.equal(ledgerText(repo), before);
  rmSync(repo, { recursive: true, force: true });
});

test('ONTO A SETTLED TAIL: a ledger behind the mail is refused until --append runs', () => {
  const { repo, keyFile } = foundedTown();
  appendFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `${D('2026-09-29', 'a-2', 'alice', 'bob')}\n`);
  const before = ledgerText(repo);
  const r = runMint(repo, ['--meep-law', 'bugcatcher', '--date', '2026-09-30', '--key', keyFile]);
  assert.equal(r.ok, false, r.out);
  assert.match(r.out, /behind the mail/);
  assert.equal(ledgerText(repo), before);
  rmSync(repo, { recursive: true, force: true });
});

test('A MINT TO HIM PAYS 0: a letter to the new meep after the line mints only its sender', () => {
  const { repo, keyFile } = foundedTown();
  assert.equal(runMint(repo, ['--meep-law', 'bugcatcher', '--date', '2026-09-30', '--key', keyFile]).ok, true);
  appendFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `${D('2026-09-30', 'a-3', 'alice', 'bugcatcher')}\n`);
  const a = runMint(repo, ['--append', '--key', keyFile]);
  assert.equal(a.ok, true, a.out);
  const lines = parseStampLedger(ledgerText(repo)).map((e) => e.canonical);
  assert.ok(lines.some((l) => l.startsWith('- 2026-09-30 · MINT → alice · 1 · for: a-3')), 'the sender still mints');
  assert.equal(lines.filter((l) => l.includes('MINT → bugcatcher')).length, 0, 'the meep mints nothing');
  assert.equal(foldBalances(parseStampLedger(ledgerText(repo))).get('bugcatcher') ?? 0, 0);
  const v = verifyStampLedger(repo);
  assert.equal(v.ok, true, (v.problems ?? []).join('; '));
  rmSync(repo, { recursive: true, force: true });
});

test('LIVE ledger, in a tree of its own: replay and the lawful fold stay green with the meep law appended, and a letter to him mints him 0', () => {
  // The live ledger is copied, with every file the verifier reads, into tmp.
  // Its lines keep their real signatures (the founder's ruled welcomes are keyed
  // by them), so the control is the whole verifier, green. The law line itself
  // can only be signed by the office pen, which never leaves the box: here a
  // throwaway pen signs it, and the ONLY problem allowed after it is that one
  // line's signature. Replay, conservation and lawful must stay green. On the
  // box, with the real pen, the same line verifies whole.
  const live = join(HERE, '..');
  const repo = mkdtempSync(join(tmpdir(), 'meep-law-live-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  for (const f of ['github-ids.json', 'households.json', 'stamp-pubkey.pem'])
    if (existsSync(join(live, 'tools', f))) copyFileSync(join(live, 'tools', f), join(repo, 'tools', f));
  if (existsSync(join(live, 'ECONOMY-DIALS.json'))) copyFileSync(join(live, 'ECONOMY-DIALS.json'), join(repo, 'ECONOMY-DIALS.json'));
  for (const e of readdirSync(join(live, 'WHITE_PAGES'), { withFileTypes: true })) {
    if (e.isFile()) copyFileSync(join(live, 'WHITE_PAGES', e.name), join(repo, 'WHITE_PAGES', e.name));
    else if (e.isDirectory() && existsSync(join(live, 'WHITE_PAGES', e.name, 'ADDRESS.md'))) {
      mkdirSync(join(repo, 'WHITE_PAGES', e.name));
      copyFileSync(join(live, 'WHITE_PAGES', e.name, 'ADDRESS.md'), join(repo, 'WHITE_PAGES', e.name, 'ADDRESS.md'));
    }
  }
  const control = verifyStampLedger(repo);
  assert.equal(control.ok, true, `control: ${(control.problems ?? []).slice(0, 3).join('; ')}`);
  const lawLineNo = control.lines + 1;
  const onlyThePensSignature = (r) => {
    assert.equal(r.problems.length, 1, r.problems.slice(0, 3).join('; '));
    assert.match(r.problems[0], new RegExp(`^line ${lawLineNo}: SIGNATURE FAILS`));
  };

  const { priv } = keypair();
  const keyFile = join(repo, 'throwaway-pen.pem');
  writeFileSync(keyFile, priv);
  // the day after the later of the last delivery and the ledger tail
  const canon = parseStampLedger(ledgerText(repo)).map((e) => e.canonical);
  const last = [...parseDeliveries(repo).map((d) => d.date), ...canon.map((c) => /^- (\d{4}-\d{2}-\d{2}) /.exec(c)?.[1] ?? '')].sort().at(-1);
  const date = new Date(Date.parse(`${last}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

  const r = runMint(repo, ['--meep-law', 'bugcatcher', '--date', date, '--key', keyFile]);
  assert.equal(r.ok, true, r.out);
  assert.equal(lastLine(repo), `- ${date} · rules: stamps-v3 · meeps: bugcatcher,illuminator,postmaster · friendship: 5:5,10:10`);
  onlyThePensSignature(verifyStampLedger(repo));

  mkdirSync(join(repo, 'WHITE_PAGES', 'bugcatcher'), { recursive: true });
  writeFileSync(join(repo, 'WHITE_PAGES', 'bugcatcher', 'ADDRESS.md'), '---\nhandle: bugcatcher\n---\n');
  appendFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), `${D(date, 'meep-law-probe-1', 'postmark-pen', 'bugcatcher')}\n`);
  const a = runMint(repo, ['--append', '--key', keyFile]);
  assert.equal(a.ok, true, a.out);
  const tail = parseStampLedger(ledgerText(repo)).map((e) => e.canonical).slice(lawLineNo);
  assert.ok(tail.some((l) => l.includes('for: meep-law-probe-1')), 'the probe letter was minted on');
  assert.equal(tail.filter((l) => l.includes('MINT → bugcatcher')).length, 0, 'the meep mints nothing');
  onlyThePensSignature(verifyStampLedger(repo));
  rmSync(repo, { recursive: true, force: true });
});
