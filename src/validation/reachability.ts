// Level validation harness: reachability and solvability checks (#44).
// BFS flood-fill from spawn through the tile grid using movement constraints.
// Checks every mutation variant, not just the base level.

import { levelToGrid } from '../engine/levelAdapter';
import { resolveMutations } from '../levels/mutations';
import type { MutableLevelData } from '../levels/mutation-types';
import type { LevelData } from '../levels/types';
import { Tile } from '../levels/types';

export interface ValidationResult {
  reachable: boolean;
  exitReachable: boolean;
  variantResults: VariantResult[];
}

export interface VariantResult {
  attempt: number;
  reachable: boolean;
  exitReachable: boolean;
}

export function validateReachability(level: LevelData): boolean {
  // Simplified BFS: can the player walk/jump from spawn to exit?
  // Check if there's a continuous path of non-solid tiles from spawn to exit
  // considering jump distances (max 4 tiles horizontal gap)
  const grid = levelToGrid(level);
  const visited = new Set<string>();
  const queue: Array<{ col: number; row: number }> = [{ col: level.spawn.col, row: level.spawn.row }];
  visited.add(`${level.spawn.col},${level.spawn.row}`);

  while (queue.length > 0) {
    const { col, row } = queue.shift()!;
    if (col === level.exit.col && row === level.exit.row) return true;

    // Check neighbors: left, right, up (jump), down (drop)
    const neighbors = [
      { dc: -1, dr: 0 }, { dc: 1, dr: 0 },   // walk
      { dc: -2, dr: 0 }, { dc: 2, dr: 0 },   // small jump
      { dc: -3, dr: 0 }, { dc: 3, dr: 0 },   // medium jump
      { dc: -4, dr: 0 }, { dc: 4, dr: 0 },   // max jump
      { dc: 0, dr: -1 }, { dc: 0, dr: -2 },  // vertical jump
      { dc: 0, dr: 1 },                       // drop
    ];

    for (const { dc, dr } of neighbors) {
      const nc = col + dc;
      const nr = row + dr;
      const key = `${nc},${nr}`;
      if (visited.has(key)) continue;
      if (nc < 0 || nc >= grid.cols || nr < 0 || nr >= grid.rows) continue;
      
      const idx = nr * grid.cols + nc;
      const tile = grid.tiles[idx] ?? 0;
      if (tile === Tile.Solid) continue; // can't walk through solid
      
      visited.add(key);
      queue.push({ col: nc, row: nr });
    }
  }

  return false;
}

export function validateAllVariants(level: MutableLevelData, maxAttempts: number = 10): ValidationResult {
  const variants: VariantResult[] = [];
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const variant = resolveMutations(level, attempt);
    const reachable = validateReachability(variant);
    variants.push({ attempt, reachable, exitReachable: reachable });
    
    // Stop early if no mutations beyond this attempt
    const hasMoreMutations = (level.mutations ?? []).some(m => m.attempt > attempt);
    if (!hasMoreMutations && attempt > 1) break;
  }

  const allReachable = variants.every(v => v.reachable);
  return {
    reachable: allReachable,
    exitReachable: allReachable,
    variantResults: variants,
  };
}
