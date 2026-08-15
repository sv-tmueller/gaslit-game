import { describe, expect, it } from 'vitest';
import { createControlInversion, activateInversion, deactivateInversion, stepControlInversion, invertActions } from './control-inversion';
import type { ControllerActions } from '../engine/controller';

const actions: ControllerActions = { left: true, right: false, jumpPressed: false, jumpHeld: false };

describe('control-inversion', () => {
  it('starts not inverted', () => {
    expect(createControlInversion().inverted).toBe(false);
  });
  it('activate sets inverted', () => {
    expect(activateInversion(createControlInversion()).inverted).toBe(true);
  });
  it('deactivate clears inverted', () => {
    expect(deactivateInversion(activateInversion(createControlInversion())).inverted).toBe(false);
  });
  it('invertActions swaps left/right', () => {
    const inverted = invertActions(actions, true);
    expect(inverted.left).toBe(false);
    expect(inverted.right).toBe(true);
  });
  it('invertActions does nothing when not inverted', () => {
    const same = invertActions(actions, false);
    expect(same).toEqual(actions);
  });
  it('timed inversion expires', () => {
    let s = activateInversion(createControlInversion(5));
    for (let i = 0; i < 5; i++) s = stepControlInversion(s, 1/60);
    expect(s.inverted).toBe(false);
  });
  it('infinite duration does not expire', () => {
    let s = activateInversion(createControlInversion(-1));
    for (let i = 0; i < 100; i++) s = stepControlInversion(s, 1/60);
    expect(s.inverted).toBe(true);
  });
});
