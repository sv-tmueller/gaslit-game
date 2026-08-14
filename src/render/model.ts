// Pure render-model construction: turns level data + entity snapshots +
// camera into a declarative description of what to draw. No DOM, no
// randomness, no clock. The batcher (batcher.ts) is the only consumer
// that touches a canvas context.

import type { AtlasFrameName } from './atlas';
import type { LoadedAtlas } from './atlas-loader';
import type { Camera } from './camera';
import type { PaletteToken } from './palette';
import { Tile, type LevelData } from '../levels/types';
import { tileAt } from '../levels/load';
import type { Vec2 } from '../engine/physics';

const TILE_SIZE = 16;

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
 * Tile mapping:
 *   Tile.Solid  -> tile.solid.top (if cell above is empty) or tile.solid.fill
 *   Tile.OneWay -> tile.oneway
 *   Tile.Hazard -> hazard.spikes
 *
 * DEFERRAL: Per docs/design/visual-identity.md, hazards should eventually
 * render as ordinary terrain until triggered. For now, Tile.Hazard cells
 * emit hazard.spikes directly. The hiding mechanism is a later issue.
 */
export function buildTileLayer(
  level: LevelData,
  camera: Camera,
): { sprites: DrawSprite[]; rects: FillRect[] } {
  const sprites: DrawSprite[] = [];

  const startCol = Math.floor(camera.x / TILE_SIZE);
  const endCol = Math.min(
    level.cols - 1,
    Math.floor((camera.x + 319) / TILE_SIZE),
  );
  const startRow = Math.floor(camera.y / TILE_SIZE);
  const endRow = Math.min(
    level.rows - 1,
    Math.floor((camera.y + 179) / TILE_SIZE),
  );

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const tile = tileAt(level, col, row);
      if (tile === Tile.Empty) continue;

      const dstX = col * TILE_SIZE - camera.x;
      const dstY = row * TILE_SIZE - camera.y;

      let frame: AtlasFrameName;
      if (tile === Tile.Solid) {
        const above = tileAt(level, col, row - 1);
        frame =
          above === Tile.Empty ||
          above === Tile.OneWay ||
          above === Tile.Hazard
            ? 'tile.solid.top'
            : 'tile.solid.fill';
      } else if (tile === Tile.OneWay) {
        frame = 'tile.oneway';
      } else {
        // Tile.Hazard
        frame = 'hazard.spikes';
      }

      sprites.push({
        frame,
        dstX,
        dstY,
        flipX: false,
      });
    }
  }

  return { sprites, rects: [] };
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
  level: LevelData,
  camera: Camera,
  entities: readonly EntitySnapshot[],
  prevEntities: readonly EntitySnapshot[],
  alpha: number,
  atlas: LoadedAtlas,
): RenderModel {
  const world = buildTileLayer(level, camera);
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
      { kind: 'world', sprites: world.sprites, rects: world.rects },
      { kind: 'entities', sprites: entitySprites, rects: [] },
      { kind: 'effects', sprites: [], rects: [] },
    ],
  };
}
