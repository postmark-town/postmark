// registrar-memory-save-check.mjs — the Registrar's own-MemFS save checker (POS-774/b).
//
//   node tools/registrar-memory-save-check.mjs \
//     --memory-dir <own-MemFS-root> --accepted-ref <full-HEAD-sha> \
//     --legacy-ref <approved-trim-sha> --ceiling 100148 [--format json|text]
//
// Exit 0 PASS. Exit 1 a budget or structure violation. Exit 2 the check could not
// be made (unreadable input, CLI error, ambiguous or missing markers, wrong or
// racing refs). An ERROR is never a PASS.
//
// ── WHAT IT IS ─────────────────────────────────────────────────────────────
//
// A pre-commit measurement of a PROPOSED routine save to the Registrar's always
// loaded core (`system/**/*.md` in her own MemFS-v1 Git root) against the last
// accepted state, which must be the repository's current HEAD. It is the
// "contract plus size gate" ruling of 2026-10-23 (POS-774).
//
// ── WHAT IT NEVER DOES ─────────────────────────────────────────────────────
//
// It is READ-ONLY. It never trims, moves the baseline, stages, commits, checks
// out, fetches, cleans up, recompiles, writes memory, calls a model or uses the
// network, and it has no skip, force or allow-growth option and no way to raise
// the ceiling. It gates a PROPOSED core save; it never blocks the office
// closeout, a public receipt, an external evidence commit or an escalation, and
// it takes no corrective action. An operator decides the next safe edit and runs
// it again. Its output is counts, codes and paths, never memory text.
//
// ── WHAT IT MEASURES ───────────────────────────────────────────────────────
//
//  1. `letta memory tokens` total_tokens <= the approved ceiling (<= 100148).
//  2. Canonical core size (every system/**/*.md, UTF-8 bytes / 4 rounded up PER
//     FILE, CRLF read as LF) of the proposed working tree <= the same measure of
//     accepted-ref. The per-save downward ratchet.
//  3. The marked CURRENT checkpoint in system/postmark/migration-state.md <= 1200
//     and the marked overview pointer in system/postmark/overview.md <= 200.
//  4. No newly introduced full historical round/fire chronology (and no routine
//     checkpoint prose) outside the marked regions, and no newly duplicated full
//     evidence block across core. Unchanged old material is never a new violation.
//
// These are budgeting estimates, not provider input tokens.
//
// ── THE HEURISTICS, IN PLAIN WORDS (what a reader of a failure should expect) ─
//
//  * A "round unit" is a heading, or the first line of a paragraph / bullet / bold
//    lead, that is one of:
//      - a lead that opens with "Historical" (no number needed);
//      - a round identifier (NORMAL<n>, fire<n>, round <n>, a month and day, an ISO
//        date, Historical<n>) with a history word (historical, prior, previous,
//        superseded, baseline) or a state word (CURRENT, COMPLETE, PARTIAL, VERIFIED,
//        PUBLISHED, PENDING, QUIET, checkpoint, FULL OFFICE);
//      - an explicit current-state lead with NO number or date: one that opens with
//        CURRENT or Latest plus a state word, or that names a current / latest /
//        operational "checkpoint". A bare "Current runtime state" is not one.
//  * A heading's body is everything under it down to the next heading of the same or
//    a higher level, nested headings included, minus the marked region.
//  * A round unit outside the marked regions passes when it is unchanged from
//    accepted-ref, or matches an approved legacy stub exactly, or is no longer
//    than an accepted unit with the same lead, or is short (<= 200 bytes once
//    links are removed: "short references/URLs/dates alone are not history").
//    Each accepted occurrence is claimed ONCE (an exact match or a size allowance,
//    never both). Anything else is new chronology, or routine state outside the
//    regions. A unit that is new or changed but passes on one of those exemptions
//    has the local routes it carries checked like any new stub.
//  * A legacy stub is a level-2+ history heading in the two region files at
//    legacy-ref whose body is short and carries a link. Expanding one fails.
//  * Duplication is deterministic exact-block detection over paragraph, list item,
//    contiguous list and fenced blocks (whitespace collapsed, words kept) of
//    >= 256 UTF-8 bytes.
//  * An unreadable directory, entry or file under system/ is an ERROR (exit 2): a
//    subtree is never silently left out of both sides of the comparison.
//
// WHAT THIS IS NOT. It is a lexical gate, not a semantic classifier. It does not
// recognize chronology or routine state that carries none of the leads above (an
// unlabelled dated list, a narrative under an ordinary heading), paraphrased or
// reworded duplicates, or an authority change dressed as routine prose. The
// ratchet (the core may not grow) is what bounds those; review is what catches them.
//
// Design notes where the interface is silent (for the contract reviewer): refs must
// be full hex object names (no branch names or abbreviations), for both refs;
// --ceiling is required (no default); marker text inside a code fence still
// counts as a marker; a marker of the wrong kind, or in any other core file, is a
// setup ERROR; local link targets are checked for the two regions and for every
// new or changed round unit that carries one, as wikilinks relative to the MemFS
// root and as markdown links relative to the root or to their own file.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// ── constants ──────────────────────────────────────────────────────────────

export const APPROVED_CEILING = 100148;
export const CHECKPOINT_CAP = 1200;
export const OVERVIEW_CAP = 200;
export const DUPLICATE_MIN_BYTES = 256;
export const FULL_MIN_BYTES = 200;

export const MIGRATION_PATH = "system/postmark/migration-state.md";
export const OVERVIEW_PATH = "system/postmark/overview.md";
export const CHECKPOINT_KIND = "current";
export const OVERVIEW_KIND = "overview";

