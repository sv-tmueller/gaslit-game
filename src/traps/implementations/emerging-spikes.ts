// Emerging spikes trap (#15): spikes that rise from surfaces on a trigger,
// becoming lethal only once extended. Over extendSteps steps a HazardRect
// grows from 0 to full 16px. If repeats=true, retracts over retractSteps
// then re-arms.
//
// Visual identity rule: the lethal accent appears only as the spike
// extends. A retracted spike is invisible as a threat.

import { Tile } from '../../engine/physics';
import { aabbOverlap } from '../../engine/physics';
import type { AABB, Body } from '../../engine/physics';
import type { TrapEntry } from '../../levels/types';
import type { TrapInstance, WorldState } from '../types';
import { registerTrapType } from '../registry';
import {
  buildTriggerContext,
  reqNumber,
  reqString,
  optBoolean,
  optNumber,
} from './helpers';

type Surface = 'floor' | 'wall' | 'ceiling';

const SURFACES: readonly Surface[] = ['floor', 'wall', 'ceiling'];

interface SpikesState {
  surface: Surface;
  col: number;
  row: number;
  extendSteps: number;
  retractSteps: number;
  repeats: boolean;
  // Lifecycle: 'idle' -> 'extending' -> 'extended' -> 'retracting' -> 'idle'
  phase: 'idle' | 'extending' | 'extended' | 'retracting';
  progress: number; // steps in current phase
  hazardIdx: number; // index into world.hazards for our managed rect, -1 if none
}

const FULL_EXTENT = 16;

function tileAABB(col: number, row: number): AABB {
  return { x: col * 16, y: row * 16, width: 16, height: 16 };
}

function bodyDistance(body: Body, aabb: AABB): number {
  const dx = Math.max(aabb.x - (body.x + body.width), body.x - (aabb.x + aabb.width), 0);
  const dy = Math.max(aabb.y - (body.y + body.height), body.y - (aabb.y + aabb.height), 0);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Computes the hazard rect for a spike at a given extension fraction (0..1).
 * Growth direction depends on the surface:
 * - floor: grows upward from the bottom edge of the tile
 * - ceiling: grows downward from the top edge of the tile
 * - wall: grows rightward from the left edge of the tile
 */
function computeHazardRect(state: SpikesState, fraction: number): AABB {
  const tx = state.col * 16;
  const ty = state.row * 16;
  const extent = Math.round(FULL_EXTENT * fraction);

  switch (state.surface) {
    case 'floor':
      // Base at bottom (y + 16), grows up.
      return { x: tx, y: ty + 16 - extent, width: 16, height: extent };
    case 'ceiling':
      // Base at top (y), grows down.
      return { x: tx, y: ty, width: 16, height: extent };
    case 'wall':
      // Base at left (x), grows right.
      return { x: tx, y: ty, width: extent, height: 16 };
  }
}

export function createEmergingSpikes(entry: TrapEntry): TrapInstance {
  const trigger = buildTriggerContext(entry.trigger, entry.params);
  const surfaceStr = reqString(entry.params, 'surface');
  if (!SURFACES.includes(surfaceStr as Surface)) {
    throw new Error(`param "surface" must be floor, wall, or ceiling`);
  }
  const surface = surfaceStr as Surface;
  const col = reqNumber(entry.params, 'col');
  const row = reqNumber(entry.params, 'row');
  const extendSteps = reqNumber(entry.params, 'extendSteps');
  const repeats = optBoolean(entry.params, 'repeats', false);
  const retractSteps = optNumber(entry.params, 'retractSteps') ?? extendSteps;

  const spikeAABB = tileAABB(col, row);

  const state: SpikesState = {
    surface,
    col,
    row,
    extendSteps,
    retractSteps,
    repeats,
    phase: 'idle',
    progress: 0,
    hazardIdx: -1,
  };

  function evaluateImpl(this: TrapInstance, world: WorldState, _step: number): boolean {
    void _step;
    switch (this.trigger.kind) {
      case 'on-enter':
        return aabbOverlap(world.playerBody, spikeAABB);

      case 'on-approach': {
        const dist = this.trigger.distance ?? 0;
        return bodyDistance(world.playerBody, spikeAABB) < dist;
      }

      case 'on-timer': {
        const threshold = this.trigger.delaySteps ?? 0;
        return this.stepsSinceArm >= threshold;
      }

      default:
        return false;
    }
  }

  /**
   * Gets the index of this trap's hazard in world.hazards. Returns -1 if
   * not currently tracked or if the index is out of bounds.
   */
  function getHazardIdx(world: WorldState): number {
    if (state.hazardIdx < 0 || state.hazardIdx >= world.hazards.length) {
      return -1;
    }
    return state.hazardIdx;
  }

  function applyImpl(this: TrapInstance, world: WorldState): void {
    // Advance the lifecycle.
    if (state.phase === 'idle') {
      state.phase = 'extending';
      state.progress = 0;
    }

    if (state.phase === 'extending') {
      state.progress++;

      if (state.extendSteps <= 0) {
        state.progress = state.extendSteps;
      }

      const fraction = Math.min(state.progress / state.extendSteps, 1);
      const rect = computeHazardRect(state, fraction);

      if (fraction > 0) {
        const idx = getHazardIdx(world);
        if (idx >= 0) {
          world.hazards[idx] = rect;
        } else {
          world.hazards.push(rect);
          state.hazardIdx = world.hazards.length - 1;
        }
      }

      if (state.progress >= state.extendSteps) {
        state.phase = 'extended';
        state.progress = 0;
      }
      return;
    }

    if (state.phase === 'extended') {
      if (state.repeats) {
        state.phase = 'retracting';
        state.progress = 0;
        // Fall through to retracting logic for this step.
      } else {
        // Non-repeating: stays fully extended. Nothing to do.
        return;
      }
    }

    if (state.phase === 'retracting') {
      state.progress++;

      const fraction = Math.max(1 - state.progress / state.retractSteps, 0);
      const rect = computeHazardRect(state, fraction);

      if (fraction > 0) {
        const idx = getHazardIdx(world);
        if (idx >= 0) {
          world.hazards[idx] = rect;
        } else {
          world.hazards.push(rect);
          state.hazardIdx = world.hazards.length - 1;
        }
      } else {
        // Fully retracted: remove the hazard.
        const idx = getHazardIdx(world);
        if (idx >= 0) {
          world.hazards.splice(idx, 1);
        }
        state.hazardIdx = -1;
        state.phase = 'idle';
        state.progress = 0;
      }
    }
  }

  function resetImpl(this: TrapInstance): void {
    this.armed = true;
    this.fired = false;
    this.stepsSinceArm = 0;
    state.phase = 'idle';
    state.progress = 0;
    state.hazardIdx = -1;
  }

  return {
    id: entry.id,
    type: entry.type,
    trigger,
    armed: true,
    fired: false,
    stepsSinceArm: 0,
    evaluate: evaluateImpl,
    apply: applyImpl,
    reset: resetImpl,
  };
}

export function registerEmergingSpikes(): void {
  registerTrapType('emerging-spikes', createEmergingSpikes);
}

// Reference Tile to satisfy potential future use; kept for consistency.
void Tile;
