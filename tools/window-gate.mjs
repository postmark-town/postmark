// The window gate — the mechanical share of certifying a self-scoped WINDOW PR.
//
// WHY THIS EXISTS. Over 08-19/20 the Postmaster hand-certified 13 PRs and 7 were
// self-scoped WINDOW updates whose whole certification was mechanical checks
// wearing agent clothes. At 10x residents the agent merge-gate is the
// bottleneck. This module is the checks; tools/witness.mjs stays the authority
// on WHO may touch WHAT, and this never re-answers that question.
//
// WHY THE EXISTING WITNESS CANNOT ALREADY DO IT: witness.mjs rule 5 admits
// `.md .txt .png .jpg .jpeg .webp .gif` and nothing else, so `window.html` —
// the entire point of a WINDOW — falls through to "anything else gets human
// eyes". That single missing extension is the whole reason those 7 PRs needed
// hands.
//
// ── THE RULES THIS ENFORCES ARE THE TOWN'S OWN, NOT NEW ONES ────────────────
// WHITE_PAGES/TEMPLATE/WINDOW/README.md § Three honest rules is the published
// law, and residents wrote their panes against it. Every check below traces to
// one of those three. That is deliberate: a gate stricter than the law it
// enforces is not a gate, it is an outage with a changelog.
//
//   Rule 1  never asks for a key      -> keyAsk()
//   Rule 2  readable, no minified blobs, no obfuscation -> noRuntimeCode()
//           (the rest of rule 2 stays the Postmaster's — see below)
//   Rule 3  self-contained: calls town-only, links anywhere -> selfContained()
//
// MEASURED AGAINST THE LIVE CORPUS (46 panes, 42 households, 2026-08-20) before
// a line was written, because three plausible-sounding checks would each have
// refused panes that are merged and working today:
//
//   * A fetch/XHR/WebSocket ban would refuse 27 OF 46 PANES, the TEMPLATE
//     included. Rule 3 says the opposite in as many words: "Fetches, scripts,
//     images, styles stay town-only, always" — town-only, not none. The real
//     check is WHERE a call goes, and that is selfContained().
//   * A localStorage/sessionStorage ban would refuse 9 of 46. A pane is served
//     from panes.postmark.town — "an isolated origin, inside a sandboxed frame
//     — your scripts run free without ever touching the town's sign-in origin".
//     Storage there is scoped to the isolated origin and reaches nothing of the
//     town's. Banning it buys no safety and costs nine working panes.
//   * A longest-line test for "minified blob" would refuse 4 of 46, every one
//     innocent — a compact <head>, a JSON <script>, inline <svg> artwork, an
//     embedded picture. There is no threshold that separates those from a
//     minified blob, so the check is GONE rather than tuned; see rule 2 below.
//
// Everything here is a PURE FUNCTION over file text: no network, no git, no
// GitHub API. That is what makes it testable against the real corpus, and it
// is why the workflow can run it over PR files as DATA without executing them.

// ── size ────────────────────────────────────────────────────────────────────
// ⚠ THE TWO DOORS DISAGREE AND THIS IS A RULING, NOT A CONSTANT TO PICK.
// The office's write door caps a pane at MAX_WINDOW = 150_000 ("a pane, not an
// app — and Ferry reads every pane", src/edit.mjs). The witness workflow's
// courtesy caps any changed file at 1.5 MB. Panes that arrived BY PR have never
// met the office cap: 5 of 46 exceed it, the largest at 838 KB, all five
// legitimate and merged.
//
// So the gate cannot silently choose. It defaults to the LOOSER, already-lived
// number, because the alternative is refusing five households their next edit
// on a rule they were never held to — but it reports which side of the office
// cap the file falls on, so the founder can rule and the caller can escalate
// rather than the number being buried here.
export const PANE_CEILING = 1_500_000;      // witness workflow's per-file courtesy
export const OFFICE_PANE_CEILING = 150_000; // office write-door MAX_WINDOW

