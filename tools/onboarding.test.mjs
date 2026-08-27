// onboarding.test.mjs — falsifiers for the doorstep's next-steps derivation.
//   node --test tools/onboarding.test.mjs
//
// THE LAW THESE ASSERT, quoted verbatim from the planted constitutional node
// (`doorstep`, class, 2026-08-19) rather than paraphrased:
//
//   "The morning page the town writes for a reader — their state, their next
//    steps, the day; generated fresh by the town's own hand."
//
// "their next steps" is the half these tests hold to account. Two things follow
// from that sentence and are tested as such: the page must carry next steps at
// all (a fresh arrival's must not be empty), and they must be THE READER'S —
// derived from that reader's own record, fresh, by the town's own hand, so a
// completed step must flip its own check and a finished house must be told
// nothing.
//
// Zero-dep; throwaway towns in a temp dir (the settle.test.mjs pattern).

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  ONBOARDING_IDS, CARD_MIN_CHARS, ownProse, onboardingFactsFor, foldOnboarding,
  onboardingBoard, composeNextSteps, loadRegistry, questBoard,
} from './quest-progress.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const REGISTRY = loadRegistry(REPO);
const DAY = '2026-07-20';

const CARD = 'I am a resident and this is my card, written in my own voice, at a '
  + 'length past the bar so the derivation can tell prose from a copied template. '
  + 'It goes on a while, because a card that says nothing is not a card at all.';

// A throwaway town. `who` describes ONE resident's papers; `mail` is the ledger.
function town({ card = null, home = null, window: win = false, mail = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'onboard-'));
  const wp = join(dir, 'WHITE_PAGES');
  mkdirSync(join(wp, 'TEMPLATE', 'HOME'), { recursive: true });
  mkdirSync(join(wp, 'ada'), { recursive: true });
  mkdirSync(join(dir, 'tools'), { recursive: true });
  copyFileSync(join(REPO, 'quest-registry.json'), join(dir, 'quest-registry.json'));
  writeFileSync(join(dir, 'tools', 'github-ids.json'), '{}');
  writeFileSync(join(wp, 'TEMPLATE', 'ADDRESS.md'),
    '---\nhandle: your-handle\n---\n\n*(Everything below the line is yours to write.)*\n');
  writeFileSync(join(wp, 'TEMPLATE', 'HOME', 'HOME.md'),
    '---\nresident: your-handle\n---\n\n# your house\n');
  writeFileSync(join(wp, 'ada', 'ADDRESS.md'), `---\nhandle: ada\n---\n\n${card ?? ''}\n`);
  if (home !== null) {
    mkdirSync(join(wp, 'ada', 'HOME'), { recursive: true });
    writeFileSync(join(wp, 'ada', 'HOME', 'HOME.md'), `---\nresident: ada\n---\n\n${home}\n`);
  }
  if (win) {
    mkdirSync(join(wp, 'ada', 'WINDOW'), { recursive: true });
    writeFileSync(join(wp, 'ada', 'WINDOW', 'window.html'), '<p>the pane</p>');
  }
  writeFileSync(join(wp, 'mail-ledger.md'),
    mail.map(([from, to], i) => `- ${DAY} · ${from}-${DAY}-${to}-${i} · ${from} → ${to}`).join('\n') + '\n');
  return dir;
}
const board = (dir, opts) => onboardingBoard(REGISTRY, onboardingFactsFor(dir, 'ada'), 'ada', opts);
const idsOf = (b) => b.rows.filter((r) => !r.complete && !r.unknown).map((r) => r.id);

// ── "their next steps" — the page must actually carry them ──────────────────

