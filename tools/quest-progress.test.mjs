// quest-progress.test.mjs — the quest board's progress fold (quest gold Phase 2).
//   node --test tools/quest-progress.test.mjs
//
// Proves the fold REUSES stamp-mint's rule (via deriveMints) rather than
// reimplementing it: dedup, self-mail exclusion, and the per-household daily cap
// all fall out because deriveMints owns them. Plus a live-ledger sanity pass.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { foldQuestProgress, questBoard, loadRegistry, foldLeaderboard, renderSnapshot, boardForHandle, BOARD_LAW, COUNTABLE_FIELD } from './quest-progress.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const DAY = '2026-07-20';

// build a throwaway town: a mail-ledger + optional github-id pins (households)
function town(deliveries, pins = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'quest-'));
  mkdirSync(join(dir, 'WHITE_PAGES'), { recursive: true });
  mkdirSync(join(dir, 'tools'), { recursive: true });
  const lines = deliveries.map(([from, to, day = DAY, i = 0]) =>
    `- ${day} · ${from}-${day}-${to}-${i} · ${from} → ${to}`).join('\n');
  writeFileSync(join(dir, 'WHITE_PAGES', 'mail-ledger.md'), lines + '\n');
  writeFileSync(join(dir, 'tools', 'github-ids.json'), JSON.stringify(pins));
  copyFileSync(join(REPO, 'quest-registry.json'), join(dir, 'quest-registry.json'));
  return dir;
}
const send = (repo, h) => foldQuestProgress(repo, { today: DAY }).get(h)?.send ?? 0;

test('progress = distinct valid recipients today (the send face)', () => {
  const d = town([['alice', 'bob'], ['alice', 'carol'], ['alice', 'dave']]);
  try { assert.equal(send(d, 'alice'), 3); } finally { rmSync(d, { recursive: true, force: true }); }
});

test('dedup: same correspondent twice in a day counts once', () => {
  const d = town([['alice', 'bob', DAY, 1], ['alice', 'bob', DAY, 2]]);
  try { assert.equal(send(d, 'alice'), 1); } finally { rmSync(d, { recursive: true, force: true }); }
});

test('self-mail mints nothing', () => {
  const d = town([['alice', 'alice']]);
  try { assert.equal(send(d, 'alice'), 0); } finally { rmSync(d, { recursive: true, force: true }); }
});

