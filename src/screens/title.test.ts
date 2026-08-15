import { describe, expect, it } from 'vitest';
import { createTitleState, stepTitle, getTitleTransition, buildTitleModel } from './title';
import type { InputSnapshot } from '../engine/input';

function snap(pressed: Partial<Record<string, boolean>> = {}, held: Partial<Record<string, boolean>> = {}): InputSnapshot {
  const empty = { left: false, right: false, jump: false, restart: false, pause: false };
  return {
    held: { ...empty, ...held },
    pressed: { ...empty, ...pressed },
    released: { ...empty },
  };
}

const DT = 1 / 60;

describe('title screen', () => {
  it('starts with instructions hidden and option 0', () => {
    const s = createTitleState();
    expect(s.showInstructions).toBe(false);
    expect(s.selectedOption).toBe(0);
  });

  it('right arrow moves to option 1', () => {
    let s = createTitleState();
    s = stepTitle(s, snap({ right: true }), DT);
    expect(s.selectedOption).toBe(1);
  });

  it('left arrow wraps to last option', () => {
    let s = createTitleState();
    s = stepTitle(s, snap({ left: true }), DT);
    expect(s.selectedOption).toBe(1);
  });

  it('jump on option 1 toggles instructions', () => {
    let s = createTitleState();
    s = stepTitle(s, snap({ right: true }), DT);
    s = stepTitle(s, snap({ jump: true }), DT);
    expect(s.showInstructions).toBe(true);
  });

  it('getTitleTransition returns start on option 0 + jump', () => {
    const s = createTitleState();
    expect(getTitleTransition(s, snap({ jump: true }))).toBe('start');
  });

  it('getTitleTransition returns how-to-play on option 1 + jump', () => {
    let s = createTitleState();
    s = stepTitle(s, snap({ right: true }), DT);
    expect(getTitleTransition(s, snap({ jump: true }))).toBe('how-to-play');
  });

  it('getTitleTransition returns null without jump', () => {
    const s = createTitleState();
    expect(getTitleTransition(s, snap())).toBeNull();
  });

  it('flash timer cycles 0-59', () => {
    let s = createTitleState();
    s = stepTitle(s, snap(), DT);
    expect(s.flashTimer).toBe(1);
  });

  it('buildTitleModel produces a render model with title.mark sprite', () => {
    const s = createTitleState();
    const model = buildTitleModel(s);
    expect(model.clear).toBe('void');
    expect(model.layers[0]!.sprites.length).toBeGreaterThan(0);
    expect(model.layers[0]!.sprites[0]!.frame).toBe('title.mark');
  });
});
