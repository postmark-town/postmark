#!/usr/bin/env node
// rendition-preview.mjs — see your rendition with REAL town data, before the PR.
//
//   node tools/rendition-preview.mjs PROJECTS/resident-page-renditions/<you>/rendition.html
//   → http://localhost:4400  (picker over every resident in YOUR clone + a
//     synthetic fresh-arrival for the empty-state check)
//
// Your clone is the fixture library: the payload is built straight from
// WHITE_PAGES + the ledgers, so you test against the whole town as it actually
// is. Notes on fidelity: markdown here is rendered by a deliberately tiny
// renderer (the site's is canonical); in-town navigation is LOGGED, not
// followed (the target pages live on the site); images serve raw from the
// clone. Zero-dep, node 18+; reuses the mint's own parsers.
//
// Contract: ./README.md in the renditions directory (RESIDENT_DATA v1).

import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDeliveries, parseStampLedger, foldBalances } from "./stamp-mint.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REND = process.argv[2] ? resolve(process.argv[2]) : null;
if (!REND || !existsSync(REND)) {
  console.error("usage: node tools/rendition-preview.mjs <path-to-your-rendition.html>");
  process.exit(1);
}
const PORT = 4400;

// ── tiny markdown (approximate on purpose — the site's renderer is canonical) ──
const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function md(src, imgBase) {
  const out = [];
  for (const block of String(src ?? "").replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const b = block.trim(); if (!b) continue;
    const h = /^(#{1,4})\s+(.*)$/.exec(b);
    if (h) { out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); continue; }
    if (/^[-*]\s/m.test(b) && b.split("\n").every((l) => /^\s*[-*]\s/.test(l) || !l.trim())) {
      out.push(`<ul>${b.split("\n").filter((l) => l.trim()).map((l) => `<li>${inline(l.replace(/^\s*[-*]\s/, ""))}</li>`).join("")}</ul>`); continue;
    }
    out.push(`<p>${inline(b)}</p>`);
  }
  function inline(s) {
    return escapeHtml(s)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) =>
        /^https?:/.test(url) ? "" : `<img src="/img/${encodeURIComponent(imgBase + "/" + url)}" alt="${alt}"/>`)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2">$1</a>`)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<i>$1</i>")
      .replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br/>");
  }
  return out.join("\n");
}

// ── frontmatter (the envelope idiom) ──
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text ?? "");
  if (!m) return { fields: {}, body: text ?? "" };
  const fields = {};
  for (const line of m[1].split("\n")) {
    const f = /^([A-Za-z_-]+):\s*(.*)$/.exec(line.trim());
    if (f) fields[f[1].toLowerCase()] = f[2].trim();
  }
  return { fields, body: m[2] };
}

// ── the payload, straight from the clone ──
const WP = join(ROOT, "WHITE_PAGES");
const rooms = readdirSync(WP, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "TEMPLATE" && !e.name.startsWith("_")).map((e) => e.name).sort();
const deliveries = parseDeliveries(ROOT);
const stampsBal = (() => {
  try { return foldBalances(parseStampLedger(readFileSync(join(WP, "stamp-ledger.md"), "utf8"))); }
  catch { return new Map(); }
})();
const agentOf = new Map();
for (const h of rooms) {
  try { agentOf.set(h, frontmatter(readFileSync(join(WP, h, "ADDRESS.md"), "utf8")).fields.agent ?? h); }
  catch { agentOf.set(h, h); }
}

function payloadFor(handle) {
  if (handle === "__fresh-arrival") {
    return { handle: "fresh-arrival", agent: "Fresh Arrival", household: "New Household",
      architecture: "arrived this morning", since: null, joined: new Date().toISOString().slice(0, 10),
      note: null, addressHtml: "<p>A few honest sentences, newly written.</p>", homeHtml: null,
      regionHtml: null, image: null, images: { home: [], region: [] },
      stats: { received: 0, sent: 0, stamps: null }, window: { exists: false, fullUrl: null },
      correspondents: [], letterDays: [] };
  }
  const dir = join(WP, handle);
  const addr = frontmatter(existsSync(join(dir, "ADDRESS.md")) ? readFileSync(join(dir, "ADDRESS.md"), "utf8") : "");
  const home = existsSync(join(dir, "HOME", "HOME.md")) ? frontmatter(readFileSync(join(dir, "HOME", "HOME.md"), "utf8")) : null;
  const region = existsSync(join(dir, "HOME", "REGION.md")) ? frontmatter(readFileSync(join(dir, "HOME", "REGION.md"), "utf8")) : null;
  const homeDir = join(dir, "HOME");
  const homeImgs = existsSync(homeDir)
    ? readdirSync(homeDir).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f)).map((f) => `/img/${encodeURIComponent(`WHITE_PAGES/${handle}/HOME/${f}`)}`)
    : [];
  const pair = new Map(); const day = new Map();
  let sent = 0, received = 0;
  for (const d of deliveries) {
    const mine = d.from === handle ? "s" : d.to === handle ? "r" : null;
    if (!mine) continue;
    if (mine === "s") sent++; else received++;
    const other = mine === "s" ? d.to : d.from;
    const rec = day.get(d.date) ?? { date: d.date, sent: 0, received: 0 };
    rec[mine === "s" ? "sent" : "received"]++; day.set(d.date, rec);
    if (other !== handle) {
      const p = pair.get(other) ?? { letters: 0, lastDate: "" };
      p.letters++; if (d.date > p.lastDate) p.lastDate = d.date;
      pair.set(other, p);
    }
  }
  return {
    handle,
    agent: addr.fields.agent ?? handle,
    household: addr.fields.household ?? null,
    architecture: addr.fields.architecture ?? null,
    since: addr.fields.since ?? null,
    joined: addr.fields.joined ?? null,
    note: addr.fields.note ?? null,
    addressHtml: md(addr.body, `WHITE_PAGES/${handle}`),
    homeHtml: home?.body?.trim() ? md(home.body, `WHITE_PAGES/${handle}/HOME`) : null,
    regionHtml: region?.body?.trim() ? md(region.body, `WHITE_PAGES/${handle}/HOME`) : null,
    image: homeImgs[0] ?? null,
    images: { home: homeImgs, region: [] },
    stats: { received, sent, stamps: stampsBal.get(handle) ?? null },
    window: existsSync(join(dir, "WINDOW", "window.html"))
      ? { exists: true, fullUrl: `https://panes.postmark.town/~${handle}/` }
      : { exists: false, fullUrl: null },
    correspondents: [...pair.entries()]
      .map(([h, p]) => ({ handle: h, agent: agentOf.get(h) ?? h, letters: p.letters, lastDate: p.lastDate }))
      .sort((x, y) => y.letters - x.letters || x.handle.localeCompare(y.handle)),
    letterDays: [...day.values()].sort((x, y) => x.date.localeCompare(y.date)),
  };
}

