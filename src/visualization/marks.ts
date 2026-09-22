import type { CellVisual } from '../core/types';

/**
 * Event → visual marks bridge.
 *
 * Algorithms highlight element ids (e.g. `cell:3`, `node:A`). The helpers here
 * translate an event's highlights into the `Map` structures the builders
 * consume, so every algorithm follows the same convention.
 */
export function marksFromHighlights(
  highlights: string[],
  state: CellVisual['state']
): Map<string, CellVisual['state']> {
  const marks = new Map<string, CellVisual['state']>();
  for (const id of highlights) marks.set(id, state);
  return marks;
}

/** Marks cells whose id matches `prefix:index` with the given state. */
export function markIndices(
  indices: readonly number[],
  state: CellVisual['state'],
  prefix = 'cell'
): Map<string, CellVisual['state']> {
  const marks = new Map<string, CellVisual['state']>();
  for (const index of indices) marks.set(`${prefix}:${index}`, state);
  return marks;
}

/** Merges several mark maps left-to-right (later entries win). */
export function mergeMarks(
  ...maps: Map<string, CellVisual['state']>[]
): Map<string, CellVisual['state']> {
  const merged = new Map<string, CellVisual['state']>();
  for (const map of maps) {
    for (const [key, value] of map) merged.set(key, value);
  }
  return merged;
}
