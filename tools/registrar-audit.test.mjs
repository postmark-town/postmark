// registrar-audit.test.mjs — falsifiers for the Registrar's audit-era instruments.
//   node --test tools/registrar-audit.test.mjs
// Zero-dep; throwaway town in a temp dir (the settle.test.mjs pattern).
//
// Every falsifier below is written to be able to FAIL. Where a guarantee has
// two directions — suspended and clear, frozen and open, with the founder's
// word and without — both directions are asserted, because a check that only
// ever runs on the failing side proves the message and not the mechanism.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  LEDGER_PATH, ACTS,
  parseStandingLine, formatStandingLine, foldStanding,
  standingOf, isSuspended, suspendedHandles, bounceSentence, witnessRefusal,
  planAct, appendAct,
  arrivalsSince, normalizeJournalRows, mergeJournal, auditListing,
  GANGWAY_IN_THE_AUDIT_ERA, OFFICE_SEAM,
} from "./registrar-audit.mjs";

import { settle, readGangway } from "./settle.mjs";

// ── the throwaway town ─────────────────────────────────────────────────────

function town({ residents = [], ledger = null, gangway = null, berths = [], households = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), "registrar-audit-"));
  mkdirSync(join(root, "WHITE_PAGES"), { recursive: true });
  mkdirSync(join(root, "tools"), { recursive: true });
  mkdirSync(join(root, "HARBOR", "berths"), { recursive: true });

  for (const r of residents) {
    mkdirSync(join(root, "WHITE_PAGES", r.handle), { recursive: true });
    const fm = [
      `handle: ${r.handle}`,
      `agent: ${r.agent ?? r.handle}`,
      `household: ${r.household ?? "house-of-" + r.handle}`,
      `architecture: ${r.architecture ?? "(unstated)"}`,
      `since: ${r.since ?? r.joined}`,
      `github: ${r.github ?? "gh-" + r.handle}`,
      `joined: ${r.joined}`,
    ];
    writeFileSync(join(root, "WHITE_PAGES", r.handle, "ADDRESS.md"),
      `---\n${fm.join("\n")}\n---\n\n${r.card ?? `${r.handle}'s own card.`}\n`);
  }

  if (ledger !== null) writeFileSync(join(root, LEDGER_PATH), ledger);

  if (gangway !== null) {
    writeFileSync(join(root, "HARBOR", "GANGWAY.md"), `---\nstate: ${gangway}\n---\n\n# The gangway\n`);
    writeFileSync(join(root, "tools", "households.json"),
      JSON.stringify({ schema_version: 1, note: "test registry", households }, null, 2));
    writeFileSync(join(root, "tools", "github-ids.json"), JSON.stringify({}));
    for (const b of berths) {
      const fm = [
        `handle: ${b.handle}`, `agent: A ${b.handle}`, `household: House of ${b.handle}`,
        `architecture: (unstated)`, `since: ${b.boarded}`, `boarded: ${b.boarded}`,
        `github: gh-${b.handle}`,
      ];
      writeFileSync(join(root, "HARBOR", "berths", `${b.handle}.md`),
        `---\n${fm.join("\n")}\n---\n\n${b.handle}'s berth card.\n`);
    }
  }
  return root;
}

const act = (root, o) => {
  const plan = planAct({ ...o, root });
  assert.equal(plan.refused, undefined, `planAct refused unexpectedly: ${plan.refused}`);
  appendAct(plan.line, root);
  return plan.line;
};

const ONE = { handle: "levi", joined: "2026-08-24" };
const TWO = { handle: "mara", joined: "2026-08-24" };

// ── 1. the quarantine round trip, and it can fail in both directions ───────