const HEX_REF = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i;

// ── errors ─────────────────────────────────────────────────────────────────

export class CheckError extends Error {
  constructor(code, message, path = null) {
    super(message);
    this.code = code;
    this.path = path;
  }
}

// ── pure measurement ───────────────────────────────────────────────────────

/** CRLF -> LF. The only normalization of line endings; a lone CR is left alone. */
export function normalizeEol(text) {
  return text.replace(/\r\n/g, "\n");
}

/** Budgeting estimate: ceil(UTF-8 bytes / 4) of the LF-normalized text. */
export function estimateTokens(text) {
  return Math.ceil(Buffer.byteLength(normalizeEol(text), "utf8") / 4);
}

/** Sum of per-file estimates over a Map(path -> text). */
export function canonicalTotal(core) {
  let total = 0;
  for (const text of core.values()) total += estimateTokens(text);
  return total;
}

const sha = (value) => createHash("sha256").update(value).digest("hex");
const squash = (s) => s.replace(/\s+/g, " ").trim();

// ── regions ────────────────────────────────────────────────────────────────

const MARKER_RE = /<!--\s*registrar-(current|overview):(start|end)\s*-->/g;

/**
 * Find the one ordered marker pair of `kind` in LF-normalized `text`.
 * Returns { ok: true, start, end, content } (start/end are the char range of the
 * pair including both markers) or { ok: false, code, message }.
 */
export function findRegion(text, kind) {
  const tokens = [];
  for (const m of text.matchAll(MARKER_RE)) {
    tokens.push({ kind: m[1], edge: m[2], index: m.index, endIndex: m.index + m[0].length });
  }
  const foreign = tokens.filter((t) => t.kind !== kind);
  if (foreign.length) {
    return {
      ok: false,
      code: "MARKER_FOREIGN",
      message: `A registrar-${foreign[0].kind} marker is in a file that takes only registrar-${kind} markers. Keep each marker pair in its own file.`,
    };
  }
  if (!tokens.length) {
    return {
      ok: false,
      code: "MARKER_MISSING",
      message: `Add exactly one <!-- registrar-${kind}:start --> ... <!-- registrar-${kind}:end --> pair around the ${kind === CHECKPOINT_KIND ? "current operational checkpoint" : "operational pointer"}.`,
    };
  }
  let open = null;
  const pairs = [];
  for (const t of tokens) {
    if (t.edge === "start") {
      if (open) {
        return { ok: false, code: "MARKER_NESTED", message: `Nested registrar-${kind} markers. Use one flat start/end pair.` };
      }
      open = t;
    } else {
      if (!open) {
        return { ok: false, code: "MARKER_REVERSED", message: `A registrar-${kind}:end marker comes before its start. Put start first, end second.` };
      }
      pairs.push({ start: open, end: t });
      open = null;
    }
  }
  if (open) {
    return { ok: false, code: "MARKER_UNCLOSED", message: `A registrar-${kind}:start marker has no matching end. Close the pair.` };
  }
  if (pairs.length !== 1) {
    return { ok: false, code: "MARKER_DUPLICATE", message: `${pairs.length} registrar-${kind} marker pairs found. Keep exactly one.` };
  }
  const { start, end } = pairs[0];
  return {
    ok: true,
    start: start.index,
    end: end.endIndex,
    content: text.slice(start.endIndex, end.index),
  };
}

// ── document parsing ───────────────────────────────────────────────────────

