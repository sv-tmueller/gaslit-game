// Barrel registration for all concrete trap types.
// Importing this module registers every trap factory in the registry.
// Games import this once at startup; tests import individual factories.

import { registerTrapType } from '../registry';
import { createVanishingFloor } from './vanishing-floor';
import { createEmergingSpikes } from './emerging-spikes';
import { createCrusher } from './crusher';
import { createShiftingWall } from './shifting-wall';
import { createFakeExit } from './fake-exit';

let registered = false;

export function registerAllTrapTypes(): void {
  if (registered) return;
  registerTrapType('vanishing-floor', createVanishingFloor);
  registerTrapType('emerging-spikes', createEmergingSpikes);
  registerTrapType('crusher', createCrusher);
  registerTrapType('shifting-wall', createShiftingWall);
  registerTrapType('fake-exit', createFakeExit);
  registered = true;
}

// Re-export individual factories for tests that want to register selectively.
export { createVanishingFloor } from './vanishing-floor';
export { createEmergingSpikes } from './emerging-spikes';
export { createCrusher } from './crusher';
export { createShiftingWall } from './shifting-wall';
export { createFakeExit } from './fake-exit';
