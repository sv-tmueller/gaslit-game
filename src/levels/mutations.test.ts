import { describe, expect, it } from 'vitest';
import { resolveMutations, validateMutations } from './mutations';
import type { MutableLevelData } from './mutation-types';
import { Tile } from './types';

function makeBaseLevel(): MutableLevelData {
  return {
    name: 'test',
    cols: 4,
    rows: 3,
    spawn: { col: 0, row: 1 },
    exit: { col: 3, row: 1 },
    tiles: [
      Tile.Solid, Tile.Solid, Tile.Solid, Tile.Solid,
      Tile.Empty, Tile.Empty, Tile.Empty, Tile.Empty,
      Tile.Solid, Tile.Solid, Tile.Solid, Tile.Solid,
    ],
    traps: [
      { id: 't1', type: 'vanishing-floor', trigger: 'on-land', params: {} },
    ],
  };
}

describe('validateMutations', () => {
  it('returns undefined when mutations absent', () => {
    const errors: { code: string; path: string; message: string }[] = [];
    const result = validateMutations({}, errors);
    expect(result).toBeUndefined();
    expect(errors).toHaveLength(0);
  });

  it('validates a well-formed mutations array', () => {
    const errors: { code: string; path: string; message: string }[] = [];
    const result = validateMutations({
      mutations: [
        { attempt: 2, deltas: [{ kind: 'set-tile', col: 1, row: 1, tile: 1 }] },
      ],
    }, errors);
    expect(result).toBeDefined();
    expect(result).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });

  it('rejects duplicate attempt numbers', () => {
    const errors: { code: string; path: string; message: string }[] = [];
    const result = validateMutations({
      mutations: [
        { attempt: 2, deltas: [] },
        { attempt: 2, deltas: [] },
      ],
    }, errors);
    expect(result).toBeUndefined();
    expect(errors.some((e) => e.code === 'duplicate-mutation-attempt')).toBe(true);
  });

  it('rejects non-positive attempt', () => {
    const errors: { code: string; path: string; message: string }[] = [];
    const result = validateMutations({
      mutations: [{ attempt: 0, deltas: [] }],
    }, errors);
    expect(result).toBeUndefined();
    expect(errors.some((e) => e.code === 'bad-mutation-entry')).toBe(true);
  });

  it('rejects invalid delta kind', () => {
    const errors: { code: string; path: string; message: string }[] = [];
    const result = validateMutations({
      mutations: [{ attempt: 2, deltas: [{ kind: 'explode' }] }],
    }, errors);
    expect(result).toBeUndefined();
    expect(errors.some((e) => e.code === 'bad-delta')).toBe(true);
  });

  it('rejects set-tile missing required fields', () => {
    const errors: { code: string; path: string; message: string }[] = [];
    const result = validateMutations({
      mutations: [{ attempt: 2, deltas: [{ kind: 'set-tile', col: 1 }] }],
    }, errors);
    expect(result).toBeUndefined();
    expect(errors.some((e) => e.code === 'bad-delta')).toBe(true);
  });
});

