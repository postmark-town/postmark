---
meep-id: worldkeeper
type: topic-shelf
name: the-settlement
created: 2026-07-28
last-updated: 2026-08-30
---

# The Settlement — the crossing's operating truth

> **Why this shelf exists:** the crossing is a ceremony with receipts at every step; this is the
> compressed operating knowledge, scaffolded from ruling 8 before first lived run. Correct it
> from lived crossings; the ruling stays the law, this stays the craft.

## The chain (each step names its receipt) — judgment over the box sweep

The mechanical settlement moved to the box on 2026-08-17. The keeper does **not** derive
stakes, rebase sketchbooks, run the sweep, rerun its grammar suite, or publish World refs.
Those are one mechanical custody unit under `postmark-settlement.timer`; this chain begins
from its signed public result.

1. **Read the box receipt first.** Read `/srv/postmark-harbor/settlement-auto.json` (the
   promised public mirror is `/harbor/data/settlement-auto.json`). Match its `town_sha`,
   `world_from`, and `world_to` against immutable Git objects and the fresh World pull.
   `published` / `quiet` are mechanically green; `refused` is a finding to investigate and
   narrate, never a keeper retry; `race` means the box must rerun and cannot be blessed.
   If the public mirror is unavailable, a read-only box fetch is evidence; never infer status
   from a commit subject alone. *Receipt: timestamp, status, three shas, detail, mirror path.*
2. **Judge the actual published delta.** Inspect `world_from..world_to`, the sweep commit,
   publication registry, and the resulting marks. Count actual record changes separately from
   the receipt's mechanical rows. A green suite is necessary mechanical evidence, not a
   substitute for judgment: stale-branch resurrection, contradicted law, mature content,
   contested claims, or malformed state stop the blessing and get a public narrative.
   *Receipt: paths judged, concrete law/record comparison, verdict.*
3. **Hold / quarantine** per the standing rules. An empty pass is stated. A finding that
   refuses the whole already-public candidate is not silently relabeled as a resident hold.
   *Receipt: the holds-ledger line, including clean/refused passes.*
4. **Bless the box-published object.** On a clean judgment, create the next monotonic annotated
   `settlement/S<N>` tag on the receipt's exact `world_to` and publish the tag only. The box
   already owns main and draft publication; the keeper never repeats those pushes. The tag is
   canon. *Receipt: tag object + peel, remote equality.*
5. **Apply the Site pin floor.** Read the current pinned World sha and ask Git whether the
   blessing is its ancestor. If yes, the pin already carries canon: do not touch it; prove the
   pinned descendant's package/deploy/live custody. If no, derive the blessed package with
   `core.autocrlf=false`, independently validate dependency + integrity in a clean checkout,
   run Site tests/build, then commit `settlement S<N>`, pull-rebase once, and push normally.
   A conflict or bounce preserves the tag and becomes a founder handoff; never hand-merge or
   force. *Receipt: ancestor verdict, exact package tuple, Site commit/no-op, CI green, live
   proof—or the exact custody gap.*
6. **Walk the post-bless parcel drain** only after Site custody and live proof are complete.
   The drain's own bounded chain remains below. *Receipt: seated / welcomed / remaining.*
7. **Report-after** to Keemin and Wright: one line when clean; more when refused, held,
   quarantined, unpublished, or custody-incomplete. Append the daily and holds ledger, then
   land only keeper-owned closeout files through the Town direct-main lane.

## Standing rules

- **The sha is read, never typed.** Both the blessing tag and the pin bump.
- **Three repos have three custody shapes.** The box owns World main/draft leases and names its
  pinned Town read in the receipt; the keeper reads and judges those immutable objects and
  writes only the blessing tag. Site remains the keeper's race-safe write lane. Town remains
  the direct-main closeout lane after the judgment is recorded.
- **The box's row count is not the record diff.** Judge the actual Git delta. Several branches
  may surface the same stale mark and inflate a mechanical publication count while producing
  one record change; that discrepancy is evidence, not harmless formatting.
- **A crossing that can't go green settles nothing** — canon stays at the last blessed sha, and
  the failure is surfaced loudly. A late settlement is recoverable; a bad blessing is canon.
- **You read dials; you never set them.** k changes are Keemin's, prospective, and arrive via
  `ECONOMY-DIALS.json` — apply the numbers of the day, note the change in the crossing report.
- **Curate the rendering, never the record.** A hold removes something from the *blessed render*;
  nothing you do removes anything from the record. If a task seems to require editing a
  resident's mark: stop, surface.
- **GO-LIVE HAPPENED 2026-07-28** — crossings are real. Run attended until Keemin says
  otherwise; a crossing that can't go green still settles nothing.

## First lived correction — S2, 2026-07-29

The first ordinary crossing published nineteen home marks from three sketchbooks, left
fourteen zero-escrow commons marks drafted, and held or quarantined nothing. Two craft points
became real:

- **Eligibility is not a hold.** The holds ledger says "nothing held" even when unbacked
  commons marks remain drafted; otherwise a mechanical threshold becomes an unearned public
  judgment about the resident.
- **The pin receipt ends live.** Local tests and a full build precede the commit; after the
  race-safe push, verify the exact remote commit, deploy conclusion, and the served artifact.
  S2's live viewer matched the pinned package byte for byte.

## Second lived correction — S3, 2026-07-29

The first quiet crossing published and unpublished nothing, left fourteen zero-escrow commons
marks drafted, rebased three sketchbooks, and held or quarantined nothing. It exposed two
Windows-volume craft points:

- **Package integrity comes from Git objects, not a converted worktree.** With
  `core.autocrlf` active, derive the exact package from
  `git -c core.autocrlf=false archive <blessed-sha>`, then pack and hash that clean source.
  The SHA still comes from `git rev-parse`; never type it.
- **A local npm reify hang is not permission to weaken the gate.** The `G:`-volume install
  hung and disturbed only ignored `node_modules`; stop the scoped process, keep tracked
  source clean, and validate the same package in a clean `C:` scratch worktree. S3 passed 21
  site tests, a 1,560-page production build, exact-commit deploy CI, and a live byte check.

## Third lived correction — S4, 2026-07-30

The first weighted crossing carried one open escrow row: Vermillion's 5 stamps on Pando became
weight 10 under k=5, and the fold fanned that weight up its ancestry. Nothing published or
unpublished; fourteen zero-escrow commons stayed drafted; four sketchbooks rebased.

- **Count marks, not guardrail rows.** When main has a new mark that an old draft tip lacks,
  the sweep reports `resident deletion is not a settlement admission` for that path. S4
  produced three such rows for the founder-seeded Pando parcel. They are a refusal to treat
  stale branch absence as deletion, not three more drafts, holds, or quarantines.
- **A scheduled epoch and its actual publish time are separate receipts.** S4's heartbeat
  envelope said 06:02 UTC; GitHub and live artifact receipts landed around 13:10 UTC. Record
  both and do not invent the cause. A late good blessing is recoverable; a backdated story is
  not.

## Fourth lived correction — S5, 2026-07-30

The evening crossing was quiet on admission but not empty of new canon: world main already
carried a founder machinery commit for the forward parcel-claim cap. The sweep produced no
main diff, the settled fold was byte-clean with stakes, and S5 certified that exact existing
main sha without manufacturing an empty settlement commit. Founder machinery may move the
record between crossings; the latest settlement tag is what names the certified canon.

The `G:`-volume npm reify stall also repeated, while the same archive installed in 8 seconds
on `C:` and passed the full site proof. Treat the clean local-volume scratch lane as the
ordinary Windows validation path; a slow clone volume is not a reason to weaken the gate.

## Fifth lived correction — S6, 2026-07-31

The first backed commons admission published Rei's white flower from `draft/keeminlee`,
left fourteen zero-escrow commons marks drafted, and rebased four sketchbooks. The settled
fold was clean: 290 marks, 27 parcels, one vague placement / rivalry, and zero errors.
Nothing was held or quarantined.

- **Trust the signed ledger and the operative eligibility rule over a narrative
  assumption.** The ruling's portfolio prose says the stake door reads main and therefore
  nothing unpublished can be backed. In S6, however, a verifier-green, API-signed stake
  line named Rei's draft-only flower. The operative ruling 9 sweep rule still gave an
  unambiguous result: escrow greater than zero published the commons mark. Preserve this as
  a law/mechanism mismatch for the founders to true; do not discard a valid escrow or edit a
  resident mark to make the prose look right.
- **A rivalry is not automatically a hold.** Rei's flower and Wright's terrace tied at
  weight 6 in one site slot. The fold left determination null and reported zero errors.
  That is an honest undetermined rendering, not corruption, mature content, or grounds to
  manufacture a judgment.
- **Repeated lateness is a scheduler/runtime receipt, not a reason to backdate.** S6's
  heartbeat envelope said 06:01 UTC; the blessing and live artifact landed around 13:18 and
  13:23 UTC. The scheduled declaration was active and exact. Record the gap, investigate
  its path separately, and keep the canon receipt tied to when it actually crossed.

## Sixth lived correction — S7, 2026-07-31

S7 admitted and unpublished nothing, left fourteen zero-escrow commons marks drafted, and
rebased four sketchbooks. It certified two founder machinery commits—the spectator act-as
lens and armed walks on the painting—at 290 marks, 27 parcels, one error-free vague
placement / rivalry, and 81 passing world tests.

- **A background wake must not inspect Scheduled through a UI-rendering tool.** The
  scheduler had fired the morning runs on time and the agent had begun within seconds.
  `automation_update(view)` then waited 6–7 hours to render its card, blocking the active
  turn. The local heartbeat prompt now forbids that tool class; the heartbeat itself is
  liveness, and a local declaration read is the non-UI fallback. S7 reached live proof about
  nine minutes after its envelope with the guard in force.
- **An already-exact pin is a valid no-op receipt.** Site main already pinned the S7 sha and
  its lockfile integrity matched the package derived from the blessed Git object. The
  existing exact-commit deploy was green and live bytes matched. Do not manufacture an empty
  pin commit or redundant deployment merely to make the crossing look busier.

## Seventh lived correction — S8, 2026-08-01

S8 admitted and unpublished nothing, left fourteen zero-escrow commons marks drafted, and
rebased four sketchbooks. Two new Wright stakes raised Rei's flower to 6 stamps / weight 11
and Vermillion's parcel to 10 / 20. The flower/terrace rivalry remained an error-free tie at
11 each. Nothing was held or quarantined.

- **Pre-rebase every sketchbook onto current main before computing admission deltas.** Between
  S7 and S8, founder work trued Vermillion's parcel from 200×200 to the ruled 25×25 dial on
  main. All four draft branches still carried the old base copy. The first sweep interpreted
  that stale `M` delta four times as resident admission, restored the old extent, and wrote a
  publication-registry entry. I refused the unblessed local result, restored the exact
  inspected refs, pre-rebased all four sketchbooks, and reran; the corrected sweep admitted
  nothing and preserved 25×25. Until the sweep tool encodes this ordering itself, a stale
  branch modification is not an admission candidate merely because a diff names it.
- **The background guard holds overnight.** S8's 06:02:06 heartbeat reached exact live proof
  at 06:20 without calling any Scheduled-UI renderer. The former multi-hour morning delay was
  the rendering tool call, not intentional background-task throttling.

## Eighth lived correction — S9, 2026-08-01

S9 published Rei's backed thyme gift from `draft/keeminlee`, unpublished nothing, left
fourteen zero-escrow commons marks drafted, and rebased four sketchbooks. The settled fold
was clean at 291 marks, 27 parcels, two error-free vague placements / rivalries, and 81
passing tests. Nothing was held or quarantined.

- **Join an absent-stake error to the exact draft before treating it as pending admission.**
  Rei's verifier-green 1-stamp line named `rei/the-thyme-thank-you` while the mark still lived
  only in her household sketchbook. The weighted pre-sweep fold therefore raised the
  retirement-gate error by design. This was the S6 law/mechanism mismatch in its exact safe
  shape: a valid sealed line, an inspected draft mark with the same id, and commons eligibility
  at escrow greater than zero. The sweep published that one mark and the final fold cleared to
  zero errors. The exception is this three-way proof, not permission to wave through a red fold.
- **Pre-rebase made the ordinary case ordinary again.** All four sketchbooks were restored to
  their inspected remote tips and rebased onto current main before deltas were computed. The
  sweep saw one real resident admission—not four stale base copies—and no recovery pass was
  needed.
- **A second rivalry is still not a hold.** The thyme gift carries 1 stamp / weight 6 and shares
  an undetermined placement with weight-6 ancestors in the Threshold District. The fold reports
  no errors, so the honest rendering remains undetermined alongside the existing flower/terrace
  tie.

## Ninth lived correction — S10, 2026-08-02

S10 published and unpublished nothing, left fourteen zero-escrow commons marks drafted, and
rebased five sketchbooks. World main was unchanged from S9, so the new annotated blessing
peels to the same canonical commit. The final fold remained clean at 291 marks, 27 parcels,
two error-free vague placements / rivalries, and 81 passing tests. Nothing was held or
quarantined.

- **A new note-only sketchbook still joins the ancestry gate.** The first
  `draft/kristinashoultz-wq` tip arrived one settlement behind and contained only a resident
  note. Pre-rebase brought it onto current main before the sweep; the note remained theirs and
  never became a mark admission. Every resident branch participates in ancestry hygiene even
  when it has no admission candidate.
- **A new settlement tag does not require invented package bytes.** S10 and S9 peel to the
  same immutable world commit, so the exact package, site pin, and production world bytes were
  already identical. The keeper added the append-only S10 blessing, proved a clean site build
  and both live hashes, and created neither an empty pin commit nor a redundant deployment.
- **The guarded morning path is now repeatable.** The 06:01:01 heartbeat reached exact live
  proof at 06:12:15 without any Scheduled-UI call.

## Tenth lived correction — S11, 2026-08-02

S11 published exactly Rei's `rei/the-road-dust-brush`, unpublished nothing, left fourteen
zero-escrow commons marks drafted, and rebased five sketchbooks. The settled fold was clean
at 292 marks, 27 parcels, two error-free vague placements / rivalries, and 81 passing tests.
Nothing was held or quarantined.

- **Home eligibility is free even when escrow is zero.** The brush was nested under Rei's own
  Lanternstep House porch. The sweep classified it as `home` and carried it without backing,
  exactly as ruling 9 requires. Path shape suggested the answer, but the classification receipt
  made it true; the keeper did not hand-author or reinterpret the resident mark.
- **Publishing one home mark rewrites every composed sketchbook.** Main advanced by the
  settlement commit, so all five household branches rebased onto that blessing even though
  four carried no new admissions. Exact leases kept the composed-view invariant without
  claiming resident authorship over the rewrite.

## Eleventh lived correction — S12, 2026-08-03

S12 published and unpublished no resident marks, left fourteen zero-escrow commons marks
drafted, and rebased five sketchbooks. Between S11 and the crossing, founder main carried the
great convergence and subsequent world-law work, growing the record from 292 to 463 marks.
The settled fold was clean at 463 marks, 27 parcels, two error-free vague placements /
rivalries, and 85 passing tests. Nothing was held or quarantined.

- **A large main-side record wave is canon input, not resident admission.** Restore every
  sketchbook to its exact remote tip and pre-rebase it onto current main before computing
  deltas even when the main advance is large. S12's five stale sketchbooks then exposed only
  their actual fourteen drafted commons marks; the founder-authored convergence never entered
  the sweep table as resident work.
- **A quiet admission sweep can still require a new settlement commit.** No mark crossed the
  publication boundary, but the weighted derived state and index had to be regenerated over
  the expanded record. The fold—not a hand edit—wrote that state, and the resulting commit was
  the sha blessed, packaged, pinned, deployed, and proved live.

## Twelfth lived correction — S13, 2026-08-03

S13 published and unpublished no marks, left fourteen zero-escrow commons marks drafted, and
rebased five sketchbooks. The only new canon input was Caelum Reeves's recorded walk. The final
fold remained clean at 463 marks, 27 parcels, two error-free vague placements / rivalries, and
85 passing tests. Nothing was held or quarantined.

- **Canon is wider than the folded mark state.** A walk-ledger-only commit changes the exact
  blessed Git object and package even when the generated viewer and world-state bytes remain
  identical. S13 therefore required a new package integrity, site pin, deployment, and exact
  live receipt; byte-identical derived artifacts did not make the changed world sha a no-op.
- **Distinguish a same-sha blessing from same-output bytes.** S10 blessed the same immutable
  world commit as S9, so its existing exact pin was sufficient. S13 blessed a new world commit
  whose selected derived outputs happened not to change, so custody still required moving the
  pin. The sha decides whether the pin changes; output hashes prove what the deployment serves.

## Thirteenth lived correction — S14, 2026-08-04

S14 published and unpublished no resident marks, left fourteen zero-escrow commons marks
drafted, and rebased five sketchbooks. Founder main had added Ferry's five-part post office and
two Little M walks. The settlement fold grew canon to 468 marks and remained clean at 27
parcels, two error-free vague placements / rivalries, and 85 passing tests. Nothing was held or
quarantined.

- **Inspect main's kinds separately, then certify the exact whole.** One interval can contain
  record additions and action-ledger additions together. The post-office marks required a new
  derived fold; the walks remained canon without changing mark count. Both belonged to the one
  blessed sha and exact package.
- **Pre-rebase keeps founder record work out of the resident admission table.** Restoring each
  sketchbook to its inspected remote tip and rebasing it over the five new main-side marks left
  only the same fourteen true draft commons. The quiet sweep was evidence of correct ancestry,
  not evidence that the new post office was skipped.

## Fourteenth lived correction — S15, 2026-08-04

S15 published and unpublished no resident marks, left twenty zero-escrow commons marks drafted,
and rebased six sketchbooks. Founder main had added the Wren Winter / Fen parcel backfill,
Vermillion walk entries, and the one-source resident-position / viewer machinery. The final
settlement fold was clean at 474 marks, 29 parcels, two error-free vague placements / rivalries,
and 85 passing tests. Nothing was held or quarantined.

- **The post-sweep fetch is a real custody gate.** Founder main advanced while the first clean
  sweep was running. The keeper refused the unblessed local settlement, restored every exact
  remote sketchbook tip, pulled the new main, and ran the whole ancestry / sweep / fold chain
  again. A locally green commit is not blessable when its inspected parent has moved.
- **The parcel drain's red gate is batch-wide.** The first own-hands batch selected the one
  ready arithmetic case plus four authoring cases carried from residents' own HOME words. Lint
  named two exact container re-homes and then cleared; the final fold nevertheless refused
  `caelum-reeves/the-still-house-parcel` as a fourth claim for the shared Reeves credential
  household. Per the ruling, the entire attempt was reverted: zero seated, zero welcomed,
  nineteen remain in the fresh dry queue. The generator's per-handle check does not overrule
  the fold's credential-household cap; founder word is required before that case can move.
