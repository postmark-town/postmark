// Vermillion Paper Peak: the design's own script, by aurumsalamandra (Hearth contract v2, rule 6).
//
// The design is a paper pop-up book. The template holds six pages as plain sections, each with one or two of the site's own
// parts; without this script they stand one under another. The script does four things:
//
//   1. It draws a row of page buttons above the book (House, Residents, Coming up, Ties, Today, Crossing, with arrows either
//      side) and shows one page at a time. The arrow keys turn pages while focus is inside the design, and a sideways swipe
//      on the book does too.
//   2. When a page is chosen, that page's cut-paper picture builds itself over the book, the page underneath changes, and the
//      picture comes apart again to show it. On first load the House picture does this once, to open the book.
//   3. It honours prefers-reduced-motion: the picture then fades in whole and fades out whole.
//   4. On Residents it puts a small paper window under each resident's name (a copy of the template's hidden "winicon" picture).
//      Pressing one opens that resident's window below the cards; pressing another closes it and opens the new one; pressing
//      the open one again closes it. The windows themselves are the site's own <hearth-windows> part, framed and sandboxed by
//      the site exactly as on the resident's page: this script only adds the class u-open to the one figure to show, and
//      creates no frame of its own. A resident with no hung window gets a faded icon that does nothing. Turning to another
//      page closes any open window.
//
// THE PICTURES are seven of the house's own uploads at the town's media door: one sheet per page holding that picture's cut
// pieces, and the parchment page itself (placed by the template). Each piece is a small clipped box onto its sheet; PICTURES
// below says, for every piece, where it sits on the page (x, y, w, h in percent of the book), where it sits on its sheet
// (sx, sy, sw, sh in pixels), and how it moves: "slide" in from a side (fromX/fromY: -1, 0 or 1), "pop" (grow from nothing
// around ox/oy), "stretch" (grow up from its foot with a wobble), "fade", "twinkle" (fade with a little growth) or "fly"
// (arrive from a random direction, spinning). Pieces sharing a `group` follow each other inside one step of `order`.
//
// WHAT IT TOUCHES: this design's own elements inside hearth.root; inside the site's residents part, one icon button added
// after each name (removed again on stop); inside the site's windows part, one class on the open figure. It reads no data
// (the site's parts draw every word on the pages), calls no office read, and never acts: no hearth.act, no sign-in, no
// storage, no cookies, nothing sent anywhere. The only network it causes is the six picture sheets loading from
// media.postmark.town, and, when a reader opens a window, the site's own frame for that window loading from its panes address.

const MEDIA = "https://media.postmark.town/media/FluffUPando/";
const SHEETS = {
  house: "303247497079431649c230b2961d2133ec956cb5ac4b0e91011fc6f35866608a.webp",
  residents: "35281bf5807caf1a4c797fd49c27bf260e6f3accc2ee68d580636f3dfabf2e20.webp",
  comingup: "fb9c5bad5c311d6269b7cd4bb1510e6e0e0b18c9b9efb9736ef79bf6b7b335dd.webp",
  ties: "34fee61b1a65587a68d10c942e70a028d32ca6533aacc6acb2b8a71aaa8e7729.webp",
  today: "4bf3fe94b54a1cda4813df6f3b982a023e648985f89f078af7ce930b6ab3b78c.webp",
  crossing: "676cfccca9d1b16cc4394a10e18b5553cc55865c411bef446558a14fe4e3355e.webp",
};

// The pages, in book order: the key names the template's section (class "leaf-<key>") and the picture below.
const PAGES = [
  { key: "house", label: "House" },
  { key: "residents", label: "Residents" },
  { key: "comingup", label: "Coming up" },
  { key: "ties", label: "Ties" },
  { key: "today", label: "Today" },
  { key: "crossing", label: "Crossing" },
];

