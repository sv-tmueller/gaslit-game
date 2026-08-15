import { createPrng } from '../engine/prng';

import type { CatalogueEntry } from './messages';
import { DENIAL_MESSAGES } from './messages';

// Denial system: selects a message from the catalogue based on the current
// game context. Selection is deterministic (seeded), contextual (driven by
// what mutated and how often the player died), and data-driven (logic here,
// tone in messages.ts).

export interface DenialContext {
  readonly levelId: string;
  readonly attemptCount: number;
  readonly deathCount: number;
  readonly mutatedSomething: boolean;
  readonly mutationTypes: readonly string[];
  readonly seed: number;
}

export interface DenialMessage {
  readonly text: string;
  readonly trigger: 'on-death' | 'on-level-start';
}

export type DenialTrigger = 'on-death' | 'on-level-start';

export function selectDenialMessage(
  context: DenialContext,
  trigger: DenialTrigger,
): DenialMessage | null {
  if (trigger === 'on-level-start' && !context.mutatedSomething) return null;
  if (trigger === 'on-death' && context.deathCount === 0) return null;

  const pool = filterMessages(trigger, context);
  if (pool.length === 0) return null;

  const prng = createPrng(
    (context.seed ^ context.attemptCount ^ context.deathCount) >>> 0,
  );
  const idx = prng.int(0, pool.length - 1);
  const entry = pool[idx];

  if (entry === undefined) return null;

  return { text: entry.text, trigger: entry.trigger };
}

function filterMessages(
  trigger: DenialTrigger,
  context: DenialContext,
): readonly CatalogueEntry[] {
  return DENIAL_MESSAGES.filter((entry) => {
    if (entry.trigger !== trigger) return false;

    // minDeaths gate: only show escalated messages after enough deaths.
    if (entry.minDeaths !== undefined && context.deathCount < entry.minDeaths) {
      return false;
    }

    // mutationTypes gate: if the entry restricts to certain mutations,
    // at least one of the context mutations must match.
    if (entry.mutationTypes !== undefined) {
      const hasMatch = entry.mutationTypes.some((mt) =>
        context.mutationTypes.includes(mt),
      );
      if (!hasMatch) return false;
    }

    return true;
  });
}
