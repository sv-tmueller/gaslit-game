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

// Register every concrete trap factory once at module load so createRuntime
// can resolve any trap type a level declares.
registerAllTrapTypes();

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
 * for it. The runtime owns the mutable tile grid and hazard list.
 */
function loadSeqLevel(seq: LevelSequence, body: Body): {
  level: LevelData;
  runtime: TrapRuntime;
} {
  const level = currentLevel(seq);
  const runtime = createRuntime(level, body);
  return { level, runtime };
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
  const { level, runtime } = loadSeqLevel(sequence, controller.body);

  const state: SceneState = {
    phase: 'playing',
    controller,
    level,
    runtime,
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

  // 2. Step the controller using the runtime's mutable tile grid so trap-
  //    induced tile changes (vanishing floors, shifting walls) are felt by
  //    the physics solver immediately.
  const ctrlActions: ControllerActions = {
    left: actions.left,
    right: actions.right,
    jumpPressed: actions.jumpPressed,
    jumpHeld: actions.jumpHeld,
  };
  const grid: TileGrid = {
    cols: state.runtime.world.cols,
    rows: state.runtime.world.rows,
    tiles: state.runtime.world.tiles as unknown as readonly Tile[],
  };
  const controller = stepController(state.controller, ctrlActions, grid, dt);

  // 3. Advance the trap system: feed it the post-move body so triggers
  //    (on-enter, on-approach, on-land) evaluate against the new position.
  //    Traps mutate the runtime's world in place (adding hazards, vanishing
  //    tiles, spawning dynamic solids).
  const step = state.step + 1;
  const prevGrounded = state.controller.body.grounded;
  stepTraps(
    state.runtime,
    controller.body,
    prevGrounded,
    false,
    step,
  );

  // 4. Hazard check (death wins over exit if both occur in the same step).
  //    Uses the runtime's hazard list, which includes trap-added hazards.
  if (overlapsHazard(controller.body, state.runtime.world.hazards)) {
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

  // 5. Exit check.
  if (aabbOverlap(controller.body, exitAABB(state.level.exit))) {
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

  // 6. Normal stepped state.
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
  // traps. resetTraps rebuilds the world (tiles, hazards, dynamic solids)
  // from the original level data so every trap starts exactly where it began.
  const controller = freshController(state.level);
  resetTraps(state.runtime, controller.body);
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
    const { level, runtime } = loadSeqLevel(nextSeq, controller.body);
    const next: SceneState = {
      ...state,
      controller,
      level,
      runtime,
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
