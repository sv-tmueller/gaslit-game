// src/tools/**: build-time-only, node-only. Never imported by src/main.ts,
// src/engine/**, or src/render/**.
//
// Entry point for `npm run build:atlas`. Writes assets/atlas.png and
// assets/atlas.json; both files are committed so the renderer can load the
// atlas without running this script first. Requires Node 22.6+ for built-in
// TypeScript type stripping; see docs/design/visual-identity.md.
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildAtlas } from './atlas-spec.ts';

const { png, manifest } = buildAtlas();

// Resolved via import.meta.url rather than cwd, so the script works from anywhere.
const assetsDir = new URL('../../assets/', import.meta.url);
const pngPath = new URL('atlas.png', assetsDir);
const jsonPath = new URL('atlas.json', assetsDir);

mkdirSync(assetsDir, { recursive: true });
writeFileSync(pngPath, png);
writeFileSync(jsonPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(
  `wrote ${manifest.width}x${manifest.height} atlas.png (${png.length} bytes) and atlas.json with ${Object.keys(manifest.frames).length} frames`,
);