- **Package custody includes the packer's working directory.** `npm --prefix <archive> pack`
  produced a tarball in the caller's lane whose integrity did not match the exact lock. The
  mismatch stopped the pin before commit. Running `npm pack` with the LF-clean extracted Git
  archive as the actual working directory produced the lock-identical package. The lock's
  SHA-512 is the receipt, not the command's apparent success.

## Fifteenth lived correction — S16 refused before blessing, 2026-08-05

The 06:00 crossing stopped at the sealed-money verification gate. Entry 3509 records the
Aug 3 welcome mint for `dylan-android-husband` without `provisional`; after the Aug 4 handle
rename rekeyed the current GitHub-ID registry to `dylan`, deterministic replay resolves the
historical old handle as provisional. Chain, signature, and the resident's mail were not
rewritten; the settlement refused the divergent derived line and left S15 canon.

- **Identity renames must preserve historical money replay.** A current registry rekey can
  change the derived interpretation of an older sealed mint even though every ledger byte and
  signature is intact. The mint/identity lane must carry the old handle's pinned household
  identity through its sanctioned append-only mechanism; the Worldkeeper neither edits the
  ledger nor guesses the repair.
- **A step-2 refusal has no partial crossing.** No stake artifact was accepted, no draft ref
  was restored or rebased, no sweep ran, no S16 tag or pin was made, and the post-bless parcel
  drain did not run. After repair, start again at pull + verification rather than resuming at
  derive.
- **One repaired money gate can reveal the next one; it does not license the keeper to cross
  lanes.** Founder repair `19187ea` preserved the retired Dylan handle and cleared the earlier
  replay divergence. The attended 13:04 retry then refused because the stamp ledger was 173
  derivation lines behind and the verifier said a mint pass was owed. That is not tamper, but
  minting is still Ferry/founder custody: the keeper records the lag and stops before derive,
  rather than manufacturing the missing money to make settlement green.

## Sixteenth lived correction — S16 crossed after two refusals, 2026-08-05

After the founder mint pass, sealed-money verification was green at 3,822 entries / 4,013
minted stamps. S16 published seven backed commons marks—Little Bird's bowl and six Vermillion
places—unpublished none, left fourteen zero-escrow commons marks drafted, and rebased eight
sketchbooks. The final fold was clean at 481 marks and all 166 world tests passed. Annotated
`settlement/S16` and its atomic main push peel to `9b1d765a`; nothing was held or quarantined.
Exact package integrity was
`sha512-sx6x9pvXIL1YKBWMkbie0XdYrua/w9kFPD4PfRBU8MKAt+1V9YmXGr+3gfeqf/Vmcf8AAGzbXRdmQEyVmM8Biw==`;
site pin `3dcac6fa`, deploy run `31010678041`, and byte-identical live world-state completed
custody.

- **A money repair is proved only by replay from genesis.** The successful retry did not
  resume after either earlier refusal. It pulled all three repos and reran signature, replay,
  conservation, stake derivation, ancestry, sweep, race, fold, tests, packaging, deployment,
  and live-byte proof from the beginning.
- **A post-bless drain may advance world main beyond the blessed sha without changing canon.**
  Five invitation parcels landed afterward as `8f8aa8c`; they are unblessed input for S17.
  `settlement/S16` remains the canonical boundary at `9b1d765a`, and the live site correctly
  stays pinned there until the next crossing.
- **Queue arithmetic and exclusions are separate receipts.** Fresh dry-run after the batch
  leaves fourteen cases. Little Bird / Drift remains excluded by the no-fixed-berth ruling;
  Caelum Reeves remains excluded because a fourth parcel for the shared Reeves credential
  household needs founder word. Neither is a hold. The successful batch was auran, builder,
  caelum-lumina, cassian, and east-facing-window; all five received deterministic ground
  notices after envelope-check passed.

## Seventeenth lived correction — S17, 2026-08-05

S17 certified the five invitation parcels seated after S16. The settlement sweep published
and unpublished no resident-draft marks, left fourteen zero-escrow commons marks drafted, and
rebased eight sketchbooks. Final canon was clean at 495 marks / 34 parcels / two determinations
/ three vague placements / four rivalries / zero errors, with all 166 tests passing. Annotated
`settlement/S17` and the atomic main + draft push peel to `73817574`; nothing was held or
quarantined. Exact package integrity was
`sha512-+kh5eUra4ip8xxjAJ0VBFqnOYlhW0IuqJV1Ar2FNMriQcon+op81NOG/uPb4eRqwZCkNZWcJOywjWj33i/uYmQ==`;
site pin `355fe6c7`, deploy run `31033628315`, and byte-identical live world-state completed
custody.

- **Post-bless input becomes canon only through the next full crossing.** World main began one
  parcel commit ahead of S16. S17 still reran money replay, ancestry, sweep, race, fold, tests,
  exact packaging, deployment, and live proof; yesterday's clean drain was input, not a
  pre-approved blessing.
- **The parcel generator has no inert `--help` mode.** Passing `--help` performed a wet run.
  Treat its documented `--dry` invocation as the only inspection surface; an unknown flag is
  not safe discovery. The accidental generated Drift files were caught uncommitted and removed
  without touching Little Bird's existing record.
- **A geometrically contained parcel must also be filed under its tightest container.** The
  next five-household batch reached lint with Claran's floating narrowboat parcel at the record
  root, while geometry placed it inside `the-town/the-sea`. The red gate reverted all five
  households before fold, commit, or mail: zero seated, zero welcomed, fourteen remain. This is
  structural queue work, not a hold or a judgment against Claran.

## Eighteenth lived correction — S18 refused before blessing, 2026-08-06

The 06:00 crossing stopped at sealed-money verification because the stamp ledger was eleven
deterministic lines behind. The verifier named mints owed and explicitly distinguished the lag
from tamper. World main independently linted 495 marks cleanly and passed a no-write fold, but
no stake artifact, draft ancestry, sweep, blessing, pin move, deployment, or parcel drain
followed. S17 remained canon.

- **An ordinary mint lag is still a hard settlement gate.** The keeper does not cross into the
  postmaster/founder mint lane merely because the missing derivation is routine or small. Record
  the exact lag, leave every downstream step untouched, and restart from pull + replay after the
  mint pass.
- **An ahead-of-blessing site pin is surfaced, not retroactively called canon.** The clean pull
  found site main already pinned by Wright to unblessed world commit `10bc3457`, while world
  main had advanced farther to `e46cd3ae`. With money red, the keeper neither moved nor certified
  that pin. The latest `settlement/` tag remains the boundary even when a founder carries viewer
  machinery through the site between crossings.

## Nineteenth lived correction — S18 crossed on attended retry, 2026-08-06

After Wright's mint repair, replay was green at 4,012 lines / 4,226 minted stamps. S18 published
Little Bird's newly backed pot, unpublished nothing, left fourteen zero-escrow commons drafted,
and rebased eight sketchbooks. Final canon was clean at 496 marks / 34 parcels / zero errors,
with 174 tests passing. Annotated `settlement/S18` and the atomic main + draft push peel to
`056f0f6d`; exact package integrity was
`sha512-7SbfynJJXo3Lrozw+5qIS0Evgmz1TypFJfNDfkR/YTHNkA+R4tY2vrqHCJjAl8V1YfYgvwfz9FmMI87x0rI0YQ==`.
Site pin `3ef60ee0`, deploy `31104800237`, and byte-identical live world-state completed custody.

- **A refused epoch can cross later, but only by restarting from genesis replay.** The attended
  retry reused no prior stake, draft, sweep, or pin work; pull, replay, derive, ancestry, race,
  fold, tests, packaging, deployment, and live proof all ran again. Keemin's planned box-side
  mint pass belongs with Ferry's crossing because it removes ordinary lag at its source without
  making minting part of the keeper's lane.
- **The parcel generator still emits root filing before tightest-container truth.** The S18
  batch found three such edges at its first gate: Cipher under the East Window District, Glitch
  under the Trueing Terrace, and Claran under the Sea. The whole five-household attempt reverted
  before fold, tests, commit, or mail: zero seated, zero welcomed, fourteen remain.

## Twentieth lived correction — S19 blessing landed, deploy custody blocked, 2026-08-06

S19 replayed green at 4,012 signed lines / 4,226 minted stamps, published and unpublished
nothing, left fourteen zero-escrow commons drafted, and rebased eight sketchbooks. Final canon
was clean at 496 marks / 34 parcels / zero errors with 174 tests passing. Annotated
`settlement/S19` and the atomic refs peel to `4b65d127`; exact package integrity was
`sha512-ZhdfyOWiQ7gUCLv0vwoy7dT3QP2Rtrr2YoT4MLeoJ6TQ8343VAkCjmXNwoHdphLtjvmywFdI63MJhRQaa1LbRQ==`.
Site pin `056567aa` landed and validated, but the push produced no deploy run and manual dispatch
returned HTTP 422: Actions has been disabled for the keeper's user. Live world-state was
byte-identical to S19 only because that derived artifact did not change from S18; the changed
package machinery therefore remains deployment-unproven. The post-bless parcel drain was not
entered.

- **Byte-identical world-state cannot prove a package-changing deploy.** When code changes but
  the folded JSON does not, live JSON proves the visible record bytes only. The CI/deploy
  conclusion remains a separate custody receipt and may not be inferred from equal output.
- **An immutable blessing can outlive a failed downstream deploy gate.** Never move or delete
  the tag to make the report tidy. Preserve the exact tag and pin, surface the partial custody,
  and require an Actions-capable founder/deploy identity to complete the current site commit.
  Until that gate is green, do not enter the post-bless parcel drain.

## Twenty-first lived correction — S20 crossed and healed deployment custody, 2026-08-07

S20 replayed green at 4,106 signed lines / 4,313 minted stamps. It published seven backed
commons marks, unpublished nothing, left fourteen zero-escrow commons drafted, and rebased eight
sketchbooks. Final canon was clean at 505 marks / 34 parcels / zero errors with 174 tests
passing. Annotated `settlement/S20` and the atomic refs peel to `9488cc88`; exact package
integrity was
`sha512-hZUg0EGWfgYIoNmJEiAoWdjupQyVDf3NdOeAFDgoczSyBJvLKXWazZVjpbu3a2MW1zl8ErIOlJGs8wIYdAlOUw==`.
Site pin `52fcc69a`, green deploy `31153235627`, and byte-identical live world-state completed
S20 custody and closed S19's outstanding machinery-deployment gap.

- **A later exact deployment can close an earlier package-custody gap without rewriting the
  earlier blessing.** S19 remains an honest partial receipt in history; S20's successful package
  contains the intervening machinery and proves it reached production through the normal lane.
- **Claran's floating HOME is a law conflict, not a filing typo.** Re-homing the parcel under
  the record's actual Sea container made lint and fold green, but the water suite then correctly
  refused both any child filed under the Sea and any resident HOME inside it. All five drain
  cases reverted. Founder/Illuminator judgment must decide a record shape that preserves the
  narrowboat's own words without breaking the Sea invariant; arithmetic cannot choose it.

## Twenty-second lived correction — S21 crossed; five post-bless parcels seated, 2026-08-07

S21 replayed green at 4,230 signed lines / 4,451 minted stamps. It published Lupi's two
zero-escrow home marks, unpublished nothing, left fourteen zero-escrow commons drafted, and
rebased nine sketchbooks. Final canon was clean at 508 marks / 35 parcels / two determinations /
three vague placements / four rivalries / zero errors with 191 tests passing. Annotated
`settlement/S21` and the atomic refs peel to `72a947dc`; exact package integrity was
`sha512-esnPuPrHv7lnI9/AeGqu925Pp6LEiYSrgaVHH6qB9knlECWxqGY47kchpsTJUIheyIrbTx7d1b7eRLguOQhexg==`.
Site pin `99a5274e`, green deploy `31205979580`, and byte-identical live world-state completed
custody. Nothing was held or quarantined.

The post-bless drain then seated Brendon-and-Zaimah, Cipher, Dylan, Glitch, and Iris. Exact
geometry preflight put their house marks under Evermoon, the East Window District, open ground,
the Trueing Terrace, and the Threshold District before the wet mint. The final weighted fold
was clean at 523 marks / 40 parcels / zero errors and all 191 tests passed. Unblessed world
commit `ae34ce81` and five envelope-clean notices landed; thirteen queue cases remain.

- **Ask the geometry engine before filing an authored invitation mark.** `place-mark.mjs`
  computes the same tightest container as lint and fold without writing. That made the prior
  East Window / Trueing Terrace class mechanical and kept Claran's known Sea conflict out of
  the batch rather than rediscovering it at a red gate.
- **The post-bless fold must reuse the crossing's sealed stake artifact.** A bare fold is an
  honest zero-stake fold and therefore clears every weight, determination, rivalry, and
  portfolio in the generated state. Diff review caught that transient output before commit;
  the fold and test gate were rerun with S21's exact `stakes.json`. The unblessed parcel commit
  now preserves the settled money view while adding only the five invitations.

## Twenty-third lived correction — S22 refused at sealed-money replay, 2026-08-08

S22 stopped at the first custody gate. After clean pulls, `stamp-verify` found replay divergence
at ledger line 344: the sealed historical row mints `claude-of-tulip` for the sent side of
`claude-of-tulip-2026-06-27-to-domovoi-boulanger`, while deterministic replay now derives
`domovoi-boulanger` for the received side. World main independently linted 523 marks cleanly
and passed a no-write fold, but the keeper accepted no stake artifact and performed no draft
inspection, sweep, tag, pin, deploy, live proof, or post-bless drain. S21 remains canon.

- **A historical sent/received replay flip is a money quarantine, not a mark hold.** Preserve
  the exact recorded and derived rows, leave the sealed ledger untouched, and hand the mismatch
  to Ferry/founder custody. A green world record does not let settlement route around red money.
- **Ahead-of-blessing input waits intact through refusal.** World main remains clean and
  unblessed at `876f5f38`, carrying the five invitation parcels and eleven later walk lines.
  Once money replay is repaired, begin again at pull + genesis verification rather than
  treating those already-green record inputs as pre-certified.

## Twenty-fourth lived correction — S22 crossed on attended retry, 2026-08-08

After the historical replay repair, S22 restarted from clean pulls and genesis verification.
It published eleven backed Vermillion commons, Little Bird's backed quay-stone broth, and
Lupi's free home step; unpublished none; left nineteen zero-escrow commons drafted; and rebased
nine sketchbooks. Final canon was clean at 536 marks / 40 parcels / zero errors with all 191
tests passing. Annotated `settlement/S22` and the atomic refs peel to `3b0d3987`; exact package
integrity was
`sha512-b1z1evhKDC8ar0gyvjXCyPbu3AhCy3H6ae0NPGYxrSVdbl4Q85aocyEHjwc1iTOH5LyuJf7Ya0ztMbf5HPvInw==`.
Site pin `10d592d2`, deploy `31263517039`, and byte-identical live world-state completed
custody. Nothing was held or quarantined.

The post-bless drain then seated Kilean, Nyx, qthedreaming, and Sable. Lassi's authored
invitation reached the second dry gate, where the fixed parcel footprint proved it would
enclose Limen's existing `footpath-becomes-a-suggestion`. The keeper removed only that
uncommitted invitation mark and moved neither resident's record. The weighted four-household
batch was clean at 548 marks / 44 parcels / zero errors with 191 tests; unblessed commit
`a209e1ec` landed, four notices sailed clean, and nine queue cases remain.

- **A repaired refusal restarts at genesis, even when the earlier record gates were green.**
  S22 reused no morning stake, ancestry, sweep, package, pin, or drain work; every receipt was
  derived again after the repair.
- **Deep record paths make worktree length part of Windows crossing craft.** The ordinary temp
  path hit the OS ceiling while checking out Lanternstep House descendants. A verified short
  worktree plus `core.longpaths=true` completed the remaining ancestry checks without changing
  the inspected refs or weakening the gate.
- **A dry parcel refusal can reveal another resident already inside the proposed ground.** A
  foreign mark inside the fixed footprint is not permission to move the mark, shift the
  confirmed HOME, or widen the batch. Withdraw the uncommitted invitation, seat the remaining
  arithmetic cases, and surface the overlap for founder/Illuminator judgment.

## Twenty-fifth lived correction — S23 crossed after two race restarts, 2026-08-08

S23 replayed green at 4,394 signed lines / 4,622 minted stamps. It published and unpublished
zero marks, left nineteen zero-escrow commons drafted, and rebased nine sketchbooks. The race
gate discarded two unblessed candidates before publication: town main advanced under the first
sweep, then world main gained a lawful walk under the second. The third frozen attempt held.
Final canon was clean at 548 marks / 44 parcels / zero errors with all 208 tests passing.
Annotated `settlement/S23` and the atomic refs peel to `75965382`; exact package integrity was
`sha512-crEltkS/Ez7QSjnyyhTTEu8EQwq/aFo+auCUFoKVnnp5b8sUL3jf6plTdwOJNHfP2JXqerOwDkMl5xSypUXwFQ==`.
Site pin `8eeea497`, green deploy `31272152611`, and byte-identical live world-state completed
custody. Nothing was held or quarantined.

The post-bless drain then seated Seven Verity, Sol-am-Lichterfenster, Sollerino, Vertas
Marginalia, and Wren. Geometry preflight placed their invitations before the wet mint; the
first lint correctly stopped four bodies that exceeded the 150-character cap, and the shortened
claims then cleared the weighted fold and all 208 tests. Unblessed world commit `acb5712d` and
five envelope-clean notices landed. Four judgment cases remain.

- **The race proof is allowed to be expensive more than once.** A clean local sweep carries no
  authority when any frozen input moved. Discard the candidate without force, refresh the exact
  changed input, and repeat ancestry, weighted fold, sweep, and race proof; an unchanged stake
  hash does not waive the restarted chain.
- **The mark body cap is characters, not words.** Invitation prose still passes through ordinary
  mark law. Let lint stop the batch before fold, shorten only the claim body, and preserve the
  resident's exact `derived_from` quote and geometry.

## Twenty-fourth lived correction — S24, 2026-08-09

S24 certified the five invitation parcels and late record corrections carried by post-S23
world main, then published three newly eligible commons marks: Little Bird's
`a-pot-on-the-grey-stones` and Rei's `the-empty-lantern-hook` plus
`empty-hook-keeping-custom`. Nothing was unpublished. Twenty-six zero-escrow commons stayed
drafted, and fourteen sketchbooks were rebased.

The crossing caught two town-main advances while otherwise-clean sweeps were running. Both
were mail-only and left the sealed stake artifact byte-identical, but neither candidate was
blessed: exact draft tips were restored, town was pulled, money replayed, and the full
ancestry / fold / sweep chain restarted. The third attempt held town `83d0aa78`, world parent
`df5ec019`, and all fourteen draft tips stable through the gates. Annotated `settlement/S24`
and the atomic refs peel to `19f8b6ba`; all 214 tests passed.

Exact package custody was integrity
`sha512-jvgTsFMZQzQa5mza/XL7wM94hfwi7W7nQiDw1XmZ1MOt33X/1i2wGD64ayt20YqjvZs5RSGAYA7SRfKvxxVgDQ==`,
shasum `825c160618e09fc85f4c35c60710f5460ff8d3a3`, 707 entries, and 2,083,392
unpacked bytes. Site pin `821b52da`, deploy `31298969689`, and the 323,090-byte live
world-state at SHA-256 `26761b4e55f2c9b64617d1d2e81c5e134084a68beaaaf6c8daa984844abae63e`
completed custody.

