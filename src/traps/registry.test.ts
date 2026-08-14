import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TrapInstance } from './types';
import {
  clearRegistry,
  createTrap,
  isRegistered,
  registerTrapType,
} from './registry';

// Helper: a minimal factory that produces a no-op trap instance.
function noopFactory(entry: { id: string; type: string }): TrapInstance {
  return {
    id: entry.id,
    type: entry.type,
    trigger: { kind: 'on-timer', delaySteps: 0 },
    armed: true,
    fired: false,
    stepsSinceArm: 0,
    evaluate: () => false,
    apply: () => {},
    reset: () => {},
  };
}

beforeEach(() => {
  clearRegistry();
});

afterEach(() => {
  clearRegistry();
});

describe('registerTrapType', () => {
  it('registers a new type so isRegistered returns true', () => {
    registerTrapType('alpha', noopFactory);
    expect(isRegistered('alpha')).toBe(true);
  });

  it('throws on duplicate registration', () => {
    registerTrapType('beta', noopFactory);
    expect(() => registerTrapType('beta', noopFactory)).toThrow(
      /already registered/,
    );
  });

  it('allows distinct types to coexist', () => {
    registerTrapType('gamma', noopFactory);
    registerTrapType('delta', noopFactory);
    expect(isRegistered('gamma')).toBe(true);
    expect(isRegistered('delta')).toBe(true);
  });
});

describe('isRegistered', () => {
  it('returns false for an unregistered type', () => {
    expect(isRegistered('nonexistent')).toBe(false);
  });
});

describe('createTrap', () => {
  it('creates a TrapInstance from a registered factory', () => {
    registerTrapType('epsilon', noopFactory);
    const inst = createTrap({
      id: 'e1',
      type: 'epsilon',
      trigger: 'on-timer',
      params: {},
    });
    expect(inst.id).toBe('e1');
    expect(inst.type).toBe('epsilon');
    expect(inst.armed).toBe(true);
    expect(inst.fired).toBe(false);
  });

  it('passes params through to the factory', () => {
    registerTrapType('zeta', (entry) => ({
      id: entry.id,
      type: entry.type,
      trigger: { kind: 'on-timer', delaySteps: Number(entry.params['delaySteps']) },
      armed: true,
      fired: false,
      stepsSinceArm: 0,
      evaluate: () => false,
      apply: () => {},
      reset: () => {},
    }));
    const inst = createTrap({
      id: 'z1',
      type: 'zeta',
      trigger: 'on-timer',
      params: { delaySteps: 7 },
    });
    expect(inst.trigger.delaySteps).toBe(7);
  });

  it('throws on unknown trap type', () => {
    expect(() =>
      createTrap({
        id: 'x1',
        type: 'does-not-exist',
        trigger: 'on-timer',
        params: {},
      }),
    ).toThrow(/unknown trap type/);
  });
});

describe('clearRegistry', () => {
  it('removes all registered types', () => {
    registerTrapType('eta', noopFactory);
    expect(isRegistered('eta')).toBe(true);
    clearRegistry();
    expect(isRegistered('eta')).toBe(false);
  });
});
