import { describe, expect, it } from 'vitest';
import { parseLevel } from './validate';
import type { LevelData } from './types';

// Minimal valid document every failure-mode test mutates from. 20 x 12 so
// off-by-one bounds checks (case 4 below) have real headroom to test against.
function validDocument(): Record<string, unknown> {
  return {
    name: 'corridor',
    cols: 20,
    rows: 12,
    spawn: { col: 2, row: 9 },
    exit: { col: 17, row: 9 },
    tiles: [
      '11111111111111111111',
      '10000000000000000001',
      '10000000000000000001',
      '10000000000000000001',
      '10000000000000000001',
      '10000000000000000001',
      '10000000000000000001',
      '10000000000000000001',
      '10000000000000000001',
      '10000000000000000001',
      '11111111111111111111',
      '11111111111111111111',
    ],
    traps: [],
  };
}

describe('parseLevel', () => {
  it('loads a valid document into a typed LevelData', () => {
    const result = parseLevel(validDocument());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const level: LevelData = result.level;
    expect(level.name).toBe('corridor');
    expect(level.cols).toBe(20);
    expect(level.rows).toBe(12);
    expect(level.spawn).toEqual({ col: 2, row: 9 });
    expect(level.exit).toEqual({ col: 17, row: 9 });
    expect(level.tiles).toHaveLength(20 * 12);
    expect(level.traps).toEqual([]);
  });

  it('reports bad-dimensions for cols: 0 and nothing else', () => {
    const doc = validDocument();
    doc['cols'] = 0;

    const result = parseLevel(doc);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      code: 'bad-dimensions',
      path: 'cols',
      message: 'cols: expected an integer from 1 to 1024, got 0',
    });
  });

  it('reports missing-spawn when spawn is absent and nothing else', () => {
    const doc = validDocument();
    delete doc['spawn'];

    const result = parseLevel(doc);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      code: 'missing-spawn',
      path: 'spawn',
      message: 'spawn: required field is missing',
    });
  });

  it('reports missing-exit when exit is absent and nothing else', () => {
    const doc = validDocument();
    delete doc['exit'];

    const result = parseLevel(doc);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      code: 'missing-exit',
      path: 'exit',
      message: 'exit: required field is missing',
    });
  });

  it('reports exit-out-of-bounds for an exit column past cols and nothing else', () => {
    const doc = validDocument();
    doc['exit'] = { col: 20, row: 5 };

    const result = parseLevel(doc);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      code: 'exit-out-of-bounds',
      path: 'exit.col',
      message: 'exit.col: 20 is outside the 20 x 12 grid, valid columns are 0 to 19',
    });
  });

  it('reports unknown-tile for an unrecognized tile id and nothing else', () => {
    const doc = validDocument();
    const tiles = [...(doc['tiles'] as string[])];
    // row 3, col 5: replace the '0' with an unknown tile id '7'
    tiles[3] = tiles[3]!.slice(0, 5) + '7' + tiles[3]!.slice(6);
    doc['tiles'] = tiles;

    const result = parseLevel(doc);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      code: 'unknown-tile',
      path: 'tiles[3][5]',
      message:
        'tiles[3][5]: unknown tile id "7", expected 0 (empty), 1 (solid), 2 (one-way) or 3 (hazard)',
    });
  });

  it('reports malformed-trap for a trap missing trigger and nothing else', () => {
    const doc = validDocument();
    doc['traps'] = [{ id: 'a', type: 'spike' }];

    const result = parseLevel(doc);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      code: 'malformed-trap',
      path: 'traps[0].trigger',
      message: 'traps[0].trigger: expected a non-empty string, got undefined',
    });
  });

  it('reports malformed-trap when params is an array, not a plain object', () => {
    const doc = validDocument();
    doc['traps'] = [{ id: 'a', type: 'spike', trigger: 'on-enter', params: [] }];

    const result = parseLevel(doc);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      code: 'malformed-trap',
      path: 'traps[0].params',
      message: 'traps[0].params: expected a plain object, got array',
    });
  });

  it('reports duplicate-trap-id for two traps sharing an id and nothing else', () => {
    const doc = validDocument();
    doc['traps'] = [
      { id: 'same-id', type: 'spike', trigger: 'on-enter', params: {} },
      { id: 'same-id', type: 'gas-jet', trigger: 'on-exit', params: {} },
    ];

    const result = parseLevel(doc);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      code: 'duplicate-trap-id',
      path: 'traps[1].id',
      message: 'traps[1].id: duplicate trap id "same-id"',
    });
  });

  it('accepts traps with distinct ids', () => {
    const doc = validDocument();
    doc['traps'] = [
      { id: 'first', type: 'spike', trigger: 'on-enter', params: {} },
      { id: 'second', type: 'gas-jet', trigger: 'on-exit', params: {} },
    ];

    const result = parseLevel(doc);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.level.traps).toHaveLength(2);
  });

  it('does not throw for a trap params value nested hundreds of thousands of levels deep', () => {
    const doc = validDocument();
    let params: Record<string, unknown> = {};
    for (let i = 0; i < 200_000; i += 1) {
      params = { nested: params };
    }
    doc['traps'] = [{ id: 'a', type: 'spike', trigger: 'on-enter', params }];

    const result = parseLevel(doc);

    expect(result.ok).toBe(true);
  });

  it('reports missing-spawn with a "wrong type" message when spawn is present but not an object', () => {
    const doc = validDocument();
    doc['spawn'] = 'not-an-object';

    const result = parseLevel(doc);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      code: 'missing-spawn',
      path: 'spawn',
      message: 'spawn: expected an object with col and row, got "not-an-object"',
    });
  });

  it('reports missing-exit with a "wrong type" message when exit is present but not an object', () => {
    const doc = validDocument();
    doc['exit'] = 42;

    const result = parseLevel(doc);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      code: 'missing-exit',
      path: 'exit',
      message: 'exit: expected an object with col and row, got 42',
    });
  });
});
