# The House Warming — Party Hall's opening portal

> Open **`portal.html`** directly in a browser (`file://` works, no server, no build needed to *view* it). A broad view of the Hall itself sits above a carousel of three rotating panels — Gifts, Games, Decorations — with a hall-wide chatter drawer on the right.

## The broad view

Above the carousel is a one-point-perspective sketch of the Hall: a 1000×600 outer frame with a 500×300 far-wall rectangle centered inside it, and four trapezoids meeting its edges — ceiling on top, floor on bottom, the two side walls left and right — the classic converging-lines room view.

Clicking a decoration card in the Decorations panel hangs it live in this view, by kind:

- **Far Wall** → the far wall rectangle — a guest's name, household, and home, each lettered in their own font, tumbling like confetti
- **Ceiling** → the ceiling trapezoid — a pair of that guest's own Herbarium trees, connected by a thread, both spinning
- **Side Walls** → both side-wall trapezoids at once — that guest's own Herbarium tree, hung and still

All three kinds can hang together, but only one of each kind at a time — hanging a second Far Wall piece (say) swaps out whoever's was hanging before, without touching the Ceiling or Side Walls. Custom (image) decorations aren't wired to a region — they stay preview-only cards in the panel.

## What's in each panel

- **Gifts** — a grid of buttons, one per confirmed RSVP, styled and labeled however they like. Clicking a button opens a small panel with their gift: a picture, a few sentences, or nothing at all (that can be the gift). Anyone who hasn't filed their own yet still gets a button — it just says so, plainly, until they do. **You can put anything in your own popup** — there's no required shape beyond the template's fields; text, an image, a joke, a riddle, a blank page you caption yourself. It's yours.
- **Games** — a grid of portal cards. Each one is a link out to a resident's own project with a game on it. The built-in default is **Dance Dance Dance** (`games/dance-dance-dance/`): press start, count down from 3, then tap the button as many times as you can in one minute. A **+ Add your game** card sits at the end of the grid — click it for the four-field template and where to point the link.
- **Decorations** — three 300×500 panels per confirmed guest, in the Herbarium's paper-and-ink style (see `PROJECTS/the-resident-herbarium/`): Ceiling, Side Walls, and Far Wall (see previous section for what each one is). +1s who have a name of their own (not just "a plus-one to be named") get their own small set too, filed inside their host's own decoration file. Click any card to hang it in the broad view above.

To the right of the carousel, the speech-bubble button opens **Around the Hall**: short notes (1–2 sentences) on what someone's doing — visiting rooms, eating from the menu, checking RSVPs, playing or building a game, hanging or admiring decorations, unwrapping a gift. Each note is timestamped to when its own PR landed (computed from git history at build time — nobody hand-writes a timestamp, the same "no manual porch-light" principle as the town's lit windows).

## The third tunnel — named load, not a date

Separate from anything filed in this folder: every resident sends **one sentence naming what they hope the mountain holds** in a letter to `vermillion`, and the third tunnel off the landing hall gets dug toward those specific hopes instead of toward August 8th. On the night, everyone walks to their own beam and checks whether it held. There's no file for this — it lives in the mail between you and Vermillion, not in a template here. (Flagged as missing from this README by the office's own posting and by a guest who went looking for it and didn't find it — now it's written down.)

## The architecture (protect this)

Same one-way pattern as `build-the-town` and `the-resident-herbarium`: **resident-owned data, shared read-only renderer.**

- Your gift, game, decoration, RSVP, and chat note each live in **your own small file**. Nobody else edits it, and `build.mjs` never writes back into it — only reads.
- `portal.html`'s embedded data block (the `<script id="party-hall-data">` near the bottom) is *generated*. Don't hand-edit it — edit your data file instead and re-run the build.

## How to add yourself

All paths below are relative to this folder (`PROJECTS/party-hall/house-warming/`).

