import { describe, expect, it } from 'vitest';
import { createAnalyticsCollector, recordEvent, getDropoffLevels, isCookieFree } from './analytics';

describe('analytics', () => {
  it('starts empty', () => {
    const c = createAnalyticsCollector();
    expect(c.events).toHaveLength(0);
  });

  it('records level-start', () => {
    let c = createAnalyticsCollector();
    c = recordEvent(c, { type: 'level-start', levelId: 'lvl-1', timestamp: 0 });
    expect(c.levelData['lvl-1']!.starts).toBe(1);
  });

  it('records death', () => {
    let c = createAnalyticsCollector();
    c = recordEvent(c, { type: 'level-start', levelId: 'lvl-1', timestamp: 0 });
    c = recordEvent(c, { type: 'death', levelId: 'lvl-1', timestamp: 60 });
    expect(c.levelData['lvl-1']!.deaths).toBe(1);
  });

  it('calculates completion rate', () => {
    let c = createAnalyticsCollector();
    c = recordEvent(c, { type: 'level-start', levelId: 'lvl-1', timestamp: 0 });
    c = recordEvent(c, { type: 'level-start', levelId: 'lvl-1', timestamp: 100 });
    c = recordEvent(c, { type: 'level-complete', levelId: 'lvl-1', timestamp: 200 });
    expect(c.levelData['lvl-1']!.completionRate).toBe(0.5);
  });

  it('getDropoffLevels finds hard levels', () => {
    let c = createAnalyticsCollector();
    for (let i = 0; i < 10; i++) {
      c = recordEvent(c, { type: 'level-start', levelId: 'hard', timestamp: i });
    }
    c = recordEvent(c, { type: 'level-complete', levelId: 'hard', timestamp: 100 });
    const dropoffs = getDropoffLevels(c);
    expect(dropoffs).toContain('hard');
  });

  it('is cookie-free', () => {
    expect(isCookieFree()).toBe(true);
  });
});
