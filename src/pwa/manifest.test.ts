import { describe, expect, it } from 'vitest';
import { createManifest, createMetaTags, createSwVersion, getCachedAssetKey } from './manifest';

describe('PWA manifest', () => {
  it('creates manifest with correct name', () => {
    const m = createManifest();
    expect(m.name).toBe('Pitfall');
    expect(m.display).toBe('fullscreen');
  });

  it('has icons', () => {
    const m = createManifest();
    expect(m.icons.length).toBeGreaterThan(0);
  });

  it('creates meta tags', () => {
    const tags = createMetaTags();
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.some(t => t.property === 'og:title')).toBe(true);
  });

  it('SW version generates cache keys', () => {
    const sw = createSwVersion('2.0.0');
    expect(getCachedAssetKey(sw, '/index.html')).toBe('pitfall-2.0.0-/index.html');
  });
});
