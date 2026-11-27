// reserved-handles.test.mjs — the town's one reserved-prefix rule (POS-884).
//   node --test tools/reserved-handles.test.mjs
// Zero-dep. Each road that asks the rule proves it on its own road, beside an ordinary
// handle it admits: settle.test.mjs, witness-reserved-handle.test.mjs,
// join-preflight.test.mjs, rename-handle.test.mjs. This file holds the rule itself, and the
// two promises that keep it ONE rule: the office can carry it as a byte copy, and no town
// tool restates it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RESERVED_HANDLE_PREFIXES, RESERVED_PREFIX_RULE, reservedHandlePrefix, reservedHandleRefusal } from './reserved-handles.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

test('the two reserved prefixes, and the rule that names them', () => {
  assert.deepEqual(Object.keys(RESERVED_HANDLE_PREFIXES), ['berth-', 'human-of-']);
  assert.equal(RESERVED_PREFIX_RULE, 'the reserved-prefix rule: no resident handle begins with berth- or human-of-');
});

test('each prefix is refused with a sentence naming the handle, the prefix and the rule', () => {
  for (const [handle, prefix] of [['berth-inv-tide', 'berth-'], ['human-of-inv-reed', 'human-of-']]) {
    assert.equal(reservedHandlePrefix(handle), prefix);
    const why = reservedHandleRefusal(handle);
    assert.ok(why.startsWith(`handle "${handle}" wears the ${prefix} reserved prefix (${RESERVED_PREFIX_RULE}). `), why);
    assert.ok(why.endsWith(RESERVED_HANDLE_PREFIXES[prefix]), why);
  }
});

test('case and surrounding space do not hide a prefix', () => {
  assert.equal(reservedHandlePrefix('  Berth-Inv-Tide '), 'berth-');
  assert.equal(reservedHandlePrefix('HUMAN-OF-inv-reed'), 'human-of-');
});

test('ordinary handles, and names that only resemble a prefix, are not this rule\'s to refuse', () => {
  for (const h of ['inv-moss', 'berthillon', 'berth', 'humanoid', 'human-ofx', 'human', 'the-human-of-it', 'my-berth-x', '', null, undefined]) {
    assert.equal(reservedHandlePrefix(h), null, String(h));
    assert.equal(reservedHandleRefusal(h), null, String(h));
  }
});

test('the module imports nothing, so the office\'s byte copy runs wherever this file does', () => {
  const src = readFileSync(join(HERE, 'reserved-handles.mjs'), 'utf8');
  assert.doesNotMatch(src, /^\s*import\s/m);
  assert.doesNotMatch(src, /\bimport\(|\brequire\(/);
});

test('ONE rule: no other town tool restates either prefix as a string', () => {
  const restating = readdirSync(HERE)
    .filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs') && f !== 'reserved-handles.mjs')
    .filter((f) => /['"`](berth-|human-of-)/.test(readFileSync(join(HERE, f), 'utf8')));
  assert.deepEqual(restating, [], 'a prefix check outside tools/reserved-handles.mjs is a second rule');
});
