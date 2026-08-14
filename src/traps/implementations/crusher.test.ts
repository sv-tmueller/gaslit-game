import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Body } from '../../engine/physics';
import { Tile } from '../../engine/physics';
import type { WorldState } from '../types';
import { clearRegistry, createTrap } from '../registry';
import { registerCrusher } from './crusher';

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

describe('crusher: registration', () => {
  it('registers under type "crusher"', () => {
    registerCrusher();
    const trap = createTrap({
      id: 'cr1',
      type: 'crusher',
      trigger: 'on-enter',
      params: {
        col: 2,
        row: 0,
        width: 2,
        height: 1,
        dropDistance: 32,
        dropSpeed: 4,
      },
    });
    expect(trap.type).toBe('crusher');
    expect(trap.id).toBe('cr1');
  });

  it('parses trigger string into TriggerKind', () => {
    registerCrusher();
    const trap = createTrap({
      id: 'cr2',
      type: 'crusher',
      trigger: 'on-timer',
      params: {
        col: 2,
        row: 0,
        width: 2,
        height: 1,
        dropDistance: 32,
        dropSpeed: 4,
        delaySteps: 5,
      },
    });
    expect(trap.trigger.kind).toBe('on-timer');
  });

  it('throws on invalid trigger string', () => {
    registerCrusher();
    expect(() =>
      createTrap({
        id: 'cr-bad',
        type: 'crusher',
        trigger: 'on-nonsense',
        params: {
          col: 2,
          row: 0,
          width: 2,
          height: 1,
          dropDistance: 32,
          dropSpeed: 4,
        },
      }),
    ).toThrow(/invalid trigger/);
  });
});

// ---------------------------------------------------------------------------
// evaluate() - on-enter trigger
// ---------------------------------------------------------------------------

