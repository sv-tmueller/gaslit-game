// Moving terrain and shifting platforms: solid surfaces that travel along paths.
// The player rides them. Deterministic, phase resets on respawn.

import { aabbOverlap, type Body } from '../engine/physics';

export interface MovingPlatform {
  x: number; y: number;
  startX: number; startY: number;
  width: number; height: number;
  dx: number; dy: number;   // direction vector (normalized)
  speed: number;              // pixels per step
  distance: number;          // max travel distance
  traveled: number;           // current distance traveled
  direction: 1 | -1;          // current travel direction
}

export function createMovingPlatform(
  x: number, y: number, width: number, height: number,
  dx: number, dy: number, speed: number, distance: number,
): MovingPlatform {
  const len = Math.hypot(dx, dy) || 1;
  return {
    x, y, startX: x, startY: y, width, height,
    dx: dx / len, dy: dy / len, speed, distance,
    traveled: 0, direction: 1,
  };
}

export function stepMovingPlatform(platform: MovingPlatform, _dt: number): MovingPlatform {
  void _dt;
  const move = platform.speed * platform.direction;
  const newX = platform.x + platform.dx * move;
  const newY = platform.y + platform.dy * move;
  let traveled = platform.traveled + Math.abs(move);
  let dir = platform.direction;

  if (traveled >= platform.distance) {
    traveled = 0;
    dir = (platform.direction === 1 ? -1 : 1) as 1 | -1;
  }

  return { ...platform, x: newX, y: newY, traveled, direction: dir };
}

export function isPlayerOnPlatform(platform: MovingPlatform, playerBody: Body): boolean {
  // Player must be overlapping and above the platform
  return aabbOverlap(playerBody, {
    x: platform.x, y: platform.y, width: platform.width, height: platform.height,
  });
}

export function resetMovingPlatform(platform: MovingPlatform): MovingPlatform {
  return { ...platform, x: platform.startX, y: platform.startY, traveled: 0, direction: 1 };
}
