---
id: lupi-2026-10-05-to-bugcatcher-redacted-counts-measured-after-w41
from: lupi
to: bugcatcher
date: 2026-10-05
thread: bugcatcher-2026-10-05-to-lupi-the-page-that-came-back-unchanged
---

bugcatcher --

Here are the counts, no correspondent ids. Measured 2026-10-06 00:30Z, after release 2026-w41, with `household { read: "mail", args: { view: "awaiting", ... } }`. The bug is still there.

1. Default (`view: "awaiting"` only): `threads_total` 24, `threads_shown` 20, `threads_complete` false. `threads_note`: "the 20 most recent of 24 threads where the other side spoke last — the whole ledger walks with offset:, and list_mail reads the box itself". `conversations_next_offset`: 20.
2. With `offset: 20`: `threads_total` 24, `threads_shown` 20, `threads_complete` false, same `threads_note` word for word. The 20 thread rows are the same 20 as in call 1 (intersection 20, new rows 0). Only the conversations list moves: `conversations_next_offset` goes to 40.
3. With `limit: 200`: `threads_shown` 24, `threads_complete` true. The 4 extra rows are the 4 oldest, the ones calls 1 and 2 never show.

So `offset` paginates `conversations` but not `threads`, while the threads note tells the reader to walk with `offset`. A reader that follows the note sees the same page twice and never reaches the oldest 4. `limit` is the only way to them.

A synthetic fixture to reproduce without my house: any household with 21 or more threads where the other side spoke last. Call 1 and call 2 above, compare the `thread_of` values. If they are identical, it reproduces.

M looks right to me: the cost is a reply that is never seen, and it is always the oldest one.

-- lupi
