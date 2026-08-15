import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from './storage';
import { SAVE_SCHEMA_VERSION } from './schema';
import type { SavePayload } from './schema';
import {
  SAVE_KEY,
  completeLevel,
  getCurrentPosition,
  getDefaultSettings,
  getLevelData,
  getSettings,
  isLevelCompleted,
  isLevelUnlocked,
  loadSave,
  saveSave,
  setCurrentPosition,
  unlockLevel,
  updateSettings,
} from './repository';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Construct a minimal v2 payload for testing.
 */
function makePayload(overrides?: Partial<SavePayload>): SavePayload {
  return {
    version: SAVE_SCHEMA_VERSION,
    levels: {},
    settings: getDefaultSettings(),
    currentPosition: 0,
    ...overrides,
  };
}

/**
 * Construct a raw v1 payload (missing completed/unlocked/settings/currentPosition)
 * serialized as JSON, simulating a save written by the old #19 code.
 */
function makeV1RawJson(levelOverrides?: Record<string, object>): string {
  return JSON.stringify({
    version: 1,
    levels: {
      level1: {
        attemptCount: 3,
        deathCount: 2,
        deathPositions: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ],
        ...(levelOverrides?.['level1'] ?? {}),
      },
      ...(levelOverrides ?? {}),
    },
  });
}

// ---------------------------------------------------------------------------
// V1 -> V2 Migration
// ---------------------------------------------------------------------------

describe('v1 to v2 migration', () => {
  it('loads a v1 save and migrates to v2 with default settings', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, makeV1RawJson());

    const loaded = loadSave(storage);

    expect(loaded.version).toBe(2);
    expect(loaded.settings).toEqual({ muted: false, reducedMotion: false });
    expect(loaded.currentPosition).toBe(0);
  });

  it('adds completed=false and unlocked=false to migrated levels', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, makeV1RawJson());

    const loaded = loadSave(storage);

    const data = getLevelData(loaded, 'level1');
    expect(data.completed).toBe(false);
    expect(data.unlocked).toBe(false);
  });

  it('preserves existing attempt and death data during migration', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, makeV1RawJson());

    const loaded = loadSave(storage);

    const data = getLevelData(loaded, 'level1');
    expect(data.attemptCount).toBe(3);
    expect(data.deathCount).toBe(2);
    expect(data.deathPositions).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// V2 Round-trip
// ---------------------------------------------------------------------------

