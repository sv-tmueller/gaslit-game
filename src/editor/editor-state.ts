// In-browser level editor state model (#43).
// Pure data: paint tiles, place spawn/exit, add traps, author mutations.
// The editor produces level JSON that can be exported and played.
// Runs as a development route, not a separate application.

import type { TilePosition, TrapEntry } from '../levels/types';
import type { MutationEntry } from '../levels/mutation-types';
import { Tile } from '../levels/types';

export type EditorTool = 'paint-solid' | 'paint-empty' | 'paint-oneway' | 'paint-hazard' | 'place-spawn' | 'place-exit' | 'add-trap' | 'add-mutation';

export interface EditorState {
  readonly name: string;
  readonly cols: number;
  readonly rows: number;
  readonly tiles: Tile[];              // mutable working copy
  readonly spawn: TilePosition;
  readonly exit: TilePosition;
  readonly traps: TrapEntry[];
  readonly mutations: MutationEntry[];
  readonly selectedTool: EditorTool;
  readonly selectedTrapIndex: number;
  readonly selectedMutationAttempt: number;
  readonly dirty: boolean;
}

export function createBlankLevel(cols: number = 20, rows: number = 12): EditorState {
  const tiles: Tile[] = [];
  // Border of solid tiles, empty interior
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        tiles.push(Tile.Solid);
      } else {
        tiles.push(Tile.Empty);
      }
    }
  }
  return {
    name: 'unnamed',
    cols,
    rows,
    tiles,
    spawn: { col: 2, row: rows - 3 },
    exit: { col: cols - 3, row: rows - 3 },
    traps: [],
    mutations: [],
    selectedTool: 'paint-solid',
    selectedTrapIndex: -1,
    selectedMutationAttempt: 2,
    dirty: false,
  };
}

export function paintTile(state: EditorState, col: number, row: number, tile: Tile): EditorState {
  if (col < 0 || col >= state.cols || row < 0 || row >= state.rows) return state;
  const idx = row * state.cols + col;
  const tiles = [...state.tiles];
  tiles[idx] = tile;
  return { ...state, tiles, dirty: true };
}

export function setSpawn(state: EditorState, col: number, row: number): EditorState {
  if (col < 0 || col >= state.cols || row < 0 || row >= state.rows) return state;
  return { ...state, spawn: { col, row }, dirty: true };
}

export function setExit(state: EditorState, col: number, row: number): EditorState {
  if (col < 0 || col >= state.cols || row < 0 || row >= state.rows) return state;
  return { ...state, exit: { col, row }, dirty: true };
}

export function addTrap(state: EditorState, trap: TrapEntry): EditorState {
  return { ...state, traps: [...state.traps, trap], dirty: true };
}

export function removeTrap(state: EditorState, index: number): EditorState {
  const traps = state.traps.filter((_, i) => i !== index);
  return { ...state, traps, dirty: true };
}

export function addMutation(state: EditorState, mutation: MutationEntry): EditorState {
  // Replace if same attempt number exists
  const existing = state.mutations.findIndex(m => m.attempt === mutation.attempt);
  const mutations = existing >= 0
    ? state.mutations.map((m, i) => i === existing ? mutation : m)
    : [...state.mutations, mutation].sort((a, b) => a.attempt - b.attempt);
  return { ...state, mutations, dirty: true };
}

export function removeMutation(state: EditorState, attempt: number): EditorState {
  const mutations = state.mutations.filter(m => m.attempt !== attempt);
  return { ...state, mutations, dirty: true };
}

export function setName(state: EditorState, name: string): EditorState {
  return { ...state, name, dirty: true };
}

export function setTool(state: EditorState, tool: EditorTool): EditorState {
  return { ...state, selectedTool: tool };
}

export function exportToJson(state: EditorState): unknown {
  // Convert tiles array to row strings for the level format
  const tileRows: string[] = [];
  for (let r = 0; r < state.rows; r++) {
    let row = '';
    for (let c = 0; c < state.cols; c++) {
      row += String(state.tiles[r * state.cols + c]);
    }
    tileRows.push(row);
  }

  const result: Record<string, unknown> = {
    name: state.name,
    cols: state.cols,
    rows: state.rows,
    spawn: state.spawn,
    exit: state.exit,
    tiles: tileRows,
    traps: state.traps,
  };

  if (state.mutations.length > 0) {
    result['mutations'] = state.mutations;
  }

  return result;
}

export function importFromJson(source: unknown): EditorState {
  const obj = source as Record<string, unknown>;
  const cols = obj['cols'] as number;
  const rows = obj['rows'] as number;
  const tileRows = obj['tiles'] as string[];

  const tiles: Tile[] = [];
  for (const row of tileRows) {
    for (const ch of row) {
      tiles.push(parseInt(ch, 10) as Tile);
    }
  }

  return {
    name: obj['name'] as string,
    cols,
    rows,
    tiles,
    spawn: obj['spawn'] as TilePosition,
    exit: obj['exit'] as TilePosition,
    traps: (obj['traps'] as TrapEntry[]) ?? [],
    mutations: (obj['mutations'] as MutationEntry[]) ?? [],
    selectedTool: 'paint-solid',
    selectedTrapIndex: -1,
    selectedMutationAttempt: 2,
    dirty: false,
  };
}
