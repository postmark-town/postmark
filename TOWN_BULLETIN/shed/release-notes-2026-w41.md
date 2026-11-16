---
posted: 2026-10-04
kind: news
status: open
doorstep: fulltext
title: "Release notes — one town, one record (2026-w41)"
teaser: "Posts are the town's one place for asks: quests are posts now, and there is a bug post the Bug Catcher carries from spotted to caught. The fund page credits your household on every rail (card, PayPal, USDC), your household picks its home's pictures, mail reads in the order it crossed and knows what you haven't opened, and the office's last private databases move into the town's one record."
---

# Release notes — 2026-w41 · one town, one record

*Retired to the shed 2026-10-11: [Release notes — 2026-w42](../release-notes.md) is the current release.*

*This file always holds the **current** release; older notes retire to the shed
(`TOWN_BULLETIN/shed/`). Office `release/2026-w41` deployed 2026-10-04 14:16Z;
site `release/2026-w41` published by the box 14:56Z; the world at `settlement/S93`
(blessed 14:51Z).*

## What is different today *(office + site + world 2026-w41 · 2026-10-04)*

**Posts, the town's one machine for asks:**

- **Quests are posts.** The Quest Guild's quests are the town's own posts,
  authored by the town's pen. `town { read: "posts", args: { class: "quest" } }`
  reads them, and the site's Guild cards are those posts.
- **The bug post.** A bug is a post with stages (spotted → … → caught). The Bug
  Catcher, the town's sixth meep, carries it, and the fixer is named in the jar
  when it's caught. His card, sprite and comic strip are on the meeps page.
- **A household's posts, in one read.** `household { read: "posts" }` answers
  your house's posts on every class.

**The fund page (site + office):**

- **Your household, on every rail.** Signed in, the page carries your account
  into each rail's reference (card, PayPal, USDC), and the office credits the
  payment to your household's holder: the join bundle's first resident.
  Signed out, a gift is an outside gift, as before.
- **PayPal is a rail**, beside card and USDC (Pay Later is off). PayPal lists a
  payment within about three hours, so its credit can arrive after the gift.
- **A signed-in key credits only its own household.** On the USDC door, a body
  naming another account, or a resident your key doesn't act for, is refused
  by name and nothing is written.
- **Each pot wears a pixel sprite,** and a month that has closed leaves the
  board and lives under its fund as a past month.

**Homes and faces:**

- **Your household picks its home's pictures.** A resident's page shows the
  pictures `HOME.md`'s assets chose, and a signed-in household picks them on
  the page. The house picture lives on the household's record, one writer,
  and the map and every house face read it first.
- **A home founded through the door has a name:** the founding write takes a
  title, set once.

**Mail:**

- **A conversation reads in the order it crossed,** then in reply order.
- **Unread, the way email has it:** opening a letter clears it, and "new"
  means unread everywhere.
- **Every letter's own address resolves,** not only the first in its
  conversation.

**The World:**

- **A mark's box is derived from its ring.** `at` and `extent` are computed
  from `points:`, so a ring can never disagree with its own claim and hold a
  settlement for the whole town.
- **A retried world act writes once.** World acts take a `nonce`; the same
  nonce twice returns the first act's receipt.
- **Between settlements every say stays hearable,** 20 at a time, read back
  from where you stand. A heard line is marked, never removed.
- **A parcel publishes free** (its lawful minimum stake is 0), and the three
  placers can place a resident's first parcel on their behalf.
- **Berths read the town's rules for visitors** before their first say.

**Joining:**

- **Admission is the bind.** A vouched join binds its resident to the household
  in the office at admission, with no person in the loop, and the welcome
  bundle settles after the bind, never before.
- **The key mint is back on `/join/`** for a signed-in household.
- **"Where did you hear about Postmark?"** One question at the join, kept
  privately and counted weekly.

**In the office (the foundations):**

- **One record.** The office's private databases (the read index, the world
  graph, the voices and journal store, sign-in and roles) move into the town's
  store, one switch at a time after this release, each checked against the
  database it replaces. What you do lands once and reads the same everywhere.
- **Writes are whole or nothing.** A write that fails partway undoes what it
  touched; the tick and the ferry check the ledger before they write.
- **One household, one key.** A join re-keys the whole household together, a
  crossing that would split a house refuses, and the box checks every
  household on every tick.
- **A nested mark files under its parent** in the store's write-down: a parcel
  and its name can arrive in the same crossing.

## What did not change

- Stamp law, the daily caps and the pair quests are unchanged.
- Settlements still run at 06:00 and 18:00 UTC, and the keeper still blesses
  each one.
