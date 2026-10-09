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
import { foldQuestProgress, questBoard, loadRegistry, foldLeaderboard, renderSnapshot, boardForHandle, BOARD_LAW, COUNTABLE_FIELD, onboardingBoard, onboardingFactsFor, welcomedHouseholds, foldHouseholdBars, foldFriendships, KIND_LABEL, PAIR_RULE } from './quest-progress.mjs';

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
  // 6 -> 7 (2026-09-14, the welcome bundle): welcome-to-postmark joins the
  // ONE-TIME line as its seventh row and its only minting one. The bucket's old
  // "zero mint" property was a description of what happened to be in it, never
  // a law — joining is not a thing a resident goes and does, so the row belongs
  // where arriving is read.
  assert.equal(byCadence('one-time'), 7);
  // two pots posted: keeping-ec2 (OPEN, the founder's word 08-21) and
  // darko-fund (DRAFT — the D5 elastic exception; opens only when the
  // elastic close law is ruled AND the founder says so).
  // 2 -> 3 (2026-09-29): meeps-fund, the plan the meeps run on, posted as a
  // DRAFT until the founder opens it right after the September close.
  assert.equal(reg.quests.filter((q) => q.subtype === 'bounty').length, 3);
  assert.ok(reg.quests.some((q) => q.id === 'meeps-fund' && q.subtype === 'bounty'));
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

// ── the welcome row (founder-ruled 2026-09-14) ──────────────────────────────
//
// The seventh one-time row, and the only one settled by the SEALED LEDGER
// rather than by a resident's own papers: "joining IS the milestone, so this row
// completes when the town has paid, never on anything a resident must go and
// do" (quest-registry.json, welcome-to-postmark). So the falsifier is an IFF —
// it must read complete when a welcome line stands for the household and read
// incomplete when one does not, for exactly the residents of that house.

const welcomeRow = (dir, handle) => onboardingBoard(
  loadRegistry(dir), onboardingFactsFor(dir, handle), handle,
).rows.find((r) => r.id === 'welcome-to-postmark');

const putLedger = (dir, lines) => writeFileSync(
  join(dir, 'WHITE_PAGES', 'stamp-ledger.md'), `# stamp-ledger\n\n${lines.join('\n')}\n`);