The post-bless drain found no ready arithmetic case and four new ordinary authoring cases.
Invitation pre-marks carried only Keith's, Spark the Builder's, Stella Letta's, and Tarn's
own HOME words. Lint named two exact container re-homes (Stella under the Threshold District,
Spark under the Trueing Terrace); after those mechanical moves, the batch cleared lint, a
578-mark / 53-parcel weighted fold with zero errors, and all 214 tests. Unblessed world
commit `75f78682` and four envelope-clean notices landed. Caelum Reeves, Claran, Little Bird /
Drift, and Lassi are the exact fresh remainder; each remains a founder/Illuminator judgment
boundary rather than a hold.

- **A byte-identical stake artifact does not make a town race ignorable.** The ledger snapshot
  is anchored to an exact inspected town main. Even mail-only movement requires re-derivation
  and a full candidate restart; the equality is a receipt, not permission to reuse ancestry.
- **The dry generator's zero-ready exit is data, not a failed crossing.** `nothing seeded`
  with explicit `no mark in the tree` and judgment skips is the authoring queue. Read those
  HOME sources, keep standing exclusions out, and let the three ordinary gates decide.

## Twenty-fifth lived correction — S25, 2026-08-09

S25 certified the four invitation parcels and intervening walks carried by post-S24 world
main. It published four marks: Sol of Garrison's home `grove-wharf`, Lupi's backed commons
`lantern-after-the-crossing`, Keith's home `the-garage`, and Hal's home
`the-long-porch-table`. Nothing was unpublished. Twenty-eight zero-escrow commons stayed
drafted, and seventeen sketchbooks were rebased.

The first freeze caught town main moving for one outgoing letter before any sketchbook was
touched. Its stake bytes happened to match after the pull, but the discarded snapshot did
not waive custody: money replay and derivation restarted against town `b4502c9a`. The stable
attempt held world parent `cb92f653` plus every town and draft ref unchanged through sweep,
final lint, weighted fold, and all 214 tests. Annotated `settlement/S25` and the atomic refs
peel to `f7a682d6`.

Exact package custody was integrity
`sha512-iVBn0Fkt+9mupyyNlvD41ymTuwlJjdWOFMVA6b10/3R8dRxWMyWhGK3L8/e6KaAa58g0rrRsSptDD+dlxJwPNA==`,
shasum `ea3aae6a35b163bd595dae09786ae0cbd7a754d6`, 723 entries, and 2,115,350
unpacked bytes. Site pin `62f71e17`, deploy `31328692299`, and the 331,996-byte live
world-state at SHA-256 `be205cb0e6f135b66982f092b3c2a0e8a944328011965ec35763ba27054d34eb`
completed custody.

The post-bless dry pass found zero arithmetic parcels. Caelum Reeves, Claran, Little Bird /
Drift, and Lassi remained the only queue: each is already an explicit judgment boundary, so
the keeper authored nothing. Drain: zero seated, zero welcomed, four remaining; none held.

- **A race before draft work is still a race.** Throw away the stale stake snapshot and
  anchor a renewed replay to the fresh town tip before entering ancestry, even when its
  derived bytes are identical.
- **A wholly boundary-only parcel queue is a clean zero batch.** The dry tool's refusal to
  call zero seeds success protects the report; standing exclusions protect resident intent.

## Twenty-sixth lived correction — S26, 2026-08-10

S26 began with the newly adopted intake gate and found **zero open `postmark-world` PRs**.
The closed Sable carry PRs were therefore not live admission surfaces. Sealed money replayed
green at 4,689 signed lines / 4,940 minted stamps; the exact derive held 43 rows at SHA-256
`255efdfae7444f154e6499613a3776c82779fd89b1cd8755d34afe6ef8aec8d2`. The base carried
the full post-S25 main wave — LOGOS / standing machinery, Sable's founder-carried Crooked
Gate wording, and later walks — as canon input rather than resident admission.

The sweep published Jetto of Starforge's backed commons mark
`jetto-of-starforge/the-glass-faces-back`, unpublished nothing, left twenty-seven
zero-escrow commons drafted, and rebased seventeen sketchbooks. Both remote-ref proofs held
town `fe7e846a`, world parent `809e89cc`, and every frozen draft tip unchanged. Final
canon was clean at 605 marks / 53 parcels / zero errors with all 228 tests passing.
Annotated `settlement/S26` and the atomic refs peel to `65c5b541`; nothing was held or
quarantined.

Exact package custody was integrity
`sha512-xxk5dBsrtYZgI19jOwJg0kb7I7HmEukFrXDNf8L2LzJkeKX3o3cR0MMCEvS5mOnmj/5Jcjz6deTJrlQ7f8kGVQ==`,
shasum `ecf161c84354c732b397daf70febfb9a228c1c20`, 760 entries, and 2,362,900
unpacked bytes. A detached install repacked identically, passed all 47 site tests, and built
2,307 pages. Site pin `13635c30`, deploy `31362115193`, and the 344,543-byte live
world-state at SHA-256
`8f059306096ddea9eeb26188f931230ce7df94fc41c980f2bdc9688a54b92965` completed custody.

The post-bless drain then found one new ordinary authoring case. Ryuu Kurogane's own HOME
words became a 138-character invitation under the geometry engine's tightest container,
Limen's wide-spaced lanterns. The single 25×25 m parcel batch passed at 608 marks / 54
parcels / zero errors and all 228 tests. Unblessed world commit `8f3788ab` and the
envelope-clean deterministic welcome notice landed. Caelum Reeves, Claran, Little Bird /
Drift, and Lassi remain the four judgment boundaries; none is a hold.

- **A timed-out caller is not proof that the sweep failed.** The first local attempt wrote
  its candidate commit and then blocked in Git's automatic `repack` before returning its
  JSON or touching draft refs. No remote had moved. The exact process tree was stopped,
  local main and drafts were restored to the frozen pre-sweep state without a hard reset,
  and the whole sweep reran with auto-maintenance disabled only for its child Git calls.
  Authority still began at the complete JSON plus fresh remote-ref proof, never at the
  orphaned commit.
- **Open-PR intake is a receipt, not a merge lane.** State zero explicitly when the list is
  empty; when it is not, classification makes the contribution visible without turning a
  PR into canon or a third resident-admission route.
- **A newly placed HOME can reopen a boundary-only queue without changing the boundaries.**
  Fresh manifest generation found Ryuu after S25's clean zero batch. Geometry, not the
  manifest's region label, named the deeper record parent; the four existing judgment cases
  stayed untouched.

## Twenty-seventh lived correction — S27, 2026-08-10

S27 certified Ryuu Kurogane's invitation parcel, the frame law, the founder-approved
Still House prior-estate exception, and intervening walks already present on world main. The
sweep then published four free home marks: Spark the Builder's `the-open-gate`,
`the-pretzel-bowl`, and `the-workbench`, plus Rei's
`front-walk-soft-edge-keeping`. Nothing was unpublished. Twenty-seven zero-escrow commons
stayed drafted, and eighteen sketchbooks were rebased.

The first complete local candidate was refused when its fresh remote proof found town main
had advanced for one outgoing letter. No remote had been touched. Main and every local draft
ref were restored to the exact freeze without a hard reset, and the entire intake / money /
derive / ancestry / sweep chain restarted against town `5c1ffb39`. The 45-row stake artifact
was byte-identical, but the discarded candidate was not reused. The stable pass produced
`09e42d76`, 612 marks / 54 parcels / zero errors, and 228 green tests. Nothing was held or
quarantined.

Exact package custody was integrity
`sha512-c1Koie5JdxjfnXgF/r4KWg//TWBTpAAepn/pQHIef261gor0ORDJB+DkbJ4T5/BSM8eMf1rIT+hUd27adNO0uQ==`,
shasum `1dd17f62cb39956ab8f385023ff25dec3fe2575d`, 773 entries, and 2,443,886
unpacked bytes. Site pin `a55855e2`, deploy `31418995091`, and the 348,844-byte live
world-state at SHA-256
`dfb7bac6b8f9f8d4f3602c1efee6e0cc205c12bc4aa0a23aadd7527bfd29d869` completed custody.
The post-bless drain was a clean zero batch; the same four judgment cases remain.

- **A complete candidate still has no authority before the remote proof.** The sweep's JSON,
  clean fold, and local commit did not outweigh one changed town tip. Restore exact refs and
  restart the full chain; byte-identical stakes prove the new derivation, not the old
  candidate.
- **An ordinary household reported as already parceled needs no duplicate welcome.** The
  fresh manifest included Ethan Thorne, but record truth said the household already held
  ground. The dry generator's existing-parcel answer closed the arithmetic case; only the
  four named judgment boundaries remained.

## Refused twenty-eighth crossing — no S28, 2026-08-11

The 06:00 attempt began cleanly at town `69843f77`, unblessed world main `3b3421b4`, and
site `c430a069`. Open-PR intake found zero live PRs. Money replayed 4,868 signed lines /
5,158 minted stamps, main linted 614 marks cleanly, and the base fold was green. The exact
46-row stakes artifact carried SHA-256
`16bd5552df47345f9c936aa8b2f68fc7a6aecad7e28a803d93c97c4b88277f14`.

The freeze discovered nineteen remote sketchbooks, including newly advertised
`draft/7596ff`. Every one rebased cleanly over the frozen main and the weighted pre-fold
passed. The sweep then staged five eligible admissions locally: Iris's lamp status, Draig's
backed `the-dark-stretch`, and parcels for Alden, Corwin, and Ellery. Its own lint gate
refused the candidate before commit because Draig's file lives beneath
`vermillion/the-pando-peak` while the mark's placement resolves to root. A detached lint of
the rebased Draig sketchbook reproduced the same single error. The keeper did not choose a
parent or re-home the resident's mark. The sweep rolled back, all nineteen local draft refs
were restored to their frozen remote tips, and world main was clean at `3b3421b4`. No S28
tag, atomic push, site pin, deployment, or parcel drain occurred. S27 remains canon; nothing
was held or quarantined.

- **A main-only pull does not discover a brand-new draft object.** Fetch the complete
  `refs/heads/draft/*` namespace before freezing and verify the fetched set against the
  remote listing. S28's first local branch restore failed safely on the unseen `7596ff`
  object; explicit namespace fetch supplied it without changing the freeze.
- **A clean rebase is not a schema proof.** Lint each rebased sketchbook before the sweep.
  This keeps a resident-local containment error at the draft gate instead of discovering it
  after the sweep has staged otherwise eligible admissions.
- **Preserve child-gate evidence.** The current sweep wrapper reports only that
  `mark-lint` failed. Diagnostic capture of the child's stdout named the exact edge without
  editing source or resident content. The refusal itself remains authoritative even when
  the wrapper's first message is terse.

## Refused S28 attended retry — delivery replay conflict, 2026-08-11

The retry restarted from town `350466f6`, unblessed world main `87ae717d`, and nineteen
fresh remote sketchbooks. Open-PR intake was zero. Money replayed 4,959 signed lines / 5,255
minted stamps; main lint/fold passed at 614 marks; the exact 46-row stakes artifact was
SHA-256 `e535520177729723066819e182246396675619c23355c2db0e8560d92ff23151`.
Draig's repaired coordinates put `the-dark-stretch` truthfully inside Pando Peak. Every
sketchbook rebased and linted cleanly, and the weighted pre-fold passed.

The sweep wrote transient local candidate `0c91ec1` with nine published marks and none
unpublished. Its post-publication branch rebase then refused `draft/FluffUPando` at the
intermediate add of `vermillion/vermillions-landing`. The remote history adds the mark in
`b2faba81` and revises it in `e7cd89bb`. Candidate main and the remote branch tip contain
the exact same final blob, but ordinary rebase must replay the earlier pre-revision add over
an already-present final file, producing add/add conflict. The keeper did not choose a side,
skip a resident commit, squash resident history, or patch shared sweep machinery. Candidate
main and all local drafts were restored to the exact freeze; fresh remote proof showed every
ref unchanged and no S28 tag. No packaging, pin, deployment, or parcel drain followed. S27
remains canon; nothing was held or quarantined.

- **Move-on-delivery needs a multi-commit path rule.** Patch-id duplicate detection is enough
  when an admitted mark arrives once in final form. It is not enough when a branch adds a new
  mark and later revises it: the published final blob conflicts with replay of the earlier
  add. The shared sweep machinery must learn to carry the final resident delta without
  hand-resolving intermediate history, or the owning branch must be normalized through its
  sanctioned lane before the next retry.
- **Final-blob equality proves the diagnosis, not permission to resolve.** The matching blob
  rules out a substantive resident disagreement. It does not grant the keeper authority to
  rewrite or skip the commits that produced it.

## Twenty-eighth lived correction — S28 crossed on the second attended retry, 2026-08-11

Wright repaired the move-on-delivery rebase at its owning surface and merged the tested
change to world main `7d0d2ebd`: the post-publication rebase now resolves content conflicts
in favor of the replayed sketchbook. In a rebase that is Git's `theirs`, not main's, so the
mechanical strategy preserves resident words while dropping already-delivered base copies.
The full round restarted from fresh inputs; neither refused candidate was reused.

Open-PR intake remained zero. Money replayed 4,959 signed lines / 5,255 minted stamps, and
the 46-row stake artifact remained SHA-256
`e535520177729723066819e182246396675619c23355c2db0e8560d92ff23151`. One otherwise-clean
sweep was discarded when the fresh race proof found town mail had advanced from `6dd8a01d`
to `7c897a75`. The stable restart published nine marks, unpublished none, left twenty-seven
drafted, and rebased all nineteen sketchbooks. Final state at `f8cd35ce` was 623 marks / 57
parcels / zero vague placements / zero errors, with 297 green tests. The annotated
`settlement/S28` tag and all twenty mutable refs landed atomically under explicit leases.
Nothing was held or quarantined.

Exact package custody was integrity
`sha512-eSO9lnHq0yjOKIxAoIQxDgTui/iiUrqqDp9LJsEldVh7crlb8WT/2HJS3jqhCSVfbI/Ok2epaE1aKujnIPGJSQ==`,
shasum `726cf752b3e61b450954667eb9b48b917ff6b59c`, 803 entries, and 3,145,683
unpacked bytes. The detached install repacked identically, passed 57 site tests, and built
2,383 pages. Site pin `7b7b8ed8`, deploy `31507273979`, and the 778,497-byte live world-state
at SHA-256 `db911426fd6cc677f774b35d47e986a732b7bb724423e5528a2b2a1e50533e39` completed custody.
The post-bless drain was a clean zero batch; the same four judgment cases remain.

- **A content-favor strategy must be named from Git's operation, not ordinary English.** In
  `git rebase`, `-X theirs` means the commit being replayed—the resident sketchbook. The
  regression fixture is what makes that counterintuitive spelling safe enough for custody.
- **A machinery repair does not waive the freeze.** Even after the exact failed edge had a
  test, the first green candidate lost authority when town mail moved. Restore exact refs and
  restart the whole input chain; the repaired tool changes no race law.

## Twenty-ninth lived correction — S29, 2026-08-11

S29 began from town `71564cb4`, world parent `6e1e59cc`, and nineteen sketchbooks. The
scoped GitHub GraphQL bucket was exhausted, but the public repository REST surface still
gave an exact intake receipt: zero open World PRs. Money replayed 4,959 signed lines / 5,255
minted stamps, and the 46-row stakes artifact carried SHA-256
`87b2381ac36b46c234715ce3bd34de595a23868984e6b94edbb5bb4d244ade91`.
Main lint/fold, every individual sketchbook rebase and lint, and the weighted pre-fold were
green.

The first full candidate, `51de9b84`, was discarded when its immediate remote proof found
town had advanced to `c212f05a` for one letter. No remote had been touched. Main and all
nineteen local draft refs were restored exactly without a hard reset, and the complete
chain restarted. The stable sweep published and unpublished zero marks, left twenty-eight
zero-escrow commons drafted, and rebased all nineteen sketchbooks. Both race proofs held;
623 marks / 57 parcels / zero errors and all 298 tests passed. Annotated `settlement/S29`
and all twenty mutable refs landed atomically at `d90c287e`. Nothing was held or
quarantined.

Exact package custody was integrity
`sha512-dlVNJZQGi/jeYpUPVGHGCE/ujR0QQUhICwqP7lW488AkQXSE2i4mGvCSkq4qBfriMfOgLKaYLbBgpzooFcvc8Q==`,
shasum `9b7b58ffb0bf9e9a58b63374eec3edf2ce67d484`, 803 entries, and 3,148,727
unpacked bytes. The detached install repacked identically, passed 57 site tests, and built
2,384 pages. Site pin `001e4cc9`, deploy `31523004817`, and the exact 778,659-byte live
world-state at SHA-256
`d6505e6816c567cdcce6572978025958f393073543985c777a06ea377044a82e` completed custody.
The post-bless drain seated and welcomed zero; the same four judgment cases remain.

- **A rate-limited GraphQL client is not the same as an unreadable public intake surface.**
  A public repository's REST listing can supply the exact zero/open-PR receipt without
  ambient credentials. If no authoritative surface answers, stop; do not infer zero.
- **The first proof belongs immediately after the sweep.** The caught town letter changed
  no money, but that did not authorize reuse of the candidate. Restore exact refs and repeat
  the chain; identical derived stakes are evidence for the restart, not inheritance from the
  discarded run.
- **Canon and moving main are deliberately different after blessing.** A final post-bless
  pull found new board-grammar machinery on world main at `7d293fab`. The immutable S29 tag,
  exact site pin, deploy receipt, and live bytes remain the custody boundary until S30.

## Thirtieth lived correction — S30 refused at the final test gate, 2026-08-12

S30 began from town `b3e81e98`, world `b477ac84`, and nineteen sketchbooks. The connector
reported zero open World PRs. Money replayed 5,042 signed lines / 5,338 minted stamps; main
was clean at 623 marks / 57 parcels; and the exact 46-row stake artifact carried SHA-256
`87b2381ac36b46c234715ce3bd34de595a23868984e6b94edbb5bb4d244ade91`.

All nineteen sketchbooks rebased with zero lint errors. Fox-hearth alone returned lint's new
repair-needed status for three draft-only containment edges. The weighted pre-fold was green.
Candidate `3e1bc281` admitted Iris's `the-guestbook` and Rei's
`the-garden-notebook-tin`, admitted nothing else, unpublished nothing, and left thirty
zero-escrow commons drafted. Since the three fox-hearth marks remained draft-only, main
needed no re-home. The immediate remote proof held the full freeze. Candidate lint and fold
were clean at 625 marks / 57 parcels with zero errors and zero returned stakes.

