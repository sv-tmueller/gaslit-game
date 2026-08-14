import { aabbOverlap, type AABB, type TileGrid } from '../engine/physics';
import {
  createControllerState,
  stepController,
  type ControllerActions,
  type ControllerState,
} from '../engine/controller';
import {
  collectHazards,
  levelToGrid,
  overlapsHazard,
  type HazardRect,
} from '../engine/levelAdapter';
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
  readonly grid: TileGrid;
  readonly hazards: readonly HazardRect[];
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

function loadSeqLevel(seq: LevelSequence): {
  level: LevelData;
  grid: TileGrid;
  hazards: readonly HazardRect[];
} {
  const level = currentLevel(seq);
  return { level, grid: levelToGrid(level), hazards: collectHazards(level) };
}

function freshController(level: LevelData): ControllerState {
  return createControllerState(spawnToBody(level.spawn, PLAYER_HEIGHT));
}

export function createScene(
  sources: readonly LevelSource[],
  callbacks?: SceneCallbacks,
): SceneState {
  const sequence = createSequence(sources);
  const { level, grid, hazards } = loadSeqLevel(sequence);

  const state: SceneState = {
    phase: 'playing',
    controller: freshController(level),
    level,
    grid,
    hazards,
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

  // 2. Step the controller.
  const ctrlActions: ControllerActions = {
    left: actions.left,
    right: actions.right,
    jumpPressed: actions.jumpPressed,
    jumpHeld: actions.jumpHeld,
  };
  const controller = stepController(state.controller, ctrlActions, state.grid, dt);

  // 3. Hazard check (death wins over exit if both occur in the same step).
  if (overlapsHazard(controller.body, state.hazards)) {
    const next: SceneState = {
      ...state,
      controller,
      phase: 'dying',
      timer: DEATH_FREEZE_STEPS,
      deathsThisLevel: state.deathsThisLevel + 1,
      deathsTotal: state.deathsTotal + 1,
    };
    transferCallbacks(state, next);
    return next;
  }

  // 4. Exit check.
  if (aabbOverlap(controller.body, exitAABB(state.level.exit))) {
    fireOnLevelComplete(state);
    const next: SceneState = {
      ...state,
      controller,
      phase: 'entering',
      timer: EXIT_BEAT_STEPS,
    };
    transferCallbacks(state, next);
    return next;
  }

  // 5. Normal stepped state.
  const next: SceneState = { ...state, controller };
  transferCallbacks(state, next);
  return next;
}

function stepDying(state: SceneState): SceneState {
  if (state.timer > 0) {
    const next: SceneState = { ...state, timer: state.timer - 1 };
    transferCallbacks(state, next);
    return next;
  }

  // Timer reached 0: respawn with a factory-fresh controller.
  const next: SceneState = {
    ...state,
    controller: freshController(state.level),
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
    const { level, grid, hazards } = loadSeqLevel(nextSeq);
    const next: SceneState = {
      ...state,
      controller: freshController(level),
      level,
      grid,
      hazards,
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
