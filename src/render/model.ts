// Pure render-model construction: turns level data + entity snapshots +
// camera into a declarative description of what to draw. No DOM, no
// randomness, no clock. The batcher (batcher.ts) is the only consumer
// that touches a canvas context.

import type { AtlasFrameName } from './atlas';
import type { LoadedAtlas } from './atlas-loader';
import type { Camera } from './camera';
import type { PaletteToken } from './palette';
import type { TilePosition } from '../levels/types';
import type { HazardRect } from '../engine/levelAdapter';
import type { DynamicSolid } from '../traps/types';
import type { Vec2 } from '../engine/physics';

const TILE_SIZE = 16;

/** Viewport dimensions for culling pixel-space objects (hazards, dynamics). */
const VIEWPORT_W = 320;
const VIEWPORT_H = 180;

export interface DrawSprite {
  readonly frame: AtlasFrameName;
  readonly dstX: number;
  readonly dstY: number;
  readonly flipX: boolean;
}

export interface FillRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: PaletteToken;
}

export interface RenderLayer {
  readonly kind: 'world' | 'entities' | 'effects';
  readonly sprites: readonly DrawSprite[];
  readonly rects: readonly FillRect[];
}

export interface RenderModel {
  readonly clear: PaletteToken;
  readonly layers: readonly RenderLayer[];
}

/**
 * Bundles the runtime world state the renderer needs: the mutable physics
 * grid (reflecting trap/mechanic modifications), the exit position,
 * hazards, and dynamic solids. Built by the game loop from the trap runtime
 * + mechanic-published buffers so the renderer sees live state instead of
 * the static {@link LevelData}.
 *
 * The `tiles` array is the physics grid (0=Empty, 1=Solid, 2=OneWay);
 * Hazard entries were converted to Empty by `levelToGrid`, so hazards are
 * rendered exclusively from the `hazards` array.
 */
export interface RenderWorld {
  readonly cols: number;
  readonly rows: number;
  readonly tiles: readonly number[];
  readonly exit: TilePosition;
  readonly hazards: readonly HazardRect[];
  readonly dynamicSolids: readonly DynamicSolid[];
}

/**
 * Interpolates between two positions by alpha [0..1].
 * prev + (curr - prev) * alpha
 */
export function interpolate(prev: Vec2, curr: Vec2, alpha: number): Vec2 {
  return {
    x: prev.x + (curr.x - prev.x) * alpha,
    y: prev.y + (curr.y - prev.y) * alpha,
  };
}

/**
 * Builds the world tile layer from visible tiles within the camera viewport.
 *
 * Draws four categories, all culled to the 320×180 viewport:
 *   1. Static tiles from `world.tiles` (the physics grid):
 *        Solid  -> tile.solid.top (if cell above is empty/oneway) or tile.solid.fill
 *        OneWay -> tile.oneway
 *        Empty  -> skipped (Hazard was converted to Empty; rendered as hazard below)
 *   2. Exit door sprite at `world.exit`
 *   3. Hazard sprites from `world.hazards` (pixel-space rects → hazard.spikes)
 *   4. Dynamic solid fill-rects from `world.dynamicSolids`
 */
