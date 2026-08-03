// Test-only ASCII level parser. Not imported by shipped code, so Vite does not bundle it.
import { Tile, type TileGrid } from './physics';

export function parseGrid(rows: readonly string[]): TileGrid {
  const rowCount = rows.length;
  const colCount = rows[0]?.length ?? 0;
  const tiles: Tile[] = [];

  rows.forEach((row, index) => {
    if (row.length !== colCount) {
      throw new Error(`parseGrid: row ${index} has length ${row.length}, expected ${colCount}`);
    }
    for (const char of row) {
      switch (char) {
        case '#':
          tiles.push(Tile.Solid);
          break;
        case '-':
          tiles.push(Tile.OneWay);
          break;
        default:
          tiles.push(Tile.Empty);
      }
    }
  });

  return { cols: colCount, rows: rowCount, tiles };
}
