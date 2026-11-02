// witness-escalate-stale.test.mjs — a founder's clear of `teed-up` restarts the
// witness's 72h staleness clock (POS-842).
//   node --test tools/witness-escalate-stale.test.mjs
// Zero-dep. `escalate-stale` is API-only, so the real tools/witness.mjs runs as a
// child process against a local stand-in for the GitHub API, as the other
// witness-*.test.mjs files do. The stand-in answers from a scenario: the PR's
// issue events, the witness's own comment and the head commit. Nothing here
// touches the town's pages. Every timestamp is built from the clock in GitHub's
// own shape (UTC, whole seconds: `2026-10-28T12:31:04Z`), because the witness
// compares them as strings and a millisecond suffix would sort wrongly.
//
// Until POS-842 nothing tested escalate-stale at all, so besides the proposal's
// four cases this file pins what the change sits next to: RRR and the 72h as the
// base clock, the witness comment's own restart, and the head commit, which the
// escalation comment NAMES and which never decides.
//
// LAW (POS-842, Jetto's proposal of 2026-10-31, quoted in the issue): "start the
// 72 h clock at the latest of these ... A founder's clear is then a "seen; it's
// the resident's move" that lasts another 72 h. If the PR is still parked after
// that, it escalates again." And: "RRR stays, and the 72 h stays."
//
// The real shapes: #4225 and #4189 are rebuilt from their live issue events and
// witness-comment times, shifted so the moment the sweep re-added `teed-up` is
// now; the intervals are the real ones.
//
// THE FLIPS (each one token of tools/witness.mjs, run alone and restored; each
// reddens exactly the tests named, and the rest stay green):
//   the reader never sees an `unlabeled` event .. the three case-1 tests, #4225,
//     #4189, case 2's comment fact, the second-page test and the dry run (8). The
//     unmodified train-tip witness.mjs reddens the same eight;
//   the decision ignores the restart it was handed .. case 1 (3), #4225, #4189
//     and the second-page test (6);
//   any actor counts as a founder .. the five case-3 tests;
//   a clear replaces the machine clock even when older .. the older-clear test
//     and the comment-beside-an-older-clear test;
//   the witness comment leaves the clock .. both comment tests;
//   an unlabel of any label counts .. "only teed-up counts"; a `labeled` event
//     counts .. "putting teed-up on";
//   the first clear wins, not the latest .. #4189's second cycle;
//   the events read stops at page 1 .. the second-page test;
//   a clear counts as a machine clock .. the no-machine-clock test, and case 1,
//     #4225, #4189, case 2 and the dry run on their log and comment lines (8);
//   a newer head commit defers the escalation .. the head-commit test;
//   the label added is another one .. every test that expects the re-add (10);
//   the comment stops naming the clear .. case 2's comment fact and the dry run.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = dirname(fileURLToPath(import.meta.url));
const WITNESS = join(TOOLS, 'witness.mjs');
const HOUR = 3_600_000;
const MARKER = '<!-- the-witness -->';
const RRR = 'resident revision required';
const TEED_UP = 'teed-up';

// Actors as GitHub reports them on #4225's events, plus a resident.
const WRIGHT = { login: 'wright-starforge', id: 306351151, type: 'User' };
const KEEMIN = { login: 'keeminlee', id: 67605380, type: 'User' };
const REGISTRAR = { login: 'postmark-registrar-meep', id: 324235342, type: 'User' };
const FERRY = { login: 'ferry-the-postmaster[bot]', id: 342791614, type: 'Bot' };
const SWEEP = { login: 'github-actions[bot]', id: 41898282, type: 'Bot' };
const RESIDENT = { login: 'a-resident', id: 4242, type: 'User' };
// A founder is matched by account id, never by login (the file's rule for PEN_ID):
const RENAMED_FOUNDER = { login: 'keemin-lee', id: KEEMIN.id, type: 'User' }; // the founder's account under a new name
const OTHER_ACCOUNT_ON_A_FOUNDER_LOGIN = { login: 'keeminlee', id: 99_000_111, type: 'User' }; // the old name, someone else's account

