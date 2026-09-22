/**
 * Text → structured-value parsers for the input panel.
 *
 * The panel accepts human-friendly text (what a learner would type in a
 * whiteboard exercise) and converts it into the exact shape the input schema
 * declares. Parsing never throws: unusable text is passed through so the
 * validator reports a precise, per-field error instead.
 */

export function parseNumberList(text: string): unknown {
  const trimmed = text.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (trimmed.length === 0) return [];
  const parts = trimmed
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const values = parts.map((part) => Number(part));
  return values.every((value) => Number.isFinite(value)) ? values : text;
}

export function parseMatrix(text: string): unknown {
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const parsed: unknown[][] = [];
  for (const row of rows) {
    const values = parseNumberList(row);
    if (!Array.isArray(values)) return text;
    parsed.push(values);
  }
  return parsed;
}

export interface ParsedEdge {
  from: string;
  to: string;
  weight?: number;
}

export function parseEdges(text: string): unknown {
  const entries = text
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const edges: ParsedEdge[] = [];
  for (const entry of entries) {
    const [endpoints, weight] = entry.split(':').map((part) => part.trim());
    const [from, to] = endpoints.split(/-|→|--|>/).map((part) => part.trim());
    if (!from || !to) return text;
    const edge: ParsedEdge = { from, to };
    if (weight !== undefined && weight.length > 0) {
      const value = Number(weight);
      if (!Number.isFinite(value)) return text;
      edge.weight = value;
    }
    edges.push(edge);
  }
  return edges;
}

export function parseIntervals(text: string): unknown {
  const entries = text
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const intervals: { start: number; end: number }[] = [];
  for (const entry of entries) {
    const [start, end] = entry.split(/-|→|,/).map((part) => Number(part.trim()));
    if (!Number.isFinite(start) || !Number.isFinite(end)) return text;
    intervals.push({ start, end });
  }
  return intervals;
}

export function parseItems(text: string): unknown {
  const entries = text
    .split(/[;\n]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  const items: { label: string; weight: number; profit: number }[] = [];
  for (const entry of entries) {
    const [label, weight, profit] = entry.split(/[:,]/).map((part) => part.trim());
    const weightValue = Number(weight);
    const profitValue = Number(profit);
    if (!label || !Number.isFinite(weightValue) || !Number.isFinite(profitValue)) return text;
    items.push({ label, weight: weightValue, profit: profitValue });
  }
  return items;
}

export function formatNumberList(values: unknown): string {
  return Array.isArray(values) ? values.join(', ') : String(values ?? '');
}

export function formatMatrix(values: unknown): string {
  return Array.isArray(values)
    ? values
        .map((row) => (Array.isArray(row) ? row.join(', ') : String(row)))
        .join('\n')
    : String(values ?? '');
}

export function formatEdges(values: unknown): string {
  return Array.isArray(values)
    ? values
        .map((edge) => {
          const candidate = edge as ParsedEdge;
          return `${candidate.from}-${candidate.to}${candidate.weight !== undefined ? `:${candidate.weight}` : ''}`;
        })
        .join(', ')
    : String(values ?? '');
}

export function formatIntervals(values: unknown): string {
  return Array.isArray(values)
    ? values
        .map((interval) => {
          const candidate = interval as { start: number; end: number };
          return `${candidate.start}-${candidate.end}`;
        })
        .join(', ')
    : String(values ?? '');
}

export function formatItems(values: unknown): string {
  return Array.isArray(values)
    ? values
        .map((item) => {
          const candidate = item as { label: string; weight: number; profit: number };
          return `${candidate.label}: ${candidate.weight}, ${candidate.profit}`;
        })
        .join('; ')
    : String(values ?? '');
}
