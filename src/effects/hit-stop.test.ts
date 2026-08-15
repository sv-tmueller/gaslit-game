import { describe, expect, it } from 'vitest';
import { createHitStop, isFrozen, stepHitStop, triggerHitStop } from './hit-stop';

describe('hit-stop', () => {
  it('starts inactive', () => {
    const hs = createHitStop(1);
    expect(hs.active).toBe(false);
    expect(isFrozen(hs)).toBe(false);
  });

  it('activates on trigger', () => {
    const hs = createHitStop(1);
    const triggered = triggerHitStop(hs, 3);
    expect(triggered.active).toBe(true);
    expect(triggered.remainingSteps).toBe(3);
    expect(isFrozen(triggered)).toBe(true);
  });

  it('counts down and deactivates', () => {
    let hs = triggerHitStop(createHitStop(1), 3);
    hs = stepHitStop(hs, 1/60);
    expect(hs.remainingSteps).toBe(2);
    expect(isFrozen(hs)).toBe(true);
    hs = stepHitStop(hs, 1/60);
    expect(hs.remainingSteps).toBe(1);
    hs = stepHitStop(hs, 1/60);
    expect(hs.active).toBe(false);
    expect(isFrozen(hs)).toBe(false);
  });

  it('intensity scales duration', () => {
    const hs = triggerHitStop(createHitStop(0.5), 4);
    expect(hs.remainingSteps).toBe(2);
  });

  it('intensity 0 produces no freeze', () => {
    const hs = triggerHitStop(createHitStop(0), 3);
    expect(hs.active).toBe(false);
  });

  it('is no-op when already inactive', () => {
    const hs = createHitStop(1);
    const stepped = stepHitStop(hs, 1/60);
    expect(stepped.active).toBe(false);
  });
});
