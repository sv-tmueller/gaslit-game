import { describe, expect, it, vi } from 'vitest';
import { TILE_SIZE } from '../engine/physics';
import type { LevelData, Tile as LvlTile } from '../levels/types';
import {
  createScene,
  stepScene,
  type SceneActions,
  type SceneState,
} from './scene';
import {
  DEATH_FREEZE_STEPS,
  EXIT_BEAT_STEPS,
  PLAYER_HEIGHT,
  spawnToBody,
} from './constants';
import { createControllerState } from '../engine/controller';

const DT = 1 / 60;

function idle(overrides: Partial<SceneActions> = {}): SceneActions {
  return {
    left: false,
    right: false,
    jumpPressed: false,
    jumpHeld: false,
    restart: false,
    ...overrides,
  };
}

/**
 * Minimal 3-row level: ceiling, open middle, floor. Spawn and exit are
 * configurable. Middle-row tiles accept '0' (empty), '1' (solid), '3' (hazard).
 */
function makeMiniLevel(opts: {
  spawn: { col: number; row: number };
  exit: { col: number; row: number };
  middleTiles?: string;
}): LevelData {
  const cols = opts.middleTiles?.length ?? 6;
  const middle = opts.middleTiles ?? ''.padEnd(cols, '0');

  const tiles: LvlTile[] = [];
  for (let c = 0; c < cols; c++) tiles.push(1);
  for (const ch of middle) {
    if (ch === '1') tiles.push(1);
    else if (ch === '3') tiles.push(3);
    else tiles.push(0);
  }
  for (let c = 0; c < cols; c++) tiles.push(1);

  return {
    name: 'mini',
    cols,
    rows: 3,
    spawn: opts.spawn,
    exit: opts.exit,
    tiles,
    traps: [],
  };
}

/** Converts a LevelData into the raw JSON-source shape loadLevel expects. */
function asSource(level: LevelData): unknown {
  // Validator expects tiles as an array of row strings, each of length cols.
  const rowStrings: string[] = [];
  for (let r = 0; r < level.rows; r++) {
    let rowStr = '';
    for (let c = 0; c < level.cols; c++) {
      rowStr += String(level.tiles[r * level.cols + c]);
    }
    rowStrings.push(rowStr);
  }

  return {
    name: level.name,
    cols: level.cols,
    rows: level.rows,
    spawn: level.spawn,
    exit: level.exit,
    tiles: rowStrings,
    traps: level.traps,
  };
}

const SAFE_LEVEL = makeMiniLevel({
  spawn: { col: 1, row: 1 },
  exit: { col: 4, row: 1 },
  middleTiles: '000000',
});

const HAZARD_AT_SPAWN = makeMiniLevel({
  spawn: { col: 1, row: 1 },
  exit: { col: 4, row: 1 },
  middleTiles: '030000',
});

// ===========================================================================
// Death on hazard overlap
// ===========================================================================

describe('scene - death on hazard overlap', () => {
  it('transitions to dying and increments counters when body touches hazard', () => {
    const scene = createScene([asSource(HAZARD_AT_SPAWN)]);
    const next = stepScene(scene, idle(), DT);
    expect(next.phase).toBe('dying');
    expect(next.deathsThisLevel).toBe(1);
    expect(next.deathsTotal).toBe(1);
    expect(next.timer).toBe(DEATH_FREEZE_STEPS);
  });
});

// ===========================================================================
// Freeze countdown
// ===========================================================================

describe('scene - death freeze countdown', () => {
  it('stays in dying for DEATH_FREEZE_STeps then respawns at spawn', () => {
    const scene = createScene([asSource(HAZARD_AT_SPAWN)]);

    let s = stepScene(scene, idle(), DT);
    expect(s.phase).toBe('dying');

    for (let i = 0; i < DEATH_FREEZE_STEPS; i++) {
      s = stepScene(s, idle(), DT);
    }
    expect(s.phase).toBe('dying');
    expect(s.timer).toBe(0);

    // One more step respawns
    s = stepScene(s, idle(), DT);
    expect(s.phase).toBe('playing');
    expect(s.controller.body.x).toBe(1 * TILE_SIZE);
    expect(s.controller.body.y).toBe((1 + 1) * TILE_SIZE - PLAYER_HEIGHT);
    expect(s.controller.body.velocity.x).toBe(0);
    expect(s.controller.body.velocity.y).toBe(0);
  });
});

// ===========================================================================
// Clean reset
// ===========================================================================

