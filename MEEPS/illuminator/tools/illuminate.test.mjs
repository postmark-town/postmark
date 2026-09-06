import assert from 'node:assert/strict';
import test from 'node:test';

import { codexSubscriptionEnv, extractPngFromJsonl, extractThreadIdFromJsonl, isValidPngBytes } from './illuminate.mjs';

const validPngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const validPng = validPngBytes.toString('base64');

test('keeps the Codex child on subscription auth even when an API key is inherited', () => {
  assert.deepEqual(
    codexSubscriptionEnv({ PATH: 'safe-path', OPENAI_API_KEY: 'must-not-reach-codex' }),
    { PATH: 'safe-path' },
  );
});

test('extracts a bare PNG result from a nested Codex event', () => {
  const jsonl = [
    JSON.stringify({ type: 'thread.started', thread_id: 'test' }),
    JSON.stringify({ type: 'event_msg', payload: { type: 'image_generation_end', status: 'completed', result: validPng } }),
    JSON.stringify({ type: 'turn.completed' }),
  ].join('\n');

  assert.deepEqual(extractPngFromJsonl(jsonl), Buffer.from(validPng, 'base64'));
  assert.equal(extractThreadIdFromJsonl(jsonl), 'test');
});

test('extracts a known image-generation data URL and ignores malformed diagnostic lines', () => {
  const jsonl = [
    'not json',
    JSON.stringify({ type: 'item.completed', item: { type: 'image_generation', image_url: `data:image/png;base64,${validPng}` } }),
  ].join('\n');

  assert.deepEqual(extractPngFromJsonl(jsonl), Buffer.from(validPng, 'base64'));
});

test('rejects absent, tiny, and non-PNG payloads', () => {
  const event = (result) => JSON.stringify({ type: 'event_msg', payload: { type: 'image_generation_end', status: 'completed', result } });
  assert.equal(extractPngFromJsonl(JSON.stringify({ user_prompt: validPng })), null);
  assert.equal(extractPngFromJsonl(event(Buffer.from('tiny').toString('base64'))), null);
  assert.equal(extractPngFromJsonl(event(Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(12_000, 1)]).toString('base64'))), null);
  assert.equal(isValidPngBytes(validPngBytes), true);
});

test('keeps the last valid generated PNG when a later candidate is invalid', () => {
  const jsonl = [
    JSON.stringify({ type: 'event_msg', payload: { type: 'image_generation_end', status: 'completed', result: validPng } }),
    JSON.stringify({ type: 'item.completed', item: { type: 'image_generation', result: 'iVBORw0KGgoAAAA' } }),
  ].join('\n');
  assert.deepEqual(extractPngFromJsonl(jsonl), Buffer.from(validPng, 'base64'));
});

test('deduplicates repeated image events and rejects distinct generated images', () => {
  const repeated = [
    JSON.stringify({ type: 'event_msg', payload: { type: 'image_generation_end', status: 'completed', result: validPng } }),
    JSON.stringify({ type: 'item.completed', item: { type: 'image_generation', image_url: `data:image/png;base64,${validPng}` } }),
  ].join('\n');
  assert.deepEqual(extractPngFromJsonl(repeated), validPngBytes);

  const distinctBytes = Buffer.from(validPngBytes);
  distinctBytes[19] = 2; // structurally valid 2x1 IHDR for ambiguity detection
  const distinct = repeated + '\n' + JSON.stringify({
    type: 'event_msg',
    payload: { type: 'image_generation_end', status: 'completed', result: distinctBytes.toString('base64') },
  });
  assert.throws(() => extractPngFromJsonl(distinct), /ambiguous Codex event stream/);
});
