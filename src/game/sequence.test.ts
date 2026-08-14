import { describe, expect, it } from 'vitest';
import { FIXTURE_SOURCES } from '../levels/fixtures';
import { loadLevel } from '../levels/load';
import {
  advance,
  createSequence,
  currentLevel,
  hasNext,
  type LevelSequence,
} from './sequence';

const SOURCES = Object.values(FIXTURE_SOURCES);

describe('createSequence', () => {
  it('creates a sequence starting at index 0', () => {
    const seq = createSequence(SOURCES);
    expect(seq.index).toBe(0);
    expect(seq.sources).toHaveLength(SOURCES.length);
  });

  it('throws on an empty source list', () => {
    expect(() => createSequence([])).toThrow();
  });
});

describe('currentLevel', () => {
  it('loads the level at the current index', () => {
    const seq = createSequence(SOURCES);
    const level = currentLevel(seq);
    const expected = loadLevel(SOURCES[0]);
    expect(level.name).toBe(expected.name);
    expect(level.cols).toBe(expected.cols);
    expect(level.rows).toBe(expected.rows);
  });
});

describe('advance', () => {
  it('increments the index', () => {
    const seq = createSequence(SOURCES);
    const next = advance(seq);
    expect(next.index).toBe(1);
  });

  it('does not mutate the original sequence', () => {
    const seq = createSequence(SOURCES);
    advance(seq);
    expect(seq.index).toBe(0);
  });
});

describe('hasNext', () => {
  it('returns true when there are more levels', () => {
    const seq = createSequence(SOURCES);
    expect(hasNext(seq)).toBe(true);
  });

  it('returns false at the last level', () => {
    let seq: LevelSequence = createSequence(SOURCES);
    while (hasNext(seq)) {
      seq = advance(seq);
    }
    expect(hasNext(seq)).toBe(false);
  });

  it('throws when advancing past the last level', () => {
    let seq: LevelSequence = createSequence(SOURCES);
    while (hasNext(seq)) {
      seq = advance(seq);
    }
    expect(() => advance(seq)).toThrow();
  });
});

describe('single-element sequence', () => {
  it('has no next level immediately', () => {
    const seq = createSequence([SOURCES[0]]);
    expect(hasNext(seq)).toBe(false);
    expect(() => advance(seq)).toThrow();
  });

  it('still loads its sole level', () => {
    const seq = createSequence([SOURCES[0]]);
    expect(currentLevel(seq).name).toBeDefined();
  });
});