export function buildTileLayer(
  world: RenderWorld,
  camera: Camera,
): { sprites: DrawSprite[]; rects: FillRect[] } {
  const sprites: DrawSprite[] = [];
  const rects: FillRect[] = [];

  const startCol = Math.max(0, Math.floor(camera.x / TILE_SIZE));
  const endCol = Math.min(
    world.cols - 1,
    Math.floor((camera.x + VIEWPORT_W - 1) / TILE_SIZE),
  );
  const startRow = Math.max(0, Math.floor(camera.y / TILE_SIZE));
  const endRow = Math.min(
    world.rows - 1,
    Math.floor((camera.y + VIEWPORT_H - 1) / TILE_SIZE),
  );

  // --- 1. Tile sprites ---
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const tile = world.tiles[row * world.cols + col] ?? 0;
      if (tile === 0) continue; // Empty

      const dstX = col * TILE_SIZE - camera.x;
      const dstY = row * TILE_SIZE - camera.y;

      let frame: AtlasFrameName;
      if (tile === 1) {
        // Solid: top frame if above is empty or oneway, else fill.
        const above = row > 0 ? (world.tiles[(row - 1) * world.cols + col] ?? 0) : 0;
        frame = above === 0 || above === 2 ? 'tile.solid.top' : 'tile.solid.fill';
      } else {
        // OneWay (2)
        frame = 'tile.oneway';
      }

      sprites.push({
        frame,
        dstX,
        dstY,
        flipX: false,
      });
    }
  }

  // --- 2. Exit door ---
  {
    const exCol = world.exit.col;
    const exRow = world.exit.row;
    const dstX = exCol * TILE_SIZE - camera.x;
    const dstY = exRow * TILE_SIZE - camera.y;
    // Cull: exit must overlap viewport [0,VIEWPORT_W) × [0,VIEWPORT_H)
    if (
      dstX < VIEWPORT_W &&
      dstX + TILE_SIZE > 0 &&
      dstY < VIEWPORT_H &&
      dstY + TILE_SIZE > 0
    ) {
      sprites.push({
        frame: 'exit.door',
        dstX,
        dstY,
        flipX: false,
      });
    }
  }

  // --- 3. Hazard sprites (pixel-space rects → hazard.spikes tiles) ---
  for (const hz of world.hazards) {
    const baseX = hz.x - camera.x;
    const baseY = hz.y - camera.y;
    // Iterate 16×16 cells covering the hazard rect.
    const startX = Math.max(0, Math.floor(-baseX / TILE_SIZE));
    const endX = Math.floor((VIEWPORT_W - 1 - baseX) / TILE_SIZE);
    const startY = Math.max(0, Math.floor(-baseY / TILE_SIZE));
    const endY = Math.floor((VIEWPORT_H - 1 - baseY) / TILE_SIZE);

    for (let ty = startY; ty <= endY; ty++) {
      for (let tx = startX; tx <= endX; tx++) {
        const px = baseX + tx * TILE_SIZE;
        const py = baseY + ty * TILE_SIZE;
        // Clamp to hazard bounds
        if (px < baseX || px >= baseX + hz.width) continue;
        if (py < baseY || py >= baseY + hz.height) continue;
        sprites.push({
          frame: 'hazard.spikes',
          dstX: px,
          dstY: py,
          flipX: false,
        });
      }
    }
  }

  // --- 4. Dynamic solid fill-rects ---
  for (const ds of world.dynamicSolids) {
    if (!ds.solid) continue;
    const rx = ds.x - camera.x;
    const ry = ds.y - camera.y;
    // Cull: rect must overlap viewport
    if (
      rx < VIEWPORT_W &&
      rx + ds.width > 0 &&
      ry < VIEWPORT_H &&
      ry + ds.height > 0
    ) {
      rects.push({
        x: rx,
        y: ry,
        w: ds.width,
        h: ds.height,
        color: ds.lethal ? 'lethal' : 'edge',
      });
    }
  }

  return { sprites, rects };
}

/**
 * Snapshot of an entity for rendering: its body at the current sim step
 * plus the animation frame to draw and whether to flip horizontally.
 */
export interface EntitySnapshot {
  readonly body: { x: number; y: number; width: number; height: number };
  readonly frame: AtlasFrameName;
  readonly flipX: boolean;
}

/**
 * Maps each entity to its animation frame at an interpolated screen
 * position, applying the atlas frame's origin offset:
 *   dstX = interpX - origin.x - camera.x
 *   dstY = interpY - origin.y - camera.y
 *
 * Entities without a matching prev snapshot use their current position
 * (alpha is effectively 0 for that entity).
 */
export function buildEntitySprites(
  entities: readonly EntitySnapshot[],
  prevEntities: readonly EntitySnapshot[],
  alpha: number,
  camera: Camera,
  atlas: LoadedAtlas,
): DrawSprite[] {
  const sprites: DrawSprite[] = [];

  for (let i = 0; i < entities.length; i++) {
    const ent = entities[i]!;

    let interpX: number;
    let interpY: number;

    const prev = prevEntities[i];
    if (prev !== undefined) {
      interpX = prev.body.x + (ent.body.x - prev.body.x) * alpha;
      interpY = prev.body.y + (ent.body.y - prev.body.y) * alpha;
    } else {
      interpX = ent.body.x;
      interpY = ent.body.y;
    }

    const frameInfo = atlas.frame[ent.frame];
    if (frameInfo === undefined) continue;

    sprites.push({
      frame: ent.frame,
      dstX: interpX - frameInfo.origin.x - camera.x,
      dstY: interpY - frameInfo.origin.y - camera.y,
      flipX: ent.flipX,
    });
  }

  return sprites;
}

/**
 * Composes the full render model: clear=void, layers=[world, entities,
 * effects] in FIXED order.
 */
export function buildRenderModel(
  world: RenderWorld,
  camera: Camera,
  entities: readonly EntitySnapshot[],
  prevEntities: readonly EntitySnapshot[],
  alpha: number,
  atlas: LoadedAtlas,
): RenderModel {
  const worldLayer = buildTileLayer(world, camera);
  const entitySprites = buildEntitySprites(
    entities,
    prevEntities,
    alpha,
    camera,
    atlas,
  );

  return {
    clear: 'void',
    layers: [
      { kind: 'world', sprites: worldLayer.sprites, rects: worldLayer.rects },
      { kind: 'entities', sprites: entitySprites, rects: [] },
      { kind: 'effects', sprites: [], rects: [] },
    ],
  };
}
