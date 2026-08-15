import type { SaveStorage } from './storage';
import { SAVE_SCHEMA_VERSION } from './schema';
import type { DeathPosition, LevelSaveData, SavePayload, SettingsData } from './schema';

export const SAVE_KEY = 'pitfall-save';

/**
 * Maximum number of death positions retained per level. Older entries are
 * dropped once the cap is reached so the save stays bounded.
 */
const MAX_DEATH_POSITIONS = 100;

/**
 * Minimum accepted schema version. v1 saves are migrated to v2 on load.
 */
const MIN_ACCEPTABLE_VERSION = 1;

// ---------------------------------------------------------------------------
// Loading and saving
// ---------------------------------------------------------------------------

/**
 * Load and validate the saved payload from storage. Any failure (corrupt
 * JSON, unknown schema version, missing key, storage error) degrades to a
 * fresh save rather than throwing. Version 1 saves are migrated to v2.
 */
export function loadSave(storage: SaveStorage): SavePayload {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (raw === null) return freshSave();
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSave(parsed)) return freshSave();
    return normalizeSave(parsed as SavePayload);
  } catch {
    return freshSave();
  }
}

/**
 * Persist the payload to storage. Swallows quota-exceeded or unavailable-
 * storage errors so the caller never sees a throw.
 */
export function saveSave(storage: SaveStorage, payload: SavePayload): void {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage unavailable: silently degrade.
  }
}

// ---------------------------------------------------------------------------
// Level data accessors (from #19, extended for v2)
// ---------------------------------------------------------------------------

/**
 * Return the LevelSaveData for the given id, or a zero-valued default when
 * the level is not present in the payload.
 */
export function getLevelData(payload: SavePayload, levelId: string): LevelSaveData {
  return (
    payload.levels[levelId] ?? {
      attemptCount: 0,
      deathCount: 0,
      deathPositions: [],
      completed: false,
      unlocked: false,
    }
  );
}

/**
 * Produce a new payload with the given level replaced by data. Other levels
 * are preserved unchanged.
 */
export function updateLevelData(
  payload: SavePayload,
  levelId: string,
  data: LevelSaveData,
): SavePayload {
  return {
    version: SAVE_SCHEMA_VERSION,
    levels: { ...payload.levels, [levelId]: data },
    settings: getSettings(payload),
    currentPosition: getCurrentPosition(payload),
  };
}

/**
 * Increment the attempt counter for a level, starting from zero if absent.
 */
export function recordAttempt(payload: SavePayload, levelId: string): SavePayload {
  const current = getLevelData(payload, levelId);
  return updateLevelData(payload, levelId, {
    ...current,
    attemptCount: current.attemptCount + 1,
  });
}

/**
 * Increment the death counter and append the death position, capping total
 * positions at MAX_DEATH_POSITIONS (oldest dropped first).
 */
