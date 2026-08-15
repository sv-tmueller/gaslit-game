import { describe, expect, it } from 'vitest';
import { createAudioManager } from './manager';
import type {
  AudioContextLike,
  AudioDestinationLike,
  GainLike,
  OscillatorLike,
  SfxName,
} from './types';

// ---------------------------------------------------------------------------
// Mock implementations
// ---------------------------------------------------------------------------

class MockOscillator implements OscillatorLike {
  frequency = { value: 0 };
  type = 'sine';
  connectedTo: unknown = null;
  started = false;
  stopped = false;
  startTime: number | undefined = undefined;
  stopTime: number | undefined = undefined;

  connect(node: unknown): void {
    this.connectedTo = node;
  }

  disconnect(): void {
    this.connectedTo = null;
  }

  start(time?: number): void {
    this.started = true;
    this.startTime = time;
  }

  stop(time?: number): void {
    this.stopped = true;
    this.stopTime = time;
  }
}

class MockGain implements GainLike {
  gain = {
    value: 1,
    setValueAtTime(value: number, time: number): void {
      // Stores the scheduled value for inspection if needed.
      void value;
      void time;
    },
  };
  connectedTo: unknown = null;

  connect(node: unknown): void {
    this.connectedTo = node;
  }

  disconnect(): void {
    this.connectedTo = null;
  }
}

class MockAudioContext implements AudioContextLike {
  currentTime = 0;
  state = 'running';
  destination: AudioDestinationLike = {};
  oscillators: MockOscillator[] = [];
  gains: MockGain[] = [];
  resumed = false;

  createOscillator(): MockOscillator {
    const osc = new MockOscillator();
    this.oscillators.push(osc);
    return osc;
  }

  createGain(): MockGain {
    const gain = new MockGain();
    this.gains.push(gain);
    return gain;
  }

