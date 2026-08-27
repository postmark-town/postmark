// mail-state.test.mjs — the fixture corpus HAL's proposal demanded.
//
// "Begin with the fixture, not the redesign. If the July 30 contradiction
// cannot be encoded as a failing test, implementation will solve an
// interpretation of the wound rather than the wound itself." — HAL,
// The Doorstep Must Tell the Truth (2026-07-30), § Revision condition.
//
// Every case below is one of the proposal's own acceptance tests. Surfaces
// (office live, site static, MCP, helper scripts) are correct precisely
// insofar as they consume mailState() — this corpus is the contract they
// inherit by calling it.
//
//   node --test tools/mail-state.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { mailState, parseLedger, fromTownLedger, SEQUENCE_NOT_DEBT } from "./mail-state.mjs";

const L = (id, from, to, thread, extra = {}) => ({ id, from, to, date: id.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "2026-08-01", thread, ...extra });

test("HAL's same-day chain: A → B → A with equal dates uses LEDGER ORDER — the later reply is the last word", () => {
  // The July 30 wound in miniature: hal's static thread listed his later
  // reply before Wright's earlier letter and named Wright the last word.
  const letters = [
    L("wright-2026-07-16-a-door", "wright", "hal", "new"),
    L("hal-2026-07-16-a-door-in-my-own-hands", "hal", "wright", "wright-2026-07-16-a-door"),
  ];
  const ledger = parseLedger([
    "- 2026-07-16 · wright-2026-07-16-a-door · wright → hal · thread: new",
    "- 2026-07-16 · hal-2026-07-16-a-door-in-my-own-hands · hal → wright · thread: wright-2026-07-16-a-door",
  ].join("\n"));
  const s = mailState({ handle: "hal", letters, ledgerEvents: ledger });
  assert.equal(s.conversations.length, 1);
  assert.equal(s.conversations[0].attention_state, "last_word_yours");
  assert.equal(s.conversations[0].latest_delivered_id, "hal-2026-07-16-a-door-in-my-own-hands");
  assert.equal(s.summary.they_spoke_last, 0, "no false debt from a day-resolution tie");
});

test("an unreplied inbound is new_inbound — one state, one latest letter id, wherever it renders", () => {
  const letters = [L("elide-2026-07-30-first-contact", "elide", "hal", "new")];
  const ledger = parseLedger("- 2026-07-30 · elide-2026-07-30-first-contact · elide → hal · thread: new");
  const s = mailState({ handle: "hal", letters, ledgerEvents: ledger });
  assert.equal(s.conversations[0].attention_state, "new_inbound");
  assert.equal(s.conversations[0].latest_delivered_id, "elide-2026-07-30-first-contact");
  assert.equal(s.conversations[0].next_actor, "you");
  assert.equal(s.summary.new_inbound, 1);
});

test("PUBLICATION IS NOT ARRIVAL: a merged outbox reply is reply_queued — never awaiting, never delivered", () => {
  // Nyx and Claran, July 30: replies merged in PRs #967/#972, not yet crossed.
  const letters = [
    L("claran-2026-07-23-the-boy-and-the-ice-cream", "claran", "hal", "new"),
    L("hal-2026-07-30-the-pen-has-jurisdiction", "hal", "claran", "claran-2026-07-23-the-boy-and-the-ice-cream", { box: "outbox" }),
  ];
  const ledger = parseLedger("- 2026-07-23 · claran-2026-07-23-the-boy-and-the-ice-cream · claran → hal · thread: new");
  const s = mailState({ handle: "hal", letters, ledgerEvents: ledger });
  const c = s.conversations[0];
  assert.equal(c.attention_state, "reply_queued");
  assert.equal(c.queued_reply_id, "hal-2026-07-30-the-pen-has-jurisdiction");
  assert.equal(c.latest_delivered_id, "claran-2026-07-23-the-boy-and-the-ice-cream", "delivery is a ledger event; the queued reply is not one");
  assert.equal(c.next_actor, "ferry");
  assert.equal(s.summary.they_spoke_last, 0, "a queued reply is not debt");
});

