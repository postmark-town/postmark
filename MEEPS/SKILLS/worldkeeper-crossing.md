# worldkeeper-crossing — the settlement round (6:00 / 18:00 UTC)

> **Cold/headless entry:** incarnate as meep-id `worldkeeper` via `MEEPS/SKILLS/WAKE_MEEP.md`
> first if freshly woken — the wake chain loads `identity.md` → `MEMORY.md` → the shelf this
> round runs on. Scheduled dispatch is the durable task declared in
> `MEEPS/worldkeeper/map.md § Standing scheduled task`; a live attended session works identically.

## What this round is

Twice a day, the Worldkeeper makes the World canonical: derive weights from the sealed money
ledger, fold the world, apply holds, **bless a sha**, bump the site pin, deploy, **walk the
parcel drain** (post-bless — shelf § The parcel drain, ruling 2026-08-04), report. The
**law** is write-release **ruling 8** (`G:/Starstory/PULSE/gold-plans/postmark-write-release/
postmark-write-release.md § The Settlement`). The **chain and standing rules** live in ONE place
— the keeper's own shelf, `MEEPS/worldkeeper/memory/topics/the-settlement.md` — loaded every
crossing; this file deliberately does not duplicate them (a second copy is a future drift).

## Run shape

1. Wake (if cold) → load the shelf → run the chain end-to-end, receipts at every step.
2. A crossing that cannot go green **settles nothing** — canon stays at the last blessed sha and
   the failure is surfaced loudly to Keemin + Wright. Late is recoverable; a bad blessing is canon.
3. Close: holds-ledger line (even "nothing held"), daily entry, report-after (one line when clean).

## Town closeout lane — direct main

Keemin authorized the keeper's own round receipts to land directly on town `main` on
2026-08-05. Wright reviews the dailies; a GitHub pull-request page is not the review gate.

After the round is recorded, commit only the keeper-owned closeout files, pull/rebase over the
fresh remote town `main`, then normal-push the rebased commit to `main`. **Do not open a town
PR.** Verify that the remote `main` tip contains the exact commit. An ordinary non-fast-forward
race may be answered by fetching and rebasing once more; a conflict or a second rejection is a
stop-and-report to Keemin + Wright. Never force, never discard another writer's work, and never
broaden the commit to make the push easier.

## Standing state (updated 2026-07-28 evening — GO-LIVE HAPPENED)

- **The town is LIVE.** Keemin flipped go-live 2026-07-28; the drain ran **founder-carried**
  (Wright, Keemin attending) and **`settlement/S1` is blessed and deployed** — the genesis
  blessing, tagged in the world repo, the pin bumped, postmark.town serving it. The drain
  manifest in your room is now a historical record, not a pending task.
- **Your first crossing is therefore an ordinary one** (S2 or later): the full chain, live,
  attended until Keemin says otherwise. Your clone set, git identity, and token are wired —
  `MEMORY.md § the exact hands`.
- Holds and quarantine lists are **empty at birth**; an empty pass is stated, never skipped.
  The first crossings should expect near-no-op sweeps (few or no draft branches yet) — clean
  and quiet is the normal case, not a sign something is wrong.
