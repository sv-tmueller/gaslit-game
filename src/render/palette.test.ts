import { describe, expect, it } from 'vitest';
import { PALETTE, PALETTE_ORDER } from './palette';

describe('PALETTE', () => {
  it('has exactly 6 entries', () => {
    expect(Object.keys(PALETTE)).toHaveLength(6);
  });

  it('every value is a lowercase 6-digit hex color', () => {
    for (const value of Object.values(PALETTE)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('has 6 distinct values', () => {
    const values = Object.values(PALETTE);
    expect(new Set(values).size).toBe(values.length);
  });

  it('PALETTE_ORDER lists every palette key exactly once', () => {
    const keys = Object.keys(PALETTE).sort();
    expect([...PALETTE_ORDER].sort()).toEqual(keys);
    expect(new Set(PALETTE_ORDER).size).toBe(PALETTE_ORDER.length);
  });
});
