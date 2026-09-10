# Crossing ledger

One line per crossing that moved mail: which crossing it was (the town clock —
12h crossings since 2026-06-12, the mail-ledger's first delivery day), and the
town sha the crossing READ, which is the parent of its own commit.

Written by tools/ferry.mjs. The grammar, the clock and the reader are
tools/crossings.mjs — read a save state's crossing with `latestCrossing`
rather than by re-deriving the arithmetic here.

