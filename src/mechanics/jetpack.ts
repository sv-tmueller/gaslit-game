// Jetpack: temporary thrust-based flight with limited fuel.

export interface JetpackState {
  active: boolean;
  fuel: number;
  maxFuel: number;
  thrustPower: number;
}

export function createJetpack(maxFuel: number, thrustPower: number): JetpackState {
  return { active: false, fuel: maxFuel, maxFuel, thrustPower };
}

export function equipJetpack(state: JetpackState): JetpackState {
  return { ...state, active: true, fuel: state.maxFuel };
}

export function unequipJetpack(state: JetpackState): JetpackState {
  return { ...state, active: false };
}

export function stepJetpack(state: JetpackState, thrusting: boolean, _dt: number): JetpackState {
  void _dt;
  if (!state.active || !thrusting || state.fuel <= 0) return state;
  return { ...state, fuel: state.fuel - 1 };
}

export function getJetpackVelocityMod(state: JetpackState, _dt: number): number {
  void _dt;
  if (!state.active || state.fuel <= 0) return 0;
  return -state.thrustPower;
}

export function hasFuel(state: JetpackState): boolean {
  return state.fuel > 0;
}
