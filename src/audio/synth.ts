/**
 * Synthesized sound-effect generators.
 *
 * Each function is pure: given an AudioContextLike and a destination gain,
 * it creates oscillators with fixed frequencies, types, and envelopes.
 * No randomness, no external dependencies, no audio files.
 */

import type { AudioContextLike, GainLike, SfxName } from './types';

/**
 * Quick rising sine sweep: 200 Hz -> 400 Hz over 0.1 s.
 */
export function synthJump(ctx: AudioContextLike, dest: GainLike): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 200;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.001, ctx.currentTime);
  env.connect(dest);

  osc.connect(env);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);

  // Final pitch (mock sees the last assigned value).
  osc.frequency.value = 400;
}

/**
 * Short low square-wave thud: 80 Hz, 0.05 s.
 */
export function synthLand(ctx: AudioContextLike, dest: GainLike): void {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 80;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.5, ctx.currentTime);
  env.connect(dest);

  osc.connect(env);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
}

/**
 * Descending sawtooth: 400 Hz -> 50 Hz over 0.3 s.
 */
export function synthDeath(ctx: AudioContextLike, dest: GainLike): void {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 400;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.4, ctx.currentTime);
  env.connect(dest);

  osc.connect(env);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);

  osc.frequency.value = 50;
}

/**
 * Sharp triangle pulse: 600 Hz, 0.08 s.
 */
export function synthTrap(ctx: AudioContextLike, dest: GainLike): void {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 600;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.5, ctx.currentTime);
  env.connect(dest);

  osc.connect(env);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
}

/**
 * Gentle two-oscillator sine chord: 330 Hz + 494 Hz, 0.2 s.
 */
export function synthDoor(ctx: AudioContextLike, dest: GainLike): void {
  const freqs = [330, 494];
  for (const freq of freqs) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.3, ctx.currentTime);
    env.connect(dest);

    osc.connect(env);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }
}

/**
 * Ascending three-note arpeggio: 523, 659, 784 Hz, 0.5 s total
 * (~0.167 s per note).
 */
export function synthLevelComplete(
  ctx: AudioContextLike,
  dest: GainLike,
): void {
  const notes = [
    { freq: 523, duration: 0.167 },
    { freq: 659, duration: 0.167 },
    { freq: 784, duration: 0.166 },
  ];

  let startTime = ctx.currentTime;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = note.freq;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.4, startTime);
    env.connect(dest);

    osc.connect(env);
    osc.start(startTime);
    osc.stop(startTime + note.duration);

    startTime += note.duration;
  }
}

/**
 * Dispatch table mapping SfxName to its synth function.
 */
export const SYNTH_TABLE: Record<
  SfxName,
  (ctx: AudioContextLike, dest: GainLike) => void
> = {
  jump: synthJump,
  land: synthLand,
  death: synthDeath,
  trap: synthTrap,
  door: synthDoor,
  'level-complete': synthLevelComplete,
};