describe('scene - clean reset on respawn', () => {
  it('rebuilds controller state from scratch after death', () => {
    const scene = createScene([asSource(HAZARD_AT_SPAWN)]);

    // Pollute the controller state before death
    const base = createControllerState(spawnToBody(HAZARD_AT_SPAWN.spawn, PLAYER_HEIGHT));
    const dirty: SceneState = {
      ...scene,
      controller: {
        body: {
          ...base.body,
          velocity: { x: 100, y: 200 },
          grounded: true,
        },
        coyoteSteps: 5,
        jumpBufferSteps: 3,
        jumpCutArmed: true,
      },
    };

    let s = stepScene(dirty, idle(), DT);
    expect(s.phase).toBe('dying');

    for (let i = 0; i < DEATH_FREEZE_STEPS + 1; i++) {
      s = stepScene(s, idle(), DT);
    }

    expect(s.phase).toBe('playing');
    expect(s.controller.body.velocity.x).toBe(0);
    expect(s.controller.body.velocity.y).toBe(0);
    expect(s.controller.coyoteSteps).toBe(0);
    expect(s.controller.jumpBufferSteps).toBe(-1);
    expect(s.controller.jumpCutArmed).toBe(false);
  });
});

// ===========================================================================
// R-key restart
// ===========================================================================

describe('scene - R-key restart', () => {
  it('triggers dying phase WITHOUT incrementing counters', () => {
    const scene = createScene([asSource(SAFE_LEVEL)]);
    const prevDeaths = scene.deathsThisLevel;
    const prevTotal = scene.deathsTotal;

    const s = stepScene(scene, idle({ restart: true }), DT);

    expect(s.phase).toBe('dying');
    expect(s.timer).toBe(DEATH_FREEZE_STEPS);
    expect(s.deathsThisLevel).toBe(prevDeaths);
    expect(s.deathsTotal).toBe(prevTotal);
  });

  it('R-key during dying is a no-op (just decrements timer)', () => {
    const scene = createScene([asSource(SAFE_LEVEL)]);

    let s = stepScene(scene, idle({ restart: true }), DT);
    expect(s.phase).toBe('dying');
    const timerAfterRestart = s.timer;

    s = stepScene(s, idle({ restart: true }), DT);
    expect(s.phase).toBe('dying');
    expect(s.timer).toBe(timerAfterRestart - 1);
  });
});

// ===========================================================================
// Multiple deaths accumulate
// ===========================================================================

describe('scene - cumulative deaths', () => {
  it('accumulates deathsThisLevel and deathsTotal across multiple deaths', () => {
    const scene = createScene([asSource(HAZARD_AT_SPAWN)]);

    let s = stepScene(scene, idle(), DT);
    expect(s.deathsThisLevel).toBe(1);
    expect(s.deathsTotal).toBe(1);

    for (let i = 0; i < DEATH_FREEZE_STEPS + 1; i++) {
      s = stepScene(s, idle(), DT);
    }
    expect(s.phase).toBe('playing');

    s = stepScene(s, idle(), DT);
    expect(s.deathsThisLevel).toBe(2);
    expect(s.deathsTotal).toBe(2);
  });
});

// ===========================================================================
// Exit overlap
// ===========================================================================

describe('scene - exit overlap', () => {
  it('transitions to entering when body overlaps exit', () => {
    const EXIT_AT_SPAWN = makeMiniLevel({
      spawn: { col: 1, row: 1 },
      exit: { col: 1, row: 1 },
      middleTiles: '000000',
    });
    const scene = createScene([asSource(EXIT_AT_SPAWN)]);

    const s = stepScene(scene, idle(), DT);
    expect(s.phase).toBe('entering');
    expect(s.timer).toBe(EXIT_BEAT_STEPS);
  });
});

// ===========================================================================
// Entering -> level advance
// ===========================================================================

