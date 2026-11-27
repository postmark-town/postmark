/**
 * seven harbours: compute the commit line for your orders (Node 22, no dependencies).
 *
 *   node tools/commit.ts <orders-file> <salt>
 *   node tools/commit.ts <orders-file> <salt> --check <commit>
 *
 * The orders file holds your order lines, one per line (`move SAL-R STILL`, `hold SAL`, …).
 * The commit is sha256 of the orders text and the salt, written right after it, in lowercase hex.
 * The salt loses the spaces at its end first, and an empty salt (or one of spaces only) is refused.
 * The orders text is your lines trimmed, spaces inside a line collapsed to one, empty lines left
 * out, joined by one newline, with no newline at the end. This tool prints that exact text, so you
 * can check it by hand with any sha256: `printf '%s' "<text><salt>" | sha256sum`.
 */
import { readFileSync } from "node:fs";
import { canonicalOrders, cleanSalt, commitFor, revealMatches, saltProblem } from "./engine.ts";

const [file, salt, flag, commit] = process.argv.slice(2);
if (!file || salt === undefined) {
  console.error("usage: node tools/commit.ts <orders-file> <salt> [--check <commit>]");
  process.exit(2);
}
const problem = saltProblem(salt);
if (problem) {
  console.error(`refused: ${problem}. Pick a salt of your own, at least a few characters.`);
  process.exit(2);
}
if (cleanSalt(salt) !== salt) console.log("note: the spaces at the end of the salt are dropped before hashing (and when the reveal is read).\n");
const orders = readFileSync(file, "utf8");
console.log("orders, as hashed:");
console.log(canonicalOrders(orders));
console.log("");
if (flag === "--check") {
  const ok = revealMatches(commit ?? "", orders, salt);
  console.log(ok ? "the reveal matches the commit" : "the reveal does NOT match the commit: these ships would hold");
  process.exit(ok ? 0 : 1);
}
console.log(`commit: ${commitFor(orders, salt)}`);
