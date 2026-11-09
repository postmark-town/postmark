// registrar-memory-save-check.test.mjs — falsifiers for the Registrar's own-MemFS save checker (POS-774/b).
//   node --test tools/registrar-memory-save-check.test.mjs
// Zero-dep. Every fixture is a throwaway Git repo built here from SYNTHETIC text (a
// sentinel word stands where private prose would be); no live memory is read.
//
// One test per acceptance case of the checker's interface, each with complete
// before/after fixtures. The checker is read-only, so the fixtures are never reset:
// a test that needs a file gone MOVES it out of the tree, it never deletes.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  APPROVED_CEILING, CheckError, checkMemorySave, estimateTokens, exitCodeFor, findRegion, formatText,
  lettaTokens, normalizeEol, parseArgs, parseLettaTokens, readCoreWorking,
} from "./registrar-memory-save-check.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "registrar-memory-save-check.mjs");
const SENTINEL = "PRIVATE-PROSE-SENTINEL";

// ── the throwaway MemFS ────────────────────────────────────────────────────

function git(dir, ...args) {
  return execFileSync(
    "git",
    ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", "-C", dir, ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

function memfs() {
  const dir = mkdtempSync(join(tmpdir(), "save-check-"));
  git(dir, "init", "-q");
  return {
    dir,
    legacy: null,
    write(files) {
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
      }
    },
    commit(files, message = "fixture") {
      if (files) this.write(files);
      git(dir, "add", "-A");
      git(dir, "commit", "-q", "--allow-empty", "-m", message);
      return git(dir, "rev-parse", "HEAD");
    },
    head: () => git(dir, "rev-parse", "HEAD"),
    // a move out of the tree, never a delete
    moveAway(path) {
      const away = `${dir}-moved`;
      mkdirSync(away, { recursive: true });
      renameSync(join(dir, path), join(away, basename(path)));
    },
    read: (path) => readFileSync(join(dir, path), "utf8"),
  };
}

/** Exactly `bytes` ASCII characters of unique words (so no two fills are duplicates). */
function fill(bytes, seed = "xa") {
  let s = "";
  for (let i = 0; s.length < bytes; i++) s += `${seed}${i} `;
  return s.slice(0, bytes);
}

const REF = "reference/history/core-history/migration-state.md";
const stubHeading = (n) => `## Historical NORMAL${n} October22/fire${200 + n} — superseded operationally by CURRENT NORMAL${n + 2}`;
const stub = (n, ref = REF) => `${stubHeading(n)}\n\nArchived verbatim: [[${ref}]]. Dated evidence, not current work.\n\n`;
const stubBlock = (from, count) => Array.from({ length: count }, (_, i) => stub(from + 2 * i)).join("");

/** 102 + 45 = 147 approved stubs, like the live cut, as a synthetic core. */
function coreFiles(o = {}) {
  const {
    markers = true,
    checkpoint = fill(400, "cp"),
    pointer = fill(100, "pt"),
    migrationExtra = "",
    overviewExtra = "",
    persona = fill(8000, "pe"),
    other = fill(1200, "ot"),
    migStubs = stubBlock(1, 102),
    ovStubs = stubBlock(301, 45),
  } = o;
  const region = (kind, body, heading) =>
    markers ? `<!-- registrar-${kind}:start -->\n${body}\n<!-- registrar-${kind}:end -->` : `${heading}\n\n${body}`;
  return {
    "system/persona.md": `# Persona\n\n${persona}\n`,
    "system/postmark/other.md": `# Other\n\n${other}\n`,
    "system/postmark/migration-state.md": `# Current runtime state\n\n${region("current", checkpoint, "## CURRENT NORMAL17 October22/fire207 — COMPLETE")}\n\n${migrationExtra}\n\n${migStubs}`,
    "system/postmark/overview.md": `# Postmark router\n\n${region("overview", pointer, "## CURRENT NORMAL17 October22/fire207 — COMPLETE")}\n\n${overviewExtra}\n\n${ovStubs}`,
    [REF]: `${fill(2000, "ref")}\n`,
  };
}

/** persona shrinks by more than `added` bytes so a deliberate addition elsewhere is not net growth. */
const persona = (added) => fill(8000 - added - 24, "pe");

/** A baseline with legacy === HEAD, ready to be edited in the working tree. */
function baseline(o = {}) {
  const m = memfs();
  m.legacy = m.commit(coreFiles(o), "approved cut");
  return m;
}

function check(m, over = {}) {
  const { accepted = m.head(), legacy = m.legacy, ceiling = APPROVED_CEILING, total = 90000, deps } = over;
  return checkMemorySave({ memoryDir: m.dir, acceptedRef: accepted, legacyRef: legacy, ceiling }, deps ?? { lettaTokens: () => total });
}

const codes = (r) => r.violations.map((v) => v.code);
const errorCodes = (r) => r.errors.map((e) => e.code);
const assertPass = (r) => {
  assert.deepEqual({ v: r.violations, e: r.errors }, { v: [], e: [] });
  assert.equal(r.ok, true);
  assert.equal(r.status, "pass");
  assert.equal(exitCodeFor(r), 0);
};
const assertFail = (r, ...want) => {
  assert.equal(r.ok, false);
  assert.equal(r.status, "fail", JSON.stringify(r.errors));
  assert.equal(exitCodeFor(r), 1);
  for (const c of want) assert.ok(codes(r).includes(c), `${c} in ${JSON.stringify(codes(r))}`);
};
const assertError = (r, code) => {
  assert.equal(r.ok, false);
  assert.equal(r.status, "error");
  assert.equal(exitCodeFor(r), 2);
  assert.ok(errorCodes(r).includes(code), `${code} in ${JSON.stringify(r.errors)}`);
};

// ── case 1 ─────────────────────────────────────────────────────────────────

test("1. a replaced checkpoint, a short pointer and one external record, no core growth: PASS", () => {
  // HEAD: no markers yet, the old routine checkpoint is a big section outside any region.
  const m = memfs();
  m.legacy = m.commit(coreFiles({ markers: false, checkpoint: fill(6000, "old"), pointer: fill(1500, "oldp") }), "approved cut");
  // proposed (first adoption): the same state replaced by the marked region, the pointer reduced.
  const next = coreFiles({ checkpoint: fill(1800, "new"), pointer: fill(300, "newp") });
  next["system/postmark/migration-state.md"] = next["system/postmark/migration-state.md"].replace(
    "<!-- registrar-current:start -->",
    "## CURRENT NORMAL19 October23/fire209 — COMPLETE\n\n<!-- registrar-current:start -->",
  );
  m.write({ ...next, [REF]: `${fill(2000, "ref")}\n` });
  const r = check(m);
  assertPass(r);
  assert.equal(r.checkpointTokens, estimateTokens(`\n${fill(1800, "new")}\n`));
  assert.equal(r.overviewTokens, estimateTokens(`\n${fill(300, "newp")}\n`));
  assert.ok(r.canonicalAfter < r.canonicalBefore, "the proposed core is smaller");
  assert.equal(r.legacyStubCount, 147);
});

// ── case 2 ─────────────────────────────────────────────────────────────────

test("2. a CLI total one above the ceiling FAILS; exactly the ceiling passes", () => {
  const m = baseline();
  assertFail(check(m, { total: APPROVED_CEILING + 1 }), "CEILING_EXCEEDED");
  assertPass(check(m, { total: APPROVED_CEILING }));
  const r = check(m, { total: APPROVED_CEILING + 1 });
  assert.equal(r.cliTotal, APPROVED_CEILING + 1);
  assert.equal(r.violations.find((v) => v.code === "CEILING_EXCEEDED").ceiling, APPROVED_CEILING);
  // a lower ceiling tightens; a higher one is refused outright
  assertFail(check(m, { ceiling: 90000, total: 90001 }), "CEILING_EXCEEDED");
  assertPass(check(m, { ceiling: 90000, total: 90000 }));
  assertError(check(m, { ceiling: APPROVED_CEILING + 1 }), "CEILING_NOT_APPROVED");
});

// ── case 3 ─────────────────────────────────────────────────────────────────

test("3. a CLI total below the ceiling does not excuse canonical growth", () => {
  const m = baseline();
  m.write({ "system/persona.md": `# Persona\n\n${fill(8000 + 400, "pe")}\n` });
  const r = check(m, { total: 50000 });
  assertFail(r, "CORE_GREW");
  assert.ok(!codes(r).includes("CEILING_EXCEEDED"));
  const v = r.violations.find((x) => x.code === "CORE_GREW");
  assert.equal(v.after - v.before, 100);
  assert.equal(r.canonicalAfter - r.canonicalBefore, 100);
});

// ── case 4 ─────────────────────────────────────────────────────────────────

test("4. a lower accepted total tightens the next save; an older larger ref is refused", () => {
  const m = memfs();
  const big = m.commit(coreFiles({ persona: fill(4000, "pe") }), "larger");
  const small = m.commit(coreFiles({ persona: fill(1000, "pe") }), "smaller, now accepted");
  m.legacy = big;
  // between the old and the new size: under the OLD baseline, over the accepted one
  m.write({ "system/persona.md": `# Persona\n\n${fill(2000, "pe")}\n` });
  assertFail(check(m, { accepted: small }), "CORE_GREW");
  // the larger ref cannot be named as the baseline
  assertError(check(m, { accepted: big }), "ACCEPTED_REF_NOT_HEAD");
  // back at the accepted size it passes
  m.write({ "system/persona.md": `# Persona\n\n${fill(1000, "pe")}\n` });
  assertPass(check(m, { accepted: small }));
});

// ── case 5 ─────────────────────────────────────────────────────────────────

test("5. checkpoint 1200 and overview 200 pass; 1201 and 201 fail", () => {
  // content between the markers is "\n" + body + "\n": body bytes = 4 * tokens - 2
  const at = baseline({ checkpoint: fill(4798, "ca"), pointer: fill(798, "pa") });
  at.write(coreFiles({ checkpoint: fill(4798, "cb"), pointer: fill(798, "pb") }));
  const r = check(at);
  assertPass(r);
  assert.equal(r.checkpointTokens, 1200);
  assert.equal(r.overviewTokens, 200);

  const over = baseline({ checkpoint: fill(4800, "ca"), pointer: fill(800, "pa") });
  over.write(coreFiles({ checkpoint: fill(4800, "cb"), pointer: fill(800, "pb") }));
  const o = check(over);
  assertFail(o, "CHECKPOINT_TOO_LARGE", "OVERVIEW_POINTER_TOO_LARGE");
  assert.equal(o.checkpointTokens, 1201);
  assert.equal(o.overviewTokens, 201);
  assert.equal(o.violations.find((v) => v.code === "CHECKPOINT_TOO_LARGE").limit, 1200);
  assert.equal(o.violations.find((v) => v.code === "OVERVIEW_POINTER_TOO_LARGE").limit, 200);

  // each cap stands alone
  const one = baseline({ checkpoint: fill(4798, "ca"), pointer: fill(800, "pa") });
  one.write(coreFiles({ checkpoint: fill(4798, "cb"), pointer: fill(800, "pb") }));
  assert.deepEqual(codes(check(one)), ["OVERVIEW_POINTER_TOO_LARGE"]);
});

test("5b. everything between the markers counts: headings, links and whitespace", () => {
  const body = `\n## CURRENT NORMAL19 October23/fire211 — COMPLETE\n\n[[${REF}]]\n\n   \n`;
  const region = findRegion(`a\n<!-- registrar-current:start -->${body}<!-- registrar-current:end -->\nb`, "current");
  assert.equal(region.ok, true);
  assert.equal(region.content, body);
  assert.equal(estimateTokens(region.content), Math.ceil(Buffer.byteLength(body) / 4));
});

// ── case 6 ─────────────────────────────────────────────────────────────────

test("6. missing, duplicate, reversed, nested or unclosed markers are an ERROR, never a zero-size PASS", () => {
  const S = "<!-- registrar-current:start -->";
  const E = "<!-- registrar-current:end -->";
  const variants = {
    MARKER_MISSING: (t) => t.replace(S, "").replace(E, ""),
    MARKER_DUPLICATE: (t) => t + `\n${S}\nagain\n${E}\n`,
    MARKER_REVERSED: (t) => t.replace(S, "@@S").replace(E, S).replace("@@S", E),
    MARKER_NESTED: (t) => t.replace(S, `${S}\n${S}`).replace(E, `${E}\n${E}`),
    MARKER_UNCLOSED: (t) => t.replace(E, ""),
  };
  for (const [code, mutate] of Object.entries(variants)) {
    const m = baseline();
    const path = "system/postmark/migration-state.md";
    m.write({ [path]: mutate(m.read(path)) });
    const r = check(m);
    assertError(r, code);
    assert.equal(r.errors.find((e) => e.code === code).path, path);
    assert.equal(r.checkpointTokens, null, "no zero-size count is reported");
    assert.equal(r.overviewTokens, 200 > 0 ? r.overviewTokens : null);
  }
  // the overview pair is held to the same rule, and a pair in the wrong file is not guessed at
  const o = baseline();
  const ov = "system/postmark/overview.md";
  o.write({ [ov]: o.read(ov).replace("<!-- registrar-overview:end -->", "") });
  assertError(check(o), "MARKER_UNCLOSED");
  const w = baseline();
  w.write({ [ov]: `${w.read(ov)}\n<!-- registrar-current:start -->\nx\n<!-- registrar-current:end -->\n` });
  assertError(check(w), "MARKER_FOREIGN");
  const x = baseline();
  x.write({ "system/persona.md": `${x.read("system/persona.md")}\n<!-- registrar-overview:start -->\n` });
  assertError(check(x), "MARKER_FOREIGN");
});

// ── case 7 ─────────────────────────────────────────────────────────────────

test("7. all 147 unchanged approved stubs PASS; an expanded stub or new full history FAILS", () => {
  const m = baseline();
  const r = check(m);
  assertPass(r);
  assert.equal(r.legacyStubCount, 147);

  // expanding an exempt stub into a dated narrative
  const e = baseline();
  const mig = "system/postmark/migration-state.md";
  e.write({
    [mig]: e.read(mig).replace(`Archived verbatim: [[${REF}]]. Dated evidence, not current work.`, `Archived verbatim: [[${REF}]]. ${fill(500, "nar")}`),
    "system/persona.md": `# Persona\n\n${persona(540)}\n`,
  });
  const expanded = check(e);
  assertFail(expanded, "STUB_EXPANDED");
  assert.equal(expanded.violations.find((v) => v.code === "STUB_EXPANDED").path, mig);

  // a brand-new full historical section
  const n = baseline();
  n.write(coreFiles({
    migrationExtra: `## Historical NORMAL401 October23/fire250 — superseded\n\n${fill(600, "nar")}`,
    persona: persona(700),
  }));
  assertFail(check(n), "NEW_HISTORY_CHRONOLOGY");

  // retiring an obsolete stub is not an error; a new stub of the approved shape with a real target is not either
  const retire = baseline();
  retire.write(coreFiles({ migStubs: stubBlock(3, 101), migrationExtra: stub(205), persona: persona(300) }));
  assertPass(check(retire));
});

// ── case 8 ─────────────────────────────────────────────────────────────────

test("8. unchanged old doctrine and history elsewhere in core is no NEW violation", () => {
  const old = `## Prior FULL OFFICE — October12 NORMAL11/fire90, published VERIFIED\n\n${fill(700, "old")}\n\n- **Historical NORMAL05 October10/fire70** — ${fill(500, "oldb")}\n`;
  const m = baseline({ other: old });
  // the routine save changes only the marked region
  m.write(coreFiles({ other: old, checkpoint: fill(300, "next"), pointer: fill(90, "nextp") }));
  assertPass(check(m));
  // an old unit edited to be no larger is still old material
  const shrunk = old.replace(fill(700, "old"), fill(650, "old"));
  m.write(coreFiles({ other: shrunk, checkpoint: fill(300, "next"), pointer: fill(90, "nextp") }));
  assertPass(check(m));
  // but an old heading is not a licence to grow the section under it
  m.write(coreFiles({ other: old.replace(fill(700, "old"), fill(1100, "old")), persona: persona(420), checkpoint: fill(300, "next") }));
  assertFail(check(m), "NEW_HISTORY_CHRONOLOGY");
});

// ── case 9 ─────────────────────────────────────────────────────────────────

test("9. new chronology disguised as a bullet, a bold lead, a plain lead or a renamed CURRENT FAILS", () => {
  const forms = {
    "bold bullet baseline": [`- **Own-mail baseline October23 fire210** — ${fill(400, "nr")}`, "NEW_HISTORY_CHRONOLOGY"],
    "bold paragraph": [`**Historical NORMAL31 October23/fire212:** ${fill(500, "nr")}`, "NEW_HISTORY_CHRONOLOGY"],
    "plain Historical lead": [`Historical hand-over note ${fill(500, "nr")}`, "NEW_HISTORY_CHRONOLOGY"],
    "prior heading": [`### Prior round — October22 NORMAL13/fire205\n\n${fill(500, "nr")}`, "NEW_HISTORY_CHRONOLOGY"],
    "renamed CURRENT": [`## CURRENT NORMAL19 October23/fire211 — COMPLETE\n\n${fill(500, "nr")}`, "ROUTINE_OUTSIDE_REGION"],
  };
  for (const [name, [text, code]] of Object.entries(forms)) {
    const m = baseline();
    m.write(coreFiles({ migrationExtra: text, persona: persona(text.length + 4) }));
    assertFail(check(m), code);
    assert.ok(codes(check(m)).includes(code), name);
  }
  // the same CURRENT block INSIDE the marked region is the ordinary replacement
  const ok = baseline();
  ok.write(coreFiles({ checkpoint: `## CURRENT NORMAL19 October23/fire211 — COMPLETE\n\n${fill(500, "nr")}`, persona: persona(560) }));
  assertPass(check(ok));
  // short references, URLs and dates alone are not history
  const refs = baseline();
  refs.write(coreFiles({
    migrationExtra: `- Last receipt 2026-10-23 COMPLETE: [[${REF}]]\n- see https://example.invalid/receipt/2026-10-23 for fire 210`,
    persona: persona(160),
  }));
  assertPass(check(refs));
});

// ── cases 10 and 11 ────────────────────────────────────────────────────────

test("10. a new exact evidence copy FAILS, even an old block copied into a second file; two small links pass", () => {
  const block = fill(300, "ev");
  const m = baseline({ migrationExtra: block });
  // a copy of the old block into overview (outside the region)
  m.write(coreFiles({ migrationExtra: block, overviewExtra: block, persona: persona(320) }));
  const out = check(m);
  assertFail(out, "DUPLICATE_BLOCK");
  const dup = out.violations.find((v) => v.code === "DUPLICATE_BLOCK");
  assert.deepEqual(dup.paths.sort(), ["system/postmark/migration-state.md", "system/postmark/overview.md"]);
  assert.equal(dup.copies, 2);
  // the copy placed inside the overview's marked region is still a duplicate
  m.write(coreFiles({ migrationExtra: block, pointer: block, persona: persona(320) }));
  assertFail(check(m), "DUPLICATE_BLOCK");
  // new evidence written twice at once (zero before, two now)
  const fresh = baseline();
  fresh.write(coreFiles({ migrationExtra: fill(300, "nw"), overviewExtra: fill(300, "nw"), persona: persona(640) }));
  assertFail(check(fresh), "DUPLICATE_BLOCK");
  // two small links to one external record are routing, not evidence
  const links = baseline();
  links.write(coreFiles({ migrationExtra: `Detail: [[${REF}]]`, overviewExtra: `Detail: [[${REF}]]`, persona: persona(100) }));
  assertPass(check(links));
  // a long run of links is routing too, however many times it is repeated
  const run = Array.from({ length: 12 }, (_, i) => `- [[reference/postmark/a-long-record-name-${i}.md]]`).join("\n");
  const routing = baseline();
  routing.write(coreFiles({ migrationExtra: run, overviewExtra: run, persona: persona(1300) }));
  assertPass(check(routing));
});

test("11. whitespace rewrapping is still a duplicate; unchanged pre-existing duplicates force no cleanup", () => {
  const block = fill(300, "ev");
  const m = baseline({ migrationExtra: block });
  m.write(coreFiles({ migrationExtra: block, overviewExtra: block.replace(/ /g, "\n   "), persona: persona(420) }));
  assertFail(check(m), "DUPLICATE_BLOCK");

  // a duplicate that was already there is the baseline
  const old = baseline({ migrationExtra: block, overviewExtra: block });
  old.write(coreFiles({ migrationExtra: block, overviewExtra: block, checkpoint: fill(300, "next") }));
  assertPass(check(old));
  // but one more copy is new duplication
  old.write(coreFiles({ migrationExtra: block, overviewExtra: block, other: `${fill(300, "ot")}\n\n${block}`, persona: persona(400) }));
  assertFail(check(old), "DUPLICATE_BLOCK");
  // fewer copies is never a violation
  old.write(coreFiles({ migrationExtra: block }));
  assertPass(check(old));
});

// ── case 12 ────────────────────────────────────────────────────────────────

test("12. new and deleted core files enter the aggregate; overflow cannot hide in another core file", () => {
  const added = "system/postmark/added.md";
  const m = baseline({ other: fill(3000, "ot") });
  m.write({ [added]: `# Added\n\n${fill(2000, "ad")}\n` });
  const grew = check(m);
  assertFail(grew, "CORE_GREW");
  assert.equal(grew.canonicalAfter, grew.canonicalBefore + estimateTokens(`# Added\n\n${fill(2000, "ad")}\n`));

  // delete (move away) a bigger file, add a smaller one: the aggregate shrinks and the numbers say so
  const otherPath = "system/postmark/other.md";
  const otherText = m.read(otherPath);
  m.moveAway(otherPath);
  const swapped = check(m);
  assertPass(swapped);
  assert.equal(swapped.canonicalAfter, swapped.canonicalBefore - estimateTokens(otherText) + estimateTokens(`# Added\n\n${fill(2000, "ad")}\n`));

  // a new file carries no exemption: chronology in it is found, outside the marked regions
  m.write({ [added]: `# Added\n\n## Prior FULL OFFICE — October23 NORMAL21/fire213, VERIFIED\n\n${fill(600, "ad")}\n` });
  const hidden = check(m);
  assertFail(hidden, "NEW_HISTORY_CHRONOLOGY");
  assert.equal(hidden.violations.find((v) => v.code === "NEW_HISTORY_CHRONOLOGY").path, added);

  // removing every core file is not a PASS
  const none = memfs();
  none.legacy = none.commit({ "system/persona.md": "# p\n", [REF]: "x\n" });
  none.moveAway("system/persona.md");
  assertError(check(none), "NO_CORE_FILES");
});

// ── case 13 ────────────────────────────────────────────────────────────────

test("13. LF and CRLF content measure equal; the CLI total is still enforced on its own", () => {
  const files = coreFiles();
  const crlf = (t) => t.replace(/\n/g, "\r\n");
  const core = Object.entries(files).filter(([p]) => p.startsWith("system/"));

  const a = memfs(); // LF at HEAD, CRLF in the working tree (a checkout with autocrlf)
  a.legacy = a.commit(files);
  a.write(Object.fromEntries(core.map(([p, t]) => [p, crlf(t)])));
  const ra = check(a);
  assertPass(ra);
  assert.equal(ra.canonicalAfter, ra.canonicalBefore);
  assert.equal(ra.checkpointTokens, estimateTokens(`\n${fill(400, "cp")}\n`));
  assertFail(check(a, { total: APPROVED_CEILING + 1 }), "CEILING_EXCEEDED");

  const b = memfs(); // CRLF blobs at HEAD, LF in the working tree
  b.legacy = b.commit({ ...files, ...Object.fromEntries(core.map(([p, t]) => [p, crlf(t)])) });
  b.write(Object.fromEntries(core));
  const rb = check(b);
  assertPass(rb);
  assert.equal(rb.canonicalAfter, rb.canonicalBefore);
  assert.equal(normalizeEol("a\r\nb\rc"), "a\nb\rc");
});

// ── case 14 ────────────────────────────────────────────────────────────────

test("14. a missing, failing or malformed CLI, an unreadable root or ref is an ERROR, never a PASS", () => {
  const m = baseline();
  assertError(check(m, { deps: { lettaTokens: () => { throw new CheckError("CLI_FAILED", "exited 1"); } } }), "CLI_FAILED");
  // the real runner, with a command that is not installed
  assertError(check(m, { deps: { lettaTokens: (d) => lettaTokens(d, { command: "letta-is-not-installed-here" }) } }), "CLI_FAILED");
  assertError(check(m, { deps: { lettaTokens: () => "ninety thousand" } }), "CLI_MALFORMED");
  // an error is not hidden by the counts that were still measurable
  const r = check(m, { deps: { lettaTokens: () => { throw new CheckError("CLI_FAILED", "exited 1"); } } });
  assert.equal(r.cliTotal, null);
  assert.ok(r.canonicalAfter > 0);

  for (const bad of ["", "{", "[]", "{}", '{"total_tokens":"90000"}', '{"total_tokens":-1}', '{"total_tokens":1.5}', "null"]) {
    assert.throws(() => parseLettaTokens(bad), (e) => e instanceof CheckError && e.code === "CLI_MALFORMED", bad);
  }
  assert.equal(parseLettaTokens('{"total_tokens":0,"files":[]}'), 0);

  assertError(checkMemorySave({ memoryDir: join(tmpdir(), "no-such-memfs-root"), acceptedRef: m.head(), legacyRef: m.legacy, ceiling: 1 }), "UNREADABLE_ROOT");
  const plain = mkdtempSync(join(tmpdir(), "not-a-repo-"));
  assertError(checkMemorySave({ memoryDir: plain, acceptedRef: m.head(), legacyRef: m.legacy, ceiling: 1 }), "UNREADABLE_ROOT");
  assertError(check(m, { legacy: "0".repeat(40) }), "LEGACY_REF_UNRESOLVED");
  assertError(check(m, { accepted: "0".repeat(40) }), "ACCEPTED_REF_UNRESOLVED");
  assertError(check(m, { accepted: "HEAD" }), "BAD_ARGUMENT");
  assertError(check(m, { legacy: m.head().slice(0, 12) }), "BAD_ARGUMENT");
  assertError(check(m, { ceiling: 1.5 }), "BAD_ARGUMENT");
  // a core file that is not UTF-8 cannot be measured
  m.write({ "system/persona.md": "x" });
  writeFileSync(join(m.dir, "system/persona.md"), Buffer.from([0xff, 0xfe, 0xfd]));
  assertError(check(m), "UNREADABLE_INPUT");
});

// ── case 15 ────────────────────────────────────────────────────────────────

test("15. accepted-ref not HEAD, legacy-ref not an ancestor, or a change during the read: ERROR", () => {
  const m = memfs();
  const first = m.commit(coreFiles(), "first");
  m.legacy = first;
  const second = m.commit({ "system/postmark/other.md": `# Other\n\n${fill(900, "ot")}\n` }, "second");
  assertPass(check(m, { accepted: second, legacy: first }));
  assertError(check(m, { accepted: first, legacy: first }), "ACCEPTED_REF_NOT_HEAD");

  // a side commit that is not an ancestor of HEAD
  git(m.dir, "checkout", "-q", "-b", "side", first);
  const side = m.commit({ "system/postmark/other.md": `# Other\n\n${fill(500, "sd")}\n` }, "side");
  git(m.dir, "checkout", "-q", "-");
  assert.equal(m.head(), second);
  assertError(check(m, { accepted: second, legacy: side }), "LEGACY_REF_NOT_ANCESTOR");

  // HEAD moves while the CLI count runs
  const head = baseline();
  assertError(
    check(head, { deps: { lettaTokens: (d) => { git(d, "commit", "-q", "--allow-empty", "-m", "raced"); return 1000; } } }),
    "STATE_CHANGED",
  );
  // a core file changes while the CLI count runs
  const file = baseline();
  const r = check(file, {
    deps: { lettaTokens: (d) => { writeFileSync(join(d, "system/persona.md"), "# changed under the check\n"); return 1000; } },
  });
  assertError(r, "STATE_CHANGED");
  assert.equal(r.ok, false);
});

// ── case 16 ────────────────────────────────────────────────────────────────

test("16. a new missing or out-of-root retrieval target is an actionable failure; nothing is fetched", () => {
  const withPointer = (pointer, extra = {}) => coreFiles({ pointer, persona: persona(pointer.length + 4), ...extra });
  const ok = baseline();
  ok.write(withPointer(`See [[${REF}]] and [a note](${REF}) and https://example.invalid/never-fetched.`));
  assertPass(check(ok));

  const missing = baseline();
  missing.write(withPointer("See [[reference/postmark/not-written-yet.md]]."));
  const rm = check(missing);
  assertFail(rm, "LINK_TARGET_MISSING");
  const v = rm.violations.find((x) => x.code === "LINK_TARGET_MISSING");
  assert.equal(v.target, "reference/postmark/not-written-yet.md");
  assert.equal(v.path, "system/postmark/overview.md");
  assert.equal(v.region, "registrar-overview");
  assert.match(v.repair, /Save the archive or checkpoint file first/);

  // an out-of-root target is refused even though the file exists beside the repository
  const outside = baseline();
  writeFileSync(join(dirname(outside.dir), `${basename(outside.dir)}-outside.md`), "outside\n");
  for (const target of [`../${basename(outside.dir)}-outside.md`, "/etc/hosts", "C:/Windows/win.ini", "reference/../../escape.md"]) {
    outside.write(withPointer(`See [[${target}]].`));
    assertFail(check(outside), "LINK_TARGET_OUT_OF_ROOT");
  }

  // a markdown link resolves relative to its own file as well as the root
  const rel = baseline();
  rel.write({ "system/postmark/sibling.md": `# Sibling\n\n${fill(100, "sb")}\n`, ...withPointer("See [sibling](sibling.md)."), "system/persona.md": `# Persona\n\n${fill(7800, "pe")}\n` });
  assertPass(check(rel));

  // a new stub-shaped unit's target is checked too, in the checkpoint region and outside it
  const stubs = baseline();
  stubs.write(coreFiles({ migrationExtra: stub(205, "reference/history/never-written.md"), persona: persona(300) }));
  assertFail(check(stubs), "LINK_TARGET_MISSING");
  const inRegion = baseline();
  inRegion.write(coreFiles({ checkpoint: "Current state: [[reference/postmark/gone.md]]" }));
  assertFail(check(inRegion), "LINK_TARGET_MISSING");
});

// ── cases 17 and 18 ────────────────────────────────────────────────────────

function treeSnapshot(dir) {
  const rows = [];
  const walk = (rel) => {
    for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p);
      else {
        const st = statSync(join(dir, p));
        rows.push(`${p} ${st.size} ${st.mtimeMs} ${createHash("sha1").update(readFileSync(join(dir, p))).digest("hex")}`);
      }
    }
  };
  walk("");
  return rows.sort().join("\n");
}