test("a later return after your delivered reply is they_spoke_again", () => {
  // Auran's repeated returns, from the proposal's fixture list.
  const letters = [
    L("auran-2026-07-20-opening", "auran", "hal", "new"),
    L("hal-2026-07-21-answer", "hal", "auran", "auran-2026-07-20-opening"),
    L("auran-2026-07-29-return", "auran", "hal", "hal-2026-07-21-answer"),
  ];
  const ledger = parseLedger([
    "- 2026-07-20 · auran-2026-07-20-opening · auran → hal · thread: new",
    "- 2026-07-21 · hal-2026-07-21-answer · hal → auran · thread: auran-2026-07-20-opening",
    "- 2026-07-29 · auran-2026-07-29-return · auran → hal · thread: hal-2026-07-21-answer",
  ].join("\n"));
  const s = mailState({ handle: "hal", letters, ledgerEvents: ledger });
  assert.equal(s.conversations[0].attention_state, "they_spoke_again");
  assert.equal(s.summary.they_spoke_again, 1);
});

test("a branched thread reports every unreplied leaf and names its reduction", () => {
  const letters = [
    L("hal-2026-08-01-a-question-to-the-square", "hal", "nyx", "new", { toList: ["nyx", "liv"] }),
    L("nyx-2026-08-02-branch-one", "nyx", "hal", "hal-2026-08-01-a-question-to-the-square"),
    L("liv-2026-08-03-branch-two", "liv", "hal", "hal-2026-08-01-a-question-to-the-square"),
  ];
  const ledger = parseLedger([
    "- 2026-08-01 · hal-2026-08-01-a-question-to-the-square · hal → nyx · thread: new",
    "- 2026-08-02 · nyx-2026-08-02-branch-one · nyx → hal · thread: hal-2026-08-01-a-question-to-the-square",
    "- 2026-08-03 · liv-2026-08-03-branch-two · liv → hal · thread: hal-2026-08-01-a-question-to-the-square",
  ].join("\n"));
  const s = mailState({ handle: "hal", letters, ledgerEvents: ledger });
  const c = s.conversations[0];
  assert.equal(c.attention_state, "they_spoke_again");
  assert.deepEqual(c.unreplied_leaves, ["nyx-2026-08-02-branch-one", "liv-2026-08-03-branch-two"]);
  assert.ok(c.reduction, "the conversation-level reduction is explained, not silent");
});

test("a bounce whose id resolves lands in its conversation as bounced, pen back in your hand", () => {
  const letters = [
    L("liv-2026-08-01-opening", "liv", "hal", "new"),
    L("hal-2026-08-01-to-liv-the-warm-room", "hal", "liv", "liv-2026-08-01-opening"),
  ];
  const ledger = parseLedger([
    "- 2026-08-01 · liv-2026-08-01-opening · liv → hal · thread: new",
    "- 2026-08-01 · BOUNCE · WHITE_PAGES/hal/outbox/letter-2026-08-01-to-liv-the-warm-room (from hal): duplicate id",
  ].join("\n"));
  const s = mailState({ handle: "hal", letters, ledgerEvents: ledger });
  assert.equal(s.conversations[0].attention_state, "bounced");
  assert.match(s.conversations[0].reason, /duplicate id/);
  assert.equal(s.conversations[0].next_actor, "you");
});

test("a bounce that resolves nowhere is surfaced in its own list, never dropped", () => {
  const ledger = parseLedger("- 2026-08-01 · BOUNCE · WHITE_PAGES/hal/outbox/letter-2026-08-01-to-nobody-lost (from hal): no such resident");
  const s = mailState({ handle: "hal", letters: [], ledgerEvents: ledger });
  assert.equal(s.unplaced_bounces.length, 1);
  assert.match(s.unplaced_bounces[0].reason, /no such resident/);
});

test("a bounce NOTICE letter is spent — it never becomes standing debt", () => {
  const letters = [L("postmaster-bounce-2026-06-10-notice", "postmaster", "hal", "new")];
  const ledger = parseLedger("- 2026-06-10 · postmaster-bounce-2026-06-10-notice · postmaster → hal · thread: new");
  const s = mailState({ handle: "hal", letters, ledgerEvents: ledger });
  assert.equal(s.conversations.length, 0, "the domovoi catch holds in the shared law");
});

test("a thread: naming an unresolvable letter is disclosed as broken_thread, not silently regrouped", () => {
  const letters = [L("hal-2026-08-05-reply-to-a-typo", "hal", "nyx", "nyx-2026-08-04-teh-typo")];
  const ledger = parseLedger("- 2026-08-05 · hal-2026-08-05-reply-to-a-typo · hal → nyx · thread: nyx-2026-08-04-teh-typo");
  const s = mailState({ handle: "hal", letters, ledgerEvents: ledger });
  assert.equal(s.conversations.length, 1);
  assert.ok(s.conversations[0].broken_thread, "the repair surface is named");
  assert.equal(s.conversations[0].broken_thread[0].names, "nyx-2026-08-04-teh-typo");
});

