// Global mechanic-type registry. Concrete mechanic adapter packages call
// registerMechanicType() at import time to plug their factory into the map.
// The runtime calls createMechanic() to instantiate each mechanic from a
// level's MechanicEntry.
//
// The registry is a module-level singleton (Map). Tests MUST call
// clearRegistry() in beforeEach/afterEach to avoid cross-test pollution.
//
// Mirrors src/traps/registry.ts exactly.

import type { MechanicEntry } from '../levels/types';
import type { MechanicFactory, MechanicInstance } from './types';

const registry = new Map<string, MechanicFactory>();

/**
 * Registers a mechanic type factory. Throws if the type is already registered
 * to prevent silent shadowing of one package's mechanic by another.
 */
export function registerMechanicType(type: string, factory: MechanicFactory): void {
  if (registry.has(type)) {
    throw new Error(`mechanic type "${type}" already registered`);
  }
  registry.set(type, factory);
}

/**
 * Instantiates a MechanicInstance from a MechanicEntry by looking up its
 * registered factory. Throws if the mechanic type is unknown.
 */
export function createMechanic(entry: MechanicEntry): MechanicInstance {
  const factory = registry.get(entry.type);
  if (!factory) {
    throw new Error(`unknown mechanic type "${entry.type}"`);
  }
  return factory(entry);
}

/**
 * Predicate: has a mechanic type been registered?
 */
export function isRegistered(type: string): boolean {
  return registry.has(type);
}

/**
 * Removes all registered mechanic types. Primarily for test isolation.
 */
export function clearRegistry(): void {
  registry.clear();
}
