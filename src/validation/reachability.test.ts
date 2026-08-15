import { describe, expect, it } from 'vitest';
import { validateReachability, validateAllVariants } from './reachability';
import { loadLevel } from '../levels/load';
import { FIXTURE_SOURCES } from '../levels/fixtures';
import type { MutableLevelData } from '../levels/mutation-types';

describe('reachability validation', () => {
  it('corridor is reachable', () => {
    const level = loadLevel(FIXTURE_SOURCES['corridor']);
    expect(validateReachability(level)).toBe(true);
  });

  it('jump-gap is reachable', () => {
    const level = loadLevel(FIXTURE_SOURCES['jump-gap']);
    expect(validateReachability(level)).toBe(true);
  });

  it('shaft is reachable', () => {
    const level = loadLevel(FIXTURE_SOURCES['shaft']);
    expect(validateReachability(level)).toBe(true);
  });

  it('walled-off exit is not reachable', () => {
    // Block the corridor with 5+ solid tiles (> max jump distance of 4)
    const veryBlocked = loadLevel({
      name: 'very-blocked',
      cols: 10, rows: 3,
      spawn: { col: 0, row: 1 },
      exit: { col: 9, row: 1 },
      tiles: ['1111111111', '1011111001', '1111111111'],
      traps: [],
    });
    // Columns 2-6 are solid in row 1, 5 tiles thick > 4 tile jump
    expect(validateReachability(veryBlocked)).toBe(false);
  });
});

describe('variant validation', () => {
  it('validates all mutation variants', () => {
    const level: MutableLevelData = {
      ...loadLevel(FIXTURE_SOURCES['corridor']),
      mutations: [{ attempt: 2, deltas: [{ kind: 'set-tile', col: 5, row: 1, tile: 1 }] }],
    };
    const result = validateAllVariants(level, 5);
    expect(result.variantResults.length).toBeGreaterThan(0);
    // Base level (attempt 1) should be reachable
    expect(result.variantResults[0]!.reachable).toBe(true);
  });

  it('stops early when no more mutations', () => {
    const level: MutableLevelData = {
      ...loadLevel(FIXTURE_SOURCES['corridor']),
      mutations: [{ attempt: 2, deltas: [] }],
    };
    const result = validateAllVariants(level, 100);
    // Should not iterate all 100 attempts
    expect(result.variantResults.length).toBeLessThan(10);
  });
});
