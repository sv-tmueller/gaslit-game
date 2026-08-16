// Title screen state and render model builder.
// Pure data: produces a RenderModel, never draws directly.

import type { InputSnapshot } from '../engine/input';
import type { PaletteToken } from '../render/palette';
import type { AtlasFrameName } from '../render/atlas';
import type { DrawSprite, FillRect, RenderModel } from '../render/model';

export interface TitleState {
  readonly showInstructions: boolean;
  readonly selectedOption: number;
  readonly flashTimer: number;
}

export function createTitleState(): TitleState {
  return { showInstructions: false, selectedOption: 0, flashTimer: 0 };
}

export function stepTitle(state: TitleState, input: InputSnapshot, dt: number): TitleState {
  void dt;
  let { showInstructions, selectedOption, flashTimer } = state;

  if (input.pressed.right) {
    selectedOption = (selectedOption + 1) % 2;
  }
  if (input.pressed.left) {
    selectedOption = (selectedOption - 1 + 2) % 2;
  }

  if (input.pressed.jump) {
    if (selectedOption === 0) {
      // Start selected
    } else {
      showInstructions = !showInstructions;
    }
  }

  flashTimer = (flashTimer + 1) % 60;

  return { showInstructions, selectedOption, flashTimer };
}

export function getTitleTransition(state: TitleState, input: InputSnapshot): 'start' | 'how-to-play' | null {
  if (!input.pressed.jump) return null;
  return state.selectedOption === 0 ? 'start' : 'how-to-play';
}

export function buildTitleModel(state: TitleState): RenderModel {
  const sprites: DrawSprite[] = [];
  const rects: FillRect[] = [];

  sprites.push({
    frame: 'title.mark' as AtlasFrameName,
    dstX: 152,
    dstY: 40,
    flipX: false,
  });

  if (state.flashTimer < 30) {
    rects.push({ x: 100, y: 100, w: 120, h: 8, color: 'bone' as PaletteToken });
  }

  const startY = 120;
  rects.push({
    x: 90,
    y: startY + state.selectedOption * 16,
    w: 4,
    h: 8,
    color: 'bone' as PaletteToken,
  });

  if (state.showInstructions) {
    rects.push({ x: 60, y: 140, w: 200, h: 2, color: 'edge' as PaletteToken });
  }

  return {
    clear: 'void',
    layers: [
      { kind: 'world', sprites, rects, texts: [] },
      { kind: 'entities', sprites: [], rects: [], texts: [] },
      { kind: 'effects', sprites: [], rects: [], texts: [] },
    ],
  };
}
