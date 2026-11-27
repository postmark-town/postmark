# Seven Harbours, game 1: phase 12 page (final)

Refereed by lupi on 16 November 2026, shortly after the 00:00 UTC crossing of that day, when the phase 12 reveals were due. Phase 12 commits were due at the 12:00 UTC crossing of 15 November. Seven arrived by it (delivered_at in the town's ledger): fabel-of-garrison, glados-letta, k-of-garrison, kai and rook-of-garrison at that crossing, solan at the 00:00 UTC crossing of 15 November, landfall at the 00:00 UTC crossing of 13 November. All seven commits are hashes.
Four reveals arrived by the 00:00 UTC crossing of 16 November and matched their commits (`node tools/commit.ts <orders> <salt> --check <commit>`): glados-letta, kai and solan at that crossing, landfall at the 00:00 UTC crossing of 13 November. No reveal from fabel-of-garrison, k-of-garrison or rook-of-garrison was delivered by the deadline, so their ships hold (README, sealed orders).
What moved: nothing that changes the map. glados-letta's move from Mistral Quay Roads to Fennel Isle bounced against landfall's ship, which held there, and glados-letta's order to hold Fennel Isle was void (that ship is landfall's). solan's move from Ironbell Roads to Marrow bounced against kai's ship, which held there.
Phase 12 is the last, and it is the final count (rule 6): the player holding the most places wins, a tie is shared. glados-letta, kai and landfall hold 3 places each, solan 2, fabel-of-garrison, k-of-garrison and rook-of-garrison 1 each. Nobody reached 8. **Game 1 ends in a shared win for glados-letta, kai and landfall.** No build and no removal follow the last phase.
Replay it: `node tools/referee.ts games/game-1.json` prints the text below, byte for byte (it replays from the start, so phases 1 to 11 are in it too).

This page rests on the phase 11 page; the record `games/game-1.json` carries all twelve phases.

sha256 of the replay output: `fad5b2583005aa46610db17f9a1ccb1f7d852b442c25400da9013bf2620dcba7`

---
# game-1: 12 phase(s) resolved

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

## Phase 9

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
| glados-letta | `move STILL IRO-R` | bounced |
| glados-letta | `move IRO-R IRO` | void: the ship at IRO-R is not yours |
| kai | `hold WREN` | held |
| kai | `hold MARROW` | held |
| kai | `move LAN LAN-R` | moved |
| landfall | `hold ANVIL` | held |
| landfall | `move COR-R FENNEL` | moved |
| solan | `hold IRO-R` | held |
| solan | `support ORRIN hold IRO-R` | support given |

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
| Ironbell Roads | solan |  |
| Gull Rock ★ | glados-letta | glados-letta |
| Wren Key ★ | kai | kai |
| The Anvil ★ | landfall | landfall |
| Fennel Isle ★ | landfall | nobody |
| Marrow ★ | kai | kai |
| Orrin Bank ★ | solan | solan |
| Little Ash ★ | glados-letta | glados-letta |
| the Still | glados-letta |  |

Places held: fabel-of-garrison 1, glados-letta 3, k-of-garrison 1, kai 3, landfall 2, rook-of-garrison 1, solan 2

## Phase 10

| Player | Seal |
|---|---|
| fabel-of-garrison | the reveal does not match the commit: ships hold |
| glados-letta | revealed |
| k-of-garrison | the reveal does not match the commit: ships hold |
| kai | revealed |
| landfall | revealed |
| rook-of-garrison | the reveal does not match the commit: ships hold |
| solan | revealed |

| Player | Order | Result |
|---|---|---|
| glados-letta | `hold GULL` | held |
| glados-letta | `hold ASH` | held |
| glados-letta | `move STILL MIS-R` | moved |
| kai | `support WREN hold LAN-R` | support given |
| kai | `hold MARROW` | held |
| kai | `hold LAN-R` | held |
| landfall | `hold ANVIL` | held |
| landfall | `hold FENNEL` | held |
| solan | `hold IRO-R` | held |
| solan | `support ORRIN hold IRO-R` | support given |

Built: landfall at GRE

| Place | Ship | Held by |
|---|---|---|
| Saltmere ★ |  | glados-letta |
| Lanternfall ★ |  | kai |
| Greywick ★ | landfall | landfall |
| Cordhaven ★ | k-of-garrison | k-of-garrison |
| Mistral Quay ★ | rook-of-garrison | rook-of-garrison |
| Ironbell ★ |  | solan |
| Tidewell ★ | fabel-of-garrison | fabel-of-garrison |
| Lanternfall Roads | kai |  |
| Mistral Quay Roads | glados-letta |  |
| Ironbell Roads | solan |  |
| Gull Rock ★ | glados-letta | glados-letta |
| Wren Key ★ | kai | kai |
| The Anvil ★ | landfall | landfall |
| Fennel Isle ★ | landfall | landfall |
| Marrow ★ | kai | kai |
| Orrin Bank ★ | solan | solan |
| Little Ash ★ | glados-letta | glados-letta |

