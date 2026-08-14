import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Body } from '../../engine/physics';
import { Tile } from '../../engine/physics';
import type { WorldState } from '../types';
import { clearRegistry, createTrap } from '../registry';
import { registerShiftingWall } from './shifting-wall';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeWorld(opts: Partial<WorldState> = {}): WorldState {
  const cols = opts.cols ?? 8;
  const rows = opts.rows ?? 6;
  const tiles = opts.tiles ?? new Array(cols * rows).fill(Tile.Solid);
  return {
    tiles,
    cols,
    rows,
    hazards: [],
    dynamicSolids: [],
    playerBody: makeBody(),
    playerPrevGrounded: false,
    exitReached: false,
    firedTrapIds: [],
    exitPos: { col: 7, row: 0 },
    ...opts,
  };
}

beforeEach(() => {
  clearRegistry();
});

afterEach(() => {
  clearRegistry();
});

// ---------------------------------------------------------------------------
// Registration & factory
// ---------------------------------------------------------------------------

describe('shifting-wall: registration', () => {
  it('registers under type "shifting-wall"', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw1',
      type: 'shifting-wall',
      trigger: 'on-enter',
      params: {
        col: 0,
        row: 2,
        direction: 'right',
        distance: 32,
        speed: 4,
      },
    });
    expect(trap.type).toBe('shifting-wall');
    expect(trap.id).toBe('sw1');
  });

  it('parses trigger string into TriggerKind', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw2',
      type: 'shifting-wall',
      trigger: 'on-timer',
      params: {
        col: 0,
        row: 2,
        direction: 'right',
        distance: 32,
        speed: 4,
        delaySteps: 3,
      },
    });
    expect(trap.trigger.kind).toBe('on-timer');
  });

  it('throws on invalid trigger string', () => {
    registerShiftingWall();
    expect(() =>
      createTrap({
        id: 'sw-bad',
        type: 'shifting-wall',
        trigger: 'on-bogus',
        params: {
          col: 0,
          row: 2,
          direction: 'right',
          distance: 32,
          speed: 4,
        },
      }),
    ).toThrow(/invalid trigger/);
  });

  it('throws on invalid direction', () => {
    registerShiftingWall();
    expect(() =>
      createTrap({
        id: 'sw-baddir',
        type: 'shifting-wall',
        trigger: 'on-enter',
        params: {
          col: 0,
          row: 2,
          direction: 'sideways',
          distance: 32,
          speed: 4,
        },
      }),
    ).toThrow(/direction/);
  });
});

// ---------------------------------------------------------------------------
// evaluate() - on-enter trigger
// ---------------------------------------------------------------------------

