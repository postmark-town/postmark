import assert from "node:assert/strict";
import test from "node:test";

import { classifyVerify, renameInRegistry } from "./rename-handle.mjs";

test("the registry is append-only — a rename ADDS a handle and never removes one", () => {
  const registry = {
    dylan: { login: "XAesirX", id: 312413958 },
    wright: { login: "wright-starforge", id: 67605380, pinned: "2026-07-01" },
  };
  const next = renameInRegistry(registry, "dylan", "dylan-renamed", { date: "2026-08-05" });

  // THE INVARIANT. A handle is not a name, it is a key into history: every ledger
  // line that ever named it is still holding that key. Dropping it is what
  // refused the 2026-08-05 settlement.
  assert.ok(next["dylan"], "the old handle survives the rename");
  assert.equal(next["dylan"].id, 312413958, "and carries the SAME account id");
  assert.equal(next["dylan"].retired, "2026-08-05");
  assert.equal(next["dylan"].renamed_to, "dylan-renamed");
  assert.equal(next["dylan-renamed"].id, 312413958, "the new handle is the same identity");
  assert.equal(next["wright"].id, 67605380, "everyone else is untouched");

  // many-handles-to-one-id is not a special case here; eight ids in the live
  // registry already work this way
  const ids = Object.values(next).map((r) => r.id);
  assert.equal(ids.filter((id) => id === 312413958).length, 2);

  assert.deepEqual(Object.keys(next), [...Object.keys(next)].sort(), "keys stay sorted, so diffs stay readable");

  assert.throws(() => renameInRegistry(registry, "nobody", "x"), /no handle "nobody"/);
  assert.throws(() => renameInRegistry({ ...registry, taken: { id: 999 } }, "dylan", "taken"),
    /different account id/, "renaming onto someone else's identity is refused, not merged");
  // renaming onto a handle that is ALREADY the same identity is fine (idempotent re-run)
  assert.doesNotThrow(() => renameInRegistry({ ...registry, alias: { login: "XAesirX", id: 312413958 } }, "dylan", "alias"));
});

test("owed mints are not a tamper — and conflating them with a divergence would make the gate useless", () => {
  // The town is almost always carrying owed mints between mint passes. A gate
  // that refused on those would refuse on every ordinary day, so this
  // distinction is the whole load-bearing part of the classifier.
  const owed = classifyVerify(
    "✗ stamp-ledger verification FAILED:\n  - ledger is 173 line(s) behind the derivation — mints owed, run the mint pass (not a tamper)");
  assert.equal(owed.state, "owed");
  assert.equal(owed.owed, 173);

  const diverged = classifyVerify([
    "✗ stamp-ledger verification FAILED:",
    "  - line 3509: REPLAY DIVERGES",
    "  recorded: - 2026-08-03 · MINT → dylan-android-husband · 1 · for: x (received)",
    "  derived : - 2026-08-03 · MINT → dylan-android-husband · 1 · for: x (received) · provisional",
  ].join("\n"));
  assert.equal(diverged.state, "diverged", "a sealed line that no longer replays to itself IS a defect");
  assert.match(diverged.at, /line 3509/);
  assert.match(diverged.recorded, /received\)$/);
  assert.match(diverged.derived, /provisional/);

  assert.equal(classifyVerify("✓ all 3,649 entries verified from genesis").state, "clean");
  assert.equal(classifyVerify("").state, "clean");

  // an unrecognised FAILED is NOT read as clean — an unknown failure must refuse,
  // never pass, or the gate becomes a rubber stamp the first time the verifier
  // learns a new message
  assert.equal(classifyVerify("✗ stamp-ledger verification FAILED:\n  - something new").state, "failed-other");
});
