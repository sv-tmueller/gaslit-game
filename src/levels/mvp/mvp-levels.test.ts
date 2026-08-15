import { describe, expect, it } from "vitest";
import { loadLevel } from "../load";
import { validateMutations } from "../mutations";
import type { MutableLevelData } from "../mutation-types";
import { Tile } from "../types";
import { MVP_LEVELS, MVP_SEQUENCE } from "./index";

/**
 * Loads a raw level source into LevelData, attaching the optional mutations
 * array so callers can exercise the mutation resolver if desired.
 */
function loadWithMutations(source: unknown): MutableLevelData {
  const level = loadLevel(source);
  const raw = source as Record<string, unknown>;
  const mutations = raw["mutations"];
  if (mutations === undefined) return level;
  return { ...level, mutations: mutations as never };
}

const KNOWN_TRAP_TYPES: readonly string[] = [
  "vanishing-floor",
  "emerging-spikes",
  "crusher",
  "shifting-wall",
  "fake-exit",
];

const VALID_ROWS = [12, 24];

describe("MVP levels", () => {
  for (const [id, source] of Object.entries(MVP_LEVELS)) {
    describe(`${id}`, () => {
      it("loads via loadLevel without errors", () => {
        expect(() => loadLevel(source)).not.toThrow();
      });

      it("has valid dimensions (20 cols, 12 or 24 rows)", () => {
        const level = loadLevel(source);
        expect(level.cols).toBe(20);
        expect(VALID_ROWS).toContain(level.rows);
      });

      it("spawn is in bounds", () => {
        const level = loadLevel(source);
        expect(level.spawn.col).toBeGreaterThanOrEqual(0);
        expect(level.spawn.col).toBeLessThan(level.cols);
        expect(level.spawn.row).toBeGreaterThanOrEqual(0);
        expect(level.spawn.row).toBeLessThan(level.rows);
      });

      it("exit is in bounds", () => {
        const level = loadLevel(source);
        expect(level.exit.col).toBeGreaterThanOrEqual(0);
        expect(level.exit.col).toBeLessThan(level.cols);
        expect(level.exit.row).toBeGreaterThanOrEqual(0);
        expect(level.exit.row).toBeLessThan(level.rows);
      });

      it("tiles count equals cols times rows", () => {
        const level = loadLevel(source);
        expect(level.tiles).toHaveLength(level.cols * level.rows);
      });

      it("spawn is not inside a solid tile", () => {
        const level = loadLevel(source);
        const idx = level.spawn.row * level.cols + level.spawn.col;
        expect(level.tiles[idx]).not.toBe(Tile.Solid);
      });

      it("exit is not inside a solid tile", () => {
        const level = loadLevel(source);
        const idx = level.exit.row * level.cols + level.exit.col;
        expect(level.tiles[idx]).not.toBe(Tile.Solid);
      });

      it("all traps have known types", () => {
        const level = loadLevel(source);
        for (const trap of level.traps) {
          expect(KNOWN_TRAP_TYPES).toContain(trap.type);
        }
      });

      it("all trap ids are unique", () => {
        const level = loadLevel(source);
        const ids = level.traps.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("mutations (if present) validate without errors", () => {
        const raw = source as Record<string, unknown>;
        if (raw["mutations"] === undefined) return;
        const errors: { code: string; path: string; message: string }[] = [];
        const result = validateMutations(
          raw as Readonly<Record<string, unknown>>,
          errors,
        );
        expect(errors).toHaveLength(0);
        expect(result).toBeDefined();
      });

      it("mutations (if present) load without throwing", () => {
        const raw = source as Record<string, unknown>;
        if (raw["mutations"] === undefined) return;
        expect(() => loadWithMutations(source)).not.toThrow();
      });
    });
  }

  it("has exactly 15 levels", () => {
    expect(Object.keys(MVP_LEVELS)).toHaveLength(15);
  });

  it("MVP sequence has 15 entries", () => {
    expect(MVP_SEQUENCE).toHaveLength(15);
  });

  it("every sequence entry exists in MVP_LEVELS", () => {
    for (const id of MVP_SEQUENCE) {
      expect(MVP_LEVELS[id]).toBeDefined();
    }
  });

  it("no duplicate IDs in MVP_SEQUENCE", () => {
    const unique = new Set(MVP_SEQUENCE);
    expect(unique.size).toBe(MVP_SEQUENCE.length);
  });

  it("first level is first-lie", () => {
    expect(MVP_SEQUENCE[0]).toBe("first-lie");
  });

  it("last level is finale", () => {
    expect(MVP_SEQUENCE[MVP_SEQUENCE.length - 1]).toBe("finale");
  });
});
