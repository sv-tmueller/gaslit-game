/**
 * Versioned save schema. Increment SAVE_SCHEMA_VERSION whenever the persisted
 * shape changes incompatibly; loaders reject payloads whose version does not
 * match and degrade to a fresh save.
 */
export const SAVE_SCHEMA_VERSION = 1;

export interface DeathPosition {
  readonly x: number;
  readonly y: number;
}

export interface LevelSaveData {
  readonly attemptCount: number;
  readonly deathCount: number;
  readonly deathPositions: readonly DeathPosition[];
}

export interface SavePayload {
  readonly version: number;
  readonly levels: Readonly<Record<string, LevelSaveData>>;
}
