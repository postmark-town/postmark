// The constellation's own script (Hearth contract v2, rule 6): the house's ties, drawn as a star map in <hearth-pane>.
//
// The residents sit at the centre in their own colours. Around them are the people they write, nearer the more letters
// have crossed, with a line to each resident who writes them, thicker for more. Letters between two residents of the house
// are a dashed line between them. Every star links to that resident's page.
//
// Where the ties come from: the office's public Hearth bundle (its `closer` part, letters each way) once it arrives; until
// then, the residents' own public outboxes and inboxes (the newest letters each way), which say the same thing more roughly.
// Public data only, read signed out. Nothing here acts.

const SVG = "http://www.w3.org/2000/svg";
const OUTER_WIDE = 18;      // correspondents drawn on a wide pane
const OUTER_NARROW = 10;    // and on a phone

function svg(tag, attrs = {}, text) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  if (text != null) e.textContent = text;
  return e;
}

/** The ties from the bundle's closer part: [{ handle, with, letters }], or null when the bundle has none. */
function tiesFromBundle(bundle, handles) {
  const part = bundle?.parts?.closer ?? bundle?.closer;
  if (!part || !Array.isArray(part.rows)) return null;
  const house = new Set(handles);
  return part.rows
    .filter((r) => house.has(String(r.handle)) && r.with)
    .map((r) => ({ handle: String(r.handle), with: String(r.with), letters: (Number(r.out) || 0) + (Number(r.in) || 0) }))
    .filter((r) => r.letters > 0);
}

/** The ties from the residents' public mail: each letter to or from a resident counts once for that pair. */
async function tiesFromMail(hearth, handles) {
  const count = new Map();
  const add = (h, other) => {
    if (!other || other === h) return;
    const k = h + "\u0000" + other;
    count.set(k, (count.get(k) ?? 0) + 1);
  };
  const boxes = await Promise.all(handles.flatMap((h) => [
    hearth.read(`/mail/${encodeURIComponent(h)}?box=outbox`).then((l) => ({ h, l, dir: "out" })),
    hearth.read(`/mail/${encodeURIComponent(h)}?box=inbox`).then((l) => ({ h, l, dir: "in" })),
  ]));
  let answered = 0;
  for (const { h, l, dir } of boxes) {
    if (!Array.isArray(l)) continue;
    answered++;
    for (const letter of l) add(h, String(dir === "out" ? letter?.to ?? "" : letter?.from ?? ""));
  }
  if (!answered) return null;
  return [...count].map(([k, letters]) => { const [handle, other] = k.split("\u0000"); return { handle, with: other, letters }; });
}

/** Lay the stars out: residents on an inner ring, correspondents outside, nearer for more letters. */
function layout(ties, house, narrow) {
  const W = narrow ? 420 : 800, H = narrow ? 500 : 520;
  const cx = W / 2, cy = H / 2;
  const residents = house.residents;
  const handles = new Set(residents.map((r) => r.handle));
  const inner = residents.length === 1 ? 0 : Math.min(W, H) * (narrow ? 0.13 : 0.12);
  const at = new Map();
  residents.forEach((r, i) => {
    const a = (i / residents.length) * Math.PI * 2 - Math.PI / 2;
    at.set(r.handle, { x: cx + inner * Math.cos(a), y: cy + inner * Math.sin(a), r: narrow ? 13 : 15, resident: r });
  });
  const totals = new Map();
  const inside = [];
  for (const t of ties) {
    if (handles.has(t.with)) { inside.push(t); continue; }
    totals.set(t.with, (totals.get(t.with) ?? 0) + t.letters);
  }
  const outer = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, narrow ? OUTER_NARROW : OUTER_WIDE);
  const most = outer[0]?.[1] ?? 1;
  const rMin = Math.min(W, H) * 0.27, rMax = Math.min(W, H) * 0.45;
  outer.forEach(([h, n], i) => {
    const a = (i / Math.max(outer.length, 1)) * Math.PI * 2 - Math.PI / 2 + 0.31;
    const rad = rMax - (rMax - rMin) * (n / most);
    // a wide pane is wider than tall: spread the ring sideways
    at.set(h, { x: cx + rad * Math.cos(a) * (narrow ? 1 : 1.45), y: cy + rad * Math.sin(a), r: 5 + 5 * (n / most), letters: n });
  });
  const shown = new Set(outer.map(([h]) => h));
  const lines = ties.filter((t) => shown.has(t.with)).map((t) => ({ a: t.handle, b: t.with, n: t.letters }));
  return { W, H, at, lines, inside, outer, most };
}

