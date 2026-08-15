// Level validation harness: reachability and solvability checks (#44).
// BFS flood-fill from spawn through the tile grid using movement constraints
// derived from the real controller physics. Checks every mutation variant,
// not just the base level.
//
// Jump envelope (calibrated to the shipped controller tunables in
// src/engine/controller.ts: maxRun 120, accel 800, jumpVel -260, gravity 900):
//   - Max flat horizontal gap: 4 tiles (64 px), measured by simulation.
//   - Max vertical rise: ~2.35 tiles; we conservatively allow 2 tiles.
//   - Combined jumps trade horizontal range against vertical gain: a jump
//     that rises 2 tiles cannot also cover 4 tiles sideways. We model this
//     as |dc| / MAX_FLAT_GAP + rise / MAX_RISE <= 1.
//   - Drops are unconstrained (gravity assists); lateral drift during a
//     drop is bounded by the same horizontal term.
//   - One-way tiles (id 2) are standable from above and passable from below
//     or the sides. A one-way tile is a valid standing position; the BFS may
//     occupy it. Solids (id 1) block passage. Hazards (id 3) are traversable
//     for reachability purposes (the validator checks geometry, not survival).

import { levelToGrid } from '../engine/levelAdapter';
import { resolveMutations } from '../levels/mutations';
import type { MutableLevelData } from '../levels/mutation-types';
import type { LevelData } from '../levels/types';
import { Tile } from '../levels/types';

export interface ValidationResult {
  reachable: boolean;
  exitReachable: boolean;
  variantResults: VariantResult[];
}

export interface VariantResult {
  attempt: number;
  reachable: boolean;
  exitReachable: boolean;
}

// Maximum horizontal gap (in tiles) the player can clear with a running
// jump at the same elevation. Calibrated by simulating the real controller;
// see docs/level-format.md "Why the jump-gap is 48 px".
const MAX_FLAT_GAP = 4;

// Maximum vertical rise (in tiles) from a standing jump. The controller
// achieves ~2.35 tiles (jumpVel -260, gravity 900); we round down to 2 to
// keep the validator conservative so it never certifies a level the real
// physics cannot solve.
const MAX_RISE = 2;

/**
 * Determines whether a tile is passable for BFS traversal: the player body
 * can occupy or transit this cell. Empty, OneWay and Hazard cells are
 * passable; Solid cells are not.
 */
function isPassable(tile: Tile | undefined): boolean {
  return tile !== Tile.Solid;
}

/**
 * A position (col, row) is "standable" if the tile there is passable (the
 * body can occupy it) AND the tile directly beneath (col, row+1) is Solid
 * or OneWay (the body has a surface to stand on). The player can only
 * initiate a jump or walk from a standable position, and every jump/drop
 * destination must also be standable --- the player must land on something.
 * This prevents the BFS from chaining jumps through mid-air tiles.
 */
function isStandable(grid: { cols: number; rows: number; tiles: readonly Tile[] }, col: number, row: number): boolean {
  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return false;
  const here = grid.tiles[row * grid.cols + col];
  if (!isPassable(here)) return false;
  if (row + 1 >= grid.rows) return false; // floor of the world
  const below = grid.tiles[(row + 1) * grid.cols + col];
  return below === Tile.Solid || below === Tile.OneWay;
}

/**
 * Generates reachable neighbor offsets given the physics jump envelope.
 *
 * Movement primitives:
 *  - Walk: 1 tile horizontally at the same row.
 *  - Running jump (flat): up to MAX_FLAT_GAP tiles horizontally at the same
 *    row, decaying as vertical rise increases.
 *  - Vertical jump: up to MAX_RISE tiles straight up (dc=0).
 *  - Drop: any number of rows downward (gravity-assisted), with up to
 *    MAX_FLAT_GAP tiles of lateral drift scaled by the drop's horizontal
 *    allowance.
 *
 * The combined horizontal+vertical envelope for upward jumps is:
 *   |dc| / MAX_FLAT_GAP + rise / MAX_RISE <= 1
 * ensuring a max-rise jump (2 tiles up) permits little lateral travel, while
 * a flat jump (0 rise) permits the full MAX_FLAT_GAP.
 */
