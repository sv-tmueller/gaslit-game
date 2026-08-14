// Global trap-type registry. Concrete trap packages call registerTrapType()
// at import time to plug their factory into the map. The runtime calls
// createTrap() to instantiate each trap from a level's TrapEntry.
//
// The registry is a module-level singleton (Map). Tests MUST call
// clearRegistry() in beforeEach/afterEach to avoid cross-test pollution.

import type { TrapEntry } from '../levels/types';
import type { TrapFactory, TrapInstance } from './types';

const registry = new Map<string, TrapFactory>();

/**
 * Registers a trap type factory. Throws if the type is already registered
 * to prevent silent shadowing of one package's trap by another.
 */
export function registerTrapType(type: string, factory: TrapFactory): void {
  if (registry.has(type)) {
    throw new Error(`trap type "${type}" already registered`);
  }
  registry.set(type, factory);
}

/**
 * Instantiates a TrapInstance from a TrapEntry by looking up its registered
 * factory. Throws if the trap type is unknown.
 */
export function createTrap(entry: TrapEntry): TrapInstance {
  const factory = registry.get(entry.type);
  if (!factory) {
    throw new Error(`unknown trap type "${entry.type}"`);
  }
  return factory(entry);
}

/**
 * Predicate: has a trap type been registered?
 */
export function isRegistered(type: string): boolean {
  return registry.has(type);
}

/**
 * Removes all registered trap types. Primarily for test isolation.
 */
export function clearRegistry(): void {
  registry.clear();
}