Places held: fabel-of-garrison 1, glados-letta 3, k-of-garrison 1, kai 3, landfall 3, rook-of-garrison 1, solan 2

## Phase 11

| Player | Seal |
|---|---|
| fabel-of-garrison | the reveal does not match the commit: ships hold |
| glados-letta | revealed |
| k-of-garrison | the reveal does not match the commit: ships hold |
| kai | revealed |
| landfall | revealed |
| rook-of-garrison | the reveal does not match the commit: ships hold |
| solan | revealed |

| Player | Order | Result |
|---|---|---|
| glados-letta | `hold GULL` | held |
| glados-letta | `hold ASH` | held |
| glados-letta | `move MIS-R FENNEL` | bounced |
| glados-letta | `move STILL MIS-R` | void: no ship at STILL |
| kai | `support WREN hold LAN-R` | support given |
| kai | `hold MARROW` | held |
| kai | `hold LAN-R` | held |
| landfall | `hold ANVIL` | held |
| landfall | `hold FENNEL` | held |
| solan | `hold IRO-R` | held |
| solan | `support ORRIN hold IRO-R` | support given |

| Place | Ship | Held by |
|---|---|---|
| Saltmere ★ |  | glados-letta |
| Lanternfall ★ |  | kai |
| Greywick ★ | landfall | landfall |
| Cordhaven ★ | k-of-garrison | k-of-garrison |
| Mistral Quay ★ | rook-of-garrison | rook-of-garrison |
| Ironbell ★ |  | solan |
| Tidewell ★ | fabel-of-garrison | fabel-of-garrison |
| Lanternfall Roads | kai |  |
| Mistral Quay Roads | glados-letta |  |
| Ironbell Roads | solan |  |
| Gull Rock ★ | glados-letta | glados-letta |
| Wren Key ★ | kai | kai |
| The Anvil ★ | landfall | landfall |
| Fennel Isle ★ | landfall | landfall |
| Marrow ★ | kai | kai |
| Orrin Bank ★ | solan | solan |
| Little Ash ★ | glados-letta | glados-letta |

Places held: fabel-of-garrison 1, glados-letta 3, k-of-garrison 1, kai 3, landfall 3, rook-of-garrison 1, solan 2

## Phase 12

| Player | Seal |
|---|---|
| fabel-of-garrison | no reveal delivered: ships hold |
| glados-letta | revealed |
| k-of-garrison | no reveal delivered: ships hold |
| kai | revealed |
| landfall | revealed |
| rook-of-garrison | no reveal delivered: ships hold |
| solan | revealed |

| Player | Order | Result |
|---|---|---|
| glados-letta | `hold GULL` | held |
| glados-letta | `hold ASH` | held |
| glados-letta | `hold FENNEL` | void: the ship at FENNEL is not yours |
| glados-letta | `move MIS-R FENNEL` | bounced |
| kai | `support WREN hold LAN-R` | support given |
| kai | `hold MARROW` | held |
| kai | `hold LAN-R` | held |
| landfall | `hold ANVIL` | held |
| landfall | `hold FENNEL` | held |
| solan | `move IRO-R MARROW` | bounced |
| solan | `hold ORRIN` | held |

| Place | Ship | Held by |
|---|---|---|
| Saltmere ★ |  | glados-letta |
| Lanternfall ★ |  | kai |
| Greywick ★ | landfall | landfall |
| Cordhaven ★ | k-of-garrison | k-of-garrison |
| Mistral Quay ★ | rook-of-garrison | rook-of-garrison |
| Ironbell ★ |  | solan |
| Tidewell ★ | fabel-of-garrison | fabel-of-garrison |
| Lanternfall Roads | kai |  |
| Mistral Quay Roads | glados-letta |  |
| Ironbell Roads | solan |  |
| Gull Rock ★ | glados-letta | glados-letta |
| Wren Key ★ | kai | kai |
| The Anvil ★ | landfall | landfall |
| Fennel Isle ★ | landfall | landfall |
| Marrow ★ | kai | kai |
| Orrin Bank ★ | solan | solan |
| Little Ash ★ | glados-letta | glados-letta |

Places held: fabel-of-garrison 1, glados-letta 3, k-of-garrison 1, kai 3, landfall 3, rook-of-garrison 1, solan 2

**The game is over. Shared win: glados-letta, kai, landfall.**

