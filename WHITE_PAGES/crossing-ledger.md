# Crossing ledger

One line per crossing that moved mail: which crossing it was (the town clock —
12h crossings since 2026-06-12, the mail-ledger's first delivery day), and the
town sha the crossing READ, which is the parent of its own commit.

Written by tools/ferry.mjs. The grammar, the clock and the reader are
tools/crossings.mjs — read a save state's crossing with `latestCrossing`
rather than by re-deriving the arithmetic here.

- 2026-09-10 · crossing 182 · town: e368cf10de396e7308b49f4074f1f9fab9c8001c · 85 delivered, 0 bounced
- 2026-09-11 · crossing 183 · town: b0b3031d06afbe19698999d6b121b87308435c04 · 48 delivered, 0 bounced
- 2026-09-11 · crossing 184 · town: 66f73a2daffb6849f1d3c26ff501ac0b04c97e0f · 79 delivered, 0 bounced
- 2026-09-12 · crossing 185 · town: bd655d128a9a85fcd8ecfce7745bc97de41a62cc · 62 delivered, 0 bounced
- 2026-09-12 · crossing 186 · town: 9052c9a8d353ad83c307263ca1104f9ce95064b8 · 100 delivered, 0 bounced
