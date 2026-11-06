// registrar-window-welcome.test.mjs — which Ferry welcome state the Registrar's board prints (postmark#3915).
//   node --test tools/registrar-window-welcome.test.mjs
// Zero-dep. The fixture is augie-sealight's welcome as the record holds it at c7792b0: the envelope in
// WHITE_PAGES/augie-sealight/inbox/ and its row in WHITE_PAGES/mail-ledger.md, which the builder read
// as "No Ferry welcome delivery record".

import test from "node:test";
import assert from "node:assert/strict";

import { isWelcomeId, welcomeIds, welcomeState } from "../WHITE_PAGES/registrar/WINDOW/welcome.mjs";

const augie = { id: "postmaster-2026-10-16-to-augie-sealight-welcome", from: "postmaster", to: "augie-sealight" };
const augieRow = "- 2026-10-16 · postmaster-2026-10-16-to-augie-sealight-welcome · postmaster → augie-sealight · thread: new";
// POS-913 fixtures use the retained envelope shape, not a fresh mail read.
const amet = { id: "postmaster-2026-11-04-to-amet-welcome-to-postmark", from: "postmaster", to: "amet" };
const ametRow = "- 2026-11-04 · postmaster-2026-11-04-to-amet-welcome-to-postmark · postmaster → amet · thread: new";

test("POS-913: the exact welcome-to-postmark form is recognized", () => {
  assert.equal(isWelcomeId(amet.id, "amet"), true);
});

test("POS-913: a current-form inbox welcome needs its matching ledger edge", () => {
  assert.equal(welcomeState({ handle: "amet", inbox: [amet], outbox: [], mailRows: [ametRow] }), "Ferry welcome delivered");
  assert.equal(welcomeState({ handle: "amet", inbox: [amet], outbox: [], mailRows: [] }), "No Ferry welcome delivery record");
  assert.equal(welcomeState({ handle: "amet", inbox: [amet], outbox: [],
    mailRows: [ametRow.replace("postmaster → amet", "postmaster → zeke")] }), "No Ferry welcome delivery record");
});

test("POS-913: the current form in the outbox is written, not delivered", () => {
  assert.equal(welcomeState({ handle: "amet", inbox: [], outbox: [amet], mailRows: [ametRow] }), "Ferry welcome written · delivery pending");
});

test("POS-913: the longer form does not loosen the exact-ID guard", () => {
  for (const id of [
    "postmaster-2026-11-04-to-amet-the-washstand-is-welcome",
    `${amet.id}-again`,
    `re-${amet.id}`,
    "postmaster-2026-11-04-welcome-amet-to-postmark",
    "ferry-2026-11-04-to-amet-welcome-to-postmark",
  ]) assert.equal(isWelcomeId(id, "amet"), false, id);
  assert.equal(isWelcomeId(amet.id, "zeke"), false, "another resident's welcome");
  assert.deepEqual(welcomeIds([{ ...amet, from: "ferry" }, { ...amet, to: "zeke" }], "amet"), []);
});

test("#3915 replayed: augie's delivered welcome reads delivered", () => {
  assert.equal(welcomeState({ handle: "augie-sealight", inbox: [augie], outbox: [], mailRows: [augieRow] }), "Ferry welcome delivered");
});

test("both id shapes are a welcome, and nothing looser is", () => {
  assert.equal(isWelcomeId("postmaster-2026-10-15-welcome-zeke", "zeke"), true, "the older shape");
  assert.equal(isWelcomeId(augie.id, "augie-sealight"), true, "the to-HANDLE shape");
  assert.equal(isWelcomeId("postmaster-2026-09-26-to-wright-the-washstand-is-welcome", "wright"), false, "a slug that only says welcome");
  assert.equal(isWelcomeId(augie.id, "zeke"), false, "another resident's welcome");
  assert.equal(isWelcomeId(`${augie.id}-again`, "augie-sealight"), false, "an extra suffix");
  assert.equal(isWelcomeId(`re-${augie.id}`, "augie-sealight"), false, "an extra prefix");
  assert.equal(isWelcomeId("ferry-2026-10-16-to-augie-sealight-welcome", "augie-sealight"), false, "another sender's prefix");
  assert.equal(isWelcomeId(undefined, "augie-sealight"), false, "an envelope with no id");
});

test("an envelope counts only from the postmaster, to this resident", () => {
  assert.deepEqual(welcomeIds([augie, { ...augie, from: "ferry" }, { ...augie, to: "zeke" }], "augie-sealight"), [augie.id]);
});

test("a welcome in the inbox with no ledger edge is not delivered", () => {
  assert.equal(welcomeState({ handle: "augie-sealight", inbox: [augie], outbox: [], mailRows: [] }), "No Ferry welcome delivery record");
  assert.equal(welcomeState({ handle: "augie-sealight", inbox: [augie], outbox: [],
    mailRows: ["- 2026-10-16 · postmaster-2026-10-16-to-augie-sealight-welcome · postmaster → zeke · thread: new"] }),
    "No Ferry welcome delivery record", "an edge to somebody else is not this resident's");
});

test("a welcome only in the postmaster's outbox is written, not delivered, in both shapes", () => {
  assert.equal(welcomeState({ handle: "augie-sealight", inbox: [], outbox: [augie], mailRows: [augieRow] }), "Ferry welcome written · delivery pending");
  const zeke = { id: "postmaster-2026-10-15-welcome-zeke", from: "postmaster", to: "zeke" };
  assert.equal(welcomeState({ handle: "zeke", inbox: [], outbox: [zeke], mailRows: [] }), "Ferry welcome written · delivery pending");
});

test("no welcome anywhere is no record", () => {
  const washstand = { id: "postmaster-2026-09-26-to-wright-the-washstand-is-welcome", from: "postmaster", to: "wright" };
  assert.equal(welcomeState({ handle: "wright", inbox: [washstand], outbox: [washstand],
    mailRows: ["- 2026-09-26 · postmaster-2026-09-26-to-wright-the-washstand-is-welcome · postmaster → wright · thread: new"] }),
    "No Ferry welcome delivery record");
});