const HEADING_RE = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_RE = /^ {0,3}(?:[-*+]|\d{1,3}[.)])\s+/;
const FENCE_RE = /^\s*(```+|~~~+)/;

/**
 * Split LF-normalized text into headings and chunks (paragraphs, single list
 * items, fenced blocks). `region` is the char range of a marked pair, or null.
 * A marker line is a separator and is itself inside the region.
 */
export function parseDoc(text, region = null) {
  const lines = text.split("\n");
  const headings = [];
  const chunks = [];
  let offset = 0;
  let cur = null;
  let fence = null;
  let currentHeading = null;
  let blankSince = true;
  let prev = null;

  const inRegion = (start, len) => !!region && start < region.end && start + Math.max(len, 1) > region.start;
  const flush = () => {
    if (cur) {
      cur.text = cur.lines.join("\n");
      chunks.push(cur);
      prev = cur;
      cur = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const start = offset;
    offset += line.length + 1;
    const here = inRegion(start, line.length);

    if (fence) {
      cur.lines.push(line);
      cur.inRegion ||= here;
      if (line.trim().startsWith(fence)) {
        flush();
        fence = null;
      }
      continue;
    }
    MARKER_RE.lastIndex = 0;
    if (MARKER_RE.test(line)) {
      flush();
      blankSince = true;
      prev = null;
      continue;
    }
    const fenceOpen = FENCE_RE.exec(line);
    if (fenceOpen) {
      flush();
      fence = fenceOpen[1].slice(0, 3);
      cur = { kind: "fence", line: i + 1, lines: [line], inRegion: here, heading: currentHeading, contiguous: false };
      blankSince = false;
      continue;
    }
    const h = HEADING_RE.exec(line);
    if (h) {
      flush();
      currentHeading = { line: i + 1, level: h[1].length, text: h[2], inRegion: here };
      headings.push(currentHeading);
      blankSince = true;
      prev = null;
      continue;
    }
    if (line.trim() === "") {
      flush();
      blankSince = true;
      continue;
    }
    if (LIST_RE.test(line)) {
      flush();
      cur = {
        kind: "list",
        line: i + 1,
        lines: [line],
        inRegion: here,
        heading: currentHeading,
        contiguous: !blankSince && !!prev && prev.kind === "list" && prev.heading === currentHeading,
      };
    } else if (!cur) {
      cur = { kind: "para", line: i + 1, lines: [line], inRegion: here, heading: currentHeading, contiguous: false };
    } else {
      cur.lines.push(line);
      cur.inRegion ||= here;
    }
    blankSince = false;
  }
  flush();
  return { headings, chunks };
}

// ── links ──────────────────────────────────────────────────────────────────

const WIKILINK_RE = /\[\[([^\]\n]+)\]\]/g;
const MDLINK_RE = /\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const BARE_URL_RE = /\bhttps?:\/\/\S+/gi;

function stripLinks(text) {
  return text.replace(WIKILINK_RE, " ").replace(MDLINK_RE, " ").replace(BARE_URL_RE, " ");
}

const hasLinks = (text) => /\[\[[^\]\n]+\]\]/.test(text) || /\[[^\]\n]*\]\([^)\s]+/.test(text) || /\bhttps?:\/\//i.test(text);
const nonLinkBytes = (text) => Buffer.byteLength(squash(stripLinks(text)), "utf8");

/** Local link targets used in `text`: [{ target, kind: "wiki" | "md" }]. URLs and fragments are skipped. */
export function localLinks(text) {
  const out = [];
  const skip = (t) => !t || t.startsWith("#") || (/^[a-z][a-z0-9+.-]*:/i.test(t) && !/^[a-z]:[\\/]/i.test(t));
  for (const m of text.matchAll(WIKILINK_RE)) {
    const t = m[1].split("|")[0].split("#")[0].trim();
    if (!skip(t)) out.push({ target: t, kind: "wiki" });
  }
  for (const m of text.matchAll(MDLINK_RE)) {
    const t = m[1].split("#")[0].trim();
    if (!skip(t)) out.push({ target: t, kind: "md" });
  }
  return out;
}

function underRoot(rootReal, candidate) {
  const prefix = rootReal.endsWith(sep) ? rootReal : rootReal + sep;
  const a = process.platform === "win32" ? candidate.toLowerCase() : candidate;
  const b = process.platform === "win32" ? prefix.toLowerCase() : prefix;
  return a.startsWith(b);
}

/**
 * Check one local link target against the MemFS root. Returns null when fine, or
 * { code, target }. Never reads a URL and never leaves the root.
 */
export function checkLinkTarget(rootReal, fromPath, { target, kind }) {
  if (isAbsolute(target) || /^[a-z]:[\\/]/i.test(target) || target.startsWith("/") || target.startsWith("\\")) {
    return { code: "LINK_TARGET_OUT_OF_ROOT", target };
  }
  const bases = kind === "md" ? ["", posix.dirname(fromPath)] : [""];
  let escaped = false;
  for (const base of bases) {
    const rel = posix.normalize(posix.join(base, target.replace(/\\/g, "/")));
    if (rel === ".." || rel.startsWith("../")) {
      escaped = true;
      continue;
    }
    for (const candidate of [rel, rel + ".md"]) {
      const full = join(rootReal, candidate);
      if (!existsSync(full)) continue;
      let real;
      try {
        real = realpathSync(full);
      } catch {
        continue;
      }
      if (!underRoot(rootReal, real)) return { code: "LINK_TARGET_OUT_OF_ROOT", target };
      return null;
    }
  }
  return { code: escaped ? "LINK_TARGET_OUT_OF_ROOT" : "LINK_TARGET_MISSING", target };
}

// ── round units (chronology) ───────────────────────────────────────────────

const ROUND_ID =
  /\bNORMAL\s?\d{1,3}\b|\bfire\s?#?\d{1,4}\b|\bround\s?#?\d{1,4}\b|\bhistoric(?:al)?\s?\d{1,3}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s?\d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b/i;
const HISTORY_WORD = /\bhistoric(?:al)?(?![a-z])|\bprior\b|\bprevious\b|\bsuperseded\b|\bbaseline\b/i;
const STATE_WORD = /\bCURRENT\b|\bCOMPLETED?\b|\bPARTIAL\b|\bVERIFIED\b|\bPUBLISHED\b|\bPENDING\b|\bQUIET\b|\bcheckpoint\b|\bFULL OFFICE\b/i;

const CHECKPOINT_STATE = /\bCOMPLETED?\b|\bPARTIAL\b|\bVERIFIED\b|\bPUBLISHED\b|\bPENDING\b|\bQUIET\b|\bcheckpoint\b|\bFULL OFFICE\b/i;

export function classifyLead(lead) {
  if (/^historic(?:al)?(?![a-z])/i.test(lead)) return "history"; // a lead that opens with "Historical" needs no round id
  if (!ROUND_ID.test(lead)) {
    // An explicit current-state lead needs no number or date either: "CURRENT ... checkpoint",
    // "CURRENT COMPLETE", "Latest operational checkpoint". A bare "Current runtime state" is not one.
    if (/^(?:current|latest)\b/i.test(lead) && CHECKPOINT_STATE.test(lead)) return "routine";
    if (/\bcheckpoint\b/i.test(lead) && /\b(?:current|latest|operational)\b/i.test(lead)) return "routine";
    return null;
  }
  if (HISTORY_WORD.test(lead)) return "history";
  if (STATE_WORD.test(lead)) return "routine";
  return null;
}

function cleanLead(line) {
  return squash(line.replace(/^\s*>?\s*/, "").replace(LIST_RE, "").replace(/[*_`]/g, "")).slice(0, 160);
}

