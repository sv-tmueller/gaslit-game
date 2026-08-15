import { describe, expect, it } from 'vitest';
import { validateReachability } from './reachability';
import { loadLevel } from '../levels/load';
import { FIXTURE_SOURCES } from '../levels/fixtures';

describe('reachability validation (physics-calibrated)', () => {
  it('corridor is reachable', () => {
    const level = loadLevel(FIXTURE_SOURCES['corridor']);
    expect(validateReachability(level)).toBe(true);
  });

  it('jump-gap is reachable', () => {
    const level = loadLevel(FIXTURE_SOURCES['jump-gap']);
    expect(validateReachability(level)).toBe(true);
  });

  it('shaft (redesigned, overlapping ledges) is reachable', () => {
    const level = loadLevel(FIXTURE_SOURCES['shaft']);
    expect(validateReachability(level)).toBe(true);
  });

  it('walled-off exit is not reachable', () => {
    const veryBlocked = loadLevel({
      name: 'very-blocked',
      cols: 10, rows: 3,
      spawn: { col: 0, row: 1 },
      exit: { col: 9, row: 1 },
      tiles: ['1111111111', '1011111001', '1111111111'],
      traps: [],
    });
    expect(validateReachability(veryBlocked)).toBe(false);
  });

  it('OLD shaft geometry (non-overlapping ledges, 2-col gap) is NOT reachable', () => {
    // Reproduce the original buggy shaft: left ledges cols 1-8, right ledges
    // cols 11-18. The 2-tile horizontal gap between alternating tiers exceeds
    // the jump envelope, so the validator must reject it.
    const oldShaft = loadLevel({
      name: 'old-shaft',
      cols: 20, rows: 24,
      spawn: { col: 2, row: 21 },
      exit: { col: 4, row: 1 },
      tiles: [
        '11111111111111111111',
        '10000000000000000001',
        '10000000000222222221',
        '10000000000000000001',
        '12222222200000000001',
        '10000000000000000001',
        '10000000000222222221',
        '10000000000000000001',
        '12222222200000000001',
        '10000000000000000001',
        '10000000000222222221',
        '10000000000000000001',
        '12222222200000000001',
        '10000000000000000001',
        '10000000000222222221',
        '10000000000000000001',
        '12222222200000000001',
        '10000000000000000001',
        '10000000000222222221',
        '10000000000000000001',
        '12222222200000000001',
        '10000000000000000001',
        '11111111111111111111',
        '11111111111111111111',
      ],
      traps: [],
    });
    expect(validateReachability(oldShaft)).toBe(false);
  });

  it('ledge too high (3-tile vertical gap) is NOT reachable', () => {
    // A single platform 3 tiles above the floor, with the exit on it.
    // The player can rise ~2 tiles, so 3 should be unreachable.
    const tooHigh = loadLevel({
      name: 'too-high',
      cols: 10, rows: 6,
      spawn: { col: 1, row: 4 },
      exit: { col: 1, row: 1 },
      tiles: [
        '1111111111',
        '1000000001',
        '1000000001',
        '1000000001',
        '1000000001',
        '1111111111',
      ],
      traps: [],
    });
    expect(validateReachability(tooHigh)).toBe(false);
  });
});
