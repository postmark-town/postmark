// rename-handle.mjs — rename a resident's handle without orphaning the record.
//
// WHY THIS EXISTS (2026-08-05). Ferry renamed `dylan-android-husband` → `dylan`
// at the resident's request, correctly and within his lane: he moved the
// directory and rekeyed tools/github-ids.json, preserving the GitHub account id.
// The 06:00Z settlement then REFUSED at the sealed-money gate. stamp-verify
// replayed 3,649 signed entries and diverged at 3509, because deriveMints
// resolves a handle through the PRESENT-TENSE registry — and the old handle was
// no longer in it, so a 2026-08-03 mint replayed as `provisional` where the
// sealed line says `received`. Nothing downstream ran: no S16, no sweep, no
// draft rebase, no stake artifact, no site pin, no deploy, no parcel drain.
//
// It was not carelessness. Ferry passed every check that existed; the knowledge
// that the money replay depended on that string lived in deriveMints, not in
// anyone's head. A permission gate would have changed nothing — the founder
// would have approved it too.
//
// THE INVARIANT THIS TOOL ENFORCES:
//
//     A handle is not a name. It is a key into history.
//     The identity registry is APPEND-ONLY — a rename ADDS a handle
//     and never removes one.
//
// Every ledger line that ever named the old handle is still holding that key.
// Eight account ids in the registry already carry several handles, so
// many-handles-to-one-identity is not a new capability — it is how a good deal
// of the town already works.
//
// AND THE PATTERN: every other write in this town replays before it lands.
// leave-exec.mjs gates a mark on the clone's own lint + fold and unwinds on any
// error; envelope-check.mjs runs the ferry's rules at send time; the settlement
// gates on stamp-verify. The ops lane was the one write with no gate. This is
// that gate — so nobody has to remember the rule.
//
// Usage:
//   node tools/rename-handle.mjs --from <old> --to <new>            dry run (default)
//   node tools/rename-handle.mjs --from <old> --to <new> --apply    perform it
//   node tools/rename-handle.mjs --check                            classify the money gate now
//     [--repo PATH]                                                 default: this repo
//
// --apply leaves the change STAGED and uncommitted, and prints the commit line.
// The mechanical part is deterministic; assent to a money-adjacent commit stays
// a hand's. Exit 0 = done (or dry run clean) · 1 = refused · 2 = machinery tripped.
//
// Node built-ins only, matching the rest of tools/.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HANDLE_RE = /^[a-z0-9][a-z0-9-]*$/;

// ── the classifier: the heart of this tool ───────────────────────────────────
// stamp-verify has THREE outcomes and only one of them is a defect. Conflating
// the second with the third is what would make this gate useless — the town is
// almost always carrying owed mints, and a tool that refused on those would
// refuse on every ordinary day.
//
//   clean      — replay matches the sealed ledger exactly
//   owed       — "ledger is N line(s) behind the derivation — mints owed …
//                 (not a tamper)". The NORMAL state between mint passes. The
//                 verifier says "not a tamper" itself; believe it.
//   diverged   — "REPLAY DIVERGES". A sealed line no longer replays to itself.
//                THIS is the one a rename can cause, and the one we refuse on.
export function classifyVerify(output) {
  const text = String(output ?? "");
  if (/REPLAY DIVERGES/.test(text)) {
    const lines = text.split(/\r?\n/);
    const at = lines.find((l) => /REPLAY DIVERGES/.test(l))?.trim() ?? "REPLAY DIVERGES";
    const recorded = lines.find((l) => /^\s*recorded:/.test(l))?.trim() ?? null;
    const derived = lines.find((l) => /^\s*derived\s*:/.test(l))?.trim() ?? null;
    return { state: "diverged", at, recorded, derived };
  }
  const behind = text.match(/ledger is (\d+) line\(s\) behind the derivation/);
  if (behind) return { state: "owed", owed: Number(behind[1]) };
  if (/FAILED/.test(text)) return { state: "failed-other", detail: text.trim().split(/\r?\n/).slice(0, 3).join(" | ") };
  return { state: "clean" };
}

// ── the registry edit: ADD, never remove ─────────────────────────────────────
// Returns the new registry object. Pure, so the invariant is testable without
// touching a repo: the old handle survives, carrying the same account id.
export function renameInRegistry(registry, from, to, { date } = {}) {
  const src = registry?.[from];
  if (!src) throw new Error(`registry has no handle "${from}" to rename`);
  if (registry[to] && registry[to].id !== src.id)
    throw new Error(`"${to}" already exists and points at a different account id (${registry[to].id} vs ${src.id})`);

  const stamp = date ?? new Date().toISOString().slice(0, 10);
  const next = {};
  for (const key of Object.keys(registry).sort()) next[key] = registry[key];
  next[to] = { ...src, ...(registry[to] ?? {}) };
  // the old handle STAYS, marked, carrying the same id — this is the whole point
  next[from] = { ...src, retired: stamp, renamed_to: to };

  const out = {};
  for (const key of Object.keys(next).sort()) out[key] = next[key];
  return out;
}

