import { describe, expect, it } from 'vitest';
import type { AABB, Body } from '../engine/physics';
import type { HazardRect } from '../engine/levelAdapter';
import type { TilePosition } from '../levels/types';
import type {
  DynamicSolid,
  TrapEffect,
  TrapFactory,
  TrapInstance,
  TriggerContext,
  TriggerKind,
  WorldState,
} from './types';

// ---------------------------------------------------------------------------
// Structural shape tests: these primarily exist as compile-time guarantees
// that the exported types accept the shapes the rest of the system expects.
// At runtime they assert the obvious invariants so a accidental type widening
// surfaces as a red test rather than a silent regression.
// ---------------------------------------------------------------------------

describe('TriggerKind', () => {
  it('covers exactly the six evaluation-order kinds', () => {
    const kinds: TriggerKind[] = [
      'on-land',
      'on-enter',
      'on-approach',
      'on-timer',
      'on-exit-reached',
      'on-trap-fired',
    ];
    expect(kinds).toHaveLength(6);
    expect(new Set(kinds).size).toBe(6);
  });
});

describe('TriggerContext', () => {
  it('accepts a minimal context with only kind', () => {
    const ctx: TriggerContext = { kind: 'on-exit-reached' };
    expect(ctx.kind).toBe('on-exit-reached');
  });

  it('accepts a region-bearing context', () => {
    const region: AABB = { x: 0, y: 0, width: 32, height: 32 };
    const ctx: TriggerContext = { kind: 'on-enter', region };
    expect(ctx.region).toEqual(region);
  });

  it('accepts an approach context with distance', () => {
    const region: AABB = { x: 48, y: 48, width: 16, height: 16 };
    const ctx: TriggerContext = { kind: 'on-approach', region, distance: 64 };
    expect(ctx.distance).toBe(64);
  });

  it('accepts a timer context with delaySteps', () => {
    const ctx: TriggerContext = { kind: 'on-timer', delaySteps: 5 };
    expect(ctx.delaySteps).toBe(5);
  });
});

describe('DynamicSolid', () => {
  it('holds position, velocity, solid and lethal flags, and an id', () => {
    const ds: DynamicSolid = {
      id: 'crusher-1',
      x: 0,
      y: 0,
      width: 32,
      height: 16,
      velocityX: 0,
      velocityY: 100,
      solid: true,
      lethal: true,
    };
    expect(ds.id).toBe('crusher-1');
    expect(ds.solid).toBe(true);
    expect(ds.lethal).toBe(true);
  });
});

describe('WorldState', () => {
  it('accepts a fully-populated mutable world', () => {
    const body: Body = {
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      velocity: { x: 0, y: 0 },
      grounded: false,
    };
    const world: WorldState = {
      tiles: [0, 1, 0, 1],
      cols: 2,
      rows: 2,
      hazards: [{ x: 16, y: 0, width: 16, height: 16 }],
      dynamicSolids: [],
      playerBody: body,
      playerPrevGrounded: false,
      exitReached: false,
      exitPos: { col: 0, row: 0 },
      firedTrapIds: [],
    };
    expect(world.tiles).toHaveLength(4);
    expect(world.hazards).toHaveLength(1);
    expect(world.firedTrapIds).toHaveLength(0);
  });
});

describe('TrapEffect', () => {
  const cases: { label: string; effect: TrapEffect }[] = [
    {
      label: 'vanish-tiles',
      effect: {
        kind: 'vanish-tiles',
        tiles: [{ col: 1, row: 2 }] as TilePosition[],
      },
    },
    {
      label: 'add-hazard',
      effect: {
        kind: 'add-hazard',
        rect: { x: 0, y: 0, width: 16, height: 16 } as HazardRect,
      },
    },
    {
      label: 'add-dynamic-solid',
      effect: {
        kind: 'add-dynamic-solid',
        solid: {
          id: 'ds-0',
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          velocityX: 0,
          velocityY: 0,
          solid: true,
          lethal: false,
        },
      },
    },
    {
      label: 'remove-dynamic-solid',
      effect: { kind: 'remove-dynamic-solid', id: 'ds-0' },
    },
    { label: 'kill-player', effect: { kind: 'kill-player' } },
    {
      label: 'move-exit',
      effect: { kind: 'move-exit', position: { col: 3, row: 4 } as TilePosition },
    },
  ];

  for (const { label, effect } of cases) {
    it(`constructs ${label} variant`, () => {
      expect(effect.kind).toBe(label);
    });
  }
});

describe('TrapInstance', () => {
  it('satisfies the interface with all required members', () => {
    const inst: TrapInstance = {
      id: 't1',
      type: 'test',
      trigger: { kind: 'on-timer', delaySteps: 3 },
      armed: true,
      fired: false,
      stepsSinceArm: 0,
      evaluate: () => false,
      apply: () => {},
      reset: () => {},
    };
    expect(inst.id).toBe('t1');
    expect(inst.armed).toBe(true);
    expect(inst.fired).toBe(false);
  });
});

describe('TrapFactory', () => {
  it('produces a TrapInstance from a TrapEntry-like input', () => {
    const factory: TrapFactory = (entry) => ({
      id: entry.id,
      type: entry.type,
      trigger: { kind: 'on-timer', delaySteps: 1 },
      armed: true,
      fired: false,
      stepsSinceArm: 0,
      evaluate: () => true,
      apply: () => {},
      reset: () => {},
    });
    const inst = factory({
      id: 'f1',
      type: 'demo',
      trigger: 'on-timer',
      params: { delaySteps: 1 },
    });
    expect(inst.id).toBe('f1');
    expect(typeof inst.evaluate).toBe('function');
  });
});
