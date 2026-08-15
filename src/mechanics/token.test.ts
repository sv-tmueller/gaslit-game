import { describe, expect, it } from 'vitest';
import { createTokens, stepTokens, resetTokens, getCompletionPercent, isFullyCollected } from './token';
import type { Body } from '../engine/physics';

function makeBody(x: number, y: number): Body {
  return { x, y, width: 16, height: 16, velocity: { x: 0, y: 0 }, grounded: false };
}

describe('collectible tokens', () => {
  it('creates tokens from positions', () => {
    const state = createTokens([{ x: 100, y: 100 }, { x: 200, y: 200 }]);
    expect(state.totalTokens).toBe(2);
    expect(state.totalCollected).toBe(0);
  });

  it('collects token on player overlap', () => {
    let state = createTokens([{ x: 100, y: 100 }]);
    state = stepTokens(state, makeBody(100, 100));
    expect(state.totalCollected).toBe(1);
    expect(state.tokens[0]!.collected).toBe(true);
  });

  it('does not collect distant token', () => {
    let state = createTokens([{ x: 100, y: 100 }]);
    state = stepTokens(state, makeBody(500, 500));
    expect(state.totalCollected).toBe(0);
  });

  it('does not re-collect already collected token', () => {
    let state = createTokens([{ x: 100, y: 100 }]);
    state = stepTokens(state, makeBody(100, 100));
    expect(state.totalCollected).toBe(1);
    state = stepTokens(state, makeBody(100, 100));
    expect(state.totalCollected).toBe(1); // still 1, not 2
  });

  it('resetTokens uncollects all', () => {
    let state = createTokens([{ x: 100, y: 100 }, { x: 200, y: 200 }]);
    state = stepTokens(state, makeBody(100, 100));
    state = resetTokens(state);
    expect(state.totalCollected).toBe(0);
    expect(state.tokens[0]!.collected).toBe(false);
  });

  it('getCompletionPercent calculates ratio', () => {
    let state = createTokens([{ x: 100, y: 100 }, { x: 200, y: 200 }, { x: 300, y: 300 }]);
    state = stepTokens(state, makeBody(100, 100));
    expect(getCompletionPercent(state)).toBeCloseTo(1/3);
  });

  it('isFullyCollected when all collected', () => {
    let state = createTokens([{ x: 100, y: 100 }]);
    state = stepTokens(state, makeBody(100, 100));
    expect(isFullyCollected(state)).toBe(true);
  });

  it('isFullyCollected false when not all collected', () => {
    const state = createTokens([{ x: 100, y: 100 }, { x: 200, y: 200 }]);
    expect(isFullyCollected(state)).toBe(false);
  });

  it('empty tokens returns 100%', () => {
    const state = createTokens([]);
    expect(getCompletionPercent(state)).toBe(1);
    expect(isFullyCollected(state)).toBe(true);
  });
});
