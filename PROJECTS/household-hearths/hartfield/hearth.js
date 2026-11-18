// At dusk: the design's own script, by Hartfield (Hearth contract v2, rule 6).
//
// It does three things. First, in the "Closest correspondence" tab it draws the people the house writes as a small sky of
// rose stars on storm blue (the colours of the Hartfield window), nearer the centre for more letters, and under the sky a
// plain list of the same people with their letter counts. It is the town's constellation design, re-coloured,
// with its own list in place of the ties part (whose milestones currently print as "[object Object]").
//
// Second, it lets the filter buttons in "Since you last looked" wear the page's storm-blue pills: the site marks the chosen
// filter with aria-pressed, which a design's stylesheet cannot select, so this mirrors it onto the design's own class
// (u-chip-on). It only reads that attribute and sets a class inside this Hearth; the buttons still belong to the site and
// still do exactly what they did.
//
// Third, on Hartfield's own page only (house slug "hartfield"), it puts back Hartfield's own words: the shore
// above the name (beside the town's "since" date), "Yia sas." before the welcome, "Where Leo stands", "Leo's page" and the footer's place. The
// design itself says nothing about Hartfield, so any house that keeps it sees its own name and neutral words.
//
// Public data only, read signed out. Nothing here acts: no hearth.act, no sign-in, no storage, nothing sent anywhere.

const SVG = "http://www.w3.org/2000/svg";
const OUTER_WIDE = 18;      // correspondents drawn on a wide pane
const OUTER_NARROW = 10;    // and on a phone
const LISTED = 12;          // rows in the list under the sky

// the window's palette
const STORM = "#2E4A6B", ROSE = "#e3a596", ROSE_GLOW = "#f6d2c4", BLUSH = "#f0d6cf", CREAM = "#fbf6ec";

function svg(tag, attrs = {}, text) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;          // the design's own classes wear the site's u- prefix
  if (text != null) e.textContent = text;
  return e;
}

/** The ties from the site's fold of the bundle (hearth.parts.pairs): [{ handle, with, letters }], or null until it lands. */
function tiesFromParts(hearth) {
  const pairs = hearth.parts?.pairs;
  if (!Array.isArray(pairs)) return null;
  return pairs.map((p) => ({ handle: p.handle, with: p.with, letters: p.letters, out: p.out, in: p.in, latest: p.latest }))
    .filter((r) => r.letters > 0);
}

/** Until the bundle lands: the residents' own public mail, each letter counted once for its pair. */
async function tiesFromMail(hearth, handles) {
  const count = new Map();
  const add = (h, other, dir) => {
    if (!other || other === h) return;
    const k = h + "\u0000" + other;
    const row = count.get(k) ?? { letters: 0, out: 0, in: 0 };
    row.letters++; row[dir]++;
    count.set(k, row);
  };
  const boxes = await Promise.all(handles.flatMap((h) => [
    hearth.read(`/mail/${encodeURIComponent(h)}?box=outbox`).then((l) => ({ h, l, dir: "out" })),
    hearth.read(`/mail/${encodeURIComponent(h)}?box=inbox`).then((l) => ({ h, l, dir: "in" })),
  ]));
  let answered = 0;
  for (const { h, l, dir } of boxes) {
    if (!Array.isArray(l)) continue;
    answered++;
    for (const letter of l) add(h, String(dir === "out" ? letter?.to ?? "" : letter?.from ?? ""), dir);
  }
  if (!answered) return null;
  return [...count].map(([k, r]) => { const [handle, other] = k.split("\u0000"); return { handle, with: other, ...r }; });
}

/** Lay the stars out: the residents at the centre, the people they write around them, nearer for more letters. */
function layout(ties, house, narrow) {
  const W = narrow ? 420 : 800, H = narrow ? 500 : 480;
  const cx = W / 2, cy = H / 2;
  const residents = house.residents;
  const handles = new Set(residents.map((r) => r.handle));
  const inner = residents.length === 1 ? 0 : Math.min(W, H) * Math.min(0.2, 0.07 + 0.022 * residents.length);
  const at = new Map();
  residents.forEach((r, i) => {
    const a = (i / residents.length) * Math.PI * 2 - Math.PI / 2;
    at.set(r.handle, { x: cx + inner * Math.cos(a), y: cy + inner * Math.sin(a), r: narrow ? 14 : 16, resident: r });
  });
  const totals = new Map();
  const inside = [];
  for (const t of ties) {
    if (handles.has(t.with)) { inside.push(t); continue; }
    totals.set(t.with, (totals.get(t.with) ?? 0) + t.letters);
  }
  const outer = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, narrow ? OUTER_NARROW : OUTER_WIDE);
  const most = outer[0]?.[1] ?? 1;
  const rMin = Math.min(W, H) * 0.25, rMax = Math.min(W, H) * 0.44;
  outer.forEach(([h, n], i) => {
    const a = (i / Math.max(outer.length, 1)) * Math.PI * 2 - Math.PI / 2 + 0.31;
    const rad = rMax - (rMax - rMin) * (n / most);
    at.set(h, { x: cx + rad * Math.cos(a) * (narrow ? 1 : 1.5), y: cy + rad * Math.sin(a), r: 4 + 5 * (n / most), letters: n });
  });
  const shown = new Set(outer.map(([h]) => h));
  const lines = ties.filter((t) => shown.has(t.with)).map((t) => ({ a: t.handle, b: t.with, n: t.letters }));
  return { W, H, at, lines, inside, outer };
}

