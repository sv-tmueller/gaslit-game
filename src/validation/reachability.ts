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
//
// Mechanics extensions (#129 checkpoint 7):
//   - Springs expand the jump envelope from the spring's tile based on the
//     impulse magnitude.
//   - Teleporters create guaranteed edges between teleporter and destination
//     tiles. Bidirectional pairs add reciprocal edges.
//   - Moving platforms make both endpoint positions standable in the BFS grid.
//   - Gravity zones flip jump/drop directions and standable-surface semantics
//     within the covered region.

import { levelToGrid } from '../engine/levelAdapter';
import { resolveMutations } from '../levels/mutations';
import type { MutableLevelData } from '../levels/mutation-types';
import type { JsonValue, LevelData, MechanicEntry } from '../levels/types';
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

// ---------------------------------------------------------------------------
// Physics constants (mirror src/engine/controller.ts)
// ---------------------------------------------------------------------------

const TILE_SIZE = 16;

// Maximum horizontal gap (in tiles) the player can clear with a running
// jump at the same elevation. Calibrated by simulating the real controller;
// see docs/level-format.md "Why the jump-gap is 48 px".
const MAX_FLAT_GAP = 4;

// Maximum vertical rise (in tiles) from a standing jump. The controller
// achieves ~2.35 tiles (jumpVel -260, gravity 900); we round down to 2 to
// keep the validator conservative so it never certifies a level the real
// physics cannot solve.
const MAX_RISE = 2;

// Controller tunables mirrored from src/engine/controller.ts. Kept as locals
// so the validator stays independent of the engine module's export graph.
const CONTROLLER_GRAVITY = 900;

// ---------------------------------------------------------------------------
// Grid wrapper with optional standable overrides (moving platforms) and
// gravity-zone awareness.
// ---------------------------------------------------------------------------

/**
 * Internal grid representation that augments the base tile grid with:
 *  - extraStandable: cells made standable by moving platforms (both endpoints)
 *  - gravityZones: regions where jump/drop directions are inverted
 */
interface ValidatorGrid {
  cols: number;
  rows: number;
  tiles: readonly Tile[];
  extraStandable: Set<string>;
  gravityZones: GravityZone[];
}

interface GravityZone {
  /** Inclusive top-left corner, in tile coords. */
  colMin: number;
  rowMin: number;
  /** Exclusive bottom-right corner, in tile coords. */
  colMax: number; // exclusive
  rowMax: number; // exclusive
}

function gridKey(col: number, row: number): string {
  return `${col},${row}`;
}

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
 *
 * If the cell is in the `extraStandable` set (placed by a moving platform),
 * it is considered standable regardless of the underlying tile.
 *
 * Inside a gravity zone, "beneath" becomes "above": the surface must be at
 * (col, row-1) instead of (col, row+1).
 */
function isStandable(
  grid: ValidatorGrid,
  col: number,
  row: number,
): boolean {
  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) return false;

  // Moving-platform overrides: the platform makes this cell standable.
  if (grid.extraStandable.has(gridKey(col, row))) return true;

  const here = grid.tiles[row * grid.cols + col];
  if (!isPassable(here)) return false;

  const inverted = isInvertedRegion(grid, col, row);

  if (!inverted) {
    // Normal gravity: surface must be below.
    if (row + 1 >= grid.rows) return false; // floor of the world
    const below = grid.tiles[(row + 1) * grid.cols + col];
    return below === Tile.Solid || below === Tile.OneWay;
  } else {
    // Inverted gravity: surface must be above.
    if (row - 1 < 0) return false; // ceiling of the world
    const above = grid.tiles[(row - 1) * grid.cols + col];
    return above === Tile.Solid || above === Tile.OneWay;
  }
}

/**
 * Returns true if (col, row) falls inside any gravity zone on the grid.
 */