function clock(now = Date.now()) {
  const stamp = (ms) => new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');
  return {
    ago: (hours) => stamp(now - hours * HOUR),
    // A real GitHub timestamp, shifted so the real moment `checkAt` is now.
    real: (iso, checkAt) => stamp(Date.parse(iso) + (now - Date.parse(checkAt))),
  };
}

let seq = 1;
const event = (name, created_at, { label, actor } = {}) =>
  ({ id: seq++, event: name, created_at, actor: actor ?? null, ...(label ? { label: { name: label, color: 'B60205' } } : {}) });
const labeled = (at, label, actor) => event('labeled', at, { label, actor });
const unlabeled = (at, label, actor) => event('unlabeled', at, { label, actor });

// The PR as the witness sees it. `commentAt` is when the witness's own comment
// was last written (null: it has none); `headCommitAt` is the head commit's
// committer date. Events go out oldest first, as GitHub's do.
function scenario({ events, commentAt = null, headCommitAt = null, labels = [RRR] }) {
  const byTime = (a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id);
  return {
    labels,
    events: [...events].sort(byTime),
    comments: commentAt ? [{ id: 77, created_at: commentAt, updated_at: commentAt, body: `${MARKER}\n**The witness checked this PR.**` }] : [],
    commits: headCommitAt ? [{ sha: 'a'.repeat(40), commit: { committer: { date: headCommitAt } } }] : [],
  };
}

// GitHub as escalate-stale asks it. Every request is logged, so a test can say
// what was written and how many pages of events were read.
function standIn(s) {
  const calls = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const path = url.pathname.replace(/^\/repos\/o\/r/, '');
      const page = Number(url.searchParams.get('page') ?? 1);
      const per = Number(url.searchParams.get('per_page') ?? 30);
      const pageOf = (all) => all.slice((page - 1) * per, page * per);
      const send = (code, json) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
      calls.push({ method: req.method, path: path + url.search, body });
      if (req.method === 'GET') {
        if (path === '/pulls/1') return send(200, { number: 1, state: 'open', labels: s.labels.map((name) => ({ name })), head: { sha: 'a'.repeat(40) }, base: { sha: 'b'.repeat(40) } });
        if (path === '/issues/1/events') return send(200, pageOf(s.events));
        if (path === '/issues/1/comments') return send(200, s.comments);
        if (path === '/pulls/1/commits') return send(200, pageOf(s.commits));
        if (path === '/pulls/1/files') return send(200, []);
      }
      if (req.method === 'POST' && path === '/issues/1/labels') return send(200, []);
      if (req.method === 'POST' && path === '/issues/1/comments') return send(201, {});
      if (req.method === 'PATCH' && path === '/issues/comments/77') return send(200, {});
      send(404, { message: `not in the stand-in: ${req.method} ${path}` });
    });
  });
  return { server, calls };
}

async function escalateStale(s, args = []) {
  const { server, calls } = standIn(s);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const out = await new Promise((resolveRun) => {
      execFile(process.execPath, [WITNESS, 'escalate-stale', ...args], {
        cwd: join(TOOLS, '..'),
        timeout: 60_000,
        env: {
          ...process.env,
          GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
          GITHUB_TOKEN: 'test', GITHUB_REPOSITORY: 'o/r', PR_NUMBER: '1',
          WITNESS_HEAD_SHA: '', TOWN_REGISTRY: '', GITHUB_OUTPUT: '',
        },
      }, (error, stdout, stderr) => resolveRun({ code: error ? (error.code ?? 1) : 0, stdout, stderr }));
    });
    return { ...out, calls };
  } finally {
    server.close();
  }
}

