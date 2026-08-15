// Deterministic mutation resolver (#21).
// Given a base level and an attempt count, produces the mutated LevelData
// the player will actually play. Pure function: no wall-clock, no unseeded
// randomness, same inputs always produce byte-identical output.
//
// Guardrails enforced by the format: deltas apply at level START only.
// This function is called once before a run, never mid-run.

import type { LevelData, Tile, TilePosition, TrapEntry } from './types';
import type { Delta, MutableLevelData, MutationEntry } from './mutation-types';

const VALID_DELTA_KINDS: readonly string[] = [
  'set-tile',
  'move-exit',
  'move-trap',
  'swap-trigger',
  'resize-gap',
];

export function validateMutations(
  source: Readonly<Record<string, unknown>>,
  errors: { code: string; path: string; message: string }[],
): readonly MutationEntry[] | undefined {
  const raw = source['mutations'];
  if (raw === undefined) return undefined;

  if (!Array.isArray(raw)) {
    errors.push({
      code: 'bad-mutations',
      path: 'mutations',
      message: `mutations: expected an array, got ${typeof raw}`,
    });
    return undefined;
  }

  const seen = new Set<number>();
  const entries: MutationEntry[] = [];
  let ok = true;

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const path = `mutations[${i}]`;

    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      errors.push({
        code: 'bad-mutation-entry',
        path,
        message: `${path}: expected an object`,
      });
      ok = false;
      continue;
    }

    const obj = entry as Record<string, unknown>;
    const attempt = obj['attempt'];

    if (typeof attempt !== 'number' || !Number.isInteger(attempt) || attempt < 1) {
      errors.push({
        code: 'bad-mutation-entry',
        path: `${path}.attempt`,
        message: `${path}.attempt: expected a positive integer, got ${String(attempt)}`,
      });
      ok = false;
      continue;
    }

    if (seen.has(attempt)) {
      errors.push({
        code: 'duplicate-mutation-attempt',
        path: `${path}.attempt`,
        message: `${path}.attempt: duplicate attempt ${attempt}`,
      });
      ok = false;
      continue;
    }
    seen.add(attempt);

    const deltasRaw = obj['deltas'];
    if (!Array.isArray(deltasRaw)) {
      errors.push({
        code: 'bad-mutation-entry',
        path: `${path}.deltas`,
        message: `${path}.deltas: expected an array`,
      });
      ok = false;
      continue;
    }

    const deltas: Delta[] = [];
    let deltasOk = true;

    for (let j = 0; j < deltasRaw.length; j++) {
      const d = deltasRaw[j];
      const dpath = `${path}.deltas[${j}]`;

      if (typeof d !== 'object' || d === null || Array.isArray(d)) {
        errors.push({
          code: 'bad-delta',
          path: dpath,
          message: `${dpath}: expected an object`,
        });
        deltasOk = false;
        continue;
      }

      const dobj = d as Record<string, unknown>;
      const kind = dobj['kind'];

      if (typeof kind !== 'string' || !VALID_DELTA_KINDS.includes(kind)) {
        errors.push({
          code: 'bad-delta',
          path: `${dpath}.kind`,
          message: `${dpath}.kind: expected one of ${VALID_DELTA_KINDS.join(', ')}, got ${String(kind)}`,
        });
        deltasOk = false;
        continue;
      }

      const delta: Delta = { kind: kind as Delta['kind'] };

      if (kind === 'set-tile') {
        const col = dobj['col'];
        const row = dobj['row'];
        const tile = dobj['tile'];
        if (typeof col !== 'number' || typeof row !== 'number' || typeof tile !== 'number') {
          errors.push({
            code: 'bad-delta',
            path: dpath,
            message: `${dpath}: set-tile requires numeric col, row, tile`,
          });
          deltasOk = false;
          continue;
        }
        Object.assign(delta, { col, row, tile });
      } else if (kind === 'move-exit') {
        const ec = dobj['exitCol'];
        const er = dobj['exitRow'];
        if (typeof ec !== 'number' || typeof er !== 'number') {
          errors.push({
            code: 'bad-delta',
            path: dpath,
            message: `${dpath}: move-exit requires numeric exitCol, exitRow`,
          });
          deltasOk = false;
          continue;
        }
        Object.assign(delta, { exitCol: ec, exitRow: er });
      } else if (kind === 'move-trap' || kind === 'swap-trigger') {
        const tid = dobj['trapId'];
        if (typeof tid !== 'string') {
          errors.push({
            code: 'bad-delta',
            path: `${dpath}.trapId`,
            message: `${dpath}.trapId: expected a string`,
          });
          deltasOk = false;
          continue;
        }
        Object.assign(delta, { trapId: tid });
        if (kind === 'swap-trigger') {
          const trg = dobj['trigger'];
          if (typeof trg !== 'string') {
            errors.push({
              code: 'bad-delta',
              path: `${dpath}.trigger`,
              message: `${dpath}.trigger: expected a string`,
            });
            deltasOk = false;
            continue;
          }
          Object.assign(delta, { trigger: trg });
        }
      } else if (kind === 'resize-gap') {
        const fc = dobj['fromCol'];
        const tc = dobj['toCol'];
        const gr = dobj['gapRow'];
        const gt = dobj['gapTile'];
        if (typeof fc !== 'number' || typeof tc !== 'number' || typeof gr !== 'number' || typeof gt !== 'number') {
          errors.push({
            code: 'bad-delta',
            path: dpath,
            message: `${dpath}: resize-gap requires numeric fromCol, toCol, gapRow, gapTile`,
          });
          deltasOk = false;
          continue;
        }
        Object.assign(delta, { fromCol: fc, toCol: tc, gapRow: gr, gapTile: gt });
      }

      deltas.push(delta);
    }

    if (!deltasOk) {
      ok = false;
      continue;
    }

    entries.push({ attempt, deltas });
  }

  if (!ok) return undefined;
  return entries;
}

