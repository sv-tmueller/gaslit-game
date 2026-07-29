# Level format

A level is a JSON document describing one screen (or more) of Gaslit: grid
dimensions, a tile layer, a spawn point, an exit door and a `traps` array.
The format is authored, loaded and validated entirely by `src/levels/`,
which owns and exports its own `LevelData` types and does not depend on any
other package (no import from `src/engine/`, `src/tools/`, or anywhere else).

Tile size is 16 px and the internal play area is 320 x 180 px, per the
shared contract in the repo's `CLAUDE.md`. `320 / 16 = 20` columns exactly;
`180 / 16 = 11.25`, so no whole-tile grid matches the viewport height, and
single-screen levels use 12 rows (192 px, the smallest whole-tile height
that fully covers 180 px).

## Complete annotated example

```json
{
  "name": "jump-gap",
  "cols": 20,
  "rows": 12,
  "spawn": { "col": 2, "row": 9 },
  "exit": { "col": 17, "row": 9 },
  "tiles": [
    "11111111111111111111",
    "10000000000000000001",
    "10000000000000000001",
    "10000000000000000001",
    "10000000000000000001",
    "10000000000000000001",
    "10000000000000000001",
    "10000000000000000001",
    "10000000000000000001",
    "10000000000000000001",
    "11111111100011111111",
    "11111111133311111111"
  ],
  "traps": [
    {
      "id": "lip-spike",
      "type": "retracting-spike",
      "trigger": "on-enter",
      "params": { "col": 12, "row": 9, "delayMs": 200 }
    }
  ]
}
```

## Fields

- **`name`** (`string`, required, non-empty): identifies the level. Used in
  thrown validation errors (`level "jump-gap" failed validation: ...`) and as
  the fixture manifest key. Not a structural field: nothing else in the
  format depends on it.
- **`cols`, `rows`** (`number`, required): grid dimensions in tiles. Must be
  integers from 1 to 1024 (`MAX_GRID_DIMENSION`).
- **`spawn`, `exit`** (`{ col, row }`, required): the tile the entity's
  bottom-left corner occupies. `row: 9` above a floor at `row: 10` means
  standing on the floor. Sprite footprint is the renderer's problem, so
  neither carries a width or height. Both must be in bounds: `0 <= col <
cols` and `0 <= row < rows`.
- **`tiles`** (array of row strings, required): one string per row, one
  character per column, top to bottom. Chosen over a flat number array so a
  hand-authored level reads as an ASCII map and diffs cleanly (Prettier's
  `printWidth: 100` puts one row per line). Loaded into a flat, row-major
  `readonly Tile[]` of length `cols * rows`, indexed `row * cols + col`,
  which is the shape the engine wants. Every row must be exactly `cols`
  characters long, and every character must be a known tile id (see below).
- **`traps`** (array, required, may be empty): structurally validated only.
  Each entry is:
  - **`id`** (`string`, non-empty): trap identifier, unique within the level.
    A second entry reusing an id already seen earlier in the array is
    rejected with `duplicate-trap-id`.
  - **`type`** (`string`, non-empty): not checked against any registry.
    Later batches implement trap behavior; this package only carries the
    field through so the format is stable before a single trap exists.
  - **`trigger`** (`string`, non-empty): opaque to this package.
  - **`params`** (plain object, optional): arbitrary JSON, carried through by
    reference, unchanged. No clone, no freeze. Omit it entirely for traps
    that take no parameters; a level author does not have to write
    `"params": {}`.

  The validator rebuilds each trap entry as a fresh `{ id, type, trigger,
params }` object. `params` is carried through unchanged (reference-equal
  to the source value); any other key present on a source trap entry is
  silently dropped.

## Tile ids

| id  | name    | meaning                               |
| --- | ------- | ------------------------------------- |
| 0   | empty   | passable, no collision                |
| 1   | solid   | blocks movement on all sides          |
| 2   | one-way | passable from below, solid from above |
| 3   | hazard  | lethal on contact                     |

## Loading and validation

```ts
import { loadLevel, parseLevel, tileAt } from './src/levels';

const result = parseLevel(source); // never throws
if (!result.ok) {
  for (const e of result.errors) console.error(`${e.path}: ${e.message}`);
}

const level = loadLevel(source); // throws LevelValidationError
```

Validation runs in two stages:

1. **Shape and dimensions.** The source must be a plain object with a valid
   `name`, `cols` and `rows`. If this stage produces any error, `parseLevel`
   returns immediately with only those errors. A `cols: 0` document does not
   go on to cascade into hundreds of `tiles[..]` errors.
2. **Content.** `spawn`, `exit`, `tiles` and `traps` are each validated
   independently, and every error found across all four is collected and
   returned together. Fixing one authoring typo per validation run is a bad
   loop for whoever hand-authors levels.

