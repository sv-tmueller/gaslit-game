import { describe, expect, it } from 'vitest';
import { createKeyboardInput } from './input';

describe('createKeyboardInput core edges', () => {
  it('reports pressed for exactly one sample after a key goes down', () => {
    const input = createKeyboardInput();

    input.keyDown('ArrowRight');
    const first = input.sample();
    expect(first.pressed.right).toBe(true);
    expect(first.held.right).toBe(true);

    const second = input.sample();
    expect(second.pressed.right).toBe(false);
    expect(second.held.right).toBe(true);
  });

  it('collapses repeated downs for the same code within one frame into a single pressed edge', () => {
    const input = createKeyboardInput();

    input.keyDown('ArrowRight');
    input.keyDown('ArrowRight');
    input.keyDown('ArrowRight');
    const first = input.sample();
    expect(first.pressed.right).toBe(true);

    const second = input.sample();
    expect(second.pressed.right).toBe(false);
  });

  it('registers both press and release when a key goes down then up between two samples', () => {
    const input = createKeyboardInput();

    input.keyDown('ArrowRight');
    input.keyUp('ArrowRight');
    const snapshot = input.sample();

    expect(snapshot.pressed.right).toBe(true);
    expect(snapshot.released.right).toBe(true);
    expect(snapshot.held.right).toBe(false);
  });

  it('registers both press and release when a key goes up then down between two samples', () => {
    const input = createKeyboardInput();
    input.keyDown('ArrowRight');
    input.sample();

    input.keyUp('ArrowRight');
    input.keyDown('ArrowRight');
    const snapshot = input.sample();

    expect(snapshot.pressed.right).toBe(true);
    expect(snapshot.released.right).toBe(true);
    expect(snapshot.held.right).toBe(true);
  });
});