export function recordDeath(
  payload: SavePayload,
  levelId: string,
  pos: DeathPosition,
): SavePayload {
  const current = getLevelData(payload, levelId);
  return updateLevelData(payload, levelId, {
    ...current,
    deathCount: current.deathCount + 1,
    deathPositions: [...current.deathPositions, pos].slice(-MAX_DEATH_POSITIONS),
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Return the default settings (everything disabled/false).
 */
export function getDefaultSettings(): SettingsData {
  return { muted: false, reducedMotion: false };
}

/**
 * Return the settings from a payload, falling back to defaults when the
 * settings field is absent or malformed.
 */
export function getSettings(payload: SavePayload): SettingsData {
  const s = (payload as { settings?: unknown }).settings;
  if (typeof s === 'object' && s !== null) {
    const obj = s as Record<string, unknown>;
    return {
      muted: typeof obj['muted'] === 'boolean' ? obj['muted'] : false,
      reducedMotion:
        typeof obj['reducedMotion'] === 'boolean' ? obj['reducedMotion'] : false,
    };
  }
  return getDefaultSettings();
}

/**
 * Produce a new payload with updated settings. Other fields are preserved.
 */
export function updateSettings(payload: SavePayload, settings: SettingsData): SavePayload {
  return {
    version: SAVE_SCHEMA_VERSION,
    levels: payload.levels,
    settings,
    currentPosition: getCurrentPosition(payload),
  };
}

// ---------------------------------------------------------------------------
// Current position
// ---------------------------------------------------------------------------

/**
 * Return the current position index from the payload, defaulting to 0.
 */
export function getCurrentPosition(payload: SavePayload): number {
  const pos = (payload as { currentPosition?: unknown }).currentPosition;
  return typeof pos === 'number' ? pos : 0;
}

/**
 * Produce a new payload with the updated current position. Other fields are
 * preserved.
 */
export function setCurrentPosition(payload: SavePayload, pos: number): SavePayload {
  return {
    version: SAVE_SCHEMA_VERSION,
    levels: payload.levels,
    settings: getSettings(payload),
    currentPosition: pos,
  };
}

// ---------------------------------------------------------------------------
// Progress: unlock / complete / queries
// ---------------------------------------------------------------------------

/**
 * Mark a level as unlocked. Creates a zero-valued entry if the level does
 * not yet exist. Preserves all other data.
 */
export function unlockLevel(payload: SavePayload, levelId: string): SavePayload {
  const current = getLevelData(payload, levelId);
  return updateLevelData(payload, levelId, {
    ...current,
    unlocked: true,
  });
}

/**
 * Mark a level as completed. Optionally unlock the next level in the
 * sequence by passing its id as nextLevelId. Preserves all attempt and
 * death data.
 */
export function completeLevel(
  payload: SavePayload,
  levelId: string,
  nextLevelId?: string,
): SavePayload {
  let updated = updateLevelData(payload, levelId, {
    ...getLevelData(payload, levelId),
    completed: true,
  });
  if (nextLevelId !== undefined) {
    updated = unlockLevel(updated, nextLevelId);
  }
  return updated;
}

/**
 * Return whether a level has been completed. Unknown levels return false.
 */
export function isLevelCompleted(payload: SavePayload, levelId: string): boolean {
  return getLevelData(payload, levelId).completed;
}

/**
 * Return whether a level is unlocked. Unknown levels return false.
 */
export function isLevelUnlocked(payload: SavePayload, levelId: string): boolean {
  return getLevelData(payload, levelId).unlocked;
}

// ---------------------------------------------------------------------------
// Internal: fresh save, validation, normalization, migration
// ---------------------------------------------------------------------------

function freshSave(): SavePayload {
  return {
    version: SAVE_SCHEMA_VERSION,
    levels: {},
    settings: getDefaultSettings(),
    currentPosition: 0,
  };
}

/**
 * Validate the raw parsed data. Accepts versions 1 through SAVE_SCHEMA_VERSION.
 * Rejects anything that is not an object with a recognized version and a
 * levels map.
 */
function isValidSave(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj['version'] !== 'number') return false;
  if (obj['version'] < MIN_ACCEPTABLE_VERSION || obj['version'] > SAVE_SCHEMA_VERSION)
    return false;
  if (typeof obj['levels'] !== 'object' || obj['levels'] === null) return false;
  return true;
}

/**
 * Normalize (and migrate if necessary) a validated payload to the current
 * schema version. Migrating v1 to v2 adds completed=false and unlocked=false
 * to each level, default settings, and currentPosition=0, while preserving
 * existing attempt/death data.
 */
function normalizeSave(data: SavePayload): SavePayload {
  const levels: Record<string, LevelSaveData> = {};
  const rawLevels = data.levels as Record<string, unknown>;
  for (const [id, val] of Object.entries(rawLevels)) {
    if (isValidLevelData(val)) {
      levels[id] = normalizeLevelData(val as LevelSaveData);
    }
  }
  return {
    version: SAVE_SCHEMA_VERSION,
    levels,
    settings: getSettings(data),
    currentPosition: getCurrentPosition(data),
  };
}

/**
 * Ensure a level entry conforms to the v2 shape. v1 entries lack completed
 * and unlocked; they default to false.
 */
function normalizeLevelData(data: LevelSaveData): LevelSaveData {
  return {
    attemptCount: data.attemptCount,
    deathCount: data.deathCount,
    deathPositions: data.deathPositions,
    completed: typeof data.completed === 'boolean' ? data.completed : false,
    unlocked: typeof data.unlocked === 'boolean' ? data.unlocked : false,
  };
}

function isValidLevelData(val: unknown): boolean {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    typeof obj['attemptCount'] === 'number' &&
    typeof obj['deathCount'] === 'number' &&
    Array.isArray(obj['deathPositions'])
  );
}
