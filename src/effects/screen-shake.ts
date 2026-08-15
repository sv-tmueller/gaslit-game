// Screen shake: deterministic shake offsets driven by a seeded PRNG.
// Cosmetically offsets the camera; never alters physics. Intensity scales magnitude.

import { createPrng } from '../engine/prng';

export interface ShakeState {
  magnitude: number;
  decay: number;
  offsetX: number;
  offsetY: number;
  seed: number;
  intensity: number;
}

export function createShake(seed: number, intensity: number): ShakeState {
  return { magnitude: 0, decay: 1.5, offsetX: 0, offsetY: 0, seed, intensity };
}

export function triggerShake(state: ShakeState, magnitude: number): ShakeState {
  const scaled = magnitude * state.intensity;
  if (scaled <= 0) return state;
  return { ...state, magnitude: Math.max(state.magnitude, scaled) };
}

export function stepShake(state: ShakeState, _dt: number): ShakeState {
  void _dt;
  if (state.magnitude <= 0) {
    return { ...state, offsetX: 0, offsetY: 0, magnitude: 0 };
  }
  const prng = createPrng(state.seed ^ Math.floor(state.magnitude * 1000));
  const angle = prng.next() * Math.PI * 2;
  const mag = state.magnitude;
  const ox = Math.round(Math.cos(angle) * mag);
  const oy = Math.round(Math.sin(angle) * mag);
  const newMag = Math.max(0, state.magnitude - state.decay);
  return { ...state, offsetX: ox, offsetY: oy, magnitude: newMag };
}
