export const DT = 1 / 60;
export const MAX_SUBSTEPS = 5;

/**
 * Injectable clock and frame scheduler in one. Folding both into a single
 * type means this module never references Date.now, performance.now or
 * requestAnimationFrame outside the createRafTicker adapter below, which
 * keeps the loop itself testable with no browser.
 */
export interface Ticker {
  start(onFrame: (nowMs: number) => void): void;
  stop(): void;
}

export interface LoopCallbacks {
  step(dt: number): void;
  render(alpha: number): void;
}

export interface Loop {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  readonly paused: boolean;
}

export function createLoop(callbacks: LoopCallbacks, ticker: Ticker): Loop {
  let originMs: number | null = null;
  let lastFrameMs = 0;
  let consumed = 0;
  let alpha = 0;
  let paused = false;

  function onFrame(nowMs: number): void {
    if (originMs === null) {
      // Seed frame: the loop holds no clock of its own, so the first
      // callback establishes the origin instead of running steps.
      originMs = nowMs;
      lastFrameMs = nowMs;
      callbacks.render(0);
      return;
    }

    if (paused) {
      // Shift the origin forward by this frame's wall-clock delta so the
      // elapsed time used below stays pinned; that is what makes resume
      // replay nothing instead of running a burst of banked steps.
      originMs += nowMs - lastFrameMs;
      lastFrameMs = nowMs;
      callbacks.render(alpha);
      return;
    }

    lastFrameMs = nowMs;

    // Deriving the step count from absolute elapsed time (rather than a
    // per-frame accumulator that sums float deltas) is required for exact
    // determinism: the summed variant produces 59 steps per second at 60
    // and 240 fps because of float rounding in the per-frame delta, while
    // this formulation is exact at every cadence since it only ever floors
    // one absolute value per frame.
    const elapsedSteps = (nowMs - originMs) / 1000 / DT;
    const total = Math.floor(elapsedSteps);
    const due = Math.min(Math.max(total - consumed, 0), MAX_SUBSTEPS);

    for (let i = 0; i < due; i++) {
      callbacks.step(DT);
    }

    // Assigning the absolute total (not consumed += due) is what discards
    // the backlog after a stall, and it is also what makes alpha a pure
    // fractional part, in [0, 1) by construction with no epsilon fudge.
    consumed = total;
    alpha = elapsedSteps - total;
    callbacks.render(alpha);
  }

  return {
    start(): void {
      originMs = null;
      consumed = 0;
      alpha = 0;
      paused = false;
      ticker.start(onFrame);
    },
    stop(): void {
      ticker.stop();
    },
    pause(): void {
      paused = true;
    },
    resume(): void {
      paused = false;
    },
    get paused(): boolean {
      return paused;
    },
  };
}

/** Thin, swappable adapter around requestAnimationFrame for real use. */
export function createRafTicker(): Ticker {
  let handle = 0;

  return {
    start(onFrame: (nowMs: number) => void): void {
      const tick = (nowMs: number): void => {
        onFrame(nowMs);
        handle = requestAnimationFrame(tick);
      };
      handle = requestAnimationFrame(tick);
    },
    stop(): void {
      cancelAnimationFrame(handle);
    },
  };
}
