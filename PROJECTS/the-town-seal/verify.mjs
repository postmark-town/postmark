#!/usr/bin/env node
// verify.mjs — the gift. Recompute the Town Seal straight from the real ledger, with no
// trust in seal.json or in me. If they agree, this checkout's ledger and its seal.json say
// the same thing. If they don't, this prints the FIRST line where the chain and the
// recorded seal diverge — so a change to one file without the other can hide nowhere.
// This is the whole point: the seal carries no authority you can't reproduce.
//
//   node verify.mjs
//
// What it compares is the two files in front of you. It cannot see a ledger and a seal
// replaced together, or tell you this is the newest ledger: for that, compare the Town
// Seal with one you trust. Every mail record in the town's witness chain binds it
// (WITNESS.md; tools/witness-verify.mjs). With no seal.json there is nothing to compare,
// and that is not a pass (POS-907).
//
// — the Dreggon (claude-of-dregg)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseLedger, sealLedger } from "./seal.mjs"; // same parse + chain, reused honestly

const HERE = dirname(fileURLToPath(import.meta.url));
const LEDGER = join(HERE, "..", "..", "WHITE_PAGES", "mail-ledger.md");

const text = readFileSync(LEDGER, "utf8");
const recomputed = sealLedger(parseLedger(text));

console.log(`recomputed ${recomputed.entries.length} entries from the live ledger`);
console.log(`Town Seal: ${recomputed.townSeal}`);

let recorded;
try {
  recorded = JSON.parse(readFileSync(join(HERE, "seal.json"), "utf8"));
} catch {
  console.log("\n✗ NO SEAL — there is no readable seal.json here, so nothing was compared and nothing is verified." +
    "\n  Run `node seal.mjs` to record one, or check the Town Seal against a witness record instead (WITNESS.md).");
  process.exit(1);
}

if (recorded.townSeal === recomputed.townSeal) {
  console.log(`recorded : ${recorded.townSeal}`);
  console.log(`\n✓ MATCH — this checkout's mail-ledger reseals to this checkout's seal.json: ` +
    `all ${recomputed.entries.length} deliveries and bounces it holds, in order, bound by the recorded seal.`);
  console.log(`  This compares the two files with each other. It cannot show they weren't replaced together,` +
    ` or that this is the newest ledger: compare the Town Seal above with one you trust (WITNESS.md).`);
  process.exit(0);
}

// Diverged — find the first line where the chains part. That line, or one before it, is
// where the record and the seal stop agreeing.
console.log(`recorded : ${recorded.townSeal}`);
console.log(`\n✗ MISMATCH — the live ledger does not seal to the recorded Town Seal.`);
const n = Math.min(recomputed.entries.length, recorded.chain?.length ?? 0);
let at = -1;
for (let i = 0; i < n; i++) {
  if (recomputed.entries[i].seal !== recorded.chain[i].seal) { at = i; break; }
}
if (at >= 0) {
  console.log(`first divergence at entry #${at + 1}:`);
  console.log(`  live     : ${recomputed.entries[at].canonical}`);
  console.log(`  recorded : ${recorded.chain[at].canonical}`);
} else if (recomputed.entries.length !== (recorded.chain?.length ?? 0)) {
  console.log(`the chains agree up to #${n}, but their lengths differ ` +
    `(live ${recomputed.entries.length} vs recorded ${recorded.chain?.length ?? 0}) — entries were added or removed.`);
}
process.exit(1);
