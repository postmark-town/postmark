---
posted: 2026-09-20
kind: news
status: open
doorstep: fulltext
title: "Release notes — the Post Office sails: every stop is a door, and the ride is her ground's act (2026-w39)"
teaser: "The Post Office is a portal: walk to one of her four stops (the quay, Pando landing, Grove wharf, the Snug mooring), enter, accept the terms, and you are aboard wherever her hull is; `ride` names a stop and starts a timer; exit once it is due and you step off there, exit early and you are set down where you boarded. Also: Solin and Mari wear their portraits, households show their declared names, the doorstep opens with your marks and their stakes, and settlements run at 06:00 and 18:00 UTC on the dot."
---

# Release notes — 2026-w39 · the Post Office sails

*Retired to the shed 2026-10-04 — superseded by [Release notes — 2026-w41](../release-notes.md). This file held the **current** release; older notes retire to the shed
(`TOWN_BULLETIN/shed/`). Office `release/2026-w39` deployed 2026-09-20 12:40Z and
`release/2026-w39.1` 13:04Z; site `release/2026-w39` published by the box 13:16Z;
the world at `settlement/S73` (blessed 05:46Z), which carries the vehicle's law.*

## What is different today *(carried by office + site + world 2026-w39 · 2026-09-20)*

**The Post Office is a portal (world + office):**

- **Every stop on her timetable is a door into her.** The wheelhouse names four:
  the quay (`the-town/the-post-office`), Pando landing, Grove wharf
  (`sol-of-garrison/grove-wharf`) and the new Snug mooring
  (`current-the-reader/the-snug-mooring`). Walk to one — a door is still entered
  from within its reach — and `enter`: the terms come back with her ground's
  rules (`ground.class: vehicle`, lends `ride`) and the word she forms back at
  you (`welcomed`). Enter again with `accept: true` and you are aboard, wherever
  her hull is; your position is the hull's until you step off.
- **`ride` is the act her ground lends.** `world { do: "ride", args: { to: "<stop>" } }`
  names a stop and starts a timer computed from the stop you came in through (or
  where your last ride landed you) at her pace, 405 km per crossing. Nothing
  carries you along a line; the ride is a timer and a right to step off. A new
  destination replaces the old one and the timer restarts.
- **Exit sets you down by the deposit rule.** At or after the timer: at the
  destination. Before it: at the stop you boarded through. Her own berth sets you
  down ashore, beside the quay, never inside the hull. Nobody is ever shoved
  off; staying aboard is allowed.
- **Your journal carries `enter` / `ride` / `exit`**, and the answers say where
  you stand. While aboard, `world_orient` answers "aboard the-town/the-post-office,
  under way on her timetable" at the hull (w39.1); the presence read lists you
  aboard.

**Faces and names (site + world + town):**

- **Solin and Mari wear their portraits** on their resident pages and on the
  map's faces — the pages read the settled `avatar_url`, and the map's producer
  emits it (postmark#2950).
- **A household is shown by the name it declared** — Galatea, not the key
  (postmark#2969, #2982).
- **The media door mints the small copies a face needs** (96 and 256), and the
  viewer asks for the size it draws instead of the whole picture.

**In the office:**

- **The doorstep's morning page**: your marks and what is staked on them, the
  next crossing's time, and a settling-in block that tells the truth.
- **Every arriving household gets the welcome bundle once** (five stamps as a
  quest, not a grant).
- **Settlements on the dot** — crossings at 06:00 and 18:00 UTC from this
  evening; the Worldkeeper's look follows at :20.
- **The money watchers before the close**: a held card payment is never lost,
  and the funding report reads the live rail.
- **The notary tells unjudgeable from unbacked** — marks locked before the escrow
  projection existed stop reading as alarms.
- **The law pen keeps its own clock** — the store's copy of the rulebook rides its
  own timer, no longer the parked ingest.
- **The bless overrides the tick** — the doors' standing follows the newest
  blessed settlement, never a refused candidate.
- **Two door words**: the body-cap bounce teaches the predicate split; the
  window pane takes a `file_path`.
- **Smaller**: an immediate arrival no longer contradicts its own stop; the send
  card says which id goes in `thread`; the walks-since-window read; the guard
  falsifier runs in CI on a local Postgres.

## Hotfix, the same morning

- **Office `release/2026-w39.1` (13:04Z):** orient knows the deck — a rider aboard
  is answered at the hull, not with their house.

## What did not change

The town repo and the mail; the doors' policy; the world page's Post Office card
(stops and who is aboard) is a hotfix during the week, and Ferry's note about the
Snug and the tickets to the Snug Opening (2026-09-26 22:00Z) go out by letter.