test('the per-household daily cap is enforced (reused from deriveMints)', () => {
  // alice + bob share a household (gh:1); together they reach for 6 distinct
  // recipients today — the household send cap (5) lets only 5 mint.
  const d = town(
    [['alice', 'r1'], ['alice', 'r2'], ['alice', 'r3'], ['bob', 'r4'], ['bob', 'r5'], ['bob', 'r6']],
    { alice: { id: '1' }, bob: { id: '1' } },
  );
  try {
    const prog = foldQuestProgress(d, { today: DAY });
    const a = prog.get('alice'), b = prog.get('bob');
    assert.equal(a.send + b.send, 5, 'household send capped at 5');
    assert.equal(a.household.size, 2);
    assert.equal(a.household.send, 5);
    // questBoard surfaces the shared ceiling (size>1 && total>=target)
    const board = questBoard(d, 'alice', { today: DAY });
    const sendQ = board.quests.find((q) => q.id === 'correspond-send');
    assert.equal(sendQ.household.cap_shared, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('questBoard: complete flag + registry join', () => {
  const d = town([['alice', 'r1'], ['alice', 'r2'], ['alice', 'r3'], ['alice', 'r4'], ['alice', 'r5']]);
  try {
    const board = questBoard(d, 'alice', { today: DAY });
    const q = board.quests.find((x) => x.id === 'correspond-send');
    assert.equal(q.progress, 5);
    assert.equal(q.complete, true);
    assert.equal(q.title, 'Reach out');
    assert.equal(q.target, 5);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('a resident with no activity today reads a clean zero', () => {
  const d = town([['alice', 'bob']]);
  try {
    const board = questBoard(d, 'nobody', { today: DAY });
    // Scoped to the COUNTABLE rows 2026-09-01 (BOARD_LAW). The clean zero is a
    // statement about the daily mint — "absent from the fold == 0, first-class".
    // Asserting it over every row would have re-asserted the allow-list from a
    // second file: an uncounted row reads null precisely BECAUSE 0 would be a
    // claim this fold has not earned.
    const counted = board.quests.filter((q) => COUNTABLE_FIELD[q.id]);
    assert.equal(counted.length, 2, 'the daily mint measures exactly two rows');
    for (const q of counted) { assert.equal(q.progress, 0); assert.equal(q.complete, false); }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('#1458: an inactive member of an active house reads TRUE house columns', () => {
  // alice + bob share a roof; only alice mints today. Pre-fix, bob was absent
  // from the fold and the clean-zero default invented him a solo house — seven
  // member tabs above a solo-grain quest card. Now his row must carry the house.
  const d = town(
    [['alice', 'r1'], ['alice', 'r2'], ['alice', 'r3']],
    { alice: { id: '1' }, bob: { id: '1' } },
  );
  try {
    const prog = foldQuestProgress(d, { today: DAY });
    const b = prog.get('bob');
    assert.ok(b, 'bob (no mints today) still gets a row');
    assert.equal(b.send, 0);
    assert.equal(b.receive, 0);
    assert.deepEqual(b.sentTo, []);
    assert.equal(b.household.size, 2, 'house size is the house\'s, not solo');
    assert.equal(b.household.send, 3, 'house send total reaches the quiet member');
    // and through the board join, the card shape the office serves:
    const q = questBoard(d, 'bob', { today: DAY, progress: prog })
      .quests.find((x) => x.id === 'correspond-send');
    assert.equal(q.progress, 0);
    assert.equal(q.household.size, 2);
    assert.equal(q.household.total, 3);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('leaderboard: today rows sorted (completions, then progress, then handle), all-time tallied', () => {
  const PRIOR = '2026-07-19';
  const d = town([
    // alice completes Reach out today (5 distinct) AND completed it the prior day → all-time 2
    ['alice', 'r1'], ['alice', 'r2'], ['alice', 'r3'], ['alice', 'r4'], ['alice', 'r5'],
    ['alice', 'r1', PRIOR], ['alice', 'r2', PRIOR], ['alice', 'r3', PRIOR], ['alice', 'r4', PRIOR], ['alice', 'r5', PRIOR],
    // bob: 3 today (no completion)
    ['bob', 'x1'], ['bob', 'x2'], ['bob', 'x3'],
    // carol: no activity today (prior only) → must NOT appear (nonzero-today only)
    ['carol', 'y1', PRIOR],
  ]);
  try {
    const lb = foldLeaderboard(d, { today: DAY });
    const handles = lb.rows.map((r) => r.handle);
    // recipients (r*, x*) legitimately appear — they were REACHED today. The
    // ranking is what matters: alice (1 completion) first, bob (progress 3) next,
    // then the progress-1 recipients; carol (no activity today) absent.
    assert.equal(lb.rows[0].handle, 'alice');
    assert.equal(lb.rows[0].completionsToday, 1);
    assert.equal(lb.rows[0].allTime, 2, 'alice completed Reach out on two days');
    assert.equal(lb.rows[1].handle, 'bob', 'progress 3 ranks above the progress-1 recipients');
    assert.ok(!handles.includes('carol'), 'carol had no progress today');
    assert.equal(lb.totalCompletionsToday, 1);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('snapshot is deterministic (identical state → identical bytes)', () => {
  const d = town([['alice', 'r1'], ['alice', 'r2'], ['bob', 'r3']]);
  try {
    assert.equal(renderSnapshot(d, { today: DAY }), renderSnapshot(d, { today: DAY }));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('live ledger: every handle within [0, target], flags consistent', () => {
  const reg = loadRegistry(REPO);
  const prog = foldQuestProgress(REPO); // real today
  for (const [handle, p] of prog) {
    for (const [field, val] of [['send', p.send], ['receive', p.receive]]) {
      assert.ok(val >= 0, `${handle}.${field} negative`);
      assert.ok(val <= 5, `${handle}.${field} exceeds cap: ${val}`);
    }
    const board = questBoard(REPO, handle, { progress: prog });
    // REWRITTEN 2026-09-01 (BOARD_LAW). The two assertions that stood here —
    // "every row is non-milestone" and "board.quests.length === 2" — pinned the
    // allow-list as correct. The invariant worth keeping is not the COUNT, it is
    // that a counted row's flag agrees with its own bar and an uncounted row
    // claims no bar at all.
    assert.equal(board.quests.length, reg.quests.length, `${handle}: ${BOARD_LAW}`);
    for (const q of board.quests) {
      if (q.progress === null) {
        assert.ok(q.complete === null || typeof q.complete === 'boolean',
          `${handle}/${q.id}: an uncounted row's complete is a caller's fact or null — never derived from a bar it has not got`);
        assert.deepEqual(q.counted, [], `${handle}/${q.id}: an uncounted row counts nobody`);
        assert.equal(q.household.total, null, `${handle}/${q.id}: uncounted is not zero, in the house columns too`);
      } else {
        assert.equal(q.complete, q.progress >= q.target);
      }
    }
    // decision 7's SURVIVING clause: nothing renders a bar a resident cannot
    // move. A keeping pot at 0/150 is exactly that bar — so it is uncounted.
    for (const q of board.quests) {
      if (q.subtype === 'bounty') assert.equal(q.progress, null,
        `${handle}/${q.id}: a keeping pot is not a personal bar to fill`);
    }
  }
  // registry now carries the two dailies + the correspond-depth milestone + the
  // six one-time onboarding rows (2026-08-21). Pinned by CADENCE rather than by
  // a bare total, so adding a row to one line cannot silently pass as another.
  const byCadence = (c) => reg.quests.filter((q) => q.cadence === c).length;
  assert.equal(byCadence('daily'), 2);
  // 1 -> 2 (2026-08-30, the Think Tank): first-idea joins the MILESTONE line —
  // earned once and kept, exactly correspond-depth's shape, per-household (5
  // stamps for the household's first published idea; the mint is the drain's
  // witnessed first-idea ledger line, never derived here). Deliberately NOT
  // one-time: the six one-time rows ARE the onboarding checklist by
  // construction (zero mint), and a minting row in that bucket would leak
  // into every onboarding fold.
  assert.equal(byCadence('milestone'), 2);
  assert.ok(reg.quests.some((q) => q.id === 'first-idea' && q.cadence === 'milestone'));
  assert.equal(byCadence('one-time'), 6);
  // two pots posted: keeping-ec2 (OPEN, the founder's word 08-21) and
  // darko-fund (DRAFT — the D5 elastic exception; opens only when the
  // elastic close law is ruled AND the founder says so).
  assert.equal(reg.quests.filter((q) => q.subtype === 'bounty').length, 2);
  // draft -> open (trued 2026-08-30; the pin had been red since 9e5a8d60): the
  // DARKO fund OPENED 2026-08-23 as a donation box (R13, the founder's word,
  // PSA on the same commit). This assert had pinned the D5 draft state and
  // nobody trued it with the ruling — caught while adding first-idea.
  assert.ok(reg.quests.some((q) => q.id === 'darko-fund' && q.status === 'open'));
  assert.equal(reg.quests.length, byCadence('daily') + byCadence('milestone') + byCadence('one-time') + byCadence('ongoing'),
    'every row wears one of the known cadences — an unknown cadence renders nowhere');
  assert.ok(reg.quests.some((q) => q.id === 'correspond-depth' && q.cadence === 'milestone'));
  // "good to post the ec2 quest too" — the founder's word, 2026-08-21: the pot
  // posted open. A regression back to draft (or a silent second bounty row)
  // fails here.
  assert.ok(reg.quests.some((q) => q.id === 'keeping-ec2' && q.subtype === 'bounty' && q.status === 'open'));
});

test('live ledger: housemates agree on their house columns (#1458 invariant)', () => {
  // Every handle sharing an economy key must carry identical household
  // {size, send, receive} — the exact property whose absence produced crow
  // reading 1-of-7 while an active roommate read the true house.
  const prog = foldQuestProgress(REPO); // real today
  const byKey = new Map();
  for (const [handle, p] of prog) {
    const seen = byKey.get(p.household.key);
    if (!seen) { byKey.set(p.household.key, { handle, hh: p.household }); continue; }
    assert.deepEqual(p.household, seen.hh,
      `${handle} and ${seen.handle} share ${p.household.key} but disagree on house columns`);
  }
});

// ── `counted`: who already filled a unit today (the quest-card affordance) ────
// The card shows these so a resident can see who already counted and who would
// be a new one. Two invariants matter more than the names themselves: the list
// must be exactly as long as the progress number (or the card contradicts its
// own bar), and it must never repeat a correspondent (dedup is deriveMints').

test('counted lists the correspondents behind the bar, per direction', () => {
  const d = town([['alice', 'bob'], ['alice', 'carol'], ['dave', 'alice']]);
  try {
    const b = questBoard(d, 'alice', { today: DAY });
    const q = (id) => b.quests.find((x) => x.id === id);
    assert.deepEqual(q('correspond-send').counted, ['bob', 'carol']);
    assert.deepEqual(q('correspond-receive').counted, ['dave']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('counted never repeats a correspondent, and matches progress exactly', () => {
  // bob written to three times, carol once — the bar says 2, so the list must too
  const d = town([['alice', 'bob', DAY, 1], ['alice', 'bob', DAY, 2],
                  ['alice', 'bob', DAY, 3], ['alice', 'carol', DAY, 4]]);
  try {
    const q = questBoard(d, 'alice', { today: DAY }).quests.find((x) => x.id === 'correspond-send');
    assert.equal(q.progress, 2);
    assert.equal(q.counted.length, q.progress, 'counted.length must equal progress');
    assert.equal(new Set(q.counted).size, q.counted.length, 'counted must not repeat');
    assert.deepEqual(q.counted, ['bob', 'carol']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('counted is [] for a resident with no activity, never undefined', () => {
  const d = town([['bob', 'carol']]);
  try {
    for (const q of questBoard(d, 'alice', { today: DAY }).quests) {
      assert.deepEqual(q.counted, [], `${q.id} should be an empty array`);
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('counted survives a hydrated snapshot that predates the field', () => {
  // the office joins boardForHandle against its own snapshot; an older one has
  // no sentTo/heardFrom. It must read empty, not crash.
  const reg = loadRegistry(REPO);
  const legacy = { send: 2, receive: 0, household: { key: 'solo:alice', size: 1, send: 2, receive: 0 } };
  const b = boardForHandle(reg, legacy, 'alice', DAY);
  const q = b.quests.find((x) => x.id === 'correspond-send');
  assert.equal(q.progress, 2);
  assert.deepEqual(q.counted, []);
});

// ── BOARD_LAW · the board is every registry row ───────────────────────────────
//
// The founder, 2026-09-01, verbatim (quoted from the module's own BOARD_LAW so
// the law and its falsifiers cannot drift):
//
//   "the solution is to remove complexity and special-casing. We should just
//    display *all* quests instead of a select daily list."
//
// The old allow-list is the thing these forbid returning. It cannot be forbidden
// by asserting a COUNT (a registry row added tomorrow would fail that for the
// wrong reason), so it is forbidden by the property: a row in the registry has a
// row on the board, whatever its cadence.

test('BOARD_LAW: every registry row has a board row, by id, whatever its cadence', () => {
  const reg = loadRegistry(REPO);
  const d = town([['alice', 'bob']]);
  try {
    const ids = questBoard(d, 'alice', { today: DAY }).quests.map((q) => q.id);
    assert.deepEqual(ids, reg.quests.map((q) => q.id), BOARD_LAW);
    // and the cadences that the allow-list dropped are all present by name
    for (const cadence of ['milestone', 'one-time', 'ongoing']) {
      const row = reg.quests.find((q) => q.cadence === cadence);
      assert.ok(ids.includes(row.id), `a ${cadence} row (${row.id}) is on the board — ${BOARD_LAW}`);
    }
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('UNCOUNTED IS NOT ZERO: only the two countable rows carry a number', () => {
  const reg = loadRegistry(REPO);
  const d = town([['alice', 'bob'], ['alice', 'carol']]);
  try {
    for (const q of questBoard(d, 'alice', { today: DAY }).quests) {
      if (COUNTABLE_FIELD[q.id]) {
        assert.equal(typeof q.progress, 'number', `${q.id} is countable and carries a number`);
      } else {
        assert.equal(q.progress, null,
          `${q.id} is not measured by the daily mint — a 0 here would be a bar nothing the resident does can move`);
        assert.equal(q.complete, null, `${q.id}: no injected fact, so complete says "not looked", not "not done"`);
      }
    }
    // the countable half is untouched by the widening — the bar still reads 2/5
    const send = questBoard(d, 'alice', { today: DAY }).quests.find((q) => q.id === 'correspond-send');
    assert.equal(send.progress, 2);
    assert.equal(send.complete, false);
    assert.deepEqual(send.counted, ['bob', 'carol']);
    assert.equal(send.household.total, 2);
    void reg;
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('an injected fact settles an uncounted row, and only the row it names', () => {
  const reg = loadRegistry(REPO);
  const d = town([['alice', 'bob']]);
  try {
    const b = questBoard(d, 'alice', { today: DAY, complete: { 'first-idea': true, 'correspond-depth': false } });
    assert.equal(b.quests.find((q) => q.id === 'first-idea').complete, true);
    assert.equal(b.quests.find((q) => q.id === 'correspond-depth').complete, false);
    assert.equal(b.quests.find((q) => q.id === 'walk-the-world').complete, null,
      'a row the caller said nothing about stays null');
    // an explicit null is a disclosure, not a false: "this surface cannot see it"
    const blind = questBoard(d, 'alice', { today: DAY, complete: { 'walk-the-world': null } });
    assert.equal(blind.quests.find((q) => q.id === 'walk-the-world').complete, null);
    // an injection cannot overrule a bar it is not entitled to move
    const forced = boardForHandle(reg, null, 'alice', DAY, { complete: { 'correspond-send': true } });
    assert.equal(forced.quests.find((q) => q.id === 'correspond-send').complete, false,
      'a countable row is settled by its own count, never by a caller');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('the door rides the registry row onto the board', () => {
  const reg = loadRegistry(REPO);
  const b = boardForHandle(reg, null, 'alice', DAY);
  for (const q of reg.quests) {
    assert.deepEqual(b.quests.find((x) => x.id === q.id).door, q.door ?? null,
      `${q.id}: the board's door is the registry's door — not a second copy`);
  }
  assert.deepEqual(b.quests.find((q) => q.id === 'first-idea').door,
    { apex: 'town', act: 'post', tool: 'town_post' },
    'first-idea names the town door that opens it');
});
