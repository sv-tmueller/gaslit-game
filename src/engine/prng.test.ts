import { describe, expect, it } from 'vitest';
import { createPrng } from './prng';

describe('createPrng', () => {
  it('produces the frozen golden sequence for seed 1', () => {
    const prng = createPrng(1);
    const values = Array.from({ length: 8 }, () => prng.next());

    // Golden values generated once from the finished mulberry32 core; any
    // change to the algorithm should change these, which is the point.
    expect(values).toEqual([
      0.6270739405881613,
      0.002735721180215478,
      0.5274470399599522,
      0.9810509674716741,
      0.9683778982143849,
      0.281103502959013,
      0.6128388606011868,
      0.7207431411370635,
    ]);
  });

  it('produces identical long sequences for two generators with the same seed', () => {
    const a = createPrng(42);
    const b = createPrng(42);

    const seqA = Array.from({ length: 200 }, () => a.next());
    const seqB = Array.from({ length: 200 }, () => b.next());

    expect(seqA).toEqual(seqB);
  });

  it('diverges within the first few draws for different seeds', () => {
    const a = createPrng(1);
    const b = createPrng(2);

    const early = [a.next(), a.next(), a.next(), b.next(), b.next(), b.next()];
    expect(early[0]).not.toBe(early[3]);
  });

  it('keeps next() in [0, 1) over a large sample', () => {
    const prng = createPrng(7);

    for (let i = 0; i < 10_000; i++) {
      const value = prng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('keeps int(min, max) in bounds and reaches both endpoints', () => {
    const prng = createPrng(3);
    const min = 5;
    const max = 8;

    let sawMin = false;
    let sawMax = false;
    for (let i = 0; i < 2000; i++) {
      const value = prng.int(min, max);
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
      expect(Number.isInteger(value)).toBe(true);
      if (value === min) sawMin = true;
      if (value === max) sawMax = true;
    }

    expect(sawMin).toBe(true);
    expect(sawMax).toBe(true);
  });

  it('choice returns only members of the array', () => {
    const prng = createPrng(9);
    const items = ['a', 'b', 'c'] as const;

    for (let i = 0; i < 200; i++) {
      expect(items).toContain(prng.choice(items));
    }
  });

  it('choice throws on an empty array', () => {
    const prng = createPrng(9);

    expect(() => prng.choice([])).toThrow();
  });

  it('round-trips state: a restored generator continues identically', () => {
    const source = createPrng(123);
    for (let i = 0; i < 50; i++) {
      source.next();
    }
    const state = source.getState();

    const restored = createPrng(999); // seed is irrelevant once state is set
    restored.setState(state);

    const continued = Array.from({ length: 50 }, () => source.next());
    const restoredContinued = Array.from({ length: 50 }, () => restored.next());

    expect(restoredContinued).toEqual(continued);
  });

  it('setState normalizes any number into a valid u32 state', () => {
    const prng = createPrng(1);
    expect(() => prng.setState(-1)).not.toThrow();
    const value = prng.next();
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it('distributes 100k draws roughly evenly across 10 buckets with mean near 0.5', () => {
    const prng = createPrng(1234);
    const buckets = new Array(10).fill(0);
    let sum = 0;
    const draws = 100_000;

    for (let i = 0; i < draws; i++) {
      const value = prng.next();
      sum += value;
      const bucket = Math.min(9, Math.floor(value * 10));
      buckets[bucket] += 1;
    }

    const expectedPerBucket = draws / 10;
    for (const count of buckets) {
      expect(count).toBeGreaterThan(expectedPerBucket * 0.9);
      expect(count).toBeLessThan(expectedPerBucket * 1.1);
    }

    expect(sum / draws).toBeGreaterThan(0.49);
    expect(sum / draws).toBeLessThan(0.51);
  });
});
