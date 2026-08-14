import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../engine/physics';
import {
  DEATH_FREEZE_STEPS,
  EXIT_BEAT_STEPS,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  spawnToBody,
} from './constants';

describe('constants', () => {
  it('uses 16x16 player dimensions', () => {
    expect(PLAYER_WIDTH).toBe(16);
    expect(PLAYER_HEIGHT).toBe(16);
  });

  it('defines deterministic step durations', () => {
    expect(DEATH_FREEZE_STEPS).toBe(10);
    expect(EXIT_BEAT_STEPS).toBe(18);
  });
});

describe('spawnToBody', () => {
  it('bottom-aligns the body on the spawn row floor', () => {
    const body = spawnToBody({ col: 2, row: 9 }, 16);

    expect(body.x).toBe(32); // 2 * 16
    expect(body.y).toBe(144); // (9 + 1) * 16 - 16 = 160 - 16
    expect(body.y + body.height).toBe(160); // row 10 * TILE_SIZE
  });

  it('produces a zeroed velocity and ungrounded body', () => {
    const body = spawnToBody({ col: 0, row: 0 }, 16);

    expect(body.velocity.x).toBe(0);
    expect(body.velocity.y).toBe(0);
    expect(body.grounded).toBe(false);
  });

  it('uses PLAYER_WIDTH regardless of height argument', () => {
    const body = spawnToBody({ col: 5, row: 3 }, 24);

    expect(body.width).toBe(PLAYER_WIDTH);
    expect(body.height).toBe(24);
    expect(body.x).toBe(5 * TILE_SIZE);
    expect(body.y).toBe(4 * TILE_SIZE - 24);
  });
});
