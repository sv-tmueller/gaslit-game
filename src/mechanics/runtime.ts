// Mechanics runtime: owns the array of active MechanicInstances and the
// published effect buffers consumed by the scene each step. Unlike the trap
// runtime (which evaluates triggers and fires once per arm cycle), mechanics
// are CONTINUOUS: every mechanic is stepped every frame and optionally emits
// a MechanicStepResult. The runtime collects all emitted results and merges
// them in a deterministic order.
//
// Determinism contract: given identical (body, actions, step) inputs,
// stepMechanics produces identical published state. No Math.random, no
// Date.now, no wall-clock dependencies anywhere in this module or in
// mechanic implementations.
//
// Merge semantics (per MechanicStepResult):
//   - bodyOverride: last writer wins (teleporter overrides spring).
//   - velocityMod: accumulated additively across mechanics.
//   - actionsOverride: last writer wins (typically only one input modifier).
//   - dynamicSolids / hazardsToAdd: concatenated into the published arrays.
//   - cosmeticState: aggregated into cosmeticEffects for the renderer.

import type { Body } from '../engine/physics';
import type { ControllerActions } from '../engine/controller';
import type { HazardRect } from '../engine/levelAdapter';
import type { LevelData } from '../levels/types';
import type { DynamicSolid } from '../traps/types';
import { createMechanic } from './registry';
import type {
  CosmeticEffect,
  MechanicContext,
  MechanicInstance,
  MechanicStepResult,
} from './types';

export interface MechanicsRuntime {
  readonly level: LevelData;
  mechanics: MechanicInstance[];
  /** Dynamic solids published this step (consumed by scene, cleared each step). */
  publishedSolids: DynamicSolid[];
  /** Hazards published this step (consumed by scene, cleared each step). */
  publishedHazards: HazardRect[];
  /** Aggregated cosmetic effects published this step (for renderer). */
  cosmeticEffects: CosmeticEffect;
}

/**
 * Constructs the mechanics runtime from a level: instantiates every mechanic
 * declared in `level.mechanics` via the registry. Levels without a mechanics
 * field produce an empty (inert) runtime — no behavioural change.
 *
 * Call `registerAllMechanicTypes()` at module load (done in scene.ts) so the
 * registry can resolve every mechanic type a level declares.
 */
export function createMechanicsRuntime(
  level: LevelData,
  _initialBody: Body,
): MechanicsRuntime {
  const entries = level.mechanics ?? [];
  const mechanics = entries.map(createMechanic);

  return {
    level,
    mechanics,
    publishedSolids: [],
    publishedHazards: [],
    cosmeticEffects: { cameraTrolls: [], fakeUiStates: [] },
  };
}

/**
 * Advances the mechanics system one step. Calls `.step(ctx)` on every
 * mechanic in DECLARATION ORDER (fixed = deterministic), collects all
 * MechanicStepResults, and merges them into the published buffers.
 *
 * Clear-before-step semantics: publishedSolids, publishedHazards, and
 * cosmeticEffects are replaced wholesale each step (they represent the
 * current frame's state, not an accumulation across frames).
 *
 * The runtime mutates the runtime object in place and returns the same
 * reference for convenience (mirrors stepTraps).
 */
export function stepMechanics(
  runtime: MechanicsRuntime,
  body: Body,
  actions: ControllerActions,
  step: number,
): MechanicsRuntime {
  // Clear published buffers for this frame.
  runtime.publishedSolids = [];
  runtime.publishedHazards = [];

  const cameraTrolls = [];
  const fakeUiStates = [];

  const ctx: MechanicContext = { body, actions, step };

  for (const mech of runtime.mechanics) {
    const result: MechanicStepResult = mech.step(ctx);

    // Concatenate dynamic solids.
    if (result.dynamicSolids !== undefined && result.dynamicSolids.length > 0) {
      runtime.publishedSolids.push(...result.dynamicSolids);
    }

    // Concatenate hazards.
    if (result.hazardsToAdd !== undefined && result.hazardsToAdd.length > 0) {
      runtime.publishedHazards.push(...result.hazardsToAdd);
    }

    // Aggregate cosmetic snapshots.
    if (result.cosmeticState !== undefined) {
      if (result.cosmeticState.cameraTrolls !== undefined) {
        cameraTrolls.push(...result.cosmeticState.cameraTrolls);
      }
      if (result.cosmeticState.fakeUiStates !== undefined) {
        fakeUiStates.push(...result.cosmeticState.fakeUiStates);
      }
    }
  }

  runtime.cosmeticEffects = { cameraTrolls, fakeUiStates };

  return runtime;
}

/**
 * Resets every mechanic to its initial state for respawn. Does NOT rebuild
 * the mechanic list (same instances, freshly reset). Published buffers are
 * cleared.
 */
export function resetMechanics(
  runtime: MechanicsRuntime,
  _body: Body,
): MechanicsRuntime {
  for (const mech of runtime.mechanics) {
    mech.reset();
  }
  runtime.publishedSolids = [];
  runtime.publishedHazards = [];
  runtime.cosmeticEffects = { cameraTrolls: [], fakeUiStates: [] };
  return runtime;
}
