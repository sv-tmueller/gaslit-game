// Core types for the mechanic system. No logic lives here; this module is the
// vocabulary the registry, runtime, and concrete mechanic adapters speak.
//
// Unlike traps (which evaluate→fire→apply once per arm cycle), mechanics are
// CONTINUOUS: they step every frame and optionally emit effects that the
// runtime collects and applies in a deterministic order.
//
// Dependency direction: src/mechanics/ sits above src/engine/ and src/levels/
// and may import from both. Neither engine nor levels may import from mechanics.

import type { Body } from '../engine/physics';
import type { ControllerActions } from '../engine/controller';
import type { HazardRect } from '../engine/levelAdapter';
import type { DynamicSolid } from '../traps/types';

// ---------------------------------------------------------------------------
// Context passed to every mechanic each step
// ---------------------------------------------------------------------------

/**
 * Snapshot of player body + input state available to every mechanic each
 * step. The runtime constructs this before calling `.step()`.
 */
export interface MechanicContext {
  readonly body: Body;
  readonly actions: ControllerActions;
  readonly step: number;
}

// ---------------------------------------------------------------------------
// Result emitted by a mechanic each step
// ---------------------------------------------------------------------------

/**
 * What a mechanic wants the runtime to apply after stepping. All fields are
 * optional—a mechanic that has no effect this frame returns `{}`.
 *
 * Merge semantics (handled by the runtime):
 *  - `bodyOverride`: last writer wins (teleporter overrides spring).
 *  - `velocityMod`: accumulated additively across mechanics.
 *  - `actionsOverride`: last writer wins (typically only one input modifier).
 *  - `dynamicSolids` / `hazardsToAdd`: concatenated into the published arrays.
 *  - `cosmeticState`: stored for the renderer; does not affect physics.
 */
export interface MechanicStepResult {
  readonly bodyOverride?: Body;
  readonly velocityMod?: { x?: number; y?: number };
  readonly actionsOverride?: ControllerActions;
  readonly dynamicSolids?: DynamicSolid[];
  readonly hazardsToAdd?: HazardRect[];
  readonly cosmeticState?: CosmeticEffect;
}

// ---------------------------------------------------------------------------
// Cosmetic effects (stored for renderer, no physics impact)
// ---------------------------------------------------------------------------

export interface CosmeticEffect {
  readonly cameraTrolls?: CameraTrollSnapshot[];
  readonly fakeUiStates?: FakeUiSnapshot[];
}

export interface CameraTrollSnapshot {
  readonly kind: string;
  readonly active: boolean;
  readonly zoom: number;
  readonly flipped: boolean;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly lagFrames: number;
}

export interface FakeUiSnapshot {
  readonly kind: string;
  readonly active: boolean;
  readonly timer: number;
}

// ---------------------------------------------------------------------------
// Mechanic instance and factory
// ---------------------------------------------------------------------------

/**
 * A mechanic instance: created from a {@link MechanicEntry} by a registered
 * factory. The runtime calls `step()` EVERY frame (unlike traps which
 * evaluate triggers). `reset()` restores initial state for respawn.
 *
 * Implementations MUST be deterministic: no Math.random, no Date.now, no
 * wall-clock dependencies. Same context + same step => same result.
 */
export interface MechanicInstance {
  readonly id: string;
  readonly type: string;
  step(ctx: MechanicContext): MechanicStepResult;
  reset(): void;
}

/**
 * Factory: creates a {@link MechanicInstance} from a {@link MechanicEntry}.
 * Registered with the global registry by concrete mechanic adapter packages.
 */
export type MechanicFactory = (
  entry: import('../levels/types').MechanicEntry,
) => MechanicInstance;
