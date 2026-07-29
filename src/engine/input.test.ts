import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, createKeyboardInput, type InputAction } from './input';

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

describe('createKeyboardInput multi-code actions and blur', () => {
  it('keeps held true and fires no extra edges when rolling between two codes bound to one action', () => {
    const input = createKeyboardInput();

    input.keyDown('ArrowLeft');
    input.sample();

    input.keyDown('KeyA');
    input.keyUp('ArrowLeft');
    const rollSnapshot = input.sample();

    expect(rollSnapshot.held.left).toBe(true);
    expect(rollSnapshot.pressed.left).toBe(false);
    expect(rollSnapshot.released.left).toBe(false);

    input.keyUp('KeyA');
    const releaseSnapshot = input.sample();

    expect(releaseSnapshot.held.left).toBe(false);
    expect(releaseSnapshot.released.left).toBe(true);
  });

  it('clears held and emits released for actions that were held on blur', () => {
    const input = createKeyboardInput();
    input.keyDown('ArrowRight');
    input.sample();

    input.blur();
    const snapshot = input.sample();

    expect(snapshot.held.right).toBe(false);
    expect(snapshot.released.right).toBe(true);
  });

  it('still reports pressed for a key that goes down then blurs within one window', () => {
    const input = createKeyboardInput();

    input.keyDown('ArrowRight');
    input.blur();
    const snapshot = input.sample();

    expect(snapshot.pressed.right).toBe(true);
    expect(snapshot.released.right).toBe(true);
    expect(snapshot.held.right).toBe(false);
  });

  it('leaves everything false and isBound false for an unbound code', () => {
    const input = createKeyboardInput();

    input.keyDown('KeyZ');
    const snapshot = input.sample();

    expect(input.isBound('KeyZ')).toBe(false);
    for (const action of ['left', 'right', 'jump', 'restart', 'pause'] satisfies InputAction[]) {
      expect(snapshot.held[action]).toBe(false);
      expect(snapshot.pressed[action]).toBe(false);
      expect(snapshot.released[action]).toBe(false);
    }
  });

  it('reports every action false before any input is given', () => {
    const input = createKeyboardInput();

    const snapshot = input.sample();

    for (const action of ['left', 'right', 'jump', 'restart', 'pause'] satisfies InputAction[]) {
      expect(snapshot.held[action]).toBe(false);
      expect(snapshot.pressed[action]).toBe(false);
      expect(snapshot.released[action]).toBe(false);
    }
  });
});

describe('DEFAULT_BINDINGS', () => {
  it('never binds the same code to two different actions', () => {
    const seen = new Map<string, InputAction>();

    for (const [action, codes] of Object.entries(DEFAULT_BINDINGS) as Array<
      [InputAction, readonly string[]]
    >) {
      for (const code of codes) {
        expect(seen.has(code)).toBe(false);
        seen.set(code, action);
      }
    }
  });

  it('covers movement with arrows and WASD, jump with space and up, and restart with R', () => {
    expect(DEFAULT_BINDINGS.left).toEqual(expect.arrayContaining(['ArrowLeft', 'KeyA']));
    expect(DEFAULT_BINDINGS.right).toEqual(expect.arrayContaining(['ArrowRight', 'KeyD']));
    expect(DEFAULT_BINDINGS.jump).toEqual(expect.arrayContaining(['Space', 'ArrowUp']));
    expect(DEFAULT_BINDINGS.restart).toEqual(expect.arrayContaining(['KeyR']));
  });
});
