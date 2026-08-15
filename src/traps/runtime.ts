// Trap runtime: owns the mutable WorldState and the array of active
// TrapInstances. Evaluates triggers in a FIXED ORDER every step and applies
// effects deterministically. Supports full re-arm on respawn.
//
// Determinism contract: given identical (playerBody, prevGrounded,
// exitReached, step) inputs, stepTraps produces identical mutations. No
// Math.random, no Date.now, no wall-clock dependencies anywhere in this
// module or in trap implementations.

import type { Body } from '../engine/physics';
import { collectHazards, levelToGrid } from '../engine/levelAdapter';
import type { LevelData } from '../levels/types';
import { createTrap } from './registry';
import type { TrapInstance, TriggerKind, WorldState } from './types';

export interface TrapRuntime {
  readonly level: LevelData; // retained so resetTraps can rebuild the world
  traps: TrapInstance[];
  world: WorldState;
}

// Fixed evaluation order: lower indices evaluate first. Changing this order
// changes gameplay semantics; do not reorder without updating tests.
const TRIGGER_ORDER: readonly TriggerKind[] = [
  'on-land',
  'on-enter',
  'on-approach',
  'on-timer',
  'on-exit-reached',
  'on-trap-fired',
];

/**
 * Constructs the trap runtime from a level: builds a mutable world (copied
 * from the immutable level data) and instantiates every trap declared in
 * level.traps via the registry.
 */
export function createRuntime(level: LevelData, initialBody: Body): TrapRuntime {
  const grid = levelToGrid(level);
  const world: WorldState = {
    tiles: [...grid.tiles],
    cols: grid.cols,
    rows: grid.rows,
    hazards: collectHazards(level),
    dynamicSolids: [],
    playerBody: initialBody,
    playerPrevGrounded: false,
    exitReached: false,
    exitPos: { ...level.exit },
    firedTrapIds: [],
  };

  const traps = level.traps.map(createTrap);

  return { level, traps, world };
}

/**
 * Advances the trap system one step. Updates the world with the latest
 * player/exited state, clears the previous step's firedTrapIds, then
 * evaluates every armed unfired trap in fixed trigger-kind order. Traps
 * that fire mark themselves fired, apply their effect, and record their id.
 * Finally increments stepsSinceArm for all armed traps.
 *
 * The runtime mutates the runtime object and world in place and returns the
 * same runtime reference for convenience.
 */
export function stepTraps(
  runtime: TrapRuntime,
  playerBody: Body,
  playerPrevGrounded: boolean,
  exitReached: boolean,
  step: number,
): TrapRuntime {
  const { world, traps } = runtime;

  world.playerBody = playerBody;
  world.playerPrevGrounded = playerPrevGrounded;
  world.exitReached = exitReached;
  world.firedTrapIds = [];

  // Phase 1: Evaluate triggers in fixed order. An unarmed or already-fired
  // trap is skipped (a fired trap does not re-trigger). Newly firing traps
  // mark themselves fired, apply their initial effect, and record their id.
  const justFired = new Set<string>();
  for (const kind of TRIGGER_ORDER) {
    for (const trap of traps) {
      if (!trap.armed || trap.fired) continue;
      if (trap.trigger.kind !== kind) continue;
      if (trap.evaluate(world, step)) {
        trap.fired = true;
        trap.apply(world);
        world.firedTrapIds.push(trap.id);
        justFired.add(trap.id);
      }
    }
  }

  // Phase 2: Animation pass. Many traps (emerging-spikes, vanishing-floor,
  // crusher, shifting-wall, fake-exit) have multi-step internal state
  // machines in apply() that must be advanced every step after the initial
  // trigger: spikes gradually extend, floors count down then vanish,
  // crushers descend, walls slide, exits slide. Calling apply() on every
  // fired trap each step drives those animations forward. This does NOT
  // re-evaluate the trigger or re-record the id in firedTrapIds --- a trap
  // fires exactly once per arm cycle (preserving the contract tested in
  // runtime.test.ts "only fires each trap once per arm cycle"). Traps that
  // just fired in Phase 1 already had apply() called once this step, so
  // they are skipped here to avoid a double-application.
  for (const trap of traps) {
    if (trap.armed && trap.fired && !justFired.has(trap.id)) {
      trap.apply(world);
    }
  }

  for (const trap of traps) {
    if (trap.armed) {
      trap.stepsSinceArm++;
    }
  }

  return runtime;
}

/**
 * Resets every trap to its initial armed state and rebuilds the world from
 * the original level data. Called on respawn so a death/restore puts every
 * trap back exactly where it started.
 */
export function resetTraps(runtime: TrapRuntime, body: Body): TrapRuntime {
  for (const trap of runtime.traps) {
    trap.reset();
  }

  const grid = levelToGrid(runtime.level);
  runtime.world.tiles = [...grid.tiles];
  runtime.world.cols = grid.cols;
  runtime.world.rows = grid.rows;
  runtime.world.hazards = collectHazards(runtime.level);
  runtime.world.dynamicSolids = [];
  runtime.world.playerBody = body;
  runtime.world.playerPrevGrounded = false;
  runtime.world.exitReached = false;
  runtime.world.exitPos = { ...runtime.level.exit };
  runtime.world.firedTrapIds = [];

  return runtime;
}
