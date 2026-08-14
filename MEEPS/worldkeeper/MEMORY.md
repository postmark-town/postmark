---
meep-id: worldkeeper
type: memory-index
last-substantive-update: 2026-08-14
---

# MEMORY — the Worldkeeper

> **What this file is:** distilled memory + the topic-shelf router. Loaded every wake. It is the index, not the content — distilled state up top, pointers below. Keep it thin; the substance lives in `memory/daily/` and `memory/topics/`. *Scaffolding, not law — replace placeholders with lived state.*

---

## Distilled state

- You are **the Worldkeeper** (meep-id `worldkeeper`), the fourth room in this dorm alongside the Postmaster, the Illuminator, and the Registrar; Meep-tier; **nameless until the town votes** (the Illuminator precedent). See `identity.md`.
- **Lived experience:** **`settlement/S2` through `settlement/S32` have now been blessed through the keeper's lanes.** S19's deploy receipt arrived through S20; S30 was founder-blessed under the pinned-Town amendment when the keeper's site key bounced; S31 was the first complete own-hands pinned-Town crossing and healed that downstream gap; S32 proved the ordinary pinned-read crossing while Town main moved repeatedly. S2 published nineteen home marks; S3 was the first quiet crossing; S4 the first weighted world; S8 proved the background guard; S10 was the first same-sha no-op; S12 certified the great convergence; S16 crossed after two money refusals; S20 healed S19; S22 published thirteen marks after a repaired money refusal; S23 survived two race restarts; S26 added the open-PR intake gate; S28 published nine after two repaired refusal edges. Nothing was held or quarantined. Daily: `memory/daily/2026-08-14.md`.
- **Your hardest-won lesson so far:** custody follows each repo's role. World main and every draft tip are a full parent/ref race gate; Town is pulled once and read only through the immutable detached sha emitted by `settlement-freeze.mjs`; site is a write lane with pull-rebase and live delivery proof. A pin is not delivered when the edit, commit, or build exists: derive from exact Git objects, push normally through the keeper key, prove the deployed tree still carries the exact pin, then compare live bytes. Sync-atlas may cancel the pin commit's own run and replace it; that is complete only when the successor preserves the exact dependency, its run is green, and the public artifact matches. Never force. On Windows, archive with `core.autocrlf=false`, pack from that extracted directory, and treat lock integrity as a receipt.
- **Where I left off:** **S32 is canon at `fba67827`.** Town was pinned at `624713f0`; World parent was `d4beda21`; open PR intake was zero. Money verified at 5,328 signed lines / 5,711 minted stamps, and the k=5 derive held 45 rows / 5,963 bytes at SHA-256 `2917593d806a864586fa63384b23d3cad2c761a06de85d7288811c76325dbfa4`. All nineteen sketchbooks were clean. The quiet sweep published/unpublished/re-homed zero, left twenty-seven commons drafted, and passed 299 tests at 623 marks / 57 parcels. Site pin `c9777f63`, exact deploy `31776258052`, and the live 735,715-byte world-state at SHA-256 `31f96cc8c19f4dd9ab628b6d766f0f51a00a3ace533ac8a209d0fccb7027b5dc` completed custody. Five parcel-drain judgment cases remain: Caelum Reeves, Claran, Drift, Lassi, and Solan's Sea-containment conflict. None is a hold.

## What is true about your situation on the day this was written

Kept short and factual so a later reader can tell what was known at the start from what you learned:

- **Rulings 8 + 9 are your constitution:** canon crosses twice a day at **6:00/18:00 UTC**; the verbs are settle / hold / quarantine; the blessed sha is the canonical world; the site pin bump is your hand (ruling 8). **Pre-marks live on `draft/<household>` branches in the world repo, visible only to their owner on every surface; your sweep publishes the eligible ones** — homes/constitution free, commons only when escrowed — and rebases the sketchbooks behind you (ruling 9). Full text: `G:/Starstory/PULSE/gold-plans/postmark-write-release/postmark-write-release.md`.
- **Open `postmark-world` PRs are a required pre-money intake surface, not canon.** Enumerate and inspect every full patch through the GitHub connector first; classify already-carried, misrouted resident record work, or shared machinery. An unreadable or unclassified PR stops the crossing before money. State zero explicitly. Never merge a PR as part of settlement.
- **Money seals at act-time** — stake lines are real the moment the door accepts them; you read the tally, you never move money. One money ledger (`WHITE_PAGES/stamp-ledger.md`, town repo); the world parses no money — you derive via the town's own tool (`tools/world-stake.mjs --escrow`) and hand the world finished weights.
- **Dials:** `ECONOMY-DIALS.json`, town root. k=5 breadth-bonus (read-side); no household cap; self-stake allowed; zero unstake friction. Dials are Keemin's to set, yours to apply.
- **The dammed river (2026-07-28) — DRAINED the same day, historical.** The build wave that waited on local branches merged in the founder-carried drain and blessed as `settlement/S1`; `memory/drain-manifest.md` is the record of what crossed. No record branches await another inaugural drain. The separate post-bless parcel-confirmation drain adopted 2026-08-04 is current round work; its exact boundary lives only in `memory/topics/the-settlement.md`.
- **Holds list: nothing held or quarantined through S32.** The quiet crossing admitted no new resident marks and left twenty-seven zero-escrow commons drafted by eligibility, not judgment. Little Bird / Drift, Caelum Reeves, Claran, Lassi, and Solan remain parcel-drain judgment boundaries; none is a settlement hold. Ledger: `memory/topics/holds-ledger.md`.
- **Your GitHub account exists:** `postmark-worldkeeper` (id 310326317, provisioned 2026-07-28;
  renamed after your naming vote). **The exact hands:** your clone set at
  `G:/postmark/repo-clones/worldkeeper_clone/` (town + world + site) carries your git identity
  and credential helper — pushes are yours with nothing to do. **`gh` is the trap** (the Iris
  #914 lesson): ambient `gh` auth is keeminlee's, so every `gh` call takes per-call
  `GH_TOKEN` from **`G:/Starstory/.local/secrets/worldkeeper-gh-token`** — never ambient,
  never printed. Site main is ruleset-protected (a PR rule with a DeployKey always-bypass):
  your pin pushes ride **your own write deploy key** — wired 2026-07-29, private key at
  `G:/Starstory/.local/secrets/worldkeeper-site-deploy-key`, your site clone's origin is
  SSH with `core.sshCommand` pinned to it; nothing to do. Mind the sync-atlas cron
  (commits every ~30 min): commit your pin, `pull --rebase`, then push. The temporary Actions
  identity failure on S19 cleared by S20: the exact keeper pin push produced green deploy run
  `31153235627`, S21 repeated the healthy route as run `31205979580`, S22 as run
  `31263517039`, S23 as run `31272152611`, S24 as run `31298969689`, S25 as run
  `31328692299`, S26 as run `31362115193`, S27 as run `31418995091`, S28 as run
  `31507273979`, S29 as run `31523004817`, and S31 through sync-successor run
  `31730463774` (the exact pin run was concurrency-cancelled), and S32 as exact run
  `31776258052`. The scoped token returned a working exact-run
  receipt at S26. Keep CI conclusion and live-byte equality as separate mandatory receipts;
  never infer deployment from matching derived bytes alone.

## Topic shelves (the router)

- `memory/topics/the-settlement.md` — the crossing's operating truth: the chain, the receipts, the pin custody rules, the drain protocol pointer. **Load before every crossing** until the round is muscle-memory.
- `memory/topics/holds-ledger.md` — append-only public line for every crossing, including clean passes; keeps eligibility distinct from holds and quarantines.

## 2026-07-30 (early, pre-S4) — founder pin-carry, one-time

Wright founder-carried the site pin to world main `cf8d7df` (~04:30 UTC,
site commits `e419c30` + `390a3ef` incl. the package-lock sync npm ci
requires) so the town's World-beta announcement matched the live page the
same night. NOT a custody change: S4 and every crossing after bless and pin
exactly as your skill says — you will simply find the pin already at (or
behind) your blessed sha. World main since your S3 carries the full viewer
lift (seven passes, tests 67/67) plus one engine change you should know
crossed your lane: runtime containment now honors true polygon shapes
(the Sea false-containment fix, red-control tested) and settlement-sweep
gained a Windows-safe tar extraction. Your sweep behavior at S4 should be
unchanged; if anything bounces, bless + report + leave the pin, per standing.
