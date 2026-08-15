import { describe, expect, it } from 'vitest';
import { createEffects, isEffectsFrozen, onDeath, onLand, onTrapFire, stepEffects } from './index';

describe('effects manager', () => {
  it('creates with all subsystems', () => {
    const mgr = createEffects(42, 1);
    expect(mgr.shake).toBeDefined();
    expect(mgr.particles).toBeDefined();
    expect(mgr.hitStop).toBeDefined();
  });

  it('onDeath triggers shake, particles, and hit-stop', () => {
    const mgr = createEffects(42, 1);
    const after = onDeath(mgr, 100, 50);
    expect(after.shake.magnitude).toBeGreaterThan(0);
    expect(after.particles.particles.length).toBeGreaterThan(0);
    expect(isEffectsFrozen(after)).toBe(true);
  });

  it('onLand spawns dust particles', () => {
    const mgr = createEffects(42, 1);
    const after = onLand(mgr, 100, 50, 200);
    expect(after.particles.particles.length).toBeGreaterThan(0);
    expect(after.shake.magnitude).toBeGreaterThan(0); // hard impact
  });

  it('soft landing does not shake', () => {
    const mgr = createEffects(42, 1);
    const after = onLand(mgr, 100, 50, 50);
    expect(after.shake.magnitude).toBe(0);
  });

  it('onTrapFire triggers shake and particles', () => {
    const mgr = createEffects(42, 1);
    const after = onTrapFire(mgr, 100, 50);
    expect(after.shake.magnitude).toBeGreaterThan(0);
    expect(after.particles.particles.length).toBeGreaterThan(0);
  });

  it('stepEffects advances all subsystems', () => {
    const mgr = onDeath(createEffects(42, 1), 100, 50);
    const stepped = stepEffects(mgr, 1/60);
    expect(stepped.hitStop.remainingSteps).toBeLessThan(mgr.hitStop.remainingSteps);
  });

  it('intensity 0 disables all effects', () => {
    const mgr = createEffects(42, 0);
    const after = onDeath(mgr, 100, 50);
    expect(after.shake.magnitude).toBe(0);
    expect(after.particles.particles.length).toBe(0);
    expect(isEffectsFrozen(after)).toBe(false);
  });
})
