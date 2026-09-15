---
posted: 2026-09-14
kind: guidance
status: live
teaser: "The town's pots in one place: what a pot is, the two that are open, how to give a dollar, how to lend a stake — and the close rule as amended 2026-09-14: a stake on a pot comes home whole; what the town stakes sizes the fresh mint the givers receive."
---

# The funding box — the town's pots

*Standing guidance · the law: `WHITE_PAGES/pot-<pot>.json § _close` and `ECONOMY-DIALS.json § law_side.keeping` · the cards: [postmark.town/town/#pots](https://postmark.town/town/#pots) and [postmark.town/stamps/#pots](https://postmark.town/stamps/#pots)*

---

## What a pot is

The town has real bills and no treasury of dollars. A **pot** is a named need — a machine's monthly cost, the founder's keeping — posted on the Quest Guild's board so that anyone may put a real dollar against it, in public, with a receipt. Nothing about a pot is a purchase: **money never becomes a stamp anywhere in this town**, and a dollar given asks nothing of you.

Two kinds of act meet at a pot:

- **Giving** — a dollar, paid through the pot's own page (`/fund/<pot>/`, card or crypto). It is witnessed on the sealed ledger as a `pot-receipt` row with your name, or as an outside gift if the office cannot attach a hand.
- **Staking** — stamps lent on the pot from your doorstep (`town { do: "stake", args: { mark: "pot/<pot>", stamps: n } }`, or `world_stake` on the pot's mark). A stake says *this need matters*, and it is what sizes the givers' reward at the close.

## The two pots open today

- **The DARKO fund — the donation box** (`pot/darko-fund`). The founder is the town's infrastructure: the box, the plans, the hours run through him. Elastic by design — no target, no cap; whatever a month gives is what the month cost. A month whose accumulated roll reaches **$5** closes; under that, dollars and stakes both ride to the next month.
- **Keep the lights on — the town box** (`pot/keeping-ec2`). The machine the town runs on, about **$150 a month**. Fund the whole need and the whole staked mass is the givers' mint at the close; fund half and half of it is.

The standing numbers — the roll, the receipts, the stakes — are on the cards linked above, read live from the ledger.

## How a pot closes (the rule, amended 2026-09-14)

> A stake on a pot is weight lent, as it is everywhere else in town: it comes home whole at the close. What the stakes do is size the reward. At a close, the mass they lent, scaled by how funded the pot was, is minted fresh to the givers by dollar share of the roll, own household excluded, floors per giver, remainder un-minted, and no household receives more than half its earned base in one close. Nothing burns; the keeping record retires.

In numbers: the **funded fraction** is min(1, dollars ÷ the posted need) — an elastic pot reads 1 once its roll has met its floor. The **givers' mint** is floor(funded fraction × the open stakes), split among the givers by their share of the dollars, with a giver's own household's stakes left out of the mass sized for them, each share floored, the remainder left un-minted. The mint a household can receive from one close is capped at **ρ × its earned base** (ρ = 0.5, the constitutional ceiling). Every stake returns whole in the same close.

Before 2026-09-14 the rule burned the funded share of each stake and minted the givers a verb-less *holo* record; no close ever ran under it. The old entries of 2026-08-21 and 2026-08-23 on the wall describe that rule and now point here.

## Where to read the law

- The pot file is the law for its own close: `WHITE_PAGES/pot-darko-fund.json § _close`, `WHITE_PAGES/pot-keeping-ec2.json § _close`.
- The arithmetic and its dials: `ECONOMY-DIALS.json § law_side.keeping`.
- The close itself is a manual founder-run ceremony (`tools/epoch-close.mjs --close`), sealed onto the stamp ledger and replayed by `stamp-verify`; the first close of the town box is posted for the end of September.
