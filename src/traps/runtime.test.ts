import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Body } from '../engine/physics';
import { TILE_SIZE, Tile as PhysTile } from '../engine/physics';
import { Tile as LvlTile, type LevelData } from '../levels/types';
import type { WorldState } from './types';
import {
  clearRegistry,
  registerTrapType,
} from './registry';
import {
  createRuntime,
  resetTraps,
  stepTraps,
} from './runtime';
import { registerEmergingSpikes } from './implementations/emerging-spikes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal 4x3 level: solid floor on the bottom row, everything else empty.
 * Spawn at (0,0), exit at (3,0). Tiles supplied by caller for flexibility.
 */
function makeLevel(
  overrides: Partial<Pick<LevelData, 'traps' | 'tiles' | 'cols' | 'rows'>> = {},
): LevelData {
  const cols = overrides.cols ?? 4;
  const rows = overrides.rows ?? 3;
  const defaultTiles: LvlTile[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      defaultTiles.push(r === rows - 1 ? LvlTile.Solid : LvlTile.Empty);
    }
  }
  return {
    name: 'trap-test',
    cols,
    rows,
    spawn: { col: 0, row: 0 },
    exit: { col: cols - 1, row: 0 },
    tiles: overrides.tiles ?? defaultTiles,
    traps: overrides.traps ?? [],
  };
}

function makeBody(x = 0, y = 0, grounded = false): Body {
  return {
    x,
    y,
    width: 16,
    height: 16,
    velocity: { x: 0, y: 0 },
    grounded,
  };
}

/**
 * Registers a 'test-timer' trap type that fires after `params.delaySteps`
 * steps have elapsed since arm/reset. On fire it adds a hazard rect at
 * (0,0,16,16) to prove the effect ran.
 */
function registerTestTimer(): void {
  registerTrapType('test-timer', (entry) => {
    const delayRaw = entry.params['delaySteps'];
    const delay = typeof delayRaw === 'number' ? delayRaw : 0;

    return {
      id: entry.id,
      type: entry.type,
      trigger: { kind: 'on-timer', delaySteps: delay },
      armed: true,
      fired: false,
      stepsSinceArm: 0,
      evaluate() {
        return this.stepsSinceArm >= delay;
      },
      apply(world: WorldState) {
        world.hazards.push({ x: 0, y: 0, width: 16, height: 16 });
      },
      reset() {
        this.armed = true;
        this.fired = false;
        this.stepsSinceArm = 0;
      },
    };
  });
}

/**
 * Registers a 'test-kill' trap type that fires on 'on-exit-reached'.
 */
function registerTestKill(): void {
  registerTrapType('test-kill', (entry) => {
    return {
      id: entry.id,
      type: entry.type,
      trigger: { kind: 'on-exit-reached' },
      armed: true,
      fired: false,
      stepsSinceArm: 0,
      evaluate(world: WorldState) {
        return world.exitReached;
      },
      apply(world: WorldState) {
        world.hazards.push({ x: 999, y: 999, width: 16, height: 16 });
      },
      reset() {
        this.armed = true;
        this.fired = false;
        this.stepsSinceArm = 0;
      },
    };
  });
}

beforeEach(() => {
  clearRegistry();
});

afterEach(() => {
  clearRegistry();
});

// ---------------------------------------------------------------------------
// createRuntime
// ---------------------------------------------------------------------------

