// src/tools/**: build-time-only, node-only. Never imported by src/main.ts,
// src/engine/**, or src/render/**.
import { describe, expect, it } from 'vitest';
import type { AtlasFrameName } from '../render/atlas.ts';
import { ART, CHAR_TO_INDEX } from './atlas-art.ts';
import { ATLAS_WIDTH, buildAtlas, packFrames } from './atlas-spec.ts';

const PLAYER_NAMES = new Set<AtlasFrameName>([
  'player.idle.0',
  'player.idle.1',
  'player.run.0',
  'player.run.1',
  'player.run.2',
  'player.run.3',
  'player.jump',
  'player.fall',
]);

const ALL_FRAME_NAMES: AtlasFrameName[] = [
  'player.idle.0',
  'player.idle.1',
  'player.run.0',
  'player.run.1',
  'player.run.2',
  'player.run.3',
  'player.jump',
  'player.fall',
  'tile.solid.top',
  'tile.solid.fill',
  'tile.oneway',
  'hazard.spikes',
  'exit.door',
  'title.mark',
];

describe('ART', () => {
  it('has every row length equal to the frame width and rows.length equal to h', () => {
    for (const frame of ART) {
      const w = frame.rows[0]?.length ?? 0;
      expect(frame.rows.length).toBe(PLAYER_NAMES.has(frame.name) ? 24 : 16);
      for (const r of frame.rows) {
        expect(r.length).toBe(w);
      }
    }
  });

  it('uses only characters present in CHAR_TO_INDEX', () => {
    for (const frame of ART) {
      for (const r of frame.rows) {
        for (const ch of r) {
          expect(Object.keys(CHAR_TO_INDEX)).toContain(ch);
        }
      }
    }
  });

  it('gives every player frame a 16x24 footprint and every other frame 16x16', () => {
    for (const frame of ART) {
      const w = frame.rows[0]?.length ?? 0;
      const h = frame.rows.length;
      if (PLAYER_NAMES.has(frame.name)) {
        expect([w, h]).toEqual([16, 24]);
      } else {
        expect([w, h]).toEqual([16, 16]);
      }
    }
  });

  it('has unique frame names covering AtlasFrameName exactly', () => {
    const names = ART.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    expect([...names].sort()).toEqual([...ALL_FRAME_NAMES].sort());
  });

  it('never uses lethal outside hazard.spikes', () => {
    for (const frame of ART) {
      if (frame.name === 'hazard.spikes') continue;
      for (const r of frame.rows) {
        expect(r).not.toContain('x');
      }
    }
  });

  it('draws title.mark using only bone and edge', () => {
    const mark = ART.find((f) => f.name === 'title.mark');
    if (!mark) throw new Error('missing title.mark');
    for (const r of mark.rows) {
      for (const ch of r) {
        expect(['.', 'e', 'b']).toContain(ch);
      }
    }
  });
});

describe('packFrames', () => {
  it('places the full 14-frame layout exactly as specified', () => {
    const placements = packFrames(ART);

    expect(placements.map((p) => [p.name, p.x, p.y, p.w, p.h])).toEqual([
      ['player.idle.0', 0, 0, 16, 24],
      ['player.idle.1', 16, 0, 16, 24],
      ['player.run.0', 32, 0, 16, 24],
      ['player.run.1', 48, 0, 16, 24],
      ['player.run.2', 64, 0, 16, 24],
      ['player.run.3', 80, 0, 16, 24],
      ['player.jump', 96, 0, 16, 24],
      ['player.fall', 112, 0, 16, 24],
      ['tile.solid.top', 0, 24, 16, 16],
      ['tile.solid.fill', 16, 24, 16, 16],
      ['tile.oneway', 32, 24, 16, 16],
      ['hazard.spikes', 48, 24, 16, 16],
      ['exit.door', 64, 24, 16, 16],
      ['title.mark', 80, 24, 16, 16],
    ]);
  });
});

describe('buildAtlas', () => {
  it('produces a 128x40 atlas', () => {
    const { manifest } = buildAtlas();
    expect(manifest.width).toBe(ATLAS_WIDTH);
    expect(manifest.height).toBe(40);
  });

  it('returns byte-identical PNG and deep-equal manifests on repeated calls', () => {
    const first = buildAtlas();
    const second = buildAtlas();

    expect(Array.from(first.png)).toEqual(Array.from(second.png));
    expect(first.manifest).toEqual(second.manifest);
  });

  it('builds a manifest whose frame key order matches ART declaration order', () => {
    const { manifest } = buildAtlas();
    expect(Object.keys(manifest.frames)).toEqual(ART.map((f) => f.name));
  });

  it('gives every manifest frame the origin authored in ART', () => {
    const { manifest } = buildAtlas();
    for (const frame of ART) {
      expect(manifest.frames[frame.name].origin).toEqual(frame.origin);
    }
  });
});