export function resolveMutations(level: MutableLevelData, attempt: number): LevelData {
  const tiles: Tile[] = [...level.tiles];
  let exit: TilePosition = { ...level.exit };
  const traps: TrapEntry[] = level.traps.map((t) => ({
    ...t,
    params: { ...t.params },
  }));

  const applicable = (level.mutations ?? [])
    .filter((m) => m.attempt <= attempt)
    .sort((a, b) => a.attempt - b.attempt);

  for (const mutation of applicable) {
    for (const delta of mutation.deltas) {
      applyDelta(delta, tiles, { cols: level.cols, rows: level.rows }, () => {
        exit = { ...exit };
      }, (newExit: TilePosition) => {
        exit = newExit;
      }, traps);
    }
  }

  return {
    name: level.name,
    cols: level.cols,
    rows: level.rows,
    spawn: level.spawn,
    exit,
    tiles,
    traps,
  };
}

function applyDelta(
  delta: Delta,
  tiles: Tile[],
  dims: { cols: number; rows: number },
  _touchExit: () => void,
  setExit: (e: TilePosition) => void,
  traps: TrapEntry[],
): void {
  switch (delta.kind) {
    case 'set-tile': {
      const { col, row, tile } = delta;
      if (col === undefined || row === undefined || tile === undefined) return;
      if (col < 0 || col >= dims.cols || row < 0 || row >= dims.rows) return;
      const idx = row * dims.cols + col;
      tiles[idx] = tile as Tile;
      break;
    }
    case 'move-exit': {
      const { exitCol, exitRow } = delta;
      if (exitCol === undefined || exitRow === undefined) return;
      setExit({ col: exitCol, row: exitRow });
      break;
    }
    case 'move-trap': {
      const { trapId } = delta;
      if (trapId === undefined) return;
      const trap = traps.find((t) => t.id === trapId);
      if (!trap) return;
      const params = { ...trap.params };
      if (typeof delta.col === 'number') params['col'] = delta.col;
      if (typeof delta.row === 'number') params['row'] = delta.row;
      const idx = traps.indexOf(trap);
      traps[idx] = { ...trap, params };
      break;
    }
    case 'swap-trigger': {
      const { trapId, trigger } = delta;
      if (trapId === undefined || trigger === undefined) return;
      const trap = traps.find((t) => t.id === trapId);
      if (!trap) return;
      const idx = traps.indexOf(trap);
      traps[idx] = { ...trap, trigger };
      break;
    }
    case 'resize-gap': {
      const { fromCol, toCol, gapRow, gapTile } = delta;
      if (fromCol === undefined || toCol === undefined || gapRow === undefined || gapTile === undefined) return;
      for (let c = Math.min(fromCol, toCol); c <= Math.max(fromCol, toCol); c++) {
        if (c < 0 || c >= dims.cols) continue;
        if (gapRow < 0 || gapRow >= dims.rows) continue;
        tiles[gapRow * dims.cols + c] = gapTile as Tile;
      }
      break;
    }
  }
}