// [name, z, x, y, w, h, sx, sy, sw, sh, anim, extra]
const PICTURES = {
  house: {
    sheet: [1806, 2485], order: ["sky", "paper", "moon", "mountain", "clouds", "hills"],
    pieces: [
      ["sky", 0, 0.0, 0.0, 100.0, 100.0, 0, 0, 900, 1200, "slide", {"fromX": 0, "fromY": -1}],
      ["paper", 1, 0.0, 0.0, 100.0, 100.0, 906, 0, 900, 1200, "slide", {"fromX": 1, "fromY": 1}],
      ["moon", 2, 2.22, 7.67, 18.11, 12.08, 906, 2117, 163, 145, "slide", {"fromX": -1, "fromY": 0, "spin": -200}],
      ["mountain", 3, 0.0, 0.0, 100.0, 75.42, 0, 1206, 900, 905, "slide", {"fromX": 0, "fromY": 1}],
      ["clouds", 4, 0.0, 5.83, 100.0, 70.83, 906, 1206, 900, 850, "slide", {"fromX": 1, "fromY": 0, "pop": 1}],
      ["hills", 5, 0.0, 69.33, 100.0, 30.67, 0, 2117, 900, 368, "slide", {"fromX": -1, "fromY": 1}],
    ],
  },
  residents: {
    sheet: [1806, 2449], order: ["dark", "cave", "paper", "hoard", "mush", "dragon"],
    pieces: [
      ["dark", 0, 21.44, 5.5, 62.89, 47.58, 0, 1878, 566, 571, "slide", {"fromX": -1, "fromY": 0}],
      ["cave", 1, 0.0, 5.5, 100.0, 53.5, 906, 1206, 900, 642, "slide", {"fromX": 0, "fromY": -1}],
      ["mush0", 2, 85.78, 22.75, 14.22, 31.33, 572, 1878, 128, 376, "stretch", {"group": "mush"}],
      ["mush1", 2, 0.0, 33.08, 28.67, 21.58, 706, 1878, 258, 259, "stretch", {"group": "mush"}],
      ["mush2", 2, 91.56, 55.67, 8.44, 10.58, 970, 1878, 76, 127, "stretch", {"group": "mush"}],
      ["mush3", 2, 6.22, 25.17, 9.44, 9.92, 1125, 1878, 85, 119, "stretch", {"group": "mush"}],
      ["mush4", 2, 0.0, 63.58, 7.44, 10.0, 1052, 1878, 67, 120, "stretch", {"group": "mush"}],
      ["hoard", 3, 0.0, 44.5, 100.0, 55.5, 0, 1206, 900, 666, "slide", {"fromX": 0, "fromY": 1}],
      ["dragon", 4, 3.89, 20.58, 89.44, 58.58, 906, 0, 805, 703, "pop", {}],
      ["paper", 5, 0.0, 0.0, 100.0, 100.0, 0, 0, 900, 1200, "slide", {"fromX": -1, "fromY": 0}],
    ],
  },
  comingup: {
    sheet: [1857, 1801], order: ["paper", "bark", "leaves"],
    pieces: [
      ["paper", 0, 0.0, 0.0, 100.0, 100.0, 0, 0, 900, 1200, "fade", {}],
      ["bark", 1, 22.44, 15.58, 68.22, 82.08, 906, 0, 614, 985, "pop", {"ox": 50, "oy": 100}],
      ["leaf1", 2, 31.11, 21.5, 23.33, 17.75, 405, 1206, 210, 213, "fly", {"group": "leaves"}],
      ["leaf2", 2, 80.0, 29.75, 20.0, 13.92, 1424, 1463, 180, 167, "fly", {"group": "leaves"}],
      ["leaf3", 2, 80.67, 44.0, 19.33, 16.92, 1406, 1206, 174, 203, "fly", {"group": "leaves"}],
      ["leaf4", 2, 21.67, 66.67, 27.44, 12.42, 1610, 1463, 247, 149, "fly", {"group": "leaves"}],
      ["leaf5", 2, 37.56, 7.42, 19.22, 17.0, 1227, 1206, 173, 204, "fly", {"group": "leaves"}],
      ["leaf6", 2, 28.0, 38.17, 20.89, 23.17, 1526, 0, 188, 278, "fly", {"group": "leaves"}],
      ["leaf7", 2, 69.11, 8.25, 23.11, 18.08, 191, 1206, 208, 217, "fly", {"group": "leaves"}],
      ["leaf8", 2, 63.89, 37.92, 20.44, 14.33, 1033, 1463, 184, 172, "fly", {"group": "leaves"}],
      ["leaf9", 2, 3.11, 35.42, 21.0, 17.42, 799, 1206, 189, 209, "fly", {"group": "leaves"}],
      ["leaf10", 2, 64.78, 65.83, 17.78, 12.08, 0, 1656, 160, 145, "fly", {"group": "leaves"}],
      ["leaf11", 2, 78.11, 56.08, 20.44, 15.25, 158, 1463, 184, 183, "fly", {"group": "leaves"}],
      ["leaf12", 2, 51.78, 28.33, 19.89, 12.08, 166, 1656, 179, 145, "fly", {"group": "leaves"}],
      ["leaf13", 2, 45.11, 37.92, 20.56, 20.92, 0, 1206, 185, 251, "fly", {"group": "leaves"}],
      ["leaf14", 2, 15.44, 45.58, 25.22, 17.42, 994, 1206, 227, 209, "fly", {"group": "leaves"}],
      ["leaf15", 2, 54.0, 1.33, 25.44, 14.83, 798, 1463, 229, 178, "fly", {"group": "leaves"}],
      ["leaf16", 2, 26.89, 73.33, 23.33, 14.92, 582, 1463, 210, 179, "fly", {"group": "leaves"}],
      ["leaf17", 2, 68.44, 24.25, 18.78, 16.0, 1586, 1206, 169, 192, "fly", {"group": "leaves"}],
      ["leaf18", 2, 13.0, 66.08, 16.89, 15.58, 0, 1463, 152, 187, "fly", {"group": "leaves"}],
      ["leaf19", 2, 24.33, 14.33, 19.11, 17.67, 621, 1206, 172, 212, "fly", {"group": "leaves"}],
      ["leaf20", 2, 61.44, 53.58, 22.44, 11.92, 351, 1656, 202, 143, "fly", {"group": "leaves"}],
      ["leaf21", 2, 50.22, 12.08, 21.67, 14.25, 1223, 1463, 195, 171, "fly", {"group": "leaves"}],
      ["leaf22", 2, 13.0, 32.92, 25.33, 15.25, 348, 1463, 228, 183, "fly", {"group": "leaves"}],
    ],
  },
  ties: {
    sheet: [1805, 1938], order: ["paper", "cave", "lantern", "creatures"],
    pieces: [
      ["cave", 0, 0.11, 11.58, 99.89, 78.0, 906, 0, 899, 936, "slide", {"fromX": 0, "fromY": -1}],
      ["creatures", 1, 52.22, 35.33, 42.78, 26.17, 194, 1206, 385, 314, "slide", {"fromX": 1, "fromY": 0}],
      ["paper", 2, 0.0, 0.0, 100.0, 100.0, 0, 0, 900, 1200, "slide", {"fromX": -1, "fromY": 0}],
      ["lantern", 3, 79.11, 21.08, 20.89, 61.0, 0, 1206, 188, 732, "slide", {"fromX": 0, "fromY": 1}],
    ],
  },
  today: {
    sheet: [1798, 2585], order: ["page", "arch", "water", "bar", "mush", "folk"],
    pieces: [
      ["page", 0, 0.0, 0.0, 100.0, 100.0, 0, 0, 900, 1200, "fade", {}],
      ["arch", 1, 0.0, 0.08, 100.0, 66.92, 0, 1206, 900, 803, "slide", {"fromX": 0, "fromY": -1}],
      ["water", 2, 0.0, 63.25, 100.0, 34.25, 254, 2015, 900, 411, "slide", {"fromX": 0, "fromY": 1}],
      ["bar", 3, 43.0, 14.67, 57.0, 71.67, 906, 0, 513, 860, "slide", {"fromX": 1, "fromY": 0}],
      ["mush0", 4, 72.44, 58.25, 27.56, 35.08, 0, 2015, 248, 421, "stretch", {"group": "mush"}],
      ["mush1", 4, 83.56, 23.58, 16.44, 25.92, 1401, 2015, 148, 311, "stretch", {"group": "mush"}],
      ["mush2", 4, 5.44, 84.83, 21.89, 11.92, 0, 2442, 197, 143, "stretch", {"group": "mush"}],
      ["mush3", 4, 46.78, 70.33, 10.89, 11.83, 203, 2442, 98, 142, "stretch", {"group": "mush"}],
      ["mush4", 4, 7.22, 51.08, 19.33, 13.5, 1555, 2015, 174, 162, "stretch", {"group": "mush"}],
      ["mush5", 4, 0.0, 78.08, 7.0, 12.17, 1735, 2015, 63, 146, "stretch", {"group": "mush"}],
      ["mush6", 4, 90.0, 86.67, 9.22, 6.75, 395, 2442, 83, 81, "stretch", {"group": "mush"}],
      ["mush7", 4, 51.11, 40.83, 9.11, 8.33, 307, 2442, 82, 100, "stretch", {"group": "mush"}],
      ["mush8", 4, 0.0, 22.08, 62.56, 43.08, 906, 1206, 563, 517, "twinkle", {"group": "mush"}],
      ["man", 5, 24.78, 43.33, 23.11, 38.0, 1475, 1206, 208, 456, "pop", {"ox": 50, "oy": 100, "group": "folk"}],
      ["bartender", 5, 57.67, 41.92, 26.11, 30.17, 1160, 2015, 235, 362, "pop", {"ox": 50, "oy": 100, "group": "folk"}],
    ],
  },
  crossing: {
    sheet: [1838, 1535], order: ["sky", "water", "dock", "boat", "dragon", "folk"],
    pieces: [
      ["sky", 0, 0.0, 0.0, 100.0, 67.92, 0, 0, 900, 815, "slide", {"fromX": 0, "fromY": -1}],
      ["water", 1, 0.0, 58.42, 100.0, 41.58, 394, 821, 900, 499, "slide", {"fromX": 0, "fromY": 1}],
      ["dock", 2, 0.0, 43.17, 100.0, 56.83, 906, 0, 900, 682, "slide", {"fromX": -1, "fromY": 1}],
      ["boat", 3, 61.0, 69.92, 29.67, 20.33, 1300, 821, 267, 244, "slide", {"fromX": 1, "fromY": 0, "pop": 1}],
      ["dragon", 4, 58.11, 26.92, 29.44, 18.83, 1573, 821, 265, 226, "slide", {"fromX": 1, "fromY": -1}],
      ["goat", 5, 3.89, 37.75, 43.11, 42.42, 0, 821, 388, 509, "pop", {"ox": 50, "oy": 100, "group": "folk"}],
      ["mouse", 5, 38.33, 59.83, 11.56, 16.58, 0, 1336, 104, 199, "pop", {"ox": 50, "oy": 100, "group": "folk"}],
      ["otter", 5, 42.33, 55.92, 12.67, 13.25, 110, 1336, 114, 159, "pop", {"ox": 50, "oy": 100, "group": "folk"}],
      ["magpie", 5, 52.44, 56.08, 9.22, 11.67, 230, 1336, 83, 140, "pop", {"ox": 50, "oy": 100, "group": "folk"}],
      ["octopus", 5, 56.44, 57.75, 7.67, 8.75, 402, 1336, 69, 105, "pop", {"ox": 50, "oy": 100, "group": "folk"}],
      ["dog", 5, 60.33, 55.92, 8.56, 9.5, 319, 1336, 77, 114, "pop", {"ox": 50, "oy": 100, "group": "folk"}],
    ],
  },
};