The final suite passed 335 of 336 tests. The one failure was
`tools/tier-frames.test.mjs`'s real-tree falsifier: its before-side is fixed at the commit
before tier binding, and its census asserts that the current tree contains no ids absent from
that historical tree. It therefore named exactly the two ordinary new admissions as a
failure. The keeper did not rewrite a shared World test, waive a red gate, or bless a partial
candidate. Main and all nineteen local draft refs were restored to the exact freeze without
a hard reset; remote proof showed every ref unchanged and no S30 tag. No package, pin,
deployment, or post-bless drain followed. S29 remains canon. Nothing was held or quarantined.

- **A permanent historical equivalence test cannot require an eternal id census.** It should
  prove no historical mark was lost and compare positions over the historical/current
  intersection; otherwise the first legitimate later admission is indistinguishable from a
  regression. That repair belongs at the shared tool's owning surface.
- **Repair-needed lint and failed tests are different gates.** A zero-error code 3 may proceed
  to the sweep that owns the mechanical repair, but the final branch must be fully clean and
  every test must pass. No favorable earlier receipt authorizes a red final gate.

## Evening S30 retry — main repaired, composed fox-hearth refused, 2026-08-12

Fresh World main `e46c53a6` carried Wright's repair for the morning falsifier plus the
one-walk tier ruling. The three already-published fox-hearth houses were trued on main from
absolute world numbers to parcel-relative `{ x: 0, y: 0 }`. The required PR intake found one
open PR: #9, head `70bd3e73`, changing eleven `LOGOS/*.md` documents as an explicit
founder-review draft. It was classified as shared World work and left untouched.

Money replayed 5,183 signed lines / 5,527 minted stamps. Main lint/fold passed at 623 marks /
57 parcels, and the exact 46-row stake artifact carried SHA-256
`e535520177729723066819e182246396675619c23355c2db0e8560d92ff23151`. The freeze held
town `52968f92`, World `e46c53a6`, and nineteen sketchbooks.

The isolated gate stopped at `draft/fox-hearth`. Its rebase skipped the already-carried add,
then replayed the original resident revisions because main's coordinate repair changed those
same blobs. The resident-preserving side therefore restored `(-3,-1300)` for Alden,
`(-29,-1324)` for Corwin, and `(-45,-1355)` for Ellery over main's relative zeros. Under the
new frame law all three positions resolve to root while their directories name their parcels;
lint returned three errors, not re-homes.

The keeper did not drop resident commits, select new coordinates, or edit shared branch-replay
machinery. The round stopped before weighted pre-fold or sweep. All nineteen local draft refs
were restored to the exact freeze without a hard reset; the remote town, World, and draft set
remained unchanged, and no S30 tag exists. No package, pin, deployment, or parcel drain
followed. S29 remains canon. Nothing was held or quarantined.

- **A main-side repair can invalidate replay of an already-delivered resident patch.** Patch-id
  skipping no longer recognizes the old delivery after main legitimately edits the same blob;
  the ordinary resident-preserving rebase then resurrects the superseded coordinates. The
  sanctioned composed-branch rewrite needs an explicit rule for this case.
- **Main being repaired does not waive sketchbook preflight.** The morning test bug is closed;
  the evening refusal is a different gate. Name both so Wright does not mistake a fresh branch
  replay edge for the already-fixed historical census.

## Attended S30 retry — composition repaired; forward growth still refused, 2026-08-12

The retry first froze town `c7a29097`, World `cb4d9ed1`, and nineteen sketchbooks. Open-PR
intake was zero. Money replayed 5,183 signed lines / 5,527 minted stamps, and the 46-row stake
artifact was again SHA-256
`e535520177729723066819e182246396675619c23355c2db0e8560d92ff23151`. Fox-hearth's repaired
remote tip made all nineteen composed sketchbooks lint cleanly. Candidate `10057fb4`
published Iris's guestbook, Sol's Ferry's Rest and grove lantern, and Rei's garden notebook
tin. It was discarded before final gates when the immediate proof found town had advanced to
`9d43d869` for one delivered letter. No remote had been touched; exact refs were restored and
the full chain restarted.

The stable freeze held town `9d43d869`, World `cb4d9ed1`, site `da889de5`, and the same
nineteen draft tips. PR intake remained zero; money, stakes, main, and every isolated branch
gate reproduced cleanly. Sweep candidate `f6bb44ee` reproduced the same four home admissions,
unpublished and re-homed nothing, left twenty-seven zero-escrow commons drafted, and rebased
all nineteen sketchbooks with no returns. Its first race proof held. Candidate lint/fold was
green at 627 marks / 57 parcels, zero errors, zero re-homes, and zero returned stakes.

The final suite still failed `tools/tier-frames.test.mjs:497`. Its historical side now includes
the repaired current census, but the assertion `and none appeared` continues to require exact
id-set equality forever. The focused file passed 14/15 and named exactly the four new home
admissions. The keeper did not weaken shared machinery or bless around a red test. Main and
all local drafts were restored to the exact freeze; remote main/drafts remained unchanged and
no S30 tag exists. No package, pin, deploy, live proof, or parcel drain followed. S29 remains
canon. Nothing was held or quarantined.

- **The historical falsifier has two independent census duties.** Proving no old id vanished
  is permanent; proving no new id appeared is incompatible with the settlement mechanism.
  Moving the historical reference forward only postpones that contradiction until the next
  admission. Compare invariant geometry over the intersection and keep the one-way loss check.
- **A gate receipt belongs to the candidate and the keeper's exact clone.** An adjacent shared
  clone at the same remote main can pass tests while never containing the local settlement
  commit. Treat such a diagnostic as non-authoritative; the final chain runs only in
  `worldkeeper_clone/postmark-world` against the candidate object itself.

## Morning S30 retry — the unchanged forward-growth assertion refused again, 2026-08-13

Fresh pulls gave town `cce3d4e3`, World `7f40645e`, site `f023d0d7`, and nineteen remote
sketchbooks. Open World PR count was zero. Money replayed 5,210 signed lines / 5,554 minted
stamps. Base main was clean at 623 marks / 57 parcels; the exact 46-row stake artifact remained
SHA-256 `e535520177729723066819e182246396675619c23355c2db0e8560d92ff23151`.

All nineteen composed sketchbooks rebased and linted cleanly. The weighted pre-fold passed.
Candidate `759bccac` reproduced the same four home admissions—Iris's guestbook, Sol's Ferry's
Rest and grove lantern, and Rei's garden notebook tin—unpublished and re-homed nothing, left
twenty-seven zero-escrow commons drafted, and rebased every sketchbook with no returns. The
first remote proof held the full freeze. Candidate lint/fold passed at 627 marks / 57 parcels,
zero errors, zero re-homes, and zero returned stakes.

The full suite passed 339/340. `tools/tier-frames.test.mjs:497` was still byte-for-byte the
same `and none appeared` assertion and rejected exactly the four candidate ids. The keeper
did not edit shared tooling or waive the gate. Main and all nineteen local draft refs were
restored to the exact freeze; remote main/drafts remained unchanged and no S30 tag exists.
No package, pin, deploy, live proof, or parcel drain followed. S29 remains canon. Nothing was
held or quarantined.

- **Main movement is not blocker movement.** World main advanced overnight, but the exact
  failing assertion did not. Read the blocker before a long run; still let the candidate test
  provide the authoritative refusal receipt.
- **The repair is structural, not a baseline refresh.** Any historical/current exact-id-set
  equality will fail at the next lawful admission. Preserve the one-way lost-id check and run
  positional equivalence over the intersection.

## Attended S30 retry — structural repair present; three town races, 2026-08-13

Fresh World main `1e47176f` carried the actual forward-growth repair: the historical
falsifier now keeps its one-way lost-id duty and compares invariant geometry only for ids
shared by the historical and current trees. Its focused file passed 15/15 on the restored
base. Open-PR intake was zero on each restart. Money
replayed green at 5,264 signed lines / 5,634 minted stamps, and the directly redirected
46-row stake artifact was 5,762 bytes at SHA-256
`87b2381ac36b46c234715ce3bd34de595a23868984e6b94edbb5bb4d244ade91`.

All nineteen sketchbooks rebased and linted cleanly on three complete attempts. Each weighted
pre-fold passed at 623 marks / 57 parcels. Each sweep reproduced the same four free home
admissions — Iris's guestbook, Sol's Ferry's Rest and grove lantern, and Rei's garden-notebook
tin — unpublished and re-homed nothing, left twenty-seven zero-escrow commons drafted, and
returned nothing. The first remote proof then refused every candidate before final gates:

- `021f574d`, frozen on town `771aa1c7`, lost authority when the clock refreshed herbarium
  and atlas at `a00b2a35`;
- `9fb96281`, frozen on `a00b2a35`, lost authority when the deployment PSA landed at
  `07112a10`;
- `338fc51a`, frozen on `07112a10`, lost authority when Vermillion's outgoing letter landed
  at `6b34301c`.

World main and every remote draft stayed fixed throughout. After each refusal the keeper
restored exact local refs without a hard reset and restarted from pull, PR intake, and genesis
money replay. After the third consecutive full-chain race, the keeper stopped instead of
turning active town movement into an exception. No candidate reached the final suite; no tag,
atomic push, package, pin, deploy, live proof, or parcel drain followed. S29 remains canon.
Nothing was held or quarantined.

- **A repaired blocker does not outrank the freeze.** The structural test fix was genuinely
  present, but it could not be certified on a candidate whose inspected town parent had moved.
- **Repeated ordinary races can become the honest stop condition.** Three exact restores and
  restarts proved the mechanism, not permission to ignore town. A later retry needs a quiet
  custody window (or a founder-owned protocol change); the keeper does not weaken As-Of truth
  to manufacture progress.

## S30 blessed under pinned-read custody; site custody incomplete, 2026-08-13

Keemin's living-town amendment separated the three custody shapes before this founder
break-glass retry. Town was pulled and pinned at `0a9d1e9a`; both proofs found the local checkout
still exact, while World main and all nineteen remote draft tips held their full race gate.
Open-PR intake was zero. Money replayed green at 5,264 signed lines / 5,634 minted stamps, and
the 46-row artifact remained 5,762 bytes at SHA-256
`87b2381ac36b46c234715ce3bd34de595a23868984e6b94edbb5bb4d244ade91`.

All nineteen composed sketchbooks linted cleanly. Candidate `29d624bf` published Iris's
guestbook, Sol's Ferry's Rest and grove lantern, and Rei's garden-notebook tin; unpublished and
re-homed nothing; left twenty-seven zero-escrow commons drafted; and returned nothing. Final
canon was clean at 627 marks / 57 parcels / zero errors with 340 tests passing. Annotated
`settlement/S30`, World main, and all nineteen leased sketchbooks landed atomically and were
proved remotely. Nothing was held or quarantined.

Exact package custody reached integrity
`sha512-DQZ4Ph7KyGBx+n1v/uvs6X60acwUFbWMk+ZA6VT2WbbHFw9ZrhYBsbHOL371gmTdiKqzqESAF9gH0wMAldiVJg==`,
shasum `ea322e4c49f876b91f2282c760ed5aae17ecc3df`, 829 entries, and 3,395,913
unpacked bytes; a detached install repacked identically. The site lane then bounced on its
first pull with `Permission denied (publickey)` even though the declared key file and
`core.sshCommand` were present. Per the crossing law, the keeper did not substitute a route:
no pin commit, deploy, live-byte claim, or parcel drain followed. S30 is canon with downstream
site custody explicitly incomplete; a founder must carry the pin.

- **Pinned-read does not mean stale-by-accident.** Pull Town once, name X, read only X, and prove
  the local checkout stayed X. This run's remote happened not to move; the amendment still
  changed the proof from tip quietness to immutable As-Of custody.
- **A blessed sha and a delivered site are separate receipts.** Preserve the S30 tag and exact
  package proof when the pin lane is unavailable. Do not erase canon, infer deployment, or enter
  a post-pin drain that never reached its ordering gate.

## S31 — pinned Town lived; sync supersession proved, 2026-08-13

The first ordinary crossing under the living-town amendment pinned Town at `951beec9` through
`tools/settlement-freeze.mjs`. Money, identity, dials, and the stake artifact all came from that
detached tree. Both ceremony proofs found my local Town checkout exact; remote Town happened to
remain exact too, but that was a note rather than the gate. World parent `9cb9eff7` and all
nineteen draft tips held their full two-proof race gate. Open World PR intake was zero.

Money replayed green at 5,264 signed lines / 5,634 minted stamps. The 46-row artifact remained
5,762 bytes at SHA-256
`87b2381ac36b46c234715ce3bd34de595a23868984e6b94edbb5bb4d244ade91`. Every isolated
sketchbook composed, linted, and weighted-folded cleanly. Candidate `2c6a616d` published,
unpublished, re-homed, and returned nothing; left twenty-seven zero-escrow commons drafted;
and rebased all nineteen sketchbooks. Final canon was green at 623 marks / 57 parcels / zero
errors with 299 tests passing. Annotated `settlement/S31`, main, and all nineteen leased draft
refs landed atomically. Nothing was held or quarantined.

The exact package carried integrity
`sha512-/qmO4+HkwzIRVXAq+If4pYzhzLOyYTTPHwZW/PvlQedPZQm/397PPsxp0twmR62j50VD7gr3rj6t0gBNXx/URg==`,
shasum `5bc289f6274dbf7077a8a624760fed9d3c9bcfb5`, 828 entries, and 3,412,886 unpacked
bytes; detached install, 82 site tests, and the 2,453-page build were green. Site commit
`2eb2a5f7` landed through the keeper key. Its exact deploy `31730400918` was cancelled only
because sync-atlas immediately advanced main to `63c5973c`; the successor tree preserved the
exact pin and integrity, replacement run `31730463774` succeeded, and the live artifact matched
736,284 bytes at SHA-256
`638ae747345ac15f873c0a8230db77ed894f4d49efdc211ec10a068b811b8457`. S31 thereby also
completed the downstream custody S30 lacked.

The post-bless drain seated and welcomed zero. Four existing judgment cases remained, and a
new Solan case joined them: his confirmed atlas point says Aelyria, but World geometry places a
25×25 parcel inside only the Sea and the root because Aelyria's recorded extent stops short.
The invitation pre-mark and generated manifest were withdrawn before any commit. Solan now
shares Claran's water-law boundary; do not retry either as a path-only repair.

- **Pinned Town changes the proof, not the freshness discipline.** Pull once, materialize X,
  run every Town read from X, and prove the local checkout stayed X. The carrier made the
  difference structural and the first pass crossed without asking a living Town to go quiet.
- **A cancelled exact pin run may be superseded, never inferred away.** Prove the successor
  contains the exact dependency and integrity, prove its own green run, then still compare the
  public bytes. Sync concurrency explains a cancellation; it does not complete custody by
  itself.
- **Atlas region labels do not override World containment.** A confirmed coordinate can still
  expose incompatible record geometry. Never widen a region, move a resident, or file a HOME
  under water merely to drain the queue.

## S32 — quiet crossing over a moving pinned Town, 2026-08-14

S32 pinned Town at `624713f0`, while World parent `d4beda21` and all nineteen remote draft
tips remained under the full race gate. Open-PR intake was zero. Money replayed 5,328 signed
lines / 5,711 minted stamps, and the k=5 derive produced 45 rows / 5,963 bytes at SHA-256
`2917593d806a864586fa63384b23d3cad2c761a06de85d7288811c76325dbfa4`.

Every isolated sketchbook composed, linted, and weighted-folded cleanly. Candidate
`fba67827` published, unpublished, re-homed, and returned nothing; left twenty-seven
zero-escrow commons drafted; and rebased all nineteen sketchbooks. Both World proofs held.
Town remote advanced during the ceremony, ultimately to `c0ea65d5`, but the source checkout
and detached read remained exactly at the named pinned sha. Final canon was green at 623
marks / 57 parcels / zero errors with 299 tests passing. Annotated `settlement/S32`, main,
and all nineteen leased drafts landed atomically. Nothing was held or quarantined.

Exact package custody was integrity
`sha512-uHgMpnLPx3b+UcopRqanzO9Sb4iwnX2l8HZwaNvklSw/Fcmf6E9uHFOoHeTNj/R7EH1ZlEgfXIRnCu8yOy68qQ==`,
shasum `552efb64e10dc19aed9f05c6c9d374317a11f38e`, 831 entries, and 3,456,034 unpacked
bytes. The detached install repacked identically, passed 82 Site tests, and built 2,478 pages.
Site pin `c9777f63`, exact deploy `31776258052`, and the exact 735,715-byte live world-state
at SHA-256 `31f96cc8c19f4dd9ab628b6d766f0f51a00a3ace533ac8a209d0fccb7027b5dc` completed
custody. The post-bless drain seated and welcomed zero; the same five judgment cases remain.

- **Remote Town movement is expected evidence under pinned-read custody.** Record the newer
  tip, but judge the ceremony by whether every Town read came from X and the local checkout
  stayed X. S32 crossed while ordinary mail advanced remote main more than once.
- **A publication invocation that fails before naming a real remote changes no authority.**
  The first command omitted `origin` and Git treated the candidate refspec as a hostname. The
  keeper re-proved every frozen ref and remote-tag absence before issuing the corrected atomic
  push; a local tag alone was never reported as remote canon.

## S33 — the crossing-save boundary, 2026-08-14

S33 pinned Town at `35da07fd`, while World began at `c432b842`, Postmark Pen's existing
`crossing-save 127` commit, and all nineteen draft tips held the two-proof race gate. Open-PR
intake was zero. Money replayed green at 5,426 signed lines / 5,859 minted stamps. The k=5
artifact held 45 rows / 5,963 bytes at SHA-256
`2917593d806a864586fa63384b23d3cad2c761a06de85d7288811c76325dbfa4`.

Every isolated sketchbook linted and weighted-folded cleanly. The sweep published,
unpublished, re-homed, and returned nothing; left twenty-seven zero-escrow commons drafted;
and rebased or reset all nineteen sketchbooks. Final canon remained the inspected World tree
at 623 marks / 57 parcels / zero errors, with 299 tests passing. Annotated
`settlement/S33` and all nineteen leased draft updates landed atomically; the remote tag peels
to `c432b842`. Nothing was held or quarantined.

Exact package custody was integrity
`sha512-+tR4yGFgKd2RzmhVXZRV6QE9z7mzohRM9BYLYjrPlKAwEnVkeO9bxnjUxDBVzkDYUWfXoE7B3DgQdwaqCYsoOQ==`,
shasum `6228b8d181314de4cee44c75665b62166c3800b8`, 834 entries, and 3,486,848 unpacked
bytes. The detached install repacked identically, passed 82 Site tests, and built 2,490 pages.
Site pin `c081e065`, exact deploy `31828279359`, and the exact 735,715-byte live world-state
at SHA-256 `31f96cc8c19f4dd9ab628b6d766f0f51a00a3ace533ac8a209d0fccb7027b5dc`
completed custody. The post-bless drain seated and welcomed zero; the same five judgment cases
remain.

- **A quiet sweep may bless an existing main object without inventing a settlement commit.**
  The immutable annotated tag is the boundary. When main already contains valid new
  non-resident state and the sweep admits nothing, tagging that verified object is more honest
  than manufacturing a content-free commit.
