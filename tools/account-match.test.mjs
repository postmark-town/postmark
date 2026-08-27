// account-match.test.mjs — falsifiers for the one identity-matching rule.
//   node --test tools/account-match.test.mjs
//
// WHY THIS FILE EXISTS AT ALL. The rule used to be spelled out three times, and
// the most important copy — `owns()` in witness.mjs — was a closure inside a
// non-exported `async function registryJudgment` that makes live `gh()` calls.
// It was therefore structurally untestable, which is exactly how a stated law
// ("a pinned resident is deliberately NOT login-matchable", witness.mjs §
// loadBindings) went unapplied at the one place that decides. Giving the rule
// one home made it a pure function, and a pure function can be falsified.

import test from "node:test";
import assert from "node:assert/strict";
import { accountMatches, rowHoldsAccount, pinnedHouseNamingLogin } from "./account-match.mjs";

const PINNED = { login: "crowandclock", id: 265401358 };
const LEGACY = { login: "unpinned-soul" };

// ── the hole ────────────────────────────────────────────────────────────────

test('THE HOLE: "a different id wearing a recycled login is REFUSED where an id is on record"', () => {
  // GitHub releases abandoned logins for re-registration. A stranger registers
  // `crowandclock`, arrives with their OWN verified id, and names the row.
  assert.equal(accountMatches(PINNED, 424242, "crowandclock"), false,
    "an OR here would have handed a stranger the household on a name alone");
  assert.equal(rowHoldsAccount({ accounts: [PINNED] }, 424242, "crowandclock"), false);
});

test('the pinned law, enforced: "a pinned resident is deliberately NOT login-matchable"', () => {
  // Even with NO competing id — a caller carrying no verified identity at all
  // must not reach a pinned account by naming it. The row's pinned-ness decides,
  // not the caller's. This is the sentence witness.mjs § loadBindings has stated
  // since it was written; until now nothing asserted it.
  assert.equal(accountMatches(PINNED, null, "crowandclock"), false);
  assert.equal(accountMatches(PINNED, undefined, "CROWANDCLOCK"), false);
  assert.equal(rowHoldsAccount({ accounts: [PINNED] }, null, "crowandclock"), false);
});

test("the owner keeps their row across their OWN rename — the same law's other half", () => {
  assert.equal(accountMatches(PINNED, 265401358, "renamed-entirely"), true);
  assert.equal(accountMatches(PINNED, "265401358", "renamed-entirely"), true,
    "a numeric id arriving as a string is the same id");
  assert.equal(accountMatches(PINNED, 265401358, null), true,
    "and it matches with no login offered at all");
});

// ── nothing unpinned regresses ──────────────────────────────────────────────

test('"a legacy row with login and no id still matches by login"', () => {
  // For an account the Registrar has not pinned, the login is the only road
  // there has ever been. Closing the hole must not close that road, or every
  // unpinned household silently stops being findable.
  assert.equal(accountMatches(LEGACY, null, "unpinned-soul"), true);
  assert.equal(accountMatches(LEGACY, 999, "UNPINNED-SOUL"), true,
    "still case-blind, and an id the row does not carry does not block the match");
  assert.equal(accountMatches(LEGACY, null, "someone-else"), false);
  assert.equal(accountMatches(LEGACY, null, null), false, "but a blank matches nothing");
});

test("an id of 0 is an id — the guard is null-ness, never truthiness", () => {
  // `if (account.id)` would treat 0 as absent and fall through to the login,
  // reopening the hole for exactly one account. GitHub ids are positive today,
  // which is precisely why this would never be noticed.
  assert.equal(accountMatches({ login: "zero", id: 0 }, 0, "anything"), true);
  assert.equal(accountMatches({ login: "zero", id: 0 }, null, "zero"), false,
    "id 0 is on record, so the login must not match it");
});

test("a malformed or absent account matches nothing", () => {
  for (const bad of [null, undefined, {}, { login: "" }, { login: null }])
    assert.equal(accountMatches(bad, 1, "anyone"), false, `${JSON.stringify(bad)} must not match`);
  assert.equal(rowHoldsAccount({}, 1, "anyone"), false);
  assert.equal(rowHoldsAccount(null, 1, "anyone"), false);
});

// ── the refusal signal (compares logins to STOP, never to authorise) ────────

test("pinnedHouseNamingLogin finds a pinned house by name — to refuse, never to admit", () => {
  const doc = {
    households: {
      "the-rookery": { accounts: [PINNED], residents: ["crow"] },
      "old-house": { accounts: [LEGACY], residents: ["someone"] },
    },
  };
  assert.equal(pinnedHouseNamingLogin(doc, "crowandclock"), "the-rookery");
  assert.equal(pinnedHouseNamingLogin(doc, "CrowAndClock"), "the-rookery", "case-blind");
  assert.equal(pinnedHouseNamingLogin(doc, "unpinned-soul"), null,
    "an UNPINNED row is not a refusal signal — it is matchable by login, so it merges normally");
  assert.equal(pinnedHouseNamingLogin(doc, "nobody"), null);
  assert.equal(pinnedHouseNamingLogin(doc, ""), null);
  assert.equal(pinnedHouseNamingLogin(null, "crowandclock"), null);

  // The load-bearing distinction: this function must never be usable as an
  // affirmative match. It answers "stop and get human eyes", and the thing that
  // decides ownership is accountMatches, which refuses the same input.
  assert.equal(accountMatches(PINNED, null, "crowandclock"), false,
    "the same login that raises the refusal signal still does NOT match the account");
});