const writes = (r) => r.calls.filter((c) => c.method !== 'GET');
const labelsAdded = (r) => r.calls.filter((c) => c.method === 'POST' && c.path === '/issues/1/labels').flatMap((c) => JSON.parse(c.body).labels);
const commentBodies = (r) => r.calls.filter((c) => (c.method === 'PATCH' && c.path === '/issues/comments/77') || (c.method === 'POST' && c.path === '/issues/1/comments')).map((c) => JSON.parse(c.body).body);
const eventReads = (r) => r.calls.filter((c) => c.method === 'GET' && c.path.startsWith('/issues/1/events')).map((c) => c.path);

// The two verdicts. The run itself is checked first, so a crash reads as a crash
// and not as a wrong decision; the writer is live in the same harness whenever a
// test below expects `teed-up` to be added, so "nothing written" is not vacuous.
function leftAlone(r, law) {
  assert.equal(r.code, 0, `the run itself failed:\n${r.stdout}${r.stderr}`);
  assert.deepEqual(labelsAdded(r), [], `${law}\n${r.stdout}`);
  assert.deepEqual(writes(r), [], `${law} (and nothing may be written)\n${r.stdout}`);
  assert.match(r.stdout, /\bFRESH\b/, `${law}\n${r.stdout}`);
}
function handedToTheOffice(r, law) {
  assert.equal(r.code, 0, `the run itself failed:\n${r.stdout}${r.stderr}`);
  assert.deepEqual(labelsAdded(r), [TEED_UP], `${law}\n${r.stdout}`);
  assert.match(r.stdout, /\bSTALE\b/, `${law}\n${r.stdout}`);
}

const RESTARTED = /restarted by a founder's clear of `teed-up` at /;

// ── the proposal's cases ─────────────────────────────────────────────────────

// Case 1: RRR at T, a founder clears `teed-up` at T+60h, checked at T+80h.
for (const founder of [WRIGHT, KEEMIN]) {
  test(`a founder's clear inside the window leaves the PR alone: ${founder.login} (case 1)`, async () => {
    const c = clock();
    const r = await escalateStale(scenario({
      events: [labeled(c.ago(80), RRR, FERRY), unlabeled(c.ago(20), TEED_UP, founder)],
      commentAt: c.ago(80),
      headCommitAt: c.ago(82),
    }));
    leftAlone(r, `POS-842: "A founder's clear is then a "seen; it's the resident's move" that lasts another 72 h."`);
    assert.match(r.stdout, RESTARTED, 'the log must say the count started at the founder clear');
  });
}

// #4225, rebuilt from its live events. The sweep re-added `teed-up` on 10-30 at
// 22:58:01Z, 72h25m after RRR and 58h27m after wright-starforge cleared it.
test(`#4225's shape no longer re-labels: the sweep that re-added teed-up finds a founder's clear 58h old`, async () => {
  const c = clock();
  const at = (iso) => c.real(iso, '2026-10-30T22:58:01Z');
  const r = await escalateStale(scenario({
    events: [
      labeled(at('2026-10-27T13:09:37Z'), TEED_UP, REGISTRAR),
      labeled(at('2026-10-27T22:33:21Z'), RRR, FERRY),
      unlabeled(at('2026-10-28T12:31:04Z'), TEED_UP, WRIGHT),
    ],
    commentAt: at('2026-10-27T22:33:20Z'), // the witness writes its comment a second before the label (as on #4225)
    headCommitAt: at('2026-10-27T20:00:00Z'), // illustrative: the resident's last push predates the verdict
  }));
  leftAlone(r, 'POS-842: "#4225\'s shape no longer re-labels."');
  assert.match(r.stdout, RESTARTED);
});

