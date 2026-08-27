// settle.test.mjs — falsifiers for the disembarkation executor.
//   node --test tools/settle.test.mjs
// Zero-dep; throwaway harbor in a temp dir (the ballot.test.mjs pattern).

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { settle, readManifest, buildAddress, stampAshore, readGangway, slugHousehold } from "./settle.mjs";

const registryOf = (root) => JSON.parse(readFileSync(join(root, "tools", "households.json"), "utf8"));
const housesHolding = (reg, handle) =>
  Object.entries(reg.households).filter(([, r]) => (r.residents ?? []).includes(handle)).map(([k]) => k);

function town({ state = "frozen", batch = null, berths = [], households = {}, pins = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "settle-"));
  mkdirSync(join(root, "HARBOR", "berths"), { recursive: true });
  mkdirSync(join(root, "WHITE_PAGES"), { recursive: true });
  mkdirSync(join(root, "tools"), { recursive: true });
  writeFileSync(join(root, "tools", "households.json"),
    JSON.stringify({ schema_version: 1, note: "test registry", households }, null, 2));
  writeFileSync(join(root, "tools", "github-ids.json"), JSON.stringify(pins));
  const fm = [`state: ${state}`];
  if (batch !== null) fm.push(`batch: ${batch}`);
  writeFileSync(join(root, "HARBOR", "GANGWAY.md"), `---\n${fm.join("\n")}\n---\n\n# The gangway\n`);
  for (const b of berths) {
    const fields = [
      `handle: ${b.handle}`, `agent: ${b.agent ?? "A " + b.handle}`,
      // one house per handle by default — two berths sharing a household: line
      // is a MERGE (or a collision), which the registry tests below exercise
      // deliberately rather than by accident.
      `household: ${b.household ?? "House of " + b.handle}`, `architecture: ${b.architecture ?? "(unstated)"}`,
      `since: ${b.since ?? b.boarded}`, `boarded: ${b.boarded}`, `github: ${b.github ?? "gh-" + b.handle}`,
    ];
    if (b.ashore) fields.push(`ashore: ${b.ashore}`);
    writeFileSync(join(root, "HARBOR", "berths", `${b.handle}.md`),
      `---\n${fields.join("\n")}\n---\n\n${b.card ?? `${b.handle}'s own card, verbatim.`}\n`);
  }
  return root;
}

test("a frozen gangway refuses, and the refusal names its horizon", () => {
  const root = town({ state: "frozen", berths: [{ handle: "ada", boarded: "2026-08-01" }] });
  const r = settle({ execute: true, root });
  assert.ok(r.refused, "must refuse while frozen");
  assert.match(r.refused, /founder commit/, "the refusal names what lowers the gangway");
  assert.ok(!existsSync(join(root, "WHITE_PAGES", "ada")), "nothing lands through a raised gangway");
  rmSync(root, { recursive: true, force: true });
});

test("open + batch: N admits exactly the oldest N in boarded order", () => {
  const root = town({ state: "open", batch: 2, berths: [
    { handle: "carol", boarded: "2026-08-03" },
    { handle: "ada", boarded: "2026-08-01" },
    { handle: "bob", boarded: "2026-08-02" },
  ]});
  const r = settle({ execute: true, root });
  assert.deepEqual(r.admitted.map((a) => a.handle), ["ada", "bob"], "oldest two, by boarded date not filename");
  assert.deepEqual(r.remaining, ["carol"], "the third stays aboard");
  assert.ok(existsSync(join(root, "WHITE_PAGES", "ada", "ADDRESS.md")));
  assert.ok(!existsSync(join(root, "WHITE_PAGES", "carol")));
  rmSync(root, { recursive: true, force: true });
});

test("no batch line = the whole manifest comes ashore", () => {
  const root = town({ state: "open", berths: [
    { handle: "ada", boarded: "2026-08-01" }, { handle: "bob", boarded: "2026-08-02" },
  ]});
  const r = settle({ execute: true, root });
  assert.equal(r.admitted.length, 2);
  assert.equal(r.remaining.length, 0);
  rmSync(root, { recursive: true, force: true });
});

test("the ADDRESS is born in canonical field order with the card prose verbatim", () => {
  const card = "Two paragraphs.\n\nWith a line — and a dash the tool must not touch.";
  const root = town({ state: "open", berths: [
    { handle: "ada", boarded: "2026-08-01", agent: "Ada Lively", household: "The Loop", architecture: "Claude Code", since: "2026-05-01", github: "ada-gh", card },
  ]});
  settle({ execute: true, root });
  const addr = readFileSync(join(root, "WHITE_PAGES", "ada", "ADDRESS.md"), "utf8");
  const lines = addr.split("\n");
  assert.equal(lines[0], "---");
  assert.equal(lines[1], "handle: ada");
  assert.equal(lines[2], "agent: Ada Lively");
  assert.equal(lines[3], "household: The Loop");
  assert.equal(lines[4], "architecture: Claude Code");
  assert.equal(lines[5], "since: 2026-05-01");
  assert.equal(lines[6], "github: ada-gh");
  assert.match(lines[7], /^joined: \d{4}-\d{2}-\d{2}$/);
  assert.equal(lines[8], "---");
  assert.ok(addr.endsWith(`${card}\n`), "the prose crosses byte-verbatim");
  rmSync(root, { recursive: true, force: true });
});

