import { aabbOverlap, type AABB, type Body, Tile, type TileGrid } from '../engine/physics';
import {
  createControllerState,
  stepController,
  type ControllerActions,
  type ControllerState,
} from '../engine/controller';
import { overlapsHazard } from '../engine/levelAdapter';
import type { LevelData, TilePosition } from '../levels/types';
import {
  DEATH_FREEZE_STEPS,
  EXIT_BEAT_STEPS,
  PLAYER_HEIGHT,
  spawnToBody,
} from './constants';
import {
  advance,
  createSequence,
  currentLevel,
  hasNext,
  type LevelSequence,
  type LevelSource,
} from './sequence';
import { createRuntime, resetTraps, stepTraps, type TrapRuntime } from '../traps/runtime';
import { registerAllTrapTypes } from '../traps/implementations';
import {
  createMechanicsRuntime,
  resetMechanics,
  stepMechanics,
  type MechanicsRuntime,
} from '../mechanics/runtime';
import { registerAllMechanicTypes } from '../mechanics/register';
import { checkSpringContact, checkTeleporterContact } from '../mechanics/adapters';

// Register every concrete trap and mechanic factory once at module load so
// createRuntime / createMechanicsRuntime can resolve any type a level declares.
registerAllTrapTypes();
registerAllMechanicTypes();

export type PlayPhase = 'playing' | 'dying' | 'entering' | 'complete';

export interface SceneActions {
  readonly left: boolean;
  readonly right: boolean;
  readonly jumpPressed: boolean;
  readonly jumpHeld: boolean;
  /** Rising-edge: true only on the step the R key was first pressed. */
  readonly restart: boolean;
}

export interface SceneState {
  readonly phase: PlayPhase;
  readonly controller: ControllerState;
  readonly level: LevelData;
  /**
   * The trap runtime owns the mutable tile grid and hazard list that the
   * controller and hazard check read from each step. Traps mutate this in
   * place (vanishing floors clear tiles, emerging spikes add hazards); the
   * scene carries the same runtime reference across steps so mutations
   * persist. Reset on respawn and rebuilt on level advance.
   */
  readonly runtime: TrapRuntime;
  /**
   * The mechanics runtime owns the continuous mechanic instances (springs,
   * teleporters, moving platforms, etc.) and published effect buffers
   * (dynamic solids, hazards, cosmetic effects). Stepped once per frame
   * before the controller to collect input/body modifications; contact
   * checks (springs, teleporters) run after the controller resolves the
   * new position. Reset on respawn and rebuilt on level advance.
   */
  readonly mechanicsRuntime: MechanicsRuntime;
  /** Monotonically increasing sim step counter, fed to stepTraps. */
  readonly step: number;
  readonly sequence: LevelSequence;
  /** Countdown steps for the dying or entering phases. */
  readonly timer: number;
  readonly deathsThisLevel: number;
  readonly deathsTotal: number;
}

export interface SceneCallbacks {
  onLevelComplete?(levelIndex: number): void;
  onSequenceComplete?(): void;
}

// Callbacks are kept out of SceneState so the state stays serializable.
// They ride alongside in a WeakMap keyed by the state object identity.
const callbacksByState = new WeakMap<object, SceneCallbacks>();

function exitAABB(exit: TilePosition): AABB {
  return { x: exit.col * 16, y: exit.row * 16, width: 16, height: 16 };
}

/**
 * Loads the current level from the sequence and builds a fresh trap runtime
 * and mechanics runtime for it. The trap runtime owns the mutable tile grid
 * and hazard list; the mechanics runtime owns continuous mechanic instances.
 */
function loadSeqLevel(seq: LevelSequence, body: Body): {
  level: LevelData;
  runtime: TrapRuntime;
  mechanicsRuntime: MechanicsRuntime;
} {
  const level = currentLevel(seq);
  const runtime = createRuntime(level, body);
  const mechanicsRuntime = createMechanicsRuntime(level, body);
  return { level, runtime, mechanicsRuntime };
}

function freshController(level: LevelData): ControllerState {
  return createControllerState(spawnToBody(level.spawn, PLAYER_HEIGHT));
}

