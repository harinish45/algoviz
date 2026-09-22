import type {
  ArrayVisual,
  BarsVisual,
  BitsVisual,
  CallStackVisual,
  CellVisual,
  EdgeVisual,
  LegendEntry,
  NodeVisual,
  NodesVisual,
  PlaneVisual,
  PointerVisual,
  QueueVisual,
  StackVisual,
  StringVisual,
  TableVisual,
  TextVisual,
  VisualState
} from '../core/types';

/**
 * Visualisation builders.
 *
 * Algorithms never hand-roll visual elements: they describe *semantic state*
 * (values, ids, marks) and these helpers produce the canonical, JSON
 * serialisable `VisualizationState`. Highlights coming from the execution event
 * are applied uniformly, so a highlight in the trace always changes the screen.
 */

export const DEFAULT_LEGEND: LegendEntry[] = [
  { state: 'idle', label: 'idle' },
  { state: 'compare', label: 'comparing' },
  { state: 'active', label: 'current' },
  { state: 'sorted', label: 'final' },
  { state: 'discarded', label: 'out of range' }
];

export function mergeLegend(...groups: (LegendEntry[] | undefined)[]): LegendEntry[] {
  const merged = new Map<VisualState, string>();
  for (const group of groups) {
    for (const entry of group ?? []) {
      if (!merged.has(entry.state)) merged.set(entry.state, entry.label);
    }
  }
  return [...merged.entries()].map(([state, label]) => ({ state, label }));
}

export interface MarkContext {
  /** Element ids highlighted by the execution event. */
  highlights: string[];
  /** State applied to highlighted elements (default: `compare`). */
  highlightState?: VisualState;
  /** Badge text rendered on highlighted elements (mirrors state as text). */
  highlightBadge?: string;
}

export function markOf(
  id: string,
  context: MarkContext
): { state: VisualState; badge?: string } | undefined {
  if (!context.highlights.includes(id)) return undefined;
  const state = context.highlightState ?? 'compare';
  return context.highlightBadge ? { state, badge: context.highlightBadge } : { state };
}

export interface ArrayBuildConfig {
  values: (string | number | null)[];
  caption: string;
  /** Element id factory; defaults to `cell:<index>`. */
  idFor?: (index: number) => string;
  labels?: string[];
  /** Explicit state per index (wins over highlight marks). */
  stateFor?: (index: number, id: string) => VisualState | undefined;
  badgeFor?: (index: number, id: string) => string | undefined;
  pointers?: PointerVisual[];
  legend?: LegendEntry[];
  marks?: MarkContext;
}

export function buildArray(config: ArrayBuildConfig): ArrayVisual {
  const marks = config.marks ?? { highlights: [] };
  const idFor = config.idFor ?? ((index: number) => `cell:${index}`);
  const cells: CellVisual[] = config.values.map((value, index) => {
    const id = idFor(index);
    const explicit = config.stateFor?.(index, id);
    const marked = markOf(id, marks);
    const cell: CellVisual = {
      id,
      value: value === null ? '·' : value,
      state: explicit ?? marked?.state ?? 'idle'
    };
    const label = config.labels?.[index];
    if (label !== undefined) cell.label = label;
    const badge = config.badgeFor?.(index, id) ?? marked?.badge;
    if (badge !== undefined) cell.badge = badge;
    return cell;
  });
  const visual: ArrayVisual = {
    kind: 'array',
    cells,
    caption: config.caption,
    legend: config.legend ?? DEFAULT_LEGEND
  };
  if (config.pointers && config.pointers.length > 0) visual.pointers = config.pointers;
  return visual;
}

export interface BarsBuildConfig {
  values: number[];
  caption: string;
  labels?: string[];
  stateFor?: (index: number) => VisualState | undefined;
  badgeFor?: (index: number) => string | undefined;
  pointers?: PointerVisual[];
  guide?: { value: number; label: string };
}

export function buildBars(config: BarsBuildConfig): BarsVisual {
  const bars = config.values.map((value, index) => {
    const bar: BarsVisual['bars'][number] = {
      id: `bar:${index}`,
      value,
      state: config.stateFor?.(index) ?? 'idle'
    };
    const label = config.labels?.[index];
    if (label !== undefined) bar.label = label;
    const badge = config.badgeFor?.(index);
    if (badge !== undefined) bar.badge = badge;
    return bar;
  });
  const visual: BarsVisual = { kind: 'bars', bars, caption: config.caption, legend: DEFAULT_LEGEND };
  if (config.pointers && config.pointers.length > 0) visual.pointers = config.pointers;
  if (config.guide) visual.guide = config.guide;
  return visual;
}

