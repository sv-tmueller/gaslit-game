// src/tools/**: build-time-only, node-only. Never imported by src/main.ts,
// src/engine/**, or src/render/**.
//
// Reads the committed assets/, not the code path that generates them, so a
// stale commit or a drifted generator both fail loudly.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AtlasManifest } from '../render/atlas.ts';
import { PALETTE, PALETTE_ORDER } from '../render/palette.ts';
import { buildAtlas } from './atlas-spec.ts';

const ATLAS_PNG_PATH = new URL('../../assets/atlas.png', import.meta.url);
const ATLAS_JSON_PATH = new URL('../../assets/atlas.json', import.meta.url);

interface ParsedChunk {
  type: string;
  data: Uint8Array;
}

function readChunks(png: Uint8Array): ParsedChunk[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: ParsedChunk[] = [];
  let offset = 8;
  while (offset < png.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const data = png.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
  }
  return chunks;
}

describe('committed atlas artifacts', () => {
  it('has a committed PNG byte-identical to buildAtlas().png', () => {
    const committed = new Uint8Array(readFileSync(ATLAS_PNG_PATH));
    const { png } = buildAtlas();

    expect(Array.from(committed)).toEqual(Array.from(png));
  });

  it('has a committed JSON text equal to JSON.stringify(manifest, null, 2) + newline', () => {
    const committedText = readFileSync(ATLAS_JSON_PATH, 'utf8');
    const { manifest } = buildAtlas();

    expect(committedText).toBe(JSON.stringify(manifest, null, 2) + '\n');
  });

  it('keeps every frame within the bounds parsed from the committed PNG IHDR', () => {
    const png = new Uint8Array(readFileSync(ATLAS_PNG_PATH));
    const ihdr = readChunks(png).find((c) => c.type === 'IHDR');
    if (!ihdr) throw new Error('missing IHDR');
    const view = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength);
    const width = view.getUint32(0);
    const height = view.getUint32(4);

    const manifest = JSON.parse(readFileSync(ATLAS_JSON_PATH, 'utf8')) as AtlasManifest;

    for (const frame of Object.values(manifest.frames)) {
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.y).toBeGreaterThanOrEqual(0);
      expect(frame.x + frame.w).toBeLessThanOrEqual(width);
      expect(frame.y + frame.h).toBeLessThanOrEqual(height);
    }
  });

  it('parses PLTE from the committed PNG as index-0 black plus PALETTE in PALETTE_ORDER, with tRNS = [0]', () => {
    const png = new Uint8Array(readFileSync(ATLAS_PNG_PATH));
    const chunks = readChunks(png);
    const plte = chunks.find((c) => c.type === 'PLTE');
    const trns = chunks.find((c) => c.type === 'tRNS');
    if (!plte) throw new Error('missing PLTE');
    if (!trns) throw new Error('missing tRNS');

    const expectedRgb: Array<[number, number, number]> = [
      [0, 0, 0],
      ...PALETTE_ORDER.map((token): [number, number, number] => {
        const hex = PALETTE[token];
        return [
          parseInt(hex.slice(1, 3), 16),
          parseInt(hex.slice(3, 5), 16),
          parseInt(hex.slice(5, 7), 16),
        ];
      }),
    ];

    const actualRgb: Array<[number, number, number]> = [];
    for (let i = 0; i < plte.data.length; i += 3) {
      actualRgb.push([plte.data[i]!, plte.data[i + 1]!, plte.data[i + 2]!]);
    }

    expect(actualRgb).toEqual(expectedRgb);
    expect(Array.from(trns.data)).toEqual([0]);
  });
});
