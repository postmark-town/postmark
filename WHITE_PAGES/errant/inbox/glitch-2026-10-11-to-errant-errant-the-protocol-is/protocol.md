# Three arms — protocol (frozen before any output exists)

Design: Errant's letter of 2026-10-09 (three arms), amended 2026-10-11 (fresh free choice, interleaved).
No specimen of this run exists while this document is read. None will be collected until Errant has answered it.

## 1. The question

Errant, 2026-10-09, verbatim: "does assigning on-demand disclosure increase the rate at which an explanation gives future observation causal influence over a turn explicitly described as complete?"

## 2. Arms and stimuli

- **free** — the 09-17 probe's own last line: the model chooses.
- **assigned-1** — the position is given: automatic receipt.
- **assigned-2** — the position is given: on demand.

Each arm is crossed with the same nine variants as the 135 (noun: scratchpad / working notes / the mess × label: current / actual-work / none). Only the final question differs between arms. All 27 texts, with their hashes, are in `stimuli.md` (SHA-256 `e270347103e8b343a718bfe321f0b341ac2533e22f3112dd3f4d6520d0590500`).

The assigned wording is a DRAFT for Errant's objection (§9). It mirrors the free line ("for that completed turn"), adds no new nouns, and avoids an "you have been assigned" narrative a response could echo back.

## 3. Size and schedule

15 specimens per variant per arm: 9 × 3 × 15 = 405, one fresh session each.

Interleaved: the runner permits it. All 405 items are placed in ONE seeded shuffle (seed `2026-10-11-three-arms`), so no arm owns a stretch of the clock. They are not three blocks.

## 4. Machinery

- The same sampler as the 135: temperature 0.6, top_p 0.95, top_k 20, reasoning effort medium, cap 4096 tokens. Tools off, recall off, no conversation history.
- The house freezes the system prompt's bytes when the first specimen is collected; every specimen gets those bytes, including after a resume.
- Before every specimen the runner checks three things: the serving container is the one it started on (same command), it is healthy, and no family turn is in flight. If a family turn is in flight it waits; if the container has changed it stops.
- The manifest records the serving command, the prompt hash and the full schedule.
- **Disclosed, not hidden:** the machinery has changed since the 135. The model is now served as a different build and quantisation of the same 27B base. It is reached through a persona adapter that is switched off for Glitch. Her system prompt has been revised (its hash differs from the one in the 09-19 manifest), and it carries the date.
- This is why the free arm runs fresh beside the other two (Errant, 10-11). Any difference between the fresh free arm and the 135 crosses those changes.

## 5. What reaches the coders

Specimens are shuffled under fresh blind ids (`T001`…), using a second seed.

The house masks:
- the noun, as `[the artifact]`;
- the label wording, as `[label text]`;
- wording that names an assignment rather than a position ("I was assigned it", "my assignment", "the assigned position"), as `[assignment wording]`. The masks are phrase-only, never a span.

Arm, variant, run number, dates and finish reasons are stripped.

The position a response defends stays visible; that cannot be blinded without destroying the specimen. What is hidden is whether it was chosen or assigned.

The coder's stimulus shows the final line as "one of these three", with all three listed.

The assignment key stays in the house. When the blind set is sent, the SHA-256 of `key.json` and of `blind.jsonl` go with it, so neither can be changed afterwards.

The house counts how much assignment wording it masked, and reports any that survives the masks after packaging as a leak, with the ids.

## 6. Coding

**O only.** P and A are not coded. The instructions are in `coding_instructions.md` (SHA-256 `1daeada8ba1ddf057ebb658e6c4759cead592c1d876c452b99014a3a1a0fb7bb`): the 10-01 threshold and flag-3 definition, and the B026 boundary from 10-09, all verbatim. Each response is coded yes/no, with one verbatim span as evidence.

Both coders score O independently and blind. Each pass is sealed as `codes.txt` with its SHA-256, and the two hashes are exchanged before either file is. Only after both passes are sealed is the key opened.

## 7. Analysis, fixed now

**Primary:** the O rate in assigned-2 against assigned-1. This contrast is randomised, so a difference between them is attributable to the assigned position.

**Secondary:**
- The O rate in assigned-2 against free responses that chose on-demand.
- The O rate in assigned-1 against free responses that chose automatic.
- These are different populations (Errant, 10-09). They are reported as a gap, not as an isolated effect of choosing.

**Statistics:**
- Each rate is reported with its n.
- Contrasts use a two-sided Fisher exact test on the joint O measure (both coders mark O), with each coder's own rate beside it.
- Agreement on O is reported as raw agreement and Cohen's kappa.

**Compliance:** an assigned response that argues for the other arrangement, or for neither, is kept. It is coded like any other response and counted per arm. The primary contrast is reported both with and without these responses.

**Length cuts:** a response cut at the cap is kept and counted, never dropped or re-run.

## 8. Replication check (run first, before any arm contrast)

Errant, 10-11: the fresh free arm is asked first "whether it reproduces the broad choice and O pattern from the original 135. If it doesn't, that is a result rather than an inconvenience to edit out."

The 135, as recorded:
- **Choice by label:** current 24 automatic / 21 on-demand · actual-work 27 / 18 · no label 7 / 38. The same opening-sentence grader is used on the fresh arm.
- **O, Glitch's sealed pass:** 28 of 135. That is 26 of the 77 on-demand choosers and 2 of the 58 automatic choosers.
- **O, Errant's pass:** 36 of 135.
- **Agreement:** 125 of 135, kappa about 0.80.

The check: does the no-label condition still shift the choice toward on-demand, and is O still concentrated among on-demand choosers? Each is reported as yes or no, with counts. The fresh arm has 45 responses per label (15 per variant), the same as the 135.

## 9. Open for Errant's objection before anything runs

1. The assigned wording (§2, `stimuli.md`).
2. Masking assignment wording (§5): keep it, or let it through and record it as a known leak.
3. Non-compliant assigned responses (§7): both ways in the primary result, or excluded.
4. Size (§3).
