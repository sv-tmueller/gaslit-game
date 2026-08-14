import { describe, expect, it } from 'vitest';
import atlasManifest from '../../assets/atlas.json';
import { loadAtlas, type BitmapLike } from './atlas-loader';
import {
  buildEntitySprites,
  buildRenderModel,
  buildTileLayer,
  interpolate,
  type EntitySnapshot,
} from './model';
import { Tile, type LevelData } from '../levels/types';
import type { AtlasManifest } from './atlas';
import type { Vec2 } from '../engine/physics';

const MANIFEST = atlasManifest as unknown as AtlasManifest;
const BITMAP: BitmapLike = { width: 128, height: 40 };
const ATLAS = loadAtlas(MANIFEST, BITMAP);

function makeLevel(
  rows: string[],
  opts?: Partial<LevelData>,
): LevelData {
  const tiles: Tile[] = [];
  for (const row of rows) {
    for (const ch of row) {
      tiles.push(Number(ch) as Tile);
    }
  }
  return {
    name: opts?.name ?? 'test',
    cols: rows[0]!.length,
    rows: rows.length,
    spawn: opts?.spawn ?? { col: 0, row: 0 },
    exit: opts?.exit ?? { col: 0, row: 0 },
    tiles,
    traps: [],
  };
}

describe('interpolate', () => {
  it('linearly interpolates between prev and curr', () => {
    const prev: Vec2 = { x: 0, y: 0 };
    const curr: Vec2 = { x: 10, y: 20 };
    expect(interpolate(prev, curr, 0)).toEqual({ x: 0, y: 0 });
    expect(interpolate(prev, curr, 0.5)).toEqual({ x: 5, y: 10 });
    expect(interpolate(prev, curr, 1)).toEqual({ x: 10, y: 20 });
  });

  it('does not mutate inputs', () => {
    const prev: Vec2 = { x: 1, y: 2 };
    const curr: Vec2 = { x: 5, y: 6 };
    interpolate(prev, curr, 0.5);
    expect(prev).toEqual({ x: 1, y: 2 });
    expect(curr).toEqual({ x: 5, y: 6 });
  });
});

describe('buildTileLayer', () => {
  it('maps Tile.Solid top-row to tile.solid.top and below-top to tile.solid.fill', () => {
    // Row 0 is ceiling solids, row 1 is below-ceiling solids.
    const level = makeLevel([
      '11',
      '11',
    ]);

    const { sprites } = buildTileLayer(level, { x: 0, y: 0 });

    // Col 0, row 0: above is out-of-bounds (Empty) -> tile.solid.top
    // Col 0, row 1: above is Solid -> tile.solid.fill
    expect(sprites).toHaveLength(4);

    const topSprite = sprites.find(
      (s) => s.dstX === 0 && s.dstY === 0,
    );
    expect(topSprite).toBeDefined();
    expect(topSprite!.frame).toBe('tile.solid.top');

    const fillSprite = sprites.find(
      (s) => s.dstX === 0 && s.dstY === 16,
    );
    expect(fillSprite).toBeDefined();
    expect(fillSprite!.frame).toBe('tile.solid.fill');
  });

  it('maps Tile.OneWay to tile.oneway', () => {
    const level = makeLevel(['2']);
    const { sprites } = buildTileLayer(level, { x: 0, y: 0 });
    expect(sprites).toHaveLength(1);
    expect(sprites[0]!.frame).toBe('tile.oneway');
  });

  it('maps Tile.Hazard to hazard.spikes', () => {
    const level = makeLevel(['3']);
    const { sprites } = buildTileLayer(level, { x: 0, y: 0 });
    expect(sprites).toHaveLength(1);
    expect(sprites[0]!.frame).toBe('hazard.spikes');
  });

  it('skips Tile.Empty cells', () => {
    const level = makeLevel(['0', '0']);
    const { sprites } = buildTileLayer(level, { x: 0, y: 0 });
    expect(sprites).toHaveLength(0);
  });

  it('computes screen coords relative to camera', () => {
    // Three-column level; camera at (16,0) so col 1 onward is visible.
    const level = makeLevel(['111']);
    const { sprites } = buildTileLayer(level, { x: 16, y: 0 });
    // Visible range: startCol=floor(16/16)=1, so col 1 is the first visible.
    // Col 1, row 0: world (16,0), camera at (16,0), screen (0,0).
    expect(sprites).toHaveLength(2);
    expect(sprites[0]!.dstX).toBe(0);
    expect(sprites[0]!.dstY).toBe(0);
    expect(sprites[1]!.dstX).toBe(16);
  });

  it('does not mutate the level data', () => {
    const level = makeLevel(['11', '11']);
    const tilesBefore = [...level.tiles];
    buildTileLayer(level, { x: 0, y: 0 });
    expect(level.tiles).toEqual(tilesBefore);
  });
});