export function buildTable(config: {
  rows: (string | number | null)[][];
  caption: string;
  rowHeader?: string[];
  colHeader?: string[];
  /** Cell state keyed as `row,col` in a lookup map. */
  states?: Map<string, VisualState>;
  badges?: Map<string, string>;
  legend?: LegendEntry[];
}): TableVisual {
  const visual: TableVisual = {
    kind: 'table',
    rows: config.rows.map((row, r) =>
      row.map((value, c) => {
        const key = `${r},${c}`;
        const cell: CellVisual = {
          id: `table:${r},${c}`,
          value: value === null ? '·' : value,
          state: config.states?.get(key) ?? 'idle'
        };
        const badge = config.badges?.get(key);
        if (badge !== undefined) cell.badge = badge;
        return cell;
      })
    ),
    caption: config.caption,
    legend: config.legend ?? DEFAULT_LEGEND
  };
  if (config.rowHeader) visual.rowHeader = config.rowHeader;
  if (config.colHeader) visual.colHeader = config.colHeader;
  return visual;
}

export function buildStack(config: {
  label: string;
  items: (string | number)[];
  caption: string;
  stateFor?: (index: number) => VisualState | undefined;
  legend?: LegendEntry[];
}): StackVisual {
  return {
    kind: 'stack',
    label: config.label,
    items: config.items.map((value, index) => ({
      id: `stack:${index}`,
      value,
      state:
        config.stateFor?.(index) ?? (index === config.items.length - 1 ? 'active' : 'idle')
    })),
    caption: config.caption,
    legend: config.legend ?? DEFAULT_LEGEND
  };
}

export function buildQueue(config: {
  label: string;
  items: (string | number)[];
  caption: string;
  stateFor?: (index: number) => VisualState | undefined;
  legend?: LegendEntry[];
}): QueueVisual {
  return {
    kind: 'queue',
    label: config.label,
    items: config.items.map((value, index) => ({
      id: `queue:${index}`,
      value,
      state: config.stateFor?.(index) ?? (index === 0 ? 'active' : 'idle')
    })),
    caption: config.caption,
    legend: config.legend ?? DEFAULT_LEGEND
  };
}

export function buildNodes(config: {
  layout: 'list' | 'tree' | 'graph';
  nodes: NodeVisual[];
  edges?: EdgeVisual[];
  pointers?: PointerVisual[];
  caption: string;
  legend?: LegendEntry[];
}): NodesVisual {
  return {
    kind: 'nodes',
    layout: config.layout,
    nodes: config.nodes.map((node) => ({ ...node })),
    edges: (config.edges ?? []).map((edge) => ({ ...edge })),
    ...(config.pointers && config.pointers.length > 0 ? { pointers: config.pointers } : {}),
    caption: config.caption,
    legend: config.legend ?? DEFAULT_LEGEND
  };
}

/** Convenience for singly/doubly linked lists: values rendered in sequence. */
export function buildList(config: {
  values: (string | number)[];
  caption: string;
  formatNode?: (value: string | number, index: number) => string;
  stateFor?: (index: number) => VisualState | undefined;
  badgeFor?: (index: number) => string | undefined;
  /** Extra caption rendered under a node (e.g. next pointers). */
  subFor?: (index: number) => string | undefined;
  pointers?: PointerVisual[];
  /** Adds reverse arrows (doubly linked list). */
  bidirectional?: boolean;
  legend?: LegendEntry[];
}): NodesVisual {
  const nodes: NodeVisual[] = config.values.map((value, index) => {
    const node: NodeVisual = {
      id: `node:${index}`,
      label: config.formatNode ? config.formatNode(value, index) : String(value),
      state: config.stateFor?.(index) ?? 'idle'
    };
    const sub = config.subFor?.(index);
    if (sub !== undefined) node.sub = sub;
    const badge = config.badgeFor?.(index);
    if (badge !== undefined) node.badge = badge;
    return node;
  });
  const edges: EdgeVisual[] = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    edges.push({ id: `edge:${index}`, from: `node:${index}`, to: `node:${index + 1}`, directed: true });
    if (config.bidirectional) {
      edges.push({
        id: `edge:${index}-back`,
        from: `node:${index + 1}`,
        to: `node:${index}`,
        directed: true,
        state: 'muted'
      });
    }
  }
  return buildNodes({
    layout: 'list',
    nodes,
    edges,
    caption: config.caption,
    ...(config.pointers && config.pointers.length > 0 ? { pointers: config.pointers } : {}),
    ...(config.legend ? { legend: config.legend } : {})
  });
}

