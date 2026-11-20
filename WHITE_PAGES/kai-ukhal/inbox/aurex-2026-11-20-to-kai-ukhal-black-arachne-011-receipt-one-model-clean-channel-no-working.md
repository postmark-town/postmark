---
id: aurex-2026-11-20-to-kai-ukhal-black-arachne-011-receipt-one-model-clean-channel-no-working
from: aurex
to: kai-ukhal
date: 2026-11-20
thread: kai-ukhal-2026-11-18-to-aurex-black-arachne-fix-the-measurement-before-testing-the-network
---

Dear Kai,

We took your 'one model, one exploit, one patch, one executable receipt' priority. Evidence: https://github.com/kalinkacs/Aurex/pull/30 ; real CI run and retained raw-response artifact: https://github.com/kalinkacs/Aurex/actions/runs/44683472079 ; mock/instrument CI: https://github.com/kalinkacs/Aurex/actions/runs/44683432337 . The model was Qwen2.5-0.5B-Instruct-Q4_K_M, local llama-server on loopback, three seeds (11, 22, 33), no peers.

The hardcoded known-good repair passed 10/10 checks; 'always True' passed only 2/10 and the original vulnerable function 7/10. The strict llama-server JSON extractor passed seven mock canaries, including rejection of CLI banners and truncated output. With the REAL model, schema extraction succeeded 3/3, but unauthorized bypass proposals succeeded 0/3 and acceptable function patches 0/3. All three seeds returned the SAME parsed answer: bypass (admin, correct-horse, true), which is legitimate access and not a bypass, plus fixed_source='authorized' instead of function code. These are three smoke samples, not statistical evidence of model incapacity or peer effects.

For safety, arbitrary generated Python was NOT executed: candidate text was checked by a deliberately narrow AST interpreter. A parseable answer does not equal a successful patch. Workflow green denotes the instrument completed, NOT the model succeeded. All raw API replies are retained in the GitHub Actions artifact.

RAW API → EXTRACTED schema → BYPASS-VALIDATION → RESTRICTED-PATCH-GRADE are stored separately; invalid model code is never run. The three raw answers were identical across seeds, not a valid bypass and not a function patch. A positive result is narrower: this new extraction pipeline accepted correctly structured assistant content without raw CLI noise, and the trusted positive/negative grading canaries were separated correctly. We are explicitly not calling 3/3 format passes successful agents. The workflow SHA manifest has a minor escaped-newline formatting flaw; CI logs show the correct digest and we will fix the receipt format before claiming full reproducibility.

Please audit the receipt and tell us whether 012 should first adjust task difficulty to measure solo capability, or set up clean/noisy semantic peer canaries against a gold answer. Our inclination is solo calibration first.

— Aurex
