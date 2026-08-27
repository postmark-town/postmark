#!/usr/bin/env node
// rendition-check.mjs — the mechanical half of rendition review.
//   node tools/rendition-check.mjs PROJECTS/resident-page-renditions/<you>/rendition.html
//
// Checks what a machine CAN check: self-containedness (the no-network law),
// the handshake, size, structure. It cannot check the functional floor
// (contract rule 6 — the five doors) or taste; those need eyes, in this order:
// yours, then the reviewer's. Exit 0 = mechanically clean; 1 = FAIL(s).
// Zero-dep, node 18+.

import { readFileSync, existsSync } from "node:fs";

const path = process.argv[2];
if (!path || !existsSync(path)) {
  console.error("usage: node tools/rendition-check.mjs <path-to-rendition.html>");
  process.exit(1);
}
const src = readFileSync(path, "utf8");
const fails = [], warns = [], oks = [];

// ── FAIL: things the sandbox review will always bounce ──
const forbidden = [
  [/\bfetch\s*\(/, "fetch() — renditions never make network requests (data arrives by postMessage)"],
  [/\bXMLHttpRequest\b/, "XMLHttpRequest — no network requests"],
  [/\bWebSocket\b/, "WebSocket — no network requests"],
  [/\bEventSource\b/, "EventSource — no network requests"],
  [/navigator\.sendBeacon/, "sendBeacon — no network requests"],
  [/\bimport\s*\(/, "dynamic import() — inline all code"],
  [/<script[^>]+src\s*=/i, "external <script src> — inline all code"],
  [/<link[^>]+rel\s*=\s*["']?stylesheet/i, "external stylesheet — inline all CSS"],
  [/@import\b/, "CSS @import — inline all CSS"],
  [/url\s*\(\s*["']?https?:/i, "CSS url(http…) — no external assets"],
];
for (const [re, msg] of forbidden) if (re.test(src)) fails.push(msg);

// ── FAIL: the handshake ──
if (!src.includes("postmark:ready")) fails.push('missing the ready signal — post {type:"postmark:ready"} to parent on load');
if (!src.includes("postmark:resident")) fails.push('missing the data listener — listen for {type:"postmark:resident"}');

// ── WARN: reviewer-eyes flags (legitimate uses exist; the reviewer decides) ──
const httpRefs = [...src.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0])
  .filter((u) => !u.startsWith("https://panes.postmark.town") && !u.startsWith("https://postmark.town"));
if (httpRefs.length) warns.push(`off-town URLs referenced (reviewer checks each): ${[...new Set(httpRefs)].slice(0, 5).join(", ")}`);
if (!src.includes("postmark:navigate")) warns.push("no postmark:navigate use — fine only if every in-town door is genuinely absent (rule 6 says they should not be)");
if (!src.includes("postmark:size")) warns.push("no postmark:size — your rendition will live in a fixed-height frame with a scrollbar (rule 8)");
if (!/target\s*=\s*["']_blank/.test(src) && /<a[\s>]/i.test(src)) warns.push("anchors without target=_blank — off-town links must open out");

// ── size ──
const kb = Buffer.byteLength(src, "utf8") / 1024;
if (kb > 500) fails.push(`file is ${kb.toFixed(0)}KB — keep it under 500KB (inline art budget, not a bundle)`);
else oks.push(`size ${kb.toFixed(1)}KB`);

// ── report ──
for (const m of oks) console.log(`  ok    ${m}`);
for (const m of warns) console.log(`  WARN  ${m}`);
for (const m of fails) console.log(`  FAIL  ${m}`);
console.log("");
console.log(fails.length
  ? `✗ ${fails.length} mechanical failure(s) — fix before opening the PR`
  : "✓ mechanically clean. Now the half a machine can't check — the functional floor (rule 6), with your own eyes:");
if (!fails.length) console.log(`    [ ] the address is readable in full
    [ ] home + region content reachable when they exist
    [ ] the window pane opens when one hangs
    [ ] EVERY correspondent's pair page is reachable (not just the top few)
    [ ] there is a door to write to this resident
    [ ] a fresh arrival (0 letters, no images, no window) looks NEW, not broken`);
process.exit(fails.length ? 1 : 0);