test("17. PASS, FAIL and ERROR leave the tree and Git status identical, and print counts, not prose", () => {
  const private1 = `## Historical NORMAL401 October23/fire250 — ${SENTINEL}\n\n${SENTINEL} ${fill(600, "nar")}`;
  const scenarios = {
    pass: (m) => m.write(coreFiles({ checkpoint: fill(300, "next") })),
    fail: (m) => m.write(coreFiles({ migrationExtra: private1, overviewExtra: private1, persona: persona(1300) })),
    error: (m) => m.write({ "system/postmark/migration-state.md": `# nothing marked, ${SENTINEL}\n` }),
  };
  for (const [name, edit] of Object.entries(scenarios)) {
    const m = baseline();
    edit(m);
    const status = () => git(m.dir, "--no-optional-locks", "status", "--porcelain=v1");
    const before = { tree: treeSnapshot(m.dir), status: status() };
    const r = check(m, { total: name === "fail" ? APPROVED_CEILING + 5 : 90000 });
    assert.equal(r.status, name);
    assert.deepEqual({ tree: treeSnapshot(m.dir), status: status() }, before, `${name}: nothing was written`);
    const printed = JSON.stringify(r) + formatText(r);
    assert.ok(!printed.includes(SENTINEL), `${name}: no memory prose in the output`);
    assert.ok(!printed.includes("nar0"), `${name}: no memory prose in the output`);
  }
});