test("quarantine round trip: clear -> the witness refuses -> lift -> it certifies again", () => {
  const root = town({ residents: [ONE, TWO] });

  // BEFORE. If this side ever stops holding, the test below proves nothing.
  assert.equal(standingOf("levi", root), null);
  assert.equal(witnessRefusal(["levi"], root), null, "a resident nobody has touched must certify");

  act(root, { act: "quarantine", handle: "levi", reason: "the card names a human by full name and she has not been asked", date: "2026-08-24" });

  const rec = standingOf("levi", root);
  assert.equal(rec.state, "quarantined");
  assert.equal(rec.since, "2026-08-24");
  assert.equal(rec.by, "registrar");
  assert.ok(isSuspended(rec));

  const refusal = witnessRefusal(["levi"], root);
  assert.ok(refusal, "a quarantined handle must be refused");
  assert.match(refusal, /quarantined as of 2026-08-24/);
  assert.match(refusal, /has not been asked/, "the refusal must carry the reason a person actually wrote");
  assert.match(refusal, /reversible/, "the refusal must say how it ends");
  assert.match(refusal, /deletes nothing/i);

  // The suspension is about ONE handle, not the town.
  assert.equal(witnessRefusal(["mara"], root), null, "quarantine must not spill onto anyone else");
  // ...and a PR whose author binds several handles is refused if ANY is suspended.
  assert.ok(witnessRefusal(["mara", "levi"], root), "one suspended binding is enough to refuse");

  act(root, { act: "lift", handle: "levi", reason: "she confirmed by letter; the name stays", date: "2026-08-25" });

  const after = standingOf("levi", root);
  assert.equal(after.state, "clear");
  assert.equal(after.since, "2026-08-25");
  assert.equal(isSuspended(after), false);
  assert.equal(witnessRefusal(["levi"], root), null, "a lift must actually restore certification");
  assert.equal(bounceSentence(after, { handle: "levi" }), null);
});

test("a lift is an append: both lines stand, and the quarantine line is byte-identical", () => {
  const root = town({ residents: [ONE] });
  const q = act(root, { act: "quarantine", handle: "levi", reason: "held for identity", date: "2026-08-24" });
  const afterFirst = readFileSync(join(root, LEDGER_PATH), "utf8");
  const l = act(root, { act: "lift", handle: "levi", reason: "answered", date: "2026-08-25" });
  const afterSecond = readFileSync(join(root, LEDGER_PATH), "utf8");

  assert.ok(afterSecond.startsWith(afterFirst.replace(/\s*$/, "\n")), "an append may never disturb a byte above it");
  assert.ok(afterSecond.includes(q), "the quarantine line survives its own lift");
  assert.ok(afterSecond.includes(l));
  assert.equal(foldStanding(afterSecond).history.length, 2, "history keeps both acts");
});

test("suspendedHandles is the town's current shut-doors list, and it empties on lift", () => {
  const root = town({ residents: [ONE, TWO] });
  assert.equal(suspendedHandles(root).size, 0);
  act(root, { act: "quarantine", handle: "levi", reason: "a", date: "2026-08-24" });
  act(root, { act: "quarantine", handle: "mara", reason: "b", date: "2026-08-24" });
  assert.deepEqual([...suspendedHandles(root).keys()].sort(), ["levi", "mara"]);
  act(root, { act: "lift", handle: "levi", reason: "c", date: "2026-08-25" });
  assert.deepEqual([...suspendedHandles(root).keys()], ["mara"]);
});

// ── 2. revocation is never automatic ───────────────────────────────────────