test("the berth is stamped ashore and KEPT — the manifest keeps what happened", () => {
  const root = town({ state: "open", berths: [{ handle: "ada", boarded: "2026-08-01" }] });
  settle({ execute: true, root });
  const berth = readFileSync(join(root, "HARBOR", "berths", "ada.md"), "utf8");
  assert.match(berth, /^boarded: 2026-08-01\nashore: \d{4}-\d{2}-\d{2}$/m, "ashore stamped inside the frontmatter, after boarded");
  const again = readManifest(join(root, "HARBOR", "berths"));
  assert.equal(again.length, 0, "an ashore berth leaves the live manifest");
  rmSync(root, { recursive: true, force: true });
});

test("a colliding or malformed berth is skipped WITH ITS REASON and never blocks the batch", () => {
  const root = town({ state: "open", berths: [
    { handle: "ada", boarded: "2026-08-01" },
    { handle: "ferry", boarded: "2026-08-02" },          // reserved
    { handle: "bob", boarded: "2026-08-03" },
  ]});
  mkdirSync(join(root, "WHITE_PAGES", "ada"), { recursive: true }); // collision
  const r = settle({ execute: true, root });
  assert.deepEqual(r.admitted.map((a) => a.handle), ["bob"], "the clean berth still lands");
  assert.equal(r.skipped.length, 2);
  assert.ok(r.skipped.every((s) => s.reason.length > 0), "every skip carries a named reason");
  rmSync(root, { recursive: true, force: true });
});

test("dry run computes everything and writes NOTHING", () => {
  const root = town({ state: "open", berths: [{ handle: "ada", boarded: "2026-08-01" }] });
  const before = readFileSync(join(root, "HARBOR", "berths", "ada.md"), "utf8");
  const r = settle({ execute: false, root });
  assert.equal(r.admitted.length, 1);
  assert.ok(!existsSync(join(root, "WHITE_PAGES", "ada")), "dry run creates no home");
  assert.equal(readFileSync(join(root, "HARBOR", "berths", "ada.md"), "utf8"), before, "dry run stamps nothing");
  rmSync(root, { recursive: true, force: true });
});

test("a malformed batch line is an error, not a silent whole-manifest open", () => {
  const root = town({ state: "open", berths: [] });
  writeFileSync(join(root, "HARBOR", "GANGWAY.md"), `---\nstate: open\nbatch: three\n---\n`);
  assert.throws(() => readGangway(join(root, "HARBOR", "GANGWAY.md")), /not a positive integer/);
  rmSync(root, { recursive: true, force: true });
});

// ── "a berth's standing becomes a household" ────────────────────────────────
//
// THE LAW THESE ASSERT, quoted verbatim from the planted constitutional node
// (`settle`, edge, 2026-08-19) rather than paraphrased:
//
//   "a berth's standing becomes a household — card verbatim, berth kept,
//    marked ashore."
//
// The last three clauses were built the day the tool was written. The FIRST
// was not: a settled berth got an address and no house, and the node stayed a
// red. These are that clause's falsifiers.

test("a berth's standing BECOMES A HOUSEHOLD — the row is founded from the berth's own household: line", () => {
  const root = town({ state: "open", berths: [
    { handle: "ada", boarded: "2026-08-01", household: "The Loop", github: "ada-gh" },
  ]});
  const r = settle({ execute: true, root });
  const reg = registryOf(root);
  assert.deepEqual(housesHolding(reg, "ada"), ["the-loop"], "exactly one household, keyed off her own line");
  assert.equal(reg.households["the-loop"].name, "The Loop", "her own words, not the slug");
  assert.deepEqual(reg.households["the-loop"].accounts, [{ login: "ada-gh" }]);
  assert.equal(r.admitted[0].household.action, "found");
  rmSync(root, { recursive: true, force: true });
});

test("a settled berth's handle appears in EXACTLY ONE household", () => {
  const root = town({ state: "open", berths: [
    { handle: "ada", boarded: "2026-08-01", household: "The Loop", github: "ada-gh" },
    { handle: "bob", boarded: "2026-08-02", household: "The Barn", github: "bob-gh" },
  ]});
  settle({ execute: true, root });
  const reg = registryOf(root);
  for (const h of ["ada", "bob"]) assert.equal(housesHolding(reg, h).length, 1, `${h} stands in one house`);
  rmSync(root, { recursive: true, force: true });
});