`loadLevel` wraps `parseLevel` and throws a `LevelValidationError` (carrying
the full `errors` array) on any failure, for call sites that want to fail
fast instead of branching on `result.ok`.

`tileAt(level, col, row)` returns the tile at a column and row, or
`Tile.Empty` if the coordinates are out of bounds. It deliberately duplicates
the physics helper of the same name in `src/engine/physics.ts`: this package
must not import from `src/engine/`, and `noUncheckedIndexedAccess` would
otherwise force every caller here to write `?? Tile.Empty` at the call site.

## Errors

Each error names the offending field with a dotted or indexed `path` (for
example `traps[1].trigger`) plus a human-readable `message`. There are six
failure modes an author will hit while authoring a level, each producing a
distinct error code:

| Fault                                 | code                 | path               | message                                                                                      |
| ------------------------------------- | -------------------- | ------------------ | -------------------------------------------------------------------------------------------- |
| `cols: 0`                             | `bad-dimensions`     | `cols`             | `cols: expected an integer from 1 to 1024, got 0`                                            |
| missing `spawn`                       | `missing-spawn`      | `spawn`            | `spawn: required field is missing`                                                           |
| missing `exit`                        | `missing-exit`       | `exit`             | `exit: required field is missing`                                                            |
| `exit: { col: 20, row: 5 }` (20x12)   | `exit-out-of-bounds` | `exit.col`         | `exit.col: 20 is outside the 20 x 12 grid, valid columns are 0 to 19`                        |
| a `7` inside a tile row               | `unknown-tile`       | `tiles[3][5]`      | `tiles[3][5]: unknown tile id "7", expected 0 (empty), 1 (solid), 2 (one-way) or 3 (hazard)` |
| `traps: [{ id: 'a', type: 'spike' }]` | `malformed-trap`     | `traps[0].trigger` | `traps[0].trigger: expected a non-empty string, got undefined`                               |

A few more codes exist beyond this table for completeness (`not-an-object`,
`bad-name`, `spawn-out-of-bounds`), following the same naming and message
conventions, plus `duplicate-trap-id`: two traps sharing an `id` produce a
single error at the path of the second (or any later) offending entry, for
example `traps[1].id`.

Note the off-by-one in row four of the table: `cols: 20` means column `20`
is the first invalid index, so `exit.col: 20` is out of bounds against a
20-column grid.

## Fixtures

Three hand-authored levels ship under `src/levels/fixtures/`, exported by
`FIXTURE_SOURCES` (`src/levels/fixtures/index.ts`) keyed by name, as the raw
`unknown` JSON documents `loadLevel`/`parseLevel` expect:

- **`corridor.json`**, 20 x 12. Row 0 solid ceiling, rows 1 to 9 walled at
  columns 0 and 19, rows 10 and 11 all solid. Spawn `(2, 9)`, exit
  `(17, 9)`, 240 px of flat walking. `traps: []`.
- **`jump-gap.json`**, 20 x 12. Same shell, with columns 9 to 11 cut out of
  row 10 and set to hazard (id 3) in row 11: a 48 px (3 tile) gap. Left lip
  at x = 144, far lip at x = 192. Carries one trap entry so the fixtures
  exercise the trap path.
- **`shaft.json`**, 20 x 24 (320 x 384 px, just over two screens tall).
  Solid perimeter, floor at row 22. Ten one-way ledges (id 2) at rows 20,
  18, 16, 14, 12, 10, 8, 6, 4, 2, alternating between columns 1 to 8 and
  columns 11 to 18. Spawn `(2, 21)`, exit `(4, 1)`.

Between them the three fixtures use all four tile ids: `corridor.json` and
`jump-gap.json` cover empty, solid and hazard; `shaft.json` covers one-way.

### Why the jump-gap is 48 px

The shipped controller and collision code (`stepController`,
`moveAndCollide`) were simulated at the contract's movement tunables,
stepping in the real order: gravity, then jump impulse, then integrate, X
resolved before Y. The measured max clearable flat gap is 64 px (4 tiles);
80 px fails. The jump-gap fixture uses 48 px, clearable with a full tile of
margin, and not walkable. This number is load-bearing: do not change it
without re-simulating the controller.

## Non-goals

- No level editor.
- No rendering of levels.
- No trap behavior or trap type registry. `traps[].type` is not checked
  against any registry; entries are validated structurally, and `params` is
  preserved by reference. Any key on a trap entry other than `id`, `type`,
  `trigger` and `params` is dropped.
- No compression or binary format.
- No `mutations:` section. The level format will be extended for
  attempt-keyed deltas in M4, deliberately not designed ahead of its use.
- No reachability or solvability checking. Whether a level's spawn can
  actually reach its exit is issue #44 (roadmap), not this package.
