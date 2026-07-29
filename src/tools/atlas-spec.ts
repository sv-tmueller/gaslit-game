// src/tools/**: build-time-only, node-only. Never imported by src/main.ts,
// src/engine/**, or src/render/**.
import type { AtlasFrame, AtlasManifest } from '../render/atlas.ts';
import { PALETTE, PALETTE_ORDER } from '../render/palette.ts';
import { ART, CHAR_TO_INDEX, type ArtFrame } from './atlas-art.ts';
import { encodeIndexedPng } from './png.ts';

export const ATLAS_WIDTH = 128;

export interface PackedFrame extends ArtFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Packs frames left to right in declaration order, wrapping to a new row when a
 * frame would exceed ATLAS_WIDTH. No padding or extrusion between frames: the
 * renderer samples 1:1 with imageSmoothingEnabled = false, so there is nothing
 * for a gutter to protect against.
 */
export function packFrames(frames: readonly ArtFrame[]): PackedFrame[] {
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  const placed: PackedFrame[] = [];

  for (const frame of frames) {
    const w = frame.rows[0]?.length ?? 0;
    const h = frame.rows.length;

    if (cursorX + w > ATLAS_WIDTH) {
      cursorY += rowHeight;
      cursorX = 0;
      rowHeight = 0;
    }

    placed.push({ ...frame, x: cursorX, y: cursorY, w, h });
    cursorX += w;
    rowHeight = Math.max(rowHeight, h);
  }

  return placed;
}

export interface BuiltAtlas {
  png: Uint8Array;
  manifest: AtlasManifest;
}

export function buildAtlas(): BuiltAtlas {
  const placements = packFrames(ART);

  const atlasHeight = placements.reduce((max, p) => Math.max(max, p.y + p.h), 0);

  const indices = new Uint8Array(ATLAS_WIDTH * atlasHeight); // defaults to 0 (transparent)
  for (const p of placements) {
    for (let ry = 0; ry < p.h; ry++) {
      const row = p.rows[ry] ?? '';
      for (let rx = 0; rx < p.w; rx++) {
        const ch = row[rx] as keyof typeof CHAR_TO_INDEX;
        const index = CHAR_TO_INDEX[ch];
        indices[(p.y + ry) * ATLAS_WIDTH + (p.x + rx)] = index;
      }
    }
  }

  // PLTE order: index 0 reserved transparent (black), then PALETTE_ORDER 1-6.
  // This is what makes the committed PNG a machine-readable copy of the palette.
  const palette: Array<readonly [number, number, number]> = [
    [0, 0, 0],
    ...PALETTE_ORDER.map((token): readonly [number, number, number] => {
      const hex = PALETTE[token];
      return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
    }),
  ];

  const png = encodeIndexedPng({
    width: ATLAS_WIDTH,
    height: atlasHeight,
    indices,
    palette,
  });

  // Frames object is built by inserting keys in ART/placement order, not sorted:
  // every frame name contains a dot, so none parses as an integer-like key, which
  // is what keeps that insertion order stable across JS engines.
  const frames = {} as Record<string, AtlasFrame>;
  for (const p of placements) {
    frames[p.name] = { x: p.x, y: p.y, w: p.w, h: p.h, origin: p.origin };
  }

  const manifest: AtlasManifest = {
    version: 1,
    image: 'atlas.png',
    width: ATLAS_WIDTH,
    height: atlasHeight,
    frames: frames as AtlasManifest['frames'],
  };

  return { png, manifest };
}
