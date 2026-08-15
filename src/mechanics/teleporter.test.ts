import { describe, expect, it } from 'vitest';
import { createTeleporter, stepTeleporter, checkTeleport, applyTeleport, triggerCooldown, resetTeleporter, createPortalPair } from './teleporter';
import type { Body } from '../engine/physics';

function makeBody(x: number, y: number): Body {
  return { x, y, width: 16, height: 16, velocity: { x: 50, y: 100 }, grounded: false };
}

describe('teleporter', () => {
  it('detects player overlap', () => {
    const tp = createTeleporter(100, 100, 200, 200);
    expect(checkTeleport(tp, makeBody(100, 100))).toBe(true);
  });
  it('does not detect when player is far', () => {
    const tp = createTeleporter(100, 100, 200, 200);
    expect(checkTeleport(tp, makeBody(500, 500))).toBe(false);
  });
  it('teleports player to destination', () => {
    const tp = createTeleporter(100, 100, 200, 200);
    const body = makeBody(100, 100);
    const teleported = applyTeleport(tp, body);
    expect(teleported.x).toBe(200);
    expect(teleported.y).toBe(200);
  });
  it('zeros velocity by default', () => {
    const tp = createTeleporter(100, 100, 200, 200);
    const body = makeBody(100, 100);
    const teleported = applyTeleport(tp, body);
    expect(teleported.velocity.x).toBe(0);
    expect(teleported.velocity.y).toBe(0);
  });
  it('preserves momentum when configured', () => {
    const tp = createTeleporter(100, 100, 200, 200, false, true);
    const body = makeBody(100, 100);
    const teleported = applyTeleport(tp, body);
    expect(teleported.velocity.x).toBe(50);
    expect(teleported.velocity.y).toBe(100);
  });
  it('cooldown prevents re-trigger', () => {
    let tp = createTeleporter(100, 100, 200, 200);
    tp = triggerCooldown(tp);
    expect(checkTeleport(tp, makeBody(100, 100))).toBe(false);
  });
  it('cooldown decreases over steps', () => {
    let tp = triggerCooldown(createTeleporter(100, 100, 200, 200));
    tp = stepTeleporter(tp, 1/60);
    expect(tp.currentCooldown).toBe(9);
  });
  it('reset clears cooldown', () => {
    let tp = triggerCooldown(createTeleporter(100, 100, 200, 200));
    tp = resetTeleporter(tp);
    expect(tp.currentCooldown).toBe(0);
  });
  it('portal pair creates bidirectional teleporters', () => {
    const [a, b] = createPortalPair(100, 100, 300, 300);
    expect(a.destX).toBe(300);
    expect(b.destX).toBe(100);
  });
});