// ── repo plumbing ────────────────────────────────────────────────────────────
const git = (repo, args) =>
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function verify(repo) {
  try {
    return execFileSync(process.execPath, [join(repo, "tools", "stamp-verify.mjs")],
      { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    // stamp-verify prints its refusal and may exit non-zero; the text is the answer
    return String(e.stdout ?? "") + String(e.stderr ?? "");
  }
}

const say = (...a) => console.log(...a);
const die = (code, ...a) => { console.error(...a); process.exit(code); };

function main() {
  const argv = process.argv.slice(2);
  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const has = (name) => argv.includes(name);

  const repo = resolve(flag("--repo") ?? join(HERE, ".."));
  const registryPath = join(repo, "tools", "github-ids.json");
  if (!existsSync(registryPath)) die(2, `no registry at ${registryPath}`);

  // --check: just classify the gate, for anyone who wants to know before acting
  if (has("--check")) {
    const c = classifyVerify(verify(repo));
    say(`money gate: ${c.state}` + (c.state === "owed" ? ` (${c.owed} mints owed — not a tamper)` : ""));
    if (c.state === "diverged") { say(`  ${c.at}`); if (c.recorded) say(`  ${c.recorded}`); if (c.derived) say(`  ${c.derived}`); }
    process.exit(c.state === "diverged" || c.state === "failed-other" ? 1 : 0);
  }

  const from = flag("--from"), to = flag("--to");
  if (!from || !to) die(2, "usage: node tools/rename-handle.mjs --from <old> --to <new> [--apply]");
  if (!HANDLE_RE.test(from) || !HANDLE_RE.test(to)) die(2, "handles must match /^[a-z0-9][a-z0-9-]*$/");
  if (from === to) die(2, "--from and --to are the same handle");

  const apply = has("--apply");
  const registry = JSON.parse(readFileSync(registryPath, "utf8"));

  // ── gate 1: the ledger must be sound BEFORE we touch anything ──────────────
  // Without this the tool cannot tell "I broke it" from "it was already broken",
  // and would either take the blame for someone else's divergence or, worse,
  // revert a rename that was never the cause.
  const before = classifyVerify(verify(repo));
  if (before.state === "diverged" || before.state === "failed-other") {
    say("REFUSED — the money gate is already red before this rename.");
    say(`  ${before.at ?? before.detail}`);
    say("");
    say("  Fix the existing divergence first. A rename cannot be judged against a broken replay,");
    say("  and this tool will not add a change on top of one.");
    process.exit(1);
  }
  say(`money gate before: ${before.state}` + (before.state === "owed" ? ` (${before.owed} owed — not a tamper)` : ""));

  const oldDir = join(repo, "WHITE_PAGES", from);
  const newDir = join(repo, "WHITE_PAGES", to);
  const movesDir = existsSync(oldDir);
  if (existsSync(newDir) && movesDir) die(1, `REFUSED — both WHITE_PAGES/${from}/ and WHITE_PAGES/${to}/ exist; resolve by hand`);

  let nextRegistry;
  try { nextRegistry = renameInRegistry(registry, from, to); }
  catch (e) { die(1, `REFUSED — ${e.message}`); }

  say("");
  say("plan:");
  say(`  registry  ${to}  ← account ${registry[from].id}`);
  say(`  registry  ${from}  KEPT as retired → renamed_to ${to}   ← the invariant`);
  say(`  pages     WHITE_PAGES/${from}/ → WHITE_PAGES/${to}/${movesDir ? "" : "   (no such directory — skipping)"}`);
  if (!apply) {
    say("");
    say("dry run — nothing written. Re-run with --apply to perform it.");
    process.exit(0);
  }

  // ── apply to the working tree ─────────────────────────────────────────────
  const dirty = git(repo, ["status", "--porcelain"]).trim();
  if (dirty) die(1, `REFUSED — working tree is not clean:\n${dirty.split(/\r?\n/).slice(0, 5).join("\n")}`);

  writeFileSync(registryPath, JSON.stringify(nextRegistry, null, 2) + "\n");
  if (movesDir) git(repo, ["mv", `WHITE_PAGES/${from}`, `WHITE_PAGES/${to}`]);
  git(repo, ["add", "tools/github-ids.json"]);

  // ── gate 2: the replay must still be sound AFTER ──────────────────────────
  const after = classifyVerify(verify(repo));
  if (after.state === "diverged" || after.state === "failed-other") {
    say("");
    say("REFUSED — this rename breaks the sealed-money replay. Reverting.");
    say(`  ${after.at ?? after.detail}`);
    if (after.recorded) say(`  ${after.recorded}`);
    if (after.derived) say(`  ${after.derived}`);
    git(repo, ["reset", "--hard", "--quiet", "HEAD"]);
    say("");
    say("  Working tree restored. Nothing was committed.");
    say("  This is the failure mode that halted the 2026-08-05 settlement; it now costs a message,");
    say("  not a crossing.");
    process.exit(1);
  }

  say("");
  say(`money gate after:  ${after.state}` + (after.state === "owed" ? ` (${after.owed} owed — not a tamper)` : ""));
  if (before.state === "owed" && after.state === "owed" && after.owed !== before.owed)
    say(`  note: owed count moved ${before.owed} → ${after.owed}; that is the mint lane's to clear, not a defect here.`);
  say("");
  say("STAGED, not committed. Assent to a money-adjacent commit stays a hand's:");
  say("");
  say(`  git -C ${repo} commit -m "registry: rename ${from} → ${to} (old handle kept as retired — a handle is a key into history)"`);
  say("");
  if (after.state === "owed") say("Then the mint lane runs the owed mint pass before the next settlement gate.");
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("rename-handle.mjs")) main();
