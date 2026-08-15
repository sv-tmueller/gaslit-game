import { describe, expect, it } from 'vitest';
import { createGravity, invertGravity, stepGravity, stepControllerWithGravity } from './gravity';
import { createControllerState, type ControllerActions } from '../engine/controller';
import { parseGrid } from '../engine/testGrid';

const DT = 1 / 60;
const actions: ControllerActions = { left: false, right: false, jumpPressed: false, jumpHeld: false };
const grid = parseGrid(['....', '.##.', '....']);

describe('gravity', () => {
  it('starts with direction 1', () => {
    expect(createGravity().direction).toBe(1);
  });
  it('invertGravity flips direction', () => {
    const g = createGravity();
    expect(invertGravity(g).direction).toBe(-1);
    expect(invertGravity(invertGravity(g)).direction).toBe(1);
  });
  it('transition timer decrements', () => {
    let g = invertGravity(createGravity());
    g = stepGravity(g, DT);
    expect(g.transitionTimer).toBe(11);
  });
  it('stepControllerWithGravity with normal gravity matches stepController', () => {
    const cs = createControllerState({ x: 16, y: 16, width: 16, height: 16, velocity: { x: 0, y: 0 }, grounded: false });
    const r1 = stepControllerWithGravity(cs, actions, grid, DT, 1);
    const r2 = stepControllerWithGravity(cs, actions, grid, DT, 1);
    expect(r1).toEqual(r2);
  });
});
