import { describe, expect, it } from 'vitest';
import { createPressKit } from './press-kit';

describe('press kit', () => {
  it('creates a press kit with fact sheet', () => {
    const pk = createPressKit();
    expect(pk.factSheet.studio).toBeTruthy();
    expect(pk.factSheet.platforms.length).toBeGreaterThan(0);
  });

  it('has one-line and paragraph descriptions', () => {
    const pk = createPressKit();
    expect(pk.oneLineDescription.length).toBeLessThan(200);
    expect(pk.paragraphDescription.length).toBeGreaterThan(pk.oneLineDescription.length);
  });

  it('lists logo and screenshot files', () => {
    const pk = createPressKit();
    expect(pk.logoFiles.length).toBeGreaterThan(0);
    expect(pk.screenshotPaths.length).toBeGreaterThan(0);
  });
});
