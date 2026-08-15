import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from './storage';
import type { SaveStorage } from './storage';
import { SAVE_SCHEMA_VERSION } from './schema';
import type { SavePayload } from './schema';
import {
  SAVE_KEY,
  getLevelData,
  loadSave,
  recordAttempt,
  recordDeath,
  saveSave,
  updateLevelData,
} from './repository';

// ---------------------------------------------------------------------------
// Helper: storage whose setItem throws (simulates quota exceeded)
// ---------------------------------------------------------------------------
function createQuotaExceedingStorage(): SaveStorage {
  const mem = createMemoryStorage();
  return {
    getItem: mem.getItem,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: mem.removeItem,
  };
}

describe('loadSave', () => {
  it('returns a fresh save when no key exists', () => {
    const storage = createMemoryStorage();
    const payload = loadSave(storage);
    expect(payload.version).toBe(SAVE_SCHEMA_VERSION);
    expect(Object.keys(payload.levels)).toHaveLength(0);
  });

  it('preserves attempts, deaths, and death positions on round-trip', () => {
    const storage = createMemoryStorage();
    const original: SavePayload = {
      version: SAVE_SCHEMA_VERSION,
      levels: {
        level1: {
          attemptCount: 7,
          deathCount: 4,
          deathPositions: [
            { x: 10, y: 20 },
            { x: 30, y: 40 },
          ],
        },
      },
    };
    saveSave(storage, original);
    const loaded = loadSave(storage);

    const data = getLevelData(loaded, 'level1');
    expect(data.attemptCount).toBe(7);
    expect(data.deathCount).toBe(4);
    expect(data.deathPositions).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
  });

  it('degrades to fresh save on corrupt JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, '{ this is not valid json');
    const payload = loadSave(storage);
    expect(payload.version).toBe(SAVE_SCHEMA_VERSION);
    expect(Object.keys(payload.levels)).toHaveLength(0);
  });

  it('degrades to fresh save on unknown schema version', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({ version: 999, levels: { lvl1: { attemptCount: 1, deathCount: 0, deathPositions: [] } } }),
    );
    const payload = loadSave(storage);
    expect(payload.version).toBe(SAVE_SCHEMA_VERSION);
    expect(Object.keys(payload.levels)).toHaveLength(0);
  });

  it('drops individual corrupt level entries while keeping valid ones', () => {
    const storage = createMemoryStorage();
    const bad = {
      version: SAVE_SCHEMA_VERSION,
      levels: {
        good: { attemptCount: 2, deathCount: 1, deathPositions: [{ x: 0, y: 0 }] },
        bad: { attemptCount: 'oops', deathCount: 1, deathPositions: [] },
      },
    };
    storage.setItem(SAVE_KEY, JSON.stringify(bad));
    const payload = loadSave(storage);
    expect(getLevelData(payload, 'good').attemptCount).toBe(2);
    expect(Object.keys(payload.levels)).toHaveLength(1);
    expect(payload.levels['good']).toBeDefined();
  });

  it('degrades to fresh save when storage.getItem throws', () => {
    const throwingStorage: SaveStorage = {
      getItem: () => {
        throw new Error('storage unavailable');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    const payload = loadSave(throwingStorage);
    expect(payload.version).toBe(SAVE_SCHEMA_VERSION);
    expect(Object.keys(payload.levels)).toHaveLength(0);
  });
});

describe('saveSave', () => {
  it('does not throw when storage.setItem throws (quota exceeded)', () => {
    const storage = createQuotaExceedingStorage();
    const payload: SavePayload = {
      version: SAVE_SCHEMA_VERSION,
      levels: { lvl1: { attemptCount: 1, deathCount: 0, deathPositions: [] } },
    };
    expect(() => saveSave(storage, payload)).not.toThrow();
  });
});

describe('getLevelData', () => {
  it('returns zero-valued data for an unknown level id', () => {
    const payload: SavePayload = { version: SAVE_SCHEMA_VERSION, levels: {} };
    const data = getLevelData(payload, 'nonexistent');
    expect(data.attemptCount).toBe(0);
    expect(data.deathCount).toBe(0);
    expect(data.deathPositions).toEqual([]);
  });
});

describe('updateLevelData', () => {
  it('replaces existing level data', () => {
    const payload: SavePayload = {
      version: SAVE_SCHEMA_VERSION,
      levels: { lvl1: { attemptCount: 1, deathCount: 0, deathPositions: [] } },
    };
    const updated = updateLevelData(payload, 'lvl1', {
      attemptCount: 10,
      deathCount: 5,
      deathPositions: [{ x: 1, y: 1 }],
    });
    expect(getLevelData(updated, 'lvl1').attemptCount).toBe(10);
  });

  it('preserves other levels when updating one', () => {
    const payload: SavePayload = {
      version: SAVE_SCHEMA_VERSION,
      levels: {
        lvl1: { attemptCount: 1, deathCount: 0, deathPositions: [] },
        lvl2: { attemptCount: 3, deathCount: 2, deathPositions: [{ x: 5, y: 5 }] },
      },
    };
    const updated = updateLevelData(payload, 'lvl1', {
      attemptCount: 99,
      deathCount: 0,
      deathPositions: [],
    });
    expect(getLevelData(updated, 'lvl2').attemptCount).toBe(3);
    expect(getLevelData(updated, 'lvl1').attemptCount).toBe(99);
  });
});

