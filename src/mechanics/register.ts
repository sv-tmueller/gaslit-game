// Barrel registration for all concrete mechanic types.
// Importing this module registers every mechanic factory in the registry.
// Games import this once at startup; tests import individual factories.

import { isRegistered, registerMechanicType } from './registry';
import { createSpringMechanic } from './adapters';
import { createTeleporterMechanic } from './adapters';
import { createGravityZoneMechanic } from './adapters';
import { createMovingPlatformMechanic } from './adapters';
import { createJetpackMechanic } from './adapters';
import { createLeverMechanic } from './adapters';
import { createControlInversionMechanic } from './adapters';
import { createCameraTrollMechanic } from './adapters';
import { createFakeUiMechanic } from './adapters';
import { createBuzzsawMechanic } from './adapters';
import { createRotatingArmMechanic } from './adapters';
import { createBombMechanic } from './adapters';
import { createTokenMechanic } from './adapters';

export function registerAllMechanicTypes(): void {
  // Guard against double-registration by checking the registry itself (not a
  // flag). This ensures correctness after clearRegistry() in tests: the types
  // are gone, so re-registration proceeds normally.
  if (isRegistered('spring')) return;
  registerMechanicType('spring', createSpringMechanic);
  registerMechanicType('teleporter', createTeleporterMechanic);
  registerMechanicType('gravity-zone', createGravityZoneMechanic);
  registerMechanicType('moving-platform', createMovingPlatformMechanic);
  registerMechanicType('jetpack', createJetpackMechanic);
  registerMechanicType('lever', createLeverMechanic);
  registerMechanicType('control-inversion', createControlInversionMechanic);
  registerMechanicType('camera-troll', createCameraTrollMechanic);
  registerMechanicType('fake-ui', createFakeUiMechanic);
  registerMechanicType('buzzsaw', createBuzzsawMechanic);
  registerMechanicType('rotating-arm', createRotatingArmMechanic);
  registerMechanicType('bomb', createBombMechanic);
  registerMechanicType('token', createTokenMechanic);
}

// Re-export individual factories for tests that want to register selectively.
export {
  createSpringMechanic,
  createTeleporterMechanic,
  createGravityZoneMechanic,
  createMovingPlatformMechanic,
  createJetpackMechanic,
  createLeverMechanic,
  createControlInversionMechanic,
  createCameraTrollMechanic,
  createFakeUiMechanic,
  createBuzzsawMechanic,
  createRotatingArmMechanic,
  createBombMechanic,
  createTokenMechanic,
} from './adapters';