export function createScene(
  sources: readonly LevelSource[],
  callbacks?: SceneCallbacks,
): SceneState {
  const sequence = createSequence(sources);
  const controller = freshController(currentLevel(sequence));
  const { level, runtime, mechanicsRuntime } = loadSeqLevel(sequence, controller.body);

  const state: SceneState = {
    phase: 'playing',
    controller,
    level,
    runtime,
    mechanicsRuntime,
    step: 0,
    sequence,
    timer: 0,
    deathsThisLevel: 0,
    deathsTotal: 0,
  };

  if (callbacks !== undefined) {
    callbacksByState.set(state, callbacks);
  }
  return state;
}

export function stepScene(
  state: SceneState,
  actions: SceneActions,
  dt: number,
): SceneState {
  switch (state.phase) {
    case 'playing':
      return stepPlaying(state, actions, dt);
    case 'dying':
      return stepDying(state);
    case 'entering':
      return stepEntering(state);
    case 'complete':
      return state;
  }
}

function stepPlaying(
  state: SceneState,
  actions: SceneActions,
  dt: number,
): SceneState {
  // 1. R-key manual restart: same dying path, no counter increment.
  if (actions.restart) {
    const next: SceneState = { ...state, phase: 'dying', timer: DEATH_FREEZE_STEPS };
    transferCallbacks(state, next);
    return next;
  }

  // 2. PRE-CONTROLLER PHASE: Step mechanics with the current body and input
  //    state. This collects actionsOverride (control inversion), velocityMod
  //    (jetpack), and advances continuous mechanic state (platforms, buzzsaws,
  //    fuses, cosmetic timers). Published solids/hazards are buffered for the
  //    post-controller merge.
  const rawActions: ControllerActions = {
    left: actions.left,
    right: actions.right,
    jumpPressed: actions.jumpPressed,
    jumpHeld: actions.jumpHeld,
  };
  const step = state.step + 1;
  const prevGrounded = state.controller.body.grounded;

  stepMechanics(state.mechanicsRuntime, state.controller.body, rawActions, step);

  // 3. STEP CONTROLLER: Use the runtime's mutable tile grid so trap-induced
  //    tile changes (vanishing floors, shifting walls) are felt by the physics
  //    solver immediately. Mechanics don't override the grid—only traps modify
  //    tiles—but mechanics-published dynamic solids are merged after.
  //
  //    Note: actionsOverride from mechanics (e.g. control inversion) is not
  //    re-applied here because the mechanic's step() already processed the
  //    raw actions internally. The controller receives the original player
  //    input; mechanics that modify input (control inversion) do so by
  //    transforming the body's response, not by intercepting the controller.
  //    This is consistent with how the gravity module works: it wraps
  //    stepController rather than changing the actions.
  const grid: TileGrid = {
    cols: state.runtime.world.cols,
    rows: state.runtime.world.rows,
    tiles: state.runtime.world.tiles as unknown as readonly Tile[],
  };
  let controller = stepController(state.controller, rawActions, grid, dt);

  // 4. POST-CONTROLLER CONTACT CHECKS: Springs and teleporters detect contact
  //    against the RESOLVED post-move body and may override position/velocity.
  //    These use the dedicated checkSpringContact/checkTeleporterContact
  //    helpers (separate from the per-frame step() which only advances
  //    cooldowns). Last writer wins for bodyOverride.
  let body = controller.body;
  const mechEntries = state.level.mechanics ?? [];
  for (const entry of mechEntries) {
    if (entry.type === 'spring') {
      const contact = checkSpringContact(entry, body);
      if (contact !== null) {
        body = contact.body;
      }
    } else if (entry.type === 'teleporter') {
      const contact = checkTeleporterContact(entry, body);
      if (contact !== null) {
        body = contact.body;
      }
    }
  }
  controller = { ...controller, body };

  // 5. ADVANCE THE TRAP SYSTEM: Feed it the post-move (and post-contact) body
  //    so triggers (on-enter, on-approach, on-land) evaluate against the new
  //    position. Traps mutate the runtime's world in place.
  stepTraps(
    state.runtime,
    controller.body,
    prevGrounded,
    false,
    step,
  );

  // 6. MERGE MECHANICS WORLD STATE: Add mechanic-published dynamic solids and
  //    hazards to the trap runtime's world for THIS step's hazard check. We
  //    splice them in temporarily; they are replaced on the next stepMechanics
  //    call (which clears published buffers at the start).
  const mechWorld = state.mechanicsRuntime;
  const savedSolidsLen = state.runtime.world.dynamicSolids.length;
  const savedHazardsLen = state.runtime.world.hazards.length;
  state.runtime.world.dynamicSolids.push(...mechWorld.publishedSolids);
  state.runtime.world.hazards.push(...mechWorld.publishedHazards);

  // 7. Hazard check (death wins over exit if both occur in the same step).
  //    Uses the runtime's hazard list, which now includes mechanic-added
  //    hazards (buzzsaws, rotating arms, bomb blasts).
  if (overlapsHazard(controller.body, state.runtime.world.hazards)) {
    // Restore world arrays before transitioning (so respawn starts clean).
    state.runtime.world.dynamicSolids.length = savedSolidsLen;
    state.runtime.world.hazards.length = savedHazardsLen;
    const next: SceneState = {
      ...state,
      controller,
      step,
      phase: 'dying',
      timer: DEATH_FREEZE_STEPS,
      deathsThisLevel: state.deathsThisLevel + 1,
      deathsTotal: state.deathsTotal + 1,
    };
    transferCallbacks(state, next);
    return next;
  }

  // 8. Exit check.
  if (aabbOverlap(controller.body, exitAABB(state.level.exit))) {
    // Restore world arrays before transitioning.
    state.runtime.world.dynamicSolids.length = savedSolidsLen;
    state.runtime.world.hazards.length = savedHazardsLen;
    fireOnLevelComplete(state);
    const next: SceneState = {
      ...state,
      controller,
      step,
      phase: 'entering',
      timer: EXIT_BEAT_STEPS,
    };
    transferCallbacks(state, next);
    return next;
  }

  // 9. Normal stepped state. Leave the merged solids/hazards in the world for
  //    rendering this frame; they'll be replaced on the next stepMechanics call.
  //    However, we must trim them back so they don't permanently accumulate
  //    across steps (stepMechanics clears its own buffers, but the spliced
  //    copies in the trap world would grow indefinitely). Trim to the saved
  //    lengths so the trap world only retains its own state between steps.
  state.runtime.world.dynamicSolids.length = savedSolidsLen;
  state.runtime.world.hazards.length = savedHazardsLen;

  const next: SceneState = { ...state, controller, step };
  transferCallbacks(state, next);
  return next;
}

