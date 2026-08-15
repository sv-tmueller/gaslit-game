import { describe, expect, it } from 'vitest';
import { applyAttemptOverride, parseOverridesFromUrl } from './attempt-override';

describe('applyAttemptOverride', () => {
  it('returns override when present', () => {
    const result = applyAttemptOverride('level-a', 1, { 'level-a': 4 });
    expect(result).toBe(4);
  });

  it('returns real attempt when no override', () => {
    const result = applyAttemptOverride('level-a', 3, {});
    expect(result).toBe(3);
  });

  it('returns real attempt when override is for a different level', () => {
    const result = applyAttemptOverride('level-a', 2, { 'level-b': 5 });
    expect(result).toBe(2);
  });
});

describe('parseOverridesFromUrl', () => {
  it('parses valid query string', () => {
    const result = parseOverridesFromUrl('http://localhost/?attempt=level-a:4,level-b:2');
    expect(result).toEqual({ 'level-a': 4, 'level-b': 2 });
  });

  it('parses single override', () => {
    const result = parseOverridesFromUrl('http://localhost/?attempt=my-level:3');
    expect(result).toEqual({ 'my-level': 3 });
  });

  it('returns empty for missing param', () => {
    const result = parseOverridesFromUrl('http://localhost/');
    expect(result).toEqual({});
  });

  it('returns empty for malformed URL', () => {
    const result = parseOverridesFromUrl('not-a-url');
    expect(result).toEqual({});
  });

  it('skips pairs with non-numeric attempt values', () => {
    const result = parseOverridesFromUrl('http://localhost/?attempt=good:3,bad:abc');
    expect(result).toEqual({ good: 3 });
  });

  it('skips pairs with attempt less than 1', () => {
    const result = parseOverridesFromUrl('http://localhost/?attempt=zero:0,neg:-1,ok:2');
    expect(result).toEqual({ ok: 2 });
  });

  it('skips malformed pairs (missing colon)', () => {
    const result = parseOverridesFromUrl('http://localhost/?attempt=noColon,ok:5');
    expect(result).toEqual({ ok: 5 });
  });
});
