// witness-record.test.mjs — the witness certifies against the record, not its
// printout (POS-348).
//   node --test tools/witness-record.test.mjs
//
//   THE RECORD'S PINS   with the record read, a pin only the store holds
//                       binds, and a pin only the printout holds does not.
//   FAIL CLOSED         a record that does not answer certifies nothing: the
//                       evaluation gets a sentence for a person, and the
//                       witness holds no stale record from an earlier pass.
//   HAND RUN            with no TOWN_REGISTRY the printouts are read, as before.
//
// THE FLIP (after the commit): make loadBindings read the printout's pins even
// when the record was read — THE RECORD'S PINS goes red.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadBindings, loadStoreForEvaluation, __setStoreForTest } from './witness.mjs';

function town({ addresses = {}, pins = {} } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'witness-record-'));
  mkdirSync(join(repo, 'tools'), { recursive: true });
  mkdirSync(join(repo, 'WHITE_PAGES'), { recursive: true });
  writeFileSync(join(repo, 'tools', 'github-ids.json'), JSON.stringify(pins));
  for (const [handle, github] of Object.entries(addresses)) {
    mkdirSync(join(repo, 'WHITE_PAGES', handle), { recursive: true });
    writeFileSync(join(repo, 'WHITE_PAGES', handle, 'ADDRESS.md'), `---\nhandle: ${handle}\ngithub: ${github}\n---\n`);
  }
  writeFileSync(join(repo, 'WHITE_PAGES', 'stamp-ledger.md'), '# stamp-ledger\n\n');
  return repo;
}

test("THE RECORD'S PINS: a pin only the store holds binds; one only the printout holds does not", () => {
  const repo = town({
    addresses: { tulip: 'emberian', moss: 'mossy-gh' },
    pins: { moss: { login: 'mossy-gh', id: 222 } },            // the printout's hand edit
  });
  try {
    __setStoreForTest({ registry: { households: {} }, pins: { tulip: { login: 'emberian', id: 704250 } } });
    const { byId, byLogin } = loadBindings(repo);
    assert.deepEqual(byId[704250], ['tulip'], 'the store pins tulip by id');
    assert.equal(byLogin['emberian'], undefined, 'and a pinned resident is not login-matchable');
    assert.equal(byId[222], undefined, 'the printout-only pin binds nobody');
    assert.deepEqual(byLogin['mossy-gh'], ['moss'], 'moss falls back to its card login, as an unpinned resident does');
  } finally { __setStoreForTest(null); rmSync(repo, { recursive: true, force: true }); }
});

test('FAIL CLOSED: a record that does not answer certifies nothing, and no earlier record lingers', async () => {
  __setStoreForTest({ registry: { households: {} }, pins: { stale: { id: 1 } } });
  const why = await loadStoreForEvaluation({ TOWN_REGISTRY: 'https://postmark.town/api/households' },
    { load: async () => { throw new Error('--registry https://postmark.town/api/households answered 503'); } });
  assert.match(why, /did not answer/);
  assert.match(why, /nothing was certified against a copy/);
  const repo = town({ addresses: { stale: 'stale-gh' } });
  try {
    assert.deepEqual(loadBindings(repo).byLogin['stale-gh'], ['stale'], 'the earlier record was dropped, not reused');
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('HAND RUN: no TOWN_REGISTRY reads the printouts, as before', async () => {
  assert.equal(await loadStoreForEvaluation({}), null);
  const repo = town({ addresses: { moss: 'mossy-gh' }, pins: { moss: { login: 'mossy-gh', id: 222 } } });
  try { assert.deepEqual(loadBindings(repo).byId[222], ['moss']); }
  finally { rmSync(repo, { recursive: true, force: true }); }
});