describe('resolveMutations', () => {
  it('returns base level unchanged when no mutations', () => {
    const level = makeBaseLevel();
    const result = resolveMutations(level, 5);
    expect(result.tiles).toEqual(level.tiles);
    expect(result.exit).toEqual(level.exit);
    expect(result.traps).toEqual(level.traps);
  });

  it('returns base level when attempt is below first mutation', () => {
    const level: MutableLevelData = {
      ...makeBaseLevel(),
      mutations: [{ attempt: 3, deltas: [{ kind: 'set-tile', col: 1, row: 1, tile: 1 }] }],
    };
    const result = resolveMutations(level, 2);
    expect(result.tiles[5]).toBe(Tile.Empty);
  });

  it('applies mutation when attempt matches', () => {
    const level: MutableLevelData = {
      ...makeBaseLevel(),
      mutations: [{ attempt: 2, deltas: [{ kind: 'set-tile', col: 1, row: 1, tile: 1 }] }],
    };
    const result = resolveMutations(level, 2);
    expect(result.tiles[5]).toBe(Tile.Solid);
  });

  it('applies multiple mutations in ascending attempt order', () => {
    const level: MutableLevelData = {
      ...makeBaseLevel(),
      mutations: [
        { attempt: 2, deltas: [{ kind: 'set-tile', col: 0, row: 1, tile: 1 }] },
        { attempt: 3, deltas: [{ kind: 'set-tile', col: 1, row: 1, tile: 1 }] },
      ],
    };
    const result = resolveMutations(level, 3);
    expect(result.tiles[4]).toBe(Tile.Solid);
    expect(result.tiles[5]).toBe(Tile.Solid);
  });

  it('only applies mutations up to the given attempt', () => {
    const level: MutableLevelData = {
      ...makeBaseLevel(),
      mutations: [
        { attempt: 2, deltas: [{ kind: 'set-tile', col: 0, row: 1, tile: 1 }] },
        { attempt: 5, deltas: [{ kind: 'set-tile', col: 1, row: 1, tile: 1 }] },
      ],
    };
    const result = resolveMutations(level, 3);
    expect(result.tiles[4]).toBe(Tile.Solid);
    expect(result.tiles[5]).toBe(Tile.Empty);
  });

  it('move-exit changes the exit position', () => {
    const level: MutableLevelData = {
      ...makeBaseLevel(),
      mutations: [{ attempt: 2, deltas: [{ kind: 'move-exit', exitCol: 0, exitRow: 1 }] }],
    };
    const result = resolveMutations(level, 2);
    expect(result.exit).toEqual({ col: 0, row: 1 });
  });

  it('swap-trigger changes a trap trigger', () => {
    const level: MutableLevelData = {
      ...makeBaseLevel(),
      mutations: [{ attempt: 2, deltas: [{ kind: 'swap-trigger', trapId: 't1', trigger: 'on-timer' }] }],
    };
    const result = resolveMutations(level, 2);
    expect(result.traps[0]!.trigger).toBe('on-timer');
  });

  it('resize-gap sets a range of tiles', () => {
    const level: MutableLevelData = {
      ...makeBaseLevel(),
      mutations: [{
        attempt: 2,
        deltas: [{ kind: 'resize-gap', fromCol: 0, toCol: 3, gapRow: 2, gapTile: 0 }],
      }],
    };
    const result = resolveMutations(level, 2);
    expect(result.tiles[8]).toBe(Tile.Empty);
    expect(result.tiles[9]).toBe(Tile.Empty);
    expect(result.tiles[10]).toBe(Tile.Empty);
    expect(result.tiles[11]).toBe(Tile.Empty);
  });

  it('strips mutations section from output', () => {
    const level: MutableLevelData = {
      ...makeBaseLevel(),
      mutations: [{ attempt: 2, deltas: [{ kind: 'set-tile', col: 0, row: 0, tile: 0 }] }],
    };
    const result = resolveMutations(level, 2);
    expect('mutations' in result).toBe(false);
  });

  it('is deterministic: same input produces identical output', () => {
    const level: MutableLevelData = {
      ...makeBaseLevel(),
      mutations: [
        { attempt: 2, deltas: [{ kind: 'set-tile', col: 0, row: 1, tile: 1 }] },
        { attempt: 3, deltas: [{ kind: 'move-exit', exitCol: 1, exitRow: 1 }] },
      ],
    };
    const r1 = resolveMutations(level, 3);
    const r2 = resolveMutations(level, 3);
    expect(r1).toEqual(r2);
  });

  it('bounds-checks set-tile (out of bounds is no-op)', () => {
    const level: MutableLevelData = {
      ...makeBaseLevel(),
      mutations: [{ attempt: 2, deltas: [{ kind: 'set-tile', col: 99, row: 99, tile: 1 }] }],
    };
    const result = resolveMutations(level, 2);
    expect(result.tiles).toEqual(level.tiles);
  });
});
