// Vanishing floor trap (#14): floor tiles that look ordinary and disappear
// on a trigger. After delaySteps, the specified tiles are set to Empty.
// If returns=true, they are restored to Solid after returnDelaySteps more
// steps.

import type { TilePosition } from '../../levels/types';
import { Tile } from '../../engine/physics';
import { aabbOverlap } from '../../engine/physics';
import type { AABB, Body } from '../../engine/physics';
import type { TrapEntry } from '../../levels/types';
import type { TrapInstance, WorldState } from '../types';
import { registerTrapType } from '../registry';
import {
  buildTriggerContext,
  reqNumber,
  reqTileArray,
  optBoolean,
  optNumber,
} from './helpers';

interface VanishingFloorState {
  tiles: TilePosition[];
  delaySteps: number;
  returns: boolean;
  returnDelaySteps: number;
  // Internal counters for delayed vanishing and scheduled return.
  triggerStep: number;       // step when evaluate() returned true (-1 = not yet)
  vanished: boolean;          // tiles currently set to Empty
  applyCountSinceFire: number;
}

/**
 * Computes the bounding AABB covering all target tiles.
 */
function tilesBounds(tiles: readonly TilePosition[]): AABB {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of tiles) {
    const x = t.col * 16;
    const y = t.row * 16;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + 16);
    maxY = Math.max(maxY, y + 16);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Euclidean-ish distance from the player body to the nearest edge of an AABB.
 * Returns 0 if overlapping.
 */
function bodyDistance(body: Body, aabb: AABB): number {
  const dx = Math.max(aabb.x - (body.x + body.width), body.x - (aabb.x + aabb.width), 0);
  const dy = Math.max(aabb.y - (body.y + body.height), body.y - (aabb.y + aabb.height), 0);
  return Math.sqrt(dx * dx + dy * dy);
}

export function createVanishingFloor(entry: TrapEntry): TrapInstance {
  const trigger = buildTriggerContext(entry.trigger, entry.params);
  const tiles = reqTileArray(entry.params, 'tiles');
  const delaySteps = reqNumber(entry.params, 'delaySteps');
  const returns = optBoolean(entry.params, 'returns', false);
  const returnDelaySteps = optNumber(entry.params, 'returnDelaySteps') ?? 0;

  const bounds = tilesBounds(tiles);

  const state: VanishingFloorState = {
    tiles,
    delaySteps,
    returns,
    returnDelaySteps,
    triggerStep: -1,
    vanished: false,
    applyCountSinceFire: 0,
  };

  function evaluateImpl(this: TrapInstance, world: WorldState, _step: number): boolean {
    void _step;
    switch (this.trigger.kind) {
      case 'on-land':
        // Player just transitioned from airborne to grounded within the tile region.
        if (!world.playerBody.grounded || world.playerPrevGrounded) return false;
        return aabbOverlap(world.playerBody, bounds);

      case 'on-approach': {
        const dist = this.trigger.distance ?? 0;
        return bodyDistance(world.playerBody, bounds) < dist;
      }

      case 'on-timer': {
        const threshold = this.trigger.delaySteps ?? 0;
        return this.stepsSinceArm >= threshold;
      }

      default:
        return false;
    }
  }

  function applyImpl(this: TrapInstance, world: WorldState): void {
    // First call: mark trigger step, schedule vanishing.
    if (state.triggerStep < 0) {
      state.triggerStep = this.stepsSinceArm;
    }

    state.applyCountSinceFire++;

    // How many steps since the trigger fired?
    const stepsSinceTrigger = state.applyCountSinceFire - 1;

    // Phase 1: waiting for delaySteps before vanishing.
    if (!state.vanished) {
      if (stepsSinceTrigger >= state.delaySteps) {
        for (const t of state.tiles) {
          const idx = t.row * world.cols + t.col;
          if (idx >= 0 && idx < world.tiles.length) {
            world.tiles[idx] = Tile.Empty;
          }
        }
        state.vanished = true;
        state.applyCountSinceFire = 0; // restart counter for return phase
      }
      return;
    }

    // Phase 2: if returns, wait returnDelaySteps then restore.
    if (state.returns) {
      if (state.applyCountSinceFire >= state.returnDelaySteps) {
        for (const t of state.tiles) {
          const idx = t.row * world.cols + t.col;
          if (idx >= 0 && idx < world.tiles.length) {
            world.tiles[idx] = Tile.Solid;
          }
        }
        state.vanished = false;
      }
    }
    // Non-returning floors stay vanished: nothing more to do.
  }

  function resetImpl(this: TrapInstance): void {
    this.armed = true;
    this.fired = false;
    this.stepsSinceArm = 0;
    state.triggerStep = -1;
    state.vanished = false;
    state.applyCountSinceFire = 0;
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

export function registerVanishingFloor(): void {
  registerTrapType('vanishing-floor', createVanishingFloor);
}
