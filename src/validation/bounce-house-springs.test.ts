import { describe, expect, it } from 'vitest';
import { validateReachability } from './reachability';
import { loadLevel } from '../levels/load';
import level28 from '../levels/world2/level-28.json';

describe('W2#13 bounce-house springs (#132)', () => {
  const level = loadLevel(level28);

  it('level loads with spring mechanics declared', () => {
    expect(level.mechanics).toBeDefined();
    expect(level.mechanics!.length).toBe(2);
    expect(level.mechanics!.every(m => m.type === 'spring')).toBe(true);
  });

  it('exit is reachable with springs boosting the player', () => {
    expect(validateReachability(level)).toBe(true);
  });
});
