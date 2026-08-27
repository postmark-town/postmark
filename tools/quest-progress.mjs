#!/usr/bin/env node
// quest-progress.mjs — the quest board's progress fold + the repo-side snapshot.
// Quest gold Phase 2 (display layer; ZERO mint change).
//
// The two v1 quests (`correspond-send` / `correspond-receive`) surface the
// EXISTING correspondence mint with two visible faces. So progress is not a new
// rule — it IS the mint: today's per-resident distinct-valid-correspondent count
// per direction. We get it by REUSING stamp-mint's `deriveMints` wholesale (it
// already applies non-self, non-meep, unique-correspondent-per-day dedup, and the
// per-household daily cap) and counting today's mints by side. There is no second
// copy of the validity/dedup/cap rule here — that was the hard requirement.
//
//   node tools/quest-progress.mjs --snapshot [--repo PATH]   # write TOWN_BULLETIN/quests.md
//   node tools/quest-progress.mjs --progress <handle> [--repo PATH]  # print a board (debug)

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseDeliveries, householdKeys, parseStampLedger, parseLaws, deriveMints, meepChecker,
  foldPairFriendships,
} from './stamp-mint.mjs';

// "today" = the mint rule's day boundary (TOWN_TZ), never the server clock —
// identical to the expression ferry.mjs / ballot-pass.mjs date mints with.
export function townDay(date) {
  return date ?? new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.TOWN_TZ ?? 'America/New_York',
  }).format(new Date());
}

export function loadRegistry(repo) {
  const p = join(repo, 'quest-registry.json');
  return JSON.parse(readFileSync(p, 'utf8'));
}

// Per-handle today's progress, folded straight off deriveMints. Returns a Map
// handle -> { send, receive, household: { key, size, send, receive } }.
export function foldQuestProgress(repo, { today = townDay() } = {}) {
  const deliveries = parseDeliveries(repo);
  const households = householdKeys(repo);
  const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  const entries = existsSync(ledgerPath) ? parseStampLedger(readFileSync(ledgerPath, 'utf8')) : [];
  const { laws, revisions } = parseLaws(entries);
  const mints = deriveMints(deliveries, households, { laws, revisions });

  // household sizes off the current registry (handles sharing a key). Count only
  // NON-meep handles — meeps mint nothing, so they don't share the daily cap, and
  // the cap-shared footnote should name only the residents who actually compete
  // for it. "today" uses the current household by construction (the base map IS
  // the latest state).
  const isMeep = meepChecker(laws);
  const sizeByKey = new Map();
  for (const [handle, rec] of households) {
    if (isMeep(handle, today)) continue;
    sizeByKey.set(rec.key, (sizeByKey.get(rec.key) ?? 0) + 1);
  }
  const keyOf = (handle) => households.get(handle)?.key ?? `solo:${handle}`;

  const perHandle = new Map();
  const perHouse = new Map(); // key -> { send, receive }
  for (const m of mints) {
    if (m.date !== today) continue;
    const ph = perHandle.get(m.handle) ?? { send: 0, receive: 0, sentTo: [], heardFrom: [] };
    ph[m.side === 'sent' ? 'send' : 'receive']++;
    // who this unit was earned with — the quest card shows these so a resident
    // can see who already counted today and who would be a new one. Order is
    // delivery order (deterministic); one entry per mint, so it cannot repeat.
    (m.side === 'sent' ? ph.sentTo : ph.heardFrom).push(m.other);
    perHandle.set(m.handle, ph);
    const key = keyOf(m.handle);
    const hh = perHouse.get(key) ?? { send: 0, receive: 0 };
    hh[m.side === 'sent' ? 'send' : 'receive']++;
    perHouse.set(key, hh);
  }

  // Emit a row for EVERY handle the resolver knows, not only today's active ones
  // (#1458): the house columns must reach a member who minted nothing today —
  // otherwise the consumer's clean-zero default reads them as a solo house while
  // an active housemate reads "house of 4, 5 today". A handle truly unknown to
  // the resolver still falls to boardForHandle's solo-zero default, where solo
  // is true.
  const out = new Map();
  for (const handle of new Set([...households.keys(), ...perHandle.keys()])) {
    const ph = perHandle.get(handle) ?? { send: 0, receive: 0, sentTo: [], heardFrom: [] };
    const key = keyOf(handle);
    out.set(handle, {
      send: ph.send,
      receive: ph.receive,
      sentTo: ph.sentTo,
      heardFrom: ph.heardFrom,
      household: { key, size: sizeByKey.get(key) ?? 1, ...(perHouse.get(key) ?? { send: 0, receive: 0 }) },
    });
  }
  return out;
}

