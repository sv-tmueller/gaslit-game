import { describe, expect, it } from 'vitest';
import { createFakeUi, triggerFakeUi, stepFakeUi, dismissFakeUi, getFakeLoadingProgress } from './fake-ui';

describe('fake-ui', () => {
  it('starts inactive', () => {
    expect(createFakeUi(42).active).toBe(false);
  });
  it('trigger activates', () => {
    const s = triggerFakeUi(createFakeUi(42), 'fake-crash', 60);
    expect(s.active).toBe(true);
    expect(s.kind).toBe('fake-crash');
  });
  it('expires after duration', () => {
    let s = triggerFakeUi(createFakeUi(42), 'fake-pause', 3);
    s = stepFakeUi(s, 1/60);
    s = stepFakeUi(s, 1/60);
    s = stepFakeUi(s, 1/60);
    expect(s.active).toBe(false);
  });
  it('dismiss deactivates immediately', () => {
    let s = triggerFakeUi(createFakeUi(42), 'fake-settings', 60);
    s = dismissFakeUi(s);
    expect(s.active).toBe(false);
    expect(s.dismissed).toBe(true);
  });
  it('loading progress is between 0 and 0.9', () => {
    let s = triggerFakeUi(createFakeUi(42), 'fake-loading', 120);
    s = stepFakeUi(s, 1/60);
    const prog = getFakeLoadingProgress(s);
    expect(prog).toBeGreaterThanOrEqual(0);
    expect(prog).toBeLessThanOrEqual(0.9);
  });
  it('loading progress is 0 when not active', () => {
    const s = createFakeUi(42);
    expect(getFakeLoadingProgress(s)).toBe(0);
  });
});
