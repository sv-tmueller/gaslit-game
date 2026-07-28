import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, BASE_WIDTH, computeCanvasLayout } from './scale';

describe('computeCanvasLayout', () => {
  it('clamps to scale 1 when the viewport is smaller than the base resolution', () => {
    const layout = computeCanvasLayout({ width: 160, height: 90, devicePixelRatio: 1 });

    expect(layout.scale).toBe(1);
    expect(layout.deviceWidth).toBe(BASE_WIDTH);
    expect(layout.deviceHeight).toBe(BASE_HEIGHT);
  });

  it('scales to an exact integer multiple when the viewport is an exact multiple', () => {
    const layout = computeCanvasLayout({ width: 640, height: 360, devicePixelRatio: 1 });

    expect(layout.scale).toBe(2);
    expect(layout.deviceWidth).toBe(640);
    expect(layout.deviceHeight).toBe(360);
    expect(layout.offsetX).toBe(0);
    expect(layout.offsetY).toBe(0);
  });

  it('letterboxes and centers an off-ratio viewport', () => {
    const layout = computeCanvasLayout({ width: 1000, height: 500, devicePixelRatio: 1 });

    // min(1000/320, 500/180) = min(3.125, 2.777..) -> floor -> 2
    expect(layout.scale).toBe(2);
    expect(layout.cssWidth).toBe(640);
    expect(layout.cssHeight).toBe(360);
    expect(layout.offsetX).toBe(180);
    expect(layout.offsetY).toBe(70);
  });

  it('accounts for devicePixelRatio 2 by scaling device pixels and halving css size', () => {
    const layout = computeCanvasLayout({ width: 640, height: 360, devicePixelRatio: 2 });

    // min(640*2/320, 360*2/180) = min(4, 4) -> 4
    expect(layout.scale).toBe(4);
    expect(layout.deviceWidth).toBe(1280);
    expect(layout.deviceHeight).toBe(720);
    expect(layout.cssWidth).toBe(640);
    expect(layout.cssHeight).toBe(360);
    expect(layout.offsetX).toBe(0);
    expect(layout.offsetY).toBe(0);
  });

  it('accounts for a fractional devicePixelRatio of 1.5', () => {
    const layout = computeCanvasLayout({ width: 480, height: 270, devicePixelRatio: 1.5 });

    // min(480*1.5/320, 270*1.5/180) = min(2.25, 2.25) -> floor -> 2
    expect(layout.scale).toBe(2);
    expect(layout.deviceWidth).toBe(640);
    expect(layout.deviceHeight).toBe(360);
    expect(layout.cssWidth).toBeCloseTo(426.667, 2);
    expect(layout.cssHeight).toBe(240);
    expect(layout.offsetX).toBeCloseTo(26.667, 2);
    expect(layout.offsetY).toBe(15);
  });

  it('never scales below 1 even at devicePixelRatio 1 on a tiny viewport', () => {
    const layout = computeCanvasLayout({ width: 1, height: 1, devicePixelRatio: 1 });

    expect(layout.scale).toBe(1);
  });
});
