import { describe, expect, it } from 'vitest';
import type { Ticker } from './loop';
import { DT, MAX_SUBSTEPS, createLoop } from './loop';

/**
 * Manual ticker for headless tests: `start` records the frame callback and
 * `frame(nowMs)` invokes it directly, so tests can drive the loop with exact
 * synthetic timestamps instead of a real clock or requestAnimationFrame.
 */
function createManualTicker(): {
  ticker: Ticker;
  frame: (nowMs: number) => void;
  stopped: () => boolean;
} {
  let onFrame: ((nowMs: number) => void) | null = null;
  let isStopped = false;

  return {
    ticker: {
      start(cb) {
        onFrame = cb;
      },
      stop() {
        isStopped = true;
      },
    },
    frame(nowMs) {
      if (isStopped || onFrame === null) return;
      onFrame(nowMs);
    },
    stopped: () => isStopped,
  };
}

describe('createLoop', () => {
  it.each([30, 60, 144, 240])(
    'runs exactly 60 steps for a synthetic one-second clock at %i fps',
    (fps) => {
      const steps: number[] = [];
      const { ticker, frame } = createManualTicker();
      const loop = createLoop({ step: (dt) => steps.push(dt), render: () => {} }, ticker);

      loop.start();
      frame(0); // seed frame: establishes the origin, runs no steps

      const totalMs = 1000;
      for (let i = 0; i < fps; i++) {
        frame(((i + 1) * totalMs) / fps);
      }

      // The simulation runs at a fixed 60 Hz regardless of the display
      // cadence feeding it frames, which is the whole point of deriving
      // the step count from absolute elapsed time rather than a summed
      // per-frame accumulator (see the SUB_PLAN numerics rationale).
      expect(steps).toHaveLength(60);
      for (const dt of steps) {
        expect(dt).toBe(DT);
      }
    },
  );

  it('caps a 2-second frame stall at MAX_SUBSTEPS steps', () => {
    const steps: number[] = [];
    const { ticker, frame } = createManualTicker();
    const loop = createLoop({ step: () => steps.push(1), render: () => {} }, ticker);

    loop.start();
    frame(0);
    frame(2000);

    expect(steps).toHaveLength(MAX_SUBSTEPS);
  });

  it('keeps alpha in the range [0, 1) across normal cadences and a stall', () => {
    const alphas: number[] = [];
    const { ticker, frame } = createManualTicker();
    const loop = createLoop({ step: () => {}, render: (alpha) => alphas.push(alpha) }, ticker);

    loop.start();
    frame(0);

    const fps = 240;
    const totalMs = 1000;
    for (let i = 0; i < fps; i++) {
      frame(((i + 1) * totalMs) / fps);
    }
    frame(3000); // stall

    expect(alphas.length).toBeGreaterThan(0);
    for (const alpha of alphas) {
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
    }
  });

  it('does not replay time accumulated while paused', () => {
    const steps: number[] = [];
    const { ticker, frame } = createManualTicker();
    const loop = createLoop({ step: () => steps.push(1), render: () => {} }, ticker);

    const fps = 60;
    loop.start();
    frame(0);

    for (let i = 0; i < fps; i++) {
      frame(((i + 1) * 1000) / fps);
    }

    loop.pause();
    const pausedFrames = fps * 5;
    for (let i = 0; i < pausedFrames; i++) {
      frame(1000 + ((i + 1) * 5000) / pausedFrames);
    }

    loop.resume();
    for (let i = 0; i < fps; i++) {
      frame(6000 + ((i + 1) * 1000) / fps);
    }

    expect(steps).toHaveLength(120);
  });

  it('still calls render on every paused frame', () => {
    const renders: number[] = [];
    const { ticker, frame } = createManualTicker();
    const loop = createLoop({ step: () => {}, render: () => renders.push(1) }, ticker);

    loop.start();
    frame(0);
    frame(1000);

    loop.pause();
    const before = renders.length;
    frame(1100);
    frame(1200);
    frame(1300);

    expect(renders.length).toBe(before + 3);
  });

  it('renders once per frame even when no steps are due', () => {
    const steps: number[] = [];
    const renders: number[] = [];
    const { ticker, frame } = createManualTicker();
    const loop = createLoop({ step: () => steps.push(1), render: () => renders.push(1) }, ticker);

    loop.start();
    frame(0); // seed, renders once
    frame(1);
    frame(2);

    expect(renders).toHaveLength(3);
    expect(steps).toHaveLength(0);
  });

  it('runs no steps on the seed frame', () => {
    const steps: number[] = [];
    const renders: number[] = [];
    const { ticker, frame } = createManualTicker();
    const loop = createLoop(
      { step: () => steps.push(1), render: (alpha) => renders.push(alpha) },
      ticker,
    );

    loop.start();
    frame(0);

    expect(steps).toHaveLength(0);
    expect(renders).toEqual([0]);
  });

  it("runs a frame's step calls before that frame's render call", () => {
    const calls: string[] = [];
    const { ticker, frame } = createManualTicker();
    const loop = createLoop(
      { step: () => calls.push('step'), render: () => calls.push('render') },
      ticker,
    );

    loop.start();
    frame(0);
    calls.length = 0;
    frame(2000); // stall: multiple step calls, then one render call

    expect(calls).toEqual(['step', 'step', 'step', 'step', 'step', 'render']);
  });

  it('stops the ticker on stop', () => {
    const { ticker, frame, stopped } = createManualTicker();
    const loop = createLoop({ step: () => {}, render: () => {} }, ticker);

    loop.start();
    frame(0);
    loop.stop();

    expect(stopped()).toBe(true);
  });
});
