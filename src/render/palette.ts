// Pure data, no platform imports. Importable by app code and by src/tools/** alike.
// See docs/design/visual-identity.md for the usage rule attached to each token.

export type PaletteToken = 'void' | 'night' | 'dusk' | 'edge' | 'bone' | 'lethal';

export const PALETTE: Record<PaletteToken, string> = {
  void: '#05050a',
  night: '#12121c',
  dusk: '#24243a',
  edge: '#4a4a63',
  bone: '#e6e6f0',
  lethal: '#ff2e3c',
};

// Declaration order here is the PNG PLTE order (after the reserved transparent index 0).
export const PALETTE_ORDER: readonly PaletteToken[] = [
  'void',
  'night',
  'dusk',
  'edge',
  'bone',
  'lethal',
];