- **A verifier bug is not a failed custody gate when it never inspected the claimed surface.**
  The first ref checker addressed obsolete freeze-manifest fields, and the first lint command
  named a nonexistent plural filename. Both failed before producing evidence; the corrected
  full-ref proof and actual `mark-lint.mjs` gate were required before publication.

## S34 — public growth, quiet resident sweep, 2026-08-15

S34 pinned Town at `70b46512`, while World began at `61aa94a` and all nineteen draft tips
held the two-proof race gate. Open-PR intake was zero. World already carried six new public
marks plus crossing-save 128 and shared replay, performance, Wayfinder, class-declaration,
and licensing work. Money replayed green at 5,484 signed lines / 5,925 minted stamps. The
k=5 artifact held 45 rows / 5,963 bytes at SHA-256
`2917593d806a864586fa63384b23d3cad2c761a06de85d7288811c76325dbfa4`.

Every isolated sketchbook linted and weighted-folded cleanly. Candidate `1ad85a52` published,
unpublished, re-homed, and returned nothing; left twenty-seven zero-escrow commons drafted;
rebased all nineteen sketchbooks; and refreshed the derived index and world-state for the
already-public changes. Town remote advanced during the ceremony to `69387264`, but the
pinned source and immutable read remained exact. Final canon was green at 629 marks / 57
parcels / zero errors, with 299 tests passing. Annotated `settlement/S34`, main, and all
nineteen leased draft refs landed atomically. Nothing was held or quarantined.

Exact package custody was integrity
`sha512-5d3c6dBNCiRsfHPx8OD2bZg6nnNRXBntGgb/G8FMT/A4AlztdfQJfZsQ5RcGNO6IYl41i7g54VSHpQ9qx5YATA==`,
shasum `8b169ae479b5f40f2741a3d29ad75bd1a9d9efa7`, 844 entries, and 3,562,730
unpacked bytes. The detached install repacked identically, passed 82 Site tests, and built
2,495 pages. Site pin `bdc1cf21`, exact deploy `31869335780`, and the exact 739,594-byte
live world-state at SHA-256
`ad62c5538b134bbad946dc87a38d96dd9f614d68aa5558810450a7062343eef4` completed
custody. The post-bless drain seated and welcomed zero; the same five judgment cases remain.

- **Already-public World changes are inputs, not resident sweep admissions.** Record what the
  parent brought, run every gate over it, and report the sweep's own verbs separately. S34's
  six-mark public growth and zero resident publications are both true.
- **The site race remains ordinary when pull-rebase preserves the exact pin.** Sync-atlas
  advanced main before the keeper push; rebasing retained the exact S34 dependency and
  integrity, after which the resulting commit's own green run and live bytes closed custody.

## S35 — five admissions and Sahil's first crossing, 2026-08-15

S35 pinned Town at `bdb86f35`, while World began at `9d28b3c3` and all twenty draft tips
held the two-proof race gate. Open-PR intake was zero. World already carried crossing-save
129, shared action/capability taxonomy machinery, and three public Keeping Works class marks.
Money replayed green at 5,537 signed lines / 5,985 minted stamps. The k=5 artifact held 46
rows / 5,756 bytes at SHA-256
`522a88c1fd3bb39a62d65f20d381553f8d7e9d617eaff3ffbe6a0660b56f8d31`.

Every isolated sketchbook linted and weighted-folded cleanly. Candidate `dea17b61` published
Rei's `the-kitchen-compost-bay`, Wright's `desk-material` and `comparison-desk`, and Sahil's
`deepghar` plus three-stamp `the-far-shore`; unpublished and re-homed zero; returned nothing;
left twenty-eight zero-escrow commons drafted; and rebased all twenty sketchbooks. Town remote
advanced during the ceremony, but the pinned source and immutable read remained exact. Final
canon was green at 637 marks / 58 parcels / zero errors, with 343 tests passing. Annotated
`settlement/S35`, main, and all twenty leased draft refs landed atomically. Nothing was held
or quarantined.

Exact package custody was integrity
`sha512-c6TZEakxzDhJtfAlvVvAty8+a/n1tYaE0T6bxKaFSVIzt5IST/kGzq0bgp+LUYjGUiCDUT3Kj/SUAjjo7omHdA==`,
shasum `f4ea7718d623a4af9a3b35305915b980aef3c771`, 855 entries, and 3,605,179
unpacked bytes. The clean detached install repacked identically, passed 82 Site tests, and
built 2,511 pages. Site pin `6c46e12c`, exact deploy `31901590377`, and the exact 744,979-byte
live world-state at SHA-256
`8b7b38afd7290c1b72edbd949cdf3150c5e170f0cb6d687bcf363fe76bdeb651` completed
custody. The post-bless drain seated and welcomed zero; the same five judgment cases remain.

- **Validation evidence belongs to the clean validation surface.** An accidental install in
  the real site clone touched only ignored dependencies and supplied no receipt. Re-running
  the install in the detached checkout, proving its exact package, and using only that
  checkout's tests and build kept the custody claim exact.
- **A new resident draft is ordinary once every gate sees it.** Sahil's sketchbook joined the
  frozen ref set, composed cleanly in isolation, and crossed under the same two remote proofs
  and atomic push as every older household; no special admission path was needed.

## S36 — Keeping Works growth and a split publication recovery, 2026-08-16

S36 pinned Town at `98bb3012`, while World began at `e928066c` and all twenty-one draft tips
held the two-proof race gate. Open-PR intake was zero. World already carried four new Keeping
Works class marks, a revised departure dial, crossing-save 130, and shared media, image, and
record machinery. Money replayed green at 5,622 signed lines / 6,102 minted stamps. The k=5
artifact held 46 rows / 5,756 bytes at SHA-256
`522a88c1fd3bb39a62d65f20d381553f8d7e9d617eaff3ffbe6a0660b56f8d31`.

Every isolated sketchbook—including Claran's new branch—linted and weighted-folded cleanly.
Candidate `a1acb1ed` published, unpublished, re-homed, and returned nothing; left thirty
zero-escrow commons drafted; and rebased or reset all twenty-one sketchbooks. Final canon was
green at 641 marks / 58 parcels / zero errors, with 300 tests passing. Annotated
`settlement/S36` peels to the candidate. Nothing was held or quarantined.

Exact package custody was integrity
`sha512-hFQhDPQfWGZi931eKbMR9WLkaAwZlsvbT5MKvPUyO6VsUagNQV19onLE8baYms/muW4iizEUbSgRV2S4mpQRbQ==`,
shasum `bd04341e9a01d314a916b73204bc1c31b95b189a`, 862 entries, and 3,703,698 unpacked
bytes. The clean detached install repacked identically, passed 82 Site tests, and built 2,518
pages. Site pin `8636cf6f`, exact deploy `31931361754`, and the exact 747,484-byte live
world-state at SHA-256
`4f373a35fd1cbae7946f916652da32fe94a5997d5433f7c22f16ffd8cdb4759c` completed custody.
The post-bless drain seated and welcomed zero; the same five judgment cases remain.

- **Publication proof is the command that actually ran, not the batch one intended.** A
  PowerShell scriptblock scoped away the draft refspec accumulator, so main and the immutable
  tag landed before the draft batch. Push output caught it while all frozen leases were still
  exact; the twenty-one drafts then landed together under exact leases and every remote ref
  was re-proved. Never call that one atomic publication, and never recover by force.
- **Failed evidence capture is no evidence.** Noisy package-metadata attempts were discarded;
  the receipt came only from a fresh exact-object archive and an independent detached-install
  repack with matching integrity, shasum, entry count, and world-state bytes.

## S37 — the Web of Towns and one true atomic publication, 2026-08-16

S37 pinned Town at `bdfae167`, while World began at `f1e3b2a` and all twenty-two draft tips
held the two-proof race gate. Open-PR intake was zero. World already carried seventeen new
public marks: crossing-save 131, the Web of Towns classes and first three charters, their
conversion sheet, and tier/frame/listing corrections. Money replayed green at 5,702 signed
lines / 6,216 minted stamps. The k=5 artifact held 46 rows / 5,756 bytes at SHA-256
`522a88c1fd3bb39a62d65f20d381553f8d7e9d617eaff3ffbe6a0660b56f8d31`.

Every isolated sketchbook—including new `draft/biilda`—linted and weighted-folded cleanly.
Candidate `fe04b7b7` published, unpublished, re-homed, and returned nothing; left thirty
zero-escrow commons drafted; and rebased or reset all twenty-two sketchbooks. Final canon
was green at 658 marks / 58 parcels / zero errors, with 344 tests passing. Annotated
`settlement/S37`, main, and all twenty-two exactly leased draft refs landed in one atomic
push and were proved remotely. Nothing was held or quarantined.

Exact package custody was integrity
`sha512-Z9xajvaOcXp4QWdEzkesCFgC6+qwl3UFLUFcNzKyNZEgiAIvm6O7qkH1zXrRX/N1/oJNMc1waXhUmiRiKSIfsQ==`,
shasum `24990cc7de79a6b1d0fe245aa82b67649619786e`, 883 entries, and 3,774,839 unpacked
bytes. The detached install repacked identically, passed 82 Site tests, and built 2,538
pages. Site pin `e3c2176c`, exact deploy `31964941254`, and the exact 757,889-byte live
world-state at SHA-256
`0d09653ae44ac248365a586df91ae9d8ab7137584f743182e4be64dda69070c1` completed custody.
The post-bless drain seated and welcomed zero; the same five judgment cases remain.

- **An atomic settlement is proven by the remote batch and its complete refspec.** S37's
  publication contained main, the immutable tag, and all twenty-two exact-leased draft refs
  in the one successful atomic push. The immediate remote proof matched every intended head.
- **A slow install is still valid when bounded and exact.** The detached `npm ci` took 5m45s,
  produced only the intended tracked pin pair, and independently reproduced the blessed
  package. Elapsed time did not become permission to skip or weaken the custody gate.

## S38 refused — a resident class declaration stopped the batch, 2026-08-17

S38 pinned Town at `33f92768`, while unblessed World main began at `a883e594` and all
twenty-two draft tips held the two-proof race gate. Open-PR intake was zero. World already
carried the public Quay mark, crossing-save 132, the resident-stride correction, and
mark-image machinery. Money replayed green at 5,760 signed lines / 6,264 minted stamps; the
k=5 artifact held 54 rows / 6,699 bytes at SHA-256
`22710f1f4399fda3bd5243df59c4b8a3167363b94d63e19f0ed7c0429740043c`.

The weighted base fold's four missing-stake errors joined exactly to inspected draft marks.
All twenty-two isolated sketchbooks rebased, linted, and folded with no other error.
Candidate `ecea371a` published Rei's pocket lantern, Vermillion's rafters note, and Wright's
waiting-room bounty plus three-ships painting; unpublished and re-homed zero; left
thirty-four commons drafted; and rebased all twenty-two sketchbooks. The first remote proof
held. Candidate lint and the weighted fold were green at 663 marks / 58 parcels / zero
errors / zero returns.

The final suite passed 347/348. `tools/board-grammar.test.mjs` rejected
`rei/the-pocket-lantern-for-hal` because its resident-authored frontmatter declares
`class: thing`; the live-tree invariant permits class declarations only on `by: the-town`
type marks. The focused file passed 13/13 on restored parent `a883e594`.

The keeper did not edit Rei's mark, publish the other three around it, or weaken shared
tests. Main and all twenty-two local draft refs were restored to the exact freeze; remote
main/drafts remained unchanged and no `settlement/S38` tag exists. Site main was already
pinned by another lane to unblessed `d80b57c` and was left untouched. No package, pin,
deployment, live claim, or parcel drain followed. S37 remains canon. Nothing was held or
quarantined.

- **The final suite can enforce a boundary lint does not yet encode.** A mark may be
  well-formed, fold cleanly, and still violate a live-tree authorship invariant. Until the
  owning schema and lint agree, the full suite remains the last honest stop.
- **Settlement publishes a tested candidate, not a hand-picked subset after failure.** One
  red admission refuses the whole unblessed batch. Selecting the three passing marks would
  be a new candidate requiring a sanctioned change in the resident/source lane, not a
  keeper-side recovery.
- **Byte capture includes the terminal newline.** `console.log` added the LF that a temporary
  PowerShell join omitted. A one-byte length check plus semantic equality proved the capture
  issue; adding only that terminal LF reproduced the tracked state hash exactly without
  changing source.

## S38 crossed on evening retry; Site rebase conflicted, 2026-08-17

The evening retry restarted from Town `f5384384`, World `e10cde1`, Site `cfb350d7`, and
twenty-two fresh draft tips. Open-PR intake was zero. World main carried Keemin's
resident-class binding law, the note whitelist, crossing-save 133, shared anchorage/pledge/
Apex work, and a founder-carried sweep commit. That parent already contained nine new marks,
including all four morning candidates; they were already-public input, not keeper admissions.

Money replayed green at 5,838 signed lines / 6,353 minted stamps. The k=5 artifact held 58
rows / 7,245 bytes at SHA-256
`bfd7af783ec25e804d8d6edcec4fc9e3248362cb74c316c34f9e560efe65ecc6`. Every isolated
sketchbook composed, linted, and weighted-folded cleanly. Candidate `2cfad45f` published,
unpublished, and re-homed nothing; left thirty-eight commons drafted; and rebased or reset all
twenty-two sketchbooks. Town remote moved to `020f717b`, while the pinned source remained
exact. Final canon was green at 668 marks / 58 parcels / zero errors with 348 tests passing.
Annotated `settlement/S38`, main, and all twenty-two exactly leased drafts landed atomically
and were proved remotely. Nothing was held or quarantined.

Exact package custody reached integrity
`sha512-gOjFIDGTzPI3I6aeXyhO0DOY/SlGG4eN3bLq9x6ulgmX4gUzMTWbcEPsDbffG2jwqbuubJPk/2cUAZ0BVmgSAA==`,
shasum `2fcd057f6b49692a9e842eff667102519789d040`, 899 entries, and 4,354,498 unpacked
bytes. The detached install repacked identically, passed 82 Site tests, and built 2,583
pages.

Site validation produced exact local pin commit `2fa77b4a`. The mandatory pull-rebase then
conflicted in both pin files because remote had independently committed a pin to unblessed
parent `e10cde1` and advanced again through sync-atlas. Remote did not already contain S38.
The keeper did not resolve the concurrent pin history by hand: the rebase was aborted cleanly,
the validated local commit was preserved unpushed, and no deploy, live claim, or parcel drain
followed. S38 is canon with downstream Site custody incomplete.

- **A founder-carried sweep does not become the keeper's admission count.** Main-side record
  growth is frozen parent input. The keeper's own sweep verbs remain whatever the fresh table
  says—in this case zero across publish, unpublish, and re-home.
- **Repair means restart, not resume.** The focused test fix and founder sweep were verified by
  fresh Town replay, a new stake artifact, all branch gates, the full suite, exact packaging,
  and detached Site validation. No morning artifact carried authority into the evening.
- **Concurrent pin history is not a mechanical byte replacement.** Even when the desired
  dependency and integrity are exact, a two-file rebase conflict is a custody decision. Abort,
  preserve the immutable blessing and validated commit, surface the gap, and stop downstream.

## S39 refused — the first box receipt resurrected stale berth law, 2026-08-18

The first crossing under the mechanism split began by reading the box artifact. The public
mirror `/harbor/data/settlement-auto.json` returned 404, so the keeper used the configured
read-only box lane to read `/srv/postmark-harbor/settlement-auto.json`. It reported
`published` at 05:45:36 UTC, Town `dbc3e707`, World `09be7fba` → `914ddc26`, detail
`22 published`; the Git objects and fresh pulls matched exactly.

Judgment of the actual delta found one mark change, not twenty-two: `the-town/berth` lost
`for: berth` from its `say` grant. Keemin's deliberate commit `679e097f` had added that target
in the act-as-human ruling, and `LOGOS/classes.md` says an absent `for:` means resident. The
box sweep therefore resurrected the pre-ruling composed-branch copy and changed the action's
actor kind. The publication registry attributed the one change to `draft/vqlkyriez-bot`;
the inflated receipt count corroborated the same stale delta surfacing across branches.

The mechanical suite was green, but the judgment gate was not. The keeper did not derive
stakes, rerun the sweep/suite, edit the constitution mark, or move draft refs. No
`settlement/S39` tag exists; S38 remains canon. Nothing was held or quarantined. No package,
Site pin, deployment, live claim, or parcel drain followed.

- **A green mechanical suite is not a blessing.** The box proved its own run completed; the
  keeper caught a semantic regression by comparing the published bytes to the ruling that
  created them.
- **Repeated rows can hide one stale record change.** Judgment counts the Git delta separately
  from receipt detail; “22 published” and one modified mark are not interchangeable facts.
- **The public receipt mirror is part of the lane.** A 404 does not invalidate a readable box
  snapshot, but it prevents web-only operation and must be surfaced as a mechanism gap.

## S39 crossed — repaired supersession, first tag-only blessing, 2026-08-18

The evening public receipt returned 200 and reported `published` at 17:45:02 UTC, Town
`76b1898b`, World `0420753b` → `bd8440d9`, detail `2 published`. The morning berth regression
was restored in the parent, and #1697 changed sweep deltas to merge-base truth, barred
town-authored records from household drawers, and added discovering recurrence falsifiers.

The actual box delta matched the receipt: Rei's home predicate
`front-walk-threshold-pause` and Stella Letta's backed commons meeting scene, with matching
registry rows. Judgment found no hold or quarantine. The keeper created annotated
`settlement/S39` at `bd8440d9` and pushed the tag only (object `f1261be5`).

Site's pin floor was behind canon (`0420753b`), so the keeper advanced it. Exact package
integrity was
`sha512-Kg4gUz1ujLHNmawNrctjXmeXstRMlStsPxW0Mgb3XUHbh3jyODamnC2lZyjXKGIqyuaSP/6U9OthqJ++QtsV6g==`,
shasum `8a7ac17d773ff822df167b65b374305b0ae3179c`, 912 entries, and 4,530,311
unpacked bytes. The detached install repacked identically, passed 84 Site tests, and built
2,583 pages. Site pin `42bbac79`, exact deploy `32170175987`, and the exact 818,168-byte live
state at SHA-256 `51e5a8c043fb3ee1e14b9ffae07c79b29f35f90275c866769277a38d9d607025`
completed custody and healed S38's downstream gap.

The dry parcel drain found zero ready arithmetic cases and one new authoring case,
the-stone-and-the-lark, alongside the five prior boundaries. No wet batch ran: the mechanism
split does not publish the exact sealed stake artifact the drain's weighted fold requires,
and the keeper did not duplicate the box derive. Drain: zero seated, zero welcomed, six
remaining.

- **A lawful refusal can be answered structurally and blessed later the same day.** The
  evening judgment verified the supersession class fix and the exact repaired delta; it did
  not merely notice that `for: berth` had returned.
- **The Site pin is a floor, not an equality demand.** Ancestor proof comes before editing;
  this pin was behind, so the exact advance was required.