test("18. an oversized pending save fails alone; the closeout is untouched and no unsafe repair is offered", () => {
  const m = baseline();
  m.write(coreFiles({ migrationExtra: `## CURRENT NORMAL19 October23/fire211 — COMPLETE\n\n${fill(900, "nr")}` }));
  const external = join(m.dir, REF);
  const before = readFileSync(external, "utf8");
  const r = check(m, { total: APPROVED_CEILING + 400 });
  assertFail(r, "CEILING_EXCEEDED", "CORE_GREW", "ROUTINE_OUTSIDE_REGION");
  assert.equal(readFileSync(external, "utf8"), before, "the external evidence is as it was");
  const text = formatText(r);
  assert.match(text, /office closeout, public receipts and external evidence are unaffected/);
  assert.match(text, /run the check again/);
  for (const v of r.violations) {
    assert.ok(v.repair.length > 20, `${v.code} carries a repair instruction`);
    assert.doesNotMatch(v.repair, /\b(raise|disable|skip|force|bypass|override|allow-growth)\b/i, v.code);
    assert.doesNotMatch(v.repair, /delete (the )?(authority|rules|law)|discard/i, v.code);
  }
  assert.doesNotMatch(text, /\b(raise|disable|skip|force|bypass|override)\b/i);
});

// ── review of #4113: five gaps, each reproduced first ──────────────────────

