// Shared helpers for concrete trap implementations.
//
// Every trap factory receives a TrapEntry whose `trigger` is a STRING and
// whose `params` are JSON values. These helpers parse those into typed
// structures with proper validation, keeping individual trap modules small
// and consistent.

import type { TriggerContext, TriggerKind } from '../types';
import type { JsonValue, TilePosition } from '../../levels/types';
import type { AABB } from '../../engine/physics';

const VALID_TRIGGERS: readonly TriggerKind[] = [
  'on-land',
  'on-enter',
  'on-approach',
  'on-timer',
  'on-exit-reached',
  'on-trap-fired',
];

/**
 * Parses the `trigger` string from a TrapEntry into a TriggerKind. Throws
 * on any value outside the six valid kinds.
 */
export function parseTriggerKind(trigger: string): TriggerKind {
  if (!VALID_TRIGGERS.includes(trigger as TriggerKind)) {
    throw new Error(`invalid trigger "${trigger}"`);
  }
  return trigger as TriggerKind;
}

/**
 * Builds a TriggerContext from the trigger string and optional params.
 * Region and distance are extracted from params when present.
 */
export function buildTriggerContext(
  trigger: string,
  params: Readonly<Record<string, JsonValue>>,
): TriggerContext {
  const kind = parseTriggerKind(trigger);

  // Collect optional fields, omitting any that are absent so the resulting
  // object satisfies exactOptionalPropertyTypes on TriggerContext.
  const parts: { region?: AABB; distance?: number; delaySteps?: number } = {};

  const region = parseRegion(params);
  if (region !== undefined) {
    parts.region = region;
  }

  const distance = parseNumberParam(params, 'distance');
  if (distance !== undefined) {
    parts.distance = distance;
  }

  const delaySteps = parseNumberParam(params, 'delaySteps');
  if (delaySteps !== undefined) {
    parts.delaySteps = delaySteps;
  }

  return { kind, ...parts };
}

/**
 * Extracts a number param or throws if missing/not a number.
 */
export function reqNumber(params: Readonly<Record<string, JsonValue>>, key: string): number {
  const val = params[key];
  if (typeof val !== 'number') {
    throw new Error(`param "${key}" must be a number`);
  }
  return val;
}

/**
 * Extracts an optional number param, returns undefined if absent or not a number.
 */
export function optNumber(
  params: Readonly<Record<string, JsonValue>>,
  key: string,
): number | undefined {
  const val = params[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'number') return undefined;
  return val;
}

/**
 * Extracts a boolean param or throws if missing/not a boolean.
 */
export function reqBoolean(params: Readonly<Record<string, JsonValue>>, key: string): boolean {
  const val = params[key];
  if (typeof val !== 'boolean') {
    throw new Error(`param "${key}" must be a boolean`);
  }
  return val;
}

/**
 * Extracts an optional boolean param, returns defaultValue if absent.
 */
export function optBoolean(
  params: Readonly<Record<string, JsonValue>>,
  key: string,
  defaultValue: boolean,
): boolean {
  const val = params[key];
  if (typeof val === 'boolean') return val;
  return defaultValue;
}

/**
 * Extracts a string param or throws if missing/not a string.
 */
export function reqString(params: Readonly<Record<string, JsonValue>>, key: string): string {
  const val = params[key];
  if (typeof val !== 'string') {
    throw new Error(`param "${key}" must be a string`);
  }
  return val;
}

/**
 * Extracts a required array of objects with col/row from params.
 */
export function reqTileArray(
  params: Readonly<Record<string, JsonValue>>,
  key: string,
): TilePosition[] {
  const val = params[key];
  if (!Array.isArray(val)) {
    throw new Error(`param "${key}" must be an array`);
  }
  return val.map((item, idx) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`param "${key}[${idx}]" must be an object`);
    }
    const obj = item as { readonly [k: string]: JsonValue };
    const col = obj['col'];
    const row = obj['row'];
    if (typeof col !== 'number' || typeof row !== 'number') {
      throw new Error(`param "${key}[${idx}]" must have numeric col and row`);
    }
    return { col, row };
  });
}

/**
 * Converts a tile position to a pixel-space AABB.
 */
export function tileToAABB(col: number, row: number): AABB {
  return { x: col * 16, y: row * 16, width: 16, height: 16 };
}

// Internal: parse an optional region AABB from params.
function parseRegion(
  params: Readonly<Record<string, JsonValue>>,
): AABB | undefined {
  const raw = params['region'];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as { readonly [k: string]: JsonValue };
  const x = obj['x'];
  const y = obj['y'];
  const w = obj['width'];
  const h = obj['height'];
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof w !== 'number' ||
    typeof h !== 'number'
  ) {
    return undefined;
  }
  return { x, y, width: w, height: h };
}

// Internal: parse an optional number param.
function parseNumberParam(
  params: Readonly<Record<string, JsonValue>>,
  key: string,
): number | undefined {
  return optNumber(params, key);
}
