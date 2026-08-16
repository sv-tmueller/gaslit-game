import type { InputSnapshot, KeyboardInput } from '../engine/input';
import type { ControllerActions } from '../engine/controller';
import type { Body } from '../engine/physics';
import type { LoadedAtlas } from '../render/atlas-loader';
import type { BlitContext } from '../render/batcher';
import { computeCamera } from '../render/camera';
import { renderFrame, type EntitySnapshot, type RenderWorld } from '../render/renderer';
import {
  createAnimTrack,
  currentFrame,
  stepAnimation,
  type AnimTrack,
} from '../entity/player-animation';
import {
  createScene,
  stepScene,
  type SceneActions,
  type SceneCallbacks,
  type SceneState,
} from './scene';
import type { LevelSource } from './sequence';

export interface GameOptions {
  readonly sources: readonly LevelSource[];
  readonly atlas: LoadedAtlas;
}

export interface GameState {
  readonly scene: SceneState;
  readonly input: KeyboardInput;
  readonly atlas: LoadedAtlas;
  readonly animTrack: AnimTrack;
  readonly prevBody: Body;
  readonly callbacks?: SceneCallbacks;
}

export function inputSnapshotToActions(snapshot: InputSnapshot): ControllerActions {
  return {
    left: snapshot.held.left,
    right: snapshot.held.right,
    jumpPressed: snapshot.pressed.jump,
    jumpHeld: snapshot.held.jump,
  };
}

export function inputSnapshotToSceneActions(snapshot: InputSnapshot): SceneActions {
  return {
    left: snapshot.held.left,
    right: snapshot.held.right,
    jumpPressed: snapshot.pressed.jump,
    jumpHeld: snapshot.held.jump,
    restart: snapshot.pressed.restart,
  };
}

export function createGame(
  opts: GameOptions,
  input: KeyboardInput,
  callbacks?: SceneCallbacks,
): GameState {
  const scene = createScene(opts.sources, callbacks);
  const base: Omit<GameState, 'callbacks'> = {
    scene,
    input,
    atlas: opts.atlas,
    animTrack: createAnimTrack(),
    prevBody: scene.controller.body,
  };
  return callbacks !== undefined ? { ...base, callbacks } : base;
}

export function stepGame(state: GameState, dt: number): GameState {
  const snap = state.input.sample();
  const actions = inputSnapshotToSceneActions(snap);

  // Capture prevBody BEFORE stepping for interpolation.
  const prevBody = state.scene.controller.body;

  const newScene = stepScene(state.scene, actions, dt);

  const body = newScene.controller.body;
  const newTrack = stepAnimation(
    state.animTrack,
    body.grounded,
    body.velocity.x,
    body.velocity.y,
    dt,
  );

  const base: Omit<GameState, 'callbacks'> = {
    scene: newScene,
    input: state.input,
    atlas: state.atlas,
    animTrack: newTrack,
    prevBody,
  };
  return state.callbacks !== undefined
    ? { ...base, callbacks: state.callbacks }
    : base;
}

export function renderGame(state: GameState, ctx: BlitContext, alpha: number): void {
  const body = state.scene.controller.body;
  const level = state.scene.level;

  const centerX = body.x + body.width / 2;
  const centerY = body.y + body.height / 2;
  const camera = computeCamera(centerX, centerY, level.cols * 16, level.rows * 16);

  const frame = currentFrame(state.animTrack);
  const flipX = state.animTrack.facing === -1;

  const currEntity: EntitySnapshot = {
    body: { x: body.x, y: body.y, width: body.width, height: body.height },
    frame,
    flipX,
  };

  const prevBody = state.prevBody;
  const prevEntity: EntitySnapshot = {
    body: {
      x: prevBody.x,
      y: prevBody.y,
      width: prevBody.width,
      height: prevBody.height,
    },
    frame,
    flipX,
  };

  // Build the RenderWorld from the trap runtime's mutable world state,
  // concatenating mechanic-published solids/hazards that persist during
  // rendering (cleared at the START of the next stepMechanics call).
  const scene = state.scene;
  const world: RenderWorld = {
    cols: scene.runtime.world.cols,
    rows: scene.runtime.world.rows,
    tiles: scene.runtime.world.tiles,
    exit: scene.runtime.world.exitPos,
    hazards: [
      ...scene.runtime.world.hazards,
      ...scene.mechanicsRuntime.publishedHazards,
    ],
    dynamicSolids: [
      ...scene.runtime.world.dynamicSolids,
      ...scene.mechanicsRuntime.publishedSolids,
    ],
  };

  renderFrame(ctx, {
    atlas: state.atlas,
    world,
    camera,
    entities: [currEntity],
    prevEntities: [prevEntity],
  }, alpha);
}
