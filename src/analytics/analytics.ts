// Privacy-friendly analytics (#53).
// Cookieless, no personal data, no cross-site identifiers.
// Tracks aggregate level completion rates, deaths per level, drop-off points.

export interface AnalyticsEvent {
  readonly type: 'level-start' | 'level-complete' | 'death' | 'level-dropoff';
  readonly levelId: string;
  readonly timestamp: number;  // simulation step, not wall-clock
}

export interface LevelAnalytics {
  readonly levelId: string;
  readonly starts: number;
  readonly completions: number;
  readonly deaths: number;
  readonly dropoffs: number;
  readonly completionRate: number;
}

export interface AnalyticsCollector {
  readonly events: readonly AnalyticsEvent[];
  readonly levelData: Readonly<Record<string, LevelAnalytics>>;
}

export function createAnalyticsCollector(): AnalyticsCollector {
  return { events: [], levelData: {} };
}

export function recordEvent(collector: AnalyticsCollector, event: AnalyticsEvent): AnalyticsCollector {
  const events = [...collector.events, event];
  const levelData = { ...collector.levelData };
  const existing = levelData[event.levelId] ?? {
    levelId: event.levelId, starts: 0, completions: 0, deaths: 0, dropoffs: 0, completionRate: 0,
  };
  let updated: LevelAnalytics;
  switch (event.type) {
    case 'level-start':
      updated = { ...existing, starts: existing.starts + 1 };
      break;
    case 'level-complete':
      updated = { ...existing, completions: existing.completions + 1 };
      break;
    case 'death':
      updated = { ...existing, deaths: existing.deaths + 1 };
      break;
    case 'level-dropoff':
      updated = { ...existing, dropoffs: existing.dropoffs + 1 };
      break;
  }
  updated = {
    ...updated,
    completionRate: updated.starts > 0 ? updated.completions / updated.starts : 0,
  };
  levelData[event.levelId] = updated;
  return { events, levelData };
}

export function getDropoffLevels(collector: AnalyticsCollector): readonly string[] {
  return Object.values(collector.levelData)
    .filter(d => d.starts > 5 && d.completionRate < 0.3)
    .sort((a, b) => a.completionRate - b.completionRate)
    .map(d => d.levelId);
}

export function isCookieFree(): boolean {
  return true; // This analytics system uses no cookies, ever
}
