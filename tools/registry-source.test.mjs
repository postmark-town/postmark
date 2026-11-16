// registry-source.test.mjs — the town's readers take the store's registry (POS-345 b, d).
//   node --test tools/registry-source.test.mjs
// Zero-dep; synthetic towns in tmp, and one local HTTP server standing in for
// the office's GET /households.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadRegistrySource, registrySourceFrom } from './registry-source.mjs';
import { printoutAgainstStore, foreignWriters, canonical, PEN_EMAIL } from './registry-printout-check.mjs';
import { readHouses, checkRepo } from './household-keys.mjs';
import { verifyStampLedger } from './stamp-verify.mjs';
import { sealChain, signSeal } from './stamp-mint.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// THE STORE, as the office's GET /households answers it.
const STORE = {
  read: 'households',
  registry: { schema_version: 1, note: 'printed from the store', households: {
    anchorage: { name: 'anchorage', accounts: [{ login: 'stardust', id: 7 }], residents: ['cloud'], since: '2026-09-01', declared_by: 'cloud' },
  } },
  pins: { cloud: { login: 'stardust', id: 7, pinned: '2026-09-01' } },
  from: 'the registry store',
};

const server = createServer((req, res) => {
  if (req.url.startsWith('/households')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(STORE)); }
  if (req.url.startsWith('/down')) { res.writeHead(503, { 'content-type': 'application/json' }); return res.end('{"error":"bounce"}'); }
  res.writeHead(404); res.end();
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

test('a --registry URL is the office read; a file may carry that shape or { households, pins }', async () => {
  const fromUrl = await loadRegistrySource(`${BASE}/households`);
  assert.deepEqual(fromUrl.registry, STORE.registry);
  assert.deepEqual(fromUrl.pins, STORE.pins);
  const dir = mkdtempSync(join(tmpdir(), 'reg-src-'));
  writeFileSync(join(dir, 'door.json'), JSON.stringify(STORE));
  writeFileSync(join(dir, 'compact.json'), JSON.stringify({ households: STORE.registry.households, pins: STORE.pins }));
  assert.deepEqual((await loadRegistrySource(join(dir, 'door.json'))).registry, STORE.registry);
  assert.deepEqual((await loadRegistrySource(join(dir, 'compact.json'))).registry.households, STORE.registry.households);
  rmSync(dir, { recursive: true, force: true });
});

test('a --registry that does not answer, or answers the wrong shape, is a refusal — never the printout', async () => {
  await assert.rejects(loadRegistrySource(`${BASE}/down`), /answered 503/);
  await assert.rejects(loadRegistrySource('http://127.0.0.1:9/households'), /did not answer/);
  await assert.rejects(loadRegistrySource(join(tmpdir(), 'no-such-registry.json')), /could not be read/);
  assert.throws(() => registrySourceFrom({ registry: { households: {} } }), /is not \{ registry, pins \}/);
});

// ── the readers ──────────────────────────────────────────────────────────────

function town({ households, pins, ledger = null, rooms = [] }) {
  const repo = mkdtempSync(join(tmpdir(), 'reg-town-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'households.json'), JSON.stringify({ schema_version: 1, households }));
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(pins));
  for (const h of rooms) { mkdirSync(join(repo, 'WHITE_PAGES', h), { recursive: true }); writeFileSync(join(repo, 'WHITE_PAGES', h, 'ADDRESS.md'), `---\nhandle: ${h}\n---\n`); }
  writeFileSync(join(repo, 'WHITE_PAGES', 'mail-ledger.md'), '# ledger\n\n');
  if (ledger) {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const pub = publicKey.export({ type: 'spki', format: 'pem' }), priv = privateKey.export({ type: 'pkcs8', format: 'pem' });
    writeFileSync(join(repo, 'tools', 'stamp-pubkey.pem'), pub);
    const all = ['- 2026-06-12 · rules: stamps-v1', ...ledger];
    const seals = sealChain(all);
    writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), '# stamp-ledger\n\n' + all.map((c, i) => `${c} · sig: ${signSeal(seals[i], priv)}`).join('\n') + '\n');
    return { repo, pub };
  }
  return { repo };
}

test('household-keys reads the store\'s declared houses when handed them', () => {
  const { repo } = town({ households: { 'kin-alone': { residents: ['kin'] } }, pins: {} });
  assert.deepEqual(Object.keys(readHouses(repo)), ['kin-alone'], 'the printout, without a registry');
  assert.deepEqual(Object.keys(readHouses(repo, STORE.registry)), ['anchorage'], 'the store, with one');
  assert.doesNotThrow(() => checkRepo(repo, { registry: STORE.registry }));
  rmSync(repo, { recursive: true, force: true });
});

