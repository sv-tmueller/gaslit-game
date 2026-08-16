import { describe, expect, it } from 'vitest';
import type { Body } from '../engine/physics';
import type { ControllerActions } from '../engine/controller';
import type {
  CosmeticEffect,
  MechanicContext,
  MechanicInstance,
  MechanicStepResult,
} from './types';

describe('mechanic types', () => {
  it('constructs a MechanicContext', () => {
    const body: Body = {
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      velocity: { x: 0, y: 0 },
      grounded: false,
    };
    const actions: ControllerActions = {
      left: false,
      right: false,
      jumpPressed: false,
      jumpHeld: false,
    };
    const ctx: MechanicContext = { body, actions, step: 0 };

    expect(ctx.body).toBe(body);
    expect(ctx.actions).toBe(actions);
    expect(ctx.step).toBe(0);
  });

  it('allows an empty MechanicStepResult', () => {
    const result: MechanicStepResult = {};
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('constructs a MechanicStepResult with all fields', () => {
    const body: Body = {
      x: 100,
      y: 200,
      width: 16,
      height: 16,
      velocity: { x: 0, y: 0 },
      grounded: false,
    };
    const actions: ControllerActions = {
      left: true,
      right: false,
      jumpPressed: false,
      jumpHeld: false,
    };
    const result: MechanicStepResult = {
      bodyOverride: body,
      velocityMod: { y: -400 },
      actionsOverride: actions,
      dynamicSolids: [],
      hazardsToAdd: [{ x: 0, y: 0, width: 16, height: 16 }],
      cosmeticState: { cameraTrolls: [], fakeUiStates: [] },
    };

    expect(result.bodyOverride).toBe(body);
    expect(result.velocityMod?.y).toBe(-400);
    expect(result.actionsOverride).toBe(actions);
    expect(result.dynamicSolids).toHaveLength(0);
    expect(result.hazardsToAdd).toHaveLength(1);
  });

  it('implements MechanicInstance interface', () => {
    const inst: MechanicInstance = {
      id: 'test',
      type: 'noop',
      step() {
        return {};
      },
      reset() {},
    };

    expect(inst.id).toBe('test');
    expect(inst.step({ body: {} as Body, actions: {} as ControllerActions, step: 0 })).toEqual({});
  });

  it('constructs CosmeticEffect with snapshots', () => {
    const cosmetic: CosmeticEffect = {
      cameraTrolls: [
        {
          kind: 'zoom',
          active: true,
          zoom: 1.5,
          flipped: false,
          offsetX: 0,
          offsetY: 0,
          lagFrames: 0,
        },
      ],
      fakeUiStates: [
        { kind: 'fake-crash', active: true, timer: 30 },
      ],
    };

    expect(cosmetic.cameraTrolls).toHaveLength(1);
    expect(cosmetic.fakeUiStates).toHaveLength(1);
  });
});
