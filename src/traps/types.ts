// Core types for the trap system. No logic lives here; this module is the
// vocabulary the registry, runtime, and concrete trap packages speak.
//
// Dependency direction: src/traps/ sits above src/engine/ and src/levels/
// and may import from both. Neither engine nor levels may import from traps.

import type { AABB, Body } from '../engine/physics';
import type { HazardRect } from '../engine/levelAdapter';
import type { TilePosition, TrapEntry } from '../levels/types';

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

// Trigger types evaluated in FIXED ORDER each step:
// 1. on-land: player just landed (grounded transition false->true) in a region
// 2. on-enter: player entered a rectangular region
// 3. on-approach: player within N pixels of a point/region
// 4. on-timer: N steps elapsed since level start or since last armed
// 5. on-exit-reached: player reached the exit
// 6. on-trap-fired: another trap in the same level just fired
export type TriggerKind =
  | 'on-land'
  | 'on-enter'
  | 'on-approach'
  | 'on-timer'
  | 'on-exit-reached'
  | 'on-trap-fired';

export interface TriggerContext {
  readonly kind: TriggerKind;
  readonly region?: AABB;       // for on-land, on-enter, on-approach
  readonly distance?: number;    // for on-approach (pixels)
  readonly delaySteps?: number; // for on-timer
}

// ---------------------------------------------------------------------------
// Mutable world state
// ---------------------------------------------------------------------------

/**
 * The mutable game-world state traps operate on. Derived from the immutable
 * LevelData at runtime construction and rebuilt on reset. Traps mutate this
 * freely (vanish tiles, add hazards, spawn dynamic solids, etc.) while the
 * level data stays untouched.
 */
export interface WorldState {
  tiles: number[];               // mutable copy of the physics grid tiles
  cols: number;
  rows: number;
  hazards: HazardRect[];         // mutable, traps can add
  dynamicSolids: DynamicSolid[]; // mutable, traps can add (crushers, walls)
  playerBody: Body;
  playerPrevGrounded: boolean;
  exitReached: boolean;
  firedTrapIds: string[];        // traps that fired this step (cleared each step)
}

export interface DynamicSolid {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  velocityX: number;
  velocityY: number;
  solid: boolean;                // false = passable (vanished), true = solid
  lethal: boolean;               // true = kills on contact
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

// Discriminated union describing what a trap does when triggered. Concrete
// trap packages consume these to decide how to mutate the world, though a
// trap instance may also mutate the world directly in its apply() method.
export type TrapEffect =
  | { kind: 'vanish-tiles'; tiles: TilePosition[] }
  | { kind: 'add-hazard'; rect: HazardRect }
  | { kind: 'add-dynamic-solid'; solid: DynamicSolid }
  | { kind: 'remove-dynamic-solid'; id: string }
  | { kind: 'kill-player' }
  | { kind: 'move-exit'; position: TilePosition };

// ---------------------------------------------------------------------------
// Trap instances and factories
// ---------------------------------------------------------------------------

/**
 * A trap instance: created from a TrapEntry by a registered factory. The
 * runtime calls evaluate() each step (in trigger-kind order); if it returns
 * true the trap fires (marking fired=true and calling apply()). reset()
 * restores the initial armed state for respawn.
 *
 * Implementations MUST be deterministic: no Math.random, no Date.now, no
 * wall-clock dependencies. Same world state + same step => same result.
 */
export interface TrapInstance {
  readonly id: string;
  readonly type: string;
  readonly trigger: TriggerContext;
  armed: boolean;
  fired: boolean;
  stepsSinceArm: number;
  // Evaluate whether this trap should fire this step.
  evaluate(world: WorldState, step: number): boolean;
  // Apply the trap's effect to the world.
  apply(world: WorldState): void;
  // Reset to initial armed state (called on respawn).
  reset(): void;
}

/**
 * Factory: creates a TrapInstance from a TrapEntry. Registered with the
 * global registry by concrete trap packages.
 */
export type TrapFactory = (entry: TrapEntry) => TrapInstance;
