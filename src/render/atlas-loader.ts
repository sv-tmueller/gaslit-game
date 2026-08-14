// Runtime atlas loader: validates a manifest against a pre-decoded bitmap and
// hands back a fast frame-lookup structure. Validation logic is pure --
// the bitmap arrives already decoded so this module never touches the DOM,
// making it fully testable in node.

import {
  type AtlasFrame,
  type AtlasFrameName,
  type AtlasManifest,
} from './atlas';

/**
 * Minimal bitmap stand-in: only width and height matter for validation.
 * The real ImageBitmap satisfies this structurally.
 */
export interface BitmapLike {
  readonly width: number;
  readonly height: number;
}

export interface LoadedAtlas {
  readonly manifest: AtlasManifest;
  readonly bitmap: BitmapLike;
  /** O(1) frame lookup keyed by AtlasFrameName. */
  readonly frame: Readonly<Record<AtlasFrameName, AtlasFrame>>;
}

const EXPECTED_FRAME_NAMES: readonly AtlasFrameName[] = [
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

export class AtlasLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AtlasLoadError';
  }
}

export function loadAtlas(
  manifest: AtlasManifest,
  bitmap: BitmapLike,
): LoadedAtlas {
  if (manifest.version !== 1) {
    throw new AtlasLoadError(
      `unsupported atlas manifest version ${manifest.version} (expected 1)`,
    );
  }

  if (manifest.width !== bitmap.width || manifest.height !== bitmap.height) {
    throw new AtlasLoadError(
      `manifest dimensions ${manifest.width}x${manifest.height} do not match bitmap ${bitmap.width}x${bitmap.height}`,
    );
  }

  for (const name of EXPECTED_FRAME_NAMES) {
    if (!(name in manifest.frames)) {
      throw new AtlasLoadError(`manifest is missing required frame "${name}"`);
    }
  }

  return {
    manifest,
    bitmap,
    frame: manifest.frames,
  };
}
