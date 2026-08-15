/**
 * Versioned save schema. Increment SAVE_SCHEMA_VERSION whenever the persisted
 * shape changes incompatibly; loaders reject payloads whose version does not
 * match and degrade to a fresh save.
 *
 * Version 2 adds progress tracking (completed/unlocked per level), settings,
 * and currentPosition to the sequence. Version 1 saves are migrated on load.
 */
export const SAVE_SCHEMA_VERSION = 2;

export interface DeathPosition {
  readonly x: number;
  readonly y: number;
}

export interface LevelSaveData {
  readonly attemptCount: number;
  readonly deathCount: number;
  readonly deathPositions: readonly DeathPosition[];
  /** Whether this level has been completed at least once. */
  readonly completed: boolean;
  /** Whether this level is accessible (unlocked) in the level sequence. */
  readonly unlocked: boolean;
}

export interface SettingsData {
  readonly muted: boolean;
  readonly reducedMotion: boolean;
}

export interface SavePayload {
  readonly version: number;
  readonly levels: Readonly<Record<string, LevelSaveData>>;
  readonly settings: SettingsData;
  /** Index in the level sequence indicating the player's current position. */
  readonly currentPosition: number;
}