describe('shifting-wall: evaluate on-enter', () => {
  it('returns true when player enters the target zone', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw-enter',
      type: 'shifting-wall',
      trigger: 'on-enter',
      params: {
        col: 0,
        row: 2,
        direction: 'right',
        distance: 32,
        speed: 4,
        region: { x: 32, y: 32, width: 32, height: 16 },
      },
    });

    const world = makeWorld({
      playerBody: makeBody(32, 32, false),
    });

    expect(trap.evaluate(world, 0)).toBe(true);
  });

  it('returns false when player is outside the target zone', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw-away',
      type: 'shifting-wall',
      trigger: 'on-enter',
      params: {
        col: 0,
        row: 2,
        direction: 'right',
        distance: 32,
        speed: 4,
        region: { x: 32, y: 32, width: 32, height: 16 },
      },
    });

    const world = makeWorld({
      playerBody: makeBody(0, 0, false),
    });

    expect(trap.evaluate(world, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluate() - on-approach trigger
// ---------------------------------------------------------------------------

describe('shifting-wall: evaluate on-approach', () => {
  it('returns true when player is within distance', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw-appr',
      type: 'shifting-wall',
      trigger: 'on-approach',
      params: {
        col: 0,
        row: 2,
        direction: 'right',
        distance: 32,
        speed: 4,
        approachDistance: 50,
      },
    });

    // Wall at (0, 32)-(16, 48). Player at (32, 32) is 16px away (< 50).
    const world = makeWorld({
      playerBody: makeBody(32, 32, false),
    });

    expect(trap.evaluate(world, 0)).toBe(true);
  });

  it('returns false when player is beyond distance', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw-far',
      type: 'shifting-wall',
      trigger: 'on-approach',
      params: {
        col: 0,
        row: 2,
        direction: 'right',
        distance: 32,
        speed: 4,
        approachDistance: 10,
      },
    });

    const world = makeWorld({
      playerBody: makeBody(100, 100, false),
    });

    expect(trap.evaluate(world, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluate() - on-timer trigger
// ---------------------------------------------------------------------------

describe('shifting-wall: evaluate on-timer', () => {
  it('returns true after delaySteps have elapsed', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw-time',
      type: 'shifting-wall',
      trigger: 'on-timer',
      params: {
        col: 0,
        row: 2,
        direction: 'right',
        distance: 32,
        speed: 4,
        delaySteps: 2,
      },
    });

    const world = makeWorld();

    expect(trap.evaluate(world, 0)).toBe(false);
    trap.stepsSinceArm++;
    expect(trap.evaluate(world, 1)).toBe(false);
    trap.stepsSinceArm++;
    expect(trap.evaluate(world, 2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// apply() - sliding motion
// ---------------------------------------------------------------------------

describe('shifting-wall: apply', () => {
  it('adds a DynamicSolid that slides in the given direction', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw-slide',
      type: 'shifting-wall',
      trigger: 'on-enter',
      params: {
        col: 0,
        row: 2,
        direction: 'right',
        distance: 32,
        speed: 8,
      },
    });

    const world = makeWorld();

    // First apply: spawn the dynamic solid at the starting position.
    trap.apply(world);
    expect(world.dynamicSolids).toHaveLength(1);
    const ds = world.dynamicSolids[0]!;
    expect(ds.x).toBe(0);
    expect(ds.y).toBe(32);
    expect(ds.solid).toBe(true);
    expect(ds.lethal).toBe(false);
    expect(ds.velocityX).toBe(8);

    // Second apply: shifts right by speed.
    trap.apply(world);
    expect(world.dynamicSolids[0]?.x).toBe(8);

    // Third apply: continues shifting.
    trap.apply(world);
    expect(world.dynamicSolids[0]?.x).toBe(16);
  });

  it('slides left correctly', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw-left',
      type: 'shifting-wall',
      trigger: 'on-enter',
      params: {
        col: 4,
        row: 2,
        direction: 'left',
        distance: 32,
        speed: 8,
      },
    });

    const world = makeWorld();

    trap.apply(world);
    expect(world.dynamicSolids[0]?.x).toBe(64);

    trap.apply(world);
    expect(world.dynamicSolids[0]?.x).toBe(56);

    trap.apply(world);
    expect(world.dynamicSolids[0]?.x).toBe(48);
  });

  it('slides up correctly', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw-up',
      type: 'shifting-wall',
      trigger: 'on-enter',
      params: {
        col: 2,
        row: 4,
        direction: 'up',
        distance: 32,
        speed: 8,
      },
    });

    const world = makeWorld();

    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(64);

    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(56);

    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(48);
  });

  it('slides down correctly', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw-down',
      type: 'shifting-wall',
      trigger: 'on-enter',
      params: {
        col: 2,
        row: 0,
        direction: 'down',
        distance: 32,
        speed: 8,
      },
    });

    const world = makeWorld();

    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(0);

    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(8);

    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(16);
  });

  it('stops after reaching the destination distance', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw-stop',
      type: 'shifting-wall',
      trigger: 'on-enter',
      params: {
        col: 0,
        row: 2,
        direction: 'right',
        distance: 16,
        speed: 8,
      },
    });

    const world = makeWorld();

    trap.apply(world); // spawn at x=0
    trap.apply(world); // shift to x=8
    trap.apply(world); // shift to x=16 (= distance), stop
    expect(world.dynamicSolids[0]?.x).toBe(16);
    expect(world.dynamicSolids[0]?.velocityX).toBe(0);

    trap.apply(world); // should not move further
    expect(world.dynamicSolids[0]?.x).toBe(16);
  });
});

// ---------------------------------------------------------------------------
// reset()
// ---------------------------------------------------------------------------

describe('shifting-wall: reset', () => {
  it('restores armed state and clears movement tracking', () => {
    registerShiftingWall();
    const trap = createTrap({
      id: 'sw-reset',
      type: 'shifting-wall',
      trigger: 'on-enter',
      params: {
        col: 0,
        row: 2,
        direction: 'right',
        distance: 32,
        speed: 8,
      },
    });

    const world = makeWorld();
    trap.apply(world);
    trap.fired = true;
    trap.stepsSinceArm = 5;

    trap.reset();

    expect(trap.armed).toBe(true);
    expect(trap.fired).toBe(false);
    expect(trap.stepsSinceArm).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('shifting-wall: determinism', () => {
  it('same inputs produce same outputs', () => {
    registerShiftingWall();

    function runOnce(): { solidX: number; solidCount: number } {
      const trap = createTrap({
        id: 'sw-det',
        type: 'shifting-wall',
        trigger: 'on-enter',
        params: {
          col: 0,
          row: 2,
          direction: 'right',
          distance: 32,
          speed: 8,
        },
      });
      const world = makeWorld();
      trap.apply(world);
      trap.apply(world);
      trap.apply(world);
      return {
        solidX: world.dynamicSolids[0]?.x ?? -1,
        solidCount: world.dynamicSolids.length,
      };
    }

    const a = runOnce();
    const b = runOnce();
    expect(b).toEqual(a);
  });
});
