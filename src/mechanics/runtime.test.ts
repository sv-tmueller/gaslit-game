import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Body } from '../engine/physics';
import type { ControllerActions } from '../engine/controller';
import type { JsonValue, LevelData, MechanicEntry } from '../levels/types';
import { clearRegistry } from './registry';
import { registerAllMechanicTypes } from './register';
import {
  createMechanicsRuntime,
  resetMechanics,
  stepMechanics,
} from './runtime';

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

function noActions(): ControllerActions {
  return { left: false, right: false, jumpPressed: false, jumpHeld: false };
}

function makeEntry(
  type: string,
  params: Record<string, unknown>,
  id?: string,
): MechanicEntry {
  return {
    id: id ?? `test-${type}`,
    type,
    params: params as unknown as Readonly<Record<string, JsonValue>>,
  };
}

/** Minimal level skeleton with optional mechanics. */
function makeLevel(mechanics: MechanicEntry[] = []): LevelData {
  return {
    name: 'mech-runtime-test',
    cols: 4,
    rows: 3,
    spawn: { col: 0, row: 0 },
    exit: { col: 3, row: 0 },
    tiles: [
      0, 0, 0, 0,
      0, 0, 0, 0,
      1, 1, 1, 1,
    ],
    traps: [],
    mechanics,
  };
}

beforeEach(() => {
  clearRegistry();
  registerAllMechanicTypes();
});

afterEach(() => {
  clearRegistry();
});

// ---------------------------------------------------------------------------
// createMechanicsRuntime
// ---------------------------------------------------------------------------