function jumpNeighbors(): Array<{ dc: number; dr: number }> {
  const neighbors: Array<{ dc: number; dr: number }> = [];

  // Walking: 1 tile left/right at the same row.
  neighbors.push({ dc: -1, dr: 0 });
  neighbors.push({ dc: 1, dr: 0 });

  // Upward and level jumps: rise in [0..MAX_RISE], lateral in [-MAX_FLAT_GAP..MAX_FLAT_GAP],
  // constrained by the combined envelope.
  for (let rise = 0; rise <= MAX_RISE; rise++) {
    const maxLat = Math.floor(MAX_FLAT_GAP * (1 - rise / MAX_RISE));
    for (let lat = -maxLat; lat <= maxLat; lat++) {
      if (lat === 0 && rise === 0) continue; // already covered by walking
      neighbors.push({ dc: lat, dr: -rise });
    }
  }

  // Downward drops: any depth, lateral drift up to MAX_FLAT_GAP tiles.
  // Gravity accelerates the fall so deep drops still allow some lateral
  // travel; we cap lateral at MAX_FLAT_GAP for conservatism.
  for (let drop = 1; drop <= 24; drop++) {
    for (let lat = -MAX_FLAT_GAP; lat <= MAX_FLAT_GAP; lat++) {
      neighbors.push({ dc: lat, dr: drop });
    }
  }

  return neighbors;
}

const NEIGHBORS = jumpNeighbors();

export function validateReachability(level: LevelData): boolean {
  // Physics-calibrated BFS: can the player walk/jump/drop from spawn to exit
  // using the real controller's jump envelope? One-way platforms are standable;
  // solids block; hazards are geometrically passable.
  //
  // Key constraint: the player can only jump or walk from a standable position
  // (a passable tile with a solid/one-way surface beneath it), and every jump
  // or drop destination must also be standable. This prevents the BFS from
  // chaining jumps through mid-air tiles --- the player must land on something
  // before jumping again.
  const grid = levelToGrid(level);
  const visited = new Set<string>();

  // Seed: the spawn position. If the spawn isn't standable (floating in open
  // space with no floor beneath), the level is vacuously unreachable.
  if (!isStandable(grid, level.spawn.col, level.spawn.row)) return false;

  const queue: Array<{ col: number; row: number }> = [
    { col: level.spawn.col, row: level.spawn.row },
  ];
  visited.add(`${level.spawn.col},${level.spawn.row}`);

  while (queue.length > 0) {
    const { col, row } = queue.shift()!;
    if (col === level.exit.col && row === level.exit.row) return true;

    for (const { dc, dr } of NEIGHBORS) {
      const nc = col + dc;
      const nr = row + dr;
      const key = `${nc},${nr}`;
      if (visited.has(key)) continue;
      if (nc < 0 || nc >= grid.cols || nr < 0 || nr >= grid.rows) continue;

      // Destination must be standable: the player has to land on a surface.
      if (!isStandable(grid, nc, nr)) continue;

      // For upward jumps, ensure the arc isn't blocked by a solid ceiling
      // directly above the launch tile. A solid tile immediately above the
      // source blocks pure vertical jumps; we approximate by skipping jumps
      // that rise through a solid in the source column.
      if (dr < 0) {
        let blocked = false;
        for (let r = row - 1; r >= nr; r--) {
          const t = grid.tiles[r * grid.cols + col];
          if (t === Tile.Solid) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
      }

      visited.add(key);
      queue.push({ col: nc, row: nr });
    }
  }

  return false;
}

export function validateAllVariants(level: MutableLevelData, maxAttempts: number = 10): ValidationResult {
  const variants: VariantResult[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const variant = resolveMutations(level, attempt);
    const reachable = validateReachability(variant);
    variants.push({ attempt, reachable, exitReachable: reachable });

    // Stop early if no mutations beyond this attempt
    const hasMoreMutations = (level.mutations ?? []).some((m) => m.attempt > attempt);
    if (!hasMoreMutations && attempt > 1) break;
  }

  const allReachable = variants.every((v) => v.reachable);
  return {
    reachable: allReachable,
    exitReachable: allReachable,
    variantResults: variants,
  };
}
