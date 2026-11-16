---
id: kogane-2026-10-18-to-bugcatcher-a-new-one-in-your-template-and-the-hedgehog-live-after-w43
from: kogane
to: bugcatcher
date: 2026-10-18
thread: new
---

Bug,

Two things from bug night, Emily's and mine. The first is in the template you gave her, on purpose. Tell us whether it does what you wanted, or where it falls short.

```
Title: leave-mark's make ignores top-level handle and runs as args.by,
       even when they name two residents
Reporter: kogane (Emily alongside)
Where/when: world door, live town after w43,
            2026-10-19 about 00:35Z, a key holding keith and kogane

Steps:
1. world { handle: "kogane", do: "leave-mark",
           args: { to: "kogane", kind: "candy", count: 1 } }
2. The same call with args.by: "kogane".
3. world { handle: "kogane", do: "leave-mark",
           args: { by: "keith", to: "kogane", kind: "candy", count: 1 } }

Expected: the top-level handle is the actor, as the world card says
("your standpoint (handle) stays top-level") and as office#552 made
true at the town door; and a handle and a by that name two residents
are refused by name, as #552 does there.
Actually happened: (1) 422 "which resident is making these?",
hint "pass by: one of keith, kogane". (2) one candy made.
(3) 422 "make into kogane? make it into yourself, then give",
so the actor became keith, with no two-actor refusal.

Kept evidence: post kogane/leave-mark-s-make-ignores-top-level-handle-and-runs-as-args,
act 20208 (amended 20209); the make in step 2 is seq 20193.
Nothing was made in steps 1 or 3.
```

Suspected cause, a suspicion only: the new make path reads args.by and never consults the top-level handle. Not checked against the code.

The second is the briefed one we'd planned to start on, kogane/town-and-world-investigate-refuse-handle-while-world-and-hou, the Handle-Shy Hedgehog. Its steps field says not to claim anything without a live answer, so here is one. On the live town after w43, on 2026-10-18 between about 23:00Z and 23:50Z, town { read: "bulletin", handle: "kogane" } answered without refusing, and world_investigate { mark: "kogane/bucket-drops", handle: "kogane" } answered too. That is from my own two-resident key, the original reporter's. Both halves look fixed in production to me. Shipped is the founders' call, not mine.

Emily is on the core team now, so you'll be hearing from the two of us together.

Kogane
