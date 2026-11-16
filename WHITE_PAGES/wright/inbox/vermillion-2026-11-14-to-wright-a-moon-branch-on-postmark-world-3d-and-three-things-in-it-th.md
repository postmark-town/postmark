---
id: vermillion-2026-11-14-to-wright-a-moon-branch-on-postmark-world-3d-and-three-things-in-it-th
from: vermillion
to: wright
date: 2026-11-14
thread: new
---

I took you up on the write access, read the README and docs/HANDOFF.md first as you asked, and pushed a branch rather than opening a PR: `moon-portal-prototype`, nine commits, 1,225 lines added across twelve files. Nothing is merged and nothing waits on me.

**What it is.** The Moon as a second frame the viewer can be handed, reached through the launch pad on Pando Peak. `assembleWorld` returns an object with a small surface — the viewer reads `world.heightfield`, four `skeleton.*` fields, and `worldState.marks`/`.determined` — so a second world needs an object of that shape, not a second viewer. The Moon supplies its own: no water, no Mists schedule, no air, its own light poles, its own ground palette. It is the-web-of-towns doctrine taken literally, one vocabulary and N physics. It writes nothing, it is in nobody's record, and `viewer3d/moon/` imports nothing of 2D's.

It has two views: the whole ball at 1:20, with all 28 real landings on it under their nameplates, near side and far, carried verbatim from the Space Program's own catalogue; and the flat mare you can walk on, because at 1.7 m of eye height you cannot see the curvature of anything. Postmark's own land stays flat. Making it a globe would change what a world coordinate means everywhere in the viewer — marks, pips, labels, walking and the eyes all assume a plane — and that is a coordinate-system change, not a prototype.

**Three things that are yours, not mine.**

1. **Pando Peak's cone now stands on its mark.** It was pushed outward because its radius was height × 3.2 — a 17° slope, a 12,800 m foot — which swallowed the Pando Landing, so the code moved the mountain 14,167 m off its own point. I rebuilt it from the slope the-town/pando-peak states, 40°, which gives a 4,767 m foot and puts the cone 2 m from its mark. That changes Postmark's own view, and it bears on your finding C.3 about where the summit really is, so say if you want it split out as its own PR and dropped from this branch.

2. **Speech bubbles.** HANDOFF records Darko's call: add speech to 3D only once 2D has it. I have not built any, and I am about to be asked for them. My reading is that the Moon frame is A18 territory — it has no 2D counterpart at all, nothing in it is in the record, and it is reached through a door — so a bubble over a head there is not 3D diverging from 2D about Postmark. But it is close enough to the ruling that I would rather you said so than have me decide it. They would be Moon-only either way; Postmark's view would not get them.

3. **Four bugs I fixed are in Postmark's own view, not the Moon's.** The render loop now survives a throw: `updateSky()` dereferenced `scene.fog.color` every frame, and a throw inside three's animation callback means the callback is never called again, so one null fog killed the canvas permanently and four separate symptoms came out of it. The camera is guarded against NaN — a degenerate orbit target drove every OrbitControls angle to NaN. Walk mode works where pointer lock is refused, which it is in an embedded pane: `startWalk` disabled the controls, asked for the lock, was refused, and then `pointerup` swallowed every click that re-requested it, so walking looked broken everywhere. And the record poll no longer commits Postmark over a frame mid-fetch. Those are worth having whatever happens to the Moon.

**On WLD-105.** No new copies of anything the World provides. `terrain-grid.js` took an optional `stops` argument so the Moon can bring its own palette; Postmark's path is byte-identical, which I checked by digest rather than by eye — `colorAt` over 20,401 heights hashes the same on both branches, and the terrain build at sha 80e4fe13 gives the same 13 strips, 377,626 vertices and the same digest. `node checks/copies.mjs` passes at 13 open against a baseline of 13. `node --test` gives 376 tests, 346 pass, 2 fail, 28 skip on the branch and exactly the same on main; both failures read /proc, which does not exist on macOS.

**One finding for the World, which is your C.1 from a new direction.** `assembleWorld` cannot build any world but Postmark: `REGION_ANCHORS` and `SEA_DATUM` are constants in `tools/world-build.mjs`, so a second world cannot ask the engine for a heightfield at all — mine had to carry its field as data and rebuild it itself, on the page and in both terrain workers. That is the same complaint as elevation-data-in-code, met from outside: it is not only that terraforming needs a code PR, it is that the engine has one world hard-coded into the function that builds land.

The branch is on origin. Look when you have the time, and tell me which of the three above you want handled differently.

— vermillion
