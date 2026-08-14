// Shifting wall trap (#17): geometry that rearranges to deny a route. A wall
// slides in to seal a corridor, a gap narrows, a platform slides out. The
// player is not killed directly; they are stranded, blocked, or made to
// fall. The DynamicSolid is solid=true, lethal=false.

import { aabbOverlap } from '../../engine/physics';
import type { AABB, Body } from '../../engine/physics';
import type { TrapEntry } from '../../levels/types';
import type { TrapInstance, WorldState } from '../types';
import { registerTrapType } from '../registry';
import {
  buildTriggerContext,
  reqNumber,
  reqString,
} from './helpers';

type Direction = 'left' | 'right' | 'up' | 'down';

const DIRECTIONS: readonly Direction[] = ['left', 'right', 'up', 'down'];

interface ShiftingWallState {
  col: number;
  row: number;
  direction: Direction;
  distance: number;
  speed: number;
  spawned: boolean;
  stopped: boolean;
  solidId: string;
  targetZone: AABB;
}

function bodyDistance(body: Body, aabb: AABB): number {
  const dx = Math.max(aabb.x - (body.x + body.width), body.x - (aabb.x + aabb.width), 0);
  const dy = Math.max(aabb.y - (body.y + body.height), body.y - (aabb.y + aabb.height), 0);
  return Math.sqrt(dx * dx + dy * dy);
}

export function createShiftingWall(entry: TrapEntry): TrapInstance {
  const trigger = buildTriggerContext(entry.trigger, entry.params);
  const col = reqNumber(entry.params, 'col');
  const row = reqNumber(entry.params, 'row');
  const dirStr = reqString(entry.params, 'direction');
  if (!DIRECTIONS.includes(dirStr as Direction)) {
    throw new Error(`param "direction" must be left, right, up, or down`);
  }
  const direction = dirStr as Direction;
  const distance = reqNumber(entry.params, 'distance');
  const speed = reqNumber(entry.params, 'speed');

  const startX = col * 16;
  const startY = row * 16;

  // Compute the target zone: the area swept by the wall as it shifts.
  let targetZone: AABB;
  switch (direction) {
    case 'right':
      targetZone = { x: startX, y: startY, width: distance + 16, height: 16 };
      break;
    case 'left':
      targetZone = { x: startX - distance, y: startY, width: distance + 16, height: 16 };
      break;
    case 'down':
      targetZone = { x: startX, y: startY, width: 16, height: distance + 16 };
      break;
    case 'up':
      targetZone = { x: startX, y: startY - distance, width: 16, height: distance + 16 };
      break;
  }

  // Override with explicit region from params if provided.
  if (trigger.region !== undefined) {
    targetZone = trigger.region;
  }

  const state: ShiftingWallState = {
    col,
    row,
    direction,
    distance,
    speed,
    spawned: false,
    stopped: false,
    solidId: `${entry.id}-solid`,
    targetZone,
  };

  function evaluateImpl(this: TrapInstance, world: WorldState, _step: number): boolean {
    void _step;
    switch (this.trigger.kind) {
      case 'on-enter':
        return aabbOverlap(world.playerBody, state.targetZone);

      case 'on-approach': {
        const dist = this.trigger.distance ?? 0;
        return bodyDistance(world.playerBody, state.targetZone) < dist;
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
    if (!state.spawned) {
      const velX = state.direction === 'left' ? -state.speed :
                   state.direction === 'right' ? state.speed : 0;
      const velY = state.direction === 'up' ? -state.speed :
                   state.direction === 'down' ? state.speed : 0;

      world.dynamicSolids.push({
        id: state.solidId,
        x: startX,
        y: startY,
        width: 16,
        height: 16,
        velocityX: velX,
        velocityY: velY,
        solid: true,
        lethal: false,
      });
      state.spawned = true;
      return;
    }

    if (state.stopped) return;

    const solid = world.dynamicSolids.find((ds) => ds.id === state.solidId);
    if (!solid) return;

    let traveled: number;
    switch (state.direction) {
      case 'right':
        solid.x += state.speed;
        traveled = solid.x - startX;
        break;
      case 'left':
        solid.x -= state.speed;
        traveled = startX - solid.x;
        break;
      case 'down':
        solid.y += state.speed;
        traveled = solid.y - startY;
        break;
      case 'up':
        solid.y -= state.speed;
        traveled = startY - solid.y;
        break;
    }

    if (traveled >= state.distance) {
      // Snap to exact destination and stop.
      switch (state.direction) {
        case 'right':
          solid.x = startX + state.distance;
          break;
        case 'left':
          solid.x = startX - state.distance;
          break;
        case 'down':
          solid.y = startY + state.distance;
          break;
        case 'up':
          solid.y = startY - state.distance;
          break;
      }
      solid.velocityX = 0;
      solid.velocityY = 0;
      state.stopped = true;
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

export function registerShiftingWall(): void {
  registerTrapType('shifting-wall', createShiftingWall);
}