test('a fresh arrival reads all six rows unchecked — the next-steps half of the doorstep node is not empty', () => {
  const dir = town({ card: null, home: null, window: false, mail: [] });
  try {
    const b = board(dir, { worldSited: false });
    assert.equal(b.rows.length, 6, 'six one-time rows, exactly the onboarding line');
    assert.deepEqual(b.rows.map((r) => r.id).sort(), [...ONBOARDING_IDS].sort());
    assert.deepEqual(b.rows.filter((r) => r.complete).map((r) => r.id), [],
      'nothing is done on the first morning');
    assert.equal(b.remaining, 6);
    const { steps } = composeNextSteps({ onboarding: b });
    assert.equal(steps.filter((s) => s.kind === 'onboarding').length, 6,
      '"their next steps" — a fresh arrival is told all six');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a whole house is told NOTHING — the block retires itself', () => {
  const dir = town({ card: CARD, home: 'A house with a door and a lamp.', window: true,
    mail: [['ada', 'bob'], ['bob', 'ada']] });
  try {
    const b = board(dir, { worldSited: true });
    assert.deepEqual(idsOf(b), [], 'every row checked');
    assert.equal(b.remaining, 0);
    const { steps } = composeNextSteps({ onboarding: b, questBoard: { quests: [] } });
    assert.deepEqual(steps, [], 'a finished resident gets no next-steps section at all');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── "generated fresh by the town's own hand" — each row's real derivation ────

test('each row flips on its OWN act, one at a time, off the real record', () => {
  const cases = [
    ['write-your-card', { card: CARD }],
    ['tend-your-home', { home: 'A house with a door and a lamp.' }],
    ['hang-your-window', { window: true }],
    ['first-letter-out', { mail: [['ada', 'bob']] }],
    ['first-answer', { mail: [['bob', 'ada']] }],
  ];
  for (const [id, papers] of cases) {
    const bare = town({});
    const done = town(papers);
    try {
      assert.ok(idsOf(board(bare, { worldSited: false })).includes(id), `${id} starts unchecked`);
      assert.ok(!idsOf(board(done, { worldSited: false })).includes(id),
        `${id} must flip when its own act lands, and nothing else does`);
    } finally {
      rmSync(bare, { recursive: true, force: true });
      rmSync(done, { recursive: true, force: true });
    }
  }
});

test('a COPIED template is not a card — the length bar is measured on your own prose', () => {
  const template = '*(Everything below the line is yours to write.)*';
  const dir = town({ card: `${template}\n${template}\n${template}\n${template}\n${template}` });
  try {
    assert.ok(template.repeat(5).length > CARD_MIN_CHARS, 'the copied template is long enough to fool a bare length test');
    assert.ok(idsOf(board(dir, { worldSited: false })).includes('write-your-card'),
      'copying the template does not write your card');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('ownProse strikes the template lines and keeps yours', () => {
  const tpl = '---\na: b\n---\n\nshared line\n';
  assert.equal(ownProse('---\na: b\n---\n\nshared line\nmine\n', tpl), 'mine');
});

// ── the disclosure guard — unknown is not un-done ───────────────────────────

test('a surface that cannot read the world reports UNKNOWN, never a quiet "not done"', () => {
  const dir = town({});
  try {
    const b = board(dir, {}); // worldSited omitted — the static site's case
    const world = b.rows.find((r) => r.id === 'walk-the-world');
    assert.equal(world.unknown, true, 'the row says it could not be read');
    assert.equal(world.complete, false);
    assert.deepEqual(b.unreadable, ['walk-the-world']);
    const { steps, unread } = composeNextSteps({ onboarding: b });
    assert.ok(!steps.some((s) => s.id === 'walk-the-world'),
      'an unknown row is never rendered as an unfinished step — telling a placed resident to go get placed is the #1864 defect');
    assert.ok(unread.some((u) => u.includes('walk-the-world')), 'and the surface says so out loud');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a sited resident is not told to walk, and an unsited one is', () => {
  const dir = town({});
  try {
    assert.ok(!idsOf(board(dir, { worldSited: true })).includes('walk-the-world'));
    assert.ok(idsOf(board(dir, { worldSited: false })).includes('walk-the-world'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('composeNextSteps discloses every source it did not read', () => {
  const { unread } = composeNextSteps({});
  assert.equal(unread.length, 3, 'onboarding, paper gaps, daily quests — each absence named');
});

// ── one voice per obligation — the HAL July-30 wound ────────────────────────

test('a paper gap the onboarding line already speaks for is dropped, never doubled', () => {
  const dir = town({});
  try {
    const b = board(dir, { worldSited: false });
    const { steps } = composeNextSteps({
      onboarding: b,
      paperRows: [
        { id: 'tend-your-home', text: 'tend your HOME page — household { do: "home", … }' },
        { id: 'hang-your-window', text: 'hang your window — household { do: "window", … }' },
        { id: 'some-later-gap', text: 'a gap the onboarding line does not speak for' },
      ],
    });
    const home = steps.filter((s) => s.id === 'tend-your-home');
    assert.equal(home.length, 1, 'exactly one voice for the home obligation');
    assert.equal(home[0].kind, 'onboarding', 'and it is the onboarding line that speaks');
    assert.ok(steps.some((s) => s.id === 'some-later-gap'),
      'a paper gap with no onboarding row still gets through — the drop is by id, not a blanket');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── the one-time rows must not leak onto the daily board ────────────────────

test('a one-time row never appears on the daily quest board', () => {
  const dir = town({ mail: [['ada', 'bob']] });
  try {
    const daily = questBoard(dir, 'ada', { today: DAY }).quests.map((q) => q.id);
    for (const id of ONBOARDING_IDS) assert.ok(!daily.includes(id), `${id} is not a daily quest`);
    assert.deepEqual(daily, ['correspond-send', 'correspond-receive']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ── the #1940 guard, town half — every named door is a real, named door ─────

test('every one-time row either names a door or says what it awaits — never a refused door', () => {
  const rows = REGISTRY.quests.filter((q) => q.cadence === 'one-time');
  assert.equal(rows.length, 6);
  for (const q of rows) {
    if (q.door) {
      assert.match(q.door.tool, /^[a-z][a-z0-9_]*$/, `${q.id}: door.tool is a verb name`);
      if (q.door.apex) {
        assert.ok(['household', 'world'].includes(q.door.apex), `${q.id}: apex is a real door`);
        assert.match(q.door.act, /^[a-z][a-z0-9-]*$/, `${q.id}: apex doors name their act`);
      }
      assert.ok(!q.awaits, `${q.id}: a row with a door does not also await`);
    } else {
      assert.ok(typeof q.awaits === 'string' && q.awaits.length > 0,
        `${q.id}: a row no door of yours opens must say what it awaits, not point at a door that would refuse`);
    }
  }
});

// ── the live town, as a sanity pass ─────────────────────────────────────────

test('the live checkout folds without throwing, and every resident gets a row set', () => {
  const all = foldOnboarding(REPO);
  assert.ok(all.size > 0, 'the town has residents');
  for (const [handle, facts] of all) {
    for (const k of ['card', 'home', 'window', 'sent', 'received']) {
      assert.equal(typeof facts[k], 'boolean', `${handle}.${k} is a fact, not an undefined`);
    }
  }
});
