import { describe, expect, it } from 'vitest';
import { loadLevel, LevelValidationError, tileAt } from './load';
import { Tile } from './types';

function validDocument(): Record<string, unknown> {
  return {
    name: 'corridor',
    cols: 4,
    rows: 3,
    spawn: { col: 1, row: 1 },
    exit: { col: 2, row: 1 },
    tiles: ['1111', '1001', '1111'],
    traps: [
      {
        id: 'lip-spike',
        type: 'retracting-spike',
        trigger: 'on-enter',
        params: { delayMs: 200, note: 'z-then-a', nested: { b: 1, a: 2 } },
      },
    ],
  };
}

describe('loadLevel', () => {
  it('returns a typed LevelData for a valid document', () => {
    const level = loadLevel(validDocument());

    expect(level.name).toBe('corridor');
    expect(level.cols).toBe(4);
    expect(level.rows).toBe(3);
  });

  it('preserves trap params verbatim, including key order', () => {
    const doc = validDocument();
    const sourceParams = (doc['traps'] as Array<Record<string, unknown>>)[0]!['params'];
    const level = loadLevel(doc);

    expect(level.traps).toHaveLength(1);
    expect(level.traps[0]?.params).toEqual({
      delayMs: 200,
      note: 'z-then-a',
      nested: { b: 1, a: 2 },
    });
    expect(Object.keys(level.traps[0]!.params)).toEqual(['delayMs', 'note', 'nested']);
    expect(level.traps[0]?.params).toBe(sourceParams);
  });

  it('throws a LevelValidationError carrying the validator errors when the document is invalid', () => {
    const doc = validDocument();
    doc['cols'] = 0;

    expect(() => loadLevel(doc)).toThrow(LevelValidationError);

    try {
      loadLevel(doc);
      throw new Error('expected loadLevel to throw');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(LevelValidationError);
      const err = thrown as LevelValidationError;
      expect(err.errors).toHaveLength(1);
      expect(err.errors[0]?.code).toBe('bad-dimensions');
      expect(err.message).toContain('corridor');
    }
  });
});

describe('tileAt', () => {
  const level = loadLevel(validDocument());

  it('returns the tile at the given column and row', () => {
    expect(tileAt(level, 0, 0)).toBe(Tile.Solid);
    expect(tileAt(level, 1, 1)).toBe(Tile.Empty);
  });

  it('returns Tile.Empty for out-of-bounds coordinates', () => {
    expect(tileAt(level, -1, 0)).toBe(Tile.Empty);
    expect(tileAt(level, 0, -1)).toBe(Tile.Empty);
    expect(tileAt(level, level.cols, 0)).toBe(Tile.Empty);
    expect(tileAt(level, 0, level.rows)).toBe(Tile.Empty);
  });
});
