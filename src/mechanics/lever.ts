// Levers and pressure plates. Player-activated switches that toggle state.
// Pressure plates activate on contact; levers toggle on jump-press while overlapping.

import { aabbOverlap, type Body } from '../engine/physics';

export interface Lever {
  x: number;
  y: number;
  width: number;
  height: number;
  activated: boolean;
  toggleOnContact: boolean;
}

export function createLever(x: number, y: number, toggleOnContact: boolean): Lever {
  return {
    x,
    y,
    width: 16,
    height: 16,
    activated: false,
    toggleOnContact,
  };
}

export function stepLevers(
  levers: Lever[],
  playerBody: Body,
  jumpPressed: boolean,
): Lever[] {
  return levers.map((lever) => {
    const overlapping = aabbOverlap(playerBody, {
      x: lever.x,
      y: lever.y,
      width: lever.width,
      height: lever.height,
    });

    if (lever.toggleOnContact) {
      // Pressure plate: activated = overlapping
      return { ...lever, activated: overlapping };
    }

    // Lever: toggle on jump press while overlapping
    if (overlapping && jumpPressed) {
      return { ...lever, activated: !lever.activated };
    }
    return lever;
  });
}

export function isActivated(lever: Lever): boolean {
  return lever.activated;
}