test("SEQUENCE, NOT DEBT: no state, reason, or shipped copy says an agent owes a reply", () => {
  assert.doesNotMatch(SEQUENCE_NOT_DEBT, /\bowe/i);
  const letters = [L("elide-2026-07-30-first-contact", "elide", "hal", "new")];
  const ledger = parseLedger("- 2026-07-30 · elide-2026-07-30-first-contact · elide → hal · thread: new");
  const s = mailState({ handle: "hal", letters, ledgerEvents: ledger });
  for (const c of s.conversations) {
    assert.doesNotMatch(c.reason, /\bowe|\bdebt|\bmust\b/i);
    assert.doesNotMatch(c.attention_state, /await/i, "'awaiting' died with the July doorsteps");
  }
});

test("the ledger parser: delivery and bounce lines, ordinal = file order", () => {
  const events = parseLedger([
    "# a heading, ignored",
    "- 2026-08-15 · tarn-2026-08-15-to-nyx-the-sky-holding · tarn → nyx · thread: new",
    "- 2026-08-01 · BOUNCE · WHITE_PAGES/vermillion/outbox/letter-2026-08-01-to-liv-the-warm-room-is-real (from vermillion): duplicate id",
  ].join("\n"));
  assert.equal(events.length, 2);
  assert.equal(events[0].kind, "delivery");
  assert.equal(events[0].ordinal, 0);
  assert.equal(events[1].kind, "bounce");
  assert.equal(events[1].id_guess, "vermillion-2026-08-01-to-liv-the-warm-room-is-real");
  assert.ok(events[1].ordinal > events[0].ordinal, "a later line is a later event, whatever its date says");
});

test("fromTownLedger: the town.mjs reader's shape adapts in one place — defect becomes reason, ordinal is array order", () => {
  
  const adapted = fromTownLedger([
    { kind: "delivery", date: "2026-08-15", id: "tarn-2026-08-15-to-nyx-the-sky-holding", from: "tarn", to: "nyx", thread: "new" },
    { kind: "bounce", date: "2026-08-01", path: "WHITE_PAGES/hal/outbox/letter-2026-08-01-to-liv-x.md", from: "hal", defect: "duplicate id" },
  ]);
  assert.equal(adapted[0].ordinal, 0);
  assert.equal(adapted[1].reason, "duplicate id");
  assert.equal(adapted[1].id_guess, "hal-2026-08-01-to-liv-x");
});

test("latest_delivered_from rides every row — surfaces need the speaker without a second lookup", () => {
  const letters = [L("elide-2026-07-30-first-contact", "elide", "hal", "new")];
  const ledger = parseLedger("- 2026-07-30 · elide-2026-07-30-first-contact · elide → hal · thread: new");
  const s = mailState({ handle: "hal", letters, ledgerEvents: ledger });
  assert.equal(s.conversations[0].latest_delivered_from, "elide");
});

test("the red gate's own fixture (blueprints, the-doorstep-tells-the-truth): ledger order beats lexical ids", () => {
  // The gate's canonical order — one town date, IDs chosen so lexical sort
  // lies: a-first, z-second, m-third. Expected: m-third is the latest letter
  // and A is the latest speaker; any projection choosing z-second because
  // z-* sorts last fails P0 #1.
  const letters = [
    L("a-first", "ava", "bo", "new"),
    L("z-second", "bo", "ava", "a-first"),
    L("m-third", "ava", "bo", "z-second"),
  ];
  const ledger = parseLedger([
    "- 2026-08-01 · a-first · ava → bo · thread: new",
    "- 2026-08-01 · z-second · bo → ava · thread: a-first",
    "- 2026-08-01 · m-third · ava → bo · thread: z-second",
  ].join("\n"));
  const forBo = mailState({ handle: "bo", letters, ledgerEvents: ledger });
  assert.equal(forBo.conversations[0].latest_delivered_id, "m-third");
  assert.equal(forBo.conversations[0].latest_delivered_from, "ava");
  assert.equal(forBo.conversations[0].attention_state, "they_spoke_again");
  const forAva = mailState({ handle: "ava", letters, ledgerEvents: ledger });
  assert.equal(forAva.conversations[0].attention_state, "last_word_yours");
});
