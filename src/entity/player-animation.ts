// Player animation state machine: pure, deterministic, no DOM/no clock.
// Driven by controller state (grounded, vx, vy) and stepped by fixed dt.

import type { AtlasFrameName } from '../render/atlas';

export type AnimState = 'idle' | 'run' | 'jump' | 'fall';

export const CLIPS: Readonly<Record<AnimState, readonly AtlasFrameName[]>> = {
  idle: ['player.idle.0', 'player.idle.1'],
  run: ['player.run.0', 'player.run.1', 'player.run.2', 'player.run.3'],
  jump: ['player.jump'],
  fall: ['player.fall'],
};

// 6 frames at 60 Hz = 0.1 s per animation frame.
export const FRAME_DURATION = 6 / 60;

export interface AnimTrack {
  readonly state: AnimState;
  readonly frameIndex: number;
  readonly stepAccumulator: number;
  readonly facing: 1 | -1;
}

export function selectAnimState(
  grounded: boolean,
  vx: number,
  vy: number,
): AnimState {
  if (!grounded) {
    return vy < 0 ? 'jump' : 'fall';
  }
  if (Math.abs(vx) > 1) {
    return 'run';
  }
  return 'idle';
}

export function createAnimTrack(facing?: 1 | -1): AnimTrack {
  return {
    state: 'idle',
    frameIndex: 0,
    stepAccumulator: 0,
    facing: facing ?? 1,
  };
}

export function stepAnimation(
  track: AnimTrack,
  grounded: boolean,
  vx: number,
  vy: number,
  dt: number,
): AnimTrack {
  const newState = selectAnimState(grounded, vx, vy);

  // Facing: vx>0 -> 1, vx<0 -> -1, vx==0 preserves previous facing.
  const facing: 1 | -1 =
    vx > 0 ? 1 : vx < 0 ? -1 : track.facing;

  // On state change, reset frame index and accumulator.
  if (newState !== track.state) {
    return {
      state: newState,
      frameIndex: 0,
      stepAccumulator: 0,
      facing,
    };
  }

  const clipLen = CLIPS[newState].length;

  // Single-frame clips never advance.
  if (clipLen <= 1) {
    return {
      state: newState,
      frameIndex: 0,
      stepAccumulator: 0,
      facing,
    };
  }

  let stepAccumulator = track.stepAccumulator + dt;
  let frameIndex = track.frameIndex;

  while (stepAccumulator >= FRAME_DURATION - 1e-9) {
    stepAccumulator -= FRAME_DURATION;
    frameIndex = (frameIndex + 1) % clipLen;
  }

  return {
    state: newState,
    frameIndex,
    stepAccumulator,
    facing,
  };
}

export function currentFrame(track: AnimTrack): AtlasFrameName {
  const clip = CLIPS[track.state];
  // frameIndex is guaranteed in-range by stepAnimation's modular arithmetic
  // and by the single-frame early-return. The ?? fallback covers the
  // impossible case where the invariant is violated.
  return clip[track.frameIndex] ?? clip[0]!;
}