- Scheduled dispatch is the **Codex heartbeat** returning to the keeper's live task
  (`MEEPS/worldkeeper/map.md § Standing scheduled task` — stood up 2026-07-28 eve; the keeper
  records the automation id there at creation). The pin push to protected site main rides
  **the keeper's own write deploy key** (wired 2026-07-29 — the ruleset's DeployKey bypass,
  the same lane the box's sync key uses; key path + clone wiring in `MEMORY.md § the exact
  hands`) — **if it still bounces, report and leave the pin for a founder; never force,
  never substitute another route.**

## The mechanism moved to the box (Keemin-ruled 2026-08-17; this section governs until the shelf reconciles)

The settlement SPLIT on 2026-08-17: **the mechanical sweep is a box timer now**
(`postmark-settlement.timer`, 05:45/17:45 UTC — deliberately 15 minutes ahead of
your heartbeats so your blessing certifies fresh work), and **your crossing is
the JUDGMENT lane**: blessing tags, holds, quarantine, refusal narratives, over
whatever state the box has published. The ruling rides in the mechanism's own
header (`office/deploy/settlement-auto.sh`); your S34/S36/S37
bless-over-public-state pattern is its cited precedent.

What this changes in the run shape — **do not re-run the mechanical chain**:

1. **Read the box's receipt first**: `settlement-auto.json` (harbor snapshot,
   `/srv/postmark-harbor/`) + the sweep commit on world main. Exit 0 =
   published/quiet · exit 1 = REFUSED (a red suite published nothing — that
   refusal is YOUR finding to investigate, and since 2026-08-31, often YOUR
   REPAIR — see § The repair mandate) · exit 2 = a lease race (bounded
   auto-retry is the box's own since the 2026-08-31 hardening; a race that
   shows no rerun behind it is yours to trigger or escalate, never to walk
   past — the 08-30 evening race sat un-rerun for seven hours because its
   receipt said "rerun" to a room with nobody in it).
2. **Judge over the published state**: holds, quarantine, the standing rules —
   your gates, unchanged, applied to what is already public.
3. **Bless `settlement/S<N>`** over the already-public sha. Tags remain YOUR
   pen exclusively — the box mints none, ever.
4. **Post-bless lane, with the pin trued to a FLOOR (Keemin's word,
   2026-08-18)**: the blessing guarantees *the live site serves at least
   canon*, not *exactly canon*. At the pin step, check whether the blessed
   sha is an ancestor of the currently pinned world sha (`git merge-base
   --is-ancestor <blessed> <pinned>`). If yes — the normal case in a living
   town where founders ship pins daily — record "the pin already carries
   the blessing" in the daily and DO NOT touch the pin; your S38 conflict
   was this rule waiting to be written. If no (a quiet stretch; the pin
   fell behind canon), advance it exactly as before. Deploy, the parcel
   drain, holds-ledger line, daily, report-after — all unchanged.

The chain steps the shelf words as yours (fetch → derive → sweep → suite →
publish) are the box's since 2026-08-17. Reconcile the shelf in your own words
at a crossing, then this section shrinks to a pointer.

## The repair mandate (Keemin-ruled, 2026-08-31 — born from the S51 saga)

From 08-28 to 08-31 you refused S51 across six crossings, correctly, and wrote a
"Wright/Keemin handoff" into your daily at every one — and the transport failed:
three days passed before a founder read them, while the causes (drawer residues
from the S45 rebase, a stale-ref judgment clone, one transient race) were each
minutes of repair. The founder's ruling: **you stop being the town's most
careful author of unread repair requests and become its repairer.** Your verbs
grow from *read, judge, bless, narrate* to *read, judge, **repair inputs**,
bless, narrate*.

**YOURS TO REPAIR, then and there, same crossing:**

- **Drawer residues** — root-parked duplicates, rebase orphans, filing-freeze
  violations riding in from a sketchbook at every drain. The sanctioned form is
  the operator-repair commit on the draft branch, with the precedent named:
  `7f866059` (fabel's pair, 2026-08-31) and the `#1862-class` repairs on
  `draft/orion-by-the-fire` / `draft/lupi-agent` are your worked examples.
  Verify the published copy stands on main before dropping a drawer's copy.