describe('crusher: evaluate on-enter', () => {
  it('returns true when player enters the danger zone below the crusher', () => {
    registerCrusher();
    const trap = createTrap({
      id: 'cr-enter',
      type: 'crusher',
      trigger: 'on-enter',
      params: {
        col: 2,
        row: 0,
        width: 2,
        height: 1,
        dropDistance: 48,
        dropSpeed: 4,
      },
    });

    // Crusher at col 2, row 0, width 2 tiles = pixels (32, 0)-(64, 16).
    // Danger zone: below the crusher spanning the drop distance.
    // Zone: x=32, y=16, width=32, height=48 (dropDistance).
    // Player at (32, 32) overlaps the zone.
    const world = makeWorld({
      playerBody: makeBody(32, 32, false),
    });

    expect(trap.evaluate(world, 0)).toBe(true);
  });

  it('returns false when player is outside the danger zone', () => {
    registerCrusher();
    const trap = createTrap({
      id: 'cr-away',
      type: 'crusher',
      trigger: 'on-enter',
      params: {
        col: 2,
        row: 0,
        width: 2,
        height: 1,
        dropDistance: 48,
        dropSpeed: 4,
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

describe('crusher: evaluate on-approach', () => {
  it('returns true when player is within distance', () => {
    registerCrusher();
    const trap = createTrap({
      id: 'cr-appr',
      type: 'crusher',
      trigger: 'on-approach',
      params: {
        col: 4,
        row: 0,
        width: 2,
        height: 1,
        dropDistance: 48,
        dropSpeed: 4,
        distance: 50,
      },
    });

    // Crusher at (64, 0)-(96, 16). Player at (0, 0) is 64px away (> 50).
    // Player at (32, 0) is 32px away (< 50).
    const world = makeWorld({
      playerBody: makeBody(32, 0, false),
    });

    expect(trap.evaluate(world, 0)).toBe(true);
  });

  it('returns false when player is beyond distance', () => {
    registerCrusher();
    const trap = createTrap({
      id: 'cr-far',
      type: 'crusher',
      trigger: 'on-approach',
      params: {
        col: 4,
        row: 0,
        width: 2,
        height: 1,
        dropDistance: 48,
        dropSpeed: 4,
        distance: 10,
      },
    });

    const world = makeWorld({
      playerBody: makeBody(0, 0, false),
    });

    expect(trap.evaluate(world, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// evaluate() - on-timer trigger
// ---------------------------------------------------------------------------

describe('crusher: evaluate on-timer', () => {
  it('returns true after delaySteps have elapsed', () => {
    registerCrusher();
    const trap = createTrap({
      id: 'cr-time',
      type: 'crusher',
      trigger: 'on-timer',
      params: {
        col: 2,
        row: 0,
        width: 2,
        height: 1,
        dropDistance: 32,
        dropSpeed: 4,
        delaySteps: 3,
      },
    });

    const world = makeWorld();

    expect(trap.evaluate(world, 0)).toBe(false);
    trap.stepsSinceArm++;
    expect(trap.evaluate(world, 1)).toBe(false);
    trap.stepsSinceArm++;
    expect(trap.evaluate(world, 2)).toBe(false);
    trap.stepsSinceArm++;
    expect(trap.evaluate(world, 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// apply() - dropping dynamics
// ---------------------------------------------------------------------------

describe('crusher: apply', () => {
  it('adds a DynamicSolid that descends at dropSpeed', () => {
    registerCrusher();
    const trap = createTrap({
      id: 'cr-drop',
      type: 'crusher',
      trigger: 'on-enter',
      params: {
        col: 2,
        row: 0,
        width: 2,
        height: 1,
        dropDistance: 32,
        dropSpeed: 8,
      },
    });

    const world = makeWorld();

    // First apply: spawns the dynamic solid at the starting position.
    trap.apply(world);
    expect(world.dynamicSolids).toHaveLength(1);
    const ds = world.dynamicSolids[0]!;
    expect(ds.x).toBe(32);
    expect(ds.y).toBe(0);
    expect(ds.width).toBe(32);
    expect(ds.height).toBe(16);
    expect(ds.solid).toBe(true);
    expect(ds.lethal).toBe(false);
    expect(ds.velocityY).toBe(8);

    // Second apply: descends by dropSpeed.
    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(8);

    // Third apply: continues descending.
    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(16);
  });

  it('stops descending after reaching dropDistance', () => {
    registerCrusher();
    const trap = createTrap({
      id: 'cr-stop',
      type: 'crusher',
      trigger: 'on-enter',
      params: {
        col: 2,
        row: 0,
        width: 2,
        height: 1,
        dropDistance: 16,
        dropSpeed: 8,
      },
    });

    const world = makeWorld();

    // Step 1: spawn at y=0.
    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(0);

    // Step 2: descend to y=8.
    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(8);

    // Step 3: descend to y=16 (= dropDistance). Should stop here.
    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(16);

    // Step 4: should not descend further.
    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(16);
  });

  it('marks lethal when player overlaps crusher and is grounded', () => {
    registerCrusher();
    const trap = createTrap({
      id: 'cr-crush',
      type: 'crusher',
      trigger: 'on-enter',
      params: {
        col: 0,
        row: 0,
        width: 1,
        height: 1,
        dropDistance: 32,
        dropSpeed: 16,
      },
    });

    const world = makeWorld({
      playerBody: makeBody(0, 16, true), // player directly below crusher, grounded
    });

    // Step 1: spawn crusher at y=0.
    trap.apply(world);
    expect(world.dynamicSolids[0]?.lethal).toBe(false);

    // Step 2: crusher drops to y=16, now overlapping player who is grounded.
    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(16);
    // Crusher overlaps player (both at x=0, y=16, 16x16) and player is grounded.
    expect(world.dynamicSolids[0]?.lethal).toBe(true);
  });

  it('does not mark lethal when player is not grounded', () => {
    registerCrusher();
    const trap = createTrap({
      id: 'cr-noair',
      type: 'crusher',
      trigger: 'on-enter',
      params: {
        col: 0,
        row: 0,
        width: 1,
        height: 1,
        dropDistance: 32,
        dropSpeed: 16,
      },
    });

    const world = makeWorld({
      playerBody: makeBody(0, 16, false), // player in air, not grounded
    });

    trap.apply(world);
    trap.apply(world);
    expect(world.dynamicSolids[0]?.y).toBe(16);
    // Player not grounded: not crushed.
    expect(world.dynamicSolids[0]?.lethal).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// reset()
// ---------------------------------------------------------------------------

describe('crusher: reset', () => {
  it('restores armed state and clears dynamic solid tracking', () => {
    registerCrusher();
    const trap = createTrap({
      id: 'cr-reset',
      type: 'crusher',
      trigger: 'on-enter',
      params: {
        col: 2,
        row: 0,
        width: 1,
        height: 1,
        dropDistance: 32,
        dropSpeed: 8,
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

describe('crusher: determinism', () => {
  it('same inputs produce same outputs', () => {
    registerCrusher();

    function runOnce(): { solidY: number; solidCount: number } {
      const trap = createTrap({
        id: 'cr-det',
        type: 'crusher',
        trigger: 'on-enter',
        params: {
          col: 0,
          row: 0,
          width: 1,
          height: 1,
          dropDistance: 32,
          dropSpeed: 8,
        },
      });
      const world = makeWorld();
      trap.apply(world);
      trap.apply(world);
      trap.apply(world);
      return {
        solidY: world.dynamicSolids[0]?.y ?? -1,
        solidCount: world.dynamicSolids.length,
      };
    }

    const a = runOnce();
    const b = runOnce();
    expect(b).toEqual(a);
  });
});
