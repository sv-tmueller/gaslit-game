// Buzzsaws and moving hazards: lethal obstacles traveling along authored paths.
// Deterministic, phase resets on respawn.

import type { Body } from '../engine/physics';

export interface Waypoint {
  x: number;
  y: number;
}

export interface PatrolPath {
  waypoints: Waypoint[];
  speed: number;
  pingpong: boolean;
}

export interface Buzzsaw {
  x: number;
  y: number;
  radius: number;
  path: PatrolPath;
  segmentIndex: number;
  segmentProgress: number;
  direction: 1 | -1;
}

export function createBuzzsaw(radius: number, path: PatrolPath): Buzzsaw {
  const wp0 = path.waypoints[0]!;
  return {
    x: wp0.x,
    y: wp0.y,
    radius,
    path,
    segmentIndex: 0,
    segmentProgress: 0,
    direction: 1,
  };
}

export function stepBuzzsaw(saw: Buzzsaw, _dt: number): Buzzsaw {
  void _dt;
  const wps = saw.path.waypoints;
  if (wps.length < 2) return saw;

  const segIdx = saw.segmentIndex;
  const from = wps[segIdx]!;
  const to = wps[segIdx + 1] ?? wps[0]!;
  const segLen = Math.hypot(to.x - from.x, to.y - from.y);
  if (segLen === 0) return saw;

  const progressInc = saw.path.speed / segLen;
  let progress = saw.segmentProgress + progressInc;
  let segIndex = segIdx;
  let dir = saw.direction;

  if (progress >= 1) {
    progress = 0;
    segIndex += dir;
    if (saw.path.pingpong) {
      if (segIndex >= wps.length - 1) {
        segIndex = wps.length - 2;
        dir = -1 as const;
      } else if (segIndex < 0) {
        segIndex = 0;
        dir = 1 as const;
      }
    } else {
      if (segIndex >= wps.length - 1) {
        segIndex = 0;
      }
    }
  }

  const fromNow = wps[segIndex]!;
  const toNow = wps[segIndex + 1] ?? wps[0]!;
  const x = fromNow.x + (toNow.x - fromNow.x) * progress;
  const y = fromNow.y + (toNow.y - fromNow.y) * progress;

  return { ...saw, x, y, segmentIndex: segIndex, segmentProgress: progress, direction: dir };
}

export function isPlayerHit(saw: Buzzsaw, playerBody: Body): boolean {
  // Circle-AABB overlap: find closest point on AABB to circle center
  const cx = Math.max(playerBody.x, Math.min(saw.x, playerBody.x + playerBody.width));
  const cy = Math.max(playerBody.y, Math.min(saw.y, playerBody.y + playerBody.height));
  const dx = saw.x - cx;
  const dy = saw.y - cy;
  return dx * dx + dy * dy <= saw.radius * saw.radius;
}

export function resetBuzzsaw(saw: Buzzsaw): Buzzsaw {
  const wp0 = saw.path.waypoints[0]!;
  return {
    ...saw,
    x: wp0.x,
    y: wp0.y,
    segmentIndex: 0,
    segmentProgress: 0,
    direction: 1,
  };
}
