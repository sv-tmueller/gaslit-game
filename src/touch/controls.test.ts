import { describe, expect, it } from 'vitest';
import { createTouchControls, updateTouchButtons, getTouchActions, isMobileLayout } from './controls';

describe('touch controls', () => {
  it('creates phone layout for narrow screens', () => {
    const state = createTouchControls(375, 667);
    expect(state.layout).toBe('phone');
    expect(state.buttons).toHaveLength(4);
  });

  it('creates tablet layout for medium screens', () => {
    const state = createTouchControls(800, 600);
    expect(state.layout).toBe('tablet');
  });

  it('creates none layout for wide screens', () => {
    const state = createTouchControls(1920, 1080);
    expect(state.layout).toBe('none');
    expect(state.buttons).toHaveLength(0);
  });

  it('updateTouchButtons activates button on touch', () => {
    const state = createTouchControls(375, 667);
    const leftBtn = state.buttons.find(b => b.action === 'left')!;
    const updated = updateTouchButtons(state, [{ x: leftBtn.x, y: leftBtn.y }]);
    const actions = getTouchActions(updated);
    expect(actions.left).toBe(true);
  });

  it('updateTouchButtons deactivates when no touch', () => {
    const state = createTouchControls(375, 667);
    const updated = updateTouchButtons(state, []);
    const actions = getTouchActions(updated);
    expect(actions.left).toBe(false);
  });

  it('isMobileLayout returns true for phone/tablet', () => {
    expect(isMobileLayout(createTouchControls(375, 667))).toBe(true);
    expect(isMobileLayout(createTouchControls(1920, 1080))).toBe(false);
  });
});
