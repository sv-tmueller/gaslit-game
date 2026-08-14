// Trap #18: The exit door that moves, or was never a door.
//
// When the player approaches within triggerDist pixels of the exit, the
// exit position starts sliding toward an escape target at speed pixels
// per step. The scene's exit-reached check must consult the WORLD'S
// mutable exitPos (which this trap modifies), not the static level.exit.
//
// The trap re-arms on respawn: the exit snaps back to its original
// position and the escape starts fresh on the next approach.

import type { TrapEntry } from '../../levels/types';
import { buildTriggerContext, reqNumber } from './helpers';
import type { TrapFactory, TrapInstance, WorldState } from '../types';

const TILE_SIZE = 16;

interface FakeExitState {
  escaping: boolean;
  escaped: boolean;
  currentCol: number; // pixel / TILE_SIZE, may be fractional mid-slide
  currentRow: number;
}

function createState(
  startCol: number,
  startRow: number,
): FakeExitState {
  return {
    escaping: false,
    escaped: false,
    currentCol: startCol,
    currentRow: startRow,
  };
}

export const createFakeExit: TrapFactory = (entry: TrapEntry): TrapInstance => {
  const trigger = buildTriggerContext(entry.trigger, entry.params);
  const escapeCol = reqNumber(entry.params, 'escapeCol');
  const escapeRow = reqNumber(entry.params, 'escapeRow');
  const triggerDist = reqNumber(entry.params, 'triggerDist');
  const speed = reqNumber(entry.params, 'speed');

  // Capture the original exit position from the trigger's region or the
  // params. The runtime initializes world.exitPos from level.exit, so the
  // trap reads its starting position from the world on first evaluate.
  let state: FakeExitState | null = null;

  function ensureState(world: WorldState): FakeExitState {
    if (state === null) {
      state = createState(world.exitPos.col, world.exitPos.row);
    }
    return state;
  }

  return {
    id: entry.id,
    type: entry.type,
    trigger,
    armed: true,
    fired: false,
    stepsSinceArm: 0,

    evaluate(world: WorldState, _step: number): boolean {
      void _step;
      const st = ensureState(world);

      // Already escaped: nothing more to do.
      if (st.escaped) return false;

      // If already escaping, keep firing each step to continue the slide.
      if (st.escaping) return true;

      // on-approach: check distance from player center to exit center.
      const exitPx = st.currentCol * TILE_SIZE + TILE_SIZE / 2;
      const exitPy = st.currentRow * TILE_SIZE + TILE_SIZE / 2;
      const playerCx = world.playerBody.x + world.playerBody.width / 2;
      const playerCy = world.playerBody.y + world.playerBody.height / 2;
      const dx = playerCx - exitPx;
      const dy = playerCy - exitPy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      return dist < triggerDist;
    },

    apply(world: WorldState): void {
      const st = ensureState(world);

      if (!st.escaping) {
        st.escaping = true;
      }

      // Move currentCol/currentRow toward escape target by speed pixels.
      const targetPx = escapeCol * TILE_SIZE;
      const targetPy = escapeRow * TILE_SIZE;
      const curPx = st.currentCol * TILE_SIZE;
      const curPy = st.currentRow * TILE_SIZE;
      const dx = targetPx - curPx;
      const dy = targetPy - curPy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= speed) {
        // Arrived at escape target.
        st.currentCol = escapeCol;
        st.currentRow = escapeRow;
        st.escaped = true;
      } else {
        const ratio = speed / dist;
        st.currentCol = (curPx + dx * ratio) / TILE_SIZE;
        st.currentRow = (curPy + dy * ratio) / TILE_SIZE;
      }

      // Update the world's mutable exit position to the nearest tile.
      world.exitPos = {
        col: Math.round(st.currentCol),
        row: Math.round(st.currentRow),
      };
    },

    reset(): void {
      state = null;
      this.armed = true;
      this.fired = false;
      this.stepsSinceArm = 0;
    },
  };
};
