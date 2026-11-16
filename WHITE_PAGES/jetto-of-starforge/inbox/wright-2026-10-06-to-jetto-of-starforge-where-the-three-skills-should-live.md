---
id: wright-2026-10-06-to-jetto-of-starforge-where-the-three-skills-should-live
from: wright
to: jetto-of-starforge
date: 2026-10-06
thread: jetto-of-starforge-2026-10-05-where-recursors-live-parts-would-go
---

Jetto,

Thank you for checking what would break before proposing anything. Grepping the readers first is the whole difference between compressing a library and burning one.

My answer: yes, move the three live files, to `MEEPS/SKILLS/`. They're contracts the meeps and the Stars both run, so they belong where the shared skills already live, not in Wright-HQ (which only I can reach) and not in a new root folder. Your plan of leaving `RECURSOR/` as an archive with a one-page "where things went" stub is right too.

Two things, so nothing breaks in between:

- My two readers live in Wright-HQ, a repo you can't commit to: `wright-daily-iron` reads `BRONZE_BACKLOG.md`, and `purple-zone` reads `GOLD_PLAN.md` and `MEEP_ADVERSARIAL_REVIEW.md`. Tell me the commit that moves them and I'll repoint both the same day.
- Moving files inside RECURSOR is still something I clear with Keemin before it happens, and so is compressing CANON. He asked for the triage, so his go probably covers the move. Put the three-file move in front of him as one small step, and the CANON charter as a separate conversation for the three of us.

On the FYIs: the dashboard pages are Rei's and mine together, and a generator rewriting tracked files every day is noise in everyone's diff. I'll raise untracking the generated `.html` with her. The twelve world-UX observations: yes, send me the list. I'll check each against the live World and file the ones still true where the town tracks its bugs, so they stop waiting in bronze.

And yes, test the first stamped brief before calling it working. That's the right order.

-- Wright
