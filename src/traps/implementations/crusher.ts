// Crusher trap (#16): solid geometry that moves to kill. A ceiling/block
// drops on a trigger, crushing the player. The DynamicSolid is solid=true,
// lethal=false normally; it becomes momentarily lethal when the player is
// caught between it and a solid surface (overlap + grounded).

import { aabbOverlap } from '../../engine/physics';
import type { AABB, Body } from '../../engine/physics';
import type { TrapEntry } from '../../levels/types';
import type { TrapInstance, WorldState } from '../types';
import { registerTrapType } from '../registry';
import {
  buildTriggerContext,
  reqNumber,
} from './helpers';

interface CrusherState {
  col: number;
  row: number;
  widthPx: number;
  heightPx: number;
  dropDistance: number;
  dropSpeed: number;
  spawned: boolean;
  stopped: boolean;
  solidId: string;
}

function bodyDistance(body: Body, aabb: AABB): number {
  const dx = Math.max(aabb.x - (body.x + body.width), body.x - (aabb.x + aabb.width), 0);
  const dy = Math.max(aabb.y - (body.y + body.height), body.y - (aabb.y + aabb.height), 0);
  return Math.sqrt(dx * dx + dy * dy);
}

export function createCrusher(entry: TrapEntry): TrapInstance {
  const trigger = buildTriggerContext(entry.trigger, entry.params);
  const col = reqNumber(entry.params, 'col');
  const row = reqNumber(entry.params, 'row');
  const widthTiles = reqNumber(entry.params, 'width');
  const heightTiles = reqNumber(entry.params, 'height');
  const dropDistance = reqNumber(entry.params, 'dropDistance');
  const dropSpeed = reqNumber(entry.params, 'dropSpeed');

  const startX = col * 16;
  const startY = row * 16;
  const widthPx = widthTiles * 16;
  const heightPx = heightTiles * 16;

  // Danger zone: the area below the crusher spanning the drop distance.
  const dangerZone: AABB = {
    x: startX,
    y: startY + heightPx,
    width: widthPx,
    height: dropDistance,
  };

  const state: CrusherState = {
    col,
    row,
    widthPx,
    heightPx,
    dropDistance,
    dropSpeed,
    spawned: false,
    stopped: false,
    solidId: `${entry.id}-solid`,
  };

  function evaluateImpl(this: TrapInstance, world: WorldState, _step: number): boolean {
    void _step;
    switch (this.trigger.kind) {
      case 'on-enter':
        return aabbOverlap(world.playerBody, dangerZone);

      case 'on-approach': {
        const dist = this.trigger.distance ?? 0;
        return bodyDistance(world.playerBody, dangerZone) < dist;
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
    // Spawn the dynamic solid on first apply.
    if (!state.spawned) {
      world.dynamicSolids.push({
        id: state.solidId,
        x: startX,
        y: startY,
        width: state.widthPx,
        height: state.heightPx,
        velocityX: 0,
        velocityY: state.dropSpeed,
        solid: true,
        lethal: false,
      });
      state.spawned = true;
      return;
    }

    if (state.stopped) {
      // Already at rest: check for ongoing crush condition.
      checkCrush(world);
      return;
    }

    // Find our solid and move it.
    const solid = world.dynamicSolids.find((ds) => ds.id === state.solidId);
    if (!solid) return;

    const newY = solid.y + state.dropSpeed;
    const traveled = newY - startY;

    if (traveled >= state.dropDistance) {
      // Clamp to final position and stop.
      solid.y = startY + state.dropDistance;
      solid.velocityY = 0;
      state.stopped = true;
    } else {
      solid.y = newY;
    }

    // Check for crush condition: player overlaps the crusher and is grounded.
    checkCrush(world);
  }

  function checkCrush(world: WorldState): void {
    const solid = world.dynamicSolids.find((ds) => ds.id === state.solidId);
    if (!solid) return;

    // Only lethal if the crusher is moving (hasn't stopped) or recently moved.
    // Per simplification: lethal when player overlaps AND grounded.
    if (aabbOverlap(world.playerBody, solid) && world.playerBody.grounded) {
      solid.lethal = true;
    } else {
      // Reset lethal flag when condition no longer met.
      solid.lethal = false;
    }
  }

  function resetImpl(this: TrapInstance): void {
    this.armed = true;
    this.fired = false;
    this.stepsSinceArm = 0;
    state.spawned = false;
    state.stopped = false;
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

export function registerCrusher(): void {
  registerTrapType('crusher', createCrusher);
}