test("R1. an unreadable core directory is an exit-2 ERROR, never a silently omitted subtree", () => {
  const m = baseline();
  m.write({ "system/postmark/deeper/notes.md": `# Notes\n\n${fill(200, "dp")}\n` });
  const denied = (p) => /deeper$/.test(String(p).replace(/\\/g, "/"));
  const fs = {
    readdirSync: (p, o) => {
      if (denied(p)) throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      return readdirSync(p, o);
    },
  };
  // at the core-reader boundary
  assert.throws(
    () => readCoreWorking(m.dir, fs),
    (e) => e instanceof CheckError && e.code === "UNREADABLE_INPUT" && /deeper$/.test(e.path),
  );
  // and through the whole check: both the read and the final re-read fail closed
  const r = check(m, { deps: { lettaTokens: () => 90000, fs } });
  assertError(r, "UNREADABLE_INPUT");
  assert.equal(r.ok, false);
  // a core that simply has no system/ directory is still the NO_CORE_FILES error, not a crash
  const bare = memfs();
  bare.legacy = bare.commit({ [REF]: "x\n" });
  assertError(check(bare), "NO_CORE_FILES");
});

test("R2. historical or routine content under a NESTED heading counts toward its parent", () => {
  const nestedHistory = `## Historical NORMAL401 October23/fire250 — superseded\n\n### Evidence\n\n${fill(600, "nar")}`;
  const m = baseline();
  m.write(coreFiles({ migrationExtra: nestedHistory, persona: persona(700) }));
  assertFail(check(m), "NEW_HISTORY_CHRONOLOGY");

  const deep = `## CURRENT NORMAL19 October23/fire211 — COMPLETE\n\n### Detail\n\n#### Proof\n\n${fill(500, "nar")}`;
  m.write(coreFiles({ migrationExtra: deep, persona: persona(600) }));
  assertFail(check(m), "ROUTINE_OUTSIDE_REGION");

  // the heading stops at the next heading of the same or a higher level
  const sibling = `## Historical NORMAL401 October23/fire250 — superseded\n\nSee [[${REF}]].\n\n## Another section\n\n${fill(600, "doc")}`;
  m.write(coreFiles({ migrationExtra: sibling, persona: persona(860) }));
  assertPass(check(m));

  // a nested heading INSIDE the marked region stays out of the heading's body
  const next = coreFiles({ checkpoint: `### Detail\n\n${fill(500, "nar")}`, persona: persona(560) });
  next["system/postmark/migration-state.md"] = next["system/postmark/migration-state.md"].replace(
    "<!-- registrar-current:start -->",
    "## CURRENT NORMAL19 October23/fire211 — COMPLETE\n\n<!-- registrar-current:start -->",
  );
  m.write(next);
  assertPass(check(m));
});

