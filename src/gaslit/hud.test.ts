import { describe, expect, it } from 'vitest';

import { computeHud } from './hud';
import type { HudInput } from './hud';

function baseInput(overrides: Partial<HudInput> = {}): HudInput {
  return {
    deathCount: 5,
    levelNumber: 3,
    attemptCount: 10,
    step: 0,
    seed: 42,
    ...overrides,
  };
}

describe('computeHud', () => {
  it('is truthful when the roll exceeds the lie threshold', () => {
    let foundTruthful = false;
    for (let epoch = 0; epoch < 100; epoch++) {
      const result = computeHud(baseInput({ step: epoch * 60 }));
      if (!result.isLying) {
        expect(result.displayedDeaths).toBe(5);
        expect(result.displayedLevel).toBe(3);
        expect(result.displayedAttempts).toBe(10);
        foundTruthful = true;
        break;
      }
    }
    expect(foundTruthful).toBe(true);
  });

  it('lies about death count by subtracting one', () => {
    let foundDeathLie = false;
    for (let epoch = 0; epoch < 200; epoch++) {
      const result = computeHud(baseInput({ step: epoch * 60 }));
      if (
        result.isLying &&
        result.displayedDeaths === 4 &&
        result.displayedLevel === 3 &&
        result.displayedAttempts === 10
      ) {
        foundDeathLie = true;
        break;
      }
    }
    expect(foundDeathLie).toBe(true);
  });

  it('lies about level number by subtracting one', () => {
    let foundLevelLie = false;
    for (let epoch = 0; epoch < 200; epoch++) {
      const result = computeHud(baseInput({ step: epoch * 60 }));
      if (
        result.isLying &&
        result.displayedDeaths === 5 &&
        result.displayedLevel === 2 &&
        result.displayedAttempts === 10
      ) {
        foundLevelLie = true;
        break;
      }
    }
    expect(foundLevelLie).toBe(true);
  });

  it('lies about attempt count by subtracting one', () => {
    let foundAttemptLie = false;
    for (let epoch = 0; epoch < 200; epoch++) {
      const result = computeHud(baseInput({ step: epoch * 60 }));
      if (
        result.isLying &&
        result.displayedDeaths === 5 &&
        result.displayedLevel === 3 &&
        result.displayedAttempts === 9
      ) {
        foundAttemptLie = true;
        break;
      }
    }
    expect(foundAttemptLie).toBe(true);
  });

  it('never reduces a zero-valued counter below zero', () => {
    for (let epoch = 0; epoch < 500; epoch++) {
      const result = computeHud(
        baseInput({ deathCount: 0, levelNumber: 1, attemptCount: 0, step: epoch * 60 }),
      );
      expect(result.displayedDeaths).toBeGreaterThanOrEqual(0);
      expect(result.displayedLevel).toBeGreaterThanOrEqual(1);
      expect(result.displayedAttempts).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic: same input always produces the same output', () => {
    const input = baseInput({ step: 360 });
    const a = computeHud(input);
    const b = computeHud(input);
    expect(a).toEqual(b);
  });

  it('lies are rare: fewer than 20 percent of epochs lie over 1000 epochs', () => {
    let lieCount = 0;
    const totalEpochs = 1000;
    for (let epoch = 0; epoch < totalEpochs; epoch++) {
      const result = computeHud(baseInput({ step: epoch * 60 }));
      if (result.isLying) lieCount++;
    }
    expect(lieCount).toBeLessThan(totalEpochs * 0.2);
  });

  it('self-corrects: a lying epoch is followed by a truthful epoch eventually', () => {
    let lyingEpoch = -1;
    for (let epoch = 0; epoch < 200; epoch++) {
      const result = computeHud(baseInput({ step: epoch * 60 }));
      if (result.isLying) {
        lyingEpoch = epoch;
        break;
      }
    }
    expect(lyingEpoch).toBeGreaterThanOrEqual(0);

    let foundTruthful = false;
    for (let epoch = lyingEpoch! + 1; epoch < lyingEpoch! + 50; epoch++) {
      const result = computeHud(baseInput({ step: epoch * 60 }));
      if (!result.isLying) {
        foundTruthful = true;
        break;
      }
    }
    expect(foundTruthful).toBe(true);
  });

  it('uses the seed: changing the seed changes the lie pattern', () => {
    const inputA = baseInput({ seed: 42, step: 0 });
    const inputB = baseInput({ seed: 999, step: 0 });
    let diverged = false;
    for (let epoch = 0; epoch < 50; epoch++) {
      const a = computeHud({ ...inputA, step: epoch * 60 });
      const b = computeHud({ ...inputB, step: epoch * 60 });
      if (a.isLying !== b.isLying) {
        diverged = true;
        break;
      }
    }
    expect(diverged).toBe(true);
  });
});