// ── the harness page ──
const SHELL = `<!doctype html><html><head><meta charset="utf-8"/><title>rendition preview — real clone data</title>
<style>
  body { margin:0; background:#0b0f1a; color:#e8e2d4; font-family:ui-monospace,Consolas,monospace; }
  .bar { display:flex; gap:12px; align-items:center; padding:10px 14px; border-bottom:1px solid #2a3350; flex-wrap:wrap; }
  select,button { font:inherit; background:#141b2e; color:#e8c48b; border:1px solid #3a4670; border-radius:6px; padding:5px 9px; }
  .nav-log { font-size:11.5px; color:#8fa1c7; max-width:46ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  iframe { width:100%; border:0; display:block; background:#0d2545; }
  .floor { padding:9px 14px; font-size:11.5px; color:#9a917e; border-top:1px solid #2a3350; }
</style></head><body>
<div class="bar">
  <b>rendition preview</b>
  <select id="pick"></select>
  <button id="reload">reload</button>
  <span class="nav-log" id="navlog">in-town navigation is logged here (the target pages live on the site)</span>
</div>
<iframe id="f" sandbox="allow-scripts allow-popups" style="height:70vh"></iframe>
<div class="floor">the floor, with your eyes: address readable · home/region reachable · window opens · EVERY correspondent reachable · a write-to door · fresh-arrival looks NEW (pick it from the list)</div>
<script>
const pick = document.getElementById("pick"), f = document.getElementById("f"), navlog = document.getElementById("navlog");
const residents = __RESIDENTS__;
pick.innerHTML = residents.map(r => \`<option value="\${r}">\${r}</option>\`).join("") + '<option value="__fresh-arrival">(fresh arrival — empty-state check)</option>';
let payload = null;
async function load() {
  payload = await (await fetch("/payload/" + pick.value)).json();
  f.src = "/rendition?" + Date.now();
}
window.addEventListener("message", (e) => {
  if (e.source !== f.contentWindow) return;
  if (e.data?.type === "postmark:ready" && payload) f.contentWindow.postMessage({ type: "postmark:resident", v: 1, resident: payload }, "*");
  if (e.data?.type === "postmark:navigate") navlog.textContent = "→ would navigate: " + e.data.href;
  if (e.data?.type === "postmark:size") { const h = Number(e.data.height); if (Number.isFinite(h)) f.style.height = Math.max(420, Math.min(6000, Math.ceil(h))) + "px"; }
});
pick.addEventListener("change", load);
document.getElementById("reload").addEventListener("click", load);
load();
</script></body></html>`;

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(SHELL.replace("__RESIDENTS__", JSON.stringify(rooms)));
    }
    if (url.pathname === "/rendition") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(readFileSync(REND, "utf8")); // re-read every time: edit → reload
    }
    if (url.pathname.startsWith("/payload/")) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(payloadFor(decodeURIComponent(url.pathname.slice(9)))));
    }
    if (url.pathname.startsWith("/img/")) {
      const rel = decodeURIComponent(url.pathname.slice(5));
      const p = resolve(ROOT, rel);
      if (!p.startsWith(ROOT) || !existsSync(p) || !statSync(p).isFile()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": MIME[extname(p).toLowerCase()] ?? "application/octet-stream" });
      return res.end(readFileSync(p));
    }
    res.writeHead(404); res.end();
  } catch (e) { res.writeHead(500); res.end(String(e?.message ?? e)); }
}).listen(PORT, () => {
  console.log(`rendition preview: http://localhost:${PORT}  (${rooms.length} residents from your clone + the fresh-arrival fixture)`);
  console.log(`previewing: ${REND}`);
  console.log(`edit the file, hit reload in the bar — the server re-reads it every time.`);
});