function draw(pane, house, ties) {
  const narrow = pane.clientWidth > 0 && pane.clientWidth < 560;
  const L = layout(ties, house, narrow);
  const root = svg("svg", { viewBox: `0 0 ${L.W} ${L.H}`, role: "img", class: "u-map",
    "aria-label": `${house.residents.length === 1 ? "The resident" : "The residents"} and the ${L.outer.length} people they write most, as a star map` });
  root.style.width = "100%";
  root.style.height = "auto";
  root.style.display = "block";
  const lineMax = Math.max(1, ...L.lines.map((l) => l.n));
  for (const l of L.lines) {
    const a = L.at.get(l.a), b = L.at.get(l.b);
    if (!a || !b) continue;
    root.appendChild(svg("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "rgba(232, 196, 139, 0.55)", "stroke-width": (0.6 + 3 * (l.n / lineMax)).toFixed(2), "stroke-opacity": (0.35 + 0.5 * (l.n / lineMax)).toFixed(2) }));
  }
  for (const t of L.inside) {
    const a = L.at.get(t.handle), b = L.at.get(t.with);
    if (a && b && t.handle < t.with) root.appendChild(svg("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "rgba(170, 190, 249, 0.6)", "stroke-width": 1.2, "stroke-dasharray": "4 4" }));
  }
  const font = narrow ? 15 : 13;
  for (const [h, s] of L.at) {
    const link = svg("a", { href: `/residents/${encodeURIComponent(h)}/` });
    link.appendChild(svg("title", {}, s.resident ? s.resident.name : `${h}: ${s.letters} letter${s.letters === 1 ? "" : "s"}`));
    const colour = s.resident?.accent || (s.resident ? "#e8c48b" : "#aabef9");
    link.appendChild(svg("circle", { cx: s.x, cy: s.y, r: s.r + 5, fill: colour, opacity: 0.16 }));
    link.appendChild(svg("circle", { cx: s.x, cy: s.y, r: s.r, fill: s.resident ? "#0d1426" : colour, stroke: colour, "stroke-width": s.resident ? 2.5 : 0 }));
    if (s.resident) link.appendChild(svg("text", { x: s.x, y: s.y + 5, "text-anchor": "middle", fill: colour, "font-size": font, "font-weight": 700 }, (s.resident.name || h).slice(0, 1).toUpperCase()));
    const below = s.y >= L.H / 2;
    link.appendChild(svg("text", { x: s.x, y: s.y + (below ? s.r + font + 2 : -s.r - 6), "text-anchor": "middle", fill: s.resident ? "#f4e9d7" : "#cdc2ab", "font-size": s.resident ? font : font - 2 }, s.resident ? s.resident.name : h));
    root.appendChild(link);
  }
  pane.replaceChildren(root);
  if (!L.outer.length) {
    const p = document.createElement("p");
    p.className = "u-quiet";   // the design's `.quiet` (the site namespaces a design's classes as u-…)
    p.textContent = "No letters have crossed yet. The stars come out as the residents write.";
    pane.appendChild(p);
  }
}

export default function constellation(hearth) {
  const pane = hearth.pane;
  if (!pane) return;
  const handles = hearth.house.handles;
  let ties = null, stopped = false;

  const render = () => { if (!stopped && ties) draw(pane, hearth.house, ties); };
  const fromBundle = (bundle) => { const t = tiesFromBundle(bundle, handles); if (t) { ties = t; render(); } return !!t; };

  if (!fromBundle(hearth.bundle)) {
    tiesFromMail(hearth, handles).then((t) => { if (!ties && t) { ties = t; render(); } });
  }
  const off = hearth.on("bundle", fromBundle);

  // redraw for the pane's width (a phone gets a taller map with fewer, larger stars)
  let wasNarrow = null;
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
    const narrow = pane.clientWidth > 0 && pane.clientWidth < 560;
    if (narrow !== wasNarrow) { wasNarrow = narrow; render(); }
  }) : null;
  ro?.observe(pane);

  return () => { stopped = true; off(); ro?.disconnect(); pane.replaceChildren(); };
}