describe('createMechanicsRuntime', () => {
  it('instantiates mechanics from level.mechanics via the registry', () => {
    const level = makeLevel([
      makeEntry('spring', { x: 0, y: 0, impulseY: -400 }),
      makeEntry('teleporter', { x: 32, y: 0, destX: 64, destY: 0 }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());

    expect(rt.mechanics).toHaveLength(2);
    expect(rt.mechanics[0]?.id).toBe('test-spring');
    expect(rt.mechanics[1]?.id).toBe('test-teleporter');
  });

  it('produces an inert runtime when level has no mechanics field', () => {
    const level: LevelData = {
      name: 'no-mech',
      cols: 4,
      rows: 3,
      spawn: { col: 0, row: 0 },
      exit: { col: 3, row: 0 },
      tiles: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      traps: [],
    };
    const rt = createMechanicsRuntime(level, makeBody());

    expect(rt.mechanics).toHaveLength(0);
    expect(rt.publishedSolids).toHaveLength(0);
    expect(rt.publishedHazards).toHaveLength(0);
  });

  it('starts with empty published buffers', () => {
    const level = makeLevel([
      makeEntry('spring', { x: 0, y: 0, impulseY: -400 }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());

    expect(rt.publishedSolids).toHaveLength(0);
    expect(rt.publishedHazards).toHaveLength(0);
    expect(rt.cosmeticEffects.cameraTrolls!).toHaveLength(0);
    expect(rt.cosmeticEffects.fakeUiStates!).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// stepMechanics - publishing dynamics
// ---------------------------------------------------------------------------

describe('stepMechanics - publishing', () => {
  it('publishes dynamic solids from moving-platform mechanics', () => {
    const level = makeLevel([
      makeEntry('moving-platform', {
        startX: 0, startY: 100, width: 32, height: 16,
        dx: 1, dy: 0, speed: 16, distance: 48,
      }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());
    stepMechanics(rt, makeBody(0, 0), noActions(), 0);

    expect(rt.publishedSolids).toHaveLength(1);
    expect(rt.publishedSolids[0]!.width).toBe(32);
    expect(rt.publishedSolids[0]!.solid).toBe(true);
    expect(rt.publishedSolids[0]!.lethal).toBe(false);
  });

  it('publishes hazards from buzzsaw mechanics', () => {
    const level = makeLevel([
      makeEntry('buzzsaw', {
        radius: 8,
        waypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        speed: 10,
        pingpong: false,
      }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());
    stepMechanics(rt, makeBody(0, 0), noActions(), 0);

    expect(rt.publishedHazards).toHaveLength(1);
    expect(rt.publishedHazards[0]!.width).toBe(16);
    expect(rt.publishedHazards[0]!.height).toBe(16);
  });

  it('publishes hazards from rotating-arm mechanics', () => {
    const level = makeLevel([
      makeEntry('rotating-arm', {
        pivotX: 50, pivotY: 50, length: 30, angularSpeed: 0.1, initialAngle: 0,
      }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());
    stepMechanics(rt, makeBody(0, 0), noActions(), 0);

    expect(rt.publishedHazards).toHaveLength(1);
  });

  it('accumulates hazards from multiple hazard-producing mechanics', () => {
    const level = makeLevel([
      makeEntry('buzzsaw', {
        radius: 8,
        waypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        speed: 10,
        pingpong: false,
      }),
      makeEntry('rotating-arm', {
        pivotX: 50, pivotY: 50, length: 30, angularSpeed: 0.1, initialAngle: 0,
      }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());
    stepMechanics(rt, makeBody(0, 0), noActions(), 0);

    expect(rt.publishedHazards).toHaveLength(2);
  });

  it('publishes cosmetic state from camera-troll mechanics', () => {
    const level = makeLevel([
      makeEntry('camera-troll', { kind: 'zoom', intensity: 0.5 }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());
    stepMechanics(rt, makeBody(0, 0), noActions(), 0);

    expect(rt.cosmeticEffects.cameraTrolls!).toHaveLength(1);
    expect(rt.cosmeticEffects.cameraTrolls![0]!.active).toBe(true);
  });

  it('publishes cosmetic state from fake-ui mechanics', () => {
    const level = makeLevel([
      makeEntry('fake-ui', { kind: 'fake-crash' }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());
    stepMechanics(rt, makeBody(0, 0), noActions(), 0);

    expect(rt.cosmeticEffects.fakeUiStates!).toHaveLength(1);
    expect(rt.cosmeticEffects.fakeUiStates![0]!.active).toBe(true);
  });

  it('aggregates cosmetics from multiple cosmetic mechanics', () => {
    const level = makeLevel([
      makeEntry('camera-troll', { kind: 'zoom', intensity: 0.5 }),
      makeEntry('camera-troll', { kind: 'flip', intensity: 1 }, 'ct-2'),
      makeEntry('fake-ui', { kind: 'fake-crash' }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());
    stepMechanics(rt, makeBody(0, 0), noActions(), 0);

    expect(rt.cosmeticEffects.cameraTrolls!).toHaveLength(2);
    expect(rt.cosmeticEffects.fakeUiStates!).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// stepMechanics - clearing each step
// ---------------------------------------------------------------------------

describe('stepMechanics - per-step clearing', () => {
  it('clears published solids and hazards at the start of each step', () => {
    const level = makeLevel([
      makeEntry('buzzsaw', {
        radius: 8,
        waypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        speed: 10,
        pingpong: false,
      }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());

    // Step 0: one hazard published.
    stepMechanics(rt, makeBody(0, 0), noActions(), 0);
    expect(rt.publishedHazards).toHaveLength(1);

    // Step 1: previous hazard cleared, new one published.
    stepMechanics(rt, makeBody(0, 0), noActions(), 1);
    expect(rt.publishedHazards).toHaveLength(1);
  });

  it('clears cosmetics at the start of each step', () => {
    const level = makeLevel([
      makeEntry('camera-troll', { kind: 'zoom', intensity: 0.5 }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());

    stepMechanics(rt, makeBody(0, 0), noActions(), 0);
    expect(rt.cosmeticEffects.cameraTrolls!).toHaveLength(1);

    stepMechanics(rt, makeBody(0, 0), noActions(), 1);
    expect(rt.cosmeticEffects.cameraTrolls!).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// stepMechanics - inert runtime (no mechanics)
// ---------------------------------------------------------------------------

describe('stepMechanics - inert runtime', () => {
  it('produces no published state when there are no mechanics', () => {
    const level = makeLevel([]);
    const rt = createMechanicsRuntime(level, makeBody());

    stepMechanics(rt, makeBody(0, 0), noActions(), 0);
    expect(rt.publishedSolids).toHaveLength(0);
    expect(rt.publishedHazards).toHaveLength(0);
    expect(rt.cosmeticEffects.cameraTrolls!).toHaveLength(0);
    expect(rt.cosmeticEffects.fakeUiStates!).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('same inputs and step produce the same published state', () => {
    const level = makeLevel([
      makeEntry('buzzsaw', {
        radius: 8,
        waypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        speed: 10,
        pingpong: false,
      }),
      makeEntry('moving-platform', {
        startX: 0, startY: 100, width: 32, height: 16,
        dx: 1, dy: 0, speed: 16, distance: 48,
      }),
    ]);

    function run(): {
      solids: number;
      hazards: number;
      solidX: number;
      hazardX: number;
    } {
      const rt = createMechanicsRuntime(level, makeBody());
      stepMechanics(rt, makeBody(0, 0), noActions(), 0);
      stepMechanics(rt, makeBody(0, 0), noActions(), 1);
      return {
        solids: rt.publishedSolids.length,
        hazards: rt.publishedHazards.length,
        solidX: rt.publishedSolids[0]?.x ?? -1,
        hazardX: rt.publishedHazards[0]?.x ?? -1,
      };
    }

    const a = run();
    const b = run();
    expect(b).toEqual(a);
  });
});

// ---------------------------------------------------------------------------
// resetMechanics
// ---------------------------------------------------------------------------

describe('resetMechanics', () => {
  it('resets all mechanics to initial state', () => {
    const level = makeLevel([
      makeEntry('moving-platform', {
        startX: 0, startY: 100, width: 32, height: 16,
        dx: 1, dy: 0, speed: 16, distance: 48,
      }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());

    // Step a few times to move the platform away from start.
    stepMechanics(rt, makeBody(0, 0), noActions(), 0);
    stepMechanics(rt, makeBody(0, 0), noActions(), 1);
    stepMechanics(rt, makeBody(0, 0), noActions(), 2);
    expect(rt.publishedSolids[0]!.x).toBeGreaterThan(0);

    // Reset: platform should be back at startX.
    resetMechanics(rt, makeBody());
    stepMechanics(rt, makeBody(0, 0), noActions(), 0);
    expect(rt.publishedSolids[0]!.x).toBe(0);
  });

  it('clears published buffers on reset', () => {
    const level = makeLevel([
      makeEntry('buzzsaw', {
        radius: 8,
        waypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        speed: 10,
        pingpong: false,
      }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());

    stepMechanics(rt, makeBody(0, 0), noActions(), 0);
    expect(rt.publishedHazards).toHaveLength(1);

    resetMechanics(rt, makeBody());
    expect(rt.publishedHazards).toHaveLength(0);
    expect(rt.publishedSolids).toHaveLength(0);
    expect(rt.cosmeticEffects.cameraTrolls!).toHaveLength(0);
    expect(rt.cosmeticEffects.fakeUiStates!).toHaveLength(0);
  });

  it('allows stepping normally after reset', () => {
    const level = makeLevel([
      makeEntry('spring', { x: 0, y: 0, impulseY: -400 }),
    ]);
    const rt = createMechanicsRuntime(level, makeBody());

    stepMechanics(rt, makeBody(0, 0), noActions(), 0);
    resetMechanics(rt, makeBody());
    stepMechanics(rt, makeBody(0, 0), noActions(), 0);

    // Should not throw and runtime is usable.
    expect(rt.mechanics).toHaveLength(1);
  });
});