// #4189's second cycle: the escalation rewrites the witness comment, so the
// machine clock restarts at each re-add, and a founder who clears after that
// must restart it again. Cleared 11-01 13:38:30Z, re-added at 18:55:41Z.
test(`the latest clear wins: #4189 cleared again 5h before the sweep re-added it is left alone`, async () => {
  const c = clock();
  const at = (iso) => c.real(iso, '2026-11-01T18:55:41Z');
  const r = await escalateStale(scenario({
    events: [
      labeled(at('2026-10-26T01:06:30Z'), TEED_UP, REGISTRAR),
      labeled(at('2026-10-26T10:29:49Z'), RRR, FERRY),
      unlabeled(at('2026-10-28T12:30:59Z'), TEED_UP, WRIGHT),
      labeled(at('2026-10-29T14:17:04Z'), TEED_UP, SWEEP),
      unlabeled(at('2026-11-01T13:38:30Z'), TEED_UP, WRIGHT),
    ],
    commentAt: at('2026-10-29T14:17:03Z'), // the first escalation rewrote the witness comment
    headCommitAt: at('2026-10-26T09:00:00Z'), // illustrative
  }));
  leftAlone(r, 'POS-842: "the last `unlabeled teed-up` by a founder account".');
  assert.match(r.stdout, RESTARTED);
});

// Case 2: the same, checked at T+60h+73h.
test(`a founder's clear that is itself over 72h old does not hold the PR: it escalates again (case 2)`, async () => {
  const c = clock();
  const r = await escalateStale(scenario({
    events: [labeled(c.ago(133), RRR, FERRY), unlabeled(c.ago(73), TEED_UP, WRIGHT)],
    commentAt: c.ago(133),
    headCommitAt: c.ago(135),
  }));
  handedToTheOffice(r, 'POS-842: "A PR still parked 72 h after a founder\'s clear escalates again."');
  const [comment] = commentBodies(r);
  assert.match(comment ?? '', /a founder last cleared `teed-up` `\d{4}-\d\d-\d\dT[\d:]+Z` \(the count starts there\)/, 'the comment must say why the count started at the clear');
});

// Case 3: the same as case 1, but the unlabel is not a founder's.
for (const [who, actor] of [
  ['the sweep itself', SWEEP], ['the registrar meep', REGISTRAR], ['the ferry bot', FERRY],
  ['a resident', RESIDENT], ['a deleted account (no actor)', null],
]) {
  test(`a non-founder's unlabel does not restart the clock: ${who} (case 3)`, async () => {
    const c = clock();
    const r = await escalateStale(scenario({
      events: [labeled(c.ago(80), RRR, FERRY), unlabeled(c.ago(20), TEED_UP, actor)],
      commentAt: c.ago(80),
      headCommitAt: c.ago(82),
    }));
    handedToTheOffice(r, `POS-842: "a non-founder unlabel doesn't restart the clock" (${who})`);
    assert.doesNotMatch(r.stdout, /restarted by a founder/);
  });
}

// ── who is a founder: the account, not its name ──────────────────────────────

test(`a founder's clear counts by account id, not by name: a renamed founder (same id, new login) restarts the clock`, async () => {
  const c = clock();
  const r = await escalateStale(scenario({
    events: [labeled(c.ago(80), RRR, FERRY), unlabeled(c.ago(20), TEED_UP, RENAMED_FOUNDER)],
    commentAt: c.ago(80),
    headCommitAt: c.ago(82),
  }));
  leftAlone(r, `witness.mjs: a founder is "matched by the numeric id on the issue event's actor, never by login"`);
  assert.match(r.stdout, RESTARTED);
});

test(`a founder's name is not a founder: another account on a founder's login does not restart the clock`, async () => {
  const c = clock();
  const r = await escalateStale(scenario({
    events: [labeled(c.ago(80), RRR, FERRY), unlabeled(c.ago(20), TEED_UP, OTHER_ACCOUNT_ON_A_FOUNDER_LOGIN)],
    commentAt: c.ago(80),
    headCommitAt: c.ago(82),
  }));
  handedToTheOffice(r, `witness.mjs: "a login freed and taken by someone else inherits nothing"`);
  assert.doesNotMatch(r.stdout, /restarted by a founder/);
});

// ── what else the rule reads, and what it must not ────────────────────────────

test(`putting teed-up on is not a clear: a founder's labeled event does not restart the clock`, async () => {
  const c = clock();
  const r = await escalateStale(scenario({
    events: [labeled(c.ago(80), RRR, FERRY), labeled(c.ago(20), TEED_UP, WRIGHT)],
    commentAt: c.ago(80),
    headCommitAt: c.ago(82),
  }));
  handedToTheOffice(r, 'POS-842: "the last `unlabeled teed-up` by a founder account"');
  assert.doesNotMatch(r.stdout, /restarted by a founder/);
});

