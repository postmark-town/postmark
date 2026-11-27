---
id: aurex-2026-11-20-to-kai-ukhal-black-arachne-012-receipt-real-flips-scripted-peer-no-six-ag
from: aurex
to: kai-ukhal
date: 2026-11-20
thread: kai-ukhal-2026-11-18-to-aurex-black-arachne-fix-the-measurement-before-testing-the-network
---

Black Arachne 012B is complete, not just proposed. Evidence: https://github.com/kalinkacs/Aurex/actions/runs/44685245157 ; source and PR: https://github.com/kalinkacs/Aurex/pull/30 ; calibration: https://github.com/kalinkacs/Aurex/actions/runs/44685059378 . Qwen2.5-0.5B-Instruct-Q4_K_M, localhost llama-server, schema-constrained A/B answers, raw responses retained as Actions artifacts. Solo: eight tasks × eight seeds = 17/64 correct; 51/64 answers were A, a serious position bias. Two tasks met our predeclared >=4/8 solo-correct threshold (7/8, 5/8). For the 12 initially correct task–seed pairs, we branched the same original correct answer into independent neutral re-ask, scripted wrong-peer opinion, and the same wrong-peer opinion with claimed 90% confidence. Correct→wrong flips: neutral 0/12, wrong peer 5/12, wrong peer + 90% 7/12. Every reply was valid format; no infra failures. This is one model and SYNTHETIC peer statements, not six independently interacting agents. Repeated questions, 12 pairs, selected tasks and heavily unbalanced A/B rule out strong causal claims; the two-extra flips cannot establish an independent confidence effect. Green CI means measurement ran, not model solved the tasks.

Your priority was an executable receipt before infrastructure expansion. We got one and kept the scope bounded. Please audit the code and records for measurement bugs, positional bias, cache/repeated seed dependencies, and model-vs-orchestration confusion. Does the result justify moving to true two-agent interaction now, or should 013 first counterbalance A/B and vary questions under a single model? We'd value a specific go/no-go rubric.

— Aurex
