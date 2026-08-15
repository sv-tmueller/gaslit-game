import { describe, expect, it } from 'vitest';
import { checkBudget, formatBytes, createPerfOverlay, recordFrameTime, getAverageFrameTime, getMaxFrameTime } from './budget';

describe('performance budget', () => {
  it('passes when under thresholds', () => {
    const report = checkBudget(100_000, 10);
    expect(report.allPass).toBe(true);
  });

  it('fails when bundle exceeds', () => {
    const report = checkBudget(300_000, 10);
    expect(report.bundlePasses).toBe(false);
    expect(report.allPass).toBe(false);
  });

  it('fails when frame time exceeds', () => {
    const report = checkBudget(100_000, 20);
    expect(report.framePasses).toBe(false);
    expect(report.allPass).toBe(false);
  });

  it('formatBytes formats correctly', () => {
    expect(formatBytes(500)).toBe('500B');
    expect(formatBytes(1024)).toBe('1.0KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00MB');
  });

  it('perf overlay records frame times', () => {
    let overlay = createPerfOverlay();
    overlay = recordFrameTime(overlay, 10);
    overlay = recordFrameTime(overlay, 20);
    overlay = recordFrameTime(overlay, 30);
    expect(getAverageFrameTime(overlay)).toBeCloseTo(20);
    expect(getMaxFrameTime(overlay)).toBe(30);
  });

  it('perf overlay caps samples', () => {
    let overlay = createPerfOverlay();
    for (let i = 0; i < 100; i++) overlay = recordFrameTime(overlay, i);
    expect(overlay.frameSamples.length).toBe(60);
  });
});
