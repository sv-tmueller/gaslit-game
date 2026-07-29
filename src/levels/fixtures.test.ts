import { describe, expect, it } from 'vitest';
import { loadLevel } from './load';
import { FIXTURE_SOURCES } from './fixtures';
import { Tile, type LevelData } from './types';

describe('fixtures', () => {
  it('corridor.json loads and validates at 20 x 12', () => {
    const level = loadLevel(FIXTURE_SOURCES['corridor']);

    expect(level.name).toBe('corridor');
    expect(level.cols).toBe(20);
    expect(level.rows).toBe(12);
    expect(level.spawn).toEqual({ col: 2, row: 9 });
    expect(level.exit).toEqual({ col: 17, row: 9 });
  });

  it('jump-gap.json loads and validates at 20 x 12', () => {
    const level = loadLevel(FIXTURE_SOURCES['jump-gap']);

    expect(level.name).toBe('jump-gap');
    expect(level.cols).toBe(20);
    expect(level.rows).toBe(12);
  });

  it('jump-gap.json floor has exactly three missing columns', () => {
    const level = loadLevel(FIXTURE_SOURCES['jump-gap']);

    const floorRow = 10;
    let gapCount = 0;
    for (let c = 0; c < level.cols; c += 1) {
      const tile = level.tiles[floorRow * level.cols + c];
      if (tile === Tile.Empty) gapCount += 1;
    }
    expect(gapCount).toBe(3);
  });

  it('shaft.json loads and validates at 20 x 24', () => {
    const level = loadLevel(FIXTURE_SOURCES['shaft']);

    expect(level.name).toBe('shaft');
    expect(level.cols).toBe(20);
    expect(level.rows).toBe(24);
    expect(level.spawn).toEqual({ col: 2, row: 21 });
    expect(level.exit).toEqual({ col: 4, row: 1 });
  });

  it('uses all four tile ids across the three fixtures', () => {
    const levels: LevelData[] = [
      loadLevel(FIXTURE_SOURCES['corridor']),
      loadLevel(FIXTURE_SOURCES['jump-gap']),
      loadLevel(FIXTURE_SOURCES['shaft']),
    ];

    const seen = new Set<Tile>();
    for (const level of levels) {
      for (const tile of level.tiles) seen.add(tile);
    }

    expect(seen).toEqual(new Set([Tile.Empty, Tile.Solid, Tile.OneWay, Tile.Hazard]));
  });
});
