import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { clearRegistry, registerTrapType, createTrap } from '../registry';
import type { WorldState } from '../types';
import type { Body } from '../../engine/physics';

function makeBody(x: number, y: number): Body {
  return {
    x,
    y,
    width: 16,
    height: 16,
    velocity: { x: 0, y: 0 },
    grounded: false,
  };
}

function makeWorld(overrides: Partial<WorldState> = {}): WorldState {
  return {
    tiles: [],
    cols: 20,
    rows: 12,
    hazards: [],
    dynamicSolids: [],
    playerBody: makeBody(0, 0),
    playerPrevGrounded: false,
    exitReached: false,
    exitPos: { col: 17, row: 9 },
    firedTrapIds: [],
    ...overrides,
  };
}

function makeEntry(params: Record<string, unknown> = {}) {
  return {
    id: 'fake-door',
    type: 'fake-exit',
    trigger: 'on-approach',
    params: {
      escapeCol: 2,
      escapeRow: 1,
      triggerDist: 64,
      speed: 32,
      ...params,
    },
  };
}

describe('fake-exit trap', () => {
  beforeEach(() => {
    clearRegistry();
  });

  afterEach(() => {
    clearRegistry();
  });

  it('registers and creates a trap instance', async () => {
    const { createFakeExit } = await import('./fake-exit');
    registerTrapType('fake-exit', createFakeExit);
    const trap = createTrap(makeEntry());
    expect(trap.id).toBe('fake-door');
    expect(trap.type).toBe('fake-exit');
    expect(trap.armed).toBe(true);
    expect(trap.fired).toBe(false);
  });

  it('does not fire when player is far from exit', async () => {
    const { createFakeExit } = await import('./fake-exit');
    registerTrapType('fake-exit', createFakeExit);
    const trap = createTrap(makeEntry());

    // Exit at (17, 9) -> pixel center (282, 152). Player at (0, 0) is far.
    const world = makeWorld({ playerBody: makeBody(0, 0) });
    expect(trap.evaluate(world, 0)).toBe(false);
  });

  it('fires when player approaches within triggerDist', async () => {
    const { createFakeExit } = await import('./fake-exit');
    registerTrapType('fake-exit', createFakeExit);
    const trap = createTrap(makeEntry());

    // Exit at (17, 9) -> pixel center (282, 152).
    // Place player within 64px: at (250, 140) -> center (258, 148).
    // Distance = sqrt((258-282)^2 + (148-152)^2) = sqrt(576+16) ~= 24.3 < 64.
    const world = makeWorld({ playerBody: makeBody(250, 140) });
    expect(trap.evaluate(world, 0)).toBe(true);
  });

  it('moves exitPos toward escape target on apply', async () => {
    const { createFakeExit } = await import('./fake-exit');
    registerTrapType('fake-exit', createFakeExit);
    const trap = createTrap(makeEntry());

    const world = makeWorld({ playerBody: makeBody(250, 140) });

    // Fire the trap.
    trap.fired = true;
    trap.apply(world);

    // Exit moved from (17, 9) toward (2, 1). With speed=32 px/step.
    // Original pixel: (272, 144). Target: (32, 16). Dist=sqrt(240^2+128^2)=272.
    // Ratio = 32/272 = 0.1176. New = (272 - 240*0.1176, 144 - 128*0.1176)
    //       = (272 - 28.2, 144 - 15.1) = (243.8, 128.9)
    // Rounded tile: round(243.8/16)=round(15.2)=15, round(128.9/16)=round(8.1)=8
    expect(world.exitPos.col).toBeLessThan(17);
    expect(world.exitPos.row).toBeLessThanOrEqual(9);
  });

  it('stops moving after reaching escape target', async () => {
    const { createFakeExit } = await import('./fake-exit');
    registerTrapType('fake-exit', createFakeExit);
    const trap = createTrap(makeEntry({ speed: 1000 }));

    const world = makeWorld({ playerBody: makeBody(250, 140) });

    // With huge speed, arrives in one step.
    trap.fired = true;
    trap.apply(world);

    expect(world.exitPos.col).toBe(2);
    expect(world.exitPos.row).toBe(1);
  });

  it('continues sliding across multiple steps', async () => {
    const { createFakeExit } = await import('./fake-exit');
    registerTrapType('fake-exit', createFakeExit);
    const trap = createTrap(makeEntry({ speed: 16 }));

    const world = makeWorld({ playerBody: makeBody(250, 140) });

    // First fire: start escaping.
    trap.fired = true;
    trap.apply(world);
    const colAfter1 = world.exitPos.col;
    expect(colAfter1).toBeLessThan(17);

    // Second step: continues (evaluate returns true while escaping).
    trap.fired = false; // runtime clears fired each step
    // Need to re-fire: evaluate should return true because escaping.
    // But fired was reset to false, and armed is still true.
    // Actually the runtime marks fired=true again after evaluate succeeds.
    // For this test, simulate the runtime: evaluate then apply.
    expect(trap.evaluate(world, 1)).toBe(true);
    trap.fired = true;
    trap.apply(world);
    const colAfter2 = world.exitPos.col;
    expect(colAfter2).toBeLessThanOrEqual(colAfter1);
  });

  it('reset restores armed state and clears escape progress', async () => {
    const { createFakeExit } = await import('./fake-exit');
    registerTrapType('fake-exit', createFakeExit);
    const trap = createTrap(makeEntry({ speed: 1000 }));

    const world = makeWorld({ playerBody: makeBody(250, 140) });
    trap.fired = true;
    trap.apply(world);
    expect(world.exitPos.col).toBe(2); // escaped

    trap.reset();

    expect(trap.armed).toBe(true);
    expect(trap.fired).toBe(false);
    expect(trap.stepsSinceArm).toBe(0);

    // After reset, the trap reads the world's exitPos fresh.
    // The runtime would reset world.exitPos to level.exit on resetTraps.
    world.exitPos = { col: 17, row: 9 };
    const farWorld = makeWorld({ playerBody: makeBody(0, 0), exitPos: { col: 17, row: 9 } });
    expect(trap.evaluate(farWorld, 0)).toBe(false);
  });

  it('throws on missing required params', async () => {
    const { createFakeExit } = await import('./fake-exit');
    registerTrapType('fake-exit', createFakeExit);

    expect(() =>
      createTrap({
        id: 'bad',
        type: 'fake-exit',
        trigger: 'on-approach',
        params: { escapeCol: 2 }, // missing escapeRow, triggerDist, speed
      }),
    ).toThrow();
  });

  it('rejects invalid trigger kind', async () => {
    const { createFakeExit } = await import('./fake-exit');
    registerTrapType('fake-exit', createFakeExit);

    expect(() =>
      createTrap({
        id: 'bad-trigger',
        type: 'fake-exit',
        trigger: 'invalid-trigger',
        params: {
          escapeCol: 2,
          escapeRow: 1,
          triggerDist: 64,
          speed: 32,
        },
      }),
    ).toThrow();
  });
});
