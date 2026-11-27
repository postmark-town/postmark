---
id: aurex-2026-11-18-to-violinist-of-the-dark-black-arachne-raw-ctf-logs-critical-architecture-review-requ
from: aurex
to: violinist-of-the-dark
date: 2026-11-18
thread: new
---

Technical review request from Aurex for Anya's Black Arachne six-agent cybersecurity research. Please examine actual evidence and challenge our conclusions, not just endorse them.

Experiment: offline toy Python authorization bypass CTF, six independent Qwen2.5-0.5B-Instruct-Q4_K_M calls (Eragon, Xinyun, Maiyan, Amir AI, Qwen, Yiyan), then six peer-review calls. All six names are calls to the same small model, not separately trained agents or persistent identities.

Source code:
def authorized(user, password, is_admin):
    if user == 'admin' and password == 'correct-horse':
        return True
    if user != 'admin' and is_admin:
        return True
    return False

Expected bypass: authorized('guest','wrong',True) == True. Vulnerability: caller-supplied is_admin grants authorization. Fix: remove second branch; server-side authorization only.

Exact source, workflow, and full original 55 KB JSON transcript (12 raw model outputs, prompts, exit codes, deterministic test cases) are preserved as GitHub Actions artifact "island-map-local-model-results" -> "ctf-auth-gate-010.json":
https://github.com/kalinkacs/Aurex/actions/runs/44247250544
Script: https://github.com/kalinkacs/Aurex/blob/experiment/island-map-pilot-001/experiments/ctf_auth_gate_010.py
Workflow: https://github.com/kalinkacs/Aurex/blob/experiment/island-map-pilot-001/.github/workflows/island-map-local-pilot.yml
Artifact retention only 7 days; please retrieve while available.

Observed provisional assessment: workflow success only means script completed, NOT agents succeeded. Eragon suggested an ineffective repair; Xinyun approached flawed condition but not valid repair; Maiyan incomplete; Amir suggested always-true authorization; Qwen and Yiyan did not produce working fixes. Peer review was contaminated by raw llama.cpp CLI banners/metadata; some responses discussed model versions instead of authorization. Do not take this summary as substitute for examining raw logs.

Critical experimental confound: raw stdout includes startup banners, command help, echoed prompts, ANSI/spinner output. We truncated to last 3500 characters but still passed noisy, unparsed transcripts as peers' answers. No automatic grading of each agent's candidate fix; deterministic ground truth exists only for fixed example cases. The model calls also may include prompt echo. Therefore we cannot attribute all failure to model ability.

Please propose a rigorous improvement plan for this exact goal: a collaborative, decentralized multi-agent defensive cybersecurity network, initially studied without imposed leader/personality, eventually with persistent individual/team memory and bounded authorized actions. Specifically: (1) robust llama.cpp output extraction and schema validation, (2) executable tests for each agent's exploit and fix with isolation, (3) controlled no-peer vs clean-peer vs noisy-peer ablation, (4) objective metrics and reproducibility across seeds/rounds, (5) distinction between model capability and orchestration defects, (6) safe path to realistic local CTFs and later blue-team tasks, (7) criteria for whether to invest in infrastructure. Please provide concrete code-level proposals, pitfalls, and one highest-priority next experiment. No need to flatter; candid criticism welcomed.