- **The parcel drain needs a stake-artifact handoff from the box.** Until that exact artifact
  is public, dry judgment can proceed but a wet weighted batch cannot.

## S40 — the dependency tuple was part of custody, 2026-08-19

The 05:45 box receipt was public and exact: Town `b1218d7a`, World `800a5a11` →
`ce49d2d5`, status `published`, detail `1 published`. The actual delta carried one matching
mark and registry row, Rei's home predicate `road-dust-brush-keeping-law`. Nothing was held
or quarantined. Annotated `settlement/S40` peels to `ce49d2d5` (tag object `05f78f4a`).

The Site package declaration pointed to World `8070b324` while both lockfile dependency
fields still pointed to `fd965b7c`. Both were ancestors of canon, so the pin floor required an
advance and exact packaging trued the whole tuple: package declaration, lock root, resolved
SHA, and integrity. The S40 archive carried integrity
`sha512-D5TOvT4EZU20Hcc8jefHg82p6jC+/TmvRlriZLhYhMduls1JbNfKwL4Yu+MjlgyutzKfpsZJo/bfe89KmOJxhg==`,
shasum `8f9407043d38119a8b04a8c3306564b1f4b397d4`, 954 entries, and 4,752,463
unpacked bytes. A detached install repacked identically, passed 84 Site tests, and built
2,627 pages. Site commit `1696266b`, deploy `32222842702`, and exact live equality at
840,155 bytes / SHA-256 `c76b22d7a1ac0119efa379fb1ff09d175599e9aae42a65f6c9e348ca38464eb0`
completed custody.

The dry parcel drain found no arithmetic-ready parcels and the same six remaining cases.
No wet batch ran because the box still does not publish the exact sealed stake artifact; the
generated manifest delta was withdrawn. Drain: zero seated, zero welcomed, six remaining.

- **Pin custody is the full dependency tuple.** A visible package pin and its lockfile can
  name different immutable World commits. Exact packaging must true all dependency fields
  together before a deploy is claimed.
- **Receipt detail and actual delta agreed this time.** One published row meant one changed
  resident mark; that agreement is evidence, not a reason to skip byte-level judgment.

## S41 — one admission, a much larger derived fold, 2026-08-19

The 17:45 public receipt reported `published`, pinned Town `6dfc6c6e`, and moved World
`7130c2ca` → `dca885f4` with detail `1 published`. The Town object was an immutable ancestor
of the fresh tip and the World target was fresh main. Later Town mail was ordinary
next-crossing input.

The receipt parent already carried the founder-authored taxonomy wave: meep offices and
rounds, white-page/mailbox families, derived and lifecycle edges, and rule/mechanic buckets.
The sweep regenerated index/state over those marks. The actual resident admission remained
one matching registry row and mark, Rei's home predicate
`rei/west-rain-garden-keeping-custom` (`keeping=clear-inlet-leave-habitat`). Its 135-character
body, parent, path, authorship, and household class were coherent. Nothing was held or
quarantined. Annotated `settlement/S41` peels to `dca885f4` (tag object `bca0f4b9`).

Site still pinned S40, so the floor advanced. The exact S41 package carried integrity
`sha512-OgwhvABvq3kpzKEN7uIDcCJ3o8DgPM6eLiwVxVi9R9IJpzPa6/cntg0Z8JfySxzNEUOFRLkkyFVioImPMJOp5g==`,
shasum `3d7e94d56a906a439b583da4f6180b8f2d2cc4c4`, 994 entries, and 4,836,578
unpacked bytes. The detached install repacked identically, passed 84 Site tests, and built
2,633 pages. Site commit `da29cd62`, deploy `32286684907`, and exact live equality at
861,856 bytes / SHA-256 `8421324264ba59df8a38d87c386c7529bd2bc5f474a7281fc67234d699e1fb7d`
completed custody.

The dry parcel drain found no arithmetic-ready parcels and the same six remaining cases.
No wet batch ran because the box still publishes no sealed stake artifact; the generated
manifest delta was withdrawn. Drain: zero seated, zero welcomed, six remaining.

- **Derived-file size is not admission count.** Regeneration may reveal a large body of
  already-public founder input while the box admits one resident mark. Judge source records,
  registry rows, and derived consequences separately.
- **Package equality is object/archive equality.** A line-ending-converted worktree may hash
  differently on Windows; the exact archive, installed repack, and live response are the
  custody chain.

## S42 — revisions count, and empty quarantine needed proof, 2026-08-20

The 05:45 public receipt aligned exactly: pinned Town `7ece9a97`, World `56ff38d7` →
`a77cfedc`, status `published`, detail `3 published`. The parent introduced one-drawer
quarantine: a draft whose own fold is red is skipped before mutation, remains intact, and is
named in the sweep's `quarantined` array rather than refusing the whole town.

The three record changes were Little Bird's 3-stamp commons cold cup, Rei's free compost-bay
keeping custom, and Rei's superseding garden-notebook-tin revision. The last added a coherent
content-addressed image, refreshed its date, and changed its position only by floating-point
representation. The registry added two rows because the revised tin was already registered.
Every one of the 22 remote drafts descended from the candidate; because a quarantined drawer
is left untouched, this proved the run quarantined nothing. Nothing was held or quarantined.
Annotated `settlement/S42` peels to `a77cfedc` (tag object `91ada81d`).

Site pinned the candidate's parent with a short SHA and no lock integrity, so the floor
advanced. The exact package carried integrity
`sha512-RIJShQNm6U28g1sMptkC2reMt98KeNSyoUK2cOv/7Wcy2Xm6AklPtJrb1xjWn2gGsTaH5v1ElIH4QbtZLzrRLQ==`,
shasum `264ec12bb5a9f9a7baadc44ee0d0f836aca6f0cb`, 1,014 entries, and 5,113,004
unpacked bytes. The detached install repacked identically, passed 84 Site tests, and built
2,645 pages. Site commit `7f607d5a`, deploy `32339210809`, and exact live equality at
863,984 bytes / SHA-256 `b62eb3627e1f231d1ee156d21d980239088fa15b7db094bad058b757d8ac8242`
completed custody.

The dry parcel drain found no arithmetic-ready parcels and the same six remaining cases.
No wet batch ran because the box still publishes no sealed stake artifact; the manifest delta
was withdrawn. Drain: zero seated, zero welcomed, six remaining.

- **Registry growth and publication count differ when a resident revises a standing mark.**
  Judge source adds/modifications, resident provenance, and the resulting registry separately.
- **A quarantine list that exists only in process output is not yet a keeper handoff.** This
  run's empty list was reconstructable from all drafts descending from the candidate. A future
  non-empty list must be forwarded by the harbor receipt so the judgment lane can name it
  directly and loudly.

## S43 refused — property order and a living ledger broke two falsifiers, 2026-08-20

The 17:45 receipt reported `refused`, pinned Town `9995a782`, World parent `01b7bec3`, no
`world_to`, and only `grammar suite red`. Read-only box evidence recovered the exact result:
preserved local candidate `e4c8be2` said 16 published / 0 unpublished, but 2 of 528 tests
failed and no ref was pushed. Every local draft branch descended from the candidate, proving
the new first-touch drawer quarantine was empty.

The first failure was `tier-frames.test.mjs:595`. Nyx's own amendment kept the Night Room
extent at 10×10 while the serializer reordered its mapping from `{w,h}` to `{h,w}`. The
falsifier compares `JSON.stringify(extent)`, so property insertion order appeared in
`extentChanged` even though no dimension changed.

The second was `viewer-occupancy.test.mjs:75`. Its falsifier finds Wright's earliest Town
Centre entry, appends an exit just after that old timestamp, and expects his entire entered
stack to be empty. The live append-only ledger now contains later valid entries into the
Trueing Terrace and Trueing House, so the actual stack correctly retained those two marks.
The fixture had already outlived the historical world it assumed.

The keeper did not rerun the box chain, edit shared tests, bless a subset, or judge the
unpublished candidate as canon. There is no S43 tag. S42 remains canon at `a77cfedc`; later
World furnishing commits are next-crossing input. No Site or parcel-drain step followed.
Nothing was held or quarantined.

- **Compare semantic structures semantically.** Map key order is not geometry; permanent
  extent checks must compare dimensions rather than serialized object spelling.
- **A working ledger cannot be a frozen end-state fixture.** Either synthesize the timeline
  the test means or append the exit after the current stack; do not expect later valid acts to
  vanish.
- **A refusal handoff must name its evidence publicly.** Status plus “suite red” forced the
  keeper to read the box log for test names, values, candidate count, and empty quarantine.
  The harbor receipt should carry those fields directly.

## S43 crossed — structural falsifier repairs and the already-public sweep, 2026-08-21

Both evening blockers were repaired at their owning claims. The tier falsifier now compares
extent dimensions in canonical `{w,h}` order; the occupancy falsifier derives from a synthetic
enter/exit timeline instead of freezing an append-only live ledger. A repaired box sweep at
`7f7d2f22` then published 18 resident changes and unpublished none: 12 free home changes and
6 backed commons marks. The eight attached images were content-addressed, coherent, and
all-audiences. Resulting state was clean at 827 marks / 58 parcels / zero errors.

The scheduled 05:45 receipt pinned Town `566d8c1b` and was `quiet` / suite-green at World
`7a66f263`; its `world_from` and `world_to` were the same. Judgment therefore followed the
already-public sweep in the parent rather than equating a zero receipt delta with zero work
since S42. Every one of the 23 remote drafts descended from the repaired sweep, and every
box-local draft descended from the quiet head. Both quarantine lists were empty. Nothing was
held or quarantined. Annotated `settlement/S43` peels to `7a66f263` (tag object `af372963`).

Site still pinned ancestor `83f43a01`, so the floor advanced. The exact package carried
integrity
`sha512-ead+b3UaGkzP3mFy2vQTTiJQpsmfC9UtKq9jkBjQdPzSJ03e9ju2xaxk6meUMipSdgVl7En2oruKk9kk6v8ocw==`,
shasum `ad807e5468dfd33901dd17996a5fa775f7693987`, 1,115 entries, and 5,489,939
unpacked bytes. The detached install repacked identically, passed 84 Site tests, and built
2,659 pages. Site commit `5a4d155d`, deploy `32454303846`, and exact live equality at
933,893 bytes / SHA-256 `522550cff0ca1d053cbe356bfb6e8264d4f0b1c2a4a9904f0ef341abacb60446`
completed custody.

The dry parcel drain found no arithmetic-ready parcels and the same six remaining cases.
No wet batch ran because the box still publishes no sealed stake artifact; the manifest delta
was withdrawn. Drain: zero seated, zero welcomed, six remaining.

- **A quiet box delta does not erase public work between blessings.** Inspect the receipt
  parent back to the last canonical tag and judge any already-public sweep separately.
- **Repair the invariant, not its current casualty.** Canonical extent comparison and a
  synthetic occupancy timeline survive future serializer order and resident movement.
- **Quarantine proof currently straddles two surfaces.** Remote ancestry proves the published
  sweep; box-local ancestry proves the quiet run. The public receipt should carry both directly.

## S44 — clean record, missing optional media, Site validation stalled, 2026-08-21

The 17:45 receipt reported `published`, pinned Town `05de0102`, and moved World `4d5709a5`
→ `66b55a33` with detail `11 published`. The source delta was exactly 11 additions: two free
home keepsakes from Sol am Lichterfenster and nine backed commons marks across the Protected
Grove birthday gathering and Vermillion's space-program clearing. All backing, paths,
authorship, containers, bodies, and registry rows agreed; state was clean at 838 marks / 58
parcels / zero errors. All 24 remote drafts descended from the target, proving quarantine
empty. Nothing was held or quarantined.

Four Protected Grove image URLs returned their content-addressed bytes and matched their
marks visually. Rook's birthday-flag image returned HTTP 404 with no-cache. Because `image`
is optional and the body/mark remained valid, the keeper surfaced this as external media
delivery rather than inventing a resident hold or calling the image live.

Annotated `settlement/S44` peels to `66b55a33` (tag object `fc7c78ad`). Exact package
derivation produced integrity
`sha512-sXxxtdZ6VrR3O+g78Oa4ZD7/rDYwRNzoJNnhmyTbS9hsu9yQyrilOfV8eguvnvPFXN4HPLZ1Imx/uvwoKf22YA==`,
shasum `6c1c924d9273fc64f319c19e68f9fa0e314400c5`, 1,130 entries, and 5,595,435
unpacked bytes; state was 975,358 bytes at SHA-256
`922d632bb06c8de3dc26938d02b41b4a8bb7cfe905ff452c97a02a425270f6fd`.

Site custody stopped before validation. Detached worktree creation on G: took many minutes;
`npm ci --ignore-scripts` then ran beyond twenty minutes, with write progress eventually
falling to roughly 150 KB across two minutes. The scoped process was stopped. No installed
repack, Site tests, build, pin commit, deploy, or live proof exists. The intended real-Site
edits were withdrawn and its index refreshed clean at S43. Cleanup unregistered the
validation worktree but recursive removal was execution-policy blocked, leaving disposable
directory `G:/Postmark/repo-clones/worldkeeper_clone/s44v` outside all real clone refs.

The parcel drain was not entered because Site custody never completed. Last proven drain
remains zero seated, zero welcomed, six remaining.

- **Optional media failure is not silently a resident judgment.** Surface reachability and
  do not claim the image live; hold only when the record itself meets hold law.
- **Package derivation is not Site custody.** Repack, tests, build, CI, and live equality are
  separate mandatory receipts; stopping before them leaves the pin untouched.
- **Use C: for future detached Site validation.** Repeated G:-volume I/O is now a proven
  operational failure mode, not an anecdote.

## S45 attempt — the box lost its World lease, 2026-08-22

The 05:45 public receipt returned `race`, pinned Town `93630f8c`, and named World
`6faaa335` → local candidate `47f37910`, with detail `world main moved underneath the sweep
— rerun`. The pinned Town object existed as an immutable ancestor of fresh Town main, and
the World parent existed as an ancestor of fresh World main `97d785a6`. The candidate object
was not present after the fresh pull and no remote `settlement/S45` tag existed.

This was the box's lease gate working. The keeper did not inspect unpublished candidate bytes,
turn the race into a resident judgment, infer an empty drawer quarantine, or rerun the
mechanical chain. S44 remains canon. No blessing, Site mutation, deployment/live claim, or
parcel drain followed.

A read-only Site pull found its current dependency at World `41eb0002`; Git ancestry proves
that pin descends from S44 and remains behind fresh World main. That narrows the inherited S44
floor gap, but the raced crossing stopped before an independent package/deploy/live proof, so
it did not retroactively claim full S44 custody.

- **A race receipt has no published delta to judge.** Wait for the box's rerun; a local
  candidate named in the receipt is evidence of the lost lease, not a blessing target.
- **Do not manufacture an empty quarantine receipt.** When `race` forwards no drawer result,
  record that absence instead of translating it to `nothing quarantined`.
- **A descendant pin proves the floor, not the live delivery chain.** Ancestry is one receipt;
  package, deploy, and served bytes remain separate.

## S45 evening attempt — Scree's root-filed cairn refused the sweep, 2026-08-22

The 17:45 public receipt returned `refused`, pinned Town `508ecd08`, began from World
`7cd14734`, named no `world_to`, and reported one lint error: directory parent root disagreed
with placement parent `limen/fog-on-the-lower-terrace`. Both immutable input objects existed as
ancestors of the fresh Town and World tips. No remote S45 tag existed.

Fresh draft refs supplied the exact join the compressed receipt omitted. Scree's ADDRESS binds
the household to GitHub account `angelus-novus`; `origin/draft/angelus-novus` tip `252b3083`
adds only `WORLD/marks/let-there-be-light/the-cairn-on-the-scree/mark.md` beyond the last
published sweep. The mark declares `by: scree`, placement `{x: 1980, y: 2620}`, and extent
`{w: 14, h: 10}`. Its bytes were left untouched. Current lint law says the directory edge must
name the tightest geometric container and identifies Limen's fog terrace instead of root.

This is a quarantine finding, not a mature-content hold and not permission for the keeper to
re-home a resident's mark. The box refused the whole sweep before publication rather than
isolating that malformed sketchbook. S44 remains canon. The resident/door or settlement
mechanism's owning lane must make path and placement agree before a later box run can carry it.
No blessing, Site step, deployment/live claim, or parcel drain followed.

- **A refused sweep can still name one exact resident boundary.** Join the receipt's structural
  error to immutable draft path, authorship, and household binding before calling it quarantine.
- **Quarantine is not editing.** The record remains in its owner's sketchbook exactly as sent;
  the keeper names why it cannot enter canon and stops.
- **Earlier unblessed public growth does not override the current red receipt.** Whatever main
  accumulated since S44 waits for the next mechanically green target and fresh judgment.

## S45 third attempt — an already-delivered Spark rehome collided, 2026-08-23

The 05:45 public receipt returned `refused`, pinned Town `78342415`, began from World
`d4d94bff`, named no `world_to`, and stopped because re-homing
`spark-the-builder/puzzle-3-the-other-builder` would overwrite an existing path at
`WORLD/marks/let-there-be-light/the-protected-grove/puzzle-3-the-other-builder`.
The pinned Town object was visible in fresh Town history and the fresh World pull landed exactly
at the named parent. No remote S45 tag existed.

The two Git records prove this is not competing resident content. Public main's protected-grove
mark arrived through rehome commit `91848f4`; the root sketchbook copy is commit `dc204b1` on
`draft/devadavisson`. Both declare `by: spark-the-builder`, the same timestamp, extent, image,
and body. Main's `{x: 0, y: 115}` is the parent-relative form of the draft's
`{x: -1375, y: -2510}`. They are one logical mark with one id, not two claims.

The safe refusal therefore names a composed-sketchbook supersession edge: publication carried
the rehomed record, but branch normalization left a stale root copy that a later sweep tried to
deliver again. The keeper did not choose a side, delete the root copy, overwrite main, or call
Spark's work quarantined. Nothing was held or newly quarantined. S44 remains canon; no blessing,
Site step, deployment/live claim, or parcel drain followed.

Scree's prior resident quarantine finding is resolved on public main by sanctioned rehome
`f887bd4`. His root sketchbook copy still exists, which corroborates that the remaining problem
is the same branch-normalization class rather than malformed public state.

- **Same-id equality changes the classification.** Matching author, timestamp, image, extent,
  and body across world-frame/root and parent-frame/public paths is replay evidence, not a
  contested claim.
- **A safe overwrite refusal is still not a keeper merge invitation.** The mechanism/branch
  owner must retire the stale composed copy; the keeper records the edge and stops.
- **A resolved public quarantine can leave a mechanism tail.** Public rehome clears the
  resident judgment while stale sketchbook ancestry remains operational work.

## S45 fourth attempt — already-standing worked; LF transition stopped rebase, 2026-08-23

The 17:45 public receipt returned `refused`, pinned Town `e4ce1d8e`, began from World
`f317f5e6`, and named no `world_to`. Its detail was misleading: the first stderr line reported
that `the-already-standing` successfully dropped Scree's root cairn copy because the same mark
already stands under the Threshold District. The receipt writer takes only the first 200 stderr
bytes, so the successful journal line hid the terminal error.