describe('v2 save round-trip', () => {
  it('round-trips a v2 payload through storage preserving all fields', () => {
    const storage = createMemoryStorage();
    const original = makePayload({
      levels: {
        level1: {
          attemptCount: 5,
          deathCount: 3,
          deathPositions: [{ x: 1, y: 1 }],
          completed: true,
          unlocked: true,
        },
      },
      settings: { muted: true, reducedMotion: true },
      currentPosition: 2,
    });

    saveSave(storage, original);
    const loaded = loadSave(storage);

    expect(loaded.version).toBe(2);
    const data = getLevelData(loaded, 'level1');
    expect(data.attemptCount).toBe(5);
    expect(data.deathCount).toBe(3);
    expect(data.deathPositions).toEqual([{ x: 1, y: 1 }]);
    expect(data.completed).toBe(true);
    expect(data.unlocked).toBe(true);
    expect(loaded.settings).toEqual({ muted: true, reducedMotion: true });
    expect(loaded.currentPosition).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Corruption resilience
// ---------------------------------------------------------------------------

describe('corruption resilience', () => {
  it('degrades to fresh start on corrupt JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, '{ this is not valid');

    const loaded = loadSave(storage);
    expect(loaded.version).toBe(2);
    expect(Object.keys(loaded.levels)).toHaveLength(0);
    expect(loaded.settings).toEqual(getDefaultSettings());
    expect(loaded.currentPosition).toBe(0);
  });

  it('degrades to fresh start on unknown schema version', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 999, levels: {} }));

    const loaded = loadSave(storage);
    expect(loaded.version).toBe(2);
    expect(Object.keys(loaded.levels)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describe('getDefaultSettings', () => {
  it('returns muted=false and reducedMotion=false', () => {
    expect(getDefaultSettings()).toEqual({ muted: false, reducedMotion: false });
  });
});

describe('getSettings', () => {
  it('returns the settings from the payload', () => {
    const payload = makePayload({ settings: { muted: true, reducedMotion: false } });
    expect(getSettings(payload)).toEqual({ muted: true, reducedMotion: false });
  });

  it('returns default settings when settings field is absent', () => {
    // Simulate a payload lacking settings (e.g. from a partial migration)
    const payload = {
      version: 2,
      levels: {},
      currentPosition: 0,
    } as unknown as SavePayload;

    expect(getSettings(payload)).toEqual(getDefaultSettings());
  });
});

describe('updateSettings', () => {
  it('persists new settings and preserves other fields', () => {
    const payload = makePayload({ currentPosition: 3 });
    const updated = updateSettings(payload, { muted: true, reducedMotion: true });

    expect(getSettings(updated)).toEqual({ muted: true, reducedMotion: true });
    expect(updated.currentPosition).toBe(3);
    expect(updated.version).toBe(SAVE_SCHEMA_VERSION);
  });

  it('round-trips through storage', () => {
    const storage = createMemoryStorage();
    let payload = makePayload();
    payload = updateSettings(payload, { muted: true, reducedMotion: false });

    saveSave(storage, payload);
    const loaded = loadSave(storage);

    expect(getSettings(loaded)).toEqual({ muted: true, reducedMotion: false });
  });
});

// ---------------------------------------------------------------------------
// Current Position
// ---------------------------------------------------------------------------

describe('getCurrentPosition', () => {
  it('returns the currentPosition from the payload', () => {
    const payload = makePayload({ currentPosition: 5 });
    expect(getCurrentPosition(payload)).toBe(5);
  });

  it('returns 0 when currentPosition is absent', () => {
    const payload = {
      version: 2,
      levels: {},
      settings: getDefaultSettings(),
    } as unknown as SavePayload;

    expect(getCurrentPosition(payload)).toBe(0);
  });
});

describe('setCurrentPosition', () => {
  it('updates currentPosition and preserves other fields', () => {
    const payload = makePayload({ settings: { muted: true, reducedMotion: false } });
    const updated = setCurrentPosition(payload, 7);

    expect(getCurrentPosition(updated)).toBe(7);
    expect(getSettings(updated)).toEqual({ muted: true, reducedMotion: false });
    expect(updated.version).toBe(SAVE_SCHEMA_VERSION);
  });
});

// ---------------------------------------------------------------------------
// Unlock / Complete
// ---------------------------------------------------------------------------

describe('unlockLevel', () => {
  it('sets unlocked=true on the specified level', () => {
    const payload = makePayload({
      levels: {
        level1: {
          attemptCount: 0,
          deathCount: 0,
          deathPositions: [],
          completed: false,
          unlocked: false,
        },
      },
    });

    const updated = unlockLevel(payload, 'level1');
    expect(isLevelUnlocked(updated, 'level1')).toBe(true);
  });

  it('creates the level entry if it does not exist yet', () => {
    const payload = makePayload();

    const updated = unlockLevel(payload, 'newLevel');
    expect(isLevelUnlocked(updated, 'newLevel')).toBe(true);
    expect(getLevelData(updated, 'newLevel').attemptCount).toBe(0);
  });

  it('preserves other levels', () => {
    const payload = makePayload({
      levels: {
        level1: {
          attemptCount: 2,
          deathCount: 1,
          deathPositions: [{ x: 0, y: 0 }],
          completed: false,
          unlocked: true,
        },
      },
    });

    const updated = unlockLevel(payload, 'level2');
    expect(isLevelUnlocked(updated, 'level1')).toBe(true);
    expect(getLevelData(updated, 'level1').attemptCount).toBe(2);
  });
});

describe('completeLevel', () => {
  it('sets completed=true on the specified level', () => {
    const payload = makePayload({
      levels: {
        level1: {
          attemptCount: 1,
          deathCount: 0,
          deathPositions: [],
          completed: false,
          unlocked: true,
        },
      },
    });

    const updated = completeLevel(payload, 'level1', 'level2');
    expect(isLevelCompleted(updated, 'level1')).toBe(true);
  });

  it('unlocks the next level when nextLevelId is provided', () => {
    const payload = makePayload();

    const updated = completeLevel(payload, 'level1', 'level2');
    expect(isLevelUnlocked(updated, 'level2')).toBe(true);
  });

  it('does not crash when nextLevelId is omitted', () => {
    const payload = makePayload({
      levels: {
        level1: {
          attemptCount: 1,
          deathCount: 0,
          deathPositions: [],
          completed: false,
          unlocked: true,
        },
      },
    });

    const updated = completeLevel(payload, 'level1');
    expect(isLevelCompleted(updated, 'level1')).toBe(true);
  });

  it('preserves attempt and death data on the completed level', () => {
    const payload = makePayload({
      levels: {
        level1: {
          attemptCount: 7,
          deathCount: 4,
          deathPositions: [{ x: 5, y: 5 }],
          completed: false,
          unlocked: true,
        },
      },
    });

    const updated = completeLevel(payload, 'level1', 'level2');
    const data = getLevelData(updated, 'level1');
    expect(data.attemptCount).toBe(7);
    expect(data.deathCount).toBe(4);
    expect(data.deathPositions).toEqual([{ x: 5, y: 5 }]);
  });
});

// ---------------------------------------------------------------------------
// Queries on unknown levels
// ---------------------------------------------------------------------------

describe('unknown level queries', () => {
  it('isLevelCompleted returns false for an unknown level', () => {
    const payload = makePayload();
    expect(isLevelCompleted(payload, 'nonexistent')).toBe(false);
  });

  it('isLevelUnlocked returns false for an unknown level', () => {
    const payload = makePayload();
    expect(isLevelUnlocked(payload, 'nonexistent')).toBe(false);
  });
});
