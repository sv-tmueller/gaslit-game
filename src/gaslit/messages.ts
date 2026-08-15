// Message catalogue for the denial system. Pure data: arrays of strings with
// optional context filters. No logic lives here; denial.ts interprets it.
// Tone: calm, confident, wrong. Few words. Uppercase.

export interface CatalogueEntry {
  readonly trigger: 'on-death' | 'on-level-start';
  readonly text: string;
  readonly minDeaths?: number;
  readonly mutationTypes?: readonly string[];
}

export const DENIAL_MESSAGES: readonly CatalogueEntry[] = [
  // Level-start denials (shown when something mutated)
  { trigger: 'on-level-start', text: 'IT HAS ALWAYS BEEN LIKE THIS' },
  { trigger: 'on-level-start', text: 'NOTHING HAS CHANGED' },
  { trigger: 'on-level-start', text: 'YOU REMEMBER WRONG' },
  { trigger: 'on-level-start', text: 'THE LEVEL IS THE SAME' },
  { trigger: 'on-level-start', text: 'ARE YOU SURE?', minDeaths: 3 },
  { trigger: 'on-level-start', text: 'MAYBE YOU SHOULD TAKE A BREAK', minDeaths: 5 },
  {
    trigger: 'on-level-start',
    text: 'THAT GAP WAS ALWAYS THERE',
    mutationTypes: ['resize-gap', 'set-tile'],
  },
  {
    trigger: 'on-level-start',
    text: 'THE EXIT IS WHERE IT HAS ALWAYS BEEN',
    mutationTypes: ['move-exit'],
  },

  // Death denials
  { trigger: 'on-death', text: 'YOU DIED HERE BEFORE TOO' },
  { trigger: 'on-death', text: 'SAME SPOT AS LAST TIME', minDeaths: 2 },
  { trigger: 'on-death', text: 'THIS IS BECOMING A HABIT', minDeaths: 4 },
  { trigger: 'on-death', text: 'HAVE YOU TRIED NOT DYING?', minDeaths: 6 },
  { trigger: 'on-death', text: 'INTERESTING CHOICE', minDeaths: 3 },
];
