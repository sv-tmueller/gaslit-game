// Development-mode attempt count override.
//
// Lets a designer jump straight to attempt 4 without dying three times.
// The override map is populated from a URL query parameter (?attempt=...)
// and consulted per-level at run-start. Production builds simply pass an
// empty overrides map, making this a pure passthrough.

/**
 * Return the effective attempt for `levelId`: the overridden value when one
 * exists, otherwise the real attempt counter.
 */
export function applyAttemptOverride(
  levelId: string,
  realAttempt: number,
  overrides: Readonly<Record<string, number>>,
): number {
  return overrides[levelId] ?? realAttempt;
}

/**
 * Parse `?attempt=levelId:4,otherLevel:2` from a URL query string.
 *
 * Returns a map of levelId to attempt number. Malformed URLs, missing
 * parameters, and individual pairs with non-numeric or sub-1 values are
 * silently skipped. An empty map means "no overrides".
 */
export function parseOverridesFromUrl(url: string): Readonly<Record<string, number>> {
  try {
    const urlObj = new URL(url);
    const param = urlObj.searchParams.get('attempt');
    if (!param) return {};

    const overrides: Record<string, number> = {};
    for (const pair of param.split(',')) {
      const parts = pair.split(':');
      const id = parts[0];
      const numStr = parts[1];
      if (id && numStr) {
        const num = parseInt(numStr, 10);
        if (Number.isInteger(num) && num >= 1) {
          overrides[id] = num;
        }
      }
    }
    return overrides;
  } catch {
    return {};
  }
}
