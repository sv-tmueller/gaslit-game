/**
 * AudioManager: a thin factory wrapping an AudioContextLike.
 *
 * Routes all output through a master gain, with dedicated sfx and music
 * sub-gains feeding into it. Supports per-channel mute (master, sfx, music)
 * and graceful degradation: if the underlying context is unavailable or in
 * a closed state, methods degrade to no-ops rather than throwing.
 */

import type {
  AudioContextLike,
  AudioManager,
  Channel,
  GainLike,
  SfxName,
} from './types';
import { SYNTH_TABLE } from './synth';

export function createAudioManager(ctx: AudioContextLike): AudioManager {
  // --- Node graph -------------------------------------------------------
  //
  //   sfx-gain   ->|
  //                 |>  master-gain  ->  destination
  //   music-gain ->|
  //
  // Creation order is sfx (0), music (1), master (2) so tests can
  // reference gains by stable indices.

  const sfxGain = ctx.createGain();
  sfxGain.gain.value = 1;

  const musicGain = ctx.createGain();
  musicGain.gain.value = 0.3;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(ctx.destination);

  sfxGain.connect(masterGain);
  musicGain.connect(masterGain);

  // --- State ------------------------------------------------------------

  const muted: Record<Channel, boolean> = {
    master: false,
    sfx: false,
    music: false,
  };

  const volumes: Record<Channel, number> = {
    master: 1,
    sfx: 1,
    music: 0.3,
  };

  let musicOsc: ReturnType<AudioContextLike['createOscillator']> | null = null;
  let disposed = false;

  // --- Helpers ----------------------------------------------------------

  function gainForChannel(channel: Channel): GainLike {
    if (channel === 'master') return masterGain;
    if (channel === 'sfx') return sfxGain;
    return musicGain;
  }

  function effectivePlaying(): boolean {
    return !disposed && ctx.state !== 'closed';
  }

  // --- Public API -------------------------------------------------------

  function playSfx(name: SfxName): void {
    if (!effectivePlaying()) return;
    if (muted.master || muted.sfx) return;

    const fn = SYNTH_TABLE[name];
    if (!fn) return;
    try {
      fn(ctx, sfxGain);
    } catch {
      // Graceful degradation: never throw on audio failure.
    }
  }

  function startMusic(): void {
    if (!effectivePlaying()) return;
    if (muted.master || muted.music) return;
    if (musicOsc !== null) return;

    try {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 110;
      osc.connect(musicGain);
      osc.start();
      musicOsc = osc;
    } catch {
      // Graceful degradation.
    }
  }

  function stopMusic(): void {
    if (musicOsc === null) return;
    try {
      musicOsc.stop();
    } catch {
      // Already stopped or invalid; ignore.
    }
    musicOsc = null;
  }

  function setChannelVolume(channel: Channel, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    volumes[channel] = clamped;
    if (!muted[channel]) {
      gainForChannel(channel).gain.value = clamped;
    }
  }

  function setMuted(channel: Channel, value: boolean): void {
    muted[channel] = value;
    gainForChannel(channel).gain.value = value ? 0 : volumes[channel];

    if ((channel === 'master' || channel === 'music') && value) {
      stopMusic();
    }
  }

  function isMuted(channel: Channel): boolean {
    return muted[channel];
  }

  async function resume(): Promise<void> {
    if (disposed) return;
    try {
      await ctx.resume();
    } catch {
      // Graceful degradation.
    }
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    stopMusic();
    try {
      sfxGain.disconnect();
    } catch {
      // Ignore.
    }
    try {
      musicGain.disconnect();
    } catch {
      // Ignore.
    }
    try {
      masterGain.disconnect();
    } catch {
      // Ignore.
    }
  }

  return {
    playSfx,
    startMusic,
    stopMusic,
    setChannelVolume,
    setMuted,
    isMuted,
    resume,
    dispose,
  };
}
