// Bombs and timed explosions. Deterministic fuse countdown, circular blast radius,
// chain reactions between nearby bombs.

import type { AABB } from '../engine/physics';

export interface Bomb {
  x: number;
  y: number;
  fuseSteps: number;
  blastRadius: number;
  exploded: boolean;
  destroyTerrain: boolean;
}

export function createBomb(
  x: number,
  y: number,
  fuseSteps: number,
  blastRadius: number,
  destroyTerrain: boolean,
): Bomb {
  return { x, y, fuseSteps, blastRadius, exploded: false, destroyTerrain };
}

export function stepBomb(bomb: Bomb, _dt: number): Bomb {
  void _dt;
  if (bomb.exploded) return bomb;
  const fuse = bomb.fuseSteps - 1;
  if (fuse <= 0) {
    return { ...bomb, fuseSteps: 0, exploded: true };
  }
  return { ...bomb, fuseSteps: fuse };
}

export function getBlastArea(bomb: Bomb): AABB {
  const r = bomb.blastRadius;
  return {
    x: bomb.x - r,
    y: bomb.y - r,
    width: r * 2,
    height: r * 2,
  };
}

export function isInBlast(px: number, py: number, bomb: Bomb): boolean {
  const dx = px - bomb.x;
  const dy = py - bomb.y;
  return dx * dx + dy * dy <= bomb.blastRadius * bomb.blastRadius;
}

export function detonateNearbyBombs(bombs: readonly Bomb[], explodedBomb: Bomb): Bomb[] {
  return bombs.map((b) => {
    if (b.exploded) return b;
    if (isInBlast(b.x, b.y, explodedBomb)) {
      return { ...b, exploded: true, fuseSteps: 0 };
    }
    return b;
  });
}
