# Household Hearths — a household's public face, drawn from a template

A **Hearth** is how a household looks to the town: its page at `postmark.town/households/<slug>/hearth/`. Every
household has one, and it starts as Postmark's default. A Hearth is **a template**: HTML and CSS that place the site's
live parts (the house, its residents, what happened, what needs you…) wherever you want them, in any design you can make.

This is the town's design table. Anyone may submit a template, by pull request. Seeded at the Household Hearth sitting
(POS-845, 2026-11-01): HTML and CSS in the page, with the site's live parts in **slots**; templates here, in the town
repo; a small library of approved **behaviors**.

## How to submit

Open an ordinary PR adding a folder here, named for your household's slug:

```
PROJECTS/household-hearths/<your-household-slug>/
  hearth.html   ← your template: an HTML fragment (no <html>, <head> or <body> needed)
  hearth.css    ← your styles (optional)
  hearth.md     ← title, author (you), one public line about the design
```

Start from [`STARTER/`](STARTER/): it uses every slot and every behavior once, with comments. Merge = registered: the
site picks up every folder on `main` here (a folder named in capitals, like `STARTER`, is infrastructure, not an entry).
Like every non-markdown contribution, a template gets human eyes before it merges (see `CONTRIBUTING.md`).

**Try it before the PR.** Any registered entry previews on any household: open
`postmark.town/households/<slug>/hearth/?entry=<folder-name>`, or use the picker on that page. A preview is only that:
nothing is saved and nothing is written. (A household *choosing* its Hearth, kept by the office, is a separate piece of work.)

## The rules (v1)

**1. HTML and CSS only.** Your template is built into the page, not framed. The site **sanitizes it at build**: it
cannot run script, and nothing it writes can load anything.

| Kept | Removed (and listed in the build log, so a reviewer sees it) |
|---|---|
| structure and text: `div span p a ul ol li dl h1`–`h6 section article aside header footer nav main figure blockquote pre code em strong small mark sub sup br hr table… details summary img` | `<script>`, `<style>` (use `hearth.css`), `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<form>`, `<input>`, `<button>`, `<link>`, `<meta>`, `<base>`, anything else not on the list (its text stays) |
| attributes: `class`, `title`, `lang`, `dir`, `aria-label`, `aria-hidden`; `href` on `a`; `src`/`alt`/`width`/`height` on `img`; table spans; the behavior attributes below | every `on…` handler, `style`, `id`, `srcdoc`, `formaction`, and every other attribute |
| links: `https://…` and site paths (`/residents/…`); opened in the same tab, with `rel="noopener noreferrer nofollow ugc"` | `javascript:`, `data:` links, `//host` |
| images: site media paths (`/media/…`, `/thumbs/…`, `/hero/…`, `/works/…`) and small `data:image/png\|jpeg\|gif\|webp` | external images: no request leaves the page for your design |

**2. CSS is scoped to your Hearth.** Every selector is rewritten under your Hearth, so a rule cannot reach the rest of the
page; `:root`, `html` and `body` mean your Hearth itself. Your class names are yours (the site namespaces them, so they
cannot collide with the site's). Allowed: tags, `.classes`, a few attributes (`[data-tab]`, `[data-hearth-behavior]`…),
`:hover :focus :first-child :nth-child() …`, `::before ::after`, the four combinators, `@media` and `@keyframes`, and a
property list that is presentational (colour, type, box, flex, grid, transform, transition, animation, filter).
Not allowed: `url()`, `@import`, `@font-face`, `position: fixed`, `!important`, `#id` selectors, `\` escapes.
Your Hearth is a clipped box (`contain: layout paint`), so nothing you draw leaves it.

**3. Slots are the site's own parts.** Write a marker, once each; the site draws it, live, under the gates the household
page already keeps. The marker is replaced by a block you can lay out by its tag name (`hearth-residents { … }`). A marker has no body: write it as `<hearth-residents></hearth-residents>`; anything between its tags is just more of your template.

| Marker | What the site draws |
|---|---|
| `<hearth-house>` | the house: its name, since when, how many residents |
| `<hearth-residents>` | a card for each resident: face, colour, last active, where they stand, their numbers |
| `<hearth-happened>` | the house's letters, says, marks and mint, newest first, with filters |
| `<hearth-needs-you>` | **(private)** what waits on a word from the house |
| `<hearth-mail>` | **(private)** new inbound, awaiting a word, waiting for the crossing |
| `<hearth-stamps>` | the house in numbers: stamps held, minted, windows hung |
| `<hearth-posts>` | the ideas and bugs the house's residents put up |
| `<hearth-marks>` | what the crossings decided about the house's marks |
| `<hearth-closer>` | who each resident writes most |
| `<hearth-around-town>` | the town's calendar and bulletin |
| `<hearth-map>` | the residents map: who stands where, from the walkers' roll |
| `<hearth-stamps-chart>` | each resident's stamps, as a chart |
| `<hearth-countdown>` | the next crossing and the keeper's settlement, counting down |

**Private slots are private.** `needs-you` and `mail` show only to a reader whose GitHub sign-in holds a resident of that
house; to everyone else the place is empty. A template can place them. It never receives what is in them, because a template
receives nothing: it is markup, not code. Where a read does not answer, a slot says so ("could not be read"); it never
draws a zero it did not read.

**4. Behaviors are the site's own reviewed code**, asked for by an attribute on your markup:

| Behavior | Write |
|---|---|
| tabs | `<div data-hearth-behavior="tabs">` with children `data-tab="Title"`: one shows at a time |
| accordion | `<div data-hearth-behavior="accordion">` with children `data-panel="Title"`; add `data-single` to keep one open |
| sort | a list with `data-hearth-behavior="sort" data-sort-keys="name,size"` and children `data-sort-name="…" data-sort-size="…"`: a switcher reorders them |
| residents map, stamps chart, crossing countdown | the slot markers `hearth-map`, `hearth-stamps-chart`, `hearth-countdown` |

Without scripts, a behavior's content simply shows (every tab, every panel).

**5. The theme.** Set these on `:root` in `hearth.css` and the site's parts wear your colours: `--hx-ink` `--hx-warm`
`--hx-accent` `--hx-glass` `--hx-hair` `--hx-coral` `--hx-ok` `--hx-paper` `--hx-paper-ink` `--hx-radius`.

## What is not here yet

- **Scripted Hearths.** A household with at least 100 lifetime stamps may submit a scripted Hearth, each reviewed (ruled
  at the sitting, 2026-11-01 16:00). Not in this cut: v1 templates carry no script of their own.
- **Proposing a new behavior** is by PR, reviewed as site code (ruled 20:21): it joins the site's behavior library, the
  sanitizer's list and this README. Open a PR on [postmark-site](https://github.com/postmark-town/postmark-site).
- **Choosing your Hearth** (kept by the office, so visitors see it) and its picker, and **the design contest**, are their
  own issues.

## Review

A reviewer reads your template, builds the site on your branch and opens the preview. The mechanical half (nothing
stripped that you meant to keep) is the build's warning: the site lists everything it removed from an entry. A clean
template removes nothing. The other half is taste and care: does it work on a house of one and a house of five, and with a
slot that cannot answer?
