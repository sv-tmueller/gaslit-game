/**
 * Audio interfaces for the gaslit-game audio system.
 *
 * Interfaces are structural so a real browser AudioContext satisfies
 * AudioContextLike, while headless tests use a mock implementation.
 */

export type SfxName =
  | 'jump'
  | 'land'
  | 'death'
  | 'trap'
  | 'door'
  | 'level-complete';

export type Channel = 'master' | 'sfx' | 'music';

export type AudioDestinationLike = unknown;

export interface OscillatorLike {
  frequency: { value: number };
  type: string;
  connect(node: unknown): void;
  disconnect(): void;
  start(time?: number): void;
  stop(time?: number): void;
}

export interface GainLike {
  gain: {
    value: number;
    setValueAtTime(value: number, time: number): void;
  };
  connect(node: unknown): void;
  disconnect(): void;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: AudioDestinationLike;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  resume(): Promise<void>;
}

export interface AudioManager {
  /** Play a one-shot sound effect by name. */
  playSfx(name: SfxName): void;
  /** Start the looping music bed (no-op if already playing or muted). */
  startMusic(): void;
  /** Stop the music bed (no-op if not playing). */
  stopMusic(): void;
  /** Set the volume for a channel (0.0 to 1.0). */
  setChannelVolume(channel: Channel, volume: number): void;
  /** Toggle muting for a channel. Muting master suppresses all output. */
  setMuted(channel: Channel, muted: boolean): void;
  /** Whether a channel is muted. */
  isMuted(channel: Channel): boolean;
  /** Resume the AudioContext (handles browser autoplay policy). */
  resume(): Promise<void>;
  /** Stop all sounds, disconnect nodes, release resources. */
  dispose(): void;
}
