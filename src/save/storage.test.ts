import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from './storage';

describe('createMemoryStorage', () => {
  it('round-trips a value through setItem/getItem', () => {
    const s = createMemoryStorage();
    s.setItem('foo', 'bar');
    expect(s.getItem('foo')).toBe('bar');
  });

  it('returns null for a missing key', () => {
    const s = createMemoryStorage();
    expect(s.getItem('missing')).toBeNull();
  });

  it('overwrites an existing value', () => {
    const s = createMemoryStorage();
    s.setItem('k', 'a');
    s.setItem('k', 'b');
    expect(s.getItem('k')).toBe('b');
  });

  it('deletes a value via removeItem', () => {
    const s = createMemoryStorage();
    s.setItem('k', 'v');
    s.removeItem('k');
    expect(s.getItem('k')).toBeNull();
  });

  it('does not throw removing a missing key', () => {
    const s = createMemoryStorage();
    expect(() => s.removeItem('nope')).not.toThrow();
  });

  it('isolates values per instance', () => {
    const a = createMemoryStorage();
    const b = createMemoryStorage();
    a.setItem('k', '1');
    expect(b.getItem('k')).toBeNull();
  });
});
