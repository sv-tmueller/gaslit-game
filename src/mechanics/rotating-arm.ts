// Rotating hazard arms: lethal blades sweeping in circles around a pivot.
// Deterministic angular velocity, phase resets on respawn.

import { aabbOverlap, type Body } from '../engine/physics';

export interface RotatingArm {
  pivotX: number;
  pivotY: number;
  length: number;       // arm length in pixels
  angle: number;        // current angle in radians
  angularSpeed: number; // radians per step
  bladeWidth: number;
  bladeHeight: number;
}

export function createRotatingArm(
  pivotX: number, pivotY: number, length: number,
  angularSpeed: number, initialAngle: number = 0,
): RotatingArm {
  return { pivotX, pivotY, length, angle: initialAngle, angularSpeed, bladeWidth: 16, bladeHeight: 16 };
}

export function stepRotatingArm(arm: RotatingArm, _dt: number): RotatingArm {
  void _dt;
  return { ...arm, angle: arm.angle + arm.angularSpeed };
}

export function getBladeAABB(arm: RotatingArm): { x: number; y: number; width: number; height: number } {
  const bx = arm.pivotX + Math.cos(arm.angle) * arm.length;
  const by = arm.pivotY + Math.sin(arm.angle) * arm.length;
  return {
    x: bx - arm.bladeWidth / 2,
    y: by - arm.bladeHeight / 2,
    width: arm.bladeWidth,
    height: arm.bladeHeight,
  };
}

export function isPlayerHit(arm: RotatingArm, playerBody: Body): boolean {
  return aabbOverlap(playerBody, getBladeAABB(arm));
}

export function resetRotatingArm(arm: RotatingArm, initialAngle: number): RotatingArm {
  return { ...arm, angle: initialAngle };
}
