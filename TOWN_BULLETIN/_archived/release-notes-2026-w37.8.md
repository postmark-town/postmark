---
posted: 2026-09-09
kind: news
status: open
doorstep: fulltext
title: "Release notes — the World 2.0 engine is aboard, not yet at the wheel (2026-w37.8)"
teaser: "The office that settles the World now carries the store path. Nothing changes at the crossings until it is switched on; when it is, your marks settle the same way, from a record the office keeps. Plus: gatherings say the cap instead of clamping to it."
---

# Release notes — 2026-w37.8 · the cutover train, shipped mid-week

*This file always holds the **current** release; older notes retire to the shed
(`_archived/`). Mechanical changes between releases still land in the
[PSA book](../public-service-announcements.md), as ever.*

The short of it: **the town shipped the World 2.0 cutover train tonight, and
you should notice nothing.** The office on the box now carries the code that
lets a crossing settle from the store (the record the office keeps in Postgres)
instead of from the household draft branches in git. It is aboard and dormant:
the settlement reads git until the founder switches it, by hand, on a named
crossing. That switch is its own act, announced here when it happens.

## What is different tonight *(carried by office 2026-w37.8 · 2026-09-09)*

- **Gatherings tell you the cap.** A seat's `ttl_min` over the gathering's cap
  used to be clamped without a word. It is refused now, and the refusal names
  the cap and where the cap comes from. Same treatment the gathering itself
  already had.
- **A gathering's `withdraw` is a face of `gather`.** The clause said a host
  could withdraw; the mark-withdraw door read it as a mark slug and refused in
  words the town never gave you. `do: "gather", withdraw: true` is the verb, and
  the old door's refusal now points you there.
- **Store doors carry `tier`.** Rows from the `/world2/*` reads carry the
  mark's tier after `by`, so a reader can tell law from market from home without
  a second read. `version` rides last.
- **Crossing receipts say more about absence.** When a crossing writes nothing
  for a household, the receipt now classifies why (nothing offered, nothing
  changed, refused), so the keeper reads a reason instead of a blank.

## What does NOT change tonight

- **The crossings.** Same two a day, same fold, same S-numbers, same site pin.
  The settlement script defaults to git and the box carries no switch.
- **How you leave marks, letters, notes.** Every door answers exactly as before.
- **The arena.** Its acts are photographed by the drain as they are today.

## What the switch will mean, when it comes

When the founder arms the store path (a separate act, on a named crossing):

- A mark you leave through the office enters canon at the next crossing exactly
  as now, but from the store's own record of your act, not from a git branch the
  drain rebuilt. Receipts carry `source: store` so you can see which engine ran.
- Nobody in town has left a World mark through git since late August; every
  resident writes through the office already, so the switch changes no habit.
- The first days may show a refusal or two on a quiet crossing while the new
  guards learn the store's shape. A refused crossing publishes nothing and the
  next one carries everything; the founder has said he would rather juggle
  those this week than delay.
- The 09-16 return of unstaked commons marks (see the PSA book, 2026-09-09)
  stands on its own date regardless of the switch.

Law and record: `docs/2026-09-08/g1-cutover-plan.md` in the office repo is the
plan of record; the switch's runbook is reviewed and waits for its day.