/** Every round-shaped unit in a parsed document. */
export function roundUnits(doc) {
  const units = [];
  // A heading's body is everything under it OUTSIDE the marked region, down to the next
  // heading of the same or a higher level (nested headings are part of the section). A
  // heading kept above the region is a label for it; the region has its own cap.
  const familyOf = (h) => {
    const family = new Set([h]);
    for (let j = doc.headings.indexOf(h) + 1; j < doc.headings.length && doc.headings[j].level > h.level; j++) family.add(doc.headings[j]);
    return family;
  };
  for (const h of doc.headings) {
    const kind = classifyLead(squash(h.text.replace(/[*_`]/g, "")));
    if (!kind) continue;
    const family = familyOf(h);
    const body = doc.chunks.filter((c) => family.has(c.heading) && !c.inRegion).map((c) => c.text).join("\n");
    units.push({
      type: "heading",
      kind,
      line: h.line,
      level: h.level,
      lead: squash(h.text.replace(/[*_`]/g, "")),
      bodyNorm: squash(body),
      size: nonLinkBytes(body),
      outside: body.trim() !== "", // any content after the end marker, links included
      linked: hasLinks(body),
      inRegion: h.inRegion,
      heading: h,
      family,
      parent: null,
      links: body,
    });
  }
  for (const c of doc.chunks) {
    const lead = cleanLead(c.lines[0]);
    const kind = classifyLead(lead);
    if (!kind) continue;
    units.push({
      type: "chunk",
      kind,
      line: c.line,
      lead,
      bodyNorm: squash(c.text),
      size: nonLinkBytes(c.text),
      linked: hasLinks(c.text),
      inRegion: c.inRegion,
      parent: c.heading,
      links: c.text,
    });
  }
  return units;
}

/** The approved stubs: short, linked, history-led headings (level 2+) in a legacy document. */
export function extractStubs(text) {
  const doc = parseDoc(normalizeEol(text), null);
  const stubs = [];
  for (const u of roundUnits(doc)) {
    if (u.type === "heading" && u.kind === "history" && u.level >= 2 && u.linked && u.size <= FULL_MIN_BYTES) stubs.push(u);
  }
  return stubs;
}

const unitKey = (u) => `${u.kind}\u0000${u.lead}\u0000${u.bodyNorm}`;

/**
 * Chronology violations of one proposed file's units, against the accepted core's
 * units and the legacy stubs. `pool` carries consumable accepted state shared
 * across files; `newStubs` collects new short units whose links must be checked.
 */
function chronologyViolations(path, units, pool, stubs, newStubs) {
  const violations = [];
  const flagged = new Set();
  const flag = (u) => {
    for (const h of u.family ?? []) flagged.add(h);
  };
  const ordered = [...units.filter((u) => u.type === "heading"), ...units.filter((u) => u.type === "chunk")];
  for (const u of ordered) {
    // A unit wholly inside the region is the region's business (its own cap). A recognized
    // heading inside the region still owns whatever continues after the end marker, so its
    // outside-the-region body is checked as routine content.
    if (u.inRegion && !(u.type === "heading" && u.outside)) continue;
    if (u.type === "chunk" && u.parent && flagged.has(u.parent)) continue;

    // an accepted occurrence is claimed once: exactly, or by the same-lead size allowance
    const accepted = pool.get(u.lead) ?? [];
    const exact = accepted.find((a) => !a.used && a.key === unitKey(u));
    if (exact) {
      exact.used = true;
      continue;
    }
    // from here on the unit is new or changed, so any route it carries is checked
    const exempt = () => {
      if (u.linked) newStubs.push({ path, unit: u });
    };
    const legacy = stubs.get(u.lead);
    if (u.type === "heading" && legacy) {
      if (legacy.some((s) => s.bodyNorm === u.bodyNorm)) {
        exempt();
        continue;
      }
      if (u.size > Math.min(...legacy.map((s) => s.size))) {
        violations.push({
          code: "STUB_EXPANDED",
          path,
          line: u.line,
          bytes: u.size,
          repair:
            "An approved retrieval stub was expanded into narrative. Put the detail once in its dated external reference and keep only the heading and the link.",
        });
        flag(u);
        continue;
      }
      exempt();
      continue;
    }
    let fit = null;
    for (const a of accepted) if (!a.used && a.size >= u.size && (!fit || a.size < fit.size)) fit = a;
    if (fit) {
      fit.used = true;
      exempt();
      continue;
    }
    if (u.size <= FULL_MIN_BYTES) {
      exempt();
      continue;
    }
    violations.push(
      u.kind === "history"
        ? {
            code: "NEW_HISTORY_CHRONOLOGY",
            path,
            line: u.line,
            bytes: u.size,
            repair:
              "New full dated round history in core. Save the detail once in its dated external reference and keep at most a heading with a retrieval link.",
          }
        : {
            code: "ROUTINE_OUTSIDE_REGION",
            path,
            line: u.line,
            bytes: u.size,
            repair:
              "New routine checkpoint prose outside the marked regions. Replace the current state inside the marked region, keep detail once in the dated external reference, or ask for review of genuinely non-routine state.",
          },
    );
    flag(u);
  }
  return violations;
}

// ── duplicate blocks ───────────────────────────────────────────────────────

const stripMarker = (line) => line.replace(LIST_RE, "");