test("R3. one accepted occurrence grants one exemption, not two", () => {
  const old = `## Prior FULL OFFICE — October12 NORMAL11/fire90, published VERIFIED\n\n${fill(700, "old")}`;
  const m = baseline({ other: old });
  // keep the old section AND append another with the same lead and a smaller narrative
  const doubled = `${old}\n\n## Prior FULL OFFICE — October12 NORMAL11/fire90, published VERIFIED\n\n${fill(650, "new")}`;
  m.write(coreFiles({ other: doubled, persona: persona(700) }));
  const r = check(m);
  assertFail(r, "NEW_HISTORY_CHRONOLOGY");
  assert.equal(r.violations.filter((v) => v.code === "NEW_HISTORY_CHRONOLOGY").length, 1);
  // one section, edited to be no larger, still uses its single allowance
  m.write(coreFiles({ other: old.replace(fill(700, "old"), fill(650, "new")) }));
  assertPass(check(m));
  // two accepted sections of the same lead give two allowances, not three
  const twin = `${old}\n\n${old.replace(fill(700, "old"), fill(690, "twb"))}`;
  const t = baseline({ other: twin });
  t.write(coreFiles({ other: `${twin}\n\n${old.replace(fill(700, "old"), fill(500, "thr"))}`, persona: persona(560) }));
  assertFail(check(t), "NEW_HISTORY_CHRONOLOGY");
});

