// Control inversion: swaps left/right inputs. The player presses right, the
// character moves left. Deterministic, toggleable.

import type { ControllerActions } from '../engine/controller';

export interface ControlInversionState {
  inverted: boolean;
  duration: number;       // remaining steps of inversion (-1 = infinite)
}

export function createControlInversion(duration: number = -1): ControlInversionState {
  return { inverted: false, duration };
}

export function activateInversion(state: ControlInversionState): ControlInversionState {
  return { ...state, inverted: true };
}

export function deactivateInversion(state: ControlInversionState): ControlInversionState {
  return { ...state, inverted: false };
}

export function stepControlInversion(state: ControlInversionState, _dt: number): ControlInversionState {
  void _dt;
  if (!state.inverted || state.duration < 0) return state;
  const remaining = state.duration - 1;
  if (remaining <= 0) return { ...state, inverted: false, duration: 0 };
  return { ...state, duration: remaining };
}

export function invertActions(actions: ControllerActions, inverted: boolean): ControllerActions {
  if (!inverted) return actions;
  return {
    ...actions,
    left: actions.right,
    right: actions.left,
  };
}
