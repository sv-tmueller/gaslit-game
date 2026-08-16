// Public types and constants for the level format. No logic lives here;
// this module is the vocabulary the validator, loader and tests speak.

export const TILE_SIZE = 16;
export const MAX_GRID_DIMENSION = 1024;

export const Tile = { Empty: 0, Solid: 1, OneWay: 2, Hazard: 3 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

export type JsonValue =
  string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface TilePosition {
  readonly col: number;
  readonly row: number;
}

export interface TrapEntry {
  readonly id: string;
  readonly type: string;
  readonly trigger: string;
  readonly params: Readonly<Record<string, JsonValue>>;
}

/**
 * Declares a mechanic (spring, teleporter, moving platform, etc.) in a level.
 * Unlike traps, mechanics are continuous—they have no trigger and step every
 * frame. Mirrors {@link TrapEntry} minus the `trigger` field.
 */
export interface MechanicEntry {
  readonly id: string;
  readonly type: string;
  readonly params: Readonly<Record<string, JsonValue>>;
}

export interface LevelData {
  readonly name: string;
  readonly cols: number;
  readonly rows: number;
  readonly spawn: TilePosition;
  readonly exit: TilePosition;
  /** Flat, row-major, length cols * rows. Index as row * cols + col. */
  readonly tiles: readonly Tile[];
  readonly traps: readonly TrapEntry[];
  /**
   * Optional mechanics declarations. Levels written before this field existed
   * omit it entirely and behave identically (parsed as `[]`).
   */
  readonly mechanics?: readonly MechanicEntry[];
}

export type LevelErrorCode =
  | 'not-an-object'
  | 'bad-name'
  | 'bad-dimensions'
  | 'missing-spawn'
  | 'missing-exit'
  | 'spawn-out-of-bounds'
  | 'exit-out-of-bounds'
  | 'bad-tile-layer'
  | 'unknown-tile'
  | 'malformed-trap'
  | 'duplicate-trap-id'
  | 'malformed-mechanic'
  | 'duplicate-mechanic-id';

export interface LevelError {
  readonly code: LevelErrorCode;
  /** Dotted or indexed path to the offending field, e.g. 'traps[1].trigger'. */
  readonly path: string;
  readonly message: string;
}

export type LevelParseResult =
  | { readonly ok: true; readonly level: LevelData }
  | { readonly ok: false; readonly errors: readonly LevelError[] };