test("R4. an edited route on an exempt unit is still checked; unchanged routes are not re-litigated", () => {
  const m = baseline();
  const mig = "system/postmark/migration-state.md";
  const original = m.read(mig);
  const edit = (target) => ({
    [mig]: original.replace(`Archived verbatim: [[${REF}]].`, `Archived verbatim: [[${target}]].`),
    "system/persona.md": `# Persona\n\n${persona(40)}\n`,
  });
  // a legacy stub with unchanged prose but a new route
  m.write(edit("reference/history/never-written.md"));
  const missing = check(m);
  assertFail(missing, "LINK_TARGET_MISSING");
  assert.equal(missing.violations.find((v) => v.code === "LINK_TARGET_MISSING").target, "reference/history/never-written.md");
  m.write(edit("../escape.md"));
  assertFail(check(m), "LINK_TARGET_OUT_OF_ROOT");
  // the same stub pointing at a route that exists passes
  m.write(edit(REF));
  assertPass(check(m));

  // the same-lead size exemption: an old long section whose route is changed
  const old = `## Prior FULL OFFICE — October12 NORMAL11/fire90, published VERIFIED\n\n${fill(300, "old")} See [[${REF}]].`;
  const o = baseline({ other: old });
  o.write(coreFiles({ other: old.replace(`[[${REF}]]`, "[[reference/gone.md]]"), persona: persona(10) }));
  assertFail(check(o), "LINK_TARGET_MISSING");
  // untouched, it needs no re-check (the route may have been archived since)
  o.write(coreFiles({ other: old, checkpoint: fill(300, "next") }));
  assertPass(check(o));
});