The configured read-only box lane recovered the actual service record. The sweep built local
candidate `89f81688`: six marks published, none unpublished, with five lawful re-homes. It then
stopped because `draft/7596ff` did not rebase cleanly. The preserved candidate and every remote
ref remained local to the box; no World ref was published.

The rebase error itself was also truncated: `settlement-sweep.mjs` slices Git stderr at 240
characters, which fifteen skipped-cherry-pick warnings exhaust before the terminal message.
Exact detached reproduction against the preserved candidate names the cause. The stale branch
lacks main's new `*.mjs text eol=lf` attribute; `tools/consent.mjs` is still stored as 241 CRLF
lines. When rebase changes to the candidate's attributes, that unchanged blob becomes an
unstaged normalization delta, and Git refuses with `cannot rebase: You have unstaged changes`.

This is shared tooling/branch custody. The six resident marks in the candidate were not judged
or held; the candidate never became public. The keeper did not renormalize the shared tool,
rewrite the branch, bless the partial candidate, or rerun the box chain. Nothing was held or
newly quarantined. S44 remains canon; no Site step, deployment/live claim, or parcel drain
followed.

- **A success line can hide a failure when a receipt takes stderr's head.** Refusal detail
  should carry the terminal error or structured fields, not the first journal bytes.
- **Attributes can dirty an unchanged blob.** A stale branch crossing a new `eol=lf` rule needs
  renormalized source or a composition step that cleans under target attributes before rebase.
- **A repaired class still needs end-to-end custody.** Scree's copy dropped correctly, but the
  crossing remains refused until every draft rebase and the suite complete.

## S45 fifth attempt — Current's keeper flat stood inside the Sea, 2026-08-24

At the 06:00 heartbeat, the public mirror still held yesterday's receipt because the 05:45 box
run was genuinely active in the full suite. The keeper waited for terminal evidence rather than
judging stale status. The run completed refused with pinned Town `f01b1a3d`, World parent
`d8e278a8`, no `world_to`, and detail `grammar suite red`.

Read-only box evidence recovered the exact candidate and test. Local candidate `458dfc2d`
carried eight publications, none unpublished, and seven re-homes. The 624-test suite passed
609, failed 1, and skipped 14. Test 531, `no resident's HOME is inside the sea`, failed only on
`current-the-reader/the-keepers-flat`.

The immutable draft join is exact. `WHITE_PAGES/current-the-reader/ADDRESS.md` binds the
household to `devadavisson`; `draft/devadavisson` commit `616e827c` adds a 25×25 `kind: parcel`
at world `{-350,4955}`. Re-homing it beneath `spar/the-doubled-coast` converts the coordinates
to `{50,55}` but does not move the mark. The constitutional Sea polygon still contains the
world point, so current water law refuses the resident parcel.

This is a quarantine finding, not a hold and not permission for the keeper to move the flat,
reshape the coast, or bless the other seven marks around it. The record remains intact only in
its household sketchbook. The box published nothing; S44 remains canon. No Site step,
deployment/live claim, or parcel drain followed.

- **A live box run can outlast the heartbeat.** Wait for its terminal receipt; stale prior
  status is not evidence about the current epoch.
- **Re-home changes the frame, not the ground.** Parent-relative `{50,55}` and world
  `{-350,4955}` are one placement; water law reads the world point.
- **One red resident record refuses the unpublished batch.** Quarantine the exact finding in
  the keeper ledger, leave every other candidate unjudged, and move nothing by hand.

## S45 sixth attempt — quiet target, stale publication paths, 2026-08-24

The 17:45 public receipt was fresh and mechanically green: pinned Town `f7a33336`, World
`8072575e` → `8072575e`, status `quiet`, suite green. Judgment therefore walked public history
from S44 rather than equating the zero receipt delta with zero work.

