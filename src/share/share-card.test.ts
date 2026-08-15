import { describe, expect, it } from 'vitest';
import { createShareCardData, layoutShareCard, renderShareCard, shareCardToDataURL } from './share-card';

describe('share card', () => {
  it('creates card data', () => {
    const data = createShareCardData(42, 3600, 'spike-room', 15, 10, 15);
    expect(data.totalDeaths).toBe(42);
    expect(data.deadliestLevel).toBe('spike-room');
  });

  it('layouts card with stats lines', () => {
    const data = createShareCardData(42, 3600, 'spike-room', 15, 10, 15);
    const layout = layoutShareCard(data);
    expect(layout.width).toBe(320);
    expect(layout.statsLines.length).toBe(4);
    expect(layout.statsLines[0]).toContain('DEATHS: 42');
  });

  it('renderShareCard does not throw with mock ctx', () => {
    const data = createShareCardData(0, 0, '', 0, 0, 0);
    const layout = layoutShareCard(data);
    const calls: string[] = [];
    renderShareCard(layout, {
      fillStyle: '',
      fillRect(x, y, w, h) { calls.push(`fillRect:${x},${y},${w},${h}`); },
    });
    expect(calls.length).toBeGreaterThan(0);
  });

  it('shareCardToDataURL returns a data URL', () => {
    const data = createShareCardData(0, 0, '', 0, 0, 0);
    const layout = layoutShareCard(data);
    const url = shareCardToDataURL(layout);
    expect(url.startsWith('data:image/')).toBe(true);
  });
});
