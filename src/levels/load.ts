import { parseLevel } from './validate';
import { Tile, type LevelData, type LevelError } from './types';

export class LevelValidationError extends Error {
  readonly errors: readonly LevelError[];

  constructor(name: string, errors: readonly LevelError[]) {
    const summary = errors.map((e) => `${e.path || '(root)'}: ${e.message}`).join('; ');
    super(`level "${name}" failed validation: ${summary}`);
    this.name = 'LevelValidationError';
    this.errors = errors;
  }
}

export function loadLevel(source: unknown): LevelData {
  const result = parseLevel(source);
  if (result.ok) {
    return result.level;
  }

  const name =
    typeof source === 'object' &&
    source !== null &&
    'name' in source &&
    typeof source.name === 'string'
      ? source.name
      : '(unknown)';
  throw new LevelValidationError(name, result.errors);
}

/**
 * Duplicates the physics helper of the same name in src/engine/physics.ts.
 * This package must not import from src/engine/, and noUncheckedIndexedAccess
 * would otherwise force every caller to write `?? Tile.Empty` at the call
 * site. Out-of-bounds returns Tile.Empty, matching the engine's convention.
 */
export function tileAt(level: LevelData, col: number, row: number): Tile {
  if (col < 0 || col >= level.cols || row < 0 || row >= level.rows) {
    return Tile.Empty;
  }
  return level.tiles[row * level.cols + col] ?? Tile.Empty;
}
