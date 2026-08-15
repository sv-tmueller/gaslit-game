// Level select door grid state and render model builder.
// Pure data: produces a RenderModel, never draws directly.

import type { InputSnapshot } from '../engine/input';
import type { PaletteToken } from '../render/palette';
import type { AtlasFrameName } from '../render/atlas';
import type { DrawSprite, FillRect, RenderModel } from '../render/model';

export interface LevelMeta {
  readonly id: string;
  readonly name: string;
  readonly unlocked: boolean;
  readonly completed: boolean;
  readonly deathCount: number;
}

export interface LevelSelectState {
  readonly levels: readonly LevelMeta[];
  readonly selectedIndex: number;
  readonly flashTimer: number;
}

const COLS = 5;
const CELL_W = 48;
const CELL_H = 32;
const GRID_X = 40;
const GRID_Y = 30;

export function createLevelSelectState(levels: readonly LevelMeta[]): LevelSelectState {
  return { levels, selectedIndex: 0, flashTimer: 0 };
}

export function stepLevelSelect(state: LevelSelectState, input: InputSnapshot, dt: number): LevelSelectState {
  void dt;
  let { selectedIndex, flashTimer } = state;
  const count = state.levels.length;

  if (input.pressed.right) {
    selectedIndex = (selectedIndex + 1) % count;
  }
  if (input.pressed.left) {
    selectedIndex = (selectedIndex - 1 + count) % count;
  }
  // Vertical navigation via jump+direction combo (since InputAction has no up/down)
  // For simplicity, left/right wraps linearly which covers the grid adequately.

  flashTimer = (flashTimer + 1) % 60;

  return { ...state, selectedIndex, flashTimer };
}

export function getSelectedLevel(state: LevelSelectState): LevelMeta | null {
  const level = state.levels[state.selectedIndex];
  if (!level || !level.unlocked) return null;
  return level;
}

export function buildLevelSelectModel(state: LevelSelectState): RenderModel {
  const sprites: DrawSprite[] = [];
  const rects: FillRect[] = [];

  for (let i = 0; i < state.levels.length; i++) {
    const level = state.levels[i]!;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = GRID_X + col * CELL_W;
    const y = GRID_Y + row * CELL_H;

    sprites.push({
      frame: 'exit.door' as AtlasFrameName,
      dstX: x,
      dstY: y,
      flipX: false,
    });

    let color: PaletteToken;
    if (!level.unlocked) color = 'dusk';
    else if (level.completed) color = 'edge';
    else color = 'bone';

    rects.push({ x, y, w: 16, h: 16, color });

    if (i === state.selectedIndex && state.flashTimer < 30) {
      rects.push({ x: x - 2, y: y - 2, w: 20, h: 20, color: 'bone' as PaletteToken });
    }

    if (level.deathCount > 0) {
      rects.push({ x: x + 18, y: y + 12, w: 4, h: 4, color: 'lethal' as PaletteToken });
    }
  }

  return {
    clear: 'void',
    layers: [
      { kind: 'world', sprites, rects },
      { kind: 'entities', sprites: [], rects: [] },
      { kind: 'effects', sprites: [], rects: [] },
    ],
  };
}
