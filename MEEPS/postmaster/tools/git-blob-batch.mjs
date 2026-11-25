// Length-framed immutable blobs only. Never --batch-all-objects or working files.
export const BLOB_LIMIT = 64 * 1024 * 1024;
const SHA = /^[0-9a-f]{40}$/;
const header = ({ oid, size }) => `${oid} blob ${size}\n`;

function record(line, oid) {
  const m = /^([0-9a-f]{40}) blob (0|[1-9][0-9]*)$/.exec(line);
  if (!m || m[1] !== oid) throw new Error('Missing, non-blob or mismatched immutable batch object');
  const size = Number(m[2]);
  if (!Number.isSafeInteger(size) || size > BLOB_LIMIT) throw new Error('Immutable blob exceeds 64MiB limit');
  return { oid, size };
}

export function blobGroups(records) {
  const groups = [];
  let group = [], size = 0;
  for (const item of records) {
    if (!Number.isSafeInteger(item.size) || item.size < 0 || item.size > BLOB_LIMIT) throw new Error('Invalid immutable blob size');
    if (group.length && size + item.size > BLOB_LIMIT) {
      groups.push(group); group = []; size = 0;
    }
    group.push(item); size += item.size;
  }
  if (group.length) groups.push(group);
  return groups;
}

export function decodeBlobBatch(bytes, records) {
  if (!Buffer.isBuffer(bytes)) throw new Error('Expected binary Git batch response');
  const blobs = new Map();
  let cursor = 0;
  for (const expected of records) {
    const newline = bytes.indexOf(10, cursor);
    if (newline < 0) throw new Error('Truncated Git batch header');
    // latin1 does not mask high bits into apparently valid ASCII header bytes.
    const actual = record(bytes.subarray(cursor, newline).toString('latin1'), expected.oid);
    if (actual.size !== expected.size) throw new Error('Git batch size changed after metadata read');
    const start = newline + 1, end = start + actual.size;
    if (end >= bytes.length || bytes[end] !== 10) throw new Error('Truncated or misframed Git batch blob');
    blobs.set(actual.oid, bytes.subarray(start, end));
    cursor = end + 1;
  }
  if (cursor !== bytes.length) throw new Error('Unexpected trailing Git batch bytes');
  return blobs;
}

// runGit(args, input, maxBuffer) is the reader's existing isolated, read-only
// Git runner. Only requested full OIDs go on stdin, deduplicated in source order.
export function readBlobBatch(ids, runGit) {
  const unique = [...new Set(ids)];
  if (unique.some((id) => !SHA.test(id))) throw new Error('Batch requires full immutable blob IDs');
  if (!unique.length) return new Map();
  const input = (items) => Buffer.from(items.join('\n') + '\n', 'ascii');
  const metadata = runGit(['cat-file', '--batch-check'], input(unique), BLOB_LIMIT);
  if (!Buffer.isBuffer(metadata)) throw new Error('Expected binary Git batch metadata');
  const lines = metadata.toString('latin1').split('\n');
  if (lines.pop() !== '' || lines.length !== unique.length) throw new Error('Incomplete Git batch metadata');
  const records = lines.map((line, i) => record(line, unique[i]));
  const all = new Map();
  for (const group of blobGroups(records)) {
    // Preserve the 64MiB payload limit, including a single exactly-64MiB blob.
    // Only the exact expected protocol headers/terminators are added to the cap.
    const maxBuffer = group.reduce((n, item) => n + item.size + Buffer.byteLength(header(item)) + 1, 0);
    const bytes = runGit(['cat-file', '--batch'], input(group.map((item) => item.oid)), maxBuffer);
    for (const [oid, value] of decodeBlobBatch(bytes, group)) all.set(oid, value);
  }
  return all;
}