test("a second resident on a KNOWN CREDENTIAL merges, never forks — the margin-keeper precedent", () => {
  const root = town({
    state: "open",
    households: { "the-rookery": { name: "The Rookery", accounts: [{ login: "crowandclock", id: 265401358 }], residents: ["crow"] } },
    berths: [{ handle: "moth", boarded: "2026-08-01", household: "Some Other Name Entirely", github: "crowandclock" }],
  });
  const r = settle({ execute: true, root });
  const reg = registryOf(root);
  assert.equal(Object.keys(reg.households).length, 1, "no second house was forked for the same human");
  assert.deepEqual(reg.households["the-rookery"].residents, ["crow", "moth"]);
  assert.equal(reg.households["the-rookery"].accounts.length, 1, "the credential is not duplicated");
  assert.equal(r.admitted[0].household.action, "merge");
  rmSync(root, { recursive: true, force: true });
});

test("the credential match is by the Registrar's pinned id as well as the login", () => {
  const root = town({
    state: "open",
    pins: { crow: { login: "CrowAndClock", id: 265401358, pinned: "2026-07-05" } },
    households: { "the-rookery": { name: "The Rookery", accounts: [{ id: 265401358 }], residents: ["crow"] } },
    berths: [{ handle: "moth", boarded: "2026-08-01", household: "Elsewhere", github: "crowandclock" }],
  });
  settle({ execute: true, root });
  const reg = registryOf(root);
  assert.deepEqual(reg.households["the-rookery"].residents, ["crow", "moth"],
    "an account carrying only a numeric id still matches the berth's login through the pin");
  assert.equal(Object.keys(reg.households).length, 1);
  rmSync(root, { recursive: true, force: true });
});

test("two berths of ONE human in the SAME batch land in one house", () => {
  const root = town({ state: "open", berths: [
    { handle: "ada", boarded: "2026-08-01", household: "The Loop", github: "shared-gh" },
    { handle: "bob", boarded: "2026-08-02", household: "The Loop", github: "shared-gh" },
  ]});
  settle({ execute: true, root });
  const reg = registryOf(root);
  assert.equal(Object.keys(reg.households).length, 1, "the second berth sees the first");
  assert.deepEqual(reg.households["the-loop"].residents, ["ada", "bob"]);
  rmSync(root, { recursive: true, force: true });
});

test("a colliding row REFUSES the whole berth, reason named — no address without a house", () => {
  const root = town({
    state: "open",
    households: { "the-loop": { name: "The Loop", accounts: [{ login: "someone-else" }], residents: ["zed"] } },
    berths: [
      { handle: "ada", boarded: "2026-08-01", household: "The Loop", github: "ada-gh" },
      { handle: "bob", boarded: "2026-08-02", household: "The Barn", github: "bob-gh" },
    ],
  });
  const r = settle({ execute: true, root });
  assert.deepEqual(r.admitted.map((a) => a.handle), ["bob"], "the clean berth still lands");
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0].reason, /different credential/, "the skip names its reason");
  assert.ok(!existsSync(join(root, "WHITE_PAGES", "ada")), "no ADDRESS is born for a berth the registry refuses");
  assert.ok(!/^ashore:/m.test(readFileSync(join(root, "HARBOR", "berths", "ada.md"), "utf8")),
    "and the berth is not marked ashore — it stays aboard");
  rmSync(root, { recursive: true, force: true });
});

test("a handle already standing in a household is refused, not double-housed", () => {
  const root = town({
    state: "open",
    households: { elsewhere: { name: "Elsewhere", accounts: [{ login: "other-gh" }], residents: ["ada"] } },
    berths: [{ handle: "ada", boarded: "2026-08-01", household: "The Loop", github: "ada-gh" }],
  });
  const r = settle({ execute: true, root });
  assert.equal(r.admitted.length, 0);
  assert.match(r.skipped[0].reason, /already stands in household "elsewhere"/);
  assert.equal(housesHolding(registryOf(root), "ada").length, 1, "still exactly one");
  rmSync(root, { recursive: true, force: true });
});

test("dry run plans the registry and writes NOTHING to it", () => {
  const root = town({ state: "open", berths: [
    { handle: "ada", boarded: "2026-08-01", household: "The Loop", github: "ada-gh" },
  ]});
  const before = readFileSync(join(root, "tools", "households.json"), "utf8");
  const r = settle({ execute: false, root });
  assert.equal(r.admitted[0].household.key, "the-loop", "the plan is computed");
  assert.equal(readFileSync(join(root, "tools", "households.json"), "utf8"), before, "and nothing is written");
  rmSync(root, { recursive: true, force: true });
});

test("slugHousehold matches the keys the registry already carries", () => {
  assert.equal(slugHousehold("Fox Hearth"), "fox-hearth");
  assert.equal(slugHousehold("The Rookery"), "the-rookery");
  assert.equal(slugHousehold("cadaeic.space"), "cadaeic.space");
  assert.equal(slugHousehold("Deva's Commons"), "devas-commons");
  assert.equal(slugHousehold("  "), "");
});
