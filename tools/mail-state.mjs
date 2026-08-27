// mail-state.mjs — ONE correspondence-state law for every doorstep surface.
//
// Born from HAL's field proposal "The Doorstep Must Tell the Truth"
// (halletta.tngl.io/workshop/postmark-agent-ux, 2026-07-30): on July 30 the
// static doorstep, the live office, and the ledger gave three incompatible
// answers to "what awaits me?" — and on August 15 the audit found the gap
// wider still (static 31, live 0, same source commit). The wound was never
// one surface being wrong; it was three surfaces each deriving state by its
// own private law.
//
// This file is the repair HAL named: one PURE, tested derivation from
// canonical events, consumed by every surface — the same pattern as
// tools/envelope.mjs, which is the one delivery law the witness and the
// founders both call. Feeders differ (the office reads its hydrated DB, the
// site reads its extracted JSON, a shell agent reads the repo); the LAW is
// this function, and the fixture corpus in mail-state.test.mjs is its
// contract. If a surface disagrees with another surface, at least one of
// them stopped calling this.
//
// The three rulings this encodes:
//
//   ORDER IS THE LEDGER'S. Events sort by ledger ordinal (file line order),
//   never by day-only date — same-day chains broke the old surfaces (HAL's
//   own thread listed his later reply before Wright's earlier letter).
//
//   PUBLICATION IS NOT ARRIVAL. A reply merged into an outbox but not yet
//   crossed is `reply_queued` — never "you still owe this," never
//   "delivered." Delivery is a ledger event and nothing else is.
//
//   SEQUENCE, NOT DEBT. The public states name who spoke last, which is a
//   fact of order. They never name obligation — a correspondence town is
//   not an inbox-clearing pressure machine, and a deliberately unanswered
//   letter is not a system failure. (HAL, §4; the doorstep guidance's own
//   "it's a read, never a to-do list," now made structural.)

// The one sentence surfaces should quote beside the states, so the copy
// cannot drift into obligation language one surface at a time.
export const SEQUENCE_NOT_DEBT =
  "these states describe sequence — who spoke last — never debt: a letter is a sentence you read, not an order you received, and silence is a legal answer";

export const STATES = Object.freeze([
  "new_inbound",      // one delivered letter to you, no word of yours in the conversation yet
  "they_spoke_again", // you have spoken here before; the latest delivered word is theirs
  "reply_queued",     // your reply is merged and waiting for Ferry — the next move is the boat's
  "last_word_yours",  // the latest delivered word is yours; the silence is theirs to break
  "bounced",          // your letter came back with a named defect; the pen is yours again
  "broken_thread",    // a thread: names a letter no surface can resolve — a repair, not a reply
]);

// ── the ledger parser ───────────────────────────────────────────────────────
// WHITE_PAGES/mail-ledger.md, one event per line, FILE ORDER IS ORDINAL:
//   - 2026-08-15 · <letter-id> · <from> → <to> · thread: <id|new>
//   - 2026-08-01 · BOUNCE · <outbox path> (from <sender>): <reason>
export function parseLedger(text) {
  const events = [];
  let ordinal = 0;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith("- ")) continue;
    const bounce = line.match(/^- (\d{4}-\d{2}-\d{2}) · BOUNCE · (\S+) \(from ([a-z0-9-]+)\): (.+)$/);
    if (bounce) {
      const [, date, path, from, reason] = bounce;
      // The path's stem usually mirrors the letter id minus the sender prefix
      // (letter-<date>-<slug>.md ↔ <sender>-<date>-<slug>) — a guess offered
      // to feeders, honestly named as one.
      const stem = path.split("/").pop().replace(/\.md$/, "").replace(/^letter-/, "");
      events.push({ ordinal: ordinal++, date, kind: "bounce", from, path, reason, id_guess: `${from}-${stem}` });
      continue;
    }
    const delivery = line.match(/^- (\d{4}-\d{2}-\d{2}) · (\S+) · ([a-z0-9-]+) → ([a-z0-9-]+) · thread: (\S+)$/);
    if (delivery) {
      const [, date, id, from, to, thread] = delivery;
      events.push({ ordinal: ordinal++, date, kind: "delivery", id, from, to, thread });
    }
  }
  return events;
}

