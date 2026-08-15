// Fake UI trolls: fake crash, fake pause, fake settings. Fourth-wall trolls
// rendered INSIDE the game canvas. Hard boundary: nothing here imitates browser
// chrome, OS, security/payment prompts, or interferes with closing the tab.

import { createPrng } from '../engine/prng';

export type FakeUiKind = 'fake-crash' | 'fake-pause' | 'fake-settings' | 'fake-loading';

export interface FakeUiState {
  active: boolean;
  kind: FakeUiKind;
  timer: number;       // remaining steps
  seed: number;
  dismissed: boolean;
}

export function createFakeUi(seed: number): FakeUiState {
  return { active: false, kind: 'fake-crash', timer: 0, seed, dismissed: false };
}

export function triggerFakeUi(state: FakeUiState, kind: FakeUiKind, durationSteps: number): FakeUiState {
  return { ...state, active: true, kind, timer: durationSteps, dismissed: false };
}

export function stepFakeUi(state: FakeUiState, _dt: number): FakeUiState {
  void _dt;
  if (!state.active || state.dismissed) return state;
  const timer = state.timer - 1;
  if (timer <= 0) {
    return { ...state, active: false, timer: 0 };
  }
  return { ...state, timer };
}

export function dismissFakeUi(state: FakeUiState): FakeUiState {
  return { ...state, active: false, dismissed: true, timer: 0 };
}

export function getFakeLoadingProgress(state: FakeUiState): number {
  if (!state.active || state.kind !== 'fake-loading') return 0;
  // Deterministic progress based on seed and elapsed
  const prng = createPrng(state.seed);
  // Slowly crawl toward 90%, never completing
  const elapsed = 1 - state.timer / 120;
  return Math.min(0.9, elapsed * 0.9 + prng.next() * 0.05);
}
