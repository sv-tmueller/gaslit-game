// Camera trolls: zoom, flip, offset, and lag. Cosmetic distortions of the camera
// that mess with the player's perception. Deterministic, intensity-scaled.

export type CameraTrollKind = 'zoom' | 'flip' | 'offset' | 'lag';

export interface CameraTrollState {
  active: boolean;
  kind: CameraTrollKind;
  intensity: number;
  timer: number;          // remaining steps
  offsetX: number;
  offsetY: number;
  zoom: number;           // 1.0 = normal
  flipped: boolean;
  lagFrames: number;      // how many frames the camera trails the player
}

export function createCameraTroll(kind: CameraTrollKind, intensity: number): CameraTrollState {
  return {
    active: false, kind, intensity, timer: 0,
    offsetX: 0, offsetY: 0, zoom: 1, flipped: false, lagFrames: 0,
  };
}

export function triggerCameraTroll(state: CameraTrollState, durationSteps: number): CameraTrollState {
  let offset = 0;
  let zoom = 1;
  let flipped = false;
  let lag = 0;

  switch (state.kind) {
    case 'zoom':
      zoom = 1 + state.intensity * 0.5;
      break;
    case 'flip':
      flipped = true;
      break;
    case 'offset':
      offset = Math.round(state.intensity * 32);
      break;
    case 'lag':
      lag = Math.round(state.intensity * 5);
      break;
  }

  return { ...state, active: true, timer: durationSteps, offsetX: offset, offsetY: offset, zoom, flipped, lagFrames: lag };
}

export function stepCameraTroll(state: CameraTrollState, _dt: number): CameraTrollState {
  void _dt;
  if (!state.active) return state;
  const timer = state.timer - 1;
  if (timer <= 0) {
    return { ...state, active: false, timer: 0, offsetX: 0, offsetY: 0, zoom: 1, flipped: false, lagFrames: 0 };
  }
  return { ...state, timer };
}

export function isActive(state: CameraTrollState): boolean {
  return state.active;
}
