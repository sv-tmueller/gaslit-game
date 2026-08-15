// Mutation types extending the level format for attempt-keyed deltas.
// Part of M4 gaslighting layer (#20). The format is declarative data:
// a level gains an optional `mutations` array keyed by attempt number.
// The resolver (#21) applies matching deltas at level start only.

import type { LevelData } from './types';

export type DeltaKind =
  | 'set-tile'
  | 'move-exit'
  | 'move-trap'
  | 'swap-trigger'
  | 'resize-gap';

export interface Delta {
  readonly kind: DeltaKind;
  readonly col?: number;
  readonly row?: number;
  readonly tile?: number;
  readonly exitCol?: number;
  readonly exitRow?: number;
  readonly trapId?: string;
  readonly trigger?: string;
  readonly fromCol?: number;
  readonly toCol?: number;
  readonly gapRow?: number;
  readonly gapTile?: number;
}

export interface MutationEntry {
  readonly attempt: number;
  readonly deltas: readonly Delta[];
}

export interface MutableLevelData extends LevelData {
  readonly mutations?: readonly MutationEntry[];
}
