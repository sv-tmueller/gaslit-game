// Stats screen: surfaces real data from save (#47).
// Shows TRUE figures unlike the unreliable HUD (#22).

import type { SavePayload } from '../save/schema';
import { getLevelData } from '../save/repository';

export interface LevelStat {
  readonly levelId: string;
  readonly deaths: number;
  readonly attempts: number;
  readonly completed: boolean;
  readonly totalTimeSteps: number;  // estimated from attempts * average
}

export interface AggregateStats {
  readonly totalDeaths: number;
  readonly totalAttempts: number;
  readonly totalCompleted: number;
  readonly totalLevels: number;
  readonly deadliestLevel: string | null;
  readonly deadliestLevelDeaths: number;
  readonly completionRate: number;
}

export function getLevelStats(payload: SavePayload, levelId: string): LevelStat {
  const data = getLevelData(payload, levelId);
  return {
    levelId,
    deaths: data.deathCount,
    attempts: data.attemptCount,
    completed: data.completed,
    totalTimeSteps: data.attemptCount * 60, // rough estimate: 1 second per attempt
  };
}

export function getAllStats(payload: SavePayload): AggregateStats {
  const levelIds = Object.keys(payload.levels);
  let totalDeaths = 0;
  let totalAttempts = 0;
  let totalCompleted = 0;
  let deadliestLevel: string | null = null;
  let deadliestDeaths = 0;

  for (const id of levelIds) {
    const data = payload.levels[id]!;
    totalDeaths += data.deathCount;
    totalAttempts += data.attemptCount;
    if (data.completed) totalCompleted++;
    if (data.deathCount > deadliestDeaths) {
      deadliestDeaths = data.deathCount;
      deadliestLevel = id;
    }
  }

  return {
    totalDeaths,
    totalAttempts,
    totalCompleted,
    totalLevels: levelIds.length,
    deadliestLevel,
    deadliestLevelDeaths: deadliestDeaths,
    completionRate: levelIds.length > 0 ? totalCompleted / levelIds.length : 0,
  };
}

export function formatStats(stats: AggregateStats): readonly string[] {
  const lines: string[] = [];
  lines.push(`DEATHS: ${stats.totalDeaths}`);
  lines.push(`ATTEMPTS: ${stats.totalAttempts}`);
  lines.push(`COMPLETED: ${stats.totalCompleted}/${stats.totalLevels}`);
  if (stats.deadliestLevel) {
    lines.push(`DEADLIEST: ${stats.deadliestLevel} (${stats.deadliestLevelDeaths} deaths)`);
  }
  lines.push(`RATE: ${Math.round(stats.completionRate * 100)}%`);
  return lines;
}