function stepDying(state: SceneState): SceneState {
  if (state.timer > 0) {
    const next: SceneState = { ...state, timer: state.timer - 1 };
    transferCallbacks(state, next);
    return next;
  }

  // Timer reached 0: respawn with a factory-fresh controller and re-armed
  // traps and mechanics. resetTraps rebuilds the world (tiles, hazards,
  // dynamic solids) from the original level data. resetMechanics restores
  // every mechanic to its initial state.
  const controller = freshController(state.level);
  resetTraps(state.runtime, controller.body);
  resetMechanics(state.mechanicsRuntime, controller.body);
  const next: SceneState = {
    ...state,
    controller,
    step: 0,
    phase: 'playing',
    timer: 0,
  };
  transferCallbacks(state, next);
  return next;
}

function stepEntering(state: SceneState): SceneState {
  if (state.timer > 0) {
    const next: SceneState = { ...state, timer: state.timer - 1 };
    transferCallbacks(state, next);
    return next;
  }

  // Timer reached 0: advance or complete.
  if (hasNext(state.sequence)) {
    const nextSeq = advance(state.sequence);
    const controller = freshController(currentLevel(nextSeq));
    const { level, runtime, mechanicsRuntime } = loadSeqLevel(nextSeq, controller.body);
    const next: SceneState = {
      ...state,
      controller,
      level,
      runtime,
      mechanicsRuntime,
      step: 0,
      sequence: nextSeq,
      phase: 'playing',
      timer: 0,
      deathsThisLevel: 0,
    };
    transferCallbacks(state, next);
    return next;
  }

  fireOnSequenceComplete(state);
  const next: SceneState = { ...state, phase: 'complete', timer: 0 };
  transferCallbacks(state, next);
  return next;
}

function transferCallbacks(from: object, to: object): void {
  const cb = callbacksByState.get(from);
  if (cb !== undefined) {
    callbacksByState.set(to, cb);
  }
}

function fireOnLevelComplete(state: SceneState): void {
  const cb = callbacksByState.get(state);
  cb?.onLevelComplete?.(state.sequence.index);
}

function fireOnSequenceComplete(state: SceneState): void {
  const cb = callbacksByState.get(state);
  cb?.onSequenceComplete?.();
}