test("R5. an explicit CURRENT or checkpoint lead is routine state even with no number or date", () => {
  const forms = [
    `## CURRENT checkpoint\n\n${fill(500, "nar")}`,
    `## Latest operational checkpoint\n\n${fill(500, "nar")}`,
    `**CURRENT checkpoint:** ${fill(500, "nar")}`,
    `- CURRENT COMPLETE — ${fill(500, "nar")}`,
  ];
  for (const text of forms) {
    const m = baseline();
    m.write(coreFiles({ migrationExtra: text, persona: persona(text.length + 4) }));
    assertFail(check(m), "ROUTINE_OUTSIDE_REGION");
  }
  // inside the marked region it is the ordinary replacement
  const ok = baseline();
  ok.write(coreFiles({ checkpoint: `## CURRENT checkpoint\n\n${fill(500, "nar")}`, persona: persona(560) }));
  assertPass(check(ok));
  // ordinary headings that merely contain the word "current" are not classified
  const plain = baseline();
  plain.write(coreFiles({ migrationExtra: `## Current runtime state\n\n${fill(600, "doc")}`, persona: persona(700) }));
  assertPass(check(plain));
});

test("R6. a recognized checkpoint heading INSIDE the region does not exempt its continuation AFTER the end marker", () => {
  const heading = "## CURRENT checkpoint\nCurrent work remains bounded.";
  // the region holds the heading; 800 unique bytes follow the end marker, before the next heading
  const m = baseline();
  m.write(coreFiles({ checkpoint: heading, migrationExtra: fill(800, "nar"), persona: persona(820) }));
  const r = check(m);
  assertFail(r, "ROUTINE_OUTSIDE_REGION");
  const v = r.violations.find((x) => x.code === "ROUTINE_OUTSIDE_REGION");
  assert.equal(v.path, "system/postmark/migration-state.md");
  assert.ok(v.bytes >= 790 && v.bytes <= 800, String(v.bytes));
  // the same through a nested heading that follows the end marker
  m.write(coreFiles({ checkpoint: heading, migrationExtra: `### Detail\n\n${fill(800, "nar")}`, persona: persona(840) }));
  assertFail(check(m), "ROUTINE_OUTSIDE_REGION");
  // a historical lead inside the region is held to the same boundary
  m.write(coreFiles({ checkpoint: "## Historical NORMAL19 October23/fire211\nbounded", migrationExtra: fill(800, "nar"), persona: persona(820) }));
  assertFail(check(m), "NEW_HISTORY_CHRONOLOGY");
  // a headed checkpoint wholly contained in the region still passes, and a short reference after it does too
  m.write(coreFiles({ checkpoint: `${heading}\n${fill(500, "nar")}`, persona: persona(560) }));
  assertPass(check(m));
  m.write(coreFiles({ checkpoint: heading, migrationExtra: `Detail: [[${REF}]]`, persona: persona(100) }));
  assertPass(check(m));
});

