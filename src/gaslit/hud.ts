import { createPrng } from '../engine/prng';

// Unreliable HUD: takes real values and produces display values that
// occasionally lie. Lies are deterministic (seeded), rare, and self-correcting.
// Real save data is never touched.

export interface HudInput {
  readonly deathCount: number;
  readonly levelNumber: number;
  readonly attemptCount: number;
  readonly step: number;
  readonly seed: number;
}

export interface HudDisplay {
  readonly displayedDeaths: number;
  readonly displayedLevel: number;
  readonly displayedAttempts: number;
  readonly isLying: boolean;
}

// Epoch length: 60 steps = 1 second at 60 fps. The lie decision is made once
// per epoch so it persists long enough to notice but self-corrects quickly.
const STEPS_PER_EPOCH = 60;

// Probability of lying in any given epoch. Tuned to feel rare and deniable.
const LIE_THRESHOLD = 0.125;

export function computeHud(input: HudInput): HudDisplay {
  const epoch = Math.floor(input.step / STEPS_PER_EPOCH);

  // Seed the roll with the global seed XORed with the epoch so the same
  // epoch always produces the same decision.
  const roll = createPrng((input.seed ^ epoch) >>> 0).next();

  if (roll >= LIE_THRESHOLD) {
    return truthful(input);
  }

  // Decide which value to tamper with.
  const lieChoice = createPrng((input.seed ^ epoch ^ 0xdead) >>> 0).int(0, 2);

  if (lieChoice === 0 && input.deathCount > 0) {
    return {
      displayedDeaths: input.deathCount - 1,
      displayedLevel: input.levelNumber,
      displayedAttempts: input.attemptCount,
      isLying: true,
    };
  }
  if (lieChoice === 1 && input.levelNumber > 1) {
    return {
      displayedDeaths: input.deathCount,
      displayedLevel: input.levelNumber - 1,
      displayedAttempts: input.attemptCount,
      isLying: true,
    };
  }
  if (lieChoice === 2 && input.attemptCount > 0) {
    return {
      displayedDeaths: input.deathCount,
      displayedLevel: input.levelNumber,
      displayedAttempts: input.attemptCount - 1,
      isLying: true,
    };
  }

  // Chosen lie was guarded (value at minimum); fall back to truth.
  return truthful(input);
}

function truthful(input: HudInput): HudDisplay {
  return {
    displayedDeaths: input.deathCount,
    displayedLevel: input.levelNumber,
    displayedAttempts: input.attemptCount,
    isLying: false,
  };
}
