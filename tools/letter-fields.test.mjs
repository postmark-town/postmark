// letter-fields.test.mjs — the one letter-field policy (POS-1164).
//   node --test tools/letter-fields.test.mjs
//
// The rules are the office's (postmark-office src/write.mjs § validateLetter at 2ec4d638: THREAD_RE, MAX_BODY,
// buildStakeFm), moved here so the office door and the trusted witness merge run ONE implementation. These cases
// pin each rule and the office's refusal order, the optional-thread default, and that nothing here reads identity.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_BODY, THREAD_RE, STAKE_CANDIDATE_MAX, checkLetterFields, shown, stakeFrontmatter } from './letter-fields.mjs';

const ok = { thread: 'new', body: 'hello' };

test('thread: absent, empty and "new" are the optional default, never a refusal', () => {
  for (const thread of [undefined, null, '', 'new']) assert.equal(checkLetterFields({ ...ok, thread }), null, String(thread));
});

test('thread: a well-shaped id passes whether or not anyone holds it (an unseen reply is never a refusal here)', () => {
  assert.equal(checkLetterFields({ ...ok, thread: 'writer-2026-11-01-to-reader-note' }), null);
  assert.equal(checkLetterFields({ ...ok, thread: 'a' }), null);
  assert.equal(checkLetterFields({ ...ok, thread: 'a.b_c-d.1' }), null);
  assert.equal(checkLetterFields({ ...ok, thread: 'x'.repeat(255) }), null);
});

test('thread: a malformed value is refused 422, named and echoed short, never whole', () => {
  for (const thread of ['has space', 'quo"te', '-leading-dash', '.dot', 'a/b', 'line\nbreak', 'x'.repeat(256), 'café']) {
    const bad = checkLetterFields({ ...ok, thread });
    assert.equal(bad?.code, 422, JSON.stringify(thread));
    assert.match(bad.defect, /^thread .* is not a letter id$/);
    assert.ok(bad.defect.length < 80, 'the echo is short even when the value is not');
    assert.ok(bad.hint.includes('"new"'));
  }
  const nonText = checkLetterFields({ ...ok, thread: 42 });
  assert.equal(nonText.defect, 'thread (a number) is not a letter id');
});

test('THREAD_RE is the one grammar (the envelope ferry\'s own id grammar, first character alphanumeric, 255 at most)', () => {
  assert.ok(THREAD_RE.test('a-1.b_2'));
  assert.ok(!THREAD_RE.test(''));
  assert.ok(!THREAD_RE.test('_x'));
});

test('body: over the size courtesy is refused 413, by BYTES; at the line it passes', () => {
  assert.equal(checkLetterFields({ ...ok, body: 'a'.repeat(MAX_BODY) }), null);
  const over = checkLetterFields({ ...ok, body: 'a'.repeat(MAX_BODY + 1) });
  assert.equal(over.code, 413);
  assert.equal(over.defect, 'letter exceeds the size courtesy');
  // bytes, not characters: 40,000 three-byte characters is 120,000 bytes
  assert.equal(checkLetterFields({ ...ok, body: '€'.repeat(40_000) })?.code, 413);
});

test('stake trio: none is an ordinary letter; all three well-formed passes; the block is the writer\'s three lines', () => {
  assert.equal(checkLetterFields({ ...ok }), null);
  const trio = { stake_topic: 'the-ballot', stake_candidate: ' Ana One ', stake_stamps: '3' };
  assert.equal(checkLetterFields({ ...ok, ...trio }), null);
  assert.deepEqual(stakeFrontmatter(trio), { defect: null, fm: 'stake_topic: the-ballot\nstake_candidate: Ana One\nstake_stamps: 3\n' });
  assert.deepEqual(stakeFrontmatter({}), { defect: null, fm: '' });
  assert.deepEqual(stakeFrontmatter({ stake_stamps: 2, stake_topic: 't', stake_candidate: 'c' }).fm, 'stake_topic: t\nstake_candidate: c\nstake_stamps: 2\n');
});

test('stake trio: all-or-none, each shape defect named', () => {
  const full = { stake_topic: 'the-ballot', stake_candidate: 'Ana One', stake_stamps: '3' };
  const cases = [
    [{ stake_topic: 'the-ballot' }, 'incomplete stake'],
    [{ stake_topic: 'the-ballot', stake_stamps: '3' }, 'incomplete stake'],
    [{ ...full, stake_topic: 'Not A Slug' }, /^stake_topic "Not A Slug" is not a ballot slug$/],
    [{ ...full, stake_topic: 7 }, 'stake_topic must be text, not (a number)'],
    [{ ...full, stake_candidate: 'x'.repeat(STAKE_CANDIDATE_MAX + 1) }, /^stake_candidate is too long/],
    [{ ...full, stake_candidate: 'two\nlines' }, 'stake_candidate must be one line'],
    [{ ...full, stake_candidate: 'two lines' }, 'stake_candidate must be one line'],
    [{ ...full, stake_candidate: '   ' }, 'stake_candidate must be a name'],
    [{ ...full, stake_stamps: '0' }, /^stake_stamps "0" is not a positive whole number$/],
    [{ ...full, stake_stamps: '-2' }, /^stake_stamps "-2" is not a positive whole number$/],
    [{ ...full, stake_stamps: '2.5' }, /^stake_stamps "2.5" is not a positive whole number$/],
    [{ ...full, stake_stamps: 'three' }, /^stake_stamps "three" is not a positive whole number$/],
    [{ ...full, stake_stamps: {} }, 'stake_stamps must be a positive whole number, not (a object)'],
  ];
  for (const [trio, want] of cases) {
    const bad = checkLetterFields({ ...ok, ...trio });
    assert.equal(bad?.code, 422, JSON.stringify(trio));
    if (want instanceof RegExp) assert.match(bad.defect, want); else assert.equal(bad.defect, want);
  }
});

test('the office\'s order: thread, then size, then the stake trio', () => {
  const everything = { thread: 'bad thread', body: 'a'.repeat(MAX_BODY + 1), stake_topic: 'only-one' };
  assert.match(checkLetterFields(everything).defect, /^thread /);
  assert.equal(checkLetterFields({ ...everything, thread: 'new' }).code, 413);
  assert.equal(checkLetterFields({ ...everything, thread: 'new', body: 'ok' }).defect, 'incomplete stake');
});

test('it reads no identity: the sender, recipient, title, date and id are not inputs and not judged', () => {
  const bad = checkLetterFields({ from: 'x', to: 'y', title: '', id: '???', date: 'never', ...ok });
  assert.equal(bad, null);
});

test('shown: short and printable, a non-text value by its type', () => {
  assert.equal(shown('abc'), '"abc"');
  assert.equal(shown('a\nb'), '"a?b"');
  assert.equal(shown('x'.repeat(100)).length, 42);
  assert.equal(shown(null), '(a object)');
});

test('dependency-free: the file imports nothing, so the office can load this exact file from its town clone', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'letter-fields.mjs'), 'utf8');
  assert.equal(/^\s*import\s/m.test(src), false);
  assert.equal(/\brequire\(/.test(src), false);
});
