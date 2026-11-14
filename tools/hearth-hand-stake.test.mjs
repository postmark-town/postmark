// hearth-hand-stake.test.mjs — the `hand` Hearth's stake spends from the resident the office previewed (POS-1029; review of #4683).
//   node --test tools/hearth-hand-stake.test.mjs
//
// LAW, the site's own stake flow (postmark-site src/lib/ballot-stake.mjs): "Changing anything after a preview takes the confirm away until it
// is previewed again." Stamps move, so the human confirms what the office previewed: the same resident, or nothing.
//
// It drives the real `stakeFlow` exported by PROJECTS/household-hearths/hand/hearth.js, with a fake `hearth.act` that records every call.

import test from 'node:test';
import assert from 'node:assert/strict';
import { stakeFlow } from '../PROJECTS/household-hearths/hand/hearth.js';

function fakeAct({ ok = true } = {}) {
  const calls = [];
  const act = async (a) => { calls.push(a); return { ok, status: ok ? 200 : 422, body: ok ? {} : { defect: 'no' } }; };
  return { act, calls };
}

test('preview then confirm: the confirm spends from the resident the office previewed', async () => {
  const { act, calls } = fakeAct();
  const f = stakeFlow(act, 'wren/a-bigger-porch');
  assert.equal((await f.press('iris')).step, 'previewed');
  assert.equal(f.locked, 'iris');
  // the picker now says jetto, but no change event reset the row: the confirm still spends iris's stamp, never a re-read of the picker
  const done = await f.press('jetto');
  assert.equal(done.step, 'done');
  assert.deepEqual(calls.map((c) => [c.door, c.do, c.args.handle, c.args.preview ?? false]),
    [['town', 'stake', 'iris', true], ['town', 'stake', 'iris', false]],
    'ballot-stake.mjs: "Changing anything after a preview takes the confirm away until it is previewed again"');
  assert.equal(calls[1].args.mark, 'wren/a-bigger-porch');
  assert.equal(calls[1].args.stamps, 1);
  assert.equal(f.locked, null, 'a confirm ends the flow');
});

test('changing the resident takes the confirm away: the next press previews again, as the new resident', async () => {
  const { act, calls } = fakeAct();
  const f = stakeFlow(act, 'wren/a-bigger-porch');
  await f.press('iris');
  f.reset();                                   // the picker's change
  const again = await f.press('jetto');
  assert.equal(again.step, 'previewed', 'not a confirm: nothing spent');
  assert.deepEqual(calls.map((c) => [c.args.handle, c.args.preview ?? false]), [['iris', true], ['jetto', true]]);
  // control: without the reset, the same second press is a confirm (so the test above tells the two apart)
  const { act: act2, calls: calls2 } = fakeAct();
  const g = stakeFlow(act2, 'wren/a-bigger-porch');
  await g.press('iris');
  await g.press('jetto');
  assert.deepEqual(calls2.map((c) => c.args.preview ?? false), [true, false]);
});

test('a refused preview locks nothing, so the next press previews again', async () => {
  const { act, calls } = fakeAct({ ok: false });
  const f = stakeFlow(act, 'wren/a-bigger-porch');
  assert.equal((await f.press('iris')).step, 'refused');
  assert.equal(f.locked, null);
  await f.press('iris');
  assert.deepEqual(calls.map((c) => c.args.preview), [true, true], 'nothing was ever sent without a preview');
});
