import type { SaveStorage } from './storage';
import { SAVE_SCHEMA_VERSION } from './schema';
import type { DeathPosition, LevelSaveData, SavePayload } from './schema';

export const SAVE_KEY = 'gaslit-save';

/**
 * Maximum number of death positions retained per level. Older entries are
 * dropped once the cap is reached so the save stays bounded.
 */
const MAX_DEATH_POSITIONS = 100;

/**
 * Load and validate the saved payload from storage. Any failure (corrupt
 * JSON, unknown schema version, missing key, storage error) degrades to a
 * fresh save rather than throwing.
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

function freshSave(): SavePayload {
  return { version: SAVE_SCHEMA_VERSION, levels: {} };
}

function isValidSave(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (obj['version'] !== SAVE_SCHEMA_VERSION) return false;
  if (typeof obj['levels'] !== 'object' || obj['levels'] === null) return false;
  return true;
}

function normalizeSave(data: SavePayload): SavePayload {
  const levels: Record<string, LevelSaveData> = {};
  const rawLevels = data.levels as Record<string, unknown>;
  for (const [id, val] of Object.entries(rawLevels)) {
    if (isValidLevelData(val)) {
      levels[id] = val as LevelSaveData;
    }
  }
  return { version: SAVE_SCHEMA_VERSION, levels };
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
