import { describe, expect, it } from 'vitest';
import { createLever, stepLevers, isActivated } from './lever';
import type { Body } from '../engine/physics';

function makeBody(x: number, y: number): Body {
  return { x, y, width: 16, height: 16, velocity: { x: 0, y: 0 }, grounded: false };
}

describe('lever', () => {
  it('pressure plate activates on contact', () => {
    const plate = createLever(100, 100, true);
    const body = makeBody(100, 100);
    const result = stepLevers([plate], body, false);
    expect(isActivated(result[0]!)).toBe(true);
  });
  it('pressure plate deactivates when player leaves', () => {
    let plate = createLever(100, 100, true);
    plate = stepLevers([plate], makeBody(100, 100), false)[0]!;
    expect(isActivated(plate)).toBe(true);
    plate = stepLevers([plate], makeBody(200, 200), false)[0]!;
    expect(isActivated(plate)).toBe(false);
  });
  it('lever toggles on jump press while overlapping', () => {
    let lever = createLever(100, 100, false);
    lever = stepLevers([lever], makeBody(100, 100), true)[0]!;
    expect(isActivated(lever)).toBe(true);
    lever = stepLevers([lever], makeBody(100, 100), true)[0]!;
    expect(isActivated(lever)).toBe(false);
  });
  it('lever does not toggle without jump press', () => {
    let lever = createLever(100, 100, false);
    lever = stepLevers([lever], makeBody(100, 100), false)[0]!;
    expect(isActivated(lever)).toBe(false);
  });
  it('lever does not toggle when not overlapping', () => {
    let lever = createLever(100, 100, false);
    lever = stepLevers([lever], makeBody(500, 500), true)[0]!;
    expect(isActivated(lever)).toBe(false);
  });
});