// The milestone fold (quest gold, budding-friendship). The pair page and the
// board snapshot read this; the resident cards do NOT (decision 7 — the milestone
// displays on mail/with/[pair], not as a personal quest card). Per pair {a,b}
// (a<b): post-law-date directional counts and, per rung, whether it minted (the
// achieved mark = a qualified crossing exists), with the crossing date + letter.
// `qualifies` is "could this pair ever mint, as of now" (cross-household + both
// non-meep) — the pair page shows the block only when true, so a meep or same-
// roof pair never sees a progress bar toward an award it cannot earn. Inactive
// (no stamps-v3 law sealed yet) → { active: false, pairs: [] }, so the site
// degrades to no block and the snapshot omits the section until the law lands.
export function foldFriendships(repo) {
  const deliveries = parseDeliveries(repo);
  const households = householdKeys(repo);
  const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  const entries = existsSync(ledgerPath) ? parseStampLedger(readFileSync(ledgerPath, 'utf8')) : [];
  const { laws, revisions } = parseLaws(entries);
  const { active, startDate, ladder, pairs } = foldPairFriendships(deliveries, households, { laws, revisions });
  if (!active) return { active: false, startDate: null, ladder: [], pairs: [] };
  const isMeep = meepChecker(laws);
  const today = townDay();
  const keyNow = (handle) => households.get(handle)?.key ?? `solo:${handle}`;
  const out = [];
  for (const st of pairs.values()) {
    const crossingBy = new Map(st.crossings.map((c) => [c.threshold, c]));
    const rungs = ladder.map((r) => {
      const c = crossingBy.get(r.threshold);
      const achieved = !!(c && c.qualified);
      return {
        threshold: r.threshold, reward: r.reward, achieved,
        date: achieved ? c.date : null, via: achieved ? c.viaId : null,
      };
    });
    const qualifies = !isMeep(st.a, today) && !isMeep(st.b, today) && keyNow(st.a) !== keyNow(st.b);
    out.push({ a: st.a, b: st.b, fwd: st.fwd, rev: st.rev, eachWay: Math.min(st.fwd, st.rev), qualifies, rungs });
  }
  out.sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
  return { active: true, startDate, ladder, pairs: out };
}

// The board for ONE handle: registry × this handle's progress. The shape the
// office API returns and the resident page renders. A handle with no activity
// today reads a clean zero (absent from the fold == 0, first-class). PURE join
// over a progress entry — no repo/ledger read — so the office can call it against
// its hydrated snapshot with the same code the repo-side path uses (one join, no
// drift). `prog` is a foldQuestProgress entry or null/undefined (→ clean zero).
export function boardForHandle(registry, prog, handle, today) {
  const p = prog ?? { send: 0, receive: 0, sentTo: [], heardFrom: [], household: { key: `solo:${handle}`, size: 1, send: 0, receive: 0 } };
  const field = { 'correspond-send': 'send', 'correspond-receive': 'receive' };
  // which correspondents already counted today, per direction. Tolerates an
  // older hydrated snapshot that predates the field (→ empty, never undefined).
  const withField = { 'correspond-send': 'sentTo', 'correspond-receive': 'heardFrom' };
  // Milestone quests (the budding-friendship pair achievement) render on the pair
  // page, NEVER as a personal quest card (decision 7). The resident board is the
  // daily quests only — an ALLOW-LIST, not a deny-list. It was written as
  // `!== 'milestone'` when daily and milestone were the only two cadences, and
  // the one-time onboarding rows (2026-08-21) would have poured straight through
  // that hole onto every quest card as "0/undefined" bars. The allow-list also
  // keeps bounty postings (the funding seam's keeping pots) off personal cards —
  // a pot is a thing the town backs together, not a personal bar to fill.
  const quests = registry.quests.filter((q) => q.cadence === 'daily').map((q) => {
    const f = field[q.id];
    const done = f ? p[f] : 0;
    const houseTotal = f ? p.household[f] : 0;
    // the household ceiling only "bites" when it's shared AND at the cap — a solo
    // resident never sees it (decision 7).
    const capShared = p.household.size > 1 && houseTotal >= q.target;
    return {
      id: q.id, title: q.title, cadence: q.cadence, validation: q.validation,
      target: q.target, reward: q.reward, source: q.source,
      progress: done, complete: done >= q.target,
      counted: (p[withField[q.id]] ?? []).slice(),
      household: { size: p.household.size, total: houseTotal, cap_shared: capShared },
    };
  });
  return { handle, today, quests };
}

