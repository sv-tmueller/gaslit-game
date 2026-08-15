import { describe, expect, it } from 'vitest';
import { createTimer, startTimer, stepTimer, stopTimer, completeLevel, advanceToNextLevel, toggleVisible, stepsToTimeString, recordBest, getBest } from './speedrun';

describe('speedrun timer', () => {
  it('starts at zero', () => {
    const t = createTimer();
    expect(t.currentSteps).toBe(0);
    expect(t.totalSteps).toBe(0);
    expect(t.running).toBe(false);
  });

  it('does not advance when stopped', () => {
    let t = createTimer();
    t = stepTimer(t, 1/60);
    expect(t.currentSteps).toBe(0);
  });

  it('advances when running', () => {
    let t = startTimer(createTimer());
    t = stepTimer(t, 1/60);
    t = stepTimer(t, 1/60);
    t = stepTimer(t, 1/60);
    expect(t.currentSteps).toBe(3);
    expect(t.totalSteps).toBe(3);
  });

  it('stop halts counting', () => {
    let t = startTimer(createTimer());
    t = stepTimer(t, 1/60);
    t = stopTimer(t);
    t = stepTimer(t, 1/60);
    expect(t.currentSteps).toBe(1);
  });

  it('advanceToNextLevel resets current but keeps total', () => {
    let t = startTimer(createTimer());
    t = stepTimer(t, 1/60);
    t = stepTimer(t, 1/60);
    t = completeLevel(t);
    t = advanceToNextLevel(t);
    expect(t.currentSteps).toBe(0);
    expect(t.totalSteps).toBe(2);
    expect(t.running).toBe(true);
  });

  it('toggleVisible flips visibility', () => {
    let t = createTimer(true);
    t = toggleVisible(t);
    expect(t.visible).toBe(false);
  });

  it('stepsToTimeString formats correctly', () => {
    expect(stepsToTimeString(0)).toBe('0:00.00');
    expect(stepsToTimeString(60)).toBe('0:01.00');
    expect(stepsToTimeString(3600)).toBe('1:00.00');
    expect(stepsToTimeString(90)).toBe('0:01.50');
  });

  it('recordBest stores best time', () => {
    let bests: Record<string, number> = {};
    bests = recordBest(bests, 'lvl-1', 100) as Record<string, number>;
    expect(getBest(bests, 'lvl-1')).toBe(100);
  });

  it('recordBest does not overwrite with worse time', () => {
    let bests: Record<string, number> = { 'lvl-1': 100 };
    bests = recordBest(bests, 'lvl-1', 150) as Record<string, number>;
    expect(getBest(bests, 'lvl-1')).toBe(100);
  });

  it('recordBest overwrites with better time', () => {
    let bests: Record<string, number> = { 'lvl-1': 100 };
    bests = recordBest(bests, 'lvl-1', 50) as Record<string, number>;
    expect(getBest(bests, 'lvl-1')).toBe(50);
  });

  it('getBest returns undefined for unknown level', () => {
    expect(getBest({}, 'unknown')).toBeUndefined();
  });
});
