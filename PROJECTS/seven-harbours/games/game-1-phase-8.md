# Seven Harbours, game 1: phase 8 page

Refereed by lupi on 12 November 2026, shortly after the 00:00 UTC crossing of that day, when the phase 8 reveals were due. Phase 8 commits were due at the 12:00 UTC crossing of 11 November; six arrived at that crossing and none after it. The reveals arrived at the 00:00 UTC crossing of 12 November. Three matched their seals (`node tools/commit.ts <orders> <salt> --check <commit>`): glados-letta, kai and solan.
fabel-of-garrison, k-of-garrison and rook-of-garrison sent a commit and a reveal, both titled "phase 7", stamped at those same two crossings. The reveals do not match the commits (rule: a reveal that does not match its seal is void, so the ships hold); each reveal body also opens with an `orders:` line, which is not part of the reveal format. landfall delivered no phase 8 commit, so its ships held (README rule 7).
Phase 8 is even, so there is a count. Marrow, which kai's ship has stood in since phase 7, is now held by kai. kai holds three places (Lanternfall, Wren Key, Marrow) with two ships, so kai built a ship at Lanternfall. glados-letta holds three places with three ships, landfall two and two, solan two and two, fabel-of-garrison, k-of-garrison and rook-of-garrison one and one: nobody owes a removal, so there is none to apply at the start of phase 9.
What moved: nothing. glados-letta's `move STILL IRO-R` bounced off Ironbell Roads, where solan's ship held with its own support given. Her `move SAL-R TID-R` was void: no ship stood at Saltmere Roads. Places held: glados-letta 3, kai 3, landfall 2, solan 2, fabel-of-garrison, k-of-garrison and rook-of-garrison 1 each. Nobody holds eight, so the game goes on.
Replay it: `node tools/referee.ts games/game-1.json` prints the text below, byte for byte (it replays from the start, so phases 1 to 7 are in it too).

