// Top-level render entry point: composes the render model from a
// RenderContext + alpha, then delegates to flushModel. This is the only
// function a game loop needs to call each frame.

import type { LoadedAtlas } from './atlas-loader';
import { flushModel, type BlitContext } from './batcher';
import type { Camera } from './camera';
import { buildRenderModel, type EntitySnapshot, type RenderWorld } from './model';

export type { EntitySnapshot, RenderWorld };

export interface RenderContext {
  readonly atlas: LoadedAtlas;
  readonly world: RenderWorld;
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
    rc.world,
    rc.camera,
    rc.entities,
    rc.prevEntities,
    alpha,
    rc.atlas,
  );
  flushModel(ctx, model, rc.atlas);
}
