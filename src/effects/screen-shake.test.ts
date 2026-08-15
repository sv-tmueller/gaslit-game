import { describe, expect, it } from 'vitest';
import { createShake, stepShake, triggerShake } from './screen-shake';

describe('screen-shake', () => {
  it('starts with zero offset', () => {
    const s = createShake(42, 1);
    expect(s.offsetX).toBe(0);
    expect(s.offsetY).toBe(0);
    expect(s.magnitude).toBe(0);
  });

  it('produces non-zero offset when triggered', () => {
    let s = createShake(42, 1);
    s = triggerShake(s, 8);
    s = stepShake(s, 1/60);
    expect(s.magnitude).toBeGreaterThan(0);
    // Offset should be within [-8, 8]
    expect(Math.abs(s.offsetX)).toBeLessThanOrEqual(8);
    expect(Math.abs(s.offsetY)).toBeLessThanOrEqual(8);
  });

  it('decays over steps', () => {
    let s = createShake(42, 1);
    s = triggerShake(s, 8);
    const mags: number[] = [];
    for (let i = 0; i < 10; i++) {
      s = stepShake(s, 1/60);
      mags.push(s.magnitude);
    }
    // Magnitude should decrease over time
    expect(mags[9]!).toBeLessThan(mags[0]!);
  });

  it('intensity 0 produces no shake', () => {
    let s = createShake(42, 0);
    s = triggerShake(s, 8);
    expect(s.magnitude).toBe(0);
    s = stepShake(s, 1/60);
    expect(s.offsetX).toBe(0);
    expect(s.offsetY).toBe(0);
  });

  it('is deterministic: same seed produces same offsets', () => {
    let s1 = createShake(42, 1);
    s1 = triggerShake(s1, 8);
    s1 = stepShake(s1, 1/60);

    let s2 = createShake(42, 1);
    s2 = triggerShake(s2, 8);
    s2 = stepShake(s2, 1/60);

    expect(s1.offsetX).toBe(s2.offsetX);
    expect(s1.offsetY).toBe(s2.offsetY);
  });

  it('offsets are integers', () => {
    let s = createShake(99, 1);
    s = triggerShake(s, 8);
    s = stepShake(s, 1/60);
    expect(Number.isInteger(s.offsetX)).toBe(true);
    expect(Number.isInteger(s.offsetY)).toBe(true);
  });
});