describe('createRuntime', () => {
  it('builds a world with mutable tiles copied from the level grid', () => {
    registerTestTimer();
    const level = makeLevel();
    const rt = createRuntime(level, makeBody());

    expect(rt.world.cols).toBe(level.cols);
    expect(rt.world.rows).toBe(level.rows);
    expect(rt.world.tiles).toHaveLength(level.cols * level.rows);

    // Floor row should be Solid (1).
    const lastIndex = level.cols * level.rows - 1;
    expect(rt.world.tiles[lastIndex]).toBe(PhysTile.Solid);
  });

  it('instantiates traps from level.traps via the registry', () => {
    registerTestTimer();
    const level = makeLevel({
      traps: [
        { id: 't1', type: 'test-timer', trigger: 'on-timer', params: { delaySteps: 2 } },
      ],
    });
    const rt = createRuntime(level, makeBody());
    expect(rt.traps).toHaveLength(1);
    expect(rt.traps[0]?.id).toBe('t1');
  });

  it('starts with empty dynamicSolids and firedTrapIds', () => {
    registerTestTimer();
    const level = makeLevel({
      traps: [
        { id: 't1', type: 'test-timer', trigger: 'on-timer', params: { delaySteps: 1 } },
      ],
    });
    const rt = createRuntime(level, makeBody());
    expect(rt.world.dynamicSolids).toHaveLength(0);
    expect(rt.world.firedTrapIds).toHaveLength(0);
  });

  it('copies hazards from the level', () => {
    registerTestTimer();
    // Place a hazard tile at col 1, row 0.
    const cols = 4;
    const rows = 3;
    const tiles: LvlTile[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === rows - 1) tiles.push(LvlTile.Solid);
        else if (c === 1 && r === 0) tiles.push(LvlTile.Hazard);
        else tiles.push(LvlTile.Empty);
      }
    }
    const level = makeLevel({ tiles, cols, rows });
    const rt = createRuntime(level, makeBody());
    expect(rt.world.hazards).toHaveLength(1);
    expect(rt.world.hazards[0]).toEqual({
      x: TILE_SIZE,
      y: 0,
      width: TILE_SIZE,
      height: TILE_SIZE,
    });
  });
});

// ---------------------------------------------------------------------------
// stepTraps - timer trigger
// ---------------------------------------------------------------------------

describe('stepTraps - on-timer', () => {
  it('does not fire before delaySteps elapse', () => {
    registerTestTimer();
    const level = makeLevel({
      traps: [
        { id: 't1', type: 'test-timer', trigger: 'on-timer', params: { delaySteps: 3 } },
      ],
    });
    const rt = createRuntime(level, makeBody());

    stepTraps(rt, makeBody(), false, false, 0);
    stepTraps(rt, makeBody(), false, false, 1);
    expect(rt.traps[0]?.fired).toBe(false);
    expect(rt.world.firedTrapIds).toHaveLength(0);
  });

  it('fires after delaySteps elapse and applies the effect', () => {
    registerTestTimer();
    const level = makeLevel({
      traps: [
        { id: 't1', type: 'test-timer', trigger: 'on-timer', params: { delaySteps: 2 } },
      ],
    });
    const rt = createRuntime(level, makeBody());

    stepTraps(rt, makeBody(), false, false, 0);
    stepTraps(rt, makeBody(), false, false, 1);
    // stepsSinceArm reaches 2 after this second step.
    stepTraps(rt, makeBody(), false, false, 2);

    expect(rt.traps[0]?.fired).toBe(true);
    expect(rt.world.firedTrapIds).toContain('t1');
    // Effect: a hazard was added.
    expect(rt.world.hazards.some((h) => h.x === 0 && h.y === 0)).toBe(true);
  });

  it('records fired trap ids in firedTrapIds', () => {
    registerTestTimer();
    const level = makeLevel({
      traps: [
        { id: 'timer-a', type: 'test-timer', trigger: 'on-timer', params: { delaySteps: 1 } },
        { id: 'timer-b', type: 'test-timer', trigger: 'on-timer', params: { delaySteps: 5 } },
      ],
    });
    const rt = createRuntime(level, makeBody());

    stepTraps(rt, makeBody(), false, false, 0);
    stepTraps(rt, makeBody(), false, false, 1);

    expect(rt.world.firedTrapIds).toEqual(['timer-a']);
  });
});

// ---------------------------------------------------------------------------
// stepTraps - fixed evaluation order
// ---------------------------------------------------------------------------

