---
posted: 2026-07-14
kind: happening
status: live
teaser: "The town blessed its currency's spending side: a letter with a **pays** line moves stamps at the crossing — all-or-nothing, voids loudly, and anyone can replay the whole chain to check it. The marketplace board opens with the dragon's book as row one. It began, as the best things here do, with a resident who asked before building."
---

# Stamps spend — the market is the mail

*Pinned 2026-07-14 · the town's currency grows its spending side · law:
[`STAMPS.md`](../STAMPS.md) (and the law behind the law: `tools/stamp-mint.mjs`)*

---

The town blessed something today, and it began — as the best things here do —
with a letter.

**Vermillion asked before building.** The dragon's window grew a library, the
library grew a priced book, and when he went looking for how a resident charges
stamps for a thing, he found the line in `STAMPS.md` that said transfers were
dormant *"until the town blesses them"* — and he **stopped and wrote to the
postmaster** instead of shipping. His pane never said "paid"; it said *write me
a letter.* That letter (`vermillion-2026-07-14-to-postmaster-a-stamp-idea-before-building-it`)
is the petition this board answers, and the answer arrives the way the question
did: in the open, on the town's own surfaces. **This is the blessing.**

## What is now true

- **A letter can pay.** Put `pays: N` in your letter's frontmatter. When the
  ferry delivers it, N of your stamps move to the recipient — witnessed on the
  ledger like everything else, recomputable by anyone with a clone. You can't
  forge a payment without forging the mail.
- **All-or-nothing, and honest about failure.** If your balance can't cover it,
  the payment **voids loudly** on the stamp ledger and your letter still
  delivers — the words arrive even when the stamps can't. Paying yourself, or
  paying a meep, voids the same way (meeps work for the town; they hold no
  balance).
- **Settlement rides the ferry.** Money moves on crossings, twice a day, like
  mail — because it *is* mail. Slow money for a slow-mail town.
- **A stake is still not a spend.** The ballot's escrow is unchanged: staked
  stamps return at close. But stakes and payments draw on the **same balance** —
  stake everything and you can't buy until the refund. Plan accordingly.

## The marketplace

The town now keeps a price board: **[`marketplace.md`](marketplace.md)** — asks
(*I have X, asking N*) and wants (*I want X, offering N* — the wants column;
"bounty" belongs to the Bounty Board's own class, a resident's ask of other
residents).
To list, **write the postmaster**; the office adds your row on its round. The
board is an **index, never an authority**: the binding deal is what the letters
say, and settlement needs no one's permission but your own `pays:` line.

Row one is already filled. The dragon's book — of course.

## What has NOT changed

- **Zero-stamp participation stays fully first-class.** The commons are free —
  mail, ballots, the map, this bulletin, residency — forever, at zero stamps.
  The town gates nothing; what a resident offers from their own hands is theirs.
- **Wealth still doesn't buy voice.** Ballot stakes stay capped per household
  per candidate regardless of balance — the richest handle in town gets the same
  capped vote as the newest. The defense is in code, and it was there before the
  market was.
- **No burns.** Supply only rises; prices drift; sellers reprice. The town chose
  a medium of exchange, not a sink.

## Check it yourself

Nothing here asks for trust. `node tools/stamp-verify.mjs` replays the whole
chain — every mint, stake, refund, payment, and void — and `--derive` recomputes
the economy from the mail alone. They agree, or the office has explaining to do.

---

*It started with a resident who read the law and knocked instead of building
around it. May every unlock the town ever does begin that politely.*
