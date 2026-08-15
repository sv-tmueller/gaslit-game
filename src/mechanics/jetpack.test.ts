import { describe, expect, it } from 'vitest';
import { createJetpack, equipJetpack, unequipJetpack, stepJetpack, getJetpackVelocityMod, hasFuel } from './jetpack';

describe('jetpack', () => {
  it('starts inactive with full fuel', () => {
    const jp = createJetpack(100, 300);
    expect(jp.active).toBe(false);
    expect(jp.fuel).toBe(100);
    expect(hasFuel(jp)).toBe(true);
  });
  it('equip activates jetpack', () => {
    const jp = equipJetpack(createJetpack(100, 300));
    expect(jp.active).toBe(true);
  });
  it('fuel depletes when thrusting', () => {
    let jp = equipJetpack(createJetpack(10, 300));
    jp = stepJetpack(jp, true, 1/60);
    expect(jp.fuel).toBe(9);
  });
  it('fuel does not deplete when not thrusting', () => {
    let jp = equipJetpack(createJetpack(10, 300));
    jp = stepJetpack(jp, false, 1/60);
    expect(jp.fuel).toBe(10);
  });
  it('no thrust when fuel is 0', () => {
    const jp = { ...createJetpack(1, 300), fuel: 0, active: true };
    expect(getJetpackVelocityMod(jp, 1/60)).toBe(0);
  });
  it('thrust returns negative velocity (upward)', () => {
    const jp = equipJetpack(createJetpack(100, 300));
    expect(getJetpackVelocityMod(jp, 1/60)).toBe(-300);
  });
  it('inactive jetpack produces no thrust', () => {
    const jp = createJetpack(100, 300);
    expect(getJetpackVelocityMod(jp, 1/60)).toBe(0);
  });
  it('unequip deactivates', () => {
    let jp = equipJetpack(createJetpack(100, 300));
    jp = unequipJetpack(jp);
    expect(jp.active).toBe(false);
  });
});
