// Deterministic replay recorder and player (#45).
// Records input sequences as a compact array of input deltas.
// Playback reproduces the run exactly given the same seed and level.

export interface InputFrame {
  readonly left: boolean;
  readonly right: boolean;
  readonly jump: boolean;
  readonly restart: boolean;
}

export interface ReplayData {
  readonly levelId: string;
  readonly seed: number;
  readonly frames: readonly InputFrame[];
  readonly deathStep: number;   // step at which the player died (-1 = completed)
  readonly completed: boolean;
}

export class ReplayRecorder {
  private frames: InputFrame[] = [];
  private lastFrame: InputFrame = { left: false, right: false, jump: false, restart: false };

  record(frame: InputFrame): void {
    // Compact: only store frames that differ from the last
    if (this.frames.length === 0 || !this.sameFrame(frame, this.lastFrame)) {
      this.frames.push(frame);
      this.lastFrame = frame;
    }
  }

  private sameFrame(a: InputFrame, b: InputFrame): boolean {
    return a.left === b.left && a.right === b.right && a.jump === b.jump && a.restart === b.restart;
  }

  finish(levelId: string, seed: number, deathStep: number, completed: boolean): ReplayData {
    return { levelId, seed, frames: this.frames, deathStep, completed };
  }

  get length(): number {
    return this.frames.length;
  }
}

export class ReplayPlayer {
  private frames: readonly InputFrame[];
  private index: number = 0;

  constructor(data: ReplayData) {
    this.frames = data.frames;
  }

  nextFrame(): InputFrame | null {
    if (this.index >= this.frames.length) return null;
    const frame = this.frames[this.index]!;
    this.index++;
    return frame;
  }

  get currentIndex(): number {
    return this.index;
  }

  get totalFrames(): number {
    return this.frames.length;
  }

  reset(): void {
    this.index = 0;
  }
}

export function serializeReplay(data: ReplayData): string {
  return JSON.stringify(data);
}

export function deserializeReplay(raw: string): ReplayData {
  return JSON.parse(raw) as ReplayData;
}