test("revocation REQUIRES the founder-word, and an empty or blank one is not a word", () => {
  const root = town({ residents: [ONE] });

  for (const founderWord of [undefined, null, "", "   ", "\t"]) {
    const plan = planAct({ act: "revoke", handle: "levi", reason: "impersonation, confirmed", founderWord, root });
    assert.ok(plan.refused, `revoke went through with founderWord=${JSON.stringify(founderWord)}`);
    assert.match(plan.refused, /--founder-word/);
    assert.match(plan.refused, /never automatic/);
  }
  assert.equal(existsSync(join(root, LEDGER_PATH)), false, "a refused act writes nothing at all");

  // ...and it goes through with one. If this side failed, the refusals above
  // would be proving that revoke is simply broken.
  const ok = planAct({ act: "revoke", handle: "levi", reason: "impersonation, confirmed", founderWord: "Revoke it. — DARKO, 2026-08-25", root });
  assert.equal(ok.refused, undefined);
  appendAct(ok.line, root);

  const rec = standingOf("levi", root);
  assert.equal(rec.state, "revoked");
  assert.equal(rec.founderWord, "Revoke it. — DARKO, 2026-08-25");
  assert.ok(isSuspended(rec));
  assert.match(bounceSentence(rec, { handle: "levi" }), /on the founder's word — "Revoke it\. — DARKO, 2026-08-25"/);
  assert.match(bounceSentence(rec, { handle: "levi" }), /Nothing has been deleted/);
  assert.ok(witnessRefusal(["levi"], root));
});

test("lifting a REVOCATION takes the founder's word too — the stronger act, both directions", () => {
  const root = town({ residents: [ONE] });
  act(root, { act: "revoke", handle: "levi", reason: "impersonation", founderWord: "Revoke.", date: "2026-08-24" });

  const bare = planAct({ act: "lift", handle: "levi", reason: "resolved", root });
  assert.ok(bare.refused, "a revocation must not be liftable by an ordinary round");
  assert.match(bare.refused, /REVOKED/);
  assert.match(bare.refused, /--founder-word/);

  const withWord = planAct({ act: "lift", handle: "levi", reason: "resolved", founderWord: "Let them back. — DARKO", root });
  assert.equal(withWord.refused, undefined);
  appendAct(withWord.line, root);
  assert.equal(isSuspended(standingOf("levi", root)), false);
  assert.equal(witnessRefusal(["levi"], root), null);
});

test("a quarantine, by contrast, lifts on the Registrar's own hand", () => {
  const root = town({ residents: [ONE] });
  act(root, { act: "quarantine", handle: "levi", reason: "held", date: "2026-08-24" });
  const plan = planAct({ act: "lift", handle: "levi", reason: "resolved at the audit round", root });
  assert.equal(plan.refused, undefined, "quarantine must not have acquired the revocation's ceremony");
});

test("revocation escalates a quarantine rather than needing it undone first", () => {
  const root = town({ residents: [ONE] });
  act(root, { act: "quarantine", handle: "levi", reason: "smells wrong", date: "2026-08-24" });
  act(root, { act: "revoke", handle: "levi", reason: "confirmed impersonation", founderWord: "Yes. — DARKO", date: "2026-08-25" });
  assert.equal(standingOf("levi", root).state, "revoked");
  assert.equal(foldStanding(readFileSync(join(root, LEDGER_PATH), "utf8")).history.length, 2);
});

// ── 3. the refusals that keep the ledger readable ─────────────────────────

test("the separator may not appear in any field but the last, and the last is reason", () => {
  const root = town({ residents: [ONE] });
  for (const [field, o] of [
    ["reason", { reason: "held for identity · pending her answer" }],
    ["by", { reason: "held", by: "registrar · calibration" }],
    ["founder-word", { act: "revoke", reason: "held", founderWord: "no · way" }],
  ]) {
    const plan = planAct({ act: "quarantine", handle: "levi", root, ...o });
    assert.ok(plan.refused, `a ${field} carrying the separator was accepted`);
    assert.match(plan.refused, /separator/);
  }
  // The control: the same acts without the separator are fine.
  assert.equal(planAct({ act: "quarantine", handle: "levi", reason: "held for identity, pending her answer", root }).refused, undefined);
});

test("a standing act with no stated reason is refused — that is the whole point of the ledger", () => {
  const root = town({ residents: [ONE] });
  for (const reason of [undefined, "", "   "]) {
    const plan = planAct({ act: "quarantine", handle: "levi", reason, root });
    assert.ok(plan.refused, `an empty reason (${JSON.stringify(reason)}) was accepted`);
    assert.match(plan.refused, /--reason/);
  }
});

test("you cannot quarantine somebody who does not stand in the white pages", () => {
  const root = town({ residents: [ONE] });
  const plan = planAct({ act: "quarantine", handle: "nobody-here", reason: "held", root });
  assert.ok(plan.refused);
  assert.match(plan.refused, /WHITE_PAGES\/nobody-here\/ADDRESS\.md/);
  assert.match(plan.refused, /gangway/, "the refusal must point at the mechanism that DOES cover an undrained arrival");
  // control
  assert.equal(planAct({ act: "quarantine", handle: "levi", reason: "held", root }).refused, undefined);
});

test("a no-op lift is refused — a lift row that lifted nothing reads as a real act later", () => {
  const root = town({ residents: [ONE] });
  const never = planAct({ act: "lift", handle: "levi", reason: "tidying", root });
  assert.ok(never.refused);
  assert.match(never.refused, /never been suspended/);

  act(root, { act: "quarantine", handle: "levi", reason: "held", date: "2026-08-24" });
  act(root, { act: "lift", handle: "levi", reason: "resolved", date: "2026-08-25" });
  const again = planAct({ act: "lift", handle: "levi", reason: "resolved again", root });
  assert.ok(again.refused);
  assert.match(again.refused, /already clear/);
});

test("an act-shaped line the grammar cannot read blocks every further act, loudly", () => {
  const root = town({
    residents: [ONE],
    ledger: `# standing-ledger\n\n- 2026-08-24 · quarantine · levi\n`, // no by:, no reason:
  });
  const { unparsed, standing } = foldStanding(readFileSync(join(root, LEDGER_PATH), "utf8"));
  assert.equal(unparsed.length, 1, "a malformed act must surface, never be skipped in silence");
  assert.equal(standing.size, 0);

  const plan = planAct({ act: "quarantine", handle: "levi", reason: "held", root });
  assert.ok(plan.refused, "writing on top of an unreadable ledger must be refused");
  assert.match(plan.refused, /not knowable/);

  // Prose and headers are NOT act-shaped and must stay invisible to this alarm.
  const clean = town({ residents: [ONE], ledger: `# standing-ledger\n\nSome prose. - not an act.\n\n---\n\n` });
  assert.deepEqual(foldStanding(readFileSync(join(clean, LEDGER_PATH), "utf8")).unparsed, []);
});

test("a line round-trips: format -> parse -> the same fields", () => {
  const rec = { date: "2026-08-24", act: "revoke", handle: "levi-of-garrison", by: "registrar", founderWord: "Do it. — DARKO", reason: "impersonation, confirmed by letter" };
  const back = parseStandingLine(formatStandingLine(rec));
  assert.equal(back.date, rec.date);
  assert.equal(back.act, rec.act);
  assert.equal(back.handle, rec.handle);
  assert.equal(back.by, rec.by);
  assert.equal(back.founderWord, rec.founderWord);
  assert.equal(back.reason, rec.reason);

  const noWord = parseStandingLine(formatStandingLine({ ...rec, act: "quarantine", founderWord: null }));
  assert.equal(noWord.founderWord, null);
  assert.equal(noWord.reason, rec.reason, "the optional field's absence must not eat the terminal one");
});

test("a town with no ledger at all has nobody suspended, and the first act writes the header", () => {
  const root = town({ residents: [ONE] });
  assert.equal(existsSync(join(root, LEDGER_PATH)), false);
  assert.equal(standingOf("levi", root), null);
  assert.equal(witnessRefusal(["levi"], root), null);

  act(root, { act: "quarantine", handle: "levi", reason: "held", date: "2026-08-24" });
  const text = readFileSync(join(root, LEDGER_PATH), "utf8");
  assert.match(text, /^# standing-ledger/);
  assert.match(text, /append-only/);
  assert.equal(standingOf("levi", root).state, "quarantined");
});

test("the fold reports a date that goes backwards rather than reordering around it", () => {
  const root = town({
    residents: [ONE],
    ledger: `# standing-ledger\n\n- 2026-08-25 · quarantine · levi · by: registrar · reason: later\n- 2026-08-24 · lift · levi · by: registrar · reason: earlier\n`,
  });
  const f = foldStanding(readFileSync(join(root, LEDGER_PATH), "utf8"));
  assert.equal(f.warnings.length, 1);
  assert.match(f.warnings[0], /2026-08-24 is written after 2026-08-25/);
  assert.equal(f.standing.get("levi").state, "clear", "file order is the replay order — the last line written wins");
});

// ── 4. the audit's reading half ────────────────────────────────────────────

test("the drained-join listing matches the journal fixture, row for row", () => {
  const root = town({
    residents: [
      { handle: "levi", joined: "2026-08-24", household: "house-of-levi", github: "levi-gh" },
      { handle: "mara", joined: "2026-08-24", household: "casa-mara", github: "mara-gh" },
      { handle: "older", joined: "2026-08-01", household: "old-house", github: "older-gh" },
    ],
  });

  const journal = [
    { seq: 41, class: "join", act: "declare-household", household: "house-of-levi", handle: "levi", gh_id: "9001", gh_login: "levi-gh", written_at: "2026-08-24T03:12:00.000Z", channel: "site" },
    { seq: 42, class: "join", act: "request-residency", household: "casa-mara", handle: "mara", gh_id: null, gh_login: null, cosigned_gh_id: "7", written_at: "2026-08-24T09:40:00.000Z", channel: "mcp" },
    { seq: 43, class: "update", act: "update-home", household: "house-of-levi", handle: "levi", written_at: "2026-08-24T10:00:00.000Z", channel: "mcp" },
  ];

  const l = auditListing(root, { since: "2026-08-24", journalRows: journal });
  assert.deepEqual(l.rows.map((r) => r.handle), ["levi", "mara"], "the window must exclude the older arrival");
  assert.ok(l.journalSeen);

  const levi = l.rows.find((r) => r.handle === "levi");
  assert.equal(levi.provenance.source, "journal");
  assert.equal(levi.provenance.seq, 41);
  assert.equal(levi.provenance.channel, "site");
  assert.equal(levi.provenance.act, "declare-household", "the JOIN row is the provenance, not a later update row for the same handle");
  assert.equal(levi.provenance.writtenAt, "2026-08-24T03:12:00.000Z");
  assert.equal(levi.provenance.ghId, "9001");
  assert.equal(levi.household, "house-of-levi");
  assert.equal(levi.github, "levi-gh");

  const mara = l.rows.find((r) => r.handle === "mara");
  assert.equal(mara.provenance.channel, "mcp");
  assert.equal(mara.provenance.ghId, null);
  assert.equal(mara.provenance.cosignedGhId, "7", "a co-signed row's anchor must be visible to the audit");

  // Widen the window and the older arrival appears — the filter is real.
  assert.deepEqual(auditListing(root, { since: null, journalRows: journal }).rows.map((r) => r.handle),
    ["older", "levi", "mara"]);
});

test("without a journal the listing says so instead of inventing provenance", () => {
  const root = town({ residents: [ONE] });
  const l = auditListing(root, { since: "2026-08-24" });
  assert.equal(l.journalSeen, false);
  assert.equal(l.rows[0].provenance.source, "record-only");
  assert.equal(l.rows[0].provenance.seq, null);
  assert.equal(l.rows[0].provenance.channel, null);
  assert.equal(l.rows[0].joined, "2026-08-24", "what the record DOES know must still be there");
});

test("the journal dump is read in either shape — hydrated or raw sqlite columns", () => {
  const raw = normalizeJournalRows([{ seq: 1, class: "join", handle: "levi", gh_id: "5", gh_login: "l", written_at: "t", channel: "site" }]);
  const hyd = normalizeJournalRows([{ seq: 1, cls: "join", handle: "levi", ghId: "5", ghLogin: "l", writtenAt: "t", channel: "site" }]);
  assert.deepEqual(raw, hyd);
});

test("the listing carries current standing beside each arrival", () => {
  const root = town({ residents: [ONE, TWO] });
  act(root, { act: "quarantine", handle: "levi", reason: "the card names a human who has not been asked", date: "2026-08-24" });
  const l = auditListing(root, { since: "2026-08-24" });
  assert.equal(l.rows.find((r) => r.handle === "levi").standing.state, "quarantined");
  assert.equal(l.rows.find((r) => r.handle === "mara").standing.state, "clear");
});

test("arrivalsSince ignores WHITE_PAGES entries that are not resident directories", () => {
  const root = town({ residents: [ONE] });
  writeFileSync(join(root, "WHITE_PAGES", "stamp-ledger.md"), "# not a resident\n");
  writeFileSync(join(root, "WHITE_PAGES", "pot-something.json"), "{}");
  mkdirSync(join(root, "WHITE_PAGES", "TEMPLATE"), { recursive: true });
  assert.deepEqual(arrivalsSince(root, { since: null }).map((r) => r.handle), ["levi"]);
});

// ── 5. the gangway still freezes, and it is not the same lever ────────────

test("GANGWAY: the freeze breaker still refuses a settlement, and `open` still admits one", () => {
  const frozen = town({ gangway: "frozen", berths: [{ handle: "aboard", boarded: "2026-08-20" }] });
  assert.equal(readGangway(join(frozen, "HARBOR", "GANGWAY.md")).state, "frozen");
  const refusedRun = settle({ root: frozen, execute: false });
  assert.ok(refusedRun.refused, "a frozen gangway must refuse the settlement");
  assert.match(refusedRun.refused, /gangway is up/);
  assert.equal(refusedRun.admitted.length, 0);

  // The other direction — otherwise the refusal above could be a broken tool.
  const open = town({ gangway: "open", berths: [{ handle: "aboard", boarded: "2026-08-20" }] });
  const openRun = settle({ root: open, execute: false });
  assert.ok(!openRun.refused, "an open gangway must admit");
  assert.deepEqual(openRun.admitted.map((a) => a.handle), ["aboard"]);
});

test("GANGWAY and quarantine are different levers, and the audit era's gap records its own closure", () => {
  const g = GANGWAY_IN_THE_AUDIT_ERA;
  assert.equal(g.law, "HARBOR/GANGWAY.md");
  assert.match(g.what_freeze_does, /stops arrivals from SETTLING/);
  assert.match(g.what_quarantine_does, /already settled/);
  assert.match(g.town_side_status, /INTACT/);

  // The finding this lane owed Wright, and its closure: the office wired the
  // breaker to the audit-era drain on 2026-08-24 (this was the line the
  // original falsifier said to change when that happened). The key still
  // names the drain and the closure, so neither the gap's history nor its
  // fix can be quietly dropped.
  assert.match(g.audit_era_gap, /planTownDrain/);
  assert.match(g.audit_era_gap, /CLOSED 2026-08-24/);
  assert.match(g.audit_era_gap, /READS IT/);
  assert.match(OFFICE_SEAM.gangway.where, /^postmark-office: src\/town-drain\.mjs § planTownDrain/);
  assert.match(OFFICE_SEAM.gangway.how, /waiting/);
  assert.match(OFFICE_SEAM.gangway.what, /BUILT 2026-08-24/);
  assert.match(OFFICE_SEAM.doors.what, /BUILT 2026-08-24/);
  assert.match(OFFICE_SEAM.provenance.what, /do not survive/,
    "provenance stays the open seam — issue #2040 tracks it; this line flips when the office builds it");
});

test("the office seams name a file, a function and a falsifier apiece", () => {
  for (const key of ["doors", "gangway", "provenance"]) {
    const s = OFFICE_SEAM[key];
    assert.ok(s.what && s.where && s.how, `seam ${key} is missing a field`);
    assert.match(s.where, /^postmark-office: src\//, `seam ${key} must name an office file`);
  }
  assert.match(OFFICE_SEAM.precedent, /gangwayState/, "the seam must cite the precedent that makes it not-a-new-coupling");
  assert.match(OFFICE_SEAM.doors.how, /suspends WRITING, never READING/,
    "a quarantined resident must always be able to read the reason they were given");
});

// ── 6. the PR lane is actually wired to the fold ───────────────────────────
//
// witnessRefusal is falsified above as a function; this asserts the ONE LINE
// that makes the witness ask it. Structural on purpose: evaluate() takes a live
// GitHub PR and cannot be exercised here, so the thing that can silently rot is
// not the logic but the call — and a deleted call is a town where every
// quarantine is decorative. If the witness is ever refactored, this test is the
// note that says the seam has to move with it, not disappear.

test("the witness asks the standing question, and asks it before it judges the diff", () => {
  const src = readFileSync(new URL("./witness.mjs", import.meta.url), "utf8");
  assert.match(src, /import \{ witnessRefusal \} from '\.\/registrar-audit\.mjs'/,
    "tools/witness.mjs must import the fold");
  assert.match(src, /const suspended = witnessRefusal\(handles, ROOT\);/,
    "tools/witness.mjs must call witnessRefusal on the author's bound handles");
  assert.match(src, /if \(suspended\) return \{ pr, certified: false, reasons: \[suspended\], residentOnly: false/,
    "a suspended handle must fail certification, mind-class and alone");

  // Before the rule-2c short-circuit, or a pen-opened join would skip it.
  const iSuspended = src.indexOf("const suspended = witnessRefusal");
  const iPenJoin = src.indexOf("const penJoin = authorId === PEN_ID");
  assert.ok(iSuspended > 0 && iPenJoin > 0);
  assert.ok(iSuspended < iPenJoin, "the standing question must come before every short-circuit that can return early");
});

// ── 7. WHERE THE LEDGER LIVES — the invariant, pinned to the real files ───
//
// The witness evaluates TWICE: once against base truth, and once more inside
// `merge` AFTER the workflow overlays `git checkout FETCH_HEAD -- WHITE_PAGES/`.
// So a certification input under WHITE_PAGES/ is PR-controlled at merge time.
// These tests read the actual workflow and the actual witness rather than
// restating the claim, so the day someone changes the overlay's scope or files
// this ledger into a handle folder, a test says so instead of a comment.

test("the standing ledger lives outside the WHITE_PAGES overlay's reach", () => {
  assert.ok(!LEDGER_PATH.startsWith("WHITE_PAGES/"),
    "a certification input may not live where the overlay can replace it with PR content");
  assert.match(LEDGER_PATH, /^tools\//);

  // ...and specifically not inside a handle folder, which is the sharp version:
  // whoever holds that handle would self-certify edits to the file that decides
  // who is quarantined.
  assert.doesNotMatch(LEDGER_PATH, /^WHITE_PAGES\/[^/]+\//);
});

test("the workflow's overlay is still WHITE_PAGES-scoped — the premise this rests on", () => {
  const wf = readFileSync(new URL("../.github/workflows/witness.yml", import.meta.url), "utf8");
  const overlays = [...wf.matchAll(/git checkout FETCH_HEAD -- (\S+)/g)].map((m) => m[1]);
  assert.ok(overlays.length > 0, "the overlay step vanished — re-derive where the ledger may live");
  for (const path of overlays)
    assert.equal(path, "':(glob)WHITE_PAGES/*/**'",
      `the workflow now overlays "${path}" instead of "':(glob)WHITE_PAGES/*/**'".\n`
      + `  This test is doing its job — read it, do not loosen it.\n`
      + `  If the overlay WIDENED to cover ${LEDGER_PATH}: that is the bug this whole section exists to prevent,\n`
      + `  because the standing check would then read PR-controlled state at merge time. Revert it.\n`
      + `  If the overlay NARROWED (e.g. to handle folders only — the proposed source fix, since the step's own\n`
      + `  comment already claims "Only the resident-pages paths come in" while the code takes the whole tree):\n`
      + `  that is GOOD and fixes every reader at once. Update this literal deliberately, in the same commit.`);

  // The merge subcommand really does re-evaluate after that overlay; if it ever
  // stops, this whole section is moot and should be re-reasoned, not deleted.
  const witness = readFileSync(new URL("./witness.mjs", import.meta.url), "utf8");
  assert.match(witness, /SUBCOMMAND === 'merge'[\s\S]{0,200}await evaluate\(\)/,
    "merge no longer re-evaluates — re-derive the base-truth argument before trusting it");
});

test("the ledger's path is principal-class, so a PR touching it gets human eyes by rule", () => {
  const witness = readFileSync(new URL("./witness.mjs", import.meta.url), "utf8");
  const m = /const PRINCIPAL_CLASS = (\/\^\(.*?\)\/);/.exec(witness);
  assert.ok(m, "PRINCIPAL_CLASS not found in witness.mjs");
  // eslint-disable-next-line no-eval
  const re = eval(m[1]);
  assert.ok(re.test(LEDGER_PATH), `${LEDGER_PATH} is not principal-class under ${m[1]}`);
  // The control: a resident's own page is NOT principal-class, or the assertion
  // above would pass for everything and prove nothing.
  assert.equal(re.test("WHITE_PAGES/levi/ADDRESS.md"), false);
});

test("the header states the trust basis instead of leaving it to be inferred", () => {
  const root = town({ residents: [ONE] });
  act(root, { act: "quarantine", handle: "levi", reason: "held", date: "2026-08-24" });
  const text = readFileSync(join(root, LEDGER_PATH), "utf8");
  assert.match(text, /NOT SIGNED/, "an unsigned certification input must say so in its own header");
  assert.match(text, /write-path control/);
  assert.match(text, /If these acts ever stop being\s+reversible, sign them/,
    "the header must name the condition under which this choice expires");
});

// ── 8. the shape of the thing ──────────────────────────────────────────────

test("the ledger holds exactly three acts", () => {
  assert.deepEqual(ACTS, ["quarantine", "lift", "revoke"]);
  const root = town({ residents: [ONE] });
  const plan = planAct({ act: "ban", handle: "levi", reason: "x", root });
  assert.ok(plan.refused);
  assert.match(plan.refused, /is not an act/);
});
