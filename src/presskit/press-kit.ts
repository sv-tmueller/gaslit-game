// Press kit: logos, screenshots, fact sheet, descriptions (#60).
// Data model for press materials, not the materials themselves.

export interface FactSheet {
  readonly studio: string;
  readonly releaseDate: string;
  readonly platforms: readonly string[];
  readonly price: string;
  readonly website: string;
  readonly engine: string;
  readonly genre: string;
}

export interface PressKitData {
  readonly factSheet: FactSheet;
  readonly oneLineDescription: string;
  readonly paragraphDescription: string;
  readonly logoFiles: readonly string[];
  readonly screenshotPaths: readonly string[];
  readonly gifPaths: readonly string[];
}

export function createPressKit(): PressKitData {
  return {
    factSheet: {
      studio: 'Independent',
      releaseDate: 'TBD',
      platforms: ['Web Browser'],
      price: 'Free',
      website: 'https://github.com/sv-tmueller/pitfall',
      engine: 'Vanilla TypeScript + Canvas2D',
      genre: 'Trap Platformer',
    },
    oneLineDescription: 'A trap platformer where the level lies to you between attempts.',
    paragraphDescription: 'Pitfall is a trap platformer inspired by the genre popularized by Level Devil. Short levels, instant death, and traps disguised as normal level geometry. The difference: the level itself is not fixed. Traps and level elements mutate between attempts, and the game denies that anything changed. The player has to notice the mutation, not just react fast enough.',
    logoFiles: ['/logo-full.png', '/logo-small.png', '/logo-icon.png'],
    screenshotPaths: ['/screenshots/screenshot-01.png', '/screenshots/screenshot-02.png', '/screenshots/screenshot-03.png'],
    gifPaths: ['/gifs/gameplay.gif', '/gifs/death.gif'],
  };
}