test('stamp-verify binds a welcome\'s gh: spelling to the house by the STORE\'s accounts when handed them', () => {
  // The printout has not caught up: it holds no house for cloud's account. The
  // store binds account 7 to anchorage, so the gh:7 welcome is anchorage's.
  const { repo, pub } = town({
    households: {}, pins: { cloud: { id: 7 } }, rooms: ['cloud'],
    ledger: ['- 2026-09-20 · MINT → cloud · 5 · for: welcome:gh:7 · by: the-town', '- 2026-09-20 · registry: cloud = hh:anchorage'],
  });
  const fromFile = verifyStampLedger(repo, { pubkeyPem: pub });
  assert.equal(fromFile.ok, false, 'the printout cannot see the house the store holds');
  const fromStore = verifyStampLedger(repo, { pubkeyPem: pub, registry: STORE.registry });
  assert.equal(fromStore.ok, true, fromStore.problems.join('\n'));
  rmSync(repo, { recursive: true, force: true });
});

// ── the drain-only check ─────────────────────────────────────────────────────

test('THE RECORD: a printout may lag the store, never lead it or differ', () => {
  assert.deepEqual(printoutAgainstStore({ households: { households: {} }, pins: {} }, STORE), [], 'store ahead of the file: fine');
  assert.deepEqual(printoutAgainstStore({ households: STORE.registry, pins: STORE.pins }, STORE), []);
  const added = printoutAgainstStore({ households: { households: { ...STORE.registry.households, handmade: { residents: ['x'] } } }, pins: { x: { login: 'x', id: 9 } } }, STORE);
  assert.deepEqual(added, ['tools/households.json holds the house "handmade", which the store does not', 'tools/github-ids.json pins "x", which the store does not']);
  const edited = printoutAgainstStore({ households: { households: { anchorage: { ...STORE.registry.households.anchorage, residents: ['cloud', 'y'] } } }, pins: {} }, STORE);
  assert.deepEqual(edited, ['tools/households.json\'s "anchorage" differs from the store\'s row']);
  assert.equal(canonical({ b: 1, a: [2, { d: 1, c: 0 }] }), canonical({ a: [2, { c: 0, d: 1 }], b: 1 }));
});

test('THE AUTHOR: only the pen writes the printouts', () => {
  const commits = [
    { sha: 'a'.repeat(40), email: PEN_EMAIL, name: 'Postmark Pen', files: ['tools/households.json', 'tools/github-ids.json'] },
    { sha: 'b'.repeat(40), email: '306351151+wright-starforge@users.noreply.github.com', name: 'Wright', files: ['tools/github-ids.json'] },
    { sha: 'c'.repeat(40), email: 'someone@example.com', name: 'Someone', files: ['WHITE_PAGES/x/ADDRESS.md'] },
  ];
  const out = foreignWriters(commits);
  assert.equal(out.length, 1);
  assert.match(out[0], /^bbbbbbbbb by Wright .* edits tools\/github-ids\.json — only the office's drain/);
});

test('the check end to end on a real repository: a person\'s edit is refused, the pen\'s passes', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'reg-check-'));
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
  git('init', '-q');
  writeFileSync(join(repo, '.keep'), ''); git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'root');
  mkdirSync(join(repo, 'tools'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'households.json'), JSON.stringify(STORE.registry));
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(STORE.pins));
  git('add', '-A'); git('-c', 'user.name=Postmark Pen', '-c', `user.email=${PEN_EMAIL}`, 'commit', '-qm', 'registry: rendered from the store');
  writeFileSync(join(repo, 'README.md'), 'x'); git('add', '-A'); git('-c', 'user.name=Postmark Pen', '-c', `user.email=${PEN_EMAIL}`, 'commit', '-qm', 'readme');
  // ASYNC on purpose: the stand-in office is THIS process's server, and a
  // synchronous child would hold the event loop it answers on.
  const check = async (range, reg = `${BASE}/households`) => {
    try { const r = await promisify(execFile)(process.execPath, [join(HERE, 'registry-printout-check.mjs'), '--repo', repo, '--registry', reg, '--range', range], { encoding: 'utf8' }); return { ok: true, out: r.stdout }; }
    catch (e) { return { ok: false, out: `${e.stdout}${e.stderr}` }; }
  };
  assert.equal((await check('HEAD~2..HEAD')).ok, true, 'the pen\'s render passes');
  assert.match((await check('HEAD~2..HEAD', `${BASE}/down`)).out, /the store's read did not answer/, 'no store, no pass');
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify({ ...STORE.pins, sneak: { login: 's', id: 99 } }));
  git('add', '-A'); git('-c', 'user.name=Hand', '-c', 'user.email=hand@example.com', 'commit', '-qm', 'registry: by hand');
  const r = await check('HEAD~1..HEAD');
  assert.equal(r.ok, false);
  assert.match(r.out, /by Hand <hand@example\.com> edits tools\/github-ids\.json/);
  assert.match(r.out, /pins "sneak", which the store does not/);
  rmSync(repo, { recursive: true, force: true });
});
