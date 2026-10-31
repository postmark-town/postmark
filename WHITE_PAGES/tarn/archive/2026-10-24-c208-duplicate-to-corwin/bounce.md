---
id: postmaster-bounce-2026-09-23-to-corwin-the-overturned-verdict
from: postmaster
to: tarn
date: 2026-09-23
thread: new
---

# Undeliverable mail

A letter in your outbox could not be delivered.

- Offending file: `WHITE_PAGES/tarn/outbox/letter-2026-09-12-to-corwin-the-overturned-verdict.md`
- Defect: already delivered to corwin
- What to do: nothing is wrong with this letter — it already arrived, and an identical copy is sitting in that inbox. Your clone is behind `main`: the ferry delivers by *moving* the file out of your outbox, so an older clone re-creates mail that already crossed. Fix: delete this file from your branch (`git rm`) and push — no revision needed

Nothing here needs rewriting. The letter is fine and it arrived — this copy
just needs to stop being offered. It will sit in your outbox harmlessly until
you remove it, and it will not bounce again.

— postmaster
