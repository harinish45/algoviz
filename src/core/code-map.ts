import type { CodeReference, Language } from './types';

/**
 * Code ↔ trace mapping.
 *
 * The TypeScript implementation string is the *executable reference* of every
 * algorithm, therefore line numbers reported by events are resolved against
 * exactly that string. `createCodeMap` finds a unique anchor substring and
 * returns its 1-based line range, so the Code panel highlight can never drift
 * away from the implementation that produced the trace.
 *
 * Other languages opt in per anchor: an algorithm declares
 * `codeAnchors[anchorKey][language]`, and the Code panel highlights only when
 * that declaration exists. Nothing is guessed.
 */
export interface CodeMap {
  readonly language: Language;
  readonly source: string;
  readonly lines: string[];
  /** 1-based line range of the first line containing `anchor`. */
  ref(anchor: string): CodeReference;
  /** 1-based line range from `startAnchor` to `endAnchor` (inclusive). */
  range(startAnchor: string, endAnchor: string): CodeReference;
  /** True when the anchor occurs exactly once in the source. */
  has(anchor: string): boolean;
  /** Throws when the anchor is missing or ambiguous. */
  assert(anchor: string): void;
  /** Returns the raw line text (useful for tests and diagnostics). */
  lineText(line: number): string;
}

export function createCodeMap(source: string, language: Language = 'typescript'): CodeMap {
  const lines = source.replace(/\r\n/g, '\n').split('\n');

  const findLine = (anchor: string): number => {
    const matches: number[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].includes(anchor)) matches.push(i + 1);
    }
    if (matches.length === 0) {
      throw new Error(`createCodeMap(${language}): anchor not found → ${JSON.stringify(anchor)}`);
    }
    if (matches.length > 1) {
      throw new Error(
        `createCodeMap(${language}): ambiguous anchor (${matches.length} matches) → ${JSON.stringify(anchor)}`
      );
    }
    return matches[0];
  };

  return {
    language,
    source,
    lines,
    ref(anchor: string): CodeReference {
      const line = findLine(anchor);
      return { language, lineStart: line, lineEnd: line };
    },
    range(startAnchor: string, endAnchor: string): CodeReference {
      const start = findLine(startAnchor);
      const end = findLine(endAnchor);
      if (end < start) {
        throw new Error(`createCodeMap(${language}): end anchor precedes start anchor`);
      }
      return { language, lineStart: start, lineEnd: end };
    },
    has(anchor: string): boolean {
      return lines.filter((line) => line.includes(anchor)).length === 1;
    },
    assert(anchor: string): void {
      findLine(anchor);
    },
    lineText(line: number): string {
      return lines[line - 1] ?? '';
    }
  };
}

/**
 * Resolves the code reference for a non-TypeScript implementation.
 * Returns `undefined` when the algorithm has not declared a mapping — the UI
 * then shows the snippet without a fabricated highlight.
 */
export function resolveAnchor(
  language: Language,
  source: string | undefined,
  anchor: string | undefined
): CodeReference | undefined {
  if (!source || !anchor) return undefined;
  try {
    return createCodeMap(source, language).ref(anchor);
  } catch {
    return undefined;
  }
}
