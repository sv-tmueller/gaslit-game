import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Ticker } from './loop';
import { DT, MAX_SUBSTEPS, createLoop, createRafTicker } from './loop';

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
    expect(loop.paused).toBe(false);

    for (let i = 0; i < fps; i++) {
      frame(((i + 1) * 1000) / fps);
    }

    loop.pause();
    expect(loop.paused).toBe(true);
    const pausedFrames = fps * 5;
    for (let i = 0; i < pausedFrames; i++) {
      frame(1000 + ((i + 1) * 5000) / pausedFrames);
    }

    loop.resume();
    expect(loop.paused).toBe(false);
    for (let i = 0; i < fps; i++) {
      frame(6000 + ((i + 1) * 1000) / fps);
    }

    expect(steps).toHaveLength(120);
  });

  it('runs only the steps genuinely new elapsed time accounts for after a backwards clock jump', () => {
    // Repro from issue #76: seed at t=0, drive 60 even frames to t=1000 (60
    // steps), rewind to t=500 with one frame call (step count must hold at
    // 60, not silently drop), then drive 60 more even frames from t=500 to
    // t=1500. 500ms of genuinely new time beyond the prior high water mark
    // (1000) should produce about 30 steps, for 90 total, not 120.
    const steps: number[] = [];
    const alphas: number[] = [];
    const { ticker, frame } = createManualTicker();
    const loop = createLoop(
      { step: () => steps.push(1), render: (alpha) => alphas.push(alpha) },
      ticker,
    );

    loop.start();
    frame(0);

    const fps = 60;
    for (let i = 0; i < fps; i++) {
      frame(((i + 1) * 1000) / fps);
    }
    expect(steps).toHaveLength(60);

    frame(500); // clock rewinds
    expect(steps).toHaveLength(60);

    for (let i = 0; i < fps; i++) {
      frame(500 + ((i + 1) * 1000) / fps);
    }
    expect(steps).toHaveLength(90);

    for (const alpha of alphas) {
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
    }
  });

  it('does not bank phantom elapsed time from a clock rewind while paused', () => {
    const steps: number[] = [];
    const frameStepCounts: number[] = [];
    const { ticker, frame: rawFrame } = createManualTicker();
    const loop = createLoop({ step: () => steps.push(1), render: () => {} }, ticker);

    const frame = (nowMs: number): void => {
      const before = steps.length;
      rawFrame(nowMs);
      frameStepCounts.push(steps.length - before);
    };

    loop.start();
    frame(0);

    const fps = 60;
    for (let i = 0; i < fps; i++) {
      frame(((i + 1) * 1000) / fps);
    }
    expect(steps).toHaveLength(60);

    loop.pause();
    frame(400); // rewind while paused

    loop.resume();
    for (let i = 0; i < fps; i++) {
      frame(1000 + ((i + 1) * 1000) / fps);
    }

    expect(steps).toHaveLength(120);
    for (const count of frameStepCounts) {
      expect(count).toBeLessThanOrEqual(MAX_SUBSTEPS);
    }
  });

  it('does not lose genuinely elapsed time across multiple rewinds while paused', () => {
    // Repro from issue #76 finding 1: a rewind while paused followed by a
    // partial-recovery frame that stays below the pre-rewind high point
    // (400, then 900, both below the 1000 high water mark) must not bank
    // any forward delta at all, since no genuine time has elapsed past the
    // high water mark yet. The single-rewind test above only exercises one
    // rewound frame, whose delta already clamps to zero; this sequence adds
    // a second, partially-recovered frame whose delta the old lastFrameMs
    // comparison (400 -> 900 is a forward delta of 500) let through.
    const steps: number[] = [];
    const { ticker, frame } = createManualTicker();
    const loop = createLoop({ step: () => steps.push(1), render: () => {} }, ticker);

    loop.start();
    frame(0);

    const fps = 60;
    for (let i = 0; i < fps; i++) {
      frame(((i + 1) * 1000) / fps);
    }
    expect(steps).toHaveLength(60);

    loop.pause();
    frame(400); // rewind while paused
    frame(900); // partial recovery, still below the pre-rewind high point

    loop.resume();
    for (let i = 0; i < fps; i++) {
      frame(1000 + ((i + 1) * 1000) / fps);
    }

    expect(steps).toHaveLength(120);
  });

  describe('start() called twice without an intervening stop()', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('cannot leave an uncancellable frame chain', () => {
      let nextHandle = 1;
      const pending = new Map<number, FrameRequestCallback>();

      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
        const handle = nextHandle++;
        pending.set(handle, cb);
        return handle;
      });
      vi.stubGlobal('cancelAnimationFrame', (handle: number): void => {
        pending.delete(handle);
      });

      const flush = (nowMs: number): void => {
        const callbacks = [...pending.values()];
        pending.clear();
        for (const cb of callbacks) {
          cb(nowMs);
        }
      };

      const renders: number[] = [];
      const loop = createLoop({ step: () => {}, render: () => renders.push(1) }, createRafTicker());

      loop.start();
      loop.start();
      loop.stop();

      flush(16);

      expect(pending.size).toBe(0);
      expect(renders).toHaveLength(0);
    });
  });

  it('produces exactly 600 steps over 10 synthetic seconds at 240 fps with no drift', () => {
    const steps: number[] = [];
    const { ticker, frame } = createManualTicker();
    const loop = createLoop({ step: (dt) => steps.push(dt), render: () => {} }, ticker);

    loop.start();
    frame(0);

    const fps = 240;
    const totalMs = 10_000;
    const frameCount = fps * 10;
    for (let i = 0; i < frameCount; i++) {
      frame(((i + 1) * totalMs) / frameCount);
    }

    expect(steps).toHaveLength(600);
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