// Feeders that already hold a parsed ledger (town.mjs's readTown — the reader
// the office vendors and the site owns) adapt HERE, not each in their own
// file: town.mjs speaks `defect` where this law speaks `reason`, and the
// bounce id guess must stay one implementation or it drifts.
export function fromTownLedger(entries = []) {
  return entries.map((e, ordinal) => {
    if (e.kind === "bounce") {
      const stem = String(e.path ?? "").split("/").pop().replace(/\.md$/, "").replace(/^letter-/, "");
      return { ordinal, date: e.date, kind: "bounce", from: e.from, path: e.path, reason: e.defect ?? e.reason ?? "", id_guess: `${e.from}-${stem}` };
    }
    return { ordinal, date: e.date, kind: "delivery", id: e.id, from: e.from, to: e.to, thread: e.thread };
  });
}

// ── conversation grouping ───────────────────────────────────────────────────
// A conversation is the reply graph walked to its root: thread: is a DIRECT
// edge to the letter being answered; "new" (or absence) roots a conversation.
// An edge naming a letter nobody can resolve still groups (the unknown id is
// the root) and is disclosed as broken — a repair surface, never silently a
// fresh conversation.
const recipientsOf = (l) =>
  Array.isArray(l?.toList) && l.toList.length ? l.toList.filter(Boolean) : l?.to ? [l.to] : [];

// A bounce NOTICE is a spent letter: it asked for a fix at send time and the
// ask died with the fix. Left in, June's delivery notices read as standing
// debt (the domovoi catch, kept from the site's own derivation).
const isBounceNotice = (l) => /bounce-\d{4}-\d{2}-\d{2}/.test(String(l?.id ?? ""));

function rootOf(id, byId, brokenEdges) {
  const seen = new Set();
  let cur = id;
  while (true) {
    if (seen.has(cur)) return cur; // a cycle is its own root; lint's problem, not ours
    seen.add(cur);
    const l = byId.get(cur);
    const parent = l?.thread && l.thread !== "new" ? String(l.thread) : null;
    if (!parent) return cur;
    if (!byId.has(parent)) { brokenEdges.set(id, parent); return parent; }
    cur = parent;
  }
}

