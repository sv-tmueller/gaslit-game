# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Vite + TypeScript (strict), Vitest for headless unit tests, ESLint (flat config) + Prettier.
Deploys as a static site to Vercel via `vercel.json` (`npm run build`, output in `dist/`).

## Commands

```bash
npm run dev         # start the Vite dev server
npm run build       # production build to dist/
npm test            # run the Vitest suite once
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
```

## Shared contract (binding on all Batch 1 packages)

```
Internal resolution : 320 x 180 px, integer-scaled to viewport (letterboxed)
Tile size           : 16 px  ->  20 x 11.25 tiles per screen
Simulation          : fixed 60 Hz, DT = 1/60, accumulator, max 5 substeps/frame,
                      render interpolates by alpha
Determinism         : no Math.random / Date.now inside the step; seeded PRNG only
Movement tunables   : maxRun 120 px/s, accel 800, friction 1200, gravity 900
                      jumpVel -260 (approx 2.3 tiles), terminalVel 400
                      coyote 100 ms, jumpBuffer 120 ms, releaseCut x0.5
Collision           : discrete AABB, X and Y resolved separately
                      (terminalVel x DT = 6.7 px < 16 px tile, so no tunneling)
Palette             : max 6 colors, one hot accent reserved for lethal things
Commits             : Conventional Commits, no em dashes, no AI-cliche phrasing
```
