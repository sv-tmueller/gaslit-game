// Top-level render entry point: composes the render model from a
// RenderContext + alpha, then delegates to flushModel. This is the only
// function a game loop needs to call each frame.

import type { LoadedAtlas } from './atlas-loader';
import { flushModel, type BlitContext } from './batcher';
import type { Camera } from './camera';
import { buildRenderModel, type EntitySnapshot } from './model';
import type { LevelData } from '../levels/types';

export type { EntitySnapshot };

export interface RenderContext {
  readonly atlas: LoadedAtlas;
  readonly level: LevelData;
  readonly camera: Camera;
  readonly entities: readonly EntitySnapshot[];
  readonly prevEntities: readonly EntitySnapshot[];
}

export function renderFrame(
  ctx: BlitContext,
  rc: RenderContext,
  alpha: number,
): void {
  const model = buildRenderModel(
    rc.level,
    rc.camera,
    rc.entities,
    rc.prevEntities,
    alpha,
    rc.atlas,
  );
  flushModel(ctx, model, rc.atlas);
}