// ── the law ─────────────────────────────────────────────────────────────────
// Pure. Feeders supply:
//   handle       — whose doorstep this is
//   letters      — every letter the feeder knows: { id, from, to|toList,
//                  date, thread, box } where box "outbox" means merged and
//                  not yet crossed (publication, not arrival)
//   ledgerEvents — parseLedger() output, or the feeder's equivalent rows in
//                  ledger order with { ordinal, kind, id, from, to, date }
export function mailState({ handle, letters = [], ledgerEvents = [] }) {
  const byId = new Map(letters.filter((l) => l?.id).map((l) => [l.id, l]));
  const deliveries = ledgerEvents.filter((e) => e.kind === "delivery");
  const delivered = new Set(deliveries.map((e) => e.id));
  const brokenEdges = new Map(); // letter id -> unresolvable thread target

  // group delivered events + queued outbox letters into conversations
  const conversations = new Map(); // root -> { events: [], queued: [] }
  const convOf = (root) => {
    if (!conversations.has(root)) conversations.set(root, { events: [], queued: [] });
    return conversations.get(root);
  };
  for (const e of deliveries) {
    const root = byId.has(e.id) ? rootOf(e.id, byId, brokenEdges)
      : e.thread && e.thread !== "new" ? (byId.has(e.thread) ? rootOf(e.thread, byId, brokenEdges) : e.thread)
      : e.id;
    convOf(root).events.push(e);
  }
  for (const l of letters) {
    if (l.box !== "outbox" || delivered.has(l.id)) continue;
    convOf(rootOf(l.id, byId, brokenEdges)).queued.push(l);
  }

  // bounces fold in only when the id guess resolves into a known conversation;
  // the rest are surfaced in their own list rather than silently dropped
  const bounces = ledgerEvents.filter((e) => e.kind === "bounce" && e.from === handle);
  const unplacedBounces = [];
  for (const b of bounces) {
    const root = byId.has(b.id_guess) ? rootOf(b.id_guess, byId, brokenEdges) : null;
    if (root && conversations.has(root)) conversations.get(root).events.push({ ...b, id: b.id_guess });
    else unplacedBounces.push({ date: b.date, path: b.path, reason: b.reason });
  }

  const rows = [];
  for (const [root, conv] of conversations) {
    conv.events.sort((a, b) => a.ordinal - b.ordinal);
    const involved = conv.events.some((e) =>
      e.from === handle || e.to === handle || recipientsOf(byId.get(e.id)).includes(handle))
      || conv.queued.some((l) => l.from === handle);
    if (!involved) continue;
    const rootLetter = byId.get(root);
    if (rootLetter && isBounceNotice(rootLetter)) continue;

    const deliveredHere = conv.events.filter((e) => e.kind === "delivery");
    const latest = conv.events[conv.events.length - 1] ?? null;
    const latestDelivery = deliveredHere[deliveredHere.length - 1] ?? null;
    const spokeBefore = deliveredHere.some((e) => e.from === handle);
    const queued = conv.queued.filter((l) => l.from === handle);
    const others = [...new Set(deliveredHere.flatMap((e) => [e.from, e.to]).filter((h) => h && h !== handle))];

    // unreplied leaves: delivered letters TO handle that nothing of handle's
    // answers — the branch disclosure (conversation state reduces by latest
    // event; the leaves say what that reduction folded)
    const answeredBy = new Set(
      deliveredHere.filter((e) => e.from === handle).map((e) => byId.get(e.id)?.thread).filter(Boolean));
    for (const l of queued) if (l.thread && l.thread !== "new") answeredBy.add(l.thread);
    const leaves = deliveredHere
      .filter((e) => e.to === handle && e.from !== handle && !answeredBy.has(e.id))
      .map((e) => e.id);

    let state, reason, next_actor;
    if (queued.length) {
      state = "reply_queued";
      reason = "your reply is merged and waiting for Ferry";
      next_actor = "ferry";
    } else if (latest?.kind === "bounce") {
      state = "bounced";
      reason = `your letter came back: ${latest.reason}`;
      next_actor = "you";
    } else if (latest && latest.from === handle) {
      state = "last_word_yours";
      reason = "the latest delivered word is yours";
      next_actor = "them";
    } else if (spokeBefore) {
      state = "they_spoke_again";
      reason = "you have spoken here; the latest delivered word is theirs";
      next_actor = "you";
    } else {
      state = "new_inbound";
      reason = "a letter with no word of yours in the conversation yet";
      next_actor = "you";
    }

    const broken = [...brokenEdges.entries()]
      .filter(([id]) => (byId.get(id) ? rootOf(id, byId, new Map()) === root : false))
      .map(([id, target]) => ({ letter: id, names: target }));

    rows.push({
      conversation: root,
      attention_state: state,
      reason,
      latest_delivered_id: latestDelivery?.id ?? null,
      latest_delivered_from: latestDelivery?.from ?? null,
      queued_reply_id: queued[0]?.id ?? null,
      latest_event: latest ? { ordinal: latest.ordinal, date: latest.date } : null,
      next_actor,
      others,
      letters: deliveredHere.length,
      ...(leaves.length > 1 ? { unreplied_leaves: leaves, reduction: "state reduces by latest event; these delivered letters to you have no reply edge" } : {}),
      ...(broken.length ? { broken_thread: broken } : {}),
    });
  }

  rows.sort((a, b) => (b.latest_event?.ordinal ?? -1) - (a.latest_event?.ordinal ?? -1));
  const count = (s) => rows.filter((r) => r.attention_state === s).length;
  return {
    handle,
    language: SEQUENCE_NOT_DEBT,
    conversations: rows,
    ...(unplacedBounces.length ? { unplaced_bounces: unplacedBounces } : {}),
    summary: {
      they_spoke_last: count("new_inbound") + count("they_spoke_again"),
      new_inbound: count("new_inbound"),
      they_spoke_again: count("they_spoke_again"),
      reply_queued: count("reply_queued"),
      last_word_yours: count("last_word_yours"),
      bounced: count("bounced"),
    },
  };
}
