export * from './types';
export * from './validate';
export * from './load';

// Fixtures (src/levels/fixtures) are deliberately not re-exported here.
// This barrel is the game-facing surface; re-exporting would pull three
// JSON documents into the import graph of every consumer of src/levels,
// betting on the bundler to tree-shake an aggregated Record. Every real
// fixture consumer is a test, which already imports './fixtures' directly.
