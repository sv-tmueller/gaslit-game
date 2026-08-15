import { describe, expect, it } from 'vitest';
import { getLevelStats, getAllStats, formatStats } from './stats';
import type { SavePayload } from '../save/schema';

function makePayload(): SavePayload {
  return {
    version: 2,
    levels: {
      'lvl-1': { attemptCount: 5, deathCount: 3, deathPositions: [], completed: true, unlocked: true },
      'lvl-2': { attemptCount: 10, deathCount: 8, deathPositions: [], completed: false, unlocked: true },
      'lvl-3': { attemptCount: 2, deathCount: 1, deathPositions: [], completed: true, unlocked: false },
    },
    settings: { muted: false, reducedMotion: false },
    currentPosition: 0,
  };
}

describe('stats', () => {
  it('getLevelStats returns per-level data', () => {
    const stats = getLevelStats(makePayload(), 'lvl-1');
    expect(stats.deaths).toBe(3);
    expect(stats.attempts).toBe(5);
    expect(stats.completed).toBe(true);
  });

  it('getAllStats aggregates totals', () => {
    const stats = getAllStats(makePayload());
    expect(stats.totalDeaths).toBe(12);
    expect(stats.totalAttempts).toBe(17);
    expect(stats.totalCompleted).toBe(2);
    expect(stats.totalLevels).toBe(3);
  });

  it('deadliest level is the one with most deaths', () => {
    const stats = getAllStats(makePayload());
    expect(stats.deadliestLevel).toBe('lvl-2');
    expect(stats.deadliestLevelDeaths).toBe(8);
  });

  it('completion rate is calculated', () => {
    const stats = getAllStats(makePayload());
    expect(stats.completionRate).toBeCloseTo(2/3);
  });

  it('formatStats produces readable lines', () => {
    const stats = getAllStats(makePayload());
    const lines = formatStats(stats);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain('DEATHS:');
    expect(lines.some(l => l.includes('DEADLIEST:'))).toBe(true);
  });

  it('empty payload produces zero stats', () => {
    const empty: SavePayload = {
      version: 2, levels: {},
      settings: { muted: false, reducedMotion: false }, currentPosition: 0,
    };
    const stats = getAllStats(empty);
    expect(stats.totalDeaths).toBe(0);
    expect(stats.deadliestLevel).toBeNull();
    expect(stats.completionRate).toBe(0);
  });
});
