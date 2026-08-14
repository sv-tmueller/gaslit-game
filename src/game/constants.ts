import { TILE_SIZE, type Body } from '../engine/physics';
import type { TilePosition } from '../levels/types';

export const PLAYER_WIDTH = 16;
export const PLAYER_HEIGHT = 16;

/** Steps the body freezes on death before respawning (~167 ms at 60 Hz). */
export const DEATH_FREEZE_STEPS = 10;

/** Steps the exit-door completion beat lasts before advancing (~300 ms). */
export const EXIT_BEAT_STEPS = 18;

/**
 * Bottom-aligns a body onto a spawn tile so the feet rest on the floor below
 * the spawn row. x = col * TILE_SIZE, y = (row + 1) * TILE_SIZE - height.
 */
export function spawnToBody(spawn: TilePosition, height: number): Body {
  return {
    x: spawn.col * TILE_SIZE,
    y: (spawn.row + 1) * TILE_SIZE - height,
    width: PLAYER_WIDTH,
    height,
    velocity: { x: 0, y: 0 },
    grounded: false,
  };
}