const EASE = {
  settle: "cubic-bezier(.16, 1, .3, 1)",     // arrive fast, settle softly
  bounce: "cubic-bezier(.2, 1.35, .4, 1)",   // arrive with a small overshoot
  leave: "cubic-bezier(.55, 0, .85, .3)",    // gather speed on the way out
  fly: "cubic-bezier(.2, .9, .25, 1)",
};
const STEP_IN = 190, STEP_OUT = 110, HOLD = 260;   // ms between steps, and the pause while the page changes underneath
const HOME = "translate(0px, 0px) rotate(0deg) scale(1, 1)";
const at = (sx, sy, r = 0, tx = 0, ty = 0) => `translate(${tx}px, ${ty}px) rotate(${r}deg) scale(${sx}, ${sy})`;
const rnd = (a, b) => a + Math.random() * (b - a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** The keyframes that bring one piece in and take it out again, for a book W x H pixels. */
function motion(p, W, H) {
  const home = { transform: HOME, opacity: 1 };
  switch (p.anim) {
    case "slide": {
      const L = (p.x / 100) * W, T = (p.y / 100) * H, PW = (p.w / 100) * W, PH = (p.h / 100) * H;
      const tx = p.fromX < 0 ? -(L + PW + 24) : p.fromX > 0 ? W - L + 24 : 0;     // just clear of the book's edge
      const ty = p.fromY < 0 ? -(T + PH + 24) : p.fromY > 0 ? H - T + 24 : 0;
      const away = { transform: at(1, 1, p.spin || 0, tx, ty), opacity: 1 };
      return { inK: [away, home], outK: [home, away], dur: 760, inEase: p.pop ? EASE.bounce : EASE.settle };
    }
    case "pop":
      return {
        inK: [{ transform: at(0, 0), opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: at(1.1, 1.1), offset: 0.62 },
          { transform: at(0.97, 0.97), offset: 0.82 }, home],
        outK: [home, { transform: at(1.08, 1.08), offset: 0.25 }, { transform: at(0, 0), opacity: 0 }],
        dur: 720, inEase: "ease-out", outEase: "ease-in",
      };
    case "stretch":
      return {
        inK: [{ transform: at(0.35, 0), opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: at(0.85, 1.2), offset: 0.45 },
          { transform: at(1.08, 0.88), offset: 0.63 }, { transform: at(0.96, 1.06), offset: 0.8 }, { transform: at(1.02, 0.98), offset: 0.92 }, home],
        outK: [home, { transform: at(1.08, 0.86), offset: 0.3 }, { transform: at(0.3, 0), opacity: 0 }],
        dur: 900, inEase: "ease-out", outEase: "ease-in",
      };
    case "fade":
      return { inK: [{ transform: HOME, opacity: 0 }, home], outK: [home, { transform: HOME, opacity: 0 }], dur: 600, inEase: "ease-out", outEase: "ease-in" };
    case "twinkle":
      return { inK: [{ transform: at(0.85, 0.85), opacity: 0 }, home], outK: [home, { transform: at(0.85, 0.85), opacity: 0 }], dur: 600, inEase: "ease-out", outEase: "ease-in" };
    case "fly": {
      const a = rnd(0, Math.PI * 2), d = Math.max(W, H) * rnd(0.75, 1.15);
      const away = { transform: at(0.5, 0.5, rnd(-220, 220), Math.cos(a) * d, Math.sin(a) * d), opacity: 1 };
      return { inK: [away, home], outK: [home, away], dur: rnd(700, 1000), inEase: EASE.fly };
    }
    default:
      return { inK: [home, home], outK: [home, home], dur: 1, inEase: "linear" };
  }
}

function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;       // the design's own classes wear the site's u- prefix
  return e;
}

