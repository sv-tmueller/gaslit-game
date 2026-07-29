import {
  MAX_GRID_DIMENSION,
  Tile,
  type JsonValue,
  type LevelError,
  type LevelErrorCode,
  type LevelParseResult,
  type TilePosition,
  type TrapEntry,
} from './types';

const TILE_ID_TO_TILE: Readonly<Record<string, Tile>> = {
  '0': Tile.Empty,
  '1': Tile.Solid,
  '2': Tile.OneWay,
  '3': Tile.Hazard,
};

function error(code: LevelErrorCode, path: string, message: string): LevelError {
  return { code, path, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface Stage1Result {
  readonly name: string;
  readonly cols: number;
  readonly rows: number;
}

function validateStage1(source: unknown): { errors: readonly LevelError[] } | Stage1Result {
  if (!isPlainObject(source)) {
    return { errors: [error('not-an-object', '', 'expected a plain object')] };
  }

  const errors: LevelError[] = [];

  const name = source['name'];
  if (typeof name !== 'string' || name.length === 0) {
    errors.push(
      error('bad-name', 'name', `name: expected a non-empty string, got ${describe(name)}`),
    );
  }

  const cols = source['cols'];
  if (!isValidDimension(cols)) {
    errors.push(
      error(
        'bad-dimensions',
        'cols',
        `cols: expected an integer from 1 to ${MAX_GRID_DIMENSION}, got ${describe(cols)}`,
      ),
    );
  }

  const rows = source['rows'];
  if (!isValidDimension(rows)) {
    errors.push(
      error(
        'bad-dimensions',
        'rows',
        `rows: expected an integer from 1 to ${MAX_GRID_DIMENSION}, got ${describe(rows)}`,
      ),
    );
  }

  if (errors.length > 0) {
    return { errors };
  }

  return { name: name as string, cols: cols as number, rows: rows as number };
}

function isValidDimension(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_GRID_DIMENSION
  );
}

function describe(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

function validatePosition(
  source: Record<string, unknown>,
  field: 'spawn' | 'exit',
  cols: number,
  rows: number,
  missingCode: 'missing-spawn' | 'missing-exit',
  outOfBoundsCode: 'spawn-out-of-bounds' | 'exit-out-of-bounds',
  errors: LevelError[],
): TilePosition | undefined {
  const value = source[field];
  if (value === undefined) {
    errors.push(error(missingCode, field, `${field}: required field is missing`));
    return undefined;
  }

  if (!isPlainObject(value)) {
    errors.push(
      error(
        missingCode,
        field,
        `${field}: expected an object with col and row, got ${describe(value)}`,
      ),
    );
    return undefined;
  }

  const col = value['col'];
  const row = value['row'];
  let ok = true;

  if (typeof col !== 'number' || !Number.isInteger(col)) {
    errors.push(
      error(missingCode, `${field}.col`, `${field}.col: expected an integer, got ${describe(col)}`),
    );
    ok = false;
  } else if (col < 0 || col >= cols) {
    errors.push(
      error(
        outOfBoundsCode,
        `${field}.col`,
        `${field}.col: ${col} is outside the ${cols} x ${rows} grid, valid columns are 0 to ${cols - 1}`,
      ),
    );
    ok = false;
  }

  if (typeof row !== 'number' || !Number.isInteger(row)) {
    errors.push(
      error(missingCode, `${field}.row`, `${field}.row: expected an integer, got ${describe(row)}`),
    );
    ok = false;
  } else if (row < 0 || row >= rows) {
    errors.push(
      error(
        outOfBoundsCode,
        `${field}.row`,
        `${field}.row: ${row} is outside the ${cols} x ${rows} grid, valid rows are 0 to ${rows - 1}`,
      ),
    );
    ok = false;
  }

  if (!ok) return undefined;
  return { col: col as number, row: row as number };
}

function validateTiles(
  source: Record<string, unknown>,
  cols: number,
  rows: number,
  errors: LevelError[],
): readonly Tile[] | undefined {
  const value = source['tiles'];

  if (!Array.isArray(value) || value.length !== rows) {
    errors.push(
      error(
        'bad-tile-layer',
        'tiles',
        `tiles: expected ${rows} row strings of length ${cols}, got ${describe(value)}`,
      ),
    );
    return undefined;
  }

  const flat: Tile[] = [];
  let rowsOk = true;

  for (let r = 0; r < value.length; r += 1) {
    const rowValue: unknown = value[r];
    if (typeof rowValue !== 'string' || rowValue.length !== cols) {
      errors.push(
        error(
          'bad-tile-layer',
          `tiles[${r}]`,
          `tiles[${r}]: expected a string of length ${cols}, got ${describe(rowValue)}`,
        ),
      );
      rowsOk = false;
      continue;
    }

    for (let c = 0; c < rowValue.length; c += 1) {
      const ch = rowValue[c] as string;
      const tile = TILE_ID_TO_TILE[ch];
      if (tile === undefined) {
        errors.push(
          error(
            'unknown-tile',
            `tiles[${r}][${c}]`,
            `tiles[${r}][${c}]: unknown tile id "${ch}", expected 0 (empty), 1 (solid), 2 (one-way) or 3 (hazard)`,
          ),
        );
        rowsOk = false;
        continue;
      }
      flat.push(tile);
    }
  }

  if (!rowsOk) return undefined;
  return flat;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isPlainObject(value)) return Object.values(value).every(isJsonValue);
  return false;
}

function validateTraps(
  source: Record<string, unknown>,
  errors: LevelError[],
): readonly TrapEntry[] | undefined {
  const value = source['traps'];

  if (!Array.isArray(value)) {
    errors.push(
      error('malformed-trap', 'traps', `traps: expected an array, got ${describe(value)}`),
    );
    return undefined;
  }

  const traps: TrapEntry[] = [];
  const seenIds = new Set<string>();
  let ok = true;

  for (let i = 0; i < value.length; i += 1) {
    const entry: unknown = value[i];
    const path = `traps[${i}]`;

    if (!isPlainObject(entry)) {
      errors.push(
        error('malformed-trap', path, `${path}: expected a plain object, got ${describe(entry)}`),
      );
      ok = false;
      continue;
    }

    const id = entry['id'];
    const type = entry['type'];
    const trigger = entry['trigger'];
    const params = entry['params'];
    let entryOk = true;

    if (typeof id !== 'string' || id.length === 0) {
      errors.push(
        error(
          'malformed-trap',
          `${path}.id`,
          `${path}.id: expected a non-empty string, got ${describe(id)}`,
        ),
      );
      entryOk = false;
    } else if (seenIds.has(id)) {
      errors.push(
        error('duplicate-trap-id', `${path}.id`, `${path}.id: duplicate trap id ${describe(id)}`),
      );
      entryOk = false;
    } else {
      seenIds.add(id);
    }
    if (typeof type !== 'string' || type.length === 0) {
      errors.push(
        error(
          'malformed-trap',
          `${path}.type`,
          `${path}.type: expected a non-empty string, got ${describe(type)}`,
        ),
      );
      entryOk = false;
    }
    if (typeof trigger !== 'string' || trigger.length === 0) {
      errors.push(
        error(
          'malformed-trap',
          `${path}.trigger`,
          `${path}.trigger: expected a non-empty string, got ${describe(trigger)}`,
        ),
      );
      entryOk = false;
    }
    // params is optional on the wire; a missing params defaults to {} rather
    // than erroring, so authors are not forced to write `"params": {}` on
    // traps that take none.
    if (params !== undefined && (!isPlainObject(params) || !isJsonValue(params))) {
      errors.push(
        error(
          'malformed-trap',
          `${path}.params`,
          `${path}.params: expected a plain object, got ${describe(params)}`,
        ),
      );
      entryOk = false;
    }

    if (!entryOk) {
      ok = false;
      continue;
    }

    traps.push({
      id: id as string,
      type: type as string,
      trigger: trigger as string,
      params: (params ?? {}) as Readonly<Record<string, JsonValue>>,
    });
  }

  if (!ok) return undefined;
  return traps;
}

export function parseLevel(source: unknown): LevelParseResult {
  const stage1 = validateStage1(source);
  if ('errors' in stage1) {
    return { ok: false, errors: stage1.errors };
  }

  const { name, cols, rows } = stage1;
  const doc = source as Record<string, unknown>;
  const errors: LevelError[] = [];

  const spawn = validatePosition(
    doc,
    'spawn',
    cols,
    rows,
    'missing-spawn',
    'spawn-out-of-bounds',
    errors,
  );
  const exit = validatePosition(
    doc,
    'exit',
    cols,
    rows,
    'missing-exit',
    'exit-out-of-bounds',
    errors,
  );
  const tiles = validateTiles(doc, cols, rows, errors);
  const traps = validateTraps(doc, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    level: {
      name,
      cols,
      rows,
      spawn: spawn as TilePosition,
      exit: exit as TilePosition,
      tiles: tiles as readonly Tile[],
      traps: traps as readonly TrapEntry[],
    },
  };
}
