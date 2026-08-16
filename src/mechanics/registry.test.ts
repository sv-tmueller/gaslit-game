import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MechanicEntry } from '../levels/types';
import type { MechanicInstance, MechanicStepResult } from './types';
import {
  clearRegistry,
  createMechanic,
  isRegistered,
  registerMechanicType,
} from './registry';

function noopMechanic(entry: MechanicEntry): MechanicInstance {
  return {
    id: entry.id,
    type: entry.type,
    step(): MechanicStepResult {
      return {};
    },
    reset() {},
  };
}

beforeEach(() => {
  clearRegistry();
});

afterEach(() => {
  clearRegistry();
});

describe('mechanic registry', () => {
  it('registers and resolves a mechanic type', () => {
    registerMechanicType('noop', noopMechanic);
    expect(isRegistered('noop')).toBe(true);

    const entry: MechanicEntry = { id: 'm1', type: 'noop', params: {} };
    const inst = createMechanic(entry);
    expect(inst.id).toBe('m1');
    expect(inst.type).toBe('noop');
  });

  it('throws when registering a duplicate type', () => {
    registerMechanicType('noop', noopMechanic);
    expect(() => registerMechanicType('noop', noopMechanic)).toThrow(
      'already registered',
    );
  });

  it('throws when creating an unknown type', () => {
    expect(() =>
      createMechanic({ id: 'x', type: 'unknown', params: {} }),
    ).toThrow('unknown mechanic type "unknown"');
  });

  it('reports unregistered types as not registered', () => {
    expect(isRegistered('nothing')).toBe(false);
  });

  it('clears all registrations', () => {
    registerMechanicType('a', noopMechanic);
    registerMechanicType('b', noopMechanic);
    clearRegistry();
    expect(isRegistered('a')).toBe(false);
    expect(isRegistered('b')).toBe(false);
  });
});
