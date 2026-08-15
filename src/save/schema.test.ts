import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION } from './schema';
import type { DeathPosition, LevelSaveData, SavePayload } from './schema';

describe('SAVE_SCHEMA_VERSION', () => {
  it('is 1', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(1);
  });
});

describe('DeathPosition', () => {
  it('accepts x and y coordinates', () => {
    const pos: DeathPosition = { x: 10, y: 20 };
    expect(pos.x).toBe(10);
    expect(pos.y).toBe(20);
  });
});

describe('LevelSaveData', () => {
  it('accepts a populated level entry', () => {
    const data: LevelSaveData = {
      attemptCount: 3,
      deathCount: 2,
      deathPositions: [{ x: 1, y: 2 }],
    };
    expect(data.attemptCount).toBe(3);
    expect(data.deathCount).toBe(2);
    expect(data.deathPositions).toHaveLength(1);
  });

  it('accepts zero-valued defaults', () => {
    const data: LevelSaveData = {
      attemptCount: 0,
      deathCount: 0,
      deathPositions: [],
    };
    expect(data.attemptCount).toBe(0);
    expect(data.deathCount).toBe(0);
    expect(data.deathPositions).toHaveLength(0);
  });
});

describe('SavePayload', () => {
  it('accepts a payload with multiple levels', () => {
    const payload: SavePayload = {
      version: SAVE_SCHEMA_VERSION,
      levels: {
        lvl1: { attemptCount: 1, deathCount: 0, deathPositions: [] },
        lvl2: {
          attemptCount: 5,
          deathCount: 3,
          deathPositions: [
            { x: 0, y: 0 },
            { x: 16, y: 32 },
          ],
        },
      },
    };
    expect(Object.keys(payload.levels)).toHaveLength(2);
    expect(payload.version).toBe(SAVE_SCHEMA_VERSION);
  });

  it('accepts an empty levels map', () => {
    const payload: SavePayload = { version: SAVE_SCHEMA_VERSION, levels: {} };
    expect(Object.keys(payload.levels)).toHaveLength(0);
  });
});
