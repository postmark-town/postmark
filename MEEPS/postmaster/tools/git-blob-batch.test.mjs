import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOB_LIMIT, blobGroups, decodeBlobBatch, readBlobBatch } from './git-blob-batch.mjs';

const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40), d = 'd'.repeat(40);
const frame = (oid, bytes) => Buffer.concat([Buffer.from(`${oid} blob ${bytes.length}\n`), bytes, Buffer.from('\n')]);

test('two Git calls for many requested blobs, deduplicated; binary/UTF8/CRLF/header-like payload and empty blob exact', () => {
  const first = Buffer.concat([Buffer.from(`λ\r\n${b} blob 0\n`), Buffer.from([0, 255, 128, 10])]);
  const empty = Buffer.alloc(0), calls = [];
  const result = readBlobBatch([a, b, a, b], (args, input, maxBuffer) => {
    calls.push(args); assert.equal(input.toString(), `${a}\n${b}\n`);
    if (args[1] === '--batch-check') {
      assert.equal(maxBuffer, BLOB_LIMIT);
      return Buffer.from(`${a} blob ${first.length}\n${b} blob 0\n`);
    }
    const bytes = Buffer.concat([frame(a, first), frame(b, empty)]);
    assert.equal(maxBuffer, bytes.length); return bytes;
  });
  assert.deepEqual(calls, [['cat-file', '--batch-check'], ['cat-file', '--batch']]);
  assert.deepEqual([...result.keys()], [a, b]);
  assert.deepEqual(result.get(a), first); assert.deepEqual(result.get(b), empty);
});

test('empty selection does no Git work; mutable/unsafe object IDs never reach Git', () => {
  const forbidden = () => assert.fail('Unexpected Git call');
  assert.equal(readBlobBatch([], forbidden).size, 0);
  for (const id of ['HEAD', 'a'.repeat(39), 'A'.repeat(40), `${a}\n${b}`, `${a}:path`]) {
    assert.throws(() => readBlobBatch([id], forbidden), /immutable blob IDs/);
  }
});

test('metadata fails closed before blob reading on missing/non-blob/wrong/reordered/oversized or malformed objects', () => {
  for (const metadata of [
    `${a} missing\n`, `${a} tree 0\n`, `${b} blob 0\n`, `${a} blob 0`,
    `${a} blob -1\n`, `${a} blob 01\n`, `${a} blob 9007199254740993\n`,
    `${a} blob ${BLOB_LIMIT + 1}\n`, `${a} blob 0\nextra\n`,
  ]) {
    let calls = 0;
    assert.throws(() => readBlobBatch([a], (args) => {
      calls++; assert.equal(args[1], '--batch-check'); return Buffer.from(metadata);
    }), /immutable|metadata|64MiB/);
    assert.equal(calls, 1);
  }
  assert.throws(() => readBlobBatch([a, b], () => Buffer.from(`${b} blob 0\n${a} blob 0\n`)), /mismatched/);
});

test('payload parser rejects truncation, misframing, wrong header/size, high-bit headers and extra bytes', () => {
  const wanted = [{ oid: a, size: 3 }], valid = frame(a, Buffer.from([0, 10, 255]));
  const badHighBit = Buffer.from(valid); badHighBit[0] = 0xe1;
  for (const bytes of [
    Buffer.from(a), valid.subarray(0, -1), valid.subarray(0, -2),
    Buffer.concat([valid, Buffer.from('extra')]), frame(b, Buffer.from('abc')),
    frame(a, Buffer.from('ab')), Buffer.from(`${a} tree 3\nabc\n`), badHighBit,
    Buffer.from(`${a} blob 3\nabcX`),
  ]) assert.throws(() => decodeBlobBatch(bytes, wanted), /Git batch|immutable/);
  assert.deepEqual(decodeBlobBatch(valid, wanted).get(a), Buffer.from([0, 10, 255]));
  assert.throws(() => decodeBlobBatch(valid, []), /trailing/);
});

test('batch grouping preserves the 64MiB per-blob/data cap without imposing a total-crossing cap', () => {
  const records = [{ oid: a, size: 40 * 1024 * 1024 }, { oid: b, size: 40 * 1024 * 1024 },
    { oid: c, size: 0 }, { oid: d, size: 24 * 1024 * 1024 }];
  assert.deepEqual(blobGroups(records), [[records[0]], records.slice(1)]);
  assert.deepEqual(blobGroups([{ oid: a, size: BLOB_LIMIT }, { oid: b, size: 1 }]).map((x) => x.length), [1, 1]);
  for (const size of [-1, 0.5, Infinity, BLOB_LIMIT + 1]) assert.throws(() => blobGroups([{ oid: a, size }]), /Invalid/);
  assert.deepEqual(blobGroups([]), []);
});

test('Git failures propagate instead of silently falling back to per-letter reads or partial data', () => {
  for (const at of ['--batch-check', '--batch']) {
    assert.throws(() => readBlobBatch([a], (args) => {
      if (args[1] === at) throw new Error('Synthetic Git failure');
      return Buffer.from(`${a} blob 0\n`);
    }), /Synthetic Git failure/);
  }
});

test('exactly-64MiB blob plus another byte is read completely in two data batches', () => {
  let payloadCalls = 0;
  const result = readBlobBatch([a, b], (args, input, maxBuffer) => {
    if (args[1] === '--batch-check') return Buffer.from(`${a} blob ${BLOB_LIMIT}\n${b} blob 1\n`);
    payloadCalls++;
    const oid = input.toString().trim();
    const bytes = frame(oid, oid === a ? Buffer.alloc(BLOB_LIMIT, 165) : Buffer.from([7]));
    assert.equal(maxBuffer, bytes.length); return bytes;
  });
  assert.equal(payloadCalls, 2);
  assert.equal(result.get(a).length, BLOB_LIMIT);
  assert.equal(result.get(a)[0], 165); assert.equal(result.get(a).at(-1), 165);
  assert.deepEqual(result.get(b), Buffer.from([7]));
});