function isInvertedRegion(grid: ValidatorGrid, col: number, row: number): boolean {
  for (const zone of grid.gravityZones) {
    if (col >= zone.colMin && col < zone.colMax &&
        row >= zone.rowMin && row < zone.rowMax) {
      return true;
    }
  }
  return false;
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

/**
 * Like {@link jumpNeighbors} but with an expanded vertical rise for springs.
 * Produces neighbor offsets for a spring launch: lateral range scales with
 * the expanded envelope, and the rise can go much higher than MAX_RISE.
 *
 * The spring's effective max rise (in tiles) replaces MAX_RISE in the
 * envelope formula:
 *   |dc| / MAX_FLAT_GAP + rise / springRise <= 1
 *
 * Since springs overwrite vy (not additive), the player effectively gets a
 * fresh jump from the spring tile with the spring's impulse as the takeoff
 * velocity. We compute the peak height from |impulseY| the same way the
 * controller computes the normal jump peak.
 */
function springLaunchNeighbors(springRiseTiles: number): Array<{ dc: number; dr: number }> {
  const neighbors: Array<{ dc: number; dr: number }> = [];
  const maxRise = Math.max(1, Math.floor(springRiseTiles));

  for (let rise = 0; rise <= maxRise; rise++) {
    const fraction = maxRise > 0 ? rise / maxRise : 0;
    const maxLat = Math.floor(MAX_FLAT_GAP * (1 - fraction));
    for (let lat = -maxLat; lat <= maxLat; lat++) {
      if (lat === 0 && rise === 0) continue; // trivial
      neighbors.push({ dc: lat, dr: -rise });
    }
  }

  // Springs also allow drops (player can walk off after landing on the spring tile).
  for (let drop = 1; drop <= 24; drop++) {
    for (let lat = -MAX_FLAT_GAP; lat <= MAX_FLAT_GAP; lat++) {
      neighbors.push({ dc: lat, dr: drop });
    }
  }

  return neighbors;
}

const NEIGHBORS = jumpNeighbors();

// ---------------------------------------------------------------------------
// Mechanic parsing helpers
// ---------------------------------------------------------------------------

function numParam(params: Readonly<Record<string, JsonValue>>, key: string): number | undefined {
  const v = params[key];
  return typeof v === 'number' ? v : undefined;
}

function boolParam(
  params: Readonly<Record<string, JsonValue>>,
  key: string,
  defaultValue: boolean,
): boolean {
  const v = params[key];
  return typeof v === 'boolean' ? v : defaultValue;
}

/** Converts a pixel-space coordinate to a tile coordinate (floor division). */
function pxToTile(px: number): number {
  return Math.floor(px / TILE_SIZE);
}

// ---------------------------------------------------------------------------
// Mechanic extraction structures
// ---------------------------------------------------------------------------

interface SpringInfo {
  /** Tile coordinates of the spring. */
  col: number;
  row: number;
  /** Effective rise in tiles computed from |impulseY|. */
  riseTiles: number;
}

interface TeleporterInfo {
  /** Source tile coordinates. */
  srcCol: number;
  srcRow: number;
  /** Destination tile coordinates. */
  destCol: number;
  destRow: number;
  oneWay: boolean;
}

interface MovingTerrainInfo {
  /** Endpoint A tile coordinates. */
  aCol: number;
  aRow: number;
  /** Endpoint B tile coordinates. */
  bCol: number;
  bRow: number;
}

interface GravityZoneInfo {
  colMin: number;
  rowMin: number;
  colMax: number;
  rowMax: number;
}

interface ExtractedMechanics {
  springs: SpringInfo[];
  teleporters: TeleporterInfo[];
  movingTerrain: MovingTerrainInfo[];
  gravityZones: GravityZoneInfo[];
}

/**
 * Computes the peak rise (in tiles) from a vertical impulse.
 *
 * The controller's normal jump reaches peak when vy = 0:
 *   steps_to_apex = |impulseY| / gravity
 *   peak_height_px = |impulseY| * steps_to_apex / 2  (kinematic: v²/(2g))
 *   peak_tiles = peak_height_px / TILE_SIZE
 *
 * This is the same relationship that calibrates MAX_RISE from JUMP_VEL=-260,
 * GRAVITY=900: 260² / (2 * 900) = 37.6 px ≈ 2.35 tiles.
 */
function computeSpringRiseTiles(impulseY: number): number {
  const absImpulse = Math.abs(impulseY);
  const peakPx = (absImpulse * absImpulse) / (2 * CONTROLLER_GRAVITY);
  return peakPx / TILE_SIZE;
}

/**
 * Extracts mechanics info from the level's optional `mechanics` array.
 * Unknown mechanic types are silently skipped—the validator only models
 * mechanics that affect pathfinding geometry.
 */
function extractMechanics(level: LevelData): ExtractedMechanics {
  const result: ExtractedMechanics = {
    springs: [],
    teleporters: [],
    movingTerrain: [],
    gravityZones: [],
  };

  const mechanics = level.mechanics;
  if (!mechanics || mechanics.length === 0) return result;

  for (const entry of mechanics) {
    switch (entry.type) {
      case 'spring':
        extractSpring(entry, result);
        break;
      case 'teleporter':
        extractTeleporter(entry, result);
        break;
      case 'moving-platform':
        extractMovingPlatform(entry, result);
        break;
      case 'gravity-zone':
        extractGravityZone(entry, result);
        break;
      default:
        // Unrecognized mechanic type — not pathfinding-relevant.
        break;
    }
  }

  return result;
}

function extractSpring(entry: MechanicEntry, result: ExtractedMechanics): void {
  const x = numParam(entry.params, 'x');
  const y = numParam(entry.params, 'y');
  const impulseY = numParam(entry.params, 'impulseY');
  if (x === undefined || y === undefined || impulseY === undefined) return;

  result.springs.push({
    col: pxToTile(x),
    row: pxToTile(y),
    riseTiles: computeSpringRiseTiles(impulseY),
  });
}

function extractTeleporter(entry: MechanicEntry, result: ExtractedMechanics): void {
  const x = numParam(entry.params, 'x');
  const y = numParam(entry.params, 'y');
  const destX = numParam(entry.params, 'destX');
  const destY = numParam(entry.params, 'destY');
  if (x === undefined || y === undefined ||
      destX === undefined || destY === undefined) return;

  const oneWay = boolParam(entry.params, 'oneWay', false);

  result.teleporters.push({
    srcCol: pxToTile(x),
    srcRow: pxToTile(y),
    destCol: pxToTile(destX),
    destRow: pxToTile(destY),
    oneWay,
  });
}

function extractMovingPlatform(entry: MechanicEntry, result: ExtractedMechanics): void {
  const startX = numParam(entry.params, 'startX');
  const startY = numParam(entry.params, 'startY');
  const dx = numParam(entry.params, 'dx');
  const dy = numParam(entry.params, 'dy');
  const distance = numParam(entry.params, 'distance');
  if (startX === undefined || startY === undefined ||
      dx === undefined || dy === undefined ||
      distance === undefined) return;

  // Normalize the direction vector.
  const len = Math.hypot(dx, dy) || 1;
  const ndx = dx / len;
  const ndy = dy / len;

  // Endpoint A: the start position.
  const aCol = pxToTile(startX);
  const aRow = pxToTile(startY);

  // Endpoint B: start + normalized_dir * distance.
  const endX = startX + ndx * distance;
  const endY = startY + ndy * distance;
  const bCol = pxToTile(endX);
  const bRow = pxToTile(endY);

  result.movingTerrain.push({ aCol, aRow, bCol, bRow });
}

function extractGravityZone(entry: MechanicEntry, result: ExtractedMechanics): void {
  // Gravity zones are defined by rectangular regions in tile or pixel space.
  // We accept either pixel coords (x, y, width, height) or tile coords
  // (col, row, cols, rows). Pixel coords are the canonical form since
  // mechanics operate in pixel space.
  const x = numParam(entry.params, 'x');
  const y = numParam(entry.params, 'y');
  const width = numParam(entry.params, 'width');
  const height = numParam(entry.params, 'height');

  if (x !== undefined && y !== undefined &&
      width !== undefined && height !== undefined) {
    const colMin = pxToTile(x);
    const rowMin = pxToTile(y);
    const colMax = pxToTile(x + width);
    const rowMax = pxToTile(y + height);
    result.gravityZones.push({ colMin, rowMin, colMax, rowMax });
    return;
  }

  // Fall back to tile-coord specification.
  const col = numParam(entry.params, 'col');
  const row = numParam(entry.params, 'row');
  const cols = numParam(entry.params, 'cols');
  const rows = numParam(entry.params, 'rows');
  if (col !== undefined && row !== undefined &&
      cols !== undefined && rows !== undefined) {
    result.gravityZones.push({
      colMin: col,
      rowMin: row,
      colMax: col + cols,
      rowMax: row + rows,
    });
  }
}

// ---------------------------------------------------------------------------
// Core BFS
// ---------------------------------------------------------------------------

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
  //
  // Mechanics (#129 cp7): springs, teleporters, moving platforms, and gravity
  // zones augment the BFS graph. See extractMechanics for details.

  const baseGrid = levelToGrid(level);
  const mech = extractMechanics(level);

  // Build the validator grid with moving-platform standable overrides and
  // gravity zones.
  const extraStandable = new Set<string>();
  for (const mt of mech.movingTerrain) {
    extraStandable.add(gridKey(mt.aCol, mt.aRow));
    extraStandable.add(gridKey(mt.bCol, mt.bRow));
  }

  const grid: ValidatorGrid = {
    cols: baseGrid.cols,
    rows: baseGrid.rows,
    tiles: baseGrid.tiles,
    extraStandable,
    gravityZones: mech.gravityZones,
  };

  // Pre-compute spring launch neighbor sets keyed by spring tile.
  const springCache = new Map<string, Array<{ dc: number; dr: number }>>();
  for (const sp of mech.springs) {
    const k = gridKey(sp.col, sp.row);
    if (!springCache.has(k)) {
      springCache.set(k, springLaunchNeighbors(sp.riseTiles));
    }
  }

  // Pre-build teleporter adjacency: for each teleporter tile, a list of
  // destination tiles. Reciprocal edges are added for bidirectional pairs.
  const teleportEdges = new Map<string, Array<{ col: number; row: number }>>();
  for (const tp of mech.teleporters) {
    const srcKey = gridKey(tp.srcCol, tp.srcRow);
    const dest = { col: tp.destCol, row: tp.destRow };
    const list = teleportEdges.get(srcKey) ?? [];
    list.push(dest);
    teleportEdges.set(srcKey, list);

    // Bidirectional: if not oneWay, also add reverse edge.
    if (!tp.oneWay) {
      const destKey = gridKey(tp.destCol, tp.destRow);
      const revList = teleportEdges.get(destKey) ?? [];
      revList.push({ col: tp.srcCol, row: tp.srcRow });
      teleportEdges.set(destKey, revList);
    }
  }

  // Pre-build moving-platform ride edges: the player can ride a platform
  // between its two endpoint positions. This connects the two standable
  // cells that the platform creates.
  const platformEdges = new Map<string, Array<{ col: number; row: number }>>();
  for (const mt of mech.movingTerrain) {
    const aKey = gridKey(mt.aCol, mt.aRow);
    const bKey = gridKey(mt.bCol, mt.bRow);
    if (aKey === bKey) continue; // degenerate platform (zero distance)

    const aList = platformEdges.get(aKey) ?? [];
    aList.push({ col: mt.bCol, row: mt.bRow });
    platformEdges.set(aKey, aList);

    const bList = platformEdges.get(bKey) ?? [];
    bList.push({ col: mt.aCol, row: mt.aRow });
    platformEdges.set(bKey, bList);
  }

  const visited = new Set<string>();

  // Seed: the spawn position. If the spawn isn't standable (floating in open
  // space with no floor beneath), the level is vacuously unreachable.
  if (!isStandable(grid, level.spawn.col, level.spawn.row)) return false;

  const queue: Array<{ col: number; row: number }> = [
    { col: level.spawn.col, row: level.spawn.row },
  ];
  visited.add(gridKey(level.spawn.col, level.spawn.row));

  while (queue.length > 0) {
    const { col, row } = queue.shift()!;
    if (col === level.exit.col && row === level.exit.row) return true;

    const posKey = gridKey(col, row);
    const inverted = isInvertedRegion(grid, col, row);

    // Determine which neighbor set applies at this position.
    // Springs override the normal jump envelope if the player is on the
    // spring tile. Otherwise use the standard physics neighbors.
    let neighbors: Array<{ dc: number; dr: number }>;

    // Choose neighbor set: spring takes precedence if present.
    const springNbrs = springCache.get(posKey);
    if (springNbrs) {
      neighbors = springNbrs;
    } else {
      neighbors = NEIGHBORS;
    }

    // Apply gravity inversion: flip dr signs within inverted regions.
    if (inverted) {
      neighbors = neighbors.map(({ dc, dr }) => ({ dc, dr: -dr }));
    }

    for (const { dc, dr } of neighbors) {
      const nc = col + dc;
      const nr = row + dr;
      const nKey = gridKey(nc, nr);
      if (visited.has(nKey)) continue;
      if (nc < 0 || nc >= grid.cols || nr < 0 || nr >= grid.rows) continue;

      // Destination must be standable: the player has to land on a surface.
      if (!isStandable(grid, nc, nr)) continue;

      // Ceiling/floor obstruction check for upward (or inverted-downward) jumps.
      // In normal gravity, dr < 0 means rising; in inverted gravity, the
      // "rising" direction is dr > 0. We check for solids blocking the arc
      // in the direction of vertical travel.
      const verticalTravel = inverted ? -dr : dr;
      if (verticalTravel < 0) {
        let blocked = false;
        // Check tiles between source and destination in the source column.
        const step = nr < row ? -1 : 1;
        for (let r = row + step; ; r += step) {
          if (r === nr) break;
          if (r < 0 || r >= grid.rows) break;
          const t = grid.tiles[r * grid.cols + col];
          if (t === Tile.Solid) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
      }

      visited.add(nKey);
      queue.push({ col: nc, row: nr });
    }

    // Teleporter edges: guaranteed transitions from the teleporter tile to
    // the destination tile (if standable). These are independent of the
    // physical jump/drop neighbors.
    const tpDestinations = teleportEdges.get(posKey);
    if (tpDestinations) {
      for (const dest of tpDestinations) {
        const dKey = gridKey(dest.col, dest.row);
        if (visited.has(dKey)) continue;
        if (dest.col < 0 || dest.col >= grid.cols ||
            dest.row < 0 || dest.row >= grid.rows) continue;
        if (!isStandable(grid, dest.col, dest.row)) continue;
        visited.add(dKey);
        queue.push({ col: dest.col, row: dest.row });
      }
    }

    // Moving-platform ride edges: the player can ride the platform from one
    // endpoint to the other. Both endpoints are standable (via the
    // extraStandable set), so the ride is a guaranteed edge.
    const platDests = platformEdges.get(posKey);
    if (platDests) {
      for (const dest of platDests) {
        const dKey = gridKey(dest.col, dest.row);
        if (visited.has(dKey)) continue;
        if (dest.col < 0 || dest.col >= grid.cols ||
            dest.row < 0 || dest.row >= grid.rows) continue;
        if (!isStandable(grid, dest.col, dest.row)) continue;
        visited.add(dKey);
        queue.push({ col: dest.col, row: dest.row });
      }
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