export function buildStrings(config: {
  rows: { label: string; text: string; idPrefix?: string }[];
  caption: string;
  cursors?: { id: string; label: string; row: number; index: number; state?: VisualState }[];
  /** Marks keyed as `row,index`. */
  marks?: Map<string, VisualState>;
  badges?: Map<string, string>;
  legend?: LegendEntry[];
}): StringVisual {
  return {
    kind: 'strings',
    rows: config.rows.map((row, rowIndex) => ({
      label: row.label,
      chars: [...row.text].map((character, index) => {
        const key = `${rowIndex},${index}`;
        const cell: CellVisual = {
          id: `${row.idPrefix ?? `row${rowIndex}`}:${index}`,
          value: character === ' ' ? '␣' : character,
          label: String(index),
          state: config.marks?.get(key) ?? 'idle'
        };
        const badge = config.badges?.get(key);
        if (badge !== undefined) cell.badge = badge;
        return cell;
      })
    })),
    ...(config.cursors ? { cursors: config.cursors } : {}),
    caption: config.caption,
    legend: config.legend ?? DEFAULT_LEGEND
  };
}

export function buildBits(config: {
  words: { label: string; value: number; width: number }[];
  caption: string;
  /** Marks keyed as `word,bit` (bit index counted from the least significant bit). */
  marks?: Map<string, VisualState>;
  badges?: Map<string, string>;
  legend?: LegendEntry[];
}): BitsVisual {
  return {
    kind: 'bits',
    words: config.words.map((word, wordIndex) => ({
      label: word.label,
      value: word.value,
      bits: Array.from({ length: word.width }, (_, offset) => {
        const bitIndex = word.width - 1 - offset;
        const key = `${wordIndex},${bitIndex}`;
        const cell: CellVisual = {
          id: `bit:${wordIndex}:${bitIndex}`,
          value: (word.value >> bitIndex) & 1,
          label: String(bitIndex),
          state: config.marks?.get(key) ?? 'idle'
        };
        const badge = config.badges?.get(key);
        if (badge !== undefined) cell.badge = badge;
        return cell;
      })
    })),
    caption: config.caption,
    legend: config.legend ?? DEFAULT_LEGEND
  };
}

export function buildPlane(config: {
  points: { id: string; label?: string; x: number; y: number; state?: VisualState; badge?: string }[];
  segments?: { id?: string; from: string; to: string; state?: VisualState; label?: string }[];
  polygons?: { id?: string; label: string; points: string[]; state?: VisualState }[];
  range: { xMin: number; xMax: number; yMin: number; yMax: number };
  caption: string;
  legend?: LegendEntry[];
}): PlaneVisual {
  return {
    kind: 'plane',
    points: config.points.map((point) => ({ ...point })),
    segments: (config.segments ?? []).map((segment) => ({ ...segment })),
    polygons: (config.polygons ?? []).map((polygon) => ({ ...polygon })),
    range: config.range,
    caption: config.caption,
    legend: config.legend ?? DEFAULT_LEGEND
  };
}

export function buildCallStack(config: {
  frames: {
    id: string;
    label: string;
    detail?: string;
    state?: VisualState;
    args?: Record<string, unknown>;
  }[];
  caption: string;
  legend?: LegendEntry[];
}): CallStackVisual {
  return {
    kind: 'calls',
    frames: config.frames.map((frame) => ({ ...frame })),
    caption: config.caption,
    legend: config.legend ?? DEFAULT_LEGEND
  };
}

export function buildText(lines: string[], caption: string): TextVisual {
  return { kind: 'text', lines, caption };
}

/** Two-letter legend helper for graph-like visuals. */
export const CORE_GRAPH_LEGEND: LegendEntry[] = mergeLegend(DEFAULT_LEGEND, [
  { state: 'visited', label: 'settled' },
  { state: 'frontier', label: 'frontier' },
  { state: 'path', label: 'on final path' },
  { state: 'blocked', label: 'rejected' }
]);



