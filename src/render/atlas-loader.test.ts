import { describe, expect, it } from 'vitest';
import atlasManifest from '../../assets/atlas.json';
import { AtlasLoadError, loadAtlas, type BitmapLike } from './atlas-loader';
import type { AtlasManifest } from './atlas';

const VALID_MANIFEST = atlasManifest as unknown as AtlasManifest;

function fakeBitmap(w: number, h: number): BitmapLike {
  return { width: w, height: h };
}

describe('loadAtlas', () => {
  it('loads a valid manifest and resolves all 14 frames', () => {
    const atlas = loadAtlas(VALID_MANIFEST, fakeBitmap(128, 40));

    expect(atlas.manifest).toBe(VALID_MANIFEST);

    const frameNames = Object.keys(atlas.frame);
    expect(frameNames).toHaveLength(14);

    // Spot-check a few known frames.
    expect(atlas.frame['player.idle.0']).toBeDefined();
    expect(atlas.frame['player.idle.0'].w).toBe(16);
    expect(atlas.frame['player.idle.0'].h).toBe(24);
    expect(atlas.frame['player.idle.0'].origin).toEqual({ x: 0, y: 8 });

    expect(atlas.frame['tile.solid.top']).toBeDefined();
    expect(atlas.frame['tile.solid.top'].w).toBe(16);
    expect(atlas.frame['tile.solid.top'].h).toBe(16);

    expect(atlas.frame['hazard.spikes']).toBeDefined();
  });

  it('rejects a manifest with wrong version', () => {
    const bad: AtlasManifest = {
      ...VALID_MANIFEST,
      version: 2 as unknown as 1,
    };

    expect(() => loadAtlas(bad, fakeBitmap(128, 40))).toThrow(AtlasLoadError);
    expect(() => loadAtlas(bad, fakeBitmap(128, 40))).toThrow(/version/);
  });

  it('rejects mismatched bitmap dimensions', () => {
    expect(() =>
      loadAtlas(VALID_MANIFEST, fakeBitmap(64, 40)),
    ).toThrow(AtlasLoadError);
    expect(() => loadAtlas(VALID_MANIFEST, fakeBitmap(64, 40))).toThrow(
      /dimensions/,
    );

    expect(() =>
      loadAtlas(VALID_MANIFEST, fakeBitmap(128, 20)),
    ).toThrow(AtlasLoadError);
  });

  it('rejects a manifest missing a required frame key', () => {
    const frames = { ...VALID_MANIFEST.frames };
    delete (frames as Record<string, unknown>)['player.jump'];

    const bad: AtlasManifest = {
      ...VALID_MANIFEST,
      frames: frames as AtlasManifest['frames'],
    };

    expect(() => loadAtlas(bad, fakeBitmap(128, 40))).toThrow(AtlasLoadError);
    expect(() => loadAtlas(bad, fakeBitmap(128, 40))).toThrow(/player\.jump/);
  });

  it('does not mutate the manifest or bitmap', () => {
    const manifestCopy: AtlasManifest = JSON.parse(
      JSON.stringify(VALID_MANIFEST),
    );
    const bitmap = fakeBitmap(128, 40);

    loadAtlas(manifestCopy, bitmap);

    expect(bitmap.width).toBe(128);
    expect(bitmap.height).toBe(40);
    expect(manifestCopy.version).toBe(1);
    expect(Object.keys(manifestCopy.frames)).toHaveLength(14);
  });
});