describe('recordAttempt', () => {
  it('increments attemptCount for an existing level', () => {
    const payload: SavePayload = {
      version: SAVE_SCHEMA_VERSION,
      levels: { lvl1: { attemptCount: 5, deathCount: 2, deathPositions: [] } },
    };
    const updated = recordAttempt(payload, 'lvl1');
    expect(getLevelData(updated, 'lvl1').attemptCount).toBe(6);
    expect(getLevelData(updated, 'lvl1').deathCount).toBe(2);
  });

  it('starts from zero for a new level', () => {
    const payload: SavePayload = { version: SAVE_SCHEMA_VERSION, levels: {} };
    const updated = recordAttempt(payload, 'new');
    expect(getLevelData(updated, 'new').attemptCount).toBe(1);
  });
});

describe('recordDeath', () => {
  it('increments deathCount and appends the position', () => {
    const payload: SavePayload = {
      version: SAVE_SCHEMA_VERSION,
      levels: { lvl1: { attemptCount: 3, deathCount: 1, deathPositions: [{ x: 0, y: 0 }] } },
    };
    const updated = recordDeath(payload, 'lvl1', { x: 16, y: 32 });
    const data = getLevelData(updated, 'lvl1');
    expect(data.deathCount).toBe(2);
    expect(data.deathPositions).toEqual([{ x: 0, y: 0 }, { x: 16, y: 32 }]);
  });

  it('starts from zero for a new level', () => {
    const payload: SavePayload = { version: SAVE_SCHEMA_VERSION, levels: {} };
    const updated = recordDeath(payload, 'new', { x: 1, y: 2 });
    const data = getLevelData(updated, 'new');
    expect(data.deathCount).toBe(1);
    expect(data.deathPositions).toEqual([{ x: 1, y: 2 }]);
  });

  it('caps death positions at 100, dropping oldest', () => {
    let payload: SavePayload = { version: SAVE_SCHEMA_VERSION, levels: {} };
    for (let i = 0; i < 105; i++) {
      payload = recordDeath(payload, 'lvl', { x: i, y: i });
    }
    const data = getLevelData(payload, 'lvl');
    expect(data.deathCount).toBe(105);
    expect(data.deathPositions).toHaveLength(100);
    // Oldest 5 should be dropped; newest 100 kept
    expect(data.deathPositions[0]).toEqual({ x: 5, y: 5 });
    expect(data.deathPositions[99]).toEqual({ x: 104, y: 104 });
  });
});

describe('multiple levels coexist independently', () => {
  it('records and retrieves data for distinct level ids', () => {
    let payload: SavePayload = { version: SAVE_SCHEMA_VERSION, levels: {} };
    payload = recordAttempt(payload, 'lvl-a');
    payload = recordAttempt(payload, 'lvl-a');
    payload = recordDeath(payload, 'lvl-a', { x: 1, y: 1 });
    payload = recordAttempt(payload, 'lvl-b');
    payload = recordDeath(payload, 'lvl-b', { x: 2, y: 2 });
    payload = recordDeath(payload, 'lvl-b', { x: 3, y: 3 });

    const a = getLevelData(payload, 'lvl-a');
    const b = getLevelData(payload, 'lvl-b');

    expect(a.attemptCount).toBe(2);
    expect(a.deathCount).toBe(1);
    expect(b.attemptCount).toBe(1);
    expect(b.deathCount).toBe(2);
    expect(b.deathPositions).toEqual([{ x: 2, y: 2 }, { x: 3, y: 3 }]);
  });

  it('survives a full round-trip with multiple levels', () => {
    const storage = createMemoryStorage();
    let payload: SavePayload = { version: SAVE_SCHEMA_VERSION, levels: {} };
    payload = recordAttempt(payload, 'lvl-a');
    payload = recordDeath(payload, 'lvl-a', { x: 10, y: 10 });
    payload = recordAttempt(payload, 'lvl-b');
    payload = recordAttempt(payload, 'lvl-b');
    payload = recordDeath(payload, 'lvl-b', { x: 20, y: 20 });

    saveSave(storage, payload);
    const loaded = loadSave(storage);

    expect(getLevelData(loaded, 'lvl-a').attemptCount).toBe(1);
    expect(getLevelData(loaded, 'lvl-a').deathCount).toBe(1);
    expect(getLevelData(loaded, 'lvl-b').attemptCount).toBe(2);
    expect(getLevelData(loaded, 'lvl-b').deathCount).toBe(1);
    expect(getLevelData(loaded, 'lvl-b').deathPositions).toEqual([{ x: 20, y: 20 }]);
  });
});
