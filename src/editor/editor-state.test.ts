import { describe, expect, it } from 'vitest';
import {
  createBlankLevel, paintTile, setSpawn, setExit, addTrap, removeTrap,
  addMutation, setName, exportToJson, importFromJson,
} from './editor-state';
import { Tile } from '../levels/types';

describe('editor state', () => {
  it('creates a blank level with border', () => {
    const state = createBlankLevel(5, 3);
    expect(state.cols).toBe(5);
    expect(state.rows).toBe(3);
    expect(state.tiles[0]).toBe(Tile.Solid); // top-left
    expect(state.tiles[7]).toBe(Tile.Empty);  // interior (1,1)
  });

  it('paintTile changes a tile', () => {
    let state = createBlankLevel(5, 3);
    state = paintTile(state, 2, 1, Tile.Hazard);
    expect(state.tiles[7]).toBe(Tile.Hazard);
    expect(state.dirty).toBe(true);
  });

  it('paintTile ignores out of bounds', () => {
    const state = createBlankLevel(5, 3);
    const unchanged = paintTile(state, 99, 99, Tile.Hazard);
    expect(unchanged.tiles).toEqual(state.tiles);
  });

  it('setSpawn changes spawn position', () => {
    let state = createBlankLevel(5, 3);
    state = setSpawn(state, 1, 1);
    expect(state.spawn).toEqual({ col: 1, row: 1 });
  });

  it('setExit changes exit position', () => {
    let state = createBlankLevel(5, 3);
    state = setExit(state, 3, 1);
    expect(state.exit).toEqual({ col: 3, row: 1 });
  });

  it('addTrap appends a trap', () => {
    let state = createBlankLevel(5, 3);
    state = addTrap(state, { id: 't1', type: 'vanishing-floor', trigger: 'on-land', params: {} });
    expect(state.traps).toHaveLength(1);
  });

  it('removeTrap removes by index', () => {
    let state = createBlankLevel(5, 3);
    state = addTrap(state, { id: 't1', type: 'vanishing-floor', trigger: 'on-land', params: {} });
    state = removeTrap(state, 0);
    expect(state.traps).toHaveLength(0);
  });

  it('addMutation replaces existing attempt', () => {
    let state = createBlankLevel(5, 3);
    state = addMutation(state, { attempt: 2, deltas: [{ kind: 'set-tile', col: 1, row: 1, tile: 1 }] });
    state = addMutation(state, { attempt: 2, deltas: [{ kind: 'set-tile', col: 2, row: 1, tile: 1 }] });
    expect(state.mutations).toHaveLength(1);
    expect(state.mutations[0]!.deltas[0]!.col).toBe(2);
  });

  it('addMutation sorts by attempt', () => {
    let state = createBlankLevel(5, 3);
    state = addMutation(state, { attempt: 5, deltas: [] });
    state = addMutation(state, { attempt: 2, deltas: [] });
    expect(state.mutations[0]!.attempt).toBe(2);
    expect(state.mutations[1]!.attempt).toBe(5);
  });

  it('setName changes name', () => {
    let state = createBlankLevel(5, 3);
    state = setName(state, 'my-level');
    expect(state.name).toBe('my-level');
  });

  it('exportToJson produces valid level format', () => {
    let state = createBlankLevel(5, 3);
    state = setName(state, 'test');
    const json = exportToJson(state) as Record<string, unknown>;
    expect(json['name']).toBe('test');
    expect(json['cols']).toBe(5);
    expect(json['rows']).toBe(3);
    expect(Array.isArray(json['tiles'])).toBe(true);
    expect(json['tiles']).toHaveLength(3);
  });

  it('exportToJson omits mutations when empty', () => {
    const state = createBlankLevel(5, 3);
    const json = exportToJson(state) as Record<string, unknown>;
    expect('mutations' in json).toBe(false);
  });

  it('exportToJson includes mutations when present', () => {
    let state = createBlankLevel(5, 3);
    state = addMutation(state, { attempt: 2, deltas: [] });
    const json = exportToJson(state) as Record<string, unknown>;
    expect('mutations' in json).toBe(true);
  });

  it('importFromJson round-trips with exportToJson', () => {
    let state = createBlankLevel(5, 3);
    state = setName(state, 'roundtrip');
    state = paintTile(state, 2, 1, Tile.Hazard);
    const json = exportToJson(state);
    const imported = importFromJson(json);
    expect(imported.name).toBe('roundtrip');
    expect(imported.tiles[7]).toBe(Tile.Hazard);
    expect(imported.cols).toBe(5);
    expect(imported.rows).toBe(3);
  });
});