// Repo-side convenience: fold the whole town, then join for one handle.
export function questBoard(repo, handle, { today = townDay(), registry = loadRegistry(repo), progress } = {}) {
  const prog = (progress ?? foldQuestProgress(repo, { today })).get(handle);
  return boardForHandle(registry, prog, handle, today);
}

// The leaderboard fold (Keemin's ruling — the crossing-commit history doubles as
// the town's quest archive). Reuses deriveMints over ALL history: today's per-
// resident progress plus all-time completions (a completion = a resident hit a
// quest's target on a given day — days-target-hit fall straight out of the same
// fold that mints). Meeps never appear (deriveMints mints them nothing).
// DETERMINISTIC: sorted by completions-today, then progress-today, then handle
// (a stable tiebreak) — no clock beyond the ledger day, so identical ledger state
// renders identical bytes and a mail-less crossing commits nothing.
export function foldLeaderboard(repo, { today = townDay(), registry = loadRegistry(repo) } = {}) {
  const deliveries = parseDeliveries(repo);
  const households = householdKeys(repo);
  const ledgerPath = join(repo, 'WHITE_PAGES', 'stamp-ledger.md');
  const entries = existsSync(ledgerPath) ? parseStampLedger(readFileSync(ledgerPath, 'utf8')) : [];
  const { laws, revisions } = parseLaws(entries);
  const mints = deriveMints(deliveries, households, { laws, revisions });

  const tgt = (side) => registry.quests.find((q) => q.id === (side === 'sent' ? 'correspond-send' : 'correspond-receive'))?.target ?? 5;

  // per (handle, side, date) mint count, then reduce per handle
  const counts = new Map(); // `${handle}|${side}|${date}` -> n
  for (const m of mints) {
    const k = `${m.handle}|${m.side}|${m.date}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const stat = new Map(); // handle -> { todaySend, todayReceive, allTime }
  for (const [k, n] of counts) {
    const [handle, side, date] = k.split('|');
    const s = stat.get(handle) ?? { todaySend: 0, todayReceive: 0, allTime: 0 };
    if (date === today) { if (side === 'sent') s.todaySend = n; else s.todayReceive = n; }
    if (n >= tgt(side)) s.allTime += 1; // a quest completed that day (all-time tally)
    stat.set(handle, s);
  }
  const rows = [];
  for (const [handle, s] of stat) {
    const progressToday = s.todaySend + s.todayReceive;
    if (progressToday === 0) continue; // nonzero-progress rows only
    const completionsToday = (s.todaySend >= tgt('sent') ? 1 : 0) + (s.todayReceive >= tgt('received') ? 1 : 0);
    rows.push({ handle, todaySend: s.todaySend, todayReceive: s.todayReceive, progressToday, completionsToday, allTime: s.allTime });
  }
  rows.sort((a, b) => b.completionsToday - a.completionsToday || b.progressToday - a.progressToday || a.handle.localeCompare(b.handle));
  return { today, rows, totalCompletionsToday: rows.reduce((n, r) => n + r.completionsToday, 0), sendTgt: tgt('sent'), recvTgt: tgt('received') };
}

// The repo-side snapshot: the town's quest LEADERBOARD (Keemin's ruling). Rows
// are today's questers, biggest first, with an all-time-completions standing
// column; the rules stay thin and point at STAMPS.md. Plain markdown + frontmatter
// so read_bulletin serves it through the doors for free. Deterministic bytes —
// the crossing commits it, and the history is the archive.
export function renderSnapshot(repo, { today = townDay(), registry = loadRegistry(repo) } = {}) {
  const { rows, totalCompletionsToday, sendTgt, recvTgt } = foldLeaderboard(repo, { today, registry });
  const cell = (v, t) => (v >= t ? `${v}/${t} ✓` : `${v}/${t}`);

  // Budding friendships (the milestone). Omitted entirely until the stamps-v3
  // law is sealed, so the snapshot bytes are unchanged until the rule goes live.
  // Once live: every achieved rung, biggest each-way reach first, deterministic.
  const friendships = foldFriendships(repo);
  const friendshipBlock = (() => {
    if (!friendships.active) return '';
    const achieved = [];
    for (const p of friendships.pairs) {
      for (const r of p.rungs) {
        if (r.achieved) achieved.push({ a: p.a, b: p.b, threshold: r.threshold, reward: r.reward, date: r.date });
      }
    }
    achieved.sort((x, y) => y.threshold - x.threshold || x.date.localeCompare(y.date) || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
    const rungWords = friendships.ladder.map((r) => `${r.threshold} each way mints ${r.reward} to each`).join('; ');
    const table = achieved.length
      ? ['| pair | reached | minted each | when |', '|---|---|---|---|',
         ...achieved.map((c) => `| ${c.a} & ${c.b} | ${c.threshold} letters each way | ${c.reward} | ${c.date} |`)].join('\n')
      : '_No budding friendship has crossed a rung yet._';
    return `## Budding friendships

A correspondence that *continued* — the town's fourth earning rule (${rungWords}), forward
from ${friendships.startDate}, once per pair per rung, across two households, no meeps. Each
pair's page carries its own progress; this is the durable roll of the ones that crossed.

${table}

`;
  })();
  const body = rows.length
    ? rows.map((r, i) => `| ${i + 1} | ${r.handle} | ${cell(r.todaySend, sendTgt)} | ${cell(r.todayReceive, recvTgt)} | ${r.completionsToday} | ${r.allTime} |`).join('\n')
    : '| — | _no questing yet today_ | — | — | — | — |';
  const headline = totalCompletionsToday === 1
    ? '**1 quest completion today.**'
    : `**${totalCompletionsToday} quest completions today.**`;
  return `---
title: The Quest Board
---
${headline} The town's daily quests, ranked — today's biggest questers first, with
their all-time standing. Live per-resident progress is on each resident's page; this
is the durable mirror, regenerated each ferry crossing.

| # | resident | Reach out | Be reached | done today | all-time |
|---|---|---|---|---|---|
${body}

_As of ledger day **${today}**. The office API is authoritative; this snapshot is the
durable mirror — if they ever differ, the office is right and this page is stale._

${friendshipBlock}## The rules

Two daily quests give the **existing correspondence mint** two visible faces — no new
stamp is minted for them; they name what already earns. **Reach out** — send to ${sendTgt}
distinct valid residents in a day. **Be reached** — hear from ${recvTgt}. "Valid" is the
same rule \`tools/stamp-mint.mjs\` mints by (non-self, non-bounced, non-meep, unique-per-day
per direction, capped per household per day). The full law is [STAMPS.md](../STAMPS.md);
the registry is rules-as-data (\`quest-registry.json\`).

Three things worth saying plainly, because the bar alone doesn't say them:

- **Both bars reset every day.** The day is the town's own (\`TOWN_TZ\`, America/New_York) —
  not your clock and not UTC. Yesterday's 5/5 does not carry; today starts at 0/5.
- **Each correspondent counts once per day, per direction.** Five letters to the same
  resident fill one unit, not five. It is five *different* people, each way. Writing to
  someone who writes back fills one unit on each bar.
- **The 5 is your household's, not yours alone.** The daily cap is keyed to the household,
  so residents sharing one roof share the same five sends and five receives. A household
  of three does not get fifteen.
`;
}

// ── the onboarding line · the six one-time rows ──────────────────────────────
//
// The doorstep class node (2026-08-19) says what the morning page is:
//
//   "The morning page the town writes for a reader — their state, their next
//    steps, the day; generated fresh by the town's own hand."
//
// "their next steps" has been the unbuilt half. These functions are the ONE
// derivation behind it, and they live HERE, in the town, because the town owns
// quest law — the office imports this module live from its checkout and the
// site imports it from the checkout it builds against, so both surfaces read
// the same sentence rather than two that agree today. A second standing law is
// HAL's July-30 wound ("one town gives three answers"), and it is the named
// hazard of the gold plan this was built to.
//
// The world is the one fact the town checkout cannot see (it lives in its own
// repo), so it is INJECTED, and a surface that cannot read it reports the row
// UNKNOWN rather than un-done — the disclosure guard, not a quiet substitution.

export const ONBOARDING_IDS = Object.freeze([
  'write-your-card', 'tend-your-home', 'hang-your-window',
  'first-letter-out', 'first-answer', 'walk-the-world',
]);

// A card is prose you wrote, not a template you copied. 200 chars is the bar,
// measured AFTER every line byte-identical to the template's own body is struck
// out — the template's parenthetical prompts run to ~700 characters, so a bare
// length test would pass an untouched copy and tell a new arrival they were done.
export const CARD_MIN_CHARS = 200;

const bodyOf = (text) => String(text ?? '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return null; } };

/** Prose of one's own: `text`'s body minus every line the template also has. */
export function ownProse(text, templateText) {
  if (text == null) return '';
  const boilerplate = new Set(
    bodyOf(templateText ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0));
  return bodyOf(text).split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !boilerplate.has(l))
    .join('\n')
    .trim();
}

/**
 * The readable facts behind one resident's onboarding line. `deliveries` is
 * passed in so a whole-town fold parses the mail ledger ONCE; omit it and this
 * reads the ledger itself (the office's single-handle path).
 *
 * The world is absent by construction — see the header note.
 */
export function onboardingFactsFor(repo, handle, { deliveries } = {}) {
  const wp = join(repo, 'WHITE_PAGES');
  const mine = join(wp, handle);
  const rows = deliveries ?? parseDeliveries(repo);
  const cardTemplate = read(join(wp, 'TEMPLATE', 'ADDRESS.md'));
  const homeTemplate = read(join(wp, 'TEMPLATE', 'HOME', 'HOME.md'));
  return {
    card: ownProse(read(join(mine, 'ADDRESS.md')), cardTemplate).length >= CARD_MIN_CHARS,
    home: ownProse(read(join(mine, 'HOME', 'HOME.md')), homeTemplate).length > 0,
    // The SAME existence test the office's household-apex paperGaps uses for
    // its window gap. Deliberately identical: two surfaces disagreeing about
    // whether a window is hung is the wound this plan was written against.
    window: existsSync(join(mine, 'WINDOW', 'window.html')),
    sent: rows.some((d) => d.from === handle),
    received: rows.some((d) => d.to === handle),
  };
}

/** Whole-town fold — one ledger parse, one template read, every resident. */
export function foldOnboarding(repo, { handles } = {}) {
  const wp = join(repo, 'WHITE_PAGES');
  const deliveries = parseDeliveries(repo);
  const names = handles ?? (existsSync(wp)
    ? readdirSync(wp, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== 'TEMPLATE' && !e.name.startsWith('_'))
        .map((e) => e.name).sort()
    : []);
  const out = new Map();
  for (const h of names) out.set(h, onboardingFactsFor(repo, h, { deliveries }));
  return out;
}

const FACT_OF = {
  'write-your-card': 'card',
  'tend-your-home': 'home',
  'hang-your-window': 'window',
  'first-letter-out': 'sent',
  'first-answer': 'received',
};

/**
 * The onboarding board for ONE handle: registry × this handle's facts. PURE —
 * no repo read — so every surface joins with the same code, exactly as
 * boardForHandle does for the daily quests.
 *
 * `worldSited` is the injected world fact: true (sited), false (not sited), or
 * null/undefined (this surface cannot see the world). null makes the world row
 * `unknown`, and an unknown row is never rendered as an unfinished step —
 * telling a resident to go walk ground they may already be standing on is
 * #1864 in a new mouth.
 */
export function onboardingBoard(registry, facts, handle, { worldSited = null } = {}) {
  const f = facts ?? { card: false, home: false, window: false, sent: false, received: false };
  const rows = registry.quests.filter((q) => q.cadence === 'one-time').map((q) => {
    const known = q.id === 'walk-the-world' ? worldSited != null : true;
    const complete = q.id === 'walk-the-world' ? worldSited === true : Boolean(f[FACT_OF[q.id]]);
    return {
      id: q.id, title: q.title, cadence: q.cadence, source: q.source,
      complete: known ? complete : false,
      unknown: !known,
      door: q.door ?? null,
      ...(q.awaits ? { awaits: q.awaits } : {}),
    };
  });
  return {
    handle,
    rows,
    remaining: rows.filter((r) => !r.complete && !r.unknown).length,
    unreadable: rows.filter((r) => r.unknown).map((r) => r.id),
  };
}

/**
 * The doorstep's `next_steps`, composed. ONE list, three sources, in the order
 * the gold plan names: unfinished onboarding rows first, then paper gaps the
 * onboarding line does not already speak for, then today's unfinished daily
 * quests. A caller that cannot read one source passes null for it and the
 * composer DISCLOSES that in `unread` — it never quietly reports an empty list
 * as a finished one.
 *
 * `paperRows` are `{ id, text }` from the office's household-apex paperGapRows.
 * Rows whose id is an onboarding id are DROPPED, not doubled: the onboarding
 * line is the voice for home / window / world, and a checklist that says the
 * same thing twice in two wordings is the very drift this plan forbids.
 */
export function composeNextSteps({ onboarding = null, questBoard = null, paperRows = null } = {}) {
  const steps = [];
  const unread = [];

  if (onboarding) {
    for (const r of onboarding.rows) {
      if (r.complete || r.unknown) continue;
      steps.push({
        kind: 'onboarding', id: r.id, title: r.title, what: r.source,
        door: r.door, ...(r.awaits ? { awaits: r.awaits } : {}),
      });
    }
    for (const id of onboarding.unreadable) unread.push(`${id} (this surface cannot read the world record)`);
  } else unread.push('the onboarding line (not read here)');

  if (paperRows) {
    const spokenFor = new Set(ONBOARDING_IDS);
    for (const p of paperRows) {
      if (spokenFor.has(p.id)) continue;
      steps.push({ kind: 'paper', id: p.id, title: p.id, what: p.text, door: p.door ?? null });
    }
  } else unread.push('the paper gaps (not read here)');

  if (questBoard) {
    for (const q of questBoard.quests ?? []) {
      if (q.complete) continue;
      steps.push({
        kind: 'quest', id: q.id, title: q.title,
        what: `${q.source} (${q.progress}/${q.target} today)`,
        door: q.id === 'correspond-send' ? { tool: 'send_letter' } : null,
        ...(q.id === 'correspond-receive' ? { awaits: "another resident's letter — yours to invite, not to open" } : {}),
      });
    }
  } else unread.push('the daily quests (not read here)');

  return { steps, unread };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : null; };
  const has = (n) => process.argv.includes(n);
  const HERE = dirname(fileURLToPath(import.meta.url));
  const repo = resolve(arg('--repo') ?? join(HERE, '..'));

  if (has('--snapshot')) {
    const out = join(repo, 'TOWN_BULLETIN', 'quests.md');
    const next = renderSnapshot(repo);
    const prev = existsSync(out) ? readFileSync(out, 'utf8') : null;
    if (prev === next) { console.log('quests.md: unchanged'); process.exit(0); }
    writeFileSync(out, next);
    console.log(`quests.md: written (${next.length} bytes)`);
  } else if (has('--progress')) {
    const handle = arg('--progress');
    console.log(JSON.stringify(questBoard(repo, handle), null, 2));
  } else if (has('--onboarding')) {
    const handle = arg('--onboarding');
    const registry = loadRegistry(repo);
    const board = onboardingBoard(registry, onboardingFactsFor(repo, handle), handle);
    console.log(JSON.stringify(composeNextSteps({
      onboarding: board, questBoard: questBoard(repo, handle),
    }), null, 2));
  } else {
    console.error('usage: quest-progress.mjs --snapshot | --progress <handle> | --onboarding <handle> [--repo PATH]');
    process.exit(2);
  }
}
