// Shareable death-count card (#54).
// Client-side canvas rendering of a shareable image summarizing the run.
// Generated entirely from local save data, nothing uploaded.

export interface ShareCardData {
  readonly totalDeaths: number;
  readonly totalTimeSteps: number;
  readonly deadliestLevel: string;
  readonly deadliestLevelDeaths: number;
  readonly completedLevels: number;
  readonly totalLevels: number;
}

export interface ShareCardLayout {
  readonly width: number;
  readonly height: number;
  readonly bgColor: string;
  readonly textColor: string;
  readonly accentColor: string;
  readonly title: string;
  readonly subtitle: string;
  readonly statsLines: readonly string[];
}

export function createShareCardData(
  totalDeaths: number,
  totalTimeSteps: number,
  deadliestLevel: string,
  deadliestLevelDeaths: number,
  completedLevels: number,
  totalLevels: number,
): ShareCardData {
  return { totalDeaths, totalTimeSteps, deadliestLevel, deadliestLevelDeaths, completedLevels, totalLevels };
}

export function layoutShareCard(data: ShareCardData): ShareCardLayout {
  const lines: string[] = [];
  lines.push(`DEATHS: ${data.totalDeaths}`);
  lines.push(`TIME: ${(data.totalTimeSteps / 60).toFixed(1)}s`);
  lines.push(`COMPLETED: ${data.completedLevels}/${data.totalLevels}`);
  if (data.deadliestLevelDeaths > 0) {
    lines.push(`DEADLIEST: ${data.deadliestLevel} (${data.deadliestLevelDeaths})`);
  }
  return {
    width: 320,
    height: 180,
    bgColor: '#05050a',
    textColor: '#e6e6f0',
    accentColor: '#ff2e3c',
    title: 'PITFALL',
    subtitle: 'YOUR RUN',
    statsLines: lines,
  };
}

export function renderShareCard(layout: ShareCardLayout, ctx: {
  fillStyle: string;
  fillRect(x: number, y: number, w: number, h: number): void;
}): void {
  // Clear with bg
  ctx.fillStyle = layout.bgColor;
  ctx.fillRect(0, 0, layout.width, layout.height);
  // Title bar
  ctx.fillStyle = layout.accentColor;
  ctx.fillRect(0, 0, layout.width, 4);
}

export function shareCardToDataURL(layout: ShareCardLayout): string {
  void layout;
  // In production, this would render to a canvas and call toDataURL.
  // For headless testing, return a placeholder.
  return 'data:image/png;base64,placeholder';
}
