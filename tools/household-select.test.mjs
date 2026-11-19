// household-select.test.mjs — only allowlisted fields ever leave (POS-1151), on a FICTIONAL, offline registry.
//   node --test tools/household-select.test.mjs
// Every household, handle and value here is invented. Each record carries extra fields, a consent-shaped
// one among them, that must never appear in any output, whichever way the household is found.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ALLOWED, selectHousehold, query, fieldsOf } from "./household-select.mjs";

const SECRET = "FIXTURE-CONSENT-MUST-NOT-PRINT";
const REGISTRY = {
  schema_version: 1,
  households: {
    "hh:fixture-lantern": {
      accounts: ["fixture-login-a"], residents: ["ada-fixture", "bel-fixture"], member_of: ["hh:fixture-guild"],
      since: "2026-01-01", declared_by: "ada-fixture", name: "The Fixture Lantern",
      likeness: { consent: SECRET }, home_images: [SECRET], hearth: SECRET, invited_by: SECRET, formerly: SECRET,
      consent: SECRET,
    },
    "hh:fixture-guild": { accounts: ["fixture-login-g"], residents: ["guild-fixture"], likeness: SECRET },
  },
};

test("the allowlist is exactly the identity and membership facts", () => {
  assert.deepEqual([...ALLOWED], ["household", "residents", "accounts", "member_of"]);
});

test("a selected household carries only allowlisted fields, never the consent-shaped ones", () => {
  const out = selectHousehold("hh:fixture-lantern", REGISTRY.households["hh:fixture-lantern"]);
  assert.deepEqual(Object.keys(out).sort(), ["accounts", "household", "member_of", "residents"]);
  assert.ok(!JSON.stringify(out).includes(SECRET));
  assert.deepEqual(out.residents, ["ada-fixture", "bel-fixture"]);
});

test("by handle, by slug and by account (any case): the same reduced shape, no secret", () => {
  for (const q of [{ handle: "bel-fixture" }, { household: "hh:fixture-lantern" }, { account: "FIXTURE-LOGIN-A" }]) {
    const hits = query(REGISTRY, q);
    assert.equal(hits.length, 1, JSON.stringify(q));
    assert.equal(hits[0].household, "hh:fixture-lantern");
    assert.ok(!JSON.stringify(hits).includes(SECRET), JSON.stringify(q));
  }
});

test("asking for a field outside the allowlist is refused, naming the allowlist", () => {
  for (const asked of ["likeness", "residents,consent", "home_images", "name"]) {
    const f = fieldsOf(asked);
    assert.ok(f.refused, asked);
    assert.match(f.refused, /household, residents, accounts, member_of/);
  }
  assert.deepEqual(fieldsOf("residents").fields, ["household", "residents"]);
});

test("the CLI prints only the allowlist, refuses an unlisted field with exit 2, and prints no secret either way", () => {
  const dir = mkdtempSync(join(tmpdir(), "household-select-"));
  try {
    const reg = join(dir, "households.json");
    writeFileSync(reg, JSON.stringify(REGISTRY));
    const tool = join(dirname(fileURLToPath(import.meta.url)), "household-select.mjs");
    const ok = execFileSync(process.execPath, [tool, "--handle", "ada-fixture", "--registry", reg], { encoding: "utf8" });
    assert.ok(!ok.includes(SECRET));
    assert.deepEqual(Object.keys(JSON.parse(ok.trim())).sort(), ["accounts", "household", "member_of", "residents"]);
    let refused = null;
    try { execFileSync(process.execPath, [tool, "--handle", "ada-fixture", "--fields", "likeness", "--registry", reg], { encoding: "utf8", stdio: "pipe" }); }
    catch (e) { refused = e; }
    assert.equal(refused?.status, 2);
    assert.ok(!String(refused.stdout).includes(SECRET) && !String(refused.stderr).includes(SECRET));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
