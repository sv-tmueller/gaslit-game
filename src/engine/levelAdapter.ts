import { Tile as PhysTile, type AABB, type TileGrid } from './physics';
import { Tile as LvlTile, type LevelData } from '../levels/types';

const TILE_SIZE = 16;

export interface HazardRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Translates a loaded LevelData tile layer into the TileGrid the collision
 * resolver consumes. LevelTile.Hazard (3) becomes PhysTile.Empty (0) so the
 * body passes through hazard tiles freely; the damage query (overlapsHazard)
 * decides lethality. Solid, OneWay and Empty pass through unchanged.
 *
 * Engine imports levels, never the reverse: this module sits in src/engine/
 * to avoid the dependency-direction rule documented in load.ts.
 */
export function levelToGrid(level: LevelData): TileGrid {
  const tiles: PhysTile[] = [];

  for (const tile of level.tiles) {
    if (tile === LvlTile.Hazard) {
      tiles.push(PhysTile.Empty);
    } else {
      // 0|1|2 values coincide numerically; narrowing removes the Hazard member.
      tiles.push(tile as PhysTile);
    }
  }

  return { cols: level.cols, rows: level.rows, tiles };
}

/**
 * Single pass collecting pixel-space rectangles for every Hazard tile.
 * Each rect is 16x16 positioned at (col*TILE_SIZE, row*TILE_SIZE).
 */
export function collectHazards(level: LevelData): HazardRect[] {
  const hazards: HazardRect[] = [];

  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const tile = level.tiles[r * level.cols + c] ?? LvlTile.Empty;
      if (tile === LvlTile.Hazard) {
        hazards.push({
          x: c * TILE_SIZE,
          y: r * TILE_SIZE,
          width: TILE_SIZE,
          height: TILE_SIZE,
        });
      }
    }
  }

  return hazards;
}

/**
 * Standard AABB intersection with STRICT inequalities: flush edges (equality)
 * read as NO overlap. This mirrors the physics solver's spanEnd convention
 * (ceil(end / TILE_SIZE) - 1) which excludes the far-edge-aligned tile, so a
 * body standing exactly adjacent to a hazard does not register a hit.
 */
export function overlapsHazard(box: AABB, hazards: readonly HazardRect[]): boolean {
  if (hazards.length === 0) return false;

  for (const hz of hazards) {
    if (
      box.x < hz.x + hz.width &&
      box.x + box.width > hz.x &&
      box.y < hz.y + hz.height &&
      box.y + box.height > hz.y
    ) {
      return true;
    }
  }

  return false;
}
