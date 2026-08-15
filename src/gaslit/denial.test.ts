import { describe, expect, it } from 'vitest';

import { selectDenialMessage } from './denial';
import type { DenialContext } from './denial';

function baseContext(overrides: Partial<DenialContext> = {}): DenialContext {
  return {
    levelId: 'level-01',
    attemptCount: 3,
    deathCount: 2,
    mutatedSomething: true,
    mutationTypes: ['set-tile'],
    seed: 42,
    ...overrides,
  };
}

describe('selectDenialMessage', () => {
  it('returns null on level-start when nothing mutated', () => {
    const ctx = baseContext({ mutatedSomething: false });
    const msg = selectDenialMessage(ctx, 'on-level-start');
    expect(msg).toBeNull();
  });

  it('returns non-null on level-start when something mutated', () => {
    const ctx = baseContext({ mutatedSomething: true });
    const msg = selectDenialMessage(ctx, 'on-level-start');
    expect(msg).not.toBeNull();
    expect(typeof msg!.text).toBe('string');
    expect(msg!.trigger).toBe('on-level-start');
  });

  it('returns null on death when deathCount is 0', () => {
    const ctx = baseContext({ deathCount: 0 });
    const msg = selectDenialMessage(ctx, 'on-death');
    expect(msg).toBeNull();
  });

  it('returns non-null on death when deathCount is greater than 0', () => {
    const ctx = baseContext({ deathCount: 1 });
    const msg = selectDenialMessage(ctx, 'on-death');
    expect(msg).not.toBeNull();
    expect(msg!.trigger).toBe('on-death');
  });

  it('is deterministic: same context always selects the same message', () => {
    const ctx = baseContext();
    const a = selectDenialMessage(ctx, 'on-level-start');
    const b = selectDenialMessage(ctx, 'on-level-start');
    expect(a).toEqual(b);
  });

  it('filters by minDeaths: low death count excludes escalated messages', () => {
    const ctx = baseContext({ deathCount: 0, mutatedSomething: true });
    const msg = selectDenialMessage(ctx, 'on-level-start');
    expect(msg).not.toBeNull();
    if (msg) {
      expect(msg.text).not.toBe('ARE YOU SURE?');
      expect(msg.text).not.toBe('MAYBE YOU SHOULD TAKE A BREAK');
    }
  });

  it('includes escalated messages when death count is high enough', () => {
    let foundEscalated = false;
    for (let seed = 0; seed < 200; seed++) {
      const ctx = baseContext({
        deathCount: 10,
        seed,
        mutationTypes: [],
      });
      const msg = selectDenialMessage(ctx, 'on-level-start');
      if (msg?.text === 'ARE YOU SURE?') {
        foundEscalated = true;
        break;
      }
    }
    expect(foundEscalated).toBe(true);
  });

  it('filters by mutationTypes: move-exit message only shows for move-exit', () => {
    let foundExitMsg = false;
    for (let seed = 0; seed < 200; seed++) {
      const ctx = baseContext({
        seed,
        mutationTypes: ['move-exit'],
      });
      const msg = selectDenialMessage(ctx, 'on-level-start');
      if (msg?.text === 'THE EXIT IS WHERE IT HAS ALWAYS BEEN') {
        foundExitMsg = true;
        break;
      }
    }
    expect(foundExitMsg).toBe(true);

    for (let seed = 0; seed < 200; seed++) {
      const ctx = baseContext({
        seed,
        mutationTypes: ['resize-gap'],
      });
      const msg = selectDenialMessage(ctx, 'on-level-start');
      expect(msg?.text).not.toBe('THE EXIT IS WHERE IT HAS ALWAYS BEEN');
    }
  });

  it('pool is never empty when a denial should show', () => {
    for (let seed = 0; seed < 100; seed++) {
      const ctx = baseContext({ seed, deathCount: 1 });
      const msg = selectDenialMessage(ctx, 'on-death');
      expect(msg).not.toBeNull();
    }
    for (let seed = 0; seed < 100; seed++) {
      const ctx = baseContext({ seed, deathCount: 0, mutatedSomething: true });
      const msg = selectDenialMessage(ctx, 'on-level-start');
      expect(msg).not.toBeNull();
    }
  });

  it('changing attempt or death count can change the selection', () => {
    const texts = new Set<string>();
    for (let attempt = 0; attempt < 50; attempt++) {
      const ctx = baseContext({ attemptCount: attempt });
      const msg = selectDenialMessage(ctx, 'on-level-start');
      if (msg) texts.add(msg.text);
    }
    expect(texts.size).toBeGreaterThan(1);
  });
});
