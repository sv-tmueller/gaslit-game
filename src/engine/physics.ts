export const TILE_SIZE = 16;

export interface Vec2 {
  x: number;
  y: number;
}

// x,y = top-left.
export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Body extends AABB {
  velocity: Vec2;
  grounded: boolean;
}

// const-object stand-in for a const enum: isolatedModules rules const enum out.
export const Tile = { Empty: 0, Solid: 1, OneWay: 2 } as const;
export type Tile = (typeof Tile)[keyof typeof Tile];

export interface TileGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tiles: readonly Tile[];
}

export interface CollisionResult {
  body: Body;
  hitWall: boolean;
  hitCeiling: boolean;
}

// Levels are expected to wall themselves; out-of-bounds reads as Empty rather
// than aliasing into a neighboring row, so col and row are bounds-checked
// separately before the flat-index lookup.
export function tileAt(grid: TileGrid, col: number, row: number): Tile {
  if (col < 0 || col >= grid.cols || row < 0 || row >= grid.rows) {
    return Tile.Empty;
  }
  return grid.tiles[row * grid.cols + col] ?? Tile.Empty;
}

// Inclusive first tile of the span.
function spanStart(pos: number): number {
  return Math.floor(pos / TILE_SIZE);
}

// Inclusive last tile of a span [pos, pos + size). Using
// ceil(end / TILE_SIZE) - 1 (rather than the naive floor(end / TILE_SIZE))
// keeps a box whose far edge lands exactly on a tile boundary from being
// counted as occupying the next tile over.
function spanEnd(pos: number, size: number): number {
  return Math.ceil((pos + size) / TILE_SIZE) - 1;
}

function resolveX(
  body: Body,
  grid: TileGrid,
  dt: number,
): { x: number; vx: number; hitWall: boolean } {
  const vx = body.velocity.x;
  let x = body.x + vx * dt;
  let hitWall = false;

  if (vx !== 0) {
    const minRow = spanStart(body.y);
    const maxRow = spanEnd(body.y, body.height);

    if (vx > 0) {
      const col = spanEnd(x, body.width);
      for (let row = minRow; row <= maxRow; row++) {
        if (tileAt(grid, col, row) === Tile.Solid) {
          x = col * TILE_SIZE - body.width;
          hitWall = true;
          break;
        }
      }
    } else {
      const col = spanStart(x);
      for (let row = minRow; row <= maxRow; row++) {
        if (tileAt(grid, col, row) === Tile.Solid) {
          x = (col + 1) * TILE_SIZE;
          hitWall = true;
          break;
        }
      }
    }
  }

  return { x, vx: hitWall ? 0 : vx, hitWall };
}

function resolveY(
  body: Body,
  grid: TileGrid,
  dt: number,
): { y: number; vy: number; hitCeiling: boolean; grounded: boolean } {
  const vy = body.velocity.y;
  const originalBottom = body.y + body.height;
  let y = body.y + vy * dt;
  let hitCeiling = false;
  let grounded = false;
  let resolvedVy = vy;

  const minCol = spanStart(body.x);
  const maxCol = spanEnd(body.x, body.width);

  if (vy >= 0) {
    const row = spanEnd(y, body.height);
    for (let col = minCol; col <= maxCol; col++) {
      const tile = tileAt(grid, col, row);
      const tileTop = row * TILE_SIZE;
      // One-way tiles are solid only from above: the body's bottom edge must
      // have started at or above the tile's top face this step.
      const isBlocking = tile === Tile.Solid || (tile === Tile.OneWay && originalBottom <= tileTop);
      if (isBlocking) {
        y = tileTop - body.height;
        resolvedVy = 0;
        grounded = true;
        break;
      }
    }
  } else {
    const row = spanStart(y);
    for (let col = minCol; col <= maxCol; col++) {
      if (tileAt(grid, col, row) === Tile.Solid) {
        y = (row + 1) * TILE_SIZE;
        resolvedVy = 0;
        hitCeiling = true;
        break;
      }
    }
  }

  return { y, vy: resolvedVy, hitCeiling, grounded };
}

/**
 * Standard AABB intersection with STRICT inequalities: flush edges (equality)
 * read as NO overlap. Consistent with overlapsHazard in levelAdapter.ts and
 * the physics solver's spanEnd convention (ceil(end / TILE_SIZE) - 1) which
 * excludes the far-edge-aligned tile, so bodies standing exactly adjacent do
 * not register a spurious contact.
 */
export function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// With velocity.y === 0 the downward probe row is the body's own bottom row,
// so a resting body reports grounded: false; callers must apply gravity
// first (stepController guarantees vy >= 15).
export function moveAndCollide(body: Body, grid: TileGrid, dt: number): CollisionResult {
  const xResult = resolveX(body, grid, dt);
  const bodyAfterX: Body = {
    ...body,
    x: xResult.x,
    velocity: { x: xResult.vx, y: body.velocity.y },
  };

  const yResult = resolveY(bodyAfterX, grid, dt);
  const resolvedBody: Body = {
    ...bodyAfterX,
    y: yResult.y,
    velocity: { x: xResult.vx, y: yResult.vy },
    grounded: yResult.grounded,
  };

  return { body: resolvedBody, hitWall: xResult.hitWall, hitCeiling: yResult.hitCeiling };
}