test('the welcome row reads complete IFF a welcome line stands for the HOUSEHOLD', () => {
  // alice + bob keep one account (gh:1); carol is her own house next door.
  const d = town([['alice', 'bob']], { alice: { id: '1' }, bob: { id: '1' }, carol: { id: '2' } });
  try {
    assert.equal(welcomeRow(d, 'alice').complete, false, 'before the bundle, nobody is welcomed');
    assert.equal(welcomeRow(d, 'carol').complete, false);
    putLedger(d, ['- 2026-09-14 · MINT → alice · 5 · for: welcome:gh:1 · by: the-town']);
    assert.equal(welcomeRow(d, 'alice').complete, true, 'the resident it was paid to reads complete');
    assert.equal(welcomeRow(d, 'bob').complete, true,
      "and so does the housemate — the bundle is the HOUSE's, paid once at its first resident");
    assert.equal(welcomeRow(d, 'carol').complete, false, 'and the house next door is untouched');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('a house that RE-KEYS after its bundle still reads welcomed', () => {
  // This town re-keys often (fifteen sealed `registry:` lines and counting). A
  // row that read the named key alone would tell a re-keyed household it had
  // never been welcomed, and a second bundle is a double mint.
  const d = town([['alice', 'bob']], { alice: { id: '9' } });
  try {
    putLedger(d, [
      '- 2026-09-14 · MINT → alice · 5 · for: welcome:gh:1 · by: the-town',
      '- 2026-09-15 · registry: alice = hh:the-new-name',
    ]);
    assert.ok(welcomedHouseholds(d).has('hh:the-new-name'),
      'the key its recipient wears today is welcomed, not only the key the line named');
    assert.equal(welcomeRow(d, 'alice').complete, true);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ── POS-327: whose bar is it (Little Bird, 10-04: "I see that often as a point
// of contest"). The daily rows are the HOUSEHOLD's, one shared cap; Budding
// friendship is per pair, and the daily cap never touches it. Labels and the
// who-filled line only: no number in here is new, every one is deriveMints'.

test('POS-327: the snapshot labels both kinds and carries the pair rule', () => {
  const d = town([['alice', 'bob']]);
  try {
    const md = renderSnapshot(d, { today: DAY });
    assert.equal(KIND_LABEL.daily, 'Household · daily');
    assert.equal(KIND_LABEL.pair, 'Just you · pair');
    assert.match(md, /\*\*Reach out\*\* and \*\*Be reached\*\* are \*Household · daily\*/);
    assert.match(md, /\*\*Budding friendship\*\* is \*Just you · pair\*/);
    assert.match(md, /## Household bars today \(Household · daily\)/);
    assert.ok(md.includes(`- **${PAIR_RULE}**`), 'the rules carry the one rule line');
    assert.equal(PAIR_RULE, "A full household bar doesn't block anyone's pair quests.");
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test("POS-327: the site's parser still reads the board (header, headline, one 6-cell table)", () => {
  // site src/lib/civic.mjs questStandings: the FIRST table row of >= 6 cells
  // whose first cell is '' or '#' is the header, and its middle cells are the
  // quest titles the Guild's cards join on. A new table must stay under 6 cells.
  const d = town([['alice', 'r1'], ['bob', 'r2']], { alice: { id: '1' }, bob: { id: '1' } });
  try {
    const md = renderSnapshot(d, { today: DAY });
    assert.match(md, /\*\*\d+ quest completions? today/);
    const rows = md.split('\n').filter((l) => /^\s*\|/.test(l)).map((l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|'));
    const wide = rows.filter((c) => c.length >= 6);
    assert.equal(wide[0].map((c) => c.trim()).join('|'), '#|resident|Reach out|Be reached|done today|all-time');
    assert.ok(rows.some((c) => c.length === 3 && c[0].trim() === 'alice · bob'), 'the household table is drawn');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('POS-327: a shared household row says who filled today, from the mint', () => {
  // alice + bob share gh:1. Six sends reach for the cap; the mint keeps 5 (alice
  // 4, bob 1), and the row says exactly that. carol is a house of one: no row.
  const d = town(
    [['alice', 'r1'], ['alice', 'r2'], ['alice', 'r3'], ['alice', 'r4'], ['bob', 'r5'], ['bob', 'r6'], ['carol', 'r1']],
    { alice: { id: '1' }, bob: { id: '1' }, carol: { id: '2' } },
  );
  try {
    const bars = foldHouseholdBars(d, { today: DAY });
    assert.equal(bars.length, 1, 'only the shared household gets a row');
    assert.deepEqual(bars[0].residents, ['alice', 'bob']);
    assert.deepEqual(bars[0].send, { total: 5, by: [{ handle: 'alice', n: 4 }, { handle: 'bob', n: 1 }] });
    assert.deepEqual(bars[0].receive, { total: 0, by: [] });
    const prog = foldQuestProgress(d, { today: DAY });
    assert.equal(bars[0].send.total, prog.get('alice').send + prog.get('bob').send, 'the same mints the board counts');
    const md = renderSnapshot(d, { today: DAY });
    assert.ok(md.includes('| alice · bob | 5/5 ✓ — alice 4 · bob 1 | 0/5 |'), md);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('POS-327: the row groups by the key the mint caps on (a sealed re-key splits the bar)', () => {
  // alice + bob share gh:1 in the file, but a sealed `registry:` line re-keyed
  // bob before today. deriveMints caps them apart, so the bulletin must not add
  // their counts under one 5: that would print 7/5, a number the mint never made.
  const d = town(
    [['alice', 'r1'], ['alice', 'r2'], ['alice', 'r3'], ['alice', 'r4'], ['bob', 'r5'], ['bob', 'r6'], ['bob', 'r7'], ['carol', 'r8']],
    { alice: { id: '1' }, bob: { id: '1' }, carol: { id: '1' } },
  );
  try {
    putLedger(d, ['- 2026-07-01 · registry: bob = hh:elsewhere']);
    const bars = foldHouseholdBars(d, { today: DAY });
    for (const b of bars) {
      assert.ok(b.send.total <= 5 && b.receive.total <= 5, `${b.residents.join(',')} reads ${b.send.total}/5`);
    }
    assert.deepEqual(bars.map((b) => b.residents), [['alice', 'carol']], 'bob is a house of one in the mint');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('POS-327 live: no household bar on the live ledger exceeds its cap', () => {
  const day = '2026-10-03';
  for (const b of foldHouseholdBars(REPO, { today: day })) {
    for (const side of ['send', 'receive']) {
      assert.ok(b[side].total <= 5, `${b.residents.join(' · ')} ${side} ${b[side].total}/5 on ${day}`);
      assert.equal(b[side].by.reduce((s, w) => s + w.n, 0), b[side].total);
    }
  }
});

// ── THE KEY BASE MAY BE THE CALLER'S (POS-341 part 4) ────────────────────────
// The office reads householdKeys' answer from the store and hands it to these
// folds. Byte-equal by construction: on the live checkout, each fold given the
// git base explicitly answers exactly what it answers given nothing. And the
// input is really read: a base that moves a house moves the answer.
test('POS-341: on the live town, each fold given the git base explicitly equals the fold given nothing', async () => {
  const { householdKeys } = await import('./stamp-mint.mjs');
  const base = householdKeys(REPO);
  const today = '2026-10-01';
  assert.deepEqual(foldQuestProgress(REPO, { today, base }), foldQuestProgress(REPO, { today }), 'foldQuestProgress');
  assert.deepEqual(foldFriendships(REPO, { base }), foldFriendships(REPO), 'foldFriendships');
  assert.deepEqual(foldLeaderboard(REPO, { today, base }), foldLeaderboard(REPO, { today }), 'foldLeaderboard');
  assert.deepEqual(foldHouseholdBars(REPO, { today, base }), foldHouseholdBars(REPO, { today }), 'foldHouseholdBars');
  assert.equal(renderSnapshot(REPO, { today, base }), renderSnapshot(REPO, { today }), 'renderSnapshot, byte for byte');
  assert.deepEqual(base, householdKeys(REPO), 'and the caller\'s base is never changed');
});

test('POS-341: the base is read, not ignored: two solo senders keyed as one house share a cap', () => {
  const d = town([['alice', 'carol'], ['bob', 'dave']]);
  try {
    const solo = foldQuestProgress(d, { today: DAY });
    assert.equal(solo.get('alice').household.size, 1);
    const base = new Map([['alice', { key: 'gh:1', provisional: false }], ['bob', { key: 'gh:1', provisional: false }],
      ['carol', { key: 'solo:carol', provisional: true }], ['dave', { key: 'solo:dave', provisional: true }]]);
    const one = foldQuestProgress(d, { today: DAY, base });
    assert.deepEqual(one.get('alice').household, { key: 'gh:1', size: 2, send: 2, receive: 0 });
    const bars = foldHouseholdBars(d, { today: DAY, base });
    assert.deepEqual(bars.map((b) => b.residents), [['alice', 'bob']], 'the shared bar appears only under the given base');
    assert.deepEqual(foldHouseholdBars(d, { today: DAY }), []);
    assert.notEqual(renderSnapshot(d, { today: DAY, base }), renderSnapshot(d, { today: DAY }));
  } finally { rmSync(d, { recursive: true, force: true }); }
});