  async resume(): Promise<void> {
    this.resumed = true;
    this.state = 'running';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockCtx(): MockAudioContext {
  return new MockAudioContext();
}

const ALL_SFX: SfxName[] = [
  'jump',
  'land',
  'death',
  'trap',
  'door',
  'level-complete',
];

describe('AudioManager', () => {
  // -------------------------------------------------------------------------
  // Construction / node graph
  // -------------------------------------------------------------------------

  describe('construction', () => {
    it('creates three gain nodes wired sfx/music -> master -> destination', () => {
      const ctx = createMockCtx();
      createAudioManager(ctx);

      // sfx (0), music (1), master (2)
      expect(ctx.gains).toHaveLength(3);

      const sfxGain = ctx.gains[0]!;
      const musicGain = ctx.gains[1]!;
      const masterGain = ctx.gains[2]!;
      expect(masterGain.connectedTo).toBe(ctx.destination);
      expect(sfxGain.connectedTo).toBe(masterGain);
      expect(musicGain.connectedTo).toBe(masterGain);
    });
  });

  // -------------------------------------------------------------------------
  // playSfx
  // -------------------------------------------------------------------------

  describe('playSfx', () => {
    it('creates at least one oscillator when not muted', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);
      const baseline = ctx.oscillators.length;

      mgr.playSfx('jump');

      expect(ctx.oscillators.length).toBeGreaterThan(baseline);
    });

    it('does nothing when sfx channel is muted', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);
      mgr.setMuted('sfx', true);
      const baseline = ctx.oscillators.length;

      mgr.playSfx('jump');

      expect(ctx.oscillators.length).toBe(baseline);
    });

    it('does nothing when master channel is muted', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);
      mgr.setMuted('master', true);
      const baseline = ctx.oscillators.length;

      mgr.playSfx('jump');

      expect(ctx.oscillators.length).toBe(baseline);
    });

    it.each(ALL_SFX)('produces oscillators for "%s"', (name) => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.playSfx(name);

      expect(ctx.oscillators.length).toBeGreaterThan(0);
    });

    it('all oscillators are started and stopped', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.playSfx('death');
      mgr.playSfx('door');

      for (const osc of ctx.oscillators) {
        expect(osc.started).toBe(true);
        expect(osc.stopped).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // startMusic / stopMusic
  // -------------------------------------------------------------------------

  describe('startMusic / stopMusic', () => {
    it('starts a music oscillator', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);
      const baseline = ctx.oscillators.length;

      mgr.startMusic();

      expect(ctx.oscillators.length).toBe(baseline + 1);
      const musicOsc = ctx.oscillators[baseline]!;
      expect(musicOsc.started).toBe(true);
    });

    it('stops the music oscillator on stopMusic', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.startMusic();
      const musicOsc = ctx.oscillators[ctx.oscillators.length - 1]!;
      expect(musicOsc.stopped).toBe(false);

      mgr.stopMusic();

      expect(musicOsc.stopped).toBe(true);
    });

    it('does not start music when music channel is muted', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);
      mgr.setMuted('music', true);
      const baseline = ctx.oscillators.length;

      mgr.startMusic();

      expect(ctx.oscillators.length).toBe(baseline);
    });

    it('does not start music when master channel is muted', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);
      mgr.setMuted('master', true);
      const baseline = ctx.oscillators.length;

      mgr.startMusic();

      expect(ctx.oscillators.length).toBe(baseline);
    });

    it('stopMusic is a no-op when no music is playing', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      expect(() => mgr.stopMusic()).not.toThrow();
    });

    it('calling startMusic twice does not create a second oscillator', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.startMusic();
      const countAfterFirst = ctx.oscillators.length;

      mgr.startMusic();

      expect(ctx.oscillators.length).toBe(countAfterFirst);
    });

    it('muting music while playing stops the music oscillator', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.startMusic();
      const musicOsc = ctx.oscillators[ctx.oscillators.length - 1]!;
      expect(musicOsc.stopped).toBe(false);

      mgr.setMuted('music', true);

      expect(musicOsc.stopped).toBe(true);
    });

    it('muting master while music is playing stops the music oscillator', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.startMusic();
      const musicOsc = ctx.oscillators[ctx.oscillators.length - 1]!;

      mgr.setMuted('master', true);

      expect(musicOsc.stopped).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // setMuted / isMuted
  // -------------------------------------------------------------------------

  describe('setMuted / isMuted', () => {
    it('defaults to unmuted on all channels', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      expect(mgr.isMuted('master')).toBe(false);
      expect(mgr.isMuted('sfx')).toBe(false);
      expect(mgr.isMuted('music')).toBe(false);
    });

    it('round-trips mute state for each channel', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.setMuted('sfx', true);
      expect(mgr.isMuted('sfx')).toBe(true);
      expect(mgr.isMuted('master')).toBe(false);

      mgr.setMuted('sfx', false);
      expect(mgr.isMuted('sfx')).toBe(false);
    });

    it('mute/unmute reflects on gain node value', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      // sfx gain is index 0 (creation order: sfx, music, master).
      mgr.setMuted('sfx', true);
      const sfxGain = ctx.gains[0]!;
      expect(sfxGain.gain.value).toBe(0);

      mgr.setMuted('sfx', false);
      expect(sfxGain.gain.value).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // setChannelVolume
  // -------------------------------------------------------------------------

  describe('setChannelVolume', () => {
    it('sets the master gain value', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.setChannelVolume('master', 0.5);

      const masterGain = ctx.gains[2]!; // master is third
      expect(masterGain.gain.value).toBeCloseTo(0.5);
    });

    it('clamps volume above 1.0', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.setChannelVolume('master', 2.0);

      const masterGain = ctx.gains[2]!;
      expect(masterGain.gain.value).toBe(1);
    });

    it('clamps volume below 0', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.setChannelVolume('sfx', -0.5);

      const sfxGain = ctx.gains[0]!;
      expect(sfxGain.gain.value).toBe(0);
    });

    it('restores gain on unmute after volume change', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.setChannelVolume('sfx', 0.7);
      mgr.setMuted('sfx', true);
      mgr.setMuted('sfx', false);

      const sfxGain = ctx.gains[0]!;
      expect(sfxGain.gain.value).toBeCloseTo(0.7);
    });
  });

  // -------------------------------------------------------------------------
  // resume
  // -------------------------------------------------------------------------

  describe('resume', () => {
    it('calls ctx.resume()', async () => {
      const ctx = createMockCtx();
      ctx.state = 'suspended';
      const mgr = createAudioManager(ctx);

      await mgr.resume();

      expect(ctx.resumed).toBe(true);
      expect(ctx.state).toBe('running');
    });
  });

  // -------------------------------------------------------------------------
  // dispose
  // -------------------------------------------------------------------------

  describe('dispose', () => {
    it('stops music and disconnects all gain nodes', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.startMusic();
      const musicOsc = ctx.oscillators[ctx.oscillators.length - 1]!;

      mgr.dispose();

      expect(musicOsc.stopped).toBe(true);
      for (const gain of ctx.gains) {
        expect(gain.connectedTo).toBeNull();
      }
    });

    it('after dispose, playSfx is a no-op', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.dispose();
      const baseline = ctx.oscillators.length;

      mgr.playSfx('jump');

      expect(ctx.oscillators.length).toBe(baseline);
    });

    it('after dispose, startMusic is a no-op', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.dispose();
      const baseline = ctx.oscillators.length;

      mgr.startMusic();

      expect(ctx.oscillators.length).toBe(baseline);
    });
  });

  // -------------------------------------------------------------------------
  // Determinism
  // -------------------------------------------------------------------------

  describe('determinism', () => {
    it('same sequence of playSfx calls produces identical oscillator configs', () => {
      const ctxA = createMockCtx();
      const mgrA = createAudioManager(ctxA);
      for (const sfx of ALL_SFX) {
        mgrA.playSfx(sfx);
      }

      const ctxB = createMockCtx();
      const mgrB = createAudioManager(ctxB);
      for (const sfx of ALL_SFX) {
        mgrB.playSfx(sfx);
      }

      expect(ctxA.oscillators.length).toBe(ctxB.oscillators.length);

      for (let i = 0; i < ctxA.oscillators.length; i++) {
        const a = ctxA.oscillators[i]!;
        const b = ctxB.oscillators[i]!;
        expect(a.frequency.value).toBe(b.frequency.value);
        expect(a.type).toBe(b.type);
        expect(a.startTime).toBe(b.startTime);
        expect(a.stopTime).toBe(b.stopTime);
      }
    });

    it('specific SFX produce expected oscillator types', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.playSfx('jump');
      const jumpOsc = ctx.oscillators[ctx.oscillators.length - 1]!;
      expect(jumpOsc.type).toBe('sine');

      mgr.playSfx('land');
      const landOsc = ctx.oscillators[ctx.oscillators.length - 1]!;
      expect(landOsc.type).toBe('square');

      mgr.playSfx('death');
      const deathOsc = ctx.oscillators[ctx.oscillators.length - 1]!;
      expect(deathOsc.type).toBe('sawtooth');

      mgr.playSfx('trap');
      const trapOsc = ctx.oscillators[ctx.oscillators.length - 1]!;
      expect(trapOsc.type).toBe('triangle');
    });

    it('door SFX creates exactly two oscillators', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.playSfx('door');

      expect(ctx.oscillators.length).toBe(2);
    });

    it('level-complete SFX creates exactly three oscillators', () => {
      const ctx = createMockCtx();
      const mgr = createAudioManager(ctx);

      mgr.playSfx('level-complete');

      expect(ctx.oscillators.length).toBe(3);
    });
  });
});
