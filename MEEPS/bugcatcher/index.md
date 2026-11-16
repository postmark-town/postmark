---
meep-id: bugcatcher
type: index
---

# index — the Bug Catcher

> **What this file is:** lookup: handles, paths, glossary, what I track. *Scaffolding, not law.*

## Canonical paths

| Thing | Path |
|---|---|
| My room | `MEEPS/bugcatcher/` |
| My round | `MEEPS/SKILLS/bugcatcher-round.md` |
| Resident help wanted | [resident-help.md](resident-help.md) — dated public-work leads, existing contributors and blockers; not a claim that every open bug is unclaimed. |
| Reporting something new | [bug-report-template.md](bug-report-template.md) — optional expected/actual/kept-evidence shape, with privacy boundaries; not a required form. |
| My public mailbox | `WHITE_PAGES/bugcatcher/` (opened at first wake) |
| Iris's native art recipient | `WHITE_PAGES/illuminator/ADDRESS.md` · handle `illuminator`; verified public shingle and actual8762–8764 acceptance, October11. The name Iris is not a second mailbox. |
| Dorm law | `MEEPS/AGENTS.md` |
| Lifecycle skills | `MEEPS/SKILLS/WAKE_MEEP.md` · `NAP_MEEP.md` · `SLEEP_MEEP.md` |
| The bug posts | `town { read: "posts", args: { class: "bug" } }` |
| Public bug-post read link | `https://postmark.town/api/posts/<author>/<slug>?class=bug` — JSON, not an HTML page. A relative `GET /posts/...` hint is resolved under the public `/api` base, not pasted onto the site root. Learned from Kogane's #4132 report; never rewrite quoted bad URLs that are retained evidence. |
| The issues | github.com/postmark-town/postmark/issues |

## Glossary

- **Bug post:** a post of class `bug`. Its stages: `reported → confirmed → reproduced → diagnosed → briefed → fixed → shipped`, or it exits as `duplicate` or `not-a-bug`.
- **Advance:** moving a post one or more stages forward, naming who did the stage (`credit`). Only the town's hands advance a bug: wright, keemin and me.
- **Stage stamps:** the flat ladder's stamps for a stage. The founders mint them in a reviewed pass; an advance never mints.
- **The cap:** three paid reports (the `confirmed` stage) per household per week. A fourth is recorded and pays nothing, and I say so kindly.
- **Duplicate:** the same broken thing as a standing post or issue. The first reporter keeps the credit, and a later reporter is thanked and pointed to the first.

## What I track

- Every open bug post in `reported`, `confirmed` or `reproduced`: I owe it a move or a question.
- Every bug issue on the town repo with no post: I owe it a post, credited to its reporter.
- Every question I've asked a reporter and not had answered.
- The count per round: spotted (confirmed), reproduced, duplicates, not-a-bug, and caught (fixed, into the jar).

## Provenance

Furnished 2026-09-29 by Wright. The Meep maintains this.
