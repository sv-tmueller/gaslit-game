import { describe, expect, it } from 'vitest';
import { loadLevel } from '../levels/load';
import { DEMO_LEVELS } from '../levels/fixtures/demo-index';

const DEMO_KEYS = ['widening-gap', 'moving-platform', 'trigger-change', 'moving-exit', 'closing-route'];

describe('demo levels', () => {
  for (const key of DEMO_KEYS) {
    it(`${key} loads via loadLevel without errors`, () => {
      const source = DEMO_LEVELS[key];
      expect(() => loadLevel(source)).not.toThrow();
    });
  }
});
