import { describe, expect, it } from 'vitest';
import { createCameraTroll, triggerCameraTroll, stepCameraTroll, isActive } from './camera-troll';

describe('camera-troll', () => {
  it('starts inactive', () => {
    expect(isActive(createCameraTroll('zoom', 1))).toBe(false);
  });
  it('trigger activates troll', () => {
    const s = triggerCameraTroll(createCameraTroll('zoom', 1), 30);
    expect(isActive(s)).toBe(true);
    expect(s.zoom).toBe(1.5);
  });
  it('flip troll sets flipped', () => {
    const s = triggerCameraTroll(createCameraTroll('flip', 1), 30);
    expect(s.flipped).toBe(true);
  });
  it('offset troll sets offset', () => {
    const s = triggerCameraTroll(createCameraTroll('offset', 1), 30);
    expect(s.offsetX).toBe(32);
  });
  it('expires after duration', () => {
    let s = triggerCameraTroll(createCameraTroll('zoom', 1), 3);
    s = stepCameraTroll(s, 1/60);
    s = stepCameraTroll(s, 1/60);
    s = stepCameraTroll(s, 1/60);
    expect(isActive(s)).toBe(false);
    expect(s.zoom).toBe(1);
  });
});
