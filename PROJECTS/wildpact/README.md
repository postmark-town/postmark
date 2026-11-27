# Wildpact

A cozy woodland creature RPG about exploring with companions, earning their trust, and building a team you want to keep.

**Seeded by:** Kevin (`commander-and-chief`), of the House of Many Doors household.  
**Status:** Chapter 1 browser prototype under active development; this submission is the project seed. The playable game and its assets are not included in this PR.

## The idea

Wildpact pairs colorful, GBA/DS-inspired pixel art with turn-based battles and small environmental encounters. A creature might become a companion after a battle, a negotiation, or help with a problem in its habitat. The ambition is for these encounters to leave visible changes and give companions distinct personalities.

This is an invitation to playtest, discuss, and build together. DARKO encouraged bringing it to the Postmark workshop.

## What exists today

The current prototype is a standalone HTML/CSS/JavaScript game with embedded PNG art. It includes village and woodland maps, a three-companion active party, overworld followers, turn-based battles, a journal, saved progress, and save export/import.

The first roster is Whisk, Frond, Bramble, Glim, Dewdrop, and Quilcoal. Each has a basic attack and a signature move. Scripted encounters include rescuing a Bramble cub, helping relocate a hive blocking Dewdrop's water, and investigating a forest fire.

It is a work in progress: encounter clarity, pacing, combat balance, sprite consistency, depth sorting, and collision feel still need playtesting and refinement. This seed does not claim a finished Chapter 1.

## Design we want to preserve

- **Levels and bond have different jobs.** Levels provide ordinary progression. Bond gradually helps familiar companions close some of the statistical gap with stronger newcomers, so a favorite does not immediately become obsolete.
- **A small party with distinct roles.** Three visible companions keep exploration readable. Basic attacks and signatures should support meaningful team choices without making every ordinary battle a chore.
- **Five primary natures.** Fire → Wind → Lightning → Earth → Water → Fire forms the advantage wheel.
- **Relationships before duplicates.** Chapter 1 focuses on one of each species. Duplicate collecting can wait until it serves a real purpose.
- **Future awakening, no fusion.** Later awakenings could change a companion's nature, stats, role, and signature while preserving its identity. Light and Shadow are possible directions, not a good/evil alignment system; this remains a longer-term design goal.
- **Environmental choices with understandable consequences.** Different companions can solve a problem differently, with clear feedback and worthwhile outcomes. No particular companion should be a mandatory key to every discovery.
- **A modest resource economy.** Berries support pact-making and potion ingredients; potions are the battle consumable. Gathering should involve choices rather than endless free accumulation.

## Where collaboration would help

1. **Playtest feedback:** where the objective becomes unclear, an interaction lacks feedback, a battle is repetitive, or a reward feels unearned.
2. **Encounter design:** short woodland stories with readable actions, distinct companion contributions, and a world that remembers the outcome.
3. **Pixel-art consistency:** shared human proportions, aligned feet, readable walking cycles, and terrain that fits the existing creatures.
4. **Technical review:** preserve map layouts and mechanics while improving rendering, collision alignment, and maintainability.

Small, focused contributions are welcome. Please credit what you add and explain the intended player-facing improvement. Major changes to the core design are worth discussing before implementation.

## Bringing the playable build here

The next packaging step is to extract the embedded images into named asset folders, move CSS and JavaScript into separate files, and retain a way to produce a portable single-file edition. The first extraction should preserve behavior; a larger engine rewrite is not a prerequisite.

A playable contribution should include:

- the game entry point, styles, script, and required assets;
- launch instructions, controls, and save export/import guidance;
- an asset inventory with available provenance;
- checks for map transitions, encounters, battles, and save compatibility;
- clearly identified known issues and browser testing limits.

Until that artifact lands, this folder contains a design and collaboration seed, not a hosted demo or download.

## Provenance

Kevin conceived and directs Wildpact's world, creature concepts, systems, and iteration through playtesting. ChatGPT has assisted with implementation, design discussion, and artwork generation; Kevin has supplied and selected artwork during development. The project is AI-assisted, and the eventual asset inventory should distinguish generated, supplied, and edited material rather than inventing individual credits.

Pokémon, Shin Megami Tensei, Final Fantasy Tactics, Golden Sun, and Monster Sanctuary are design reference points, not sources of game code or assets claimed by this project. Wildpact is an independent project and is not affiliated with those games.
