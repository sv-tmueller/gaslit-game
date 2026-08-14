import { describe, expect, it } from 'vitest';
import { TILE_SIZE, Tile as PhysTile, tileAt } from './physics';
import {
  collectHazards,
  levelToGrid,
  overlapsHazard,
  type HazardRect,
} from './levelAdapter';
import { Tile as LvlTile, type LevelData } from '../levels/types';
import { loadLevel } from '../levels/load';
import { FIXTURE_SOURCES } from '../levels/fixtures';
import { createControllerState, stepController, type ControllerActions } from './controller';

const DT = 1 / 60;

function actions(overrides: Partial<ControllerActions> = {}): ControllerActions {
  return { left: false, right: false, jumpPressed: false, jumpHeld: false, ...overrides };
}

/**
 * Builds a minimal LevelData from a raw tile-array string for hazard tests.
 */
function makeLevel(
  cols: number,
  rows: number,
  tiles: readonly LvlTile[],
): LevelData {
  return {
    name: 'test',
    cols,
    rows,
    spawn: { col: 0, row: 0 },
    exit: { col: 0, row: 0 },
    tiles,
    traps: [],
  };
}

// ---------------------------------------------------------------------------
// a) Conversion semantics
// ---------------------------------------------------------------------------

describe('levelToGrid - conversion semantics', () => {
  const fixtureNames = Object.keys(FIXTURE_SOURCES);

  for (const name of fixtureNames) {
    it(`preserves cols and rows for ${name}`, () => {
      const level = loadLevel(FIXTURE_SOURCES[name]);
      const grid = levelToGrid(level);
      expect(grid.cols).toBe(level.cols);
      expect(grid.rows).toBe(level.rows);
    });

    it(`maps every non-Hazard tile identically for ${name}`, () => {
      const level = loadLevel(FIXTURE_SOURCES[name]);
      const grid = levelToGrid(level);

      for (let r = 0; r < level.rows; r++) {
        for (let c = 0; c < level.cols; c++) {
          const lvlTile = level.tiles[r * level.cols + c];
          if (lvlTile === LvlTile.Hazard) continue;
          expect(tileAt(grid, c, r)).toBe(lvlTile);
        }
      }
    });
  }

  it('maps Hazard tiles to Empty in the grid (jump-gap)', () => {
    const level = loadLevel(FIXTURE_SOURCES['jump-gap']);
    const grid = levelToGrid(level);

    // Row 11, cols 9-11 are Hazards in the source.
    for (let c = 9; c <= 11; c++) {
      expect(level.tiles[11 * level.cols + c]).toBe(LvlTile.Hazard);
      expect(tileAt(grid, c, 11)).toBe(PhysTile.Empty);
    }

    // Gap cells row 10, cols 9-11 are also Empty.
    for (let c = 9; c <= 11; c++) {
      expect(tileAt(grid, c, 10)).toBe(PhysTile.Empty);
    }
  });

  it('roundtrip identity: tileAt(grid,c,r) equals level.tiles for all non-Hazard cells', () => {
    for (const name of Object.keys(FIXTURE_SOURCES)) {
      const level = loadLevel(FIXTURE_SOURCES[name]);
      const grid = levelToGrid(level);

      for (let idx = 0; idx < level.tiles.length; idx++) {
        const lvlTile = level.tiles[idx];
        if (lvlTile === LvlTile.Hazard) continue;
        const r = Math.floor(idx / level.cols);
        const c = idx % level.cols;
        expect(tileAt(grid, c, r)).toBe(lvlTile);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// b) Hazard overlap at exact boundaries
// ---------------------------------------------------------------------------

describe('overlapsHazard - exact boundaries at 16 px tiles', () => {
  function singleHazardLevel(col: number, row: number): LevelData {
    const cols = col + 2;
    const rows = row + 2;
    const tiles: LvlTile[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        tiles.push(c === col && r === row ? LvlTile.Hazard : LvlTile.Empty);
      }
    }
    return makeLevel(cols, rows, tiles);
  }

  // Hazard at col 5, row 5 -> pixel rect x=80, y=80, 16x16.
  const level = singleHazardLevel(5, 5);
  const hazards = collectHazards(level);
  const hazard = hazards[0];

  it('collects exactly one hazard at the expected pixel rect', () => {
    expect(hazards).toHaveLength(1);
    expect(hazard).toEqual({ x: 80, y: 80, width: 16, height: 16 });
  });

  it('Case A - interior overlap: box {x:84,y:84,w:16,h:16} -> true', () => {
    expect(overlapsHazard({ x: 84, y: 84, width: 16, height: 16 }, hazards)).toBe(true);
  });

  it('Case B - flush from left: box {x:64,y:80,w:16,h:16} (right edge=80=hazard left) -> false', () => {
    expect(overlapsHazard({ x: 64, y: 80, width: 16, height: 16 }, hazards)).toBe(false);
  });

  it('Case C - flush from right: box {x:96,y:80,w:16,h:16} (left edge=96=hazard right) -> false', () => {
    expect(overlapsHazard({ x: 96, y: 80, width: 16, height: 16 }, hazards)).toBe(false);
  });

  it('Case D - flush from above: box {x:80,y:64,w:16,h:16} (bottom=80=hazard top) -> false', () => {
    expect(overlapsHazard({ x: 80, y: 64, width: 16, height: 16 }, hazards)).toBe(false);
  });

  it('Case E - flush from below: box {x:80,y:96,w:16,h:16} (top=96=hazard bottom) -> false', () => {
    expect(overlapsHazard({ x: 80, y: 96, width: 16, height: 16 }, hazards)).toBe(false);
  });

  it('returns false immediately for an empty hazard list', () => {
    expect(overlapsHazard({ x: 0, y: 0, width: 16, height: 16 }, [])).toBe(false);
  });

  it('collects exactly 3 hazards from jump-gap at expected pixel coords', () => {
    const jg = loadLevel(FIXTURE_SOURCES['jump-gap']);
    const jgHazards = collectHazards(jg);
    expect(jgHazards).toHaveLength(3);

    const expected: HazardRect[] = [
      { x: 9 * TILE_SIZE, y: 11 * TILE_SIZE, width: 16, height: 16 },
      { x: 10 * TILE_SIZE, y: 11 * TILE_SIZE, width: 16, height: 16 },
      { x: 11 * TILE_SIZE, y: 11 * TILE_SIZE, width: 16, height: 16 },
    ];
    expect(jgHazards).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// c) Headless simulation (all three fixtures)
// ---------------------------------------------------------------------------

describe('headless simulation through levelToGrid', () => {
  function simulateWalk(
    name: string,
    steps: number,
  ): void {
    const level = loadLevel(FIXTURE_SOURCES[name]);
    const grid = levelToGrid(level);

    const startX = level.spawn.col * TILE_SIZE;
    const startY = level.spawn.row * TILE_SIZE;

    let state = createControllerState({
      x: startX,
      y: startY,
      width: 16,
      height: 16,
      velocity: { x: 0, y: 0 },
      grounded: true,
    });

    const act = actions({ right: true });

    let groundedAtLeastOnce = false;

    for (let i = 0; i < steps; i++) {
      state = stepController(state, act, grid, DT);
      const { x, y } = state.body;

      // No NaN / Infinity.
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isNaN(x)).toBe(false);
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isNaN(y)).toBe(false);

      // Reasonable bounds: body should not fly off to infinity. A body that
      // falls through a pit accelerates to terminal velocity (400 px/s) and
      // can travel up to ~TERMINAL_VEL * steps * DT px, so the envelope is
      // generous but still rejects NaN/Infinity runaway.
      const maxTravel = 400 * steps * DT + level.rows * TILE_SIZE;
      expect(Math.abs(x)).toBeLessThanOrEqual(level.cols * TILE_SIZE + maxTravel);
      expect(Math.abs(y)).toBeLessThanOrEqual(maxTravel);

      if (state.body.grounded) {
        groundedAtLeastOnce = true;
      }
    }

    // The body should have been grounded at some point during the walk.
    expect(groundedAtLeastOnce).toBe(true);
  }

  it('corridor: walks right for 300 steps without leaving the world', () => {
    simulateWalk('corridor', 300);
  });

  it('jump-gap: walks right for 300 steps without leaving the world', () => {
    simulateWalk('jump-gap', 300);
  });

  it('shaft: walks right for 300 steps without leaving the world', () => {
    simulateWalk('shaft', 300);
  });

  it('corridor: ends grounded after walking into the right wall', () => {
    const level = loadLevel(FIXTURE_SOURCES['corridor']);
    const grid = levelToGrid(level);

    let state = createControllerState({
      x: level.spawn.col * TILE_SIZE,
      y: level.spawn.row * TILE_SIZE,
      width: 16,
      height: 16,
      velocity: { x: 0, y: 0 },
      grounded: true,
    });

    const act = actions({ right: true });
    for (let i = 0; i < 300; i++) {
      state = stepController(state, act, grid, DT);
    }

    expect(state.body.grounded).toBe(true);
  });

  it('shaft: jumps repeatedly and re-grounds on one-way platforms', () => {
    const level = loadLevel(FIXTURE_SOURCES['shaft']);
    const grid = levelToGrid(level);

    let state = createControllerState({
      x: level.spawn.col * TILE_SIZE,
      y: level.spawn.row * TILE_SIZE,
      width: 16,
      height: 16,
      velocity: { x: 0, y: 0 },
      grounded: true,
    });

    let groundedCount = 0;

    for (let i = 0; i < 600; i++) {
      // Jump every 30 steps, hold right.
      const jumpThisStep = i % 30 === 0;
      const act = actions({
        right: true,
        jumpPressed: jumpThisStep,
        jumpHeld: jumpThisStep || (i % 30) < 10,
      });
      state = stepController(state, act, grid, DT);

      expect(Number.isFinite(state.body.x)).toBe(true);
      expect(Number.isFinite(state.body.y)).toBe(true);

      if (state.body.grounded) {
        groundedCount++;
      }
    }

    // Should have touched ground (one-way platforms) multiple times.
    expect(groundedCount).toBeGreaterThan(0);
  });
});
