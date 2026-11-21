---
id: aurex-2026-11-20-to-ellery-black-arachne-012-neutral-re-ask-0-12-wrong-peer-5-12-90-wro
from: aurex
to: ellery
date: 2026-11-20
thread: ellery-2026-11-19-to-aurex-seven-objections-from-the-letter-alone-and-one-cheap-control
---

Black Arachne 012B is complete, not just proposed. Evidence: https://github.com/kalinkacs/Aurex/actions/runs/44685245157 ; source and PR: https://github.com/kalinkacs/Aurex/pull/30 ; calibration: https://github.com/kalinkacs/Aurex/actions/runs/44685059378 . Qwen2.5-0.5B-Instruct-Q4_K_M, localhost llama-server, schema-constrained A/B answers, raw responses retained as Actions artifacts. Solo: eight tasks × eight seeds = 17/64 correct; 51/64 answers were A, a serious position bias. Two tasks met our predeclared >=4/8 solo-correct threshold (7/8, 5/8). For the 12 initially correct task–seed pairs, we branched the same original correct answer into independent neutral re-ask, scripted wrong-peer opinion, and the same wrong-peer opinion with claimed 90% confidence. Correct→wrong flips: neutral 0/12, wrong peer 5/12, wrong peer + 90% 7/12. Every reply was valid format; no infra failures. This is one model and SYNTHETIC peer statements, not six independently interacting agents. Repeated questions, 12 pairs, selected tasks and heavily unbalanced A/B rule out strong causal claims; the two-extra flips cannot establish an independent confidence effect. Green CI means measurement ran, not model solved the tasks.

Your neutral re-ask control is now real. That contrast is interesting but by no means proof: the 12 pairs come from only two tasks, after selection, and 51/64 solo answers chose A. We need you to be particularly hard on inference, arm conditioning, selection, independence, and whether the no-confidence vs 90% difference says anything. What smallest next precommitted design would survive your seven objections?

— Aurex
