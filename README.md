# Gaslit

A trap platformer where the level lies to you between attempts.

This project is pre-alpha. There is no playable build and no public URL yet. Everything below describes what is being built and why, not a finished game.

## Inspiration and originality

Gaslit's genre is the trap platformer popularized by *Level Devil* (Unept): short levels, instant death, and traps disguised as normal level geometry. That game is the inspiration for the genre and for the general shape of "read the room or die."

All code, art, audio, and level designs in this repository are original. Nothing here is copied, decompiled, or derived from *Level Devil* or any other game.

## The mechanic

Gaslit's difference from other trap platformers is that the level itself is not fixed. Traps and level elements can mutate between attempts, and the game denies that anything changed. The player has to notice the mutation, not just react fast enough.

That idea only works if it stays fair, so three guardrails hold at all times:

1. Mutations apply at level start only. The level never changes under your feet mid-run.
2. Every mutated element is on screen and readable before the player can commit to it. The lie is about memory, never about reaction time.
3. A mutation may never make a level unsolvable.

## Stack and reasoning

Vanilla TypeScript and Canvas2D, built with Vite, tested with Vitest.

The game runs a fixed 320x180 backbuffer scaled to the viewport, on a deterministic fixed-step 60 Hz simulation driven by a seeded PRNG. The mutation system depends on that determinism: a run has to be reproducible from its seed, and the validation harness planned for M8 needs to replay attempts exactly. Getting that requires direct control over the render loop, the step, and the source of randomness. An engine like Phaser solves problems this project does not have and would add more surface area than it removes at this scope.

## Build, run, test

```
npm install
npm run dev        # local dev server
npm run build       # production build
npm run test        # unit tests
npm run lint         # lint
npm run typecheck    # type checking
```

These are the five scripts the project ships. If the tooling package (#1) has not merged yet, treat the commands above as the intended interface rather than a working one.

## Roadmap

The game roadmap runs across nine milestones. Issue contents under each milestone are subject to change; issues labeled `roadmap` are placeholders, not commitments.

- [M1 - Foundations](https://github.com/sv-tmueller/gaslit-game/milestone/1): Engine primitives, level format, visual identity, deployed shell.
- [M2 - Playable core](https://github.com/sv-tmueller/gaslit-game/milestone/2): Move, jump, die, respawn, reach the door.
- [M3 - Trap system](https://github.com/sv-tmueller/gaslit-game/milestone/3): The trap architecture the remaining levels are built on.
- [M4 - Gaslighting layer](https://github.com/sv-tmueller/gaslit-game/milestone/4): The signature mechanic, levels mutate between attempts while the game denies it.
- [M5 - MVP](https://github.com/sv-tmueller/gaslit-game/milestone/5): Shipped, playable, at a public URL. 15 levels.
- [M6 - Tier 2 mechanics](https://github.com/sv-tmueller/gaslit-game/milestone/6): Gravity inversion, bombs, levers, jetpack, saws, springs.
- [M7 - Tier 3 mechanics and meta-trolls](https://github.com/sv-tmueller/gaslit-game/milestone/7): Rotating hazards, moving terrain, control/camera/UI trolls.
- [M8 - Authoring and content scale](https://github.com/sv-tmueller/gaslit-game/milestone/8): Editor, validation harness, replays, and 30 more levels.
- [M9 - Polish and ship](https://github.com/sv-tmueller/gaslit-game/milestone/9): Touch, accessibility, performance, PWA, analytics, sharing.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licensing

Code is licensed under MIT, see [LICENSE](LICENSE). Art, audio, level designs, and the Gaslit name are all rights reserved, see [ASSETS-LICENSE](ASSETS-LICENSE). A plain-language explanation of what that split means in practice is at [docs/licensing.md](docs/licensing.md).
