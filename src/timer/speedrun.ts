// Speedrun timer: frame-accurate, counts simulation steps not wall-clock (#46).
// Per-level and cumulative times, personal bests stored in save data.

export interface TimerState {
  currentSteps: number;       // steps in current level
  totalSteps: number;          // cumulative steps across all levels
  running: boolean;
  visible: boolean;
}

export interface BestTimes {
  readonly [levelId: string]: number;  // best step count per level
}

export function createTimer(visible: boolean = true): TimerState {
  return { currentSteps: 0, totalSteps: 0, running: false, visible };
}

export function startTimer(state: TimerState): TimerState {
  return { ...state, running: true, currentSteps: 0 };
}

export function stopTimer(state: TimerState): TimerState {
  return { ...state, running: false };
}

export function stepTimer(state: TimerState, _dt: number): TimerState {
  void _dt;
  if (!state.running) return state;
  return { ...state, currentSteps: state.currentSteps + 1, totalSteps: state.totalSteps + 1 };
}

export function completeLevel(state: TimerState): TimerState {
  return { ...state, running: false };
}

export function advanceToNextLevel(state: TimerState): TimerState {
  return { ...state, currentSteps: 0, running: true };
}

export function toggleVisible(state: TimerState): TimerState {
  return { ...state, visible: !state.visible };
}

export function stepsToTimeString(steps: number): string {
  const totalSeconds = steps / 60;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const centiseconds = Math.floor((totalSeconds * 100) % 100);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

export function recordBest(bests: BestTimes, levelId: string, steps: number): BestTimes {
  const current = bests[levelId];
  if (current !== undefined && current <= steps) return bests;
  return { ...bests, [levelId]: steps };
}

export function getBest(bests: BestTimes, levelId: string): number | undefined {
  return bests[levelId];
}
