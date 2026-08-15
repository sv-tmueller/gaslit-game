import { describe, expect, it } from 'vitest';
import { createBomb, stepBomb, isInBlast, detonateNearbyBombs, getBlastArea } from './bomb';

describe('bomb', () => {
  it('fuse counts down', () => {
    let b = createBomb(100, 100, 5, 48, false);
    b = stepBomb(b, 1/60);
    expect(b.fuseSteps).toBe(4);
    expect(b.exploded).toBe(false);
  });
  it('explodes at fuse 0', () => {
    let b = createBomb(100, 100, 1, 48, false);
    b = stepBomb(b, 1/60);
    expect(b.exploded).toBe(true);
    expect(b.fuseSteps).toBe(0);
  });
  it('isInBlast checks radius', () => {
    const b = createBomb(100, 100, 0, 48, false);
    expect(isInBlast(120, 100, b)).toBe(true);
    expect(isInBlast(200, 100, b)).toBe(false);
  });
  it('chain reaction detonates nearby bombs', () => {
    const b1 = { ...createBomb(100, 100, 0, 48, false), exploded: true };
    const b2 = createBomb(110, 100, 10, 48, false);
    const b3 = createBomb(500, 500, 10, 48, false);
    const result = detonateNearbyBombs([b1, b2, b3], b1);
    expect(result[1]!.exploded).toBe(true);
    expect(result[2]!.exploded).toBe(false);
  });
  it('getBlastArea returns AABB centered on bomb', () => {
    const b = createBomb(100, 100, 0, 48, false);
    const area = getBlastArea(b);
    expect(area.x).toBe(52);
    expect(area.width).toBe(96);
  });
});
