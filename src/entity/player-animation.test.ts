import { describe, expect, it } from 'vitest';
import {
  CLIPS,
  createAnimTrack,
  currentFrame,
  FRAME_DURATION,
  selectAnimState,
  stepAnimation,
  type AnimTrack,
} from './player-animation';

const DT = 1 / 60;

describe('selectAnimState', () => {
  it('returns idle when grounded and |vx| <= 1', () => {
    expect(selectAnimState(true, 0, 0)).toBe('idle');
    expect(selectAnimState(true, 1, 0)).toBe('idle');
    expect(selectAnimState(true, -1, 0)).toBe('idle');
  });

  it('returns run when grounded and |vx| > 1', () => {
    expect(selectAnimState(true, 2, 0)).toBe('run');
    expect(selectAnimState(true, -120, 0)).toBe('run');
  });

  it('returns jump when airborne and vy < 0', () => {
    expect(selectAnimState(false, 0, -260)).toBe('jump');
    expect(selectAnimState(false, 120, -1)).toBe('jump');
  });

  it('returns fall when airborne and vy >= 0', () => {
    expect(selectAnimState(false, 0, 0)).toBe('fall');
    expect(selectAnimState(false, 0, 400)).toBe('fall');
    expect(selectAnimState(false, 120, 1)).toBe('fall');
  });

  it('prioritizes aerial state over run (airborne with high vx)', () => {
    expect(selectAnimState(false, 120, -260)).toBe('jump');
    expect(selectAnimState(false, 120, 100)).toBe('fall');
  });
});

describe('CLIPS', () => {
  it('defines the expected frame sequences', () => {
    expect(CLIPS.idle).toEqual(['player.idle.0', 'player.idle.1']);
    expect(CLIPS.run).toEqual([
      'player.run.0',
      'player.run.1',
      'player.run.2',
      'player.run.3',
    ]);
    expect(CLIPS.jump).toEqual(['player.jump']);
    expect(CLIPS.fall).toEqual(['player.fall']);
  });
});

describe('FRAME_DURATION', () => {
  it('is 6/60 seconds (0.1s)', () => {
    expect(FRAME_DURATION).toBeCloseTo(0.1);
  });
});

describe('stepAnimation', () => {
  it('starts in idle state', () => {
    const track = createAnimTrack();
    expect(track.state).toBe('idle');
    expect(track.frameIndex).toBe(0);
    expect(track.stepAccumulator).toBe(0);
    expect(track.facing).toBe(1);
  });

  it('defaults facing to -1 when specified', () => {
    expect(createAnimTrack(-1).facing).toBe(-1);
  });

  it('advances frame index after FRAME_DURATION elapses', () => {
    let track: AnimTrack = createAnimTrack();
    // Stay in idle (grounded, low vx).
    // Accumulate 0.1s worth of dt steps.
    for (let i = 0; i < 6; i++) {
      track = stepAnimation(track, true, 0, 0, DT);
    }
    // 6 * (1/60) = 0.1 == FRAME_DURATION, so frameIndex advances to 1.
    expect(track.frameIndex).toBe(1);
    expect(currentFrame(track)).toBe('player.idle.1');
  });

  it('wraps frame index modulo clip length', () => {
    let track: AnimTrack = createAnimTrack();

    // Advance through the entire idle clip (2 frames) and wrap.
    for (let i = 0; i < 12; i++) {
      track = stepAnimation(track, true, 0, 0, DT);
    }
    // 12 * DT = 0.2s = 2 * FRAME_DURATION -> frameIndex = 2 % 2 = 0
    expect(track.frameIndex).toBe(0);
    expect(currentFrame(track)).toBe('player.idle.0');
  });

  it('resets frame index on state change idle -> run', () => {
    let track: AnimTrack = createAnimTrack();
    // Advance idle a bit.
    for (let i = 0; i < 3; i++) {
      track = stepAnimation(track, true, 0, 0, DT);
    }
    expect(track.frameIndex).toBe(0); // hasn't reached FRAME_DURATION yet
    expect(track.stepAccumulator).toBeCloseTo(3 * DT, 5);

    // Transition to run.
    track = stepAnimation(track, true, 120, 0, DT);
    expect(track.state).toBe('run');
    expect(track.frameIndex).toBe(0);
    expect(track.stepAccumulator).toBe(0);
    expect(currentFrame(track)).toBe('player.run.0');
  });

  it('transitions between jump and fall based on vy sign', () => {
    let track: AnimTrack = createAnimTrack();

    // Jump (airborne, vy < 0).
    track = stepAnimation(track, false, 0, -260, DT);
    expect(track.state).toBe('jump');
    expect(currentFrame(track)).toBe('player.jump');

    // Fall (airborne, vy >= 0).
    track = stepAnimation(track, false, 0, 0, DT);
    expect(track.state).toBe('fall');
    expect(currentFrame(track)).toBe('player.fall');
  });

  it('single-frame clips never advance frame index', () => {
    let track: AnimTrack = createAnimTrack();

    // Stay in jump (single frame) for many steps.
    for (let i = 0; i < 30; i++) {
      track = stepAnimation(track, false, 0, -260, DT);
    }
    expect(track.state).toBe('jump');
    expect(track.frameIndex).toBe(0);
    expect(track.stepAccumulator).toBe(0);
  });

  it('updates facing to 1 when vx > 0', () => {
    const track = stepAnimation(createAnimTrack(), true, 120, 0, DT);
    expect(track.facing).toBe(1);
  });

  it('updates facing to -1 when vx < 0', () => {
    const track = stepAnimation(createAnimTrack(), true, -120, 0, DT);
    expect(track.facing).toBe(-1);
  });

  it('preserves facing when vx == 0', () => {
    let track: AnimTrack = createAnimTrack(-1);
    track = stepAnimation(track, true, 0, 0, DT);
    expect(track.facing).toBe(-1);

    track = stepAnimation(createAnimTrack(1), true, 0, 0, DT);
    expect(track.facing).toBe(1);
  });

  it('returns a new track (immutable)', () => {
    const track = createAnimTrack();
    const next = stepAnimation(track, true, 0, 0, DT);
    expect(next).not.toBe(track);
    // Original is unchanged.
    expect(track.frameIndex).toBe(0);
    expect(track.stepAccumulator).toBe(0);
  });

  it('accumulates fractional remainder across steps', () => {
    let track: AnimTrack = createAnimTrack();

    // Step 5 times (5/60 = 0.0833s, just under FRAME_DURATION).
    for (let i = 0; i < 5; i++) {
      track = stepAnimation(track, true, 0, 0, DT);
    }
    expect(track.frameIndex).toBe(0);
    // 6th step crosses threshold: 6/60 = 0.1 == FRAME_DURATION.
    track = stepAnimation(track, true, 0, 0, DT);
    expect(track.frameIndex).toBe(1);
  });
});

describe('currentFrame', () => {
  it('returns the correct frame for each state', () => {
    expect(currentFrame({ state: 'idle', frameIndex: 0, stepAccumulator: 0, facing: 1 })).toBe('player.idle.0');
    expect(currentFrame({ state: 'idle', frameIndex: 1, stepAccumulator: 0, facing: 1 })).toBe('player.idle.1');
    expect(currentFrame({ state: 'run', frameIndex: 2, stepAccumulator: 0, facing: 1 })).toBe('player.run.2');
    expect(currentFrame({ state: 'jump', frameIndex: 0, stepAccumulator: 0, facing: 1 })).toBe('player.jump');
    expect(currentFrame({ state: 'fall', frameIndex: 0, stepAccumulator: 0, facing: 1 })).toBe('player.fall');
  });
});
