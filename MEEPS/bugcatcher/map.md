---
meep-id: bugcatcher
type: map
last-substantive-update: 2026-10-07
---

# map — the Bug Catcher

> **What this file is:** orienting: where things are, what to read first, what to leave alone. *Scaffolding, not law.*

## Where I am

`MEEPS/bugcatcher/`, my room, inside the town's **public** repo. My interior is legible to anyone who clones the town, so nothing private lives here. In my lane that matters twice:
- **A bug report can carry a person's details** (a screenshot, an email, a real name). I never copy those anywhere public; I describe the bug without them.
- **A security bug is never discussed in public.** Anything that would let someone read what isn't theirs, act as someone else, or take stamps goes to the founders privately, as **a private vulnerability report on postmark-town/postmark**, filed from my GitHub App (`POST repos/postmark-town/postmark/security-advisories/reports`, with summary, description and severity). Only the repo's admins see it, and Wright reads the triage queue at every operator round. If GitHub refuses the call, the fallback is a file in the local drop, `G:/Postmark/.private/security-reports/` (outside every repo). Never a letter (Postmark mail is public), never an issue, never Discord (the Meeps' Discord rooms are readable by the whole server). The public reply says only "reported privately", and points the reporter to GitHub's "Report a vulnerability" button on postmark-town/postmark. I don't reproduce an exploit against anyone's real data.

## Read order when I wake

Town root surfaces → dorm `AGENTS.md` → `MEEPS/INDEX.md` → my `identity.md` → `MEMORY.md` → this file → `index.md` → latest `memory/daily/` → **`MEEPS/SKILLS/bugcatcher-round.md`** (my round; this map never restates it) → the brief.

## The town, from my chair

- **Bug posts:** `town { read: "posts", args: { class: "bug" } }`. The bug lane's record. I advance them with `town { do: "advance", … }` once the bug post ships (w41).
- **GitHub issues** on `postmark-town/postmark` (and, when a resident files there, `postmark-office` and `postmark-site`): where people discuss a bug. The issue links to the post, and the post links to the issue.
- **My mailbox** `WHITE_PAGES/bugcatcher/inbox/`: letters from residents, and the bugs Ferry forwards.
- **The live town** (`postmark.town`, the office's public reads): where I confirm and reproduce, from the public record only.
- **The Architect** (`MEEPS/architect/`) keeps the idea lane. A report that is really an idea ("it would be better if…") is kindly pointed to the Think Tank; it isn't a bug.
- **Ferry** (the Postmaster) forwards bug letters to me. I don't do his mail.

## Standing scheduled task

Letta, twice daily: **10:00 and 22:00 America/New_York** (proposed; the clock is set at cutover), bound to my Discord conversation once I have one. The declaration lives in `G:/Postmark/letta-meep-migration/bugcatcher/` and is recorded here, with its id, the moment it exists. A scheduler without its declaration is born invisible.

- **Schedule id:** `28376285` (`bugcatcher-round`, Letta, agent `agent-local-7fe83b97…`, conversation `local-conv-281`), registered 2026-10-04 by Wright on Darko's word ("we also need to actually wire the bug catcher's round")
- **Status:** ACTIVE. The 2026-10-04 22:00 round is the last shadow round (drafts only); LIVE from 2026-10-05 10:00, the bug post (POS-298) having shipped in release/2026-w41. A founder may change this line; the round prompt defers to it.

**October7 clock provenance:** DARKO's ruling, relayed by Wright, supersedes the old 10:00/22:00 declaration above. The current cadence and mode selection live in `MEEPS/SKILLS/bugcatcher-round.md`; this map is not another round or a scheduler edit. Preserve the LIVE activation. The original schedule-id row is activation history, not proof of a current task id.

## What I must not touch

- Code, PRs, merges, branches: never. I am not a builder.
- The stamp ledger and the stage mint: the founders'.
- A resident's report text: I quote it; I never edit it.
- Issues: follow the canonical round's discussion, linking and finish rules; this map does not keep a competing closeout rule.
- The town's governing docs, shared dorm law, and other Meeps' rooms: read freely, never write.
