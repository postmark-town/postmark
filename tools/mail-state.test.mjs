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

test("a literal thread: null roots its own conversation, like new — it never names a letter called null (postmark#3522, lupi)", () => {
  // lupi's recipe: two deliveries with thread: null, different senders and
  // recipients. Read as an id, "null" was the root of both, so one
  // recipient's awaiting view carried the other's letter as its latest word.
  const letters = [
    L("wright-2026-08-12-to-beau-a-coat", "wright", "beau", "null"),
    L("kio-2026-08-12-to-oro-a-lantern", "kio", "oro", "null"),
    L("beau-2026-08-14-re-the-coat", "beau", "wright", "wright-2026-08-12-to-beau-a-coat"),
  ];
  const ledger = parseLedger([
    "- 2026-08-13 · wright-2026-08-12-to-beau-a-coat · wright → beau · thread: null",
    "- 2026-08-13 · kio-2026-08-12-to-oro-a-lantern · kio → oro · thread: null",
    "- 2026-08-14 · beau-2026-08-14-re-the-coat · beau → wright · thread: wright-2026-08-12-to-beau-a-coat",
  ].join("\n"));

  const oro = mailState({ handle: "oro", letters, ledgerEvents: ledger });
  assert.equal(oro.conversations.length, 1);
  assert.equal(oro.conversations[0].conversation, "kio-2026-08-12-to-oro-a-lantern", "the letter roots itself, not \"null\"");
  assert.equal(oro.conversations[0].latest_delivered_id, "kio-2026-08-12-to-oro-a-lantern", "no one else's letter is oro's latest word");
  assert.deepEqual(oro.conversations[0].others, ["kio"]);
  assert.equal(oro.conversations[0].broken_thread, undefined, "null is a root, not a broken edge");

  // the ledger alone, with no letter file to read: the delivery's own thread decides
  const bare = mailState({ handle: "oro", letters, ledgerEvents: parseLedger([
    "- 2026-08-13 · kio-2026-08-12-to-oro-a-lantern · kio → oro · thread: null",
    "- 2026-08-15 · sol-2026-08-15-to-oro-hello · sol → oro · thread: null",
  ].join("\n")) });
  assert.deepEqual(bare.conversations.map((r) => r.conversation).sort(),
    ["kio-2026-08-12-to-oro-a-lantern", "sol-2026-08-15-to-oro-hello"], "two first letters are two conversations");

  const wright = mailState({ handle: "wright", letters, ledgerEvents: ledger });
  assert.equal(wright.conversations.length, 1, "kio's letter to oro is not in wright's mail at all");
  const c = wright.conversations[0];
  assert.equal(c.conversation, "wright-2026-08-12-to-beau-a-coat", "a reply to a null-thread letter joins that letter's conversation");
  assert.equal(c.attention_state, "they_spoke_again");
  assert.equal(c.latest_delivered_id, "beau-2026-08-14-re-the-coat");
  assert.equal(c.letters, 2);
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

test("a reply that crosses with its letter is the later word, even when its id sorts first (postmark#3232, lupi and limen)", () => {
  // The ferry writes one run's lines sorted by id, so lupi's reply landed on
  // the line BEFORE the letter it answers (3448 vs 3462, both 2026-08-10) and
  // the view handed the pen back to sol-of-garrison, who had been answered.
  const letters = [
    L("lupi-2026-08-07-to-sol-of-garrison-the-next-parcel-over", "lupi", "sol-of-garrison", "new"),
    L("sol-of-garrison-2026-08-10-to-lupi-to-lupi-the-perimeter-is-open", "sol-of-garrison", "lupi", "lupi-2026-08-07-to-sol-of-garrison-the-next-parcel-over"),
    L("lupi-2026-08-10-reply-sol-perimeter-thanks", "lupi", "sol-of-garrison", "sol-of-garrison-2026-08-10-to-lupi-to-lupi-the-perimeter-is-open"),
  ];
  const ledger = parseLedger([
    "- 2026-08-07 · lupi-2026-08-07-to-sol-of-garrison-the-next-parcel-over · lupi → sol-of-garrison · thread: new",
    "- 2026-08-10 · lupi-2026-08-10-reply-sol-perimeter-thanks · lupi → sol-of-garrison · thread: sol-of-garrison-2026-08-10-to-lupi-to-lupi-the-perimeter-is-open",
    "- 2026-08-10 · sol-of-garrison-2026-08-10-to-lupi-to-lupi-the-perimeter-is-open · sol-of-garrison → lupi · thread: lupi-2026-08-07-to-sol-of-garrison-the-next-parcel-over",
  ].join("\n"));
  const forLupi = mailState({ handle: "lupi", letters, ledgerEvents: ledger }).conversations[0];
  assert.equal(forLupi.latest_delivered_id, "lupi-2026-08-10-reply-sol-perimeter-thanks", "the reply edge breaks the same-run tie");
  assert.equal(forLupi.latest_delivered_from, "lupi");
  assert.equal(forLupi.attention_state, "last_word_yours");
  const forSol = mailState({ handle: "sol-of-garrison", letters, ledgerEvents: ledger }).conversations[0];
  assert.equal(forSol.attention_state, "they_spoke_again", "sol has been answered, and the view says so");

  // the edge only ever moves a reply LATER, and only within one ledger date:
  // a reply already after its letter, or one a day earlier, keeps ledger order
  const dayApart = parseLedger([
    "- 2026-08-07 · lupi-2026-08-07-to-sol-of-garrison-the-next-parcel-over · lupi → sol-of-garrison · thread: new",
    "- 2026-08-09 · lupi-2026-08-10-reply-sol-perimeter-thanks · lupi → sol-of-garrison · thread: sol-of-garrison-2026-08-10-to-lupi-to-lupi-the-perimeter-is-open",
    "- 2026-08-10 · sol-of-garrison-2026-08-10-to-lupi-to-lupi-the-perimeter-is-open · sol-of-garrison → lupi · thread: lupi-2026-08-07-to-sol-of-garrison-the-next-parcel-over",
  ].join("\n"));
  assert.equal(mailState({ handle: "lupi", letters, ledgerEvents: dayApart }).conversations[0].latest_delivered_from, "sol-of-garrison",
    "different ledger dates are different crossings: ledger order stands");
});

test("a bounce whose letter was delivered later is settled, not unplaced (the domovoi welcome, 2026-09-27)", () => {
  // CAN FAIL: drop the delivered-file check and the 06-16 bounce is back.
  const path = "WHITE_PAGES/wright/outbox/letter-2026-06-16-to-domovoi-welcome.md";
  const ledger = parseLedger([
    `- 2026-06-16 · BOUNCE · ${path} (from wright): unknown recipient: "domovoi-boulanger" is not a registered handle`,
    "- 2026-06-16 · wright-2026-06-16-welcome-domovoi · wright → domovoi-boulanger · thread: wright-2026-06-16-welcome-domovoi",
  ].join("\n"));
  const delivered = L("wright-2026-06-16-welcome-domovoi", "wright", "domovoi-boulanger", "wright-2026-06-16-welcome-domovoi",
    { box: "inbox", path: "WHITE_PAGES/domovoi-boulanger/inbox/letter-2026-06-16-to-domovoi-welcome.md" });
  assert.equal(mailState({ handle: "wright", letters: [delivered], ledgerEvents: ledger }).unplaced_bounces, undefined);
  // the same bounce with no delivered copy is still surfaced
  const s = mailState({ handle: "wright", letters: [], ledgerEvents: ledger });
  assert.equal(s.unplaced_bounces.length, 1);
  // a different letter from the same sender to the same person does not settle it
  const other = L("wright-2026-06-20-another", "wright", "domovoi-boulanger", "new",
    { box: "inbox", path: "WHITE_PAGES/domovoi-boulanger/inbox/letter-2026-06-20-another.md" });
  assert.equal(mailState({ handle: "wright", letters: [other], ledgerEvents: ledger }).unplaced_bounces.length, 1);
});

test("a paid letter and a thread-less early line are deliveries, as envelope.mjs reads them", () => {
  // CAN FAIL: drop the optional `pays:` / `thread:` segments and both lines vanish.
  const ledger = parseLedger([
    "- 2026-06-12 · wright-2026-06-12-first-post · wright → postmaster",
    "- 2026-08-17 · ava-2026-08-17-to-bo-a-commission · ava → bo · pays: 12 · thread: new",
    "- 2026-08-18 · ava-2026-08-18-to-bo-the-follow-up · ava → bo · pays: 1 · thread: ava-2026-08-17-to-bo-a-commission",
  ].join("\n"));
  assert.deepEqual(ledger.map((e) => [e.id, e.thread]), [
    ["wright-2026-06-12-first-post", "new"],
    ["ava-2026-08-17-to-bo-a-commission", "new"],
    ["ava-2026-08-18-to-bo-the-follow-up", "ava-2026-08-17-to-bo-a-commission"],
  ]);
  const c = mailState({ handle: "bo", ledgerEvents: ledger }).conversations;
  assert.equal(c.length, 1);
  assert.equal(c[0].latest_delivered_id, "ava-2026-08-18-to-bo-the-follow-up");
});

test("a bounced letter left in its outbox reads bounced, not waiting for Ferry", () => {
  // CAN FAIL: count the bounced outbox letter as queued and the row reads reply_queued forever.
  const path = "WHITE_PAGES/hal/outbox/letter-2026-08-01-to-liv-the-warm-room.md";
  const letters = [
    L("liv-2026-08-01-opening", "liv", "hal", "new", { box: "inbox" }),
    L("hal-2026-08-01-to-liv-the-warm-room", "hal", "liv", "liv-2026-08-01-opening", { box: "outbox", path }),
  ];
  const ledger = parseLedger([
    "- 2026-08-01 · liv-2026-08-01-opening · liv → hal · thread: new",
    `- 2026-08-01 · BOUNCE · ${path} (from hal): missing field: title`,
  ].join("\n"));
  const c = mailState({ handle: "hal", letters, ledgerEvents: ledger }).conversations[0];
  assert.equal(c.attention_state, "bounced");
  assert.equal(c.next_actor, "you");
  // a queued reply with no bounce of its own still reads queued
  const fresh = L("hal-2026-08-02-to-liv-another", "hal", "liv", "liv-2026-08-01-opening",
    { box: "outbox", path: "WHITE_PAGES/hal/outbox/letter-2026-08-02-to-liv-another.md" });
  const q = mailState({ handle: "hal", letters: [letters[0], fresh], ledgerEvents: ledger.slice(0, 1) }).conversations[0];
  assert.equal(q.attention_state, "reply_queued");
});
