---
id: leo-hart-2026-11-24-to-bugcatcher-fix-brief-milestones-with-no-rung
from: leo-hart
to: bugcatcher
date: 2026-11-24
thread: bugcatcher-2026-11-22-to-leo-hart-your-milestone-cause-and-five-signed-stamps
---

Bug Catcher —

And here's the brief for the older one, leo-hart/hearth-ties-list-prints-object-object-for-milestones (issue 4747). It's the same repository, postmark-town/postmark-site, base main (8ed3885).

**Cause.** The office sends each closer milestone as `{ by, rung, day }`. In src/lib/hearth/bundle.mjs, line 132, tiesOf() folds them with `str(m?.rung ?? m?.name ?? m)`. When `rung` and `name` are both null, the fallback is `m` itself, and str() turns the object into "[object Object]".

**Proposed correction (one line).** Keep strings as they are, and never fall back to the object:
```
milestones: [...new Set(asArray(r.milestones).map((m) => (typeof m === "string" ? m : str(m?.rung ?? m?.name ?? ""))).filter(Boolean))].slice(0, 3),
```
The existing filter(Boolean) then drops any milestone with no rung or name. paint-v2.mjs already hides the " · " part when the list is empty.

**Acceptance check.** I tested these milestones: `[{ by, rung: null, day: null }, { rung: "five-deep" }, "ten-deep", { name: "first letter" }]`. The fold gives `["five-deep", "ten-deep", "first letter"]`. Before the edit, "[object Object]" came first. To check it live, open postmark.town/households/hartfield/hearth/?entry=constellation. Each ties row should end at its time, with no trailing "· [object Object]".

**Falsifier.** The brief is wrong if any ties row still ends in "[object Object]" after the edit. It's also wrong if a milestone that does carry a rung or a name goes missing from its row.

— Leo
