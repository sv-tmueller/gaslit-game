// Performance budget and bundle size CI gate (#51).
// Measures frame time and bundle size, fails when either regresses.

export interface BudgetThresholds {
  readonly maxBundleBytes: number;
  readonly maxFrameMs: number;
}

export const DEFAULT_THRESHOLDS: BudgetThresholds = {
  maxBundleBytes: 200_000,  // 200KB gzipped
  maxFrameMs: 16,            // 60 FPS = 16.67ms
};

export interface BudgetReport {
  readonly bundleBytes: number;
  readonly frameMs: number;
  readonly bundlePasses: boolean;
  readonly framePasses: boolean;
  readonly allPass: boolean;
}

export function checkBudget(bundleBytes: number, frameMs: number, thresholds: BudgetThresholds = DEFAULT_THRESHOLDS): BudgetReport {
  const bundlePasses = bundleBytes <= thresholds.maxBundleBytes;
  const framePasses = frameMs <= thresholds.maxFrameMs;
  return { bundleBytes, frameMs, bundlePasses, framePasses, allPass: bundlePasses && framePasses };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

// In-game performance overlay for development
export interface PerfOverlayState {
  visible: boolean;
  frameSamples: number[];
  maxSamples: number;
}

export function createPerfOverlay(): PerfOverlayState {
  return { visible: false, frameSamples: [], maxSamples: 60 };
}

export function recordFrameTime(state: PerfOverlayState, ms: number): PerfOverlayState {
  const samples = [...state.frameSamples, ms].slice(-state.maxSamples);
  return { ...state, frameSamples: samples };
}

export function getAverageFrameTime(state: PerfOverlayState): number {
  if (state.frameSamples.length === 0) return 0;
  return state.frameSamples.reduce((a, b) => a + b, 0) / state.frameSamples.length;
}

export function getMaxFrameTime(state: PerfOverlayState): number {
  if (state.frameSamples.length === 0) return 0;
  return Math.max(...state.frameSamples);
}
