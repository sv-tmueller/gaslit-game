// Pure data and types, no platform imports. Importable by app code and by src/tools/** alike.
// This is what M2's renderer depends on; it must never live under src/tools/.

export type AtlasFrameName =
  | 'player.idle.0'
  | 'player.idle.1'
  | 'player.run.0'
  | 'player.run.1'
  | 'player.run.2'
  | 'player.run.3'
  | 'player.jump'
  | 'player.fall'
  | 'tile.solid.top'
  | 'tile.solid.fill'
  | 'tile.oneway'
  | 'hazard.spikes'
  | 'exit.door'
  | 'title.mark';

export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pixel offset from the frame's top-left to the entity's AABB top-left. */
  origin: { x: number; y: number };
}

export interface AtlasManifest {
  version: 1;
  image: string;
  width: number;
  height: number;
  // Keyed by AtlasFrameName; every key contains a dot so none is an integer-like
  // string, which is what keeps JS object insertion order stable. A frame named
  // "0" would silently reorder this object.
  frames: Record<AtlasFrameName, AtlasFrame>;
}