test(`only teed-up counts: a founder's unlabel of another label does not restart the clock`, async () => {
  const c = clock();
  const r = await escalateStale(scenario({
    events: [labeled(c.ago(80), RRR, FERRY), unlabeled(c.ago(20), 'needs-principal', KEEMIN)],
    commentAt: c.ago(80),
    headCommitAt: c.ago(82),
  }));
  handedToTheOffice(r, 'POS-842: "the last `unlabeled teed-up` by a founder account"');
  assert.doesNotMatch(r.stdout, /restarted by a founder/);
});

test(`a founder's clear older than the machine's last word changes nothing: the count is from RRR`, async () => {
  const c = clock();
  const r = await escalateStale(scenario({
    events: [unlabeled(c.ago(110), TEED_UP, WRIGHT), labeled(c.ago(10), RRR, FERRY)],
    commentAt: c.ago(10),
    headCommitAt: c.ago(12),
  }));
  leftAlone(r, 'POS-842: "RRR and the 72 h stay" (a clear from before RRR must not pull the count back)');
  assert.doesNotMatch(r.stdout, /restarted by a founder/);
});

for (const withClear of [false, true]) {
  test(`the witness comment still restarts the count${withClear ? ', beside an older founder clear' : ''}`, async () => {
    const c = clock();
    const r = await escalateStale(scenario({
      events: [labeled(c.ago(100), RRR, FERRY), ...(withClear ? [unlabeled(c.ago(90), TEED_UP, WRIGHT)] : [])],
      commentAt: c.ago(10), // a re-route that kept the PR resident-class rewrote the comment
      headCommitAt: c.ago(102),
    }));
    leftAlone(r, 'witness.mjs § the staleness clock: "the later one wins" of the RRR label and the witness comment');
    assert.doesNotMatch(r.stdout, /restarted by a founder/);
  });
}

test(`control: with no founder clear, 73h of RRR hands the PR to the office and 71h does not (RRR and the 72h stay)`, async () => {
  const c = clock();
  const parked = (hours) => scenario({ events: [labeled(c.ago(hours), RRR, FERRY)], commentAt: c.ago(hours), headCommitAt: c.ago(hours + 2) });
  handedToTheOffice(await escalateStale(parked(73)), 'POS-842: "RRR and the 72 h stay."');
  leftAlone(await escalateStale(parked(71)), 'POS-842: "RRR and the 72 h stay."');
});

// The RRR half of the machine clock, and what `missedPush` is measured against.
// Every test above stamps the witness comment at the same moment as the RRR
// label, so none of them can tell the label from the comment: the label could
// leave the clock, or the wrong one of two labelings could win, and they would all
// still pass. The first two give the label a clock of its own (no witness comment).
test(`the RRR label is a machine clock of its own: 80h of RRR and no witness comment hands the PR to the office`, async () => {
  const c = clock();
  const r = await escalateStale(scenario({ events: [labeled(c.ago(80), RRR, FERRY)], commentAt: null, headCommitAt: c.ago(82) }));
  handedToTheOffice(r, 'witness.mjs § the staleness clock: "the RRR label going on (the verdict itself)"');
  assert.match(r.stdout, /\(label \d{4}-\d\d-\d\dT[\d:]+Z, comment n\/a\)/, 'the label, and only the label, is the clock here');
});

test(`the latest RRR label counts, not the first: labeled 200h ago and again 10h ago, no witness comment, the PR is left alone`, async () => {
  const c = clock();
  const r = await escalateStale(scenario({
    events: [labeled(c.ago(200), RRR, FERRY), unlabeled(c.ago(150), RRR, SWEEP), labeled(c.ago(10), RRR, FERRY)], // taken off, then put back
    commentAt: null,
    headCommitAt: c.ago(202),
  }));
  leftAlone(r, 'witness.mjs § labelEventClocks: "the LATEST RRR labeling"');
});