/** Normalized, hashed blocks of one text: [{ hash, bytes, line }]. */
export function evidenceBlocks(text) {
  const doc = parseDoc(normalizeEol(text), null);
  const out = [];
  const push = (norm, line) => {
    const bytes = Buffer.byteLength(norm, "utf8");
    if (bytes < DUPLICATE_MIN_BYTES) return;
    if (!/[\p{L}\p{N}]/u.test(stripLinks(norm))) return; // link-only routing stub
    out.push({ hash: sha(norm).slice(0, 12), bytes, line });
  };
  const closeGroup = (group) => {
    if (group && group.items.length > 1) push(group.items.join(" "), group.line);
  };
  let group = null;
  for (const c of doc.chunks) {
    if (c.kind === "list") {
      const item = squash(c.lines.map((l, i) => (i === 0 ? stripMarker(l) : l)).join("\n"));
      push(item, c.line);
      if (c.contiguous && group) group.items.push(item);
      else {
        closeGroup(group);
        group = { line: c.line, items: [item] };
      }
      continue;
    }
    closeGroup(group);
    group = null;
    if (c.kind === "fence") {
      const closed = c.lines.length > 1 && /^\s*(```|~~~)/.test(c.lines[c.lines.length - 1]);
      push(squash(c.lines.slice(1, closed ? -1 : undefined).join("\n")), c.line);
    } else {
      push(squash(c.text), c.line);
    }
  }
  closeGroup(group);
  return out;
}

function blockIndex(core) {
  const index = new Map();
  for (const [path, text] of core) {
    for (const b of evidenceBlocks(text)) {
      let e = index.get(b.hash);
      if (!e) index.set(b.hash, (e = { bytes: b.bytes, count: 0, where: new Map() }));
      e.count += 1;
      if (!e.where.has(path)) e.where.set(path, b.line);
    }
  }
  return index;
}

// ── git (read-only) ────────────────────────────────────────────────────────

const GIT_ENV = { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINOLOGY_PROMPT: "0", LC_ALL: "C" };

function git(dir, args, { okCodes = [0], input } = {}) {
  const r = spawnSync("git", ["-C", dir, ...args], {
    env: GIT_ENV,
    input,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    maxBuffer: 512 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.error) throw new CheckError("GIT_FAILED", `git could not run (${r.error.code ?? "error"}).`);
  if (!okCodes.includes(r.status)) {
    const e = new CheckError("GIT_FAILED", `git ${args[0]} failed (exit ${r.status}).`);
    e.status = r.status;
    throw e;
  }
  return { out: r.stdout, status: r.status };
}

const gitText = (dir, args) => git(dir, args).out.toString("utf8").trim();

function decode(bytes, path) {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new CheckError("UNREADABLE_INPUT", "A core file is not valid UTF-8.", path);
  }
}

/** Core (system/**\/*.md) at `ref`: Map(path -> LF-normalized text). One ls-tree and one cat-file --batch. */
export function readCoreAt(dir, ref) {
  const listing = git(dir, ["ls-tree", "-r", "-z", ref, "--", "system"]).out.toString("utf8");
  const wanted = [];
  for (const entry of listing.split("\0")) {
    if (!entry) continue;
    const tab = entry.indexOf("\t");
    const [mode, type, oid] = entry.slice(0, tab).split(" ");
    const path = entry.slice(tab + 1);
    if (type !== "blob" || mode === "120000" || !path.toLowerCase().endsWith(".md")) continue;
    wanted.push({ oid, path });
  }
  const core = new Map();
  if (!wanted.length) return core;
  const out = git(dir, ["cat-file", "--batch"], { input: wanted.map((w) => w.oid).join("\n") + "\n" }).out;
  let at = 0;
  for (const w of wanted) {
    const eol = out.indexOf(0x0a, at);
    const header = eol < 0 ? [] : out.subarray(at, eol).toString("utf8").split(" ");
    const size = Number(header[2]);
    if (header[1] !== "blob" || !Number.isInteger(size)) {
      throw new CheckError("UNREADABLE_INPUT", "A core file could not be read from Git.", w.path);
    }
    core.set(w.path, normalizeEol(decode(out.subarray(eol + 1, eol + 1 + size), w.path)));
    at = eol + 1 + size + 1;
  }
  return core;
}

/**
 * Core in the working tree: { core: Map(path -> LF text), hashes: Map(path -> sha256 of raw bytes) }.
 * Any directory, entry or file that cannot be read is an UNREADABLE_INPUT error: a subtree
 * that quietly drops out would make both sides of the comparison agree on a smaller core.
 * Only a missing top-level system/ is tolerated (the caller reports NO_CORE_FILES).
 * `io` is for tests (a simulated read error); the command line never sets it.
 */
export function readCoreWorking(dir, io = {}) {
  const { readdirSync: ls = readdirSync, lstatSync: stat = lstatSync, readFileSync: read = readFileSync } = io;
  const core = new Map();
  const hashes = new Map();
  const unreadable = (what, path) => new CheckError("UNREADABLE_INPUT", `${what} could not be read.`, path);
  const walk = (rel) => {
    let entries;
    try {
      entries = ls(join(dir, rel), { withFileTypes: true });
    } catch (e) {
      if (rel === "system" && e && e.code === "ENOENT") return;
      throw unreadable("A core directory", rel);
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const child = rel + "/" + e.name;
      let st;
      try {
        st = stat(join(dir, child));
      } catch {
        throw unreadable("A core entry", child);
      }
      if (st.isSymbolicLink()) throw new CheckError("UNREADABLE_INPUT", "A symbolic link inside system/ cannot be checked.", child);
      if (st.isDirectory()) walk(child);
      else if (st.isFile() && e.name.toLowerCase().endsWith(".md")) {
        let bytes;
        try {
          bytes = read(join(dir, child));
        } catch {
          throw unreadable("A core file", child);
        }
        hashes.set(child, sha(bytes));
        core.set(child, normalizeEol(decode(bytes, child)));
      }
    }
  };
  walk("system");
  return { core, hashes };
}

function snapshotWorking(dir, io) {
  const { hashes } = readCoreWorking(dir, io);
  return { head: gitText(dir, ["rev-parse", "HEAD"]), files: [...hashes].map(([p, h]) => `${p}\u0000${h}`).join("\n") };
}

// ── the letta CLI ──────────────────────────────────────────────────────────

/** Validate `letta memory tokens --format json` stdout. Throws CheckError CLI_MALFORMED. */
export function parseLettaTokens(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new CheckError("CLI_MALFORMED", "The letta token count was not valid JSON.");
  }
  const total = parsed && parsed.total_tokens;
  if (!Number.isInteger(total) || total < 0) {
    throw new CheckError("CLI_MALFORMED", "The letta token count had no non-negative integer total_tokens.");
  }
  return total;
}

/** Run `letta memory tokens` read-only. `command` is overridable for tests only (never from the CLI). */
export function lettaTokens(memoryDir, { command = "letta" } = {}) {
  if (/["%\r\n\0]/.test(memoryDir)) throw new CheckError("BAD_ARGUMENT", "The memory directory path has a character that cannot be passed safely.");
  if (!/^[\w.-]+$/.test(command)) throw new CheckError("BAD_ARGUMENT", "The letta command name is not a plain name.");
  const common = { encoding: "utf8", timeout: 120000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 };
  // Windows runs npm shims (letta.cmd) through cmd.exe: one verbatim command line, no shell option.
  const r =
    process.platform === "win32"
      ? spawnSync(
          process.env.ComSpec || "cmd.exe",
          ["/d", "/s", "/c", `"${command} memory tokens --memory-dir "${memoryDir}" --format json --quiet"`],
          { ...common, windowsVerbatimArguments: true },
        )
      : spawnSync(command, ["memory", "tokens", "--memory-dir", memoryDir, "--format", "json", "--quiet"], common);
  if (r.error) throw new CheckError("CLI_FAILED", `The letta token count could not run (${r.error.code ?? "error"}).`);
  if (r.status !== 0) throw new CheckError("CLI_FAILED", `The letta token count exited ${r.status}.`);
  return parseLettaTokens(r.stdout);
}

// ── the check ──────────────────────────────────────────────────────────────

const samePath = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);

/**
 * Check a proposed own-MemFS save. Never throws for a check outcome; the result
 * carries `errors[]` (exit 2) and `violations[]` (exit 1).
 * `deps.lettaTokens(dir)` returns the CLI total (tests inject it; the CLI never does).
 */
export function checkMemorySave({ memoryDir, acceptedRef, legacyRef, ceiling }, deps = {}) {
  const result = {
    ok: false,
    status: "error",
    acceptedRef: acceptedRef ?? null,
    legacyRef: legacyRef ?? null,
    ceiling: ceiling ?? null,
    cliTotal: null,
    canonicalBefore: null,
    canonicalAfter: null,
    checkpointTokens: null,
    overviewTokens: null,
    limits: { checkpoint: CHECKPOINT_CAP, overview: OVERVIEW_CAP },
    legacyStubCount: null,
    violations: [],
    errors: [],
  };
  const fail = (e) => {
    if (!(e instanceof CheckError)) throw e;
    result.errors.push({ code: e.code, ...(e.path ? { path: e.path } : {}), message: e.message });
  };
  const violate = (v) => result.violations.push(v);

  try {
    // 1. arguments and refs
    if (!Number.isInteger(ceiling) || ceiling < 0) throw new CheckError("BAD_ARGUMENT", "--ceiling must be a non-negative integer.");
    if (ceiling > APPROVED_CEILING) {
      throw new CheckError("CEILING_NOT_APPROVED", `--ceiling above ${APPROVED_CEILING} is not accepted by this version; a higher ceiling needs explicit review.`);
    }
    for (const [name, value] of [["--accepted-ref", acceptedRef], ["--legacy-ref", legacyRef]]) {
      if (typeof value !== "string" || !HEX_REF.test(value)) throw new CheckError("BAD_ARGUMENT", `${name} must be a full commit id (40 or 64 hex characters).`);
    }
    if (typeof memoryDir !== "string" || !memoryDir) throw new CheckError("BAD_ARGUMENT", "--memory-dir is required.");
    const dir = resolve(memoryDir);
    let rootReal;
    try {
      if (!statSync(dir).isDirectory()) throw new Error("not a directory");
      rootReal = realpathSync(dir);
    } catch {
      throw new CheckError("UNREADABLE_ROOT", "The memory directory does not exist or is not a directory.");
    }
    if (!existsSync(join(dir, ".git"))) throw new CheckError("UNREADABLE_ROOT", "The memory directory is not a Git root.");
    const toplevel = gitText(dir, ["rev-parse", "--show-toplevel"]);
    if (!samePath(realpathSync(toplevel), rootReal)) throw new CheckError("UNREADABLE_ROOT", "The memory directory is not the root of its Git repository.");

    const head = gitText(dir, ["rev-parse", "--verify", "HEAD^{commit}"]);
    const resolveCommit = (ref, code) => {
      try {
        return gitText(dir, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
      } catch {
        throw new CheckError(code, "The ref does not resolve to a commit in this repository.");
      }
    };
    const accepted = resolveCommit(acceptedRef, "ACCEPTED_REF_UNRESOLVED");
    if (accepted !== head) {
      throw new CheckError("ACCEPTED_REF_NOT_HEAD", "accepted-ref is not the current HEAD. The proposed save is checked against HEAD only; an older, larger baseline is never used.");
    }
    const legacy = resolveCommit(legacyRef, "LEGACY_REF_UNRESOLVED");
    const anc = git(dir, ["merge-base", "--is-ancestor", legacy, accepted], { okCodes: [0, 1] });
    if (anc.status !== 0) throw new CheckError("LEGACY_REF_NOT_ANCESTOR", "legacy-ref is not an ancestor of accepted-ref.");
    result.acceptedRef = accepted;
    result.legacyRef = legacy;

    // 2. inputs, read once; the same bytes are measured and later re-hashed
    const before = snapshotWorking(dir, deps.fs);
    if (before.head !== head) throw new CheckError("STATE_CHANGED", "HEAD moved while the check started.");
    const acceptedCore = readCoreAt(dir, accepted);
    const working = readCoreWorking(dir, deps.fs);
    const proposed = working.core;
    if (!proposed.size) throw new CheckError("NO_CORE_FILES", "No system/**/*.md core files were found in the working tree.");

    result.canonicalBefore = canonicalTotal(acceptedCore);
    result.canonicalAfter = canonicalTotal(proposed);

    // 3. the CLI total against the fixed ceiling
    try {
      result.cliTotal = (deps.lettaTokens ?? ((d) => lettaTokens(d)))(dir);
      if (!Number.isInteger(result.cliTotal) || result.cliTotal < 0) throw new CheckError("CLI_MALFORMED", "The letta token count was not a non-negative integer.");
    } catch (e) {
      fail(e);
    }
    if (result.cliTotal !== null && result.cliTotal > ceiling) {
      violate({
        code: "CEILING_EXCEEDED",
        path: null,
        cliTotal: result.cliTotal,
        ceiling,
        repair:
          "The letta token total is above the approved ceiling. Replace the current state, move full detail once to its dated external reference, and keep a retrieval pointer; ask for review if the state is genuinely non-routine.",
      });
    }

    // 4. the per-save downward ratchet
    if (result.canonicalAfter > result.canonicalBefore) {
      violate({
        code: "CORE_GREW",
        path: null,
        before: result.canonicalBefore,
        after: result.canonicalAfter,
        repair:
          "The proposed core is larger than the accepted save. Replace rather than append, move detail once to its dated external reference, and keep a retrieval pointer.",
      });
    }

    // 5. the two marked regions
    const regions = new Map();
    let markerErrors = 0;
    for (const [path, kind, cap, field, code] of [
      [MIGRATION_PATH, CHECKPOINT_KIND, CHECKPOINT_CAP, "checkpointTokens", "CHECKPOINT_TOO_LARGE"],
      [OVERVIEW_PATH, OVERVIEW_KIND, OVERVIEW_CAP, "overviewTokens", "OVERVIEW_POINTER_TOO_LARGE"],
    ]) {
      if (!proposed.has(path)) {
        markerErrors++;
        fail(new CheckError("MARKER_FILE_MISSING", "The file that holds this marked region is missing.", path));
        continue;
      }
      const r = findRegion(proposed.get(path), kind);
      if (!r.ok) {
        markerErrors++;
        fail(new CheckError(r.code, r.message, path));
        continue;
      }
      regions.set(path, r);
      result[field] = estimateTokens(r.content);
      if (result[field] > cap) {
        violate({
          code,
          path,
          region: `registrar-${kind}`,
          tokens: result[field],
          limit: cap,
          repair:
            kind === CHECKPOINT_KIND
              ? "Replace the current checkpoint instead of adding to it; keep full detail once in the dated external reference and leave a retrieval pointer."
              : "Keep the overview a short pointer to the current checkpoint and the external record; do not repeat the evidence.",
        });
      }
    }
    // a registrar marker anywhere else in core would make a region ambiguous
    for (const [path, text] of proposed) {
      if (path === MIGRATION_PATH || path === OVERVIEW_PATH) continue;
      if (new RegExp(MARKER_RE.source).test(text)) {
        markerErrors++;
        fail(new CheckError("MARKER_FOREIGN", "A registrar marker is in a core file that takes none.", path));
      }
    }

    // 6. chronology and routine prose outside the regions (needs valid regions)
    if (!markerErrors) {
      const stubs = new Map();
      let stubCount = 0;
      let legacyCore = new Map();
      try {
        legacyCore = legacy === accepted ? acceptedCore : readCoreAt(dir, legacy);
      } catch (e) {
        fail(e);
      }
      for (const path of [MIGRATION_PATH, OVERVIEW_PATH]) {
        const text = legacyCore.get(path);
        if (text === undefined) continue;
        for (const s of extractStubs(text)) {
          if (!stubs.has(s.lead)) stubs.set(s.lead, []);
          stubs.get(s.lead).push(s);
          stubCount++;
        }
      }
      result.legacyStubCount = stubCount;

      // each accepted occurrence can be claimed ONCE, by an exact match or by the
      // same-lead size allowance, never both
      const pool = new Map();
      for (const text of acceptedCore.values()) {
        for (const u of roundUnits(parseDoc(text, null))) {
          if (!pool.has(u.lead)) pool.set(u.lead, []);
          pool.get(u.lead).push({ key: unitKey(u), size: u.size, used: false });
        }
      }
      const newStubs = [];
      for (const [path, text] of proposed) {
        const region = regions.get(path);
        const doc = parseDoc(text, region ? { start: region.start, end: region.end } : null);
        for (const v of chronologyViolations(path, roundUnits(doc), pool, stubs, newStubs)) violate(v);
      }

      // 7. local retrieval targets the new regions and new stubs rely on
      const seen = new Set();
      const checkLinks = (path, line, region, text) => {
        for (const link of localLinks(text)) {
          const key = `${path}\u0000${link.target}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const bad = checkLinkTarget(rootReal, path, link);
          if (bad) {
            violate({
              code: bad.code,
              path,
              ...(region ? { region } : {}),
              line,
              target: bad.target,
              repair:
                bad.code === "LINK_TARGET_OUT_OF_ROOT"
                  ? "A retrieval link points outside the MemFS root. Link only to a record inside your own MemFS."
                  : "A retrieval link points at a file that does not exist in the MemFS. Save the archive or checkpoint file first, then point at it.",
            });
          }
        }
      };
      for (const [path, region] of regions) {
        const before = proposed.get(path).slice(0, region.start).split("\n").length;
        checkLinks(path, before, `registrar-${path === MIGRATION_PATH ? CHECKPOINT_KIND : OVERVIEW_KIND}`, region.content);
      }
      for (const { path, unit } of newStubs) checkLinks(path, unit.line, null, unit.links);
    }

    // 8. duplicated evidence blocks (independent of regions)
    const was = blockIndex(acceptedCore);
    const now = blockIndex(proposed);
    for (const [hash, e] of now) {
      const old = was.get(hash)?.count ?? 0;
      if (e.count >= 2 && e.count > old) {
        const paths = [...e.where.keys()];
        violate({
          code: "DUPLICATE_BLOCK",
          path: paths[0],
          paths,
          line: e.where.get(paths[0]),
          bytes: e.bytes,
          copies: e.count,
          blockId: hash,
          repair:
            "A full evidence block now appears more than before. Keep it once, in its dated external reference, and leave a short link in core.",
        });
      }
    }

    // 9. nothing may have moved while we read
    const after = snapshotWorking(dir, deps.fs);
    if (after.head !== before.head || after.files !== before.files) {
      throw new CheckError("STATE_CHANGED", "HEAD or a core file changed while the check ran. Nothing was verified; run it again on the settled save.");
    }
  } catch (e) {
    fail(e);
  }

  result.status = result.errors.length ? "error" : result.violations.length ? "fail" : "pass";
  result.ok = result.status === "pass";
  return result;
}