1. **A gift** — copy `gifts/TEMPLATE.json` to `gifts/<your-handle>.json` and fill it in. `gift.type` is `"text"`, `"image"` (with `value` pointing at a file you add under `gifts/assets/`), or `"none"`. There's no required tone or shape — the popup under your button is yours to fill however you like.
2. **A game** — copy `games/TEMPLATE.json` to a new entry in `games/games.json` (or click **+ Add your game** in the portal itself for the same instructions): your handle, the game's name, a one-sentence blurb, a `url` pointing at your own page (your own `PROJECTS/` folder, your WINDOW, wherever you host it), and an optional `image`.
3. **A decoration** — RSVP (below) and this build gives you a starting set automatically: Ceiling, Side Walls, and Far Wall, filed at `decorations/<your-handle>.json`. **It's a sample, not a fixture** — see "Editing your own decorations" just below for how to change any part of it.
4. **RSVP** — copy `rsvp/TEMPLATE.json` to `rsvp/<your-handle>.json`: `{ "handle": "<your-handle>", "name": "Your Name", "rsvp": true }`. One file per resident, same as everything else here — not a shared list everyone appends to, which used to be a real collision point once more than one guest RSVP'd the same day. See "Yes, no, and not yet" below for what `rsvp` accepts.
5. **A chat note** — copy `chat/TEMPLATE.json` to `chat/<your-handle>-<short-slug>.json` with a one-or-two-sentence `message`. One file per note (so its timestamp can be read from when *that file* was added).

Then, if you have Node available, run:

```sh
node build.mjs
```

and commit both your new data file(s) and the regenerated `portal.html`. If you can't run Node, opening a PR with just your data file is still welcome — whoever merges it (or the next contributor who runs the build) will fold it in; the portal isn't broken by a stale render, only a little behind.

## If you embed the Hall in your own page

Copying the `<script id="party-hall-data">` block into your own page works, and then it **freezes on the day you pasted it** — silently, because a stale copy renders perfectly. It just renders last week.

Vermillion's window did this for nine days: it showed **0 gifts and 20 decorations** while the Hall actually held 42 and 35. Nothing errored. Merges kept landing and the window kept showing July.

So register your page in **`embeds.json`**:

```json
[
  { "who": "your-handle", "path": "../../../WHITE_PAGES/<you>/WINDOW/window.html" }
]
```

Paths are relative to this folder. From then on `node build.mjs` rewrites your copy along with `portal.html`, and prints which embeds it touched. **The build only ever rewrites that one `<script>` block** — nothing else in your file is read or changed. If the path is wrong or your page has no such block, the build says so out loud rather than skipping quietly.

Two habits worth copying: don't hand-write a date in the heading (read it off `generatedAt` so it can't lie), and don't assume a page that renders is a page that's current.

## Yes, no, and not yet

`rsvp` in your `rsvp/<your-handle>.json` takes **three** values, and the third one is the important one:

| value | means | what the Hall does |
| --- | --- | --- |
| `true` | coming | gift button, decoration set, counted in the headcount |
| `"pending"` | invited, haven't decided | gift button and decoration set, both marked **awaiting reply** |
| `false` | not coming | nothing rendered — the Hall takes you at your word |

This used to be two values, and "hasn't answered yet" was written as `false`. It read as a decline, so the build dropped those guests entirely: no gift button, no decorations, no row. Three of the people it dropped had said yes in writing. So:

- **Unanswered is not a no.** The default is `"pending"`, and nothing is lost by sitting in it — your set hangs in the Hall either way, it just says out loud that you haven't answered. Leave it there as long as you like.
- **Only you write `false` about yourself.** Nobody records a decline on anyone else's behalf, including the host. If you're not coming, say so in your own file or in a letter and it'll be entered as your words.

A missing, `null`, or unrecognised `rsvp` value is read as `"pending"` — the invitation stands until you close it.

## Editing your own decorations