describe('scene - entering countdown and level advance', () => {
  it('advances to the next level after EXIT_BEAT_STEPS and spawns at new spawn', () => {
    const level1 = makeMiniLevel({
      spawn: { col: 1, row: 1 },
      exit: { col: 1, row: 1 },
      middleTiles: '000000',
    });
    const level2 = makeMiniLevel({
      spawn: { col: 2, row: 1 },
      exit: { col: 5, row: 1 },
      middleTiles: '000000',
    });

    const scene = createScene([asSource(level1), asSource(level2)]);

    let s = stepScene(scene, idle(), DT);
    expect(s.phase).toBe('entering');

    for (let i = 0; i < EXIT_BEAT_STEPS; i++) {
      s = stepScene(s, idle(), DT);
    }
    expect(s.phase).toBe('entering');
    expect(s.timer).toBe(0);

    s = stepScene(s, idle(), DT);
    expect(s.phase).toBe('playing');
    expect(s.sequence.index).toBe(1);
    expect(s.controller.body.x).toBe(2 * TILE_SIZE);
    expect(s.controller.body.y).toBe((1 + 1) * TILE_SIZE - PLAYER_HEIGHT);
  });

  it('resets deathsThisLevel to 0 on advance but preserves deathsTotal', () => {
    // Two levels. Level 1 has exit at spawn so the player enters immediately.
    // We inject a fake death count before triggering the advance.
    const level1 = makeMiniLevel({
      spawn: { col: 1, row: 1 },
      exit: { col: 1, row: 1 },
      middleTiles: '000000',
    });
    const level2 = makeMiniLevel({
      spawn: { col: 2, row: 1 },
      exit: { col: 5, row: 1 },
      middleTiles: '000000',
    });

    const scene = createScene([asSource(level1), asSource(level2)]);

    // Simulate having died twice on level 1 before reaching the exit.
    let s: SceneState = {
      ...scene,
      deathsThisLevel: 2,
      deathsTotal: 3,
    };

    // Trigger entering (exit at spawn)
    s = stepScene(s, idle(), DT);
    expect(s.phase).toBe('entering');
    expect(s.deathsThisLevel).toBe(2); // not reset yet
    expect(s.deathsTotal).toBe(3);

    // Exhaust the beat
    for (let i = 0; i < EXIT_BEAT_STEPS; i++) {
      s = stepScene(s, idle(), DT);
    }

    // Advance to level 2
    s = stepScene(s, idle(), DT);
    expect(s.phase).toBe('playing');
    expect(s.sequence.index).toBe(1);
    expect(s.deathsThisLevel).toBe(0); // reset
    expect(s.deathsTotal).toBe(3); // preserved
  });

  it('last level entering transitions to complete', () => {
    const level1 = makeMiniLevel({
      spawn: { col: 1, row: 1 },
      exit: { col: 1, row: 1 },
      middleTiles: '000000',
    });

    const scene = createScene([asSource(level1)]);

    let s = stepScene(scene, idle(), DT);
    expect(s.phase).toBe('entering');

    for (let i = 0; i < EXIT_BEAT_STEPS; i++) {
      s = stepScene(s, idle(), DT);
    }

    s = stepScene(s, idle(), DT);
    expect(s.phase).toBe('complete');
  });
});

// ===========================================================================
// Complete phase is a no-op
// ===========================================================================

describe('scene - complete phase', () => {
  it('stepping while complete returns the same state', () => {
    const level1 = makeMiniLevel({
      spawn: { col: 1, row: 1 },
      exit: { col: 1, row: 1 },
      middleTiles: '000000',
    });

    let s = createScene([asSource(level1)]);

    s = stepScene(s, idle(), DT);
    for (let i = 0; i < EXIT_BEAT_STEPS; i++) {
      s = stepScene(s, idle(), DT);
    }
    s = stepScene(s, idle(), DT);
    expect(s.phase).toBe('complete');

    const after = stepScene(s, idle(), DT);
    expect(after).toBe(s);
  });
});

// ===========================================================================
// Callbacks
// ===========================================================================

describe('scene - callbacks', () => {
  it('fires onLevelComplete with the level index when entering begins', () => {
    const onLevelComplete = vi.fn();
    const level1 = makeMiniLevel({
      spawn: { col: 1, row: 1 },
      exit: { col: 1, row: 1 },
      middleTiles: '000000',
    });

    const scene = createScene([asSource(level1)], { onLevelComplete });
    stepScene(scene, idle(), DT);

    expect(onLevelComplete).toHaveBeenCalledOnce();
    expect(onLevelComplete).toHaveBeenCalledWith(0);
  });

  it('fires onSequenceComplete when the last level finishes entering', () => {
    const onSequenceComplete = vi.fn();
    const level1 = makeMiniLevel({
      spawn: { col: 1, row: 1 },
      exit: { col: 1, row: 1 },
      middleTiles: '000000',
    });

    const scene = createScene([asSource(level1)], { onSequenceComplete });

    let s = stepScene(scene, idle(), DT);
    for (let i = 0; i < EXIT_BEAT_STEPS; i++) {
      s = stepScene(s, idle(), DT);
    }
    s = stepScene(s, idle(), DT);

    expect(onSequenceComplete).toHaveBeenCalledOnce();
    expect(s.phase).toBe('complete');
  });
});

// ===========================================================================
// Hazard vs exit priority
// ===========================================================================

describe('scene - hazard takes priority over exit', () => {
  it('when body overlaps both hazard and exit in the same step, death wins', () => {
    const CONTESTED = makeMiniLevel({
      spawn: { col: 1, row: 1 },
      exit: { col: 1, row: 1 },
      middleTiles: '030000',
    });

    const scene = createScene([asSource(CONTESTED)]);
    const s = stepScene(scene, idle(), DT);

    expect(s.phase).toBe('dying');
    expect(s.deathsThisLevel).toBe(1);
  });
});
