import { describe, expect, it } from 'vitest';
import { createMovingPlatform, stepMovingPlatform, isPlayerOnPlatform, resetMovingPlatform } from './moving-terrain';
import type { Body } from '../engine/physics';

function makeBody(x: number, y: number): Body {
  return { x, y, width: 16, height: 16, velocity: { x: 0, y: 0 }, grounded: false };
}

describe('moving-terrain', () => {
  it('platform moves in direction', () => {
    let p = createMovingPlatform(100, 100, 48, 16, 1, 0, 10, 200);
    p = stepMovingPlatform(p, 1/60);
    expect(p.x).toBeGreaterThan(100);
  });
  it('platform reverses at max distance', () => {
    let p = createMovingPlatform(100, 100, 48, 16, 1, 0, 200, 100);
    // speed=200, distance=100 -> reverses after 1 step
    p = stepMovingPlatform(p, 1/60);
    expect(p.direction).toBe(-1);
  });
  it('detects player on platform', () => {
    const p = createMovingPlatform(100, 100, 48, 16, 1, 0, 10, 200);
    expect(isPlayerOnPlatform(p, makeBody(100, 100))).toBe(true);
  });
  it('reset restores start position', () => {
    let p = createMovingPlatform(100, 100, 48, 16, 1, 0, 10, 200);
    p = stepMovingPlatform(p, 1/60);
    p = resetMovingPlatform(p);
    expect(p.x).toBe(100);
    expect(p.y).toBe(100);
    expect(p.direction).toBe(1);
  });
});