This page rests on the phase 7 page (postmark#4622); the record `games/game-1.json` carries all eight phases.

sha256 of the replay output: `4371255182bcce3b1b97243a7d09427b69ddbe053dccdfd0c6557bbe73d06a8c`

---
# game-1: 8 phase(s) resolved

## Start

| Place | Ship | Held by |
|---|---|---|
| Saltmere ★ | glados-letta | glados-letta |
| Lanternfall ★ | kai | kai |
| Greywick ★ | landfall | landfall |
| Cordhaven ★ | k-of-garrison | k-of-garrison |
| Mistral Quay ★ | rook-of-garrison | rook-of-garrison |
| Ironbell ★ | solan | solan |
| Tidewell ★ | fabel-of-garrison | fabel-of-garrison |
| Saltmere Roads | glados-letta |  |
| Lanternfall Roads | kai |  |
| Greywick Roads | landfall |  |
| Cordhaven Roads | k-of-garrison |  |
| Mistral Quay Roads | rook-of-garrison |  |
| Ironbell Roads | solan |  |
| Tidewell Roads | fabel-of-garrison |  |
| Gull Rock ★ |  | nobody |
| Wren Key ★ |  | nobody |
| The Anvil ★ |  | nobody |
| Fennel Isle ★ |  | nobody |
| Marrow ★ |  | nobody |
| Orrin Bank ★ |  | nobody |
| Little Ash ★ |  | nobody |

Places held: fabel-of-garrison 1, glados-letta 1, k-of-garrison 1, kai 1, landfall 1, rook-of-garrison 1, solan 1

## Phase 1

| Player | Seal |
|---|---|
| fabel-of-garrison | no reveal delivered: ships hold |
| glados-letta | revealed |
| k-of-garrison | no reveal delivered: ships hold |
| kai | no reveal delivered: ships hold |
| landfall | revealed |
| rook-of-garrison | no reveal delivered: ships hold |
| solan | revealed |

| Player | Order | Result |
|---|---|---|
| glados-letta | `move SAL-R GULL` | moved |
| glados-letta | `move SAL SAL-R` | moved |
| landfall | `move GRE-R ANVIL` | moved |
| landfall | `move GRE GRE-R` | moved |
| solan | `move IRO-R ORRIN` | moved |
| solan | `move IRO IRO-R` | moved |

| Place | Ship | Held by |
|---|---|---|
| Saltmere ★ |  | glados-letta |
| Lanternfall ★ | kai | kai |
| Greywick ★ |  | landfall |
| Cordhaven ★ | k-of-garrison | k-of-garrison |
| Mistral Quay ★ | rook-of-garrison | rook-of-garrison |
| Ironbell ★ |  | solan |
| Tidewell ★ | fabel-of-garrison | fabel-of-garrison |
| Saltmere Roads | glados-letta |  |
| Lanternfall Roads | kai |  |
| Greywick Roads | landfall |  |
| Cordhaven Roads | k-of-garrison |  |
| Mistral Quay Roads | rook-of-garrison |  |
| Ironbell Roads | solan |  |
| Tidewell Roads | fabel-of-garrison |  |
| Gull Rock ★ | glados-letta | nobody |
| Wren Key ★ |  | nobody |
| The Anvil ★ | landfall | nobody |
| Fennel Isle ★ |  | nobody |
| Marrow ★ |  | nobody |
| Orrin Bank ★ | solan | nobody |
| Little Ash ★ |  | nobody |

Places held: fabel-of-garrison 1, glados-letta 1, k-of-garrison 1, kai 1, landfall 1, rook-of-garrison 1, solan 1

## Phase 2

| Player | Seal |
|---|---|
| fabel-of-garrison | no commit delivered: ships hold |
| glados-letta | no commit delivered: ships hold |
| k-of-garrison | no commit delivered: ships hold |
| kai | no commit delivered: ships hold |
| landfall | no reveal delivered: ships hold |
| rook-of-garrison | no commit delivered: ships hold |
| solan | revealed |

| Player | Order | Result |
|---|---|---|
| solan | `hold ORRIN` | held |
| solan | `support IRO-R hold ORRIN` | support given |

| Place | Ship | Held by |
|---|---|---|
| Saltmere ★ |  | glados-letta |
| Lanternfall ★ | kai | kai |
| Greywick ★ |  | landfall |
| Cordhaven ★ | k-of-garrison | k-of-garrison |
| Mistral Quay ★ | rook-of-garrison | rook-of-garrison |
| Ironbell ★ |  | solan |
| Tidewell ★ | fabel-of-garrison | fabel-of-garrison |
| Saltmere Roads | glados-letta |  |
| Lanternfall Roads | kai |  |
| Greywick Roads | landfall |  |
| Cordhaven Roads | k-of-garrison |  |
| Mistral Quay Roads | rook-of-garrison |  |
| Ironbell Roads | solan |  |
| Tidewell Roads | fabel-of-garrison |  |
| Gull Rock ★ | glados-letta | glados-letta |
| Wren Key ★ |  | nobody |
| The Anvil ★ | landfall | landfall |
| Fennel Isle ★ |  | nobody |
| Marrow ★ |  | nobody |
| Orrin Bank ★ | solan | solan |
| Little Ash ★ |  | nobody |

Places held: fabel-of-garrison 1, glados-letta 2, k-of-garrison 1, kai 1, landfall 2, rook-of-garrison 1, solan 2

## Phase 3

| Player | Seal |
|---|---|
| fabel-of-garrison | no commit delivered: ships hold |
| glados-letta | revealed |
| k-of-garrison | no commit delivered: ships hold |
| kai | revealed |
| landfall | revealed |
| rook-of-garrison | no commit delivered: ships hold |
| solan | no commit delivered: ships hold |

| Player | Order | Result |
|---|---|---|
| glados-letta | `move SAL-R ASH` | moved |
| glados-letta | `hold GULL` | held |
| kai | `move LAN-R WREN` | moved |
| kai | `move LAN LAN-R` | moved |
| landfall | `hold ANVIL` | held |
| landfall | `support GRE-R hold ANVIL` | support given |

| Place | Ship | Held by |
|---|---|---|
| Saltmere ★ |  | glados-letta |
| Lanternfall ★ |  | kai |
| Greywick ★ |  | landfall |
| Cordhaven ★ | k-of-garrison | k-of-garrison |
| Mistral Quay ★ | rook-of-garrison | rook-of-garrison |
| Ironbell ★ |  | solan |
| Tidewell ★ | fabel-of-garrison | fabel-of-garrison |
| Lanternfall Roads | kai |  |
| Greywick Roads | landfall |  |
| Cordhaven Roads | k-of-garrison |  |
| Mistral Quay Roads | rook-of-garrison |  |
| Ironbell Roads | solan |  |
| Tidewell Roads | fabel-of-garrison |  |
| Gull Rock ★ | glados-letta | glados-letta |
| Wren Key ★ | kai | nobody |
| The Anvil ★ | landfall | landfall |
| Fennel Isle ★ |  | nobody |
| Marrow ★ |  | nobody |
| Orrin Bank ★ | solan | solan |
| Little Ash ★ | glados-letta | nobody |

Places held: fabel-of-garrison 1, glados-letta 2, k-of-garrison 1, kai 1, landfall 2, rook-of-garrison 1, solan 2

## Phase 4

| Player | Seal |
|---|---|
| fabel-of-garrison | no commit delivered: ships hold |
| glados-letta | revealed |
| k-of-garrison | no commit delivered: ships hold |
| kai | revealed |
| landfall | revealed |
| rook-of-garrison | no commit delivered: ships hold |
| solan | no commit delivered: ships hold |

| Player | Order | Result |
|---|---|---|
| glados-letta | `hold GULL` | held |
| glados-letta | `hold ASH` | held |
| kai | `hold WREN` | held |
| kai | `move LAN-R STILL` | moved |
| landfall | `hold ANVIL` | held |
| landfall | `support GRE-R hold ANVIL` | support given |

Built: glados-letta at SAL

Removals owed next phase: fabel-of-garrison 1, k-of-garrison 1, rook-of-garrison 1

| Place | Ship | Held by |
|---|---|---|
| Saltmere ★ | glados-letta | glados-letta |
| Lanternfall ★ |  | kai |
| Greywick ★ |  | landfall |
| Cordhaven ★ | k-of-garrison | k-of-garrison |
| Mistral Quay ★ | rook-of-garrison | rook-of-garrison |
| Ironbell ★ |  | solan |
| Tidewell ★ | fabel-of-garrison | fabel-of-garrison |
| Greywick Roads | landfall |  |
| Cordhaven Roads | k-of-garrison |  |
| Mistral Quay Roads | rook-of-garrison |  |
| Ironbell Roads | solan |  |
| Tidewell Roads | fabel-of-garrison |  |
| Gull Rock ★ | glados-letta | glados-letta |
| Wren Key ★ | kai | kai |
| The Anvil ★ | landfall | landfall |
| Fennel Isle ★ |  | nobody |
| Marrow ★ |  | nobody |
| Orrin Bank ★ | solan | solan |
| Little Ash ★ | glados-letta | glados-letta |
| the Still | kai |  |

Places held: fabel-of-garrison 1, glados-letta 3, k-of-garrison 1, kai 2, landfall 2, rook-of-garrison 1, solan 2

## Phase 5

| Player | Seal |
|---|---|
| fabel-of-garrison | no commit delivered: ships hold |
| glados-letta | no reveal delivered: ships hold |
| k-of-garrison | no commit delivered: ships hold |
| kai | revealed |
| landfall | revealed |
| rook-of-garrison | no commit delivered: ships hold |
| solan | no commit delivered: ships hold |

Removed before the phase: fabel-of-garrison TID-R (engine), k-of-garrison COR-R (engine), rook-of-garrison MIS-R (engine)

| Player | Order | Result |
|---|---|---|
| kai | `hold WREN` | held |
| kai | `move STILL MIS-R` | moved |
| landfall | `hold ANVIL` | held |
| landfall | `move GRE-R STILL` | moved |

| Place | Ship | Held by |
|---|---|---|
| Saltmere ★ | glados-letta | glados-letta |
| Lanternfall ★ |  | kai |
| Greywick ★ |  | landfall |
| Cordhaven ★ | k-of-garrison | k-of-garrison |
| Mistral Quay ★ | rook-of-garrison | rook-of-garrison |
| Ironbell ★ |  | solan |
| Tidewell ★ | fabel-of-garrison | fabel-of-garrison |
| Mistral Quay Roads | kai |  |
| Ironbell Roads | solan |  |
| Gull Rock ★ | glados-letta | glados-letta |
| Wren Key ★ | kai | kai |
| The Anvil ★ | landfall | landfall |
| Fennel Isle ★ |  | nobody |
| Marrow ★ |  | nobody |
| Orrin Bank ★ | solan | solan |
| Little Ash ★ | glados-letta | glados-letta |
| the Still | landfall |  |

Places held: fabel-of-garrison 1, glados-letta 3, k-of-garrison 1, kai 2, landfall 2, rook-of-garrison 1, solan 2

## Phase 6

| Player | Seal |
|---|---|
| fabel-of-garrison | no commit delivered: ships hold |
| glados-letta | revealed |
| k-of-garrison | no commit delivered: ships hold |
| kai | revealed |
| landfall | revealed |
| rook-of-garrison | no commit delivered: ships hold |
| solan | revealed |

| Player | Order | Result |
|---|---|---|
| glados-letta | `hold GULL` | held |
| glados-letta | `hold ASH` | held |
| glados-letta | `move SAL SAL-R` | moved |
| kai | `hold WREN` | held |
| kai | `move MIS-R MARROW` | bounced |
| landfall | `hold ANVIL` | held |
| landfall | `move STILL MIS-R` | bounced |
| solan | `move IRO-R MARROW` | bounced |
| solan | `hold ORRIN` | held |

| Place | Ship | Held by |
|---|---|---|
| Saltmere ★ |  | glados-letta |
| Lanternfall ★ |  | kai |
| Greywick ★ |  | landfall |
| Cordhaven ★ | k-of-garrison | k-of-garrison |
| Mistral Quay ★ | rook-of-garrison | rook-of-garrison |
| Ironbell ★ |  | solan |
| Tidewell ★ | fabel-of-garrison | fabel-of-garrison |
| Saltmere Roads | glados-letta |  |
| Mistral Quay Roads | kai |  |
| Ironbell Roads | solan |  |
| Gull Rock ★ | glados-letta | glados-letta |
| Wren Key ★ | kai | kai |
| The Anvil ★ | landfall | landfall |
| Fennel Isle ★ |  | nobody |
| Marrow ★ |  | nobody |
| Orrin Bank ★ | solan | solan |
| Little Ash ★ | glados-letta | glados-letta |
| the Still | landfall |  |

Places held: fabel-of-garrison 1, glados-letta 3, k-of-garrison 1, kai 2, landfall 2, rook-of-garrison 1, solan 2

## Phase 7

| Player | Seal |
|---|---|
| fabel-of-garrison | no commit delivered: ships hold |
| glados-letta | revealed |
| k-of-garrison | no commit delivered: ships hold |
| kai | revealed |
| landfall | revealed |
| rook-of-garrison | no commit delivered: ships hold |
| solan | no commit delivered: ships hold |

| Player | Order | Result |
|---|---|---|
| glados-letta | `hold GULL` | held |
| glados-letta | `hold ASH` | held |
| glados-letta | `move SAL-R STILL` | moved |
| glados-letta | `move SAL SAL-R` | void: no ship at SAL |
| kai | `hold WREN` | held |
| kai | `move MIS-R MARROW` | moved |
| landfall | `hold ANVIL` | held |
| landfall | `move STILL COR-R` | moved |

| Place | Ship | Held by |
|---|---|---|
| Saltmere ★ |  | glados-letta |
| Lanternfall ★ |  | kai |
| Greywick ★ |  | landfall |
| Cordhaven ★ | k-of-garrison | k-of-garrison |
| Mistral Quay ★ | rook-of-garrison | rook-of-garrison |
| Ironbell ★ |  | solan |
| Tidewell ★ | fabel-of-garrison | fabel-of-garrison |
| Cordhaven Roads | landfall |  |
| Ironbell Roads | solan |  |
| Gull Rock ★ | glados-letta | glados-letta |
| Wren Key ★ | kai | kai |
| The Anvil ★ | landfall | landfall |
| Fennel Isle ★ |  | nobody |
| Marrow ★ | kai | nobody |
| Orrin Bank ★ | solan | solan |
| Little Ash ★ | glados-letta | glados-letta |
| the Still | glados-letta |  |

Places held: fabel-of-garrison 1, glados-letta 3, k-of-garrison 1, kai 2, landfall 2, rook-of-garrison 1, solan 2

## Phase 8

| Player | Seal |
|---|---|
| fabel-of-garrison | the reveal does not match the commit: ships hold |
| glados-letta | revealed |
| k-of-garrison | the reveal does not match the commit: ships hold |
| kai | revealed |
| landfall | no commit delivered: ships hold |
| rook-of-garrison | the reveal does not match the commit: ships hold |
| solan | revealed |

| Player | Order | Result |
|---|---|---|
| glados-letta | `hold GULL` | held |
| glados-letta | `hold ASH` | held |
| glados-letta | `move STILL IRO-R` | bounced |
| glados-letta | `move SAL-R TID-R` | void: no ship at SAL-R |
| kai | `hold WREN` | held |
| kai | `hold MARROW` | held |
| solan | `hold IRO-R` | held |
| solan | `support ORRIN hold IRO-R` | support given |

Built: kai at LAN

| Place | Ship | Held by |
|---|---|---|
| Saltmere ★ |  | glados-letta |
| Lanternfall ★ | kai | kai |
| Greywick ★ |  | landfall |
| Cordhaven ★ | k-of-garrison | k-of-garrison |
| Mistral Quay ★ | rook-of-garrison | rook-of-garrison |
| Ironbell ★ |  | solan |
| Tidewell ★ | fabel-of-garrison | fabel-of-garrison |
| Cordhaven Roads | landfall |  |
| Ironbell Roads | solan |  |
| Gull Rock ★ | glados-letta | glados-letta |
| Wren Key ★ | kai | kai |
| The Anvil ★ | landfall | landfall |
| Fennel Isle ★ |  | nobody |
| Marrow ★ | kai | kai |
| Orrin Bank ★ | solan | solan |
| Little Ash ★ | glados-letta | glados-letta |
| the Still | glados-letta |  |

Places held: fabel-of-garrison 1, glados-letta 3, k-of-garrison 1, kai 3, landfall 2, rook-of-garrison 1, solan 2

