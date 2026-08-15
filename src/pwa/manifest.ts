// PWA manifest, offline play, favicon, OG and meta tags (#52).
// Generates the web app manifest and meta tag content from the game identity.

export interface ManifestIcon {
  readonly src: string;
  readonly sizes: string;
  readonly type: string;
  readonly purpose: 'any' | 'maskable' | 'monochrome';
}

export interface WebAppManifest {
  readonly name: string;
  readonly short_name: string;
  readonly description: string;
  readonly start_url: '/';
  readonly display: 'fullscreen';
  readonly background_color: string;
  readonly theme_color: string;
  readonly icons: readonly ManifestIcon[];
}

export function createManifest(): WebAppManifest {
  return {
    name: 'Pitfall',
    short_name: 'Pitfall',
    description: 'A trap platformer where the level lies to you between attempts.',
    start_url: '/',
    display: 'fullscreen',
    background_color: '#05050a',
    theme_color: '#05050a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

export interface MetaTag {
  readonly name?: string;
  readonly property?: string;
  readonly content: string;
}

export function createMetaTags(): readonly MetaTag[] {
  return [
    { name: 'description', content: 'A trap platformer where the level lies to you between attempts.' },
    { property: 'og:title', content: 'Pitfall' },
    { property: 'og:description', content: 'A trap platformer where the level lies to you between attempts.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: '/og-image.png' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Pitfall' },
    { name: 'twitter:description', content: 'A trap platformer where the level lies to you between attempts.' },
    { name: 'twitter:image', content: '/og-image.png' },
  ];
}

// Service worker update strategy: version-tagged cache, stale-while-revalidate
export interface SwVersion {
  readonly version: string;
  readonly cachePrefix: string;
}

export function createSwVersion(version: string = '1.0.0'): SwVersion {
  return { version, cachePrefix: `pitfall-${version}` };
}

export function getCachedAssetKey(sw: SwVersion, path: string): string {
  return `${sw.cachePrefix}-${path}`;
}
