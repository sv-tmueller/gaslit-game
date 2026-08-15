import { describe, expect, it } from 'vitest';
import { createRotatingArm, stepRotatingArm, getBladeAABB, isPlayerHit, resetRotatingArm } from './rotating-arm';
import type { Body } from '../engine/physics';

function makeBody(x: number, y: number): Body {
  return { x, y, width: 16, height: 16, velocity: { x: 0, y: 0 }, grounded: false };
}

describe('rotating-arm', () => {
  it('angle advances by angularSpeed', () => {
    let arm = createRotatingArm(100, 100, 48, 0.1);
    arm = stepRotatingArm(arm, 1/60);
    expect(arm.angle).toBeCloseTo(0.1);
  });
  it('blade AABB is at the arm tip', () => {
    const arm = createRotatingArm(100, 100, 48, 0, 0);
    const aabb = getBladeAABB(arm);
    // At angle 0, blade is at (148, 100)
    expect(aabb.x).toBeCloseTo(140);
    expect(aabb.y).toBeCloseTo(92);
  });
  it('detects player hit at blade position', () => {
    const arm = createRotatingArm(100, 100, 48, 0, 0);
    const body = makeBody(140, 92);
    expect(isPlayerHit(arm, body)).toBe(true);
  });
  it('misses player far from blade', () => {
    const arm = createRotatingArm(100, 100, 48, 0, 0);
    const body = makeBody(0, 0);
    expect(isPlayerHit(arm, body)).toBe(false);
  });
  it('reset restores initial angle', () => {
    let arm = createRotatingArm(100, 100, 48, 0.1, 0.5);
    arm = stepRotatingArm(arm, 1/60);
    arm = resetRotatingArm(arm, 0.5);
    expect(arm.angle).toBe(0.5);
  });
});