export function exitCodeFor(result) {
  return result.errors.length ? 2 : result.violations.length ? 1 : 0;
}

// ── output ─────────────────────────────────────────────────────────────────

export function formatText(r) {
  const out = [];
  out.push(`registrar memory save check: ${r.status.toUpperCase()}`);
  out.push(`accepted-ref ${r.acceptedRef ?? "-"}  legacy-ref ${r.legacyRef ?? "-"}`);
  out.push(`letta total ${r.cliTotal ?? "n/a"} / ceiling ${r.ceiling ?? "n/a"}`);
  out.push(`canonical core: accepted ${r.canonicalBefore ?? "n/a"}, proposed ${r.canonicalAfter ?? "n/a"}`);
  out.push(`checkpoint ${r.checkpointTokens ?? "n/a"} / ${r.limits.checkpoint}   overview pointer ${r.overviewTokens ?? "n/a"} / ${r.limits.overview}`);
  for (const e of r.errors) out.push(`ERROR ${e.code}${e.path ? ` ${e.path}` : ""}: ${e.message}`);
  for (const v of r.violations) {
    const where = [v.path, v.region, v.line ? `line ${v.line}` : null].filter(Boolean).join(" ");
    out.push(`VIOLATION ${v.code}${where ? ` (${where})` : ""}: ${v.repair}`);
  }
  if (r.status !== "pass") {
    out.push("This gates only the proposed core save. The office closeout, public receipts and external evidence are unaffected. Change the save, then run the check again; an unchanged save will fail the same way.");
  }
  return out.join("\n") + "\n";
}

