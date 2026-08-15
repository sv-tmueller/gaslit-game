// Level diff utility for development mode.
//
// Compares a base LevelData against a mutated variant (typically the output
// of resolveMutations) and produces a structured diff plus a human-readable
// summary. Used by designers to preview what a mutation actually changes.

import type { LevelData, TilePosition } from '../levels/types';

export interface LevelDiffEntry {
  readonly kind: 'tile-changed' | 'exit-moved' | 'trap-changed';
  readonly col?: number;
  readonly row?: number;
  readonly oldValue?: number;
  readonly newValue?: number;
  readonly oldExit?: TilePosition;
  readonly newExit?: TilePosition;
  readonly trapId?: string;
  readonly field?: string;
  readonly oldFieldValue?: string;
  readonly newFieldValue?: string;
}

/**
 * Compare two LevelData instances and return a list of structural differences.
 *
 * Currently detects: tile changes, exit moves, and trap trigger changes.
 * Both levels are assumed to have the same dimensions (typical for a base +
 * resolved-mutation pair).
 */
export function diffLevels(base: LevelData, mutated: LevelData): LevelDiffEntry[] {
  const diffs: LevelDiffEntry[] = [];

  // Compare tiles
  for (let r = 0; r < base.rows; r++) {
    for (let c = 0; c < base.cols; c++) {
      const idx = r * base.cols + c;
      const bt = base.tiles[idx];
      const mt = mutated.tiles[idx];
      if (bt !== undefined && mt !== undefined && bt !== mt) {
        diffs.push({ kind: 'tile-changed', col: c, row: r, oldValue: bt, newValue: mt });
      }
    }
  }

  // Compare exit
  if (base.exit.col !== mutated.exit.col || base.exit.row !== mutated.exit.row) {
    diffs.push({ kind: 'exit-moved', oldExit: base.exit, newExit: mutated.exit });
  }

  // Compare traps (iterate base traps; detect trigger changes)
  for (const bt of base.traps) {
    const mt = mutated.traps.find((t) => t.id === bt.id);
    if (!mt) continue;
    if (bt.trigger !== mt.trigger) {
      diffs.push({
        kind: 'trap-changed',
        trapId: bt.id,
        field: 'trigger',
        oldFieldValue: bt.trigger,
        newFieldValue: mt.trigger,
      });
    }
  }

  return diffs;
}

/**
 * Render a list of LevelDiffEntry objects as a human-readable multiline string.
 */
export function formatDiff(diffs: readonly LevelDiffEntry[]): string {
  const lines: string[] = [];
  for (const d of diffs) {
    if (d.kind === 'tile-changed') {
      lines.push(`tile(${d.col},${d.row}): ${d.oldValue} -> ${d.newValue}`);
    } else if (d.kind === 'exit-moved') {
      const oe = d.oldExit;
      const ne = d.newExit;
      if (oe && ne) {
        lines.push(`exit: (${oe.col},${oe.row}) -> (${ne.col},${ne.row})`);
      }
    } else if (d.kind === 'trap-changed') {
      lines.push(`trap '${d.trapId}' ${d.field}: ${d.oldFieldValue} -> ${d.newFieldValue}`);
    }
  }
  return lines.join('\n');
}