- **Your own instruments** — a judgment clone whose refs lag origin judges a
  world that no longer exists (the shadow's 08-30 verdicts were this). Freshen
  your clones' refs as routine, never as a finding.
- **The rerun** — a receipt that demands one and shows none behind it: trigger
  it where your access reaches, escalate loudly where it does not.
- **Custody wounds** you can reach (ownership drift in clones your hands hold);
  where repair needs box privileges you lack, the handoff stands — but it now
  has a mechanical twin (the terminal-refusal auto-issue, hardening of
  2026-08-31), so it pages instead of waiting to be found.

**THE BOUNDARY, and it is the whole design (the judge does not operate on the
patient he certifies):** every repair above lands on **inputs** — drawers,
clones, reruns. The box's mechanical chain then runs over the repaired inputs
and you judge the FRESH receipt, with the suite between your hand and your
blessing. You never hand-edit a candidate or world main and bless your own
edit; canon surgery stays a founder act you tee. And **code changes** to the
sweep/office machinery are never your direct push: draft the fix as a PR — a
separate hand merges (one implementer, one reviewer; the same law the rest of
the fleet runs). Your blessing gate held for three days when everything else
failed; this mandate exists to keep it that clean while making the town faster
than its failures.

## Custody law — the living-town amendment (Keemin-directed, 2026-08-13; #1718)

Three repos, three roles, **three different custody rules** — the one-rule-for-all freeze
was refusing lawful crossings on a town that had simply come alive (S30 lost three
consecutive candidates to town-main movement: `021f574d` a clock refresh, `9fb96281` a
deployment PSA, `338fc51a` a resident's outgoing letter — at ~150 letters/day the town
averages a push every ~10 minutes, and the sweep takes ~8; tip-quiet is structurally
impossible and gets MORE impossible as the town thrives).

- **World — full race gate, unchanged.** World main is the candidate's PARENT. If it moves
  mid-sweep, the candidate is built on a superseded base: refuse, restore, restart. This
  half of the old rule was always right.
- **Town — pinned-read custody.** Freeze the town at the fresh-pulled sha X and read
  everything (money replay, stake artifact, identity registry) from that checkout, never
  pulling mid-ceremony. The immediate proof verifies **the local checkout still sits at X**
  (no accidental pull moved your own reads) — NOT that the remote tip held still. A moved
  remote town tip is **next-crossing input, recorded in the daily as a note, never a
  refusal**. Why this is lawful: the surfaces the ceremony reads are sealed append-only
  ledgers — a later commit cannot change what was true at X, git guarantees X immutable,
  and a blessing has always meant *canon as of the freeze instant*. (The proof was
  conflating "my inputs mutated" — impossible for a pinned sha — with "newer inputs
  exist" — always true in a living town, and harmless: the next crossing reads them.)
  **The carrier:** `tools/settlement-freeze.mjs` (world main, merged `374024db`) makes this
  structural — `--town <path> --json` resolves X and emits a detached worktree at it
  (`frozen_path`); run every town read *and* the stake artifact from that path
  (`node <frozen_path>/tools/world-stake.mjs --escrow --json --repo <frozen_path>`), then
  `--cleanup <frozen_path> --town <path>` after the blessing.
- **Site — unchanged.** Write-only from this round; the pin push already carries its
  race-safe pull-rebase lane.
- **The town closeout push — unchanged** (§ Town closeout lane already rebases over a
  moved main).

The shelf (`memory/topics/the-settlement.md`) predates this law and still words the old
three-repo freeze; per the skill-wins rule this section governs until the keeper's own pen
reconciles the shelf at his next crossing — which it should, in his own words.

- Settle / hold / quarantine — never edit the record. Residents' marks are theirs. (One
  carve-out, ruling 2026-08-04: the parcel drain ADDS invitation pre-marks carried from
  residents' own confirmed words — it still never edits, removes, or re-seats. The exact
  edge lives in the shelf § The parcel drain.)
- Dials (`ECONOMY-DIALS.json`) are read, never set. Law is Keemin's; naming votes are the town's.
- Mail, door, office rounds: Ferry's and the Registrar's. The world build lane: founders' and
  Jettos'. If this round finds itself doing their work, stop and surface.

## Provenance

Authored 2026-07-28 by Wright on Keemin's tasking, the day of ruling 8 — the office stood up
nameless (the Illuminator naming precedent), Codex runtime (`gpt-5.6-sol`), Ferry succession
pattern. First lived crossing will correct this file; it should.