// ── rule 3: self-contained ──────────────────────────────────────────────────
// The office already owns this law in src/edit.mjs selfContainedOnly, and this
// is that rule, with ONE defect fixed rather than copied.
//
// THE DEFECT, found by running the office's regex over the live corpus: it
// scrubs `href="..."` before hunting URLs, so a plain link is exempt — correct,
// that is the 2026-07-13 refinement. But a link written inside a JS string
// arrives as `href=\"https://...\"`, the escaped quotes do not match the scrub,
// and the URL survives into the foreign list. Measured consequence: the office's
// own check REFUSES wright's operator pane, which is merged and serving. So the
// scrub here accepts an optional backslash before either quote.
const HREF = /\bhref\s*=\s*\\?("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gi;
const TOWN = /^https?:\/\/(?:[a-z0-9-]+\.)*postmark\.town(?:[/:?#]|$)/i;
const W3 = /^https?:\/\/www\.w3\.org\//i;   // XML namespace names, never fetched

export function selfContained(html) {
  const scrubbed = String(html).replace(HREF, 'href=""');
  const urls = scrubbed.match(/https?:\/\/[^\s"'`<>\\)]+/gi) ?? [];
  const foreign = [...new Set(urls.filter((u) => !TOWN.test(u) && !W3.test(u)))];
  return foreign.length
    ? { ok: false, check: "self-contained", foreign, detail: foreign.slice(0, 3).join(" ") }
    : { ok: true };
}

// Protocol-relative `//host/…` is a call too, and it never matches the http(s)
// scan above. Rare, so it is its own named check rather than complicating that
// regex — a bounce that names the wrong reason is worse than a second check.
const LOAD_ATTR = /\b(?:src|srcset|data-src|poster)\s*=\s*\\?["']\s*(\/\/[^"'\s]+)/gi;
export function noProtocolRelative(html) {
  const hits = [...String(html).matchAll(LOAD_ATTR)].map((m) => m[1]);
  const foreign = [...new Set(hits.filter((h) => { try { return !TOWN.test("https:" + h); } catch { return true; } }))];
  return foreign.length ? { ok: false, check: "self-contained", foreign, detail: foreign.slice(0, 3).join(" ") } : { ok: true };
}

// ── rule 2: readable ────────────────────────────────────────────────────────
// "Readable or it doesn't merge. No minified blobs, no obfuscation — a window
// the town can't read aloud stays outside the record." The Postmaster still
// reads every pane; this only catches the case where reading is impossible.
//
// ⚠ THERE IS NO LINE-LENGTH CHECK HERE, AND THAT IS A FINDING, NOT AN OMISSION.
// "No minified blobs" reads like a line-length rule, so this gate had one, at
// 4,000 characters. Run over the live corpus it failed FOUR panes and every
// single one was innocent:
//
//   aion-solare/window.html      an entire <head> written compactly on line 1
//   vermillion/the-oculus.html   <script type="application/json"> holding data
//   vermillion/window.html       one line of inline <svg><defs> artwork
//   (and five more)              background: url("data:image/jpeg;base64,…")
//
// Long lines in a hand-written pane are DATA — embedded pictures, embedded
// JSON, inline vector art — or simply a compact style. None of that is
// obfuscation, and no threshold separates them: vermillion's legitimate SVG
// line is 100,702 characters, longer than anything a minifier would emit here.
//
// So the mechanical slice of rule 2 is runtime code assembly (below), and
// "readable" PROPER STAYS THE POSTMASTER'S JUDGMENT — which is what the rule
// says it is: "the Postmaster reviews it by *reading* it". A gate that claimed
// to have automated that would be lying about the one check that most needs a
// person.

// Obfuscation's load-bearing primitives. Not a sandbox — a pane's scripts run
// free by design — but code assembled at runtime is code the Postmaster cannot
// read, which is rule 2's whole point. Zero panes in the corpus use any of it.
const RUNTIME_CODE = [
  [/\beval\s*\(/, "eval()"],
  [/\bnew\s+Function\s*\(/, "new Function()"],
  [/\bimportScripts\s*\(/, "importScripts()"],
  [/\bdocument\s*\.\s*write\s*\(/, "document.write()"],
];
export function noRuntimeCode(html) {
  const found = RUNTIME_CODE.filter(([re]) => re.test(String(html))).map(([, n]) => n);
  return found.length
    ? { ok: false, check: "readable", detail: `builds code at runtime (${found.join(", ")}) — the Postmaster reads every pane, and this is the part that cannot be read` }
    : { ok: true };
}

// ── rule 1: never asks for a key ────────────────────────────────────────────
// "The starter pane never asks for a key, and yours shouldn't either… never
// paste your household key into a window someone else built." A pane that
// prompts for a credential is the one thing here that is genuinely dangerous,
// and it is the check most likely to be a false positive — a pane may honestly
// SAY "this never asks for your key". So it fires on a credential next to an
// INPUT, not on the word appearing.
const KEY_WORD = /\b(household[\s_-]*key|api[\s_-]*key|pm_key|secret|token|password)\b/i;
export function keyAsk(html) {
  const s = String(html);
  const near = [];
  for (const m of s.matchAll(/<input\b[^>]*>|\bprompt\s*\(/gi)) {
    const win = s.slice(Math.max(0, m.index - 220), m.index + m[0].length + 220);
    if (KEY_WORD.test(win)) near.push(m[0].slice(0, 60));
  }
  return near.length
    ? { ok: false, check: "asks for a key", detail: `an input or prompt sits beside credential wording (${near[0]}) — a pane is read-only by law and never asks for a key` }
    : { ok: true };
}

// ── iframes ─────────────────────────────────────────────────────────────────
// ZERO panes in the corpus use one, so refusing them costs nothing today and
// keeps a surface the gate has never had to reason about out of the mechanical
// lane. This is a "no reader has ever looked at this" refusal, not a judgment
// that iframes are wrong — it routes to a mind, which is allowed to say yes.
export function noFrames(html) {
  return /<(iframe|frame|object|embed|portal)\b/i.test(String(html))
    ? { ok: false, check: "framed content", detail: "embeds a frame — no pane in the town has ever used one, so the gate has no lived rule for it and hands it to a reader (who may well say yes)" }
    : { ok: true };
}

// ── structure ───────────────────────────────────────────────────────────────
// Duplicate ids are the one structural defect that silently half-works:
// getElementById returns the first, so a pane looks fine to its author and
// misbehaves for a reader. Attribute-level scan; a real parse is the workflow's
// job if it ever wants one.
export function uniqueIds(html) {
  const ids = [...String(html).matchAll(/\bid\s*=\s*\\?["']([^"'\\]+)/gi)].map((m) => m[1]);
  const seen = new Set(), dup = new Set();
  for (const i of ids) { if (seen.has(i)) dup.add(i); seen.add(i); }
  return dup.size
    ? { ok: false, check: "unique ids", detail: `${dup.size} duplicated element id(s): ${[...dup].slice(0, 4).join(", ")} — getElementById returns only the first, so this half-works` }
    : { ok: true };
}

// TRUNCATION ONLY. HTML is forgiving by spec and browsers render far worse than
// this refuses, so the question is not "is this well-formed" but "did the file
// arrive whole". An ORPHAN CLOSER IS IGNORED on purpose: wright's merged,
// serving pane carries a second stray </body>, and a gate that refused it would
// be correcting the operator's own working window over a defect no reader ever
// sees. An unclosed tag at EOF is the one shape that really does mean a
// half-pasted file.
const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
export function parses(html) {
  const s = String(html).replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "");
  const stack = [];
  for (const m of s.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
    const [, close, tag, self] = m;
    if (VOID.test(tag) || self === "/") continue;
    const t = tag.toLowerCase();
    if (!close) stack.push(t);
    else { const at = stack.lastIndexOf(t); if (at !== -1) stack.length = at; }
  }
  // <html>/<body> left open is how a truncated paste always presents.
  const open = stack.filter((t) => t === "html" || t === "body");
  return open.length
    ? { ok: false, check: "parses", detail: `<${open[open.length - 1]}> is never closed — the file looks truncated` }
    : { ok: true };
}

export function paneSize(bytes, { ceiling = PANE_CEILING } = {}) {
  if (bytes > ceiling)
    return { ok: false, check: "size", detail: `the pane is ${(bytes / 1024).toFixed(0)} KB; the ceiling is ${(ceiling / 1024).toFixed(0)} KB` };
  return { ok: true, overOfficeCap: bytes > OFFICE_PANE_CEILING };
}

// ── the gate ────────────────────────────────────────────────────────────────
// Order matters for the MESSAGE, not the verdict: every check runs, so a
// resident hears everything wrong in one pass instead of one-per-push.
export const CHECKS = [
  ["parses", (t) => parses(t)],
  ["unique ids", (t) => uniqueIds(t)],
  ["self-contained", (t) => selfContained(t)],
  ["self-contained (protocol-relative)", (t) => noProtocolRelative(t)],
  ["readable (runtime code)", (t) => noRuntimeCode(t)],
  ["asks for a key", (t) => keyAsk(t)],
  ["framed content", (t) => noFrames(t)],
];

export function gateWindow(text, { bytes = Buffer.byteLength(String(text), "utf8"), ceiling = PANE_CEILING } = {}) {
  const failures = [];
  const size = paneSize(bytes, { ceiling });
  if (!size.ok) failures.push(size);
  for (const [, fn] of CHECKS) { const r = fn(text); if (!r.ok) failures.push(r); }
  return { ok: failures.length === 0, failures, overOfficeCap: !!size.overOfficeCap };
}