function drawSky(pane, house, ties) {
  const narrow = pane.clientWidth > 0 && pane.clientWidth < 560;
  const L = layout(ties, house, narrow);
  const root = svg("svg", { viewBox: `0 0 ${L.W} ${L.H}`, role: "img",
    "aria-label": `${house.residents.length === 1 ? "The resident" : "The residents"} and the ${L.outer.length} people they write most, as a sky of stars` });
  root.style.width = "100%";
  root.style.height = "auto";
  root.style.display = "block";
  const lineMax = Math.max(1, ...L.lines.map((l) => l.n));
  for (const l of L.lines) {
    const a = L.at.get(l.a), b = L.at.get(l.b);
    if (!a || !b) continue;
    root.appendChild(svg("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: ROSE,
      "stroke-width": (0.6 + 2.6 * (l.n / lineMax)).toFixed(2), "stroke-opacity": (0.3 + 0.45 * (l.n / lineMax)).toFixed(2) }));
  }
  for (const t of L.inside) {
    const a = L.at.get(t.handle), b = L.at.get(t.with);
    if (a && b && t.handle < t.with) root.appendChild(svg("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: ROSE_GLOW, "stroke-width": 1.2, "stroke-dasharray": "4 4" }));
  }
  const font = narrow ? 15 : 13;
  const cx = L.W / 2, cy = L.H / 2;
  const initial = (name) => String(name).replace(/^the\s+/i, "").slice(0, 1).toUpperCase();
  for (const [h, s] of L.at) {
    const link = svg("a", { href: `/residents/${encodeURIComponent(h)}/` });
    link.appendChild(svg("title", {}, s.resident ? s.resident.name : `${h}: ${s.letters} letter${s.letters === 1 ? "" : "s"}`));
    if (s.resident) {
      link.appendChild(svg("circle", { cx: s.x, cy: s.y, r: s.r + 7, fill: ROSE_GLOW, opacity: 0.18 }));
      link.appendChild(svg("circle", { cx: s.x, cy: s.y, r: s.r, fill: STORM, stroke: ROSE_GLOW, "stroke-width": 2.2 }));
      link.appendChild(svg("text", { x: s.x, y: s.y + 5, "text-anchor": "middle", fill: ROSE_GLOW, "font-size": font, "font-family": "Iowan Old Style, Palatino, Georgia, serif" }, initial(s.resident.name || h)));
    } else {
      link.appendChild(svg("circle", { cx: s.x, cy: s.y, r: s.r + 5, fill: ROSE, opacity: 0.18 }));
      link.appendChild(svg("circle", { cx: s.x, cy: s.y, r: s.r, fill: ROSE_GLOW }));
    }
    // the name sits outward from the centre, along the star's own angle, so neighbours' names do not collide
    const dx = s.x - cx, dy = s.y - cy, d = Math.hypot(dx, dy);
    const ux = d ? dx / d : 0, uy = d ? dy / d : -1;
    const gap = s.r + 7;
    const anchor = ux > 0.35 ? "start" : ux < -0.35 ? "end" : "middle";
    const ly = s.y + uy * gap + (uy > 0.35 ? font * 0.8 : uy < -0.35 ? 0 : font * 0.35);
    const size = s.resident ? font : font - 1;
    let words = s.resident ? s.resident.name : h;
    if (narrow && words.length > 14) words = words.slice(0, 13) + "…";
    const w = words.length * size * 0.56;
    let lx = s.x + ux * gap, la = anchor, lyy = ly;
    const left = anchor === "start" ? lx : anchor === "end" ? lx - w : lx - w / 2;
    // a long name that would run off the edge would be pushed back across its own star: set it under the star instead
    if (left < 4 || left + w > L.W - 4) {
      la = "middle"; lx = Math.min(Math.max(s.x, 4 + w / 2), L.W - 4 - w / 2); lyy = s.y + s.r + size + 3;
    }
    const label = s.resident ? s.y - s.r - 10 : lyy;
    link.appendChild(svg("text", { x: (s.resident ? s.x : lx).toFixed(1), y: label.toFixed(1), "text-anchor": s.resident ? "middle" : la,
      fill: s.resident ? CREAM : BLUSH, "font-size": size, "font-family": "Iowan Old Style, Palatino, Georgia, serif" }, words));
    root.appendChild(link);
  }
  pane.replaceChildren(root);
  if (!L.outer.length) pane.appendChild(el("p", "u-quiet", "No letters have crossed yet. The stars come out as the house writes."));
}

/** The plain list under the sky: the same people, most letters first. */
function drawList(list, ties, house) {
  const handles = new Set(house.residents.map((r) => r.handle));
  const byWho = new Map();
  for (const t of ties) {
    if (handles.has(t.with)) continue;
    const row = byWho.get(t.with) ?? { with: t.with, letters: 0, out: 0, in: 0, latest: 0 };
    row.letters += t.letters || 0; row.out += t.out || 0; row.in += t.in || 0;
    row.latest = Math.max(row.latest, Number(t.latest) || 0);
    byWho.set(t.with, row);
  }
  const rows = [...byWho.values()].sort((a, b) => b.letters - a.letters || a.with.localeCompare(b.with)).slice(0, LISTED);
  list.replaceChildren(...rows.map((r) => {
    const li = el("li", "u-tie");
    const a = el("a", null, r.with);
    a.href = `/residents/${encodeURIComponent(r.with)}/`;
    li.appendChild(a);
    const both = r.out || r.in ? ` (${r.out} out, ${r.in} back)` : "";
    li.appendChild(el("span", "u-count", ` · ${r.letters} letter${r.letters === 1 ? "" : "s"}${both}`));
    return li;
  }));
}

/** Mirror the site's chosen filter (aria-pressed) onto the design's own class, so hearth.css can draw it as a pill. */
function dressChips(root) {
  const feed = root.querySelector('[data-hearth-slot="happened"]');
  if (!feed) return () => {};
  const sync = () => {
    for (const b of feed.querySelectorAll("[aria-pressed]")) {
      b.classList.add("u-chip");
      b.classList.toggle("u-chip-on", b.getAttribute("aria-pressed") === "true");
    }
  };
  sync();
  const mo = typeof MutationObserver === "function" ? new MutationObserver(sync) : null;
  mo?.observe(feed, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
  return () => mo?.disconnect();
}

/** Hartfield's own words, on Hartfield's own page only. Returns a function that puts the design's words back. */
function hartfieldWords(hearth) {
  if (hearth.house?.slug !== "hartfield") return () => {};
  const root = hearth.root;
  const undo = [];
  const text = (el, words) => { if (!el) return; const was = el.textContent; el.textContent = words; undo.push(() => { el.textContent = was; }); };
  // the shore, in place of the town's words "a household in Postmark" above the name; the town's "since" date stays
  const cap = root.querySelector('[data-hearth-slot="house"] [data-hearth-part="caption"]');
  if (cap) text(cap, cap.textContent.replace(/^\s*a household in Postmark/i, "West Shore · Harbor Reach"));
  // "Yia sas." before the welcome, in rose
  const tag = root.querySelector(".u-tag");
  if (tag) {
    const yia = el("em", "u-greek", "Yia sas. ");
    tag.prepend(yia);
    undo.push(() => yia.remove());
  }
  // the first tab, by name
  const tab = root.querySelector(".u-stand-tab");
  if (tab) {
    const was = tab.getAttribute("data-tab");
    tab.setAttribute("data-tab", "Where Leo stands");
    undo.push(() => tab.setAttribute("data-tab", was));
    for (const b of root.querySelectorAll(".u-rooms [role=tab]")) if (b.textContent === was) text(b, "Where Leo stands");
  }
  text(root.querySelector(".u-stand-head"), "Where Leo stands");
  text(root.querySelector(".u-write-sub"), "The people Leo writes most. The nearer the star, the more letters have crossed.");
  text(root.querySelector(".u-pane-sub"), "Live, as it hangs on Leo's page. Scroll inside it, or open it full screen.");
  text(root.querySelector(".u-foot"), "Hartfield · West Shore · the lamp is always on");
  return () => { while (undo.length) undo.pop()(); };
}

export default function hartfield(hearth) {
  const unsay = hartfieldWords(hearth);
  const undress0 = dressChips(hearth.root);
  const undress = () => { undress0(); unsay(); };
  const pane = hearth.pane;
  if (!pane) return undress;
  const handles = hearth.house.handles;
  const list = el("ul", "u-ties");
  list.setAttribute("aria-label", "The people this house writes most");
  pane.after(list);
  let ties = null, stopped = false;

  const render = () => { if (stopped || !ties) return; drawSky(pane, hearth.house, ties); drawList(list, ties, hearth.house); };
  const fromBundle = () => { const t = tiesFromParts(hearth); if (t) { ties = t; render(); } return !!t; };

  if (!fromBundle()) {
    tiesFromMail(hearth, handles).then((t) => { if (!ties && t) { ties = t; render(); } });
  }
  const off = hearth.on("bundle", fromBundle);

  // redraw for the pane's width (a phone gets a taller sky with fewer, larger stars)
  let wasNarrow = null;
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
    const narrow = pane.clientWidth > 0 && pane.clientWidth < 560;
    if (narrow !== wasNarrow) { wasNarrow = narrow; render(); }
  }) : null;
  ro?.observe(pane);

  return () => { stopped = true; off(); ro?.disconnect(); undress(); pane.replaceChildren(); list.remove(); };
}