test("R7. a link-only body after the end marker, under an inside-region heading, has its route checked", () => {
  const heading = "## CURRENT checkpoint\nCurrent work remains bounded.";
  const m = memfs();
  m.legacy = m.commit({ ...coreFiles(), "system/postmark/sibling.md": `# Sibling\n\n${fill(100, "sb")}\n` });
  const withOutside = (outside) => {
    m.write(coreFiles({ checkpoint: heading, migrationExtra: outside, persona: persona(outside.length + 120) }));
  };
  // the exact reviewed case: nothing after the end marker but one missing wikilink
  withOutside("[[reference/does-not-exist.md]]");
  const r = check(m);
  assertFail(r, "LINK_TARGET_MISSING");
  assert.equal(r.violations.find((v) => v.code === "LINK_TARGET_MISSING").target, "reference/does-not-exist.md");

  const cases = {
    "bare wikilink": { valid: `[[${REF}]]`, missing: "[[reference/gone.md]]", outside: "[[../escape.md]]" },
    "bare markdown link": { valid: `[archive](${REF})`, missing: "[archive](reference/gone.md)", outside: "[archive](../escape.md)" },
  };
  for (const [name, c] of Object.entries(cases)) {
    withOutside(c.valid);
    assertPass(check(m));
    withOutside(c.missing);
    assertFail(check(m), "LINK_TARGET_MISSING");
    withOutside(c.outside);
    assertFail(check(m), "LINK_TARGET_OUT_OF_ROOT");
    assert.ok(true, name);
  }
  // a markdown link relative to its own file resolves, as elsewhere
  withOutside("[sibling](sibling.md)");
  assertPass(check(m));
  // a truly empty outside body still passes
  withOutside("");
  assertPass(check(m));
});

// ── the command line ───────────────────────────────────────────────────────

test("the command line: arguments are strict and there is no way around the gate", () => {
  const ok = ["--memory-dir", "x", "--accepted-ref", "a".repeat(40), "--legacy-ref", "b".repeat(40), "--ceiling", "100148"];
  assert.deepEqual(parseArgs(ok), { memoryDir: "x", acceptedRef: "a".repeat(40), legacyRef: "b".repeat(40), ceiling: 100148, format: "text" });
  assert.equal(parseArgs([...ok, "--format", "json"]).format, "json");
  assert.equal(parseArgs(["--memory-dir=x", ...ok.slice(2), "--format=json"]).memoryDir, "x");
  for (const extra of [["--force"], ["--allow-growth"], ["--skip", "1"], ["--ceiling", "100149", "--ceiling", "1"], ["--format", "yaml"], ["positional"]]) {
    assert.throws(() => parseArgs([...ok, ...extra]), CheckError, extra.join(" "));
  }
  for (const gone of ["--memory-dir", "--accepted-ref", "--legacy-ref", "--ceiling"]) {
    const at = ok.indexOf(gone);
    assert.throws(() => parseArgs(ok.filter((_, i) => i !== at && i !== at + 1)), CheckError, gone);
  }
  assert.throws(() => parseArgs(ok.map((a) => (a === "100148" ? "-5" : a))), CheckError);
});

test("end to end: the real script, a fake letta on PATH, exit codes 0, 1 and 2", () => {
  const bin = mkdtempSync(join(tmpdir(), "fake-letta-"));
  writeFileSync(
    join(bin, "fake-letta.mjs"),
    "const a = process.argv.slice(2);\n" +
      "if (a[0] !== 'memory' || a[1] !== 'tokens' || !a.includes('--quiet') || a[a.indexOf('--format') + 1] !== 'json') process.exit(3);\n" +
      "process.stdout.write(JSON.stringify({ total_tokens: Number(process.env.FAKE_LETTA_TOTAL), files: [] }));\n",
  );
  writeFileSync(join(bin, "letta.cmd"), '@echo off\r\nnode "%~dp0fake-letta.mjs" %*\r\n');
  writeFileSync(join(bin, "letta"), '#!/bin/sh\nexec node "$(dirname "$0")/fake-letta.mjs" "$@"\n');
  chmodSync(join(bin, "letta"), 0o755);

  const m = baseline();
  const run = (args, total) =>
    spawnSync(process.execPath, [SCRIPT, ...args], {
      encoding: "utf8",
      env: { ...process.env, PATH: bin + delimiter + process.env.PATH, FAKE_LETTA_TOTAL: String(total) },
    });
  const args = (extra = []) => ["--memory-dir", m.dir, "--accepted-ref", m.head(), "--legacy-ref", m.legacy, "--ceiling", String(APPROVED_CEILING), ...extra];

  const pass = run(args(["--format", "json"]), 90000);
  assert.equal(pass.status, 0, pass.stderr);
  const body = JSON.parse(pass.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.cliTotal, 90000);
  assert.equal(body.acceptedRef, m.head());
  assert.equal(body.legacyRef, m.legacy);
  assert.equal(body.ceiling, APPROVED_CEILING);
  assert.equal(typeof body.canonicalBefore, "number");
  assert.equal(typeof body.canonicalAfter, "number");
  assert.equal(body.checkpointTokens > 0, true);
  assert.equal(body.overviewTokens > 0, true);
  assert.deepEqual(body.violations, []);

  const text = run(args(), 90000);
  assert.equal(text.status, 0);
  assert.match(text.stdout, /registrar memory save check: PASS/);

  const over = run(args(["--format", "json"]), APPROVED_CEILING + 1);
  assert.equal(over.status, 1);
  assert.equal(JSON.parse(over.stdout).violations[0].code, "CEILING_EXCEEDED");

  const wrongLetta = run(args(["--format", "json"]), "not a number");
  assert.equal(wrongLetta.status, 2);
  assert.equal(JSON.parse(wrongLetta.stdout).errors[0].code, "CLI_MALFORMED");

  const unknown = run(args(["--force"]), 90000);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /usage:/);
  const raised = run(["--memory-dir", m.dir, "--accepted-ref", m.head(), "--legacy-ref", m.legacy, "--ceiling", "100149"], 90000);
  assert.equal(raised.status, 2);
  assert.match(raised.stdout, /CEILING_NOT_APPROVED/);
  assert.equal(run(["--help"], 1).status, 0);
});