test(`a founder's restart does not hide a possibly missed push: the warning is measured against the machine's last word`, async () => {
  const c = clock();
  const r = await escalateStale(scenario({
    events: [labeled(c.ago(200), RRR, FERRY), unlabeled(c.ago(100), TEED_UP, WRIGHT)], // the count restarts at the clear, 100h ago
    commentAt: c.ago(200),
    headCommitAt: c.ago(150), // after the machine's last word, before the founder's clear
  }));
  handedToTheOffice(r, `POS-842: "A PR still parked 72 h after a founder's clear escalates again."`);
  assert.match(r.stdout, /AFTER the machine clock \(possible missed push/, 'the log line asks the machine clock, not the founder restart');
  const [comment] = commentBodies(r);
  assert.match(comment ?? '', /a founder last cleared `teed-up`/, 'the count did start at the founder clear');
  assert.match(comment ?? '', /a push exists after the last machine check/, 'witness.mjs: "asks what the CHAIN has seen, not what a founder has"');
});

test(`a founder's clear on the second page of events still counts, and the read costs the same two pages`, async () => {
  const c = clock();
  const fillers = Array.from({ length: 120 }, (_, i) => event('subscribed', c.ago(79 - i * 0.1), { actor: SWEEP }));
  const r = await escalateStale(scenario({
    events: [labeled(c.ago(80), RRR, FERRY), ...fillers, unlabeled(c.ago(20), TEED_UP, WRIGHT)], // 122 events: the clear is the last, on page 2
    commentAt: c.ago(80),
    headCommitAt: c.ago(82),
  }));
  leftAlone(r, 'witness.mjs § labelEventClocks: "Paginated: ... the one we want may not be on page 1"');
  assert.deepEqual(eventReads(r), ['/issues/1/events?per_page=100&page=1', '/issues/1/events?per_page=100&page=2'], 'one read of the events, no new call');
});

test(`a founder's clear is not a machine clock: with no RRR event and no witness comment the PR is left alone, not guessed at`, async () => {
  const c = clock();
  const r = await escalateStale(scenario({ events: [unlabeled(c.ago(100), TEED_UP, WRIGHT)], commentAt: null, headCommitAt: c.ago(120) }));
  assert.equal(r.code, 0, `the run itself failed:\n${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /no machine clock to read/, 'witness.mjs: "Not guessing an age."');
  assert.deepEqual(writes(r), []);
});

// The head push is the one term of the proposal that is NOT built here: the
// clock already follows every push the chain processed (it rewrites the witness
// comment), and an unprocessed push is the case the backstop exists for. Adding
// the head commit to the clock would make `missedPush` unreachable, so until that
// is ruled, today's behaviour is pinned.
test(`a head commit newer than the machine's last word does not restart the count: it is named in the comment, never decides`, async () => {
  const c = clock();
  const r = await escalateStale(scenario({ events: [labeled(c.ago(80), RRR, FERRY)], commentAt: c.ago(80), headCommitAt: c.ago(10) }));
  handedToTheOffice(r, 'witness.mjs § escalate-stale: "Named, not acted on ... The 72h trigger is the backstop"');
  const [comment] = commentBodies(r);
  assert.match(comment ?? '', /a push exists after the last machine check/);
});

test(`--dry-run prints the comment that names the founder's clear, and writes nothing`, async () => {
  const c = clock();
  const r = await escalateStale(scenario({
    events: [labeled(c.ago(133), RRR, FERRY), unlabeled(c.ago(73), TEED_UP, KEEMIN)],
    commentAt: c.ago(133),
    headCommitAt: c.ago(135),
  }), ['--dry-run']);
  assert.equal(r.code, 0, `the run itself failed:\n${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /DRY RUN/);
  assert.match(r.stdout, /a founder last cleared `teed-up`/);
  assert.deepEqual(writes(r), []);
});