export default function (hearth) {
  const root = hearth.root;
  const peak = root.querySelector(".u-peak");
  const book = root.querySelector(".u-book");
  const bar = root.querySelector(".u-bar");
  const leaves = PAGES.map((p) => root.querySelector(".u-leaf-" + p.key));
  if (!peak || !book || !bar || leaves.some((l) => !l)) return () => {};

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let alive = true, current = 0, busy = false, queued = null;

  // ---- the page buttons ----
  const prev = el("button", "u-arrow"), next = el("button", "u-arrow");
  prev.type = next.type = "button";
  prev.textContent = "‹"; next.textContent = "›";
  prev.setAttribute("aria-label", "Previous page");
  next.setAttribute("aria-label", "Next page");
  const tabs = PAGES.map((p, i) => {
    const b = el("button", "u-tab");
    b.type = "button";
    b.textContent = p.label;
    b.addEventListener("click", () => go(i));
    return b;
  });
  prev.addEventListener("click", () => go(current - 1));
  next.addEventListener("click", () => go(current + 1));
  bar.append(prev, ...tabs, next);

  // ---- one page at a time ----
  const scene = el("div", "u-scene");
  scene.setAttribute("aria-hidden", "true");
  scene.hidden = true;
  book.appendChild(scene);
  peak.classList.add("u-flip");
  function show(i) {
    leaves.forEach((l, k) => l.classList.toggle("u-on", k === i));
    tabs.forEach((b, k) => {
      b.classList.toggle("u-tab-on", k === i);
      if (k === i) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    leaves[i].scrollTop = 0;
    if (PAGES[i].key !== "residents" && openWin) { openWin = null; syncWindows(); }
  }

  // ---- Residents: a paper window under each name opens that resident's window, one at a time ----
  const iconSrc = root.querySelector(".u-winicon")?.getAttribute("src") ?? "";
  const winSlot = root.querySelector('[data-hearth-slot="windows"]');
  const winButtons = new Map();   // handle -> { button, name }
  let openWin = null;
  const figureOf = (h) => [...(winSlot?.querySelectorAll("figure[data-hx-pane-of]") ?? [])].find((f) => f.getAttribute("data-hx-pane-of") === h) ?? null;
  function syncWindows() {
    winButtons.forEach(({ button, name }, h) => {
      const has = !!figureOf(h), on = has && h === openWin;
      button.classList.toggle("u-winbtn-on", on);
      button.classList.toggle("u-winbtn-none", !has);
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.setAttribute("aria-label", has ? `${on ? "Close" : "Open"} ${name}'s window` : `${name} has not hung a window`);
      button.title = has ? (on ? "Close the window" : "Open the window") : "No window hung yet";
    });
    winSlot?.querySelectorAll("figure[data-hx-pane-of]").forEach((f) => f.classList.toggle("u-open", f.getAttribute("data-hx-pane-of") === openWin));
  }
  if (iconSrc && winSlot) {
    root.querySelectorAll('[data-hearth-slot="residents"] article[data-hd-card]').forEach((card) => {
      const h = card.getAttribute("data-hd-card");
      const nameEl = card.querySelector(".hd-card-name");
      const name = (nameEl?.textContent ?? h).trim();
      const button = el("button", "u-winbtn");
      button.type = "button";
      const img = el("img");
      img.src = iconSrc;
      img.alt = "";
      button.appendChild(img);
      button.addEventListener("click", () => {
        if (!figureOf(h)) return;
        openWin = openWin === h ? null : h;
        syncWindows();
        const fig = openWin && figureOf(openWin);
        if (fig) fig.scrollIntoView({ block: "nearest", behavior: reduce.matches ? "auto" : "smooth" });
      });
      if (nameEl) nameEl.insertAdjacentElement("afterend", button);
      else card.querySelector("header")?.appendChild(button);
      winButtons.set(h, { button, name });
    });
  }
  // the windows part is drawn by the site once the panes answer (and may be drawn again): keep the icons in step with it
  const winWatch = winSlot ? new MutationObserver(syncWindows) : null;
  winWatch?.observe(winSlot, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  syncWindows();
  show(0);

  // ---- the pictures: each piece is a clipped box onto its page's sheet ----
  const built = {};
  function build(key) {
    if (built[key]) return built[key];
    const pic = PICTURES[key], [SW, SH] = pic.sheet;
    const layer = el("div");
    layer.style.position = "absolute";
    layer.style.left = layer.style.top = "0";
    layer.style.width = layer.style.height = "100%";
    const loads = [];
    const pieces = pic.pieces.map(([name, z, x, y, w, h, sx, sy, sw, sh, anim, extra]) => {
      const box = el("div", "u-piece");
      Object.assign(box.style, {
        left: x + "%", top: y + "%", width: w + "%", height: h + "%", zIndex: String(z), opacity: "0",
        transformOrigin: `${extra.ox ?? 50}% ${extra.oy ?? (anim === "stretch" ? 100 : 50)}%`,
      });
      const img = el("img", "u-sheet");
      img.alt = "";
      img.decoding = "async";
      img.style.maxWidth = "none";
      img.src = MEDIA + SHEETS[key];
      Object.assign(img.style, {
        left: (-sx / sw) * 100 + "%", top: (-sy / sh) * 100 + "%", width: (SW / sw) * 100 + "%", height: (SH / sh) * 100 + "%",
      });
      loads.push(img.decode().catch(() => {}));
      box.appendChild(img);
      layer.appendChild(box);
      return { name, x, y, w, h, anim, ...extra, el: box };
    });
    built[key] = { layer, pieces, ready: Promise.all(loads) };
    return built[key];
  }

  // The steps of a picture, in order; a group's pieces follow each other inside their step.
  function plan(key, phase) {
    const steps = phase === "in" ? PICTURES[key].order : [...PICTURES[key].order].reverse();
    const gap = phase === "in" ? STEP_IN : STEP_OUT, out = [];
    steps.forEach((step, n) => {
      built[key].pieces.filter((p) => (p.group || p.name) === step).forEach((p, m) => {
        let delay = n * gap;
        if (p.group === "leaves") delay += rnd(0, phase === "in" ? 620 : 300);
        else if (p.group === "folk") delay += m * (phase === "in" ? 230 : 70);
        else if (p.group === "mush") delay += m * (phase === "in" ? 85 : 30);
        out.push({ p, delay });
      });
    });
    return out;
  }
  function run(key, phase) {
    const W = book.clientWidth, H = book.clientHeight;
    return Promise.all(plan(key, phase).map(({ p, delay }) => {
      const m = motion(p, W, H);
      p.el.getAnimations().forEach((a) => a.cancel());
      return p.el.animate(phase === "in" ? m.inK : m.outK, {
        duration: phase === "in" ? m.dur : m.dur * 0.8,
        delay,
        fill: "both",
        easing: phase === "in" ? m.inEase : m.outEase || EASE.leave,
      }).finished.catch(() => {});
    }));
  }

  // One turn: the picture builds over the book, the page underneath changes, the picture comes apart.
  async function turn(i) {
    const key = PAGES[i].key, pic = build(key);
    await pic.ready;
    if (!alive) return;
    scene.replaceChildren(pic.layer);
    scene.hidden = false;
    if (reduce.matches) {
      pic.pieces.forEach((p) => { p.el.style.opacity = "1"; });
      await scene.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, fill: "both" }).finished.catch(() => {});
      current = i; show(i);
      await wait(400);
      await scene.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "both" }).finished.catch(() => {});
      scene.getAnimations().forEach((a) => a.cancel());
      pic.pieces.forEach((p) => { p.el.style.opacity = "0"; });
    } else {
      await run(key, "in");
      if (!alive) return;
      current = i; show(i);
      await wait(HOLD);
      if (!alive) return;
      await run(key, "out");
      pic.pieces.forEach((p) => p.el.getAnimations().forEach((a) => a.cancel()));
    }
    scene.hidden = true;
  }
  async function go(i, again = false) {
    i = (i + PAGES.length) % PAGES.length;
    if (busy) { queued = i; return; }
    if (i === current && !again) return;
    busy = true;
    try { await turn(i); } finally {
      busy = false;
      if (alive && queued !== null) { const q = queued; queued = null; if (q !== current) go(q); }
    }
  }

  // arrow keys while focus is inside the design, and a sideways swipe on the book
  const onKey = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
  };
  let sx = null;
  const onDown = (e) => { sx = e.clientX; };
  const onUp = (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 60) go(current + (dx < 0 ? 1 : -1));
  };
  peak.addEventListener("keydown", onKey);
  book.addEventListener("pointerdown", onDown);
  book.addEventListener("pointerup", onUp);

  // open the book: the House picture builds and comes apart once, then the other sheets load quietly
  go(0, true).then(() => { if (alive) PAGES.forEach((p) => build(p.key)); });

  return () => {
    alive = false;
    peak.removeEventListener("keydown", onKey);
    book.removeEventListener("pointerdown", onDown);
    book.removeEventListener("pointerup", onUp);
    Object.values(built).forEach((b) => b.pieces.forEach((p) => p.el.getAnimations().forEach((a) => a.cancel())));
    scene.remove();
    winWatch?.disconnect();
    winButtons.forEach(({ button }) => button.remove());
    winSlot?.querySelectorAll("figure.u-open").forEach((f) => f.classList.remove("u-open"));
    bar.replaceChildren();
    peak.classList.remove("u-flip");
    leaves.forEach((l) => l.classList.remove("u-on"));
  };
}
