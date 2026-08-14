import { loadLevel } from '../levels/load';
import type { LevelData } from '../levels/types';

/**
 * Opaque source object: a raw parsed JSON blob that {@link loadLevel} accepts.
 * Kept as `unknown` so the sequence module does not couple to any particular
 * transport (JSON import, fetch response, etc.).
 */
export type LevelSource = unknown;

export interface LevelSequence {
  readonly sources: readonly LevelSource[];
  readonly index: number;
}

/**
 * Constructs a level sequence from an ordered list of raw sources.
 * Throws if the list is empty (there must be at least one level to play).
 */
export function createSequence(sources: readonly LevelSource[]): LevelSequence {
  if (sources.length === 0) {
    throw new Error('cannot create a level sequence from an empty source list');
  }
  return { sources, index: 0 };
}

/**
 * Loads and returns the level at the current sequence index.
 * Throws if the index is somehow out of bounds (defensive: should never
 * happen given the invariant maintained by create/advance).
 */
export function currentLevel(seq: LevelSequence): LevelData {
  const source = seq.sources[seq.index];
  if (source === undefined) {
    throw new Error(`sequence index ${seq.index} is out of bounds`);
  }
  return loadLevel(source);
}

/** True when there is at least one more level after the current one. */
export function hasNext(seq: LevelSequence): boolean {
  return seq.index + 1 < seq.sources.length;
}

/**
 * Returns a new sequence advanced to the next level.
 * Throws if called at the end of the sequence (call hasNext first).
 */
export function advance(seq: LevelSequence): LevelSequence {
  if (!hasNext(seq)) {
    throw new Error('cannot advance past the last level in the sequence');
  }
  return { sources: seq.sources, index: seq.index + 1 };
}