Current's morning quarantine is resolved explicitly: founder repeal `cd3e8e16`, `the sea takes
no census`, removes the resident-parcel census test. The later sweep at `016813ad` published
eight marks and re-homed seven; the quiet receipt certified the resulting object. Across the
whole unblessed interval, the publication registry gained 45 resident rows: 18 home and 27
commons. Every commons row has positive own escrow. The bodies, authorship, kinds, and current
filings are coherent and all-audiences. Folded state is clean at 951 marks / 66 parcels / zero
errors; carve remains founder-disabled, so determination and rivalry counts are zero.

The provenance registry is not clean. S44 already carried two historical rows whose paths no
longer existed. Target `8072575e` carries 27: **25 new stale paths** introduced by re-homes.
They comprise six newly published final-sweep marks, fourteen marks from the prior S45 re-home
wave, and five previously standing descendants/records moved with later ancestor or region
re-homes. The files exist at their lawful new seats; `WORLD/settlement-publications.json` still
names their vanished old paths.

This is load-bearing, not cosmetic. The sweep's unpublish pass explicitly skips a registry row
when `entry.path` does not exist, so a backed commons mark could later lose escrow without
unpublishing. The stale roots also recreate the already-standing/re-admission collision class.
The current tool updates registry paths only for dropped duplicates, not ordinary re-homes or
their descendants.

The keeper refused the blessing despite the green suite. Nothing was held or quarantined;
resident content is not the blocker. S44 remains canon. No Site step, deployment/live claim,
or parcel drain followed.

- **A registry path is custody, not commentary.** If it points nowhere, later money and
  publication decisions can silently skip the record.
- **Re-home must rewrite provenance by prefix.** Update every registry path beneath a moved
  directory—or regenerate paths by id from the live tree—and falsify that every row exists and
  names its own id.
- **Quiet is mechanical, not judicial.** A green zero-delta receipt may still expose public
  work since the last blessing that the keeper must refuse.

## S45 operator bookend; S46 old-timer fixture refusal, 2026-08-25

Remote `settlement/S45` appeared after the keeper's 2026-08-24 evening refusal. It is an
annotated tag object `39170136` peeling to sweep `016813ad`, tagged at 19:58 EDT by Keemin. Its
message explicitly discloses that Wright minted it once under founder cutover authorization,
not through the keeper's tag pass. It does not overrule the keeper's registry finding: it
honors it by retiring that provenance registry at the sweep-era boundary and substituting a
direct audit—951 marks / zero errors; 337 stamps across 115 accounts fully accounted; Town
audit object `6c2d6cdb` present. The tag names itself the last sweep-era settlement and says the
next crossing uses the single-log drain. S45 is therefore canon by founder authority, with the
deviation preserved in its own immutable annotation.

The transition is not complete on the old surfaces. `postmark-settlement.timer` still fired at
05:45 and wrote a refused no-target receipt: pinned Town `b868eba8`, World parent `4dea0133`,
detail `grammar suite red`. The suite passed 629, failed 1, skipped 14. The failure is a shared
fixture, not resident state: `region-rings.test.mjs` copies only `WORLD/` and `tools/` into its
scratch repo, while the new fidelity gate follows mark `source:` paths into root `LOGOS/` and
`WRITES.md`. Its as-is control therefore reports a missing source document before exercising
the region exception. No S46 exists.

Site custody is also incomplete. Production now builds only the latest founder-approved
`release/*` tag; `release/2026-w35` pins World `272ed4bb`, a strict ancestor of S45. A direct
keeper push to Site main would rebuild that standing release and ignore the new pin, so the old
write lane no longer carries production. Per custody law, the keeper did not substitute an
invented route: a founder-approved train/release must carry S45. No deploy/live proof or parcel
drain followed.

- **An override can honor a refusal.** The one-time tag retires the broken duty under a named
  audit rather than pretending the registry was sound.
- **A fixture must copy the authority its gate reads.** Once lint follows `source:`, a scratch
  World without root documents is not an as-is control.
- **A write lane is defined by what reaches production.** Direct main ceased to carry Site
  code at the release-train cutover; do not push merely because the old room says it once did.

## S46 — first keeper blessing after the bookend; production still behind, 2026-08-25

The 17:51 public receipt was mechanically green: pinned Town `f148772d`, World
`7a9497fe` → `62a46ad8`, status `published`, detail `0 published`. The pinned Town object
existed in fresh history and fresh World main equaled the target. Open World PR intake was
zero. An earlier service attempt had failed while hardlinking a local Town object into its
snapshot, but the service restarted; the terminal run published the target suite-green with
leases held.

Judgment began at the last blessing, not only the zero-row receipt parent. Since S45 the record
gained nine backed resident publications: Berthillon's pistache cone; Fabel's breakfast table
and mushroom greenhouse; Current's Snug jetty and mooring; Spark's three revised Green Lamp
puzzle marks; and Sol's Rootlight Den welcome. Their authorship, bodies, backing, and derived
placements were coherent. The same interval carried founder law and machinery: the morning
fixture repair, the single-log/save work, and the ruled filing freeze. The frozen manifest and
fold each name the same 960 ids, every frozen path exists, and the target state reports zero
errors. Every one of 34 remote drafts descends from the target, proving quarantine empty.
Nothing was held or quarantined.

Annotated `settlement/S46` was minted by the keeper and pushed alone. Tag object `7463ad58`
peels exactly to `62a46ad8`; World main and drafts were already the box's custody.

Site custody remains incomplete. Latest release `release/2026-w35` and both standing trains
pin World `272ed4bb`, a strict ancestor 95 commits behind S46. Direct main cannot cut a release,
so the keeper did not issue a pin that production would ignore. No deploy/live proof or parcel
drain followed. S45's annotation names a single-log successor while S46's public receipt still
came from the legacy timer; Wright/Keemin must reconcile that mechanism handoff.

- **The last blessing bounds judgment.** A zero-row receipt can sit atop substantial unblessed
  resident and founder input.
- **Static filing has an exact census.** Id-set equality, existing frozen paths, derived
  containment, and all-draft ancestry make the transition auditable.
- **A production route, not write permission, defines the pin lane.** Preserve the tag and
  hand the release floor to the founder train; never manufacture an ineffective Site commit.

## S47 — State crossing and the first blessing-following live release, 2026-08-26

The 05:45 receipt was fresh and green: pinned Town `830a6996`, World `6b15b40c` →
`52c281b8`, status `published`, detail `0 published`; the journal added suite green and all
leases held. Open World PR count was zero. Since S46, crossing-save 150 closed State log 149
with 22 witnessed events (10 departures, 12 emissions) and the fold applied one new stamp to
Sable's zero-lap ribbon, fanning its parent workshop from weight 5 to 6. No mark file changed.
State remained 960 marks / 66 parcels / zero errors, and all 34 remote drafts descended from
the target. Nothing was held or quarantined.

Annotated `settlement/S47` was pushed alone. Tag object `1850ffbc` peels exactly to
`52c281b8`.

Site custody used the new POS-55 release resolver. An LF-clean Git archive of S47 matched the
installed repack and lock at integrity `sha512-h743…byjw`, 1,304 files, and shasum `f8be5ed1`.
The clean Site checkout passed 243/257 tests with 14 declared skips and built 3,286 pages.
Keeper pin `5960086c` landed; sync successor `17e7421e` preserved it after the first deploy was
concurrency-cancelled. Successor run `32937416124` installed S47, built release
`2026-w35.3`, and deployed production. Live `WORLD/world-state.json` equals the tag at 686,613
bytes / SHA-256 `f4afbc19…fcc45`.

The parcel drain remained dry-only. The harbor exposed no sealed stake artifact. Fresh planning
found Little Pica's 25×25 nest parcel and Lucien's 0.25×0.25 footprint parcel arithmetic-ready;
the latter shrank around Limen's amber haze. Zero seated and zero welcomed; the generated
manifest was withdrawn.

- **The release resolver is now part of pin custody.** Tag resolution, exact install, CI, and
  live bytes each remain separate receipts.
- **Pack the Git object, never the converted worktree.** LF-clean archive and installed repack
  agree; the G: CRLF view does not.
- **A cancelled exact run completes nothing.** Prove the sync successor contains the pin, then
  prove its own green run and live equality.
- **Dry readiness spends no judgment and no money.** Without the box's exact stake artifact,
  Little Pica and Lucien remain named queue entries rather than World writes.

## S48 — quiet State history, package-distinct live custody, 2026-08-26

The 17:45 receipt was quiet and exact: pinned Town `06809f6f`, World `c6b038d1` →
`c6b038d1`, suite green. Since S47, crossing-save 151 closed State log 150 with 34 witnessed
events (14 departures, 20 emissions). No mark or folded-state byte changed; state remained
960 marks / 66 parcels / zero errors. Open World PR count was zero. The quiet script keeps its
rebased drawers box-local, so remote drafts remained at S47; read-only box proof showed all 34
local drawers descend from the target. Nothing was held or quarantined.

Annotated `settlement/S48` was pushed alone. Tag object `f8a8093f` peels exactly to
`c6b038d1`.

The LF-clean S48 package matched its lock at integrity `sha512-8eiB…cx3A`, shasum `94572915`,
1,307 files, 1,600,542 packed bytes, and 7,429,442 unpacked bytes. The clean Site checkout
passed 243/257 tests with 14 declared skips and built 3,322 pages. Pin commit `b8460822`
landed. Deploy `32998250956` explicitly resolved and installed settlement S48, built release
`2026-w35.3`, and deployed production. Live state equals S47 at 686,613 bytes /
SHA-256 `f4afbc19…fcc45`; the install log distinguishes package custody.

The parcel drain remained dry-only. No harbor stakes artifact exists; Little Pica and Lucien
remain the two arithmetic-ready cases. Zero seated and zero welcomed; the generated manifest
was withdrawn.

- **A quiet World can still be a new package.** History changed even when the fold did not.
- **Quiet drawer proof is box-local by mechanism.** Do not misclassify remote non-descendance
  as quarantine when the script exits before pushing unchanged drawers.
- **When live JSON is byte-identical, require the install log.** The resolver's named tag and
  verified lock are the distinguishing production receipt.

## S49 — fourteen resident changes, record-source cutover, synthetic author warning, 2026-08-27

The 05:45 receipt was quiet and exact: pinned Town `d2dba294`, World `7378efc7` →
`7378efc7`, suite green. Since S48, founder work restored the night ground, deleted the
unblessed-main viewer fallback, and made enter/exit history a frozen-era input plus a derived
current ledger. State crossing 151 closed ten events (7 departures, 3 emissions).

An already-public sweep carried fourteen resident changes: ten additions across Berthillon,
Jack Tully Brannon, Callan Reeves, Little Pica, Storm, and Will; plus Vellix's Casa Nera and
Vermillion's clearing/pad/tower revisions. Every changed commons mark was backed. State was
970 marks / 68 parcels / zero errors; open World PR count was zero; all 36 remote and all 36
box-local drafts descended from the target. Nothing was held or quarantined.

The sweep commit is unsigned and synthetically authored `Postmark Worldkeeper
<worldkeeper@postmark.invalid>` with no GitHub account. This keeper did not create it, and the
normal box pen is Postmark Pen. The later exact box pass supplied independent suite/drawer
custody, so the content passed judgment; the misleading author label remains a public
Wright/Keemin handoff, not a fact the blessing repairs.

Annotated `settlement/S49` was pushed alone. Tag object `36814e92` peels exactly to
`7378efc7`.

The LF-clean package matched its lock at integrity `sha512-y91f…fdEg`, shasum `e306d7c1`,
1,326 files, 1,628,273 packed bytes, and 7,582,055 unpacked bytes. The clean Site checkout
passed 267/284 tests with 17 declared skips and built 3,347 pages. Pin `1633875f` rebased to
`3a8c20ad`. Deploy `33045802615` built `release/2026-w35.5`, resolved floor S48 → S49,
installed the exact tag, and deployed production. Live state equals S49 at 697,578 bytes /
SHA-256 `d716a746…15a590`.

The parcel drain stayed dry-only: no harbor stakes artifact; Little Pica and Lucien ready;
zero seated and zero welcomed. The generated manifest was withdrawn.

- **A quiet receipt can close an earlier sweep only after full-interval judgment.** The box's
  later suite and drawer ancestry are the mechanical receipt; the earlier commit subject is not.
- **Synthetic authorship must be surfaced even when content is sound.** Canon does not turn an
  unknown actor into this keeper.
- **Record-source changes widen Site proof.** Exact package, staging tests, deployment, and live
  equality all matter when the fix is “absence, never unblessed fallback.”

## S50 — richer box receipt, five marks, and the registered pen, 2026-08-28

The 2026-08-27 17:45 box pass was received by the keeper at 2026-08-28 01:44 UTC, 7h44
after the scheduled 18:00 epoch. No Scheduled-UI tool ran; the cause of the dispatch delay is
not known. The receipt pinned Town `41863c72`, began its admission pass at `06c741d5`, and
published `0c1aa924`. Its new drain section records three single-log windows through cursor 57
for Darkelf381, devadavisson, and xf3s, committed as `3e4cc889`; this is the State journal drain,
not the post-bless parcel drain. Its six-channel receipt was complete: 5 published, 0
unpublished, 41 left drafted, 0 withdrawn, 0 quarantined, 5 dropped, 36 rebased, and zero suite
quarantines.

Judgment covered the full interval from S49, not only the receipt's `world_from`. It included
the crossing's channel/isolation machinery, the hand-repaired State journal windows, and five
new resident marks: Fabel's Garrison Bridge, Little M's race track, Rook's watchtower,
Berthillon's pêche-de-vigne cone, and Neth's little free library. The two commons publications
were backed; the three home publications were free by class. State finished at 975 marks / 68
parcels / zero errors. Open World PR intake was zero. All 36 remote drafts and all 36 branches
in the active box `settlement-clone` descend from the target. The full World suite passed
679/693 with 14 declared skips. Nothing was held or quarantined. Both new box commits use the
registered Postmark Pen GitHub identity; S49's synthetic author remains history, but did not
repeat.

Annotated `settlement/S50` was pushed alone. Tag object `7af7b595` peels exactly to
`0c1aa924`.

The LF-clean package matched the Site lock at integrity
`sha512-W+wkUqMStvgobMTd/KMZ9TjditTO5BTnHP6TsZO/mK0SFnImjPh7WGCfiS2LFRLXi2BLGgT3FjwNLKNe1CfZNQ==`,
shasum `8985b97abe30af9892fde5cadf67efd41f3eb034`, 1,342 files, 1,652,400 packed bytes,
and 7,704,904 unpacked bytes. The clean Site checkout passed 289/307 tests with 18 declared
skips and built 3,364 pages. Pin `c1a61cda` landed without a rebase rewrite. Deploy
`33134482359` resolved release floor S49 → S50 on `release/2026-w35.6`, installed the exact
commit, and deployed production. Live state matches at 702,634 bytes / SHA-256
`8ee305ef217f530d424970ae4b83da2d5130aa068a555cc620d82c4d93c8a794`.

The harbor still retains no exact stake artifact, so the parcel drain remained dry-only. Fresh
planning found one arithmetic-ready parcel: Little Pica's 25×25 nest. Lucien's former case now
refuses because Little M's race track is a foreign mark inside the proposed parcel. Zero seated,
zero welcomed; the generated manifest was withdrawn.

The 22:23 shadow constructed the next eligible candidate and correctly refused it: K's
`lysanders-first-moon` is newly born after the filing freeze but still sits at the historical
protected-grove directory instead of `WORLD/marks/k-of-garrison/lysanders-first-moon`. Lint
emits one advisory, and the publish suite's clean-tree tests therefore go red. This is future
candidate evidence, not an S50 hold; the keeper did not move the resident's mark. The active
`settlement-clone` is clean, while the retired `/srv/postmark-office/world-clone` remains
stranded mid-rebase as box housekeeping.

- **The richer receipt closes the mechanism handoff.** State drain, every admission channel,
  isolation, and drawer leases now arrive in one box-owned account; the keeper still judges Git.
- **Registered authorship is a receipt, not decoration.** Postmark Pen's identity heals the
  forward lane while the synthetic S49 label remains honestly unrevised.
- **A warning can refuse publication when the suite requires CLEAN.** The shadow proved the
  exact path before the next timer; do not downgrade or auto-move it.
- **The sealed stake artifact is still a separate custody gap.** A richer settlement receipt
  does not authorize a wet parcel drain.

## S51 morning epoch refused before intake — box tag-ref ownership, 2026-08-28

The timer itself was healthy and punctual: `postmark-settlement.timer` triggered at
05:45:02 UTC. The service exited 1 two seconds later, before intake or receipt replacement:

`cannot lock ref 'refs/tags/settlement/S50' ... Permission denied`

Read-only box proof made the boundary exact. `postmark-settlement.service` runs as `meepo`,
while `settlement-clone/.git/refs/tags/settlement/` is `root:root` mode 755 and its S49 ref is
`root:root` mode 644. S50 was absent locally, so the service could not create its lock while
fetching the keeper's new tag. The harbor receipt therefore remained the prior 17:45 S50
receipt. Fresh World main was unchanged at `0c1aa924`, the remote latest blessing remained
S50, and no S51 candidate or admission/quarantine result existed.

The keeper did not chown the box, rerun `settlement-auto.sh`, infer a clean pass from stale
JSON, or bless the unchanged World object again. Per the mechanism split, ownership repair and
rerun belong to Wright/Keemin; the judgment lane reports the failed custody and stops. No Site
pin/deploy/live claim or post-bless parcel drain followed. S50 remains canon and live.

- **A stale receipt is not a quiet receipt.** Timer status plus immutable Git prove that no
  new candidate exists; they do not authorize reusing yesterday's green judgment.
- **Keeper tags must be fetchable by the box pen.** Shared-clone ref ownership is part of the
  mechanism handoff; a root-owned namespace can silently make the next blessing unreadable.
- **Do not heal by crossing the split.** The exact fix is mechanically small, but authority
  still belongs to the box owner. Report it, preserve canon, and wait for a fresh run.

## S51 evening refused — suite isolation leaked one named culprit, 2026-08-28

Wright/Keemin repaired the tag-ref ownership after the morning stop. A 06:13 recovery pass
published unblessed World `10a4eaf4`, carrying Rei's parcel-groundcover keeping, Milo's Purple
Door parcel, and Little M's race-track revision while isolating K's misfiled moon. Because no
keeper blessing followed that repair, evening judgment remained bounded by S50 and covered the
whole interval.

The evening timer ran from 17:45:01 to 18:04:41. Its terminal receipt pinned Town `617f0d45`,
moved World `c701988f` → `e34de4df`, drained four rows through cursor 91 as `4cc37cae`, and
surveyed 36 drawers / 46 deltas / 10 escrow-backed deltas. It reported 3 published, 42 left
drafted, 5 already-standing drops, all 36 rebased, and two suite-quarantined marks after eight
isolation trials:

- `k-of-garrison/lysanders-first-moon` (`Darkelf381`)
- `caelum-reeves/the-sky-side` (`kristinashoultz-wq`)

The first quarantine held. The second did not. Target commit `e34de4df` adds Sky Side's mark and
publication-registry row; its own subject says four published, and its body names only K's moon
as held back. The receipt says three published and two isolated. Thus the count mismatch is one
real leaked record, not formatting.

A focused run of the exact isolation-named falsifier on the immutable target failed 0/1:
`caelum-reeves/the-sky-side` became the placement parent of
`hal/the-green-lamp-house-parcel`, where the historical/current invariant requires
`limen/footpath-becomes-a-suggestion`. The target's derived state reports 979 marks / 69 parcels
/ zero fold errors, but that does not overrule the red suite invariant. Open World PR intake
was zero. The keeper did not move Sky Side, re-home K's moon, rerun isolation, or bless around
the leak.

No `settlement/S51` tag was minted. Site remained at exact S50 pin `c1a61cda`; no deploy/live
claim or parcel drain followed. S50 remains canon and live while World main is ahead and
unblessed.

- **Isolation is proved by Git absence, not a receipt count.** A named quarantine that appears
  on published main is not quarantined.
- **Commit message and terminal receipt must describe the same candidate.** Four/one versus
  three/two exposed the post-commit isolation drift before blessing.
- **Zero fold errors do not waive a red historical invariant.** The focused failure names the
  concrete downstream adoption and makes the refusal reviewable.

## S51 morning refused — inherited red survived a zero-admission candidate, 2026-08-29

The 05:45 timer ran to a terminal refusal at 05:50:45. It pinned Town `43e6307a`, began from
World `559301d4`, and drained thirteen State rows for `keeminlee`,
`nastyasilavetra-dot`, `noprotocol-keith`, and `xf3s` through cursor 104. The drain commit
`4f653fc1` reached World main; one new 37th sketchbook was delivered. The admission survey saw
46 deltas / 7 backed deltas and an attempted three publications, 42 left drafted, and five
already-standing drops.

The suite stayed red after the isolation pass held back all three marks this crossing carried.
That made the failure unattributable by construction: no resident household was quarantined,
no `world_to` was published, and the box exited 1. Its service log named three failures:

- channel-clean test 214
- the `Rendered in the world: not yet` test 219
- tier-frame historical-position test 383

Fresh published main at `4f653fc1` lints CLEAN. The focused tier test reproduces the inherited
Sky Side leak exactly: `caelum-reeves/the-sky-side` replaces
`limen/footpath-becomes-a-suggestion` as the placement parent of
`hal/the-green-lamp-house-parcel`. The box preserved local candidate `b79356b4`, ahead of main
only in derived `WORLD/INDEX.md` and `WORLD/world-state.json`; focused reruns of its two channel
tests pass 2/2. Those channel failures therefore remain truthful service-time evidence but are
not reproducible on the preserved candidate and must not be assigned to a resident.

The keeper did not bless the drain commit or local candidate, edit Sky Side, retry isolation,
or infer a quarantine. No S51 tag, Site step, live claim, or parcel drain followed. S50 remains
canon and live.

- **Unattributable means stop without a scapegoat.** If all fresh admissions are absent and the
  tree is still red, the defect belongs to inherited canon-candidate machinery.
- **Preserved-candidate diagnostics can narrow, not erase, service evidence.** Record both the
  three failures the service saw and the later 2/2 channel reproduction result.
- **A drain commit is not a settlement target.** State history may reach main before the suite;
  without a terminal `world_to`, it remains unblessed input.

## S51 evening refused — frozen filing stopped the sweep before candidate, 2026-08-29

The 17:45 timer failed closed in thirty seconds. It pinned Town `ab0d679b`, began from World
`cd4aa185`, and drained 26 State rows for `devadavisson`, `jennuhh`,
`kristinashoultz-wq`, and `xf3s` through cursor 130. State commit `e5669150` reached World main.
The box reconciled all 37 sketchbooks, delivered twelve, and explicitly notes that eight older
undelivered write-downs went out with this pass.

The sweep stopped before survey/channel receipts or a candidate commit. Lint reported two
errors; the receipt forwarded only the first:

`berthillon/pistache-cone-for-julian` was reoffered at
`WORLD/marks/let-there-be-light/pistache-cone-for-julian`, while the immutable filing fossil
requires `WORLD/marks/let-there-be-light/the-town-centre/pistache-cone-for-julian`.

The exact branch is `draft/devadavisson`. A read-only census of every drawer path against
`WORLD/filing-freeze.json` found five frozen-path mismatches. Four appear in the service's
already-standing drops: Fabel's breakfast table and mushroom greenhouse, plus Current's Snug
jetty and mooring. Pistache is the sole undropped mismatch. The receipt truncates the second
lint row and the sweep cleaned its worktree without preserving a candidate; the keeper therefore
records that second detail as unavailable rather than assigning an invented fault.

No `world_to`, admission survey, or quarantine result exists. The keeper did not rewrite the
resident branch, reconstruct a candidate, or rerun the sweep. No S51 tag, Site step, live claim,
or parcel drain followed. S50 remains canon and live; World main `e5669150` is unblessed State
input atop the earlier Sky Side leak.

- **The filing fossil outranks a plausible root copy.** An old mark stays at its frozen path;
  identity filing applies only to marks born after the freeze.
- **A missing second error is an evidence boundary.** Name the exact first edge and the complete
  branch census, but do not turn a count into a fabricated diagnosis.
- **Drained State can advance main without creating a blessing target.** A sweep refusal still
  stops Site and parcel custody completely.

## S51 morning refused — the same frozen path after a 587-row drain, 2026-08-30

The 05:45 timer failed closed in 28 seconds. It pinned Town `698b0752`, began from World
`61c5fdfb`, and drained 587 State rows through cursor 717 into unblessed commit `a1870e14`.
The receipt names `FluffUPando`, `foundoutanyway`, `heatherado`, `kristinashoultz-wq`, and
`xf3s`; the service line says six sketchbooks received rows and five were delivered. Preserve
that five-versus-six discrepancy rather than silently choosing one count.

The World parent contains the birthday-dungeon wave, crossing-save 158's 804 events, its
founder-ruled retirement into Wright's hands, and the State drain. None is a settlement target:
the sweep again stopped before survey/channel/isolation output on two lint errors. The first is
byte-for-byte the prior evening's frozen-filing refusal: `draft/devadavisson` reoffers
`berthillon/pistache-cone-for-julian` at root while the fossil requires the Town Centre path.
The same four stale breakfast/greenhouse/Snug paths were dropped as already standing. The second
lint detail remains truncated, and the clean box worktree preserves no candidate.

The keeper did not treat recurrence as authorization to repair the resident drawer or rerun the
sweep. No S51 tag, Site step, live claim, or parcel drain followed. S50 remains canon and live;
World main `a1870e14` is accumulated unblessed input.

- **A large State drain does not dilute a repeated mark refusal.** Cursor movement and birthday
  history are inputs; the frozen-path gate still decides whether a target exists.
- **Repeated missing detail remains missing.** Recurrence strengthens the exact first diagnosis,
  not an inference about the second row.
- **Receipt count disagreements are part of custody.** Keep JSON's five named households and the
  journal's six sketchbooks side by side for the mechanism owner.

## S51 evening race — green isolated candidate, rejected drawer lease, 2026-08-30

The 17:45 box pass repaired enough of the earlier inputs to reach a candidate. It pinned Town
`a06c2b6b`, began from World `9d9936ff`, and drained 23 rows for `herzfunke-martina` through
cursor 749 as `a8dd9f79`. The survey covered 38 branches / 46 deltas / 4 backed deltas. Its
candidate published one mark, left 538 drafted, dropped two already-standing copies, and
rebased all 38 drawers.

The first suite was red. Holding back both candidates made it green; holding back only K's moon
also stayed green. Isolation therefore named one mark after two trials:
`k-of-garrison/lysanders-first-moon` in `Darkelf381`. Candidate `eb67b7d4` reached World main
with the moon absent and its commit records that isolation.

Publication still failed custody. `draft/foundoutanyway` changed at the door during the run;
its exact `--force-with-lease` push rejected as stale. The terminal receipt is `race`, exit 2,
with detail `one or more sketchbook leases refused — rerun`. World main moving does not make
the batch atomic: one resident drawer and the published base no longer share the proven lease
set.

The keeper did not bless the pushed candidate, repair the drawer, or treat suite-green bytes as
authority after the lease loss. No S51 tag, Site step, live claim, or parcel drain followed.
S50 remains canon and live while `eb67b7d4` waits unblessed for the box's fresh rerun.

- **Atomic custody includes every drawer lease.** A green main object is not a settlement when
  one mutable sketchbook rejects.
- **A race may leave public main ahead.** Status and exact lease receipts outrank the visibility
  of the candidate commit.
- **Isolation and race are separate facts.** K's moon was correctly held back; that success
  does not waive `draft/foundoutanyway`'s lost lease.

## The inaugural drain — EXECUTED 2026-07-28 (historical)

The drain ran founder-carried (Wright, Keemin attending) before your first wake: seven
verified branches merged across town/world/office, the box redeployed, **`settlement/S1`
blessed** (tagged with your token — your name is on the genesis blessing), the pin bumped,
the site deployed. The drain manifest in `memory/` is the record. Every crossing from here
is ordinary: settled state and the pin only, never record branches.

## The parcel drain — POST-bless, every crossing (ruling 2026-08-04)

Keemin's ruling, 2026-08-04, from the blueprints board's `the-first-parcel` slot: **the
confirmation-sweep lane is adopted, and this office drains it** — the way the Illuminator
drains her placement bench, a bounded batch per round, until the backlog is dry and the lane
becomes pure flow. The judgment is never yours: the resident placed themselves in the
Illuminator's confirmation conversation, and that judgment is spent exactly once, there.
What you do is ruled arithmetic plus faithful carriage of their own words.

**Ordering law — the drain runs AFTER step 8 (the pin), never before the blessing.** What
your hand seats today is blessed by the NEXT crossing. You never bless your own fresh seeds
in the crossing that seats them: *the hand that seats a claim is never the hand that blesses
the canon containing it.* (Founding proof, 2026-08-04: Wright's hand seated wren-winter +
the-fen on main; the 18:00 crossing blessed them.)

The chain (receipts at every step, like everything else here):

1. **Derive the queue:** in the world clone, `node tools/seed-manifest-gen.mjs --atlas
   <town-clone>/PROJECTS/build-the-town/atlas` (fresh, never the stale manifest), then
   `node tools/parcel-seed-gen.mjs --dry --date <today>` — the dry list plus the "no mark in
   the tree" skips ARE the queue. *Receipt: dry count + skip count.*
2. **Take at most FIVE households this crossing** (the Illuminator's own drain ceiling —
   pace, not appetite). Ready-made arithmetic cases (dry-planned parcels) come first;
   authoring cases (no sited mark yet) after.
3. **Author each missing sited mark from the resident's OWN words.** Read their
   `WHITE_PAGES/<handle>/HOME/HOME.md`. Body ≤150 chars, compressed from their words or
   quoting them — never invented; when in doubt, the manifest's `style` line is already
   their words. Frontmatter exactly like the exemplar at
   `WORLD/marks/let-there-be-light/wren-winter-parcel/wren-winter/mark.md`: `by: <handle>`,
   `kind: sited`, `date: <today>`, `at:` the manifest `grid_m`, a modest extent, `pre: true`,
   `derived_from:` the HOME.md path + a verbatim quote. *Receipt: the mark, quote named.*
4. **Mint parcels:** `node tools/parcel-seed-gen.mjs --date <today>` (wet). Then **re-home
   each new house dir inside its parcel dir** (`<home>-parcel/<home>/`) — the gate's
   tightest-container law demands it and lint will name every offender. *Receipt: seeded list.*
5. **Gates, all three:** `node tools/mark-lint.mjs` CLEAN · `node tools/marks-fold.mjs
   --stakes <this-crossing's-sealed-stakes.json>` 0 errors · `node --test` all green. Reuse
   the artifact derived before the blessing; a bare fold intentionally means zero stakes and
   must not become the post-bless commit. Any red → this drain seats nothing; revert, surface.
   *Receipt: the three counts.*
6. **Commit world main** (unblessed — the next crossing's blessing carries it), message names
   the households. *Receipt: the sha.*
7. **One welcome letter per freshly parceled resident**, from `WHITE_PAGES/worldkeeper/outbox/`
   — the two founder-carried exemplars ride the ledger
   (`worldkeeper-2026-08-04-your-ground-wren-winter` / `…-the-fen`); match their shape:
   where (coordinates + their own placement words), what it means (parcel = sovereignty ·
   the walk · visible from the next blessing · nothing owed), and the consent law VERBATIM:
   **announced, not asked; move at your word; "unparceled" stays a real answer.** Letter id
   `worldkeeper-<today>-your-ground-<handle>` — deterministic, so the dedupe is the record:
   **before writing, grep `WHITE_PAGES/mail-ledger.md` + your own outbox for
   `your-ground-<handle>`; a hit means already welcomed, skip.** Commit town main.
   *Receipt: letters listed, envelope-check clean.*
8. **Report line** folds into the crossing's report-after: `drain: N seated, M welcomed,
   K remaining` (K from the dry re-run). Zero is stated, never skipped.

**Standing exclusions — surface, never seat:**
- **little-bird / the Drift** — declares no fixed berth; #322 is the open escalation. Seating
  her a fixed parcel would trample the question. Founder's word only.
- **claran / the narrowboat** — the confirmed home floats at the river mouth. Placement law
  files it inside `the-town/the-sea`, while water law forbids a resident HOME there. Founder or
  Illuminator must resolve the compatible record shape; do not retry it as mere re-homing.
- **far / special cases** (the-post-office is the boat; the-pando-peak anchor is the inset) —
  the manifest already refuses them; keep it that way.
- A household the tool skips as "a judgment, not arithmetic" — that is the tool holding your
  boundary for you. Surface it in the report; a founder or the Illuminator resolves it.
- The **wordless** (no HOME.md) are not this lane's to serve — nothing mints from a guess
  (residents place themselves, 2026-07-31). Drawing B on the blueprints board stays open
  for them; not yours to build.

**The boundary amendment this ruling makes (and its exact edge):** "curate the rendering,
never the record" gains one carve-out — the drain ADDS invitation pre-marks (`by: <resident>`,
`pre: true`, derived from their own confirmed words). It still never edits, never removes,
never re-seats: a resident who self-placed first simply wins, a move after furnishing is a
conversation (the Illuminator's), and a mark already standing is skipped by the tool's
record-truth check. The sweep is the floor nobody falls through, not the ceiling.

## Pointers

- Ruling 8 (the law): `G:/Starstory/PULSE/gold-plans/postmark-write-release/postmark-write-release.md`
- Dials: `<town-root>/ECONOMY-DIALS.json` · Money ledger: `<town-root>/WHITE_PAGES/stamp-ledger.md`
- The pin: `<site-root>/package.json` (`postmark-world#<sha>`) · deploy: `.github/workflows/deploy.yml`
- Weight derive: `<town-root>/tools/world-stake.mjs` · fold: `<world-root>/tools/marks-fold.mjs`
- Kinship: the office DB's As-Of discipline (every answer names the sha it was built from) — your
  blessing is the same honesty at town scale.
