// Hit-stop: freezes the simulation for a few steps on impactful moments.
// Cosmetic only; never alters gameplay. Intensity scales the duration.

export interface HitStopState {
  active: boolean;
  remainingSteps: number;
  intensity: number;
}

export function createHitStop(intensity: number): HitStopState {
  return { active: false, remainingSteps: 0, intensity };
}

export function triggerHitStop(state: HitStopState, steps: number): HitStopState {
  const scaled = Math.round(steps * state.intensity);
  if (scaled <= 0) return state;
  return { ...state, active: true, remainingSteps: scaled };
}

export function stepHitStop(state: HitStopState, _dt: number): HitStopState {
  void _dt;
  if (!state.active) return state;
  const remaining = state.remainingSteps - 1;
  if (remaining <= 0) return { ...state, active: false, remainingSteps: 0 };
  return { ...state, remainingSteps: remaining };
}

export function isFrozen(state: HitStopState): boolean {
  return state.active;
}