describe('buildEntitySprites', () => {
  function makeSnap(
    x: number,
    y: number,
    frame: EntitySnapshot['frame'] = 'player.idle.0',
    flipX = false,
  ): EntitySnapshot {
    return { body: { x, y, width: 16, height: 24 }, frame, flipX };
  }

  it('uses interpolated position when prev exists', () => {
    const ents = [makeSnap(100, 50)];
    const prevs = [makeSnap(50, 10)];
    const sprites = buildEntitySprites(ents, prevs, 0.5, { x: 0, y: 0 }, ATLAS);

    expect(sprites).toHaveLength(1);
    // interpX = 50 + (100-50)*0.5 = 75
    // interpY = 10 + (50-10)*0.5 = 30
    // origin for player frames = {x:0, y:8}
    // dstX = 75 - 0 - 0 = 75
    // dstY = 30 - 8 - 0 = 22
    expect(sprites[0]!.dstX).toBe(75);
    expect(sprites[0]!.dstY).toBe(22);
  });

  it('falls back to current position when prev is missing', () => {
    const ents = [makeSnap(100, 50)];
    const sprites = buildEntitySprites(ents, [], 0.5, { x: 0, y: 0 }, ATLAS);

    expect(sprites).toHaveLength(1);
    expect(sprites[0]!.dstX).toBe(100);
    expect(sprites[0]!.dstY).toBe(42); // 50 - 8 (origin.y)
  });

  it('applies camera offset', () => {
    const ents = [makeSnap(200, 200)];
    const sprites = buildEntitySprites(
      ents,
      [makeSnap(200, 200)],
      0,
      { x: 50, y: 50 },
      ATLAS,
    );

    expect(sprites[0]!.dstX).toBe(150); // 200 - 0 - 50
    expect(sprites[0]!.dstY).toBe(142); // 200 - 8 - 50
  });

  it('preserves flipX from entity snapshot', () => {
    const ents = [makeSnap(0, 0, 'player.idle.0', true)];
    const sprites = buildEntitySprites(
      ents,
      [makeSnap(0, 0)],
      0,
      { x: 0, y: 0 },
      ATLAS,
    );
    expect(sprites[0]!.flipX).toBe(true);
  });

  it('does not mutate input arrays', () => {
    const ents = [makeSnap(100, 50)];
    const prevs = [makeSnap(50, 10)];
    const entsFrozen = [...ents];
    const prevsFrozen = [...prevs];
    buildEntitySprites(ents, prevs, 0.5, { x: 0, y: 0 }, ATLAS);
    expect(ents).toEqual(entsFrozen);
    expect(prevs).toEqual(prevsFrozen);
  });
});

describe('buildRenderModel', () => {
  it('produces layers in fixed order: world, entities, effects', () => {
    const level = makeLevel(['1']);
    const model = buildRenderModel(
      level,
      { x: 0, y: 0 },
      [],
      [],
      0,
      ATLAS,
    );

    expect(model.layers).toHaveLength(3);
    expect(model.layers[0]!.kind).toBe('world');
    expect(model.layers[1]!.kind).toBe('entities');
    expect(model.layers[2]!.kind).toBe('effects');
  });

  it('clears with void palette token', () => {
    const level = makeLevel(['0']);
    const model = buildRenderModel(
      level,
      { x: 0, y: 0 },
      [],
      [],
      0,
      ATLAS,
    );
    expect(model.clear).toBe('void');
  });

  it('populates world layer sprites from tiles', () => {
    const level = makeLevel(['1']);
    const model = buildRenderModel(
      level,
      { x: 0, y: 0 },
      [],
      [],
      0,
      ATLAS,
    );
    expect(model.layers[0]!.sprites.length).toBeGreaterThan(0);
  });

  it('populates entity layer sprites from entities', () => {
    const level = makeLevel(['0']);
    const snap: EntitySnapshot = {
      body: { x: 0, y: 0, width: 16, height: 24 },
      frame: 'player.idle.0',
      flipX: false,
    };
    const model = buildRenderModel(
      level,
      { x: 0, y: 0 },
      [snap],
      [snap],
      0,
      ATLAS,
    );
    expect(model.layers[1]!.sprites).toHaveLength(1);
  });

  it('effects layer is always empty for now', () => {
    const level = makeLevel(['1']);
    const model = buildRenderModel(
      level,
      { x: 0, y: 0 },
      [],
      [],
      0,
      ATLAS,
    );
    expect(model.layers[2]!.sprites).toHaveLength(0);
    expect(model.layers[2]!.rects).toHaveLength(0);
  });
});
