#!/usr/bin/env node
/**
 * audit.ts: recompute the Slow Tote from zero and compare it with the published book.
 *
 *   node tools/audit.ts --town <clone of postmark-town/postmark> [--liquid <bank balance>] [--asof YYYY-MM-DD]
 *
 * Reads files only: no network, no child process, nothing written. It rebuilds every bet, pot and
 * payout from the stamp ledger (WHITE_PAGES/stamp-ledger.md), the mail ledger and the letters in
 * the bank's inbox/outbox, then checks that (1) the hash chain of book/book.jsonl is intact,
 * (2) every published line is justified by the ledger, (3) with --liquid, that the bank holds at
 * least what it owes (`town read: "stamps"` shows the balance). Exit 0 = clean, 1 = not.
 */
import path from "node:path";
import { parseArgs } from "node:util";
import { runAudit } from "./tote-core.ts";

const { values } = parseArgs({
  options: {
    town: { type: "string", default: "" },
    liquid: { type: "string", default: "" },
    asof: { type: "string", default: new Date().toISOString().slice(0, 10) },
    bank: { type: "string", default: "lupi" },
  },
});
if (!values.town) {
  console.error("usage: node tools/audit.ts --town <clone of postmark-town/postmark> [--liquid <n>] [--asof YYYY-MM-DD]");
  process.exit(2);
}
const root = path.resolve(import.meta.dirname, "..");
const r = runAudit(root, values.town, values.asof!, { bank: values.bank, liquid: values.liquid ? Number(values.liquid) : undefined });
for (const l of r.out) console.log(l);
process.exit(r.code);
