import { describe, expect, it } from 'vitest';
import { diffLevels, formatDiff } from './level-diff';
import type { LevelData } from '../levels/types';
import { Tile } from '../levels/types';

function makeLevel(opts?: Partial<LevelData>): LevelData {
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
    traps: [],
    ...opts,
  };
}

describe('diffLevels', () => {
  it('produces no diff when levels are identical', () => {
    const base = makeLevel();
    const result = diffLevels(base, base);
    expect(result).toEqual([]);
  });

  it('detects tile changes', () => {
    const base = makeLevel();
    const mutated = makeLevel({
      tiles: [
        Tile.Solid, Tile.Solid, Tile.Solid, Tile.Solid,
        Tile.Empty, Tile.Solid, Tile.Empty, Tile.Empty,
        Tile.Solid, Tile.Solid, Tile.Solid, Tile.Solid,
      ],
    });
    const result = diffLevels(base, mutated);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe('tile-changed');
    expect(result[0]?.col).toBe(1);
    expect(result[0]?.row).toBe(1);
    expect(result[0]?.oldValue).toBe(Tile.Empty);
    expect(result[0]?.newValue).toBe(Tile.Solid);
  });

  it('detects exit moves', () => {
    const base = makeLevel();
    const mutated = makeLevel({ exit: { col: 0, row: 1 } });
    const result = diffLevels(base, mutated);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe('exit-moved');
    expect(result[0]?.oldExit).toEqual({ col: 3, row: 1 });
    expect(result[0]?.newExit).toEqual({ col: 0, row: 1 });
  });

  it('detects trap trigger changes', () => {
    const base = makeLevel({
      traps: [{ id: 't1', type: 'vanishing-floor', trigger: 'on-land', params: {} }],
    });
    const mutated = makeLevel({
      traps: [{ id: 't1', type: 'vanishing-floor', trigger: 'on-timer', params: {} }],
    });
    const result = diffLevels(base, mutated);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe('trap-changed');
    expect(result[0]?.trapId).toBe('t1');
    expect(result[0]?.field).toBe('trigger');
    expect(result[0]?.oldFieldValue).toBe('on-land');
    expect(result[0]?.newFieldValue).toBe('on-timer');
  });

  it('ignores traps that only exist in mutated but not base', () => {
    const base = makeLevel({ traps: [] });
    const mutated = makeLevel({
      traps: [{ id: 'new-trap', type: 'spikes', trigger: 'on-enter', params: {} }],
    });
    const result = diffLevels(base, mutated);
    // No trap-changed diff because we iterate base traps
    expect(result.filter((d) => d.kind === 'trap-changed')).toHaveLength(0);
  });
});

describe('formatDiff', () => {
  it('produces readable output for tile changes', () => {
    const diffs = diffLevels(makeLevel(), makeLevel({
      tiles: [
        Tile.Solid, Tile.Solid, Tile.Solid, Tile.Solid,
        Tile.Empty, Tile.Solid, Tile.Empty, Tile.Empty,
        Tile.Solid, Tile.Solid, Tile.Solid, Tile.Solid,
      ],
    }));
    const formatted = formatDiff(diffs);
    expect(formatted).toContain('tile(1,1)');
    expect(formatted).toContain('-> ');
  });

  it('produces readable output for exit moves', () => {
    const diffs = diffLevels(makeLevel(), makeLevel({ exit: { col: 0, row: 1 } }));
    const formatted = formatDiff(diffs);
    expect(formatted).toContain('exit:');
    expect(formatted).toContain('(3,1)');
    expect(formatted).toContain('(0,1)');
  });

  it('produces readable output for trap changes', () => {
    const base = makeLevel({
      traps: [{ id: 't1', type: 'vanishing-floor', trigger: 'on-land', params: {} }],
    });
    const mutated = makeLevel({
      traps: [{ id: 't1', type: 'vanishing-floor', trigger: 'on-timer', params: {} }],
    });
    const formatted = formatDiff(diffLevels(base, mutated));
    expect(formatted).toContain("trap 't1'");
    expect(formatted).toContain('trigger');
    expect(formatted).toContain('on-land');
    expect(formatted).toContain('on-timer');
  });

  it('returns empty string for no diffs', () => {
    expect(formatDiff([])).toBe('');
  });
});
