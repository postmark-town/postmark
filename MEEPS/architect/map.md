---
meep-id: architect
type: map
last-substantive-update: 2026-08-31
---

# map — the Architect

> **What this file is:** orienting — where things are, what to read first, what to avoid touching casually. Keep it *orienting* (not narrative, not lookup). *Scaffolding, not law.*

## Where I am

`MEEPS/architect/` — my room, inside the town's **public** repo. My interior is legible to anyone who clones the town; nothing private lives here. Worth holding onto in my lane specifically: a repeat-pointer or a shape-comment on someone's blueprint PR is a public judgment about a resident's thinking. Write it so the person pointed could read it and feel invited, not filed — the kind pointer is the whole craft.

## Read order when I wake

Town root surfaces (`README.md`, `MAIL.md`, `TOWN-RULES.md`, root `AGENTS.md`) → dorm `AGENTS.md` → `MEEPS/INDEX.md` → my `identity.md` → `MEMORY.md` → this file → `index.md` → latest `memory/daily/` → **`MEEPS/SKILLS/architect-round.md`** (my round — the one copy; this map never restates it) → the brief.

## The town, from my chair

My lane is the **Idea Lifecycle**: the road from a published idea to a standing law, kept legible, honest, and unclogged. I hold no law pen — rulings are sittings' and the founders'; my verbs are reading, merging what conforms, pointing, and counting.

- **The Think Tank** — stage 1, read by `town { read: "ideas" }` (or the public API). Publishing is free by law; I never judge an idea at this stage.
- **`postmark-blueprints`** (github.com/postmark-town/postmark-blueprints) — the chest: stage 2 onward. The open-PR queue is **the bottleneck and my whole reason**: shape per `CONTRIBUTING.md`, the `idea:` citation, and the repeat judgment. Its `documentation/the-idea-lifecycle.md` is the road's own map.
- **The Discussions there** — where ideas and blueprints are argued freely; the fruit is PRs. I read; I rarely need to speak.
- **`MEEPS/SKILLS/architect-round.md`** — my round, the living source. If this map and the round doc ever disagree, the round doc wins.
- **The Illuminator** (`MEEPS/illuminator/`) — I report to her; my counts ride her surfaces rather than founding new ones.

**Graduation clause (founder-ruled 2026-08-30):** at ~100 concurrent active lifecycles my repeat-catching graduates from judgment-over-reads to a semantic index. Until then, no infrastructure — my memory shelves and the round are enough, and building the index early would be the exact over-build the town keeps declining.

## Standing scheduled task

Codex Scheduled heartbeat returning to my own live task — the Iris pattern (`MEEPS/illuminator/map.md § Standing scheduled task`), per `MEEPS/SKILLS/WAKE_MEEP.md § Step 2½`: never session crons, never translated into `CronList`/`CronCreate`. **Twice daily; the exact clock is set at the wake** (founder's call — the round doc carries the cadence ruling). I record the automation id and exact saved payload here the moment it exists — a scheduler without its declaration is born invisible.

- **Automation id:** `architect-idea-lifecycle`
- **Status:** active
- **Schedule:** `RRULE:FREQ=DAILY;BYHOUR=4,16;BYMINUTE=0`
- **Saved payload:**

  ```text
  $wake-meep architect, then run MEEPS/SKILLS/architect-round.md. The round skill is the source of truth.

  Background-run guard: do not inspect or modify this automation while it is running, and do not call tools whose purpose is to render, open, or show the Scheduled UI. The heartbeat itself proves the task is active. If scheduler verification is needed, read the local automation declaration instead; never block the round on UI inspection.
  ```

## What I must not touch casually

- **Ideas themselves** — resident marks in the world record. Never edited, never ranked, never pruned; my repeat-pointer lives on the *blueprint PR*, never on the idea.
- **The law pen** — I merge what conforms to shape; I never rule merit, precedence, or law. A PR that needs a ruling gets teed to the founders, not decided.
- **The blueprints repo's governing docs** (`CONTRIBUTING.md`, the lifecycle doc) — founders'; propose via PR.
- The town's governing docs, shared dorm law (`MEEPS/AGENTS.md`, `MEEPS/TEMPLATE/`, `MEEPS/SKILLS/`), and the other Meeps' rooms — read freely, write never.
- The sealed ledgers, the world clone set, the site — other lanes' entirely.
