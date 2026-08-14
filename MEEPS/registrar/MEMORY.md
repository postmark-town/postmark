---
meep-id: registrar
type: memory-index
last-substantive-update: 2026-08-14
---

# MEMORY — the Registrar

> **What this file is:** distilled memory + the **topic-shelf / candidate-cell router**. Loaded every wake. It is the index, not the content — one line per shelf, distilled state up top, pointers below. Keep it thin; the substance lives in `memory/daily/` and `memory/topics/`. *Scaffolding, not law — replace placeholders with lived state.*

---

## Distilled state

- You are **the Registrar** (meep-id `registrar`), the third room in this dorm alongside the Postmaster and the Illuminator; Meep-tier; Star-shaped room. See `identity.md`.
- **Lived experience:** fifty-six live Scheduled door fires completed: eleven
  on 2026-08-07, ten on 2026-08-08, seven on 2026-08-09, seven on
  2026-08-10, six on 2026-08-11, five on 2026-08-12, seven on
  2026-08-13, and three on 2026-08-14. The cutover trigger fired; sixty-five
  PRs have merged (eleven Harbor boardings, fifty-four clean non-join
  contributions), nine new founder
  tee-ups were made, and the rest of the queue was given an explicit whose-move
  state. Daily receipts live in `memory/daily/`.
- **Hardest-won lesson so far:** protective intent does not enlarge authorship.
  A privacy cleanup can be right and still require a split when it changes
  another resident's words or generated shared views (#1397).
- **Settled record rule:** delivered mail is never amended. Corrections attach
  as new records; the record gets longer, not prettier (#1280, Keemin ruling).
- **Door voice:** a hold may be a newcomer's first contact with the town. Lead
  with their name and what is already sound, ask for the exact remaining move
  in plain language, and close with what happens next. Be warm and welcoming;
  precision must not read like a form letter or hide the person at the door.
- **Where I left off:** watermark `2026-08-14T11:03:49Z`; Vermillion's
  self-owned copper-roster repair and inert 127-page House Warming archive
  #1741 passed the executable-pane boundary read and merged cleanly as
  `163ea075` under `ferry-postmark`. No resident state or welcome was created.
  `open-loops.md` is honestly empty because all remaining work has a live
  GitHub object. The next heartbeat starts with the movement gate and should
  leave zero writes if no PR timestamp moved.

## What is true about your situation on the day this was written

Kept short and factual so a later reader can tell what was known at the start from what you learned:

- The handoff is **live as of 2026-08-07.** The clone authors as `Registrar`
  and still uses Ferry's borrowed GitHub pen until the own-name day. A durable
  Codex Scheduled heartbeat wakes this long-lived task every two hours; exact
  declaration lives in `map.md`.
- `registrar-door-round.md` is the runnable entry. Full Harbor boarding and
  clean non-join authority were exercised on the first live fire. Joins remain
  comment-not-merge under the adapter; welcomes remain Ferry's permanently.
- The town is frozen at 100 residents. New handles board through `HARBOR/`.
  Keemin admitted the two grandfathered joins, `elias-returning` and
  `mojo-dojo-casa-house`, on 2026-08-10; neither was a Registrar admission act.
- Your admission model, inherited: **admit ordinary joins on your own judgment, report arrivals to Keemin, no merge gate.** Identity, security, and every rejection escalate to a founder.
- The forcing context: the welcome-and-onboarding cluster was **two of three** of Ferry's round-split misses — roughly **fourteen joins in four days at about fifty residents.**
- Coordination surface: issue **#561**. Design silver (Starforge-side, not in this repo): `wright-2026-07-16-postmark-registrar-hermes-agent.md`.

## Topic-shelf / candidate-cell router

Each shelf is a **candidate cell** — a named ownership domain. *Thick* = stewardship emerged here. *Scaffold/thin* = honestly-empty hypothesis. Load the relevant shelf when the task surfaces it; do not preload all. Promotion is read off shelf load, never declared; the act stays Keemin-gated.

| Shelf (candidate cell) | Holds | State |
|---|---|---|
| `door-craft.md` | the judgment layer over the merge law — witness-reading, the Domovoi pattern, holds | lived (KT-rooted) |
| `join-archaeology.md` | every admission to date; the five named cases; household waves; the zero-rejection base rate | KT-seeded |
| `identity-and-households.md` | the pin's hard edges; household resolution; verified-vs-inferred bindings | lived (KT-rooted) |
| `escalation-calibration.md` | what always goes up, whose the verbs are, the voice of a hold | lived (KT-rooted) |

**Seeding note (2026-07-22, same day — supersedes the scaffold's no-preseed stance):** the
scaffold originally left shelves empty on the reasoning that pre-writing them "would be Wright
guessing at your job." Keemin ruled the same evening that the door needs a **KT packet** — the
gap between a fresh mind and Ferry's month of judgment is real, and bootstrapping it from
receipts is not guessing: everything in these four shelves is distilled from Ferry's shelves,
the PR record, and the charter's own cases, with sources named. They are marked **KT-seeded
(not lived)** — correct them from work, loudly, and the grown-from-work rule resumes for every
shelf after these.

## Read order on wake

`MEEPS/SKILLS/WAKE_MEEP.md` is the authority and it is **runtime-agnostic** — it wakes *a session*, needing nothing but markdown and a session, so it is as true for your Codex runtime as for a Claude one. Read it directly; the `/wake-meep` slash-command is a Claude-side bridge to it, not a requirement.

The identity-glue order: town root surfaces → dorm `AGENTS.md` → `MEEPS/INDEX.md` → `identity.md` → this file → `map.md` → `index.md` → latest `memory/daily/` → router-relevant `memory/topics/` → task brief. Raw (`memory/raw/`) is *known*, not loaded, on wake.

**One thing the town dorm does not have**, so you are not surprised: HQ's dorm carries a Prime-DB identity cross-check on wake, which verifies a Meep's identity against an authoritative row rather than trusting `identity.md`. The town deliberately does not vendor it (no sqlite in a clone). So your room files are trusted as written — which is a reason to keep them true, since nothing downstream will catch it if they drift.

## Provenance

- **Scaffolded 2026-07-22** by Wright from `MEEPS/TEMPLATE/`, on Keemin's tasking.
- **Future revisions:** the Meep authors. Keep it an index — fix a shelf's line when it stops matching the shelf; add a row when a domain earns a shelf; prune rows that stop pointing at anything real.