describe('stepTraps - fixed trigger order', () => {
  /**
   * Two traps fire on the same step: one on-timer (delay 0), one on-exit-reached.
   * The on-timer kind precedes on-exit-reached in the fixed order, so the timer
   * trap's id must appear first in firedTrapIds.
   */
  it('evaluates on-timer before on-exit-reached', () => {
    registerTestTimer();
    registerTestKill();
    const level = makeLevel({
      traps: [
        { id: 'kill-1', type: 'test-kill', trigger: 'on-exit-reached', params: {} },
        { id: 'timer-1', type: 'test-timer', trigger: 'on-timer', params: { delaySteps: 0 } },
      ],
    });
    const rt = createRuntime(level, makeBody());

    // Both conditions met on the first step.
    stepTraps(rt, makeBody(), false, true, 0);

    expect(rt.world.firedTrapIds).toEqual(['timer-1', 'kill-1']);
  });

  it('only fires each trap once per arm cycle', () => {
    registerTestTimer();
    const level = makeLevel({
      traps: [
        { id: 'once', type: 'test-timer', trigger: 'on-timer', params: { delaySteps: 0 } },
      ],
    });
    const rt = createRuntime(level, makeBody());

    stepTraps(rt, makeBody(), false, false, 0);
    expect(rt.world.firedTrapIds).toEqual(['once']);

    // Second step: trap already fired, should not re-fire.
    stepTraps(rt, makeBody(), false, false, 1);
    expect(rt.world.firedTrapIds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('same inputs and step produce the same outcome', () => {
    registerTestTimer();
    const level = makeLevel({
      traps: [
        { id: 'det', type: 'test-timer', trigger: 'on-timer', params: { delaySteps: 2 } },
      ],
    });

    function run(): { fired: boolean; hazards: number; ids: string[] } {
      const rt = createRuntime(level, makeBody());
      stepTraps(rt, makeBody(), false, false, 0);
      stepTraps(rt, makeBody(), false, false, 1);
      stepTraps(rt, makeBody(), false, false, 2);
      return {
        fired: rt.traps[0]?.fired ?? false,
        hazards: rt.world.hazards.length,
        ids: [...rt.world.firedTrapIds],
      };
    }

    const a = run();
    const b = run();
    expect(b).toEqual(a);
  });
});

// ---------------------------------------------------------------------------
// resetTraps - re-armable
// ---------------------------------------------------------------------------

describe('resetTraps - re-armable', () => {
  it('restores all traps to armed state after firing', () => {
    registerTestTimer();
    const level = makeLevel({
      traps: [
        { id: 'rearmer', type: 'test-timer', trigger: 'on-timer', params: { delaySteps: 0 } },
      ],
    });
    const rt = createRuntime(level, makeBody());

    // Fire it.
    stepTraps(rt, makeBody(), false, false, 0);
    expect(rt.traps[0]?.fired).toBe(true);

    // Reset.
    resetTraps(rt, makeBody());

    expect(rt.traps[0]?.armed).toBe(true);
    expect(rt.traps[0]?.fired).toBe(false);
    expect(rt.traps[0]?.stepsSinceArm).toBe(0);
  });

  it('traps fire again after reset on the same trigger', () => {
    registerTestTimer();
    const level = makeLevel({
      traps: [
        { id: 'twice', type: 'test-timer', trigger: 'on-timer', params: { delaySteps: 1 } },
      ],
    });
    const rt = createRuntime(level, makeBody());

    // Fire once.
    stepTraps(rt, makeBody(), false, false, 0);
    stepTraps(rt, makeBody(), false, false, 1);
    expect(rt.traps[0]?.fired).toBe(true);

    // Reset and fire again.
    resetTraps(rt, makeBody());
    stepTraps(rt, makeBody(), false, false, 0);
    stepTraps(rt, makeBody(), false, false, 1);
    expect(rt.traps[0]?.fired).toBe(true);
    expect(rt.world.firedTrapIds).toContain('twice');
  });

  it('rebuilds world tiles and hazards from the level on reset', () => {
    registerTestTimer();
    const level = makeLevel({
      traps: [
        { id: 'modder', type: 'test-timer', trigger: 'on-timer', params: { delaySteps: 0 } },
      ],
    });
    const rt = createRuntime(level, makeBody());

    const initialHazardCount = rt.world.hazards.length;
    const initialTiles = [...rt.world.tiles];

    // Fire the trap, which adds a hazard.
    stepTraps(rt, makeBody(), false, false, 0);
    expect(rt.world.hazards.length).toBe(initialHazardCount + 1);

    // Mutate a tile manually to simulate a trap modifying the grid.
    rt.world.tiles[0] = PhysTile.Empty;

    // Reset: world should be rebuilt from the level.
    resetTraps(rt, makeBody());
    expect(rt.world.hazards.length).toBe(initialHazardCount);
    expect(rt.world.tiles).toEqual(initialTiles);
    expect(rt.world.dynamicSolids).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Multi-step trap animation through the runtime
// ---------------------------------------------------------------------------

describe('stepTraps - multi-step animation', () => {
  it('emerging-spikes fully extends over extendSteps via the animation pass', () => {
    // Register the REAL emerging-spikes factory (not a test stub) so the
    // runtime exercises its multi-step apply() state machine.
    registerEmergingSpikes();

    // Level with a floor spike at col 1, row 1. extendSteps=4, no repeat.
    const level = makeLevel({
      cols: 4,
      rows: 3,
      traps: [
        {
          id: 'anim-spike',
          type: 'emerging-spikes',
          trigger: 'on-enter',
          params: {
            surface: 'floor',
            col: 1,
            row: 1,
            extendSteps: 4,
            repeats: false,
          },
        },
      ],
    });

    const rt = createRuntime(level, makeBody());

    // Place the player inside the spike tile so on-enter triggers immediately.
    // Spike at (1,1) = pixels (16,16)-(32,32). Player overlapping at (16,16).
    const bodyInSpike = makeBody(16, 16, false);

    // Step 0: trap fires (Phase 1), apply called once. Spike begins extending.
    // With extendSteps=4, first apply sets progress=1, fraction=0.25, height=4.
    stepTraps(rt, bodyInSpike, false, false, 0);
    expect(rt.traps[0]?.fired).toBe(true);
    expect(rt.world.hazards).toHaveLength(1);
    expect(rt.world.hazards[0]?.height).toBe(4);

    // Steps 1-3: animation pass calls apply() each step, growing the spike.
    stepTraps(rt, bodyInSpike, false, false, 1);
    expect(rt.world.hazards[0]?.height).toBe(8);

    stepTraps(rt, bodyInSpike, false, false, 2);
    expect(rt.world.hazards[0]?.height).toBe(12);

    stepTraps(rt, bodyInSpike, false, false, 3);
    expect(rt.world.hazards[0]?.height).toBe(16);

    // Step 4: fully extended, non-repeating. Height stays at 16 (phase=extended).
    stepTraps(rt, bodyInSpike, false, false, 4);
    expect(rt.world.hazards[0]?.height).toBe(16);

    // firedTrapIds should only contain the id once (no re-firing).
    expect(rt.world.firedTrapIds).toEqual([]);
  });

  it('emerging-spikes with repeats retracts and re-arms cyclically', () => {
    registerEmergingSpikes();

    const level = makeLevel({
      cols: 4,
      rows: 3,
      traps: [
        {
          id: 'cycle-spike',
          type: 'emerging-spikes',
          trigger: 'on-enter',
          params: {
            surface: 'floor',
            col: 1,
            row: 1,
            extendSteps: 2,
            retractSteps: 2,
            repeats: true,
          },
        },
      ],
    });

    const rt = createRuntime(level, makeBody(16, 16, false));

    // Extend: steps 0-1.
    stepTraps(rt, rt.world.playerBody, false, false, 0);
    expect(rt.world.hazards[0]?.height).toBe(8);
    stepTraps(rt, rt.world.playerBody, false, false, 1);
    expect(rt.world.hazards[0]?.height).toBe(16);

    // Retract: steps 2-3.
    stepTraps(rt, rt.world.playerBody, false, false, 2);
    expect(rt.world.hazards[0]?.height).toBe(8);
    stepTraps(rt, rt.world.playerBody, false, false, 3);
    // Fully retracted: hazard removed.
    expect(rt.world.hazards.length === 0 || rt.world.hazards[0]?.height === 0).toBe(true);

    // Re-extend: steps 4-5 (cycle restarts).
    stepTraps(rt, rt.world.playerBody, false, false, 4);
    expect(rt.world.hazards).toHaveLength(1);
    expect(rt.world.hazards[0]?.height).toBe(8);
    stepTraps(rt, rt.world.playerBody, false, false, 5);
    expect(rt.world.hazards[0]?.height).toBe(16);
  });
});
