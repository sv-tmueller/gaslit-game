import { describe, expect, it } from 'vitest';

import { DENIAL_MESSAGES } from './messages';

describe('DENIAL_MESSAGES catalogue', () => {
  it('is non-empty', () => {
    expect(DENIAL_MESSAGES.length).toBeGreaterThan(0);
  });

  it('has only valid trigger types', () => {
    const valid = new Set(['on-death', 'on-level-start']);
    for (const entry of DENIAL_MESSAGES) {
      expect(valid.has(entry.trigger)).toBe(true);
    }
  });

  it('has no empty text strings', () => {
    for (const entry of DENIAL_MESSAGES) {
      expect(entry.text.trim()).not.toBe('');
    }
  });
});
