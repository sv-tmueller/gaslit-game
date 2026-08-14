import { describe, expect, it } from 'vitest';
import { aabbOverlap, type AABB } from './physics';

function box(x: number, y: number, w: number, h: number): AABB {
  return { x, y, width: w, height: h };
}

describe('aabbOverlap', () => {
  it('detects full overlap (identical boxes)', () => {
    const a = box(10, 10, 16, 16);
    const b = box(10, 10, 16, 16);
    expect(aabbOverlap(a, b)).toBe(true);
  });

  it('detects partial overlap', () => {
    const a = box(0, 0, 16, 16);
    const b = box(8, 8, 16, 16);
    expect(aabbOverlap(a, b)).toBe(true);
  });

  it('reports no overlap when flush-left (touching left edge)', () => {
    const a = box(0, 0, 16, 16);
    const b = box(-16, 0, 16, 16);
    expect(aabbOverlap(a, b)).toBe(false);
  });

  it('reports no overlap when flush-right (touching right edge)', () => {
    const a = box(0, 0, 16, 16);
    const b = box(16, 0, 16, 16);
    expect(aabbOverlap(a, b)).toBe(false);
  });

  it('reports no overlap when flush-above (touching top edge)', () => {
    const a = box(0, 0, 16, 16);
    const b = box(0, -16, 16, 16);
    expect(aabbOverlap(a, b)).toBe(false);
  });

  it('reports no overlap when flush-below (touching bottom edge)', () => {
    const a = box(0, 0, 16, 16);
    const b = box(0, 16, 16, 16);
    expect(aabbOverlap(a, b)).toBe(false);
  });

  it('reports no overlap when fully disjoint', () => {
    const a = box(0, 0, 16, 16);
    const b = box(100, 100, 16, 16);
    expect(aabbOverlap(a, b)).toBe(false);
  });
});