// ── command line ───────────────────────────────────────────────────────────

const USAGE =
  "usage: node tools/registrar-memory-save-check.mjs --memory-dir <dir> --accepted-ref <full-sha> --legacy-ref <full-sha> --ceiling <n> [--format json|text]\n";

export function parseArgs(argv) {
  const known = new Set(["memory-dir", "accepted-ref", "legacy-ref", "ceiling", "format"]);
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
    if (!m || !known.has(m[1])) throw new CheckError("BAD_ARGUMENT", `Unknown argument ${a}.`);
    const value = m[2] ?? argv[++i];
    if (value === undefined) throw new CheckError("BAD_ARGUMENT", `--${m[1]} needs a value.`);
    if (m[1] in opts) throw new CheckError("BAD_ARGUMENT", `--${m[1]} was given twice.`);
    opts[m[1]] = value;
  }
  for (const k of ["memory-dir", "accepted-ref", "legacy-ref", "ceiling"]) {
    if (!(k in opts)) throw new CheckError("BAD_ARGUMENT", `--${k} is required.`);
  }
  const format = opts.format ?? "text";
  if (format !== "json" && format !== "text") throw new CheckError("BAD_ARGUMENT", "--format must be json or text.");
  if (!/^\d+$/.test(opts.ceiling)) throw new CheckError("BAD_ARGUMENT", "--ceiling must be a non-negative integer.");
  return {
    memoryDir: opts["memory-dir"],
    acceptedRef: opts["accepted-ref"],
    legacyRef: opts["legacy-ref"],
    ceiling: Number(opts.ceiling),
    format,
  };
}

export function main(argv, stdout = process.stdout, stderr = process.stderr) {
  if (argv.includes("--help") || argv.includes("-h")) {
    stdout.write(USAGE);
    return 0;
  }
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    if (!(e instanceof CheckError)) throw e;
    stderr.write(`${e.message}\n${USAGE}`);
    return 2;
  }
  const result = checkMemorySave(args);
  stdout.write(args.format === "json" ? JSON.stringify(result, null, 2) + "\n" : formatText(result));
  return exitCodeFor(result);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
