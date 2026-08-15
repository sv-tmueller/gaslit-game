import { describe, expect, it } from 'vitest';
import { ReplayRecorder, ReplayPlayer, serializeReplay, deserializeReplay } from './recorder';

function frame(left = false, right = false, jump = false, restart = false) {
  return { left, right, jump, restart };
}

describe('replay recorder', () => {
  it('records frames', () => {
    const r = new ReplayRecorder();
    r.record(frame(true));
    r.record(frame(true));
    r.record(frame(true, false, true));
    expect(r.length).toBe(2); // consecutive identical frames are deduplicated
  });

  it('finish produces replay data', () => {
    const r = new ReplayRecorder();
    r.record(frame(true));
    const data = r.finish('test', 42, -1, true);
    expect(data.levelId).toBe('test');
    expect(data.seed).toBe(42);
    expect(data.completed).toBe(true);
    expect(data.frames).toHaveLength(1);
  });
});

describe('replay player', () => {
  it('plays back frames in order', () => {
    const r = new ReplayRecorder();
    r.record(frame(true));
    r.record(frame(false, true));
    const data = r.finish('test', 42, -1, true);
    const player = new ReplayPlayer(data);
    expect(player.nextFrame()?.left).toBe(true);
    expect(player.nextFrame()?.right).toBe(true);
    expect(player.nextFrame()).toBeNull();
  });

  it('reset restarts playback', () => {
    const r = new ReplayRecorder();
    r.record(frame(true));
    const data = r.finish('test', 42, -1, true);
    const player = new ReplayPlayer(data);
    player.nextFrame();
    player.reset();
    expect(player.currentIndex).toBe(0);
  });
});

describe('serialization', () => {
  it('round-trips through serialize/deserialize', () => {
    const r = new ReplayRecorder();
    r.record(frame(true, false, true));
    const data = r.finish('lvl-1', 99, 42, false);
    const serialized = serializeReplay(data);
    const deserialized = deserializeReplay(serialized);
    expect(deserialized.levelId).toBe('lvl-1');
    expect(deserialized.seed).toBe(99);
    expect(deserialized.frames).toHaveLength(1);
  });
});
