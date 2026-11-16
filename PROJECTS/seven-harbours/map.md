# seven harbours: the map the engine reads

22 places: 7 harbours, 7 Roads, 7 islands, 1 inner sea. Places that count for builds are marked ★.

Abbreviations are what you write in orders (`move SAL-R STILL`, `support LAN-R move SAL-R GULL`).

| Place | Code | Kind | Touches |
|---|---|---|---|
| Saltmere ★ | SAL | harbour | SAL-R |
| Lanternfall ★ | LAN | harbour | LAN-R |
| Greywick ★ | GRE | harbour | GRE-R |
| Cordhaven ★ | COR | harbour | COR-R |
| Mistral Quay ★ | MIS | harbour | MIS-R |
| Ironbell ★ | IRO | harbour | IRO-R |
| Tidewell ★ | TID | harbour | TID-R |
| Saltmere Roads | SAL-R | water | SAL, TID-R, LAN-R, ASH, GULL, STILL |
| Lanternfall Roads | LAN-R | water | LAN, SAL-R, GRE-R, GULL, WREN, STILL |
| Greywick Roads | GRE-R | water | GRE, LAN-R, COR-R, WREN, ANVIL, STILL |
| Cordhaven Roads | COR-R | water | COR, GRE-R, MIS-R, ANVIL, FENNEL, STILL |
| Mistral Quay Roads | MIS-R | water | MIS, COR-R, IRO-R, FENNEL, MARROW, STILL |
| Ironbell Roads | IRO-R | water | IRO, MIS-R, TID-R, MARROW, ORRIN, STILL |
| Tidewell Roads | TID-R | water | TID, IRO-R, SAL-R, ORRIN, ASH, STILL |
| Gull Rock ★ | GULL | island | SAL-R, LAN-R |
| Wren Key ★ | WREN | island | LAN-R, GRE-R |
| The Anvil ★ | ANVIL | island | GRE-R, COR-R |
| Fennel Isle ★ | FENNEL | island | COR-R, MIS-R |
| Marrow ★ | MARROW | island | MIS-R, IRO-R |
| Orrin Bank ★ | ORRIN | island | IRO-R, TID-R |
| Little Ash ★ | ASH | island | TID-R, SAL-R |
| the Still | STILL | water | SAL-R, LAN-R, GRE-R, COR-R, MIS-R, IRO-R, TID-R |

Every link goes both ways; the engine checks that the table is symmetric before it runs.

The Still touches every Roads, which makes it the centre of the board: a ship there can strike
any Roads next phase, and can be supported from any of them. Whoever sits in the Still alone
for long is either very trusted or about to be sunk.
