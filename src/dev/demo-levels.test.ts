import { describe, expect, it } from 'vitest';
import { loadLevel } from '../levels/load';
import { resolveMutations } from '../levels/mutations';
import type { MutationEntry, MutableLevelData } from '../levels/mutation-types';
import { Tile } from '../levels/types';
import { DEMO_LEVELS } from '../levels/fixtures/demo-index';
import { diffLevels } from './level-diff';

function loadDemo(key: string): MutableLevelData {
  const source = DEMO_LEVELS[key];
  if (!source) throw new Error(`Unknown demo level: ${key}`);
  const level = loadLevel(source);
  const raw = source as Record<string, unknown>;
  const mutations = raw['mutations'];
  if (mutations === undefined) return level;
  return { ...level, mutations: mutations as readonly MutationEntry[] };
}

const DEMO_KEYS = ['widening-gap', 'moving-platform', 'trigger-change', 'moving-exit', 'closing-route'];

describe('demo levels', () => {
  for (const key of DEMO_KEYS) {
    describe(`${key}`, () => {
      it('loads via loadLevel without errors', () => {
        const source = DEMO_LEVELS[key];
        expect(() => loadLevel(source)).not.toThrow();
      });

      it('has a mutations section', () => {
        const raw = DEMO_LEVELS[key] as Record<string, unknown>;
        expect(Array.isArray(raw['mutations'])).toBe(true);
        const mutations = raw['mutations'] as readonly unknown[];
        expect(mutations.length).toBeGreaterThanOrEqual(1);
      });

      it('resolveMutations at attempt 1 returns base level', () => {
        const level = loadDemo(key);
        const result = resolveMutations(level, 1);
        const base = loadLevel(DEMO_LEVELS[key]);
        expect(result.tiles).toEqual(base.tiles);
        expect(result.exit).toEqual(base.exit);
      });

      it('resolveMutations at attempt 2 produces a different level', () => {
        const level = loadDemo(key);
        const base = loadLevel(DEMO_LEVELS[key]);
        const mutated = resolveMutations(level, 2);
        const diffs = diffLevels(base, mutated);
        expect(diffs.length).toBeGreaterThan(0);
      });
    });
  }

  it('widening-gap: gap widens on attempt 2', () => {
    const level = loadDemo('widening-gap');
    const base = loadLevel(DEMO_LEVELS['widening-gap']);

    // Count empty tiles on the floor row (row 10) in base
    const floorRow = 10;
    let baseGaps = 0;
    for (let c = 0; c < base.cols; c++) {
      if (base.tiles[floorRow * base.cols + c] === Tile.Empty) baseGaps++;
    }

    const mutated = resolveMutations(level, 2);
    let mutatedGaps = 0;
    for (let c = 0; c < base.cols; c++) {
      if (mutated.tiles[floorRow * base.cols + c] === Tile.Empty) mutatedGaps++;
    }

    expect(mutatedGaps).toBeGreaterThan(baseGaps);
  });

  it('moving-platform: platform relocates on attempt 2', () => {
    const level = loadDemo('moving-platform');
    const base = loadLevel(DEMO_LEVELS['moving-platform']);
    const mutated = resolveMutations(level, 2);

    // The one-way platform (tile 2) should be in a different location
    const baseOneWayPositions: string[] = [];
    const mutatedOneWayPositions: string[] = [];

    for (let r = 0; r < base.rows; r++) {
      for (let c = 0; c < base.cols; c++) {
        const idx = r * base.cols + c;
        if (base.tiles[idx] === Tile.OneWay) baseOneWayPositions.push(`${c},${r}`);
        if (mutated.tiles[idx] === Tile.OneWay) mutatedOneWayPositions.push(`${c},${r}`);
      }
    }

    // At least some positions changed
    expect(JSON.stringify(mutatedOneWayPositions)).not.toBe(JSON.stringify(baseOneWayPositions));
  });

  it('trigger-change: trap trigger swaps on attempt 2', () => {
    const level = loadDemo('trigger-change');
    const base = loadLevel(DEMO_LEVELS['trigger-change']);
    const mutated = resolveMutations(level, 2);

    const baseTrap = base.traps[0];
    const mutatedTrap = mutated.traps[0];

    expect(baseTrap?.trigger).not.toBe(mutatedTrap?.trigger);
  });

  it('moving-exit: exit moves on attempt 2', () => {
    const level = loadDemo('moving-exit');
    const base = loadLevel(DEMO_LEVELS['moving-exit']);
    const mutated = resolveMutations(level, 2);

    expect(mutated.exit).not.toEqual(base.exit);
  });

  it('closing-route: walls added on attempt 2', () => {
    const level = loadDemo('closing-route');
    const base = loadLevel(DEMO_LEVELS['closing-route']);
    const mutated = resolveMutations(level, 2);

    // Count solid tiles - mutated should have MORE solid tiles
    let baseSolids = 0;
    let mutatedSolids = 0;

    for (let i = 0; i < base.tiles.length; i++) {
      if (base.tiles[i] === Tile.Solid) baseSolids++;
      if (mutated.tiles[i] === Tile.Solid) mutatedSolids++;
    }

    expect(mutatedSolids).toBeGreaterThan(baseSolids);
  });
});