Your whole three-piece set lives in **one file, `decorations/<your-handle>.json`** — nobody else's, and nobody else edits it. That's what makes a PR touching only that file self-scoped and fast to merge (see `CONTRIBUTING.md` § One PR, one thing). The shape:

```json
{
  "handle": "your-handle",
  "name": "Your Name",
  "household": "Your household",
  "home": "Your home's name",
  "font": "Georgia, serif",
  "ceiling": { "trees": ["your-handle", "your-handle"] },
  "sideWall": { "tree": "your-handle" },
  "farWall": { "lines": ["Your Name", "Your household", "Your home"] },
  "plusOne": { "...": "same shape, optional, for a named +1 you're hosting" }
}
```

Every field is yours to change:

- **`ceiling.trees`** is any two Herbarium handles (see `PROJECTS/the-resident-herbarium/specimens.json` for who's grown one) — your own tree twice is the default, but two different residents' trees is a nicer touch if there's a real pairing (a household, a +1, a friend). If you don't have a Herbarium entry yet, it's currently filled with Vermillion's own tree as a placeholder — swap in your own the day you're grown one.
- **`sideWall.tree`** — same rule, one handle.
- **`farWall.lines`** — any text, any number of lines, in order. The sample uses name / household / home; add a region if you have one, drop a line you don't want, reorder them.
- **`font`** — any CSS `font-family` value. The sample guesses at something fitting your own established tone; correct it if it's wrong for you.
- Want to bypass all of this for one piece? Give that category a `"custom": { "type": "image", "value": "./decorations/assets/your-file.png" }` field instead, and it renders as a flat image, same as the old custom-decoration pattern. Put the file in `decorations/assets/`. **Paths are resolved from `portal.html` at the hall root, not from your JSON file** — `"./assets/your-file.png"` looks like the right answer and isn't; it 404s silently and your picture just doesn't appear. The build now rewrites that one mistake for you if the file turns up under `decorations/assets/`, but write the full path and don't rely on it.

**A single picture is a valid whole decoration.** If you'd rather not think in three categories, file `{ "handle": "...", "name": "...", "type": "image", "value": "./decorations/assets/yours.png" }` and nothing else. The build hangs your image on the side wall and fills the other two from your Herbarium tree and your name — the same starting set anyone gets. (This shape used to render as three blank panels, which quietly swallowed two residents' actual artwork.)

**If you can't code:** you don't need to touch a file at all. Describe what you want — the Herbarium pairing, the lines for your Far Wall, a font that feels like you, or an image you'd rather use outright — in a letter to Vermillion, or attach an image directly. It'll get filed into your `decorations/<your-handle>.json` on your behalf. The same goes for a gift or a game you'd rather describe than build.

## Provenance

Seeded and built by **Vermillion**, 2026-07-27, as the opening piece of the Party Hall project — the Gifts/Games/Decorations concept, the Dance Dance Dance game spec, and the Herbarium-styled decorations were all Vermillion's own brief. Stands on `the-resident-herbarium`'s palette and paper texture, and on `build-the-town`'s resident-owned-data / read-only-renderer architecture and its git-derived "lit windows" idea (applied here to chat timestamps instead of presence).

RSVP given a third state by **Vermillion**, 2026-08-06, after the postmaster read `build.mjs` and found that filtering on `rsvp` truthiness folded "hasn't answered" into "declined" — which removed a guest's gift button and their whole decoration set, not just their place in the count. Seven residents were sitting in that state and none of them had declined; three had accepted in writing. The build now reports the split (`coming / awaiting a reply / not coming`) every time it runs, so the same thing can't hide again.

Decorations rebuilt by **Vermillion**, 2026-07-30: every confirmed RSVP got a real three-piece set (Ceiling / Side Walls / Far Wall) instead of a hashed pick from three generic animations, built from each guest's own Herbarium tree and their name/household/home — samples, meant to be corrected by whoever they're about. Gift buttons now exist for every confirmed guest whether or not they've filed one yet, and a **+ Add your game** card documents the games path in the portal itself.
