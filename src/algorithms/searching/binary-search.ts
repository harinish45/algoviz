import { CORE_EVENT_TYPES, type AlgorithmInputSchema, type AlgorithmTestCase, type ExecutionEvent, type ExecutionTrace, type PointerVisual, type PracticeQuestion, type VisualizationState, type VisualState } from '../../core/types';
import { TraceBuilder } from '../../core/trace';
import { InputRejectedError, requireValidInput } from '../../core/errors';
import { defineAlgorithm } from '../../core/define';
import { DEFAULT_LEGEND, buildArray, buildBars, mergeLegend } from '../../visualization/builders';

/**
 * Binary Search — ported from Uday's `uday` branch contribution (8642b98) and
 * adapted to the current main-architecture contracts (code review 23 Sep 2026):
 *
 *  - canonical highlight ids `cell:<n>` (review §10/§11),
 *  - real implementations for all four languages (review §12),
 *  - duplicate contract = "any matching index or null" (review §9),
 *  - finite-only input via the shared schema (review §7),
 *  - typed events drawn from `CORE_EVENT_TYPES` (review §21),
 *  - full test matrix: boundaries, duplicates, negatives, large, invalid (§14/§30),
 *  - trace-driven practice questions from several trace points (§13).
 *
 * Every event type used here is a canonical core type, restricted for this
 * algorithm to the documented subset below.
 */
/** The canonical event types this algorithm is allowed to emit (review §21 — no free-form strings). */
export type BinarySearchEventType = Extract<
  (typeof CORE_EVENT_TYPES)[number],
  'init' | 'compare' | 'prune' | 'found' | 'not-found' | 'done'
>;

const ALGORITHM_ID = 'binary-search';

export interface BinarySearchInput {
  /** Ascending (non-decreasing) list of finite integers. */
  values: number[];
  /** Finite integer to locate. */
  target: number;
}

export interface BinarySearchState {
  values: number[];
  /** Kept in the state so the visual layer never has to re-read the input. */
  target: number;
  low: number;
  high: number;
  /** Index probed in the current iteration; null before the first probe and after the window collapses. */
  mid: number | null;
  /** Number of midpoint comparisons performed so far. */
  comparisons: number;
  /** Index that matched the target, or null when absent. */
  foundIndex: number | null;
  phase: 'init' | 'searching' | 'found' | 'exhausted';
}

/** Contract (review §9): the index of *any* element equal to `target`, or null when absent. */
export type BinarySearchResult = number | null;

const WINDOW_INVARIANT =
  'If target is present, it lies inside values[low…high]';

const TYPESCRIPT_IMPLEMENTATION = `export function binarySearch(values: number[], target: number): number | null {
  let low = 0;
  let high = values.length - 1;
  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2);
    const probe = values[mid];
    if (probe === target) {
      return mid;
    }
    if (probe < target) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return null;
}`;

const PYTHON_IMPLEMENTATION = `def binary_search(values, target):
    """Return an index of target in the sorted list values, or None if absent."""
    low, high = 0, len(values) - 1
    while low <= high:
        mid = low + (high - low) // 2
        probe = values[mid]
        if probe == target:
            return mid
        if probe < target:
            low = mid + 1
        else:
            high = mid - 1
    return None`;

const CPP_IMPLEMENTATION = `#include <vector>

// Returns an index of target in the sorted vector, or -1 when absent.
int binarySearch(const std::vector<int>& values, int target) {
    int low = 0;
    int high = static_cast<int>(values.size()) - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        int probe = values[mid];
        if (probe == target) return mid;
        if (probe < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}`;

const JAVA_IMPLEMENTATION = `// Returns an index of target in the sorted array, or -1 when absent.
public static int binarySearch(int[] values, int target) {
    int low = 0;
    int high = values.length - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        int probe = values[mid];
        if (probe == target) return mid;
        if (probe < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}`;

const INPUT_SCHEMA: AlgorithmInputSchema = {
  summary: 'A sorted (ascending) integer array plus the integer target to locate.',
  fields: [
    {
      kind: 'int-array',
      name: 'values',
      label: 'Sorted values',
      help: 'Comma separated integers in non-decreasing order — the binary search precondition.',
      min: -9999,
      max: 9999,
      maxLength: 64,
      allowEmpty: true,
      default: [1, 3, 5, 7, 9, 11, 15]
    },
    {
      kind: 'number',
      name: 'target',
      label: 'Target',
      help: 'Integer to search for. It may be absent from the array (the result is then null).',
      integer: true,
      min: -9999,
      max: 9999,
      default: 11
    }
  ],
  examples: [
    { label: 'Canonical', value: { values: [1, 3, 5, 7, 9, 11, 15], target: 11 }, note: 'Found in two midpoint probes.' },
    { label: 'Best case', value: { values: [1, 2, 3, 4, 5, 6, 7, 8, 9], target: 5 }, note: 'The very first midpoint is the target: O(1).' },
    { label: 'Absent target', value: { values: [1, 3, 5, 7, 9], target: 6 }, note: 'The window collapses and the result is null.' },
    { label: 'Duplicates', value: { values: [2, 2, 2], target: 2 }, note: 'Any matching index is a correct answer.' },
    { label: 'Negatives', value: { values: [-10, -5, -1, 0, 2], target: -5 }, note: 'Signed values work exactly the same way.' },
    {
      label: 'Adversarial (48)',
      value: { values: Array.from({ length: 48 }, (_, index) => index * 2), target: 1000 },
      note: 'Absent target over 48 cells: six probes, ⌊log₂ 48⌋ + 1.'
    }
  ]
};

function initialState(values: number[], target: number): BinarySearchState {
  return {
    values,
    target,
    low: 0,
    high: values.length - 1,
    mid: null,
    comparisons: 0,
    foundIndex: null,
    phase: 'init'
  };
}

function cellsIn(from: number, to: number): string[] {
  const ids: string[] = [];
  for (let index = from; index <= to; index += 1) ids.push(`cell:${index}`);
  return ids;
}

function execute(
  input: BinarySearchInput,
  options?: { maxEvents?: number; seed?: number }
): ExecutionTrace<BinarySearchState, BinarySearchResult> {
  const valid = requireValidInput<BinarySearchInput>(ALGORITHM_ID, INPUT_SCHEMA, input);
  const values = valid.values;
  const target = valid.target;
  const n = values.length;

  // The schema cannot express ordering, so the sorted precondition is enforced
  // here — binary search on unsorted input silently produces wrong answers.
  // Finiteness itself is guaranteed by INPUT_SCHEMA (validation.ts requires
  // Number.isFinite for number fields and integer membership for array cells,
  // which also rejects NaN and ±Infinity).
  for (let index = 1; index < n; index += 1) {
    if (values[index - 1]! > values[index]!) {
      throw new InputRejectedError(ALGORITHM_ID, [
        {
          path: `values[${index}]`,
          message: `values must be sorted in non-decreasing order (values[${index - 1}] = ${values[index - 1]} comes before ${values[index]})`
        }
      ]);
    }
  }

  const trace = new TraceBuilder<BinarySearchState, BinarySearchResult>({
    algorithmId: ALGORITHM_ID,
    algorithmName: 'Binary Search',
    input: valid,
    initial: initialState(values, target),
    code: TYPESCRIPT_IMPLEMENTATION,
    determinism: 'deterministic',
    ...(options?.seed !== undefined ? { seed: options.seed } : {}),
    ...(options?.maxEvents !== undefined ? { maxEvents: options.maxEvents } : {})
  });

  let low = 0;
  let high = n - 1;
  let mid: number | null = null;
  let foundIndex: number | null = null;
  let comparisons = 0;

  const snapshot = (phase: BinarySearchState['phase']): BinarySearchState => ({
    values,
    target,
    low,
    high,
    mid,
    comparisons,
    foundIndex,
    phase
  });

  trace.record({
    type: 'init',
    title: 'Open the search window over the whole array',
    description: `low = 0 and high = ${high} bound the full ${n}-element window; target = ${target}.`,
    why: 'Binary search maintains the invariant that the target, if present, sits inside values[low…high]; the whole array is the only sound starting window.',
    invariant: WINDOW_INVARIANT,
    anchor: 'let low = 0;',
    variables: { low, high, target, n },
    stateAfter: snapshot('searching'),
    highlights: values.map((_, index) => `cell:${index}`),
    annotations: [{ label: 'window', detail: `values[${low}…${high}]` }]
  });

  if (n === 0) {
    trace.record({
      type: 'done',
      title: 'Empty input: nothing to probe',
      description: 'values holds no elements, so 0 > -1 holds from the start and the result is null.',
      why: 'The guard low <= high fails immediately; searching an empty array costs exactly zero comparisons.',
      invariant: WINDOW_INVARIANT,
      anchor: 'return null;',
      variables: { low: 0, high: -1, comparisons: 0 },
      stateAfter: { ...snapshot('exhausted'), low: 0, high: -1, mid: null },
      highlights: [],
      annotations: [{ label: 'empty window', detail: 'The search terminates at once.' }]
    });
    return trace.finish(null, {
      summary: [
        'Binary Search returned null — an empty array contains nothing to match.',
        'Comparisons: 0 · the window never opened.'
      ]
    });
  }

  while (low <= high) {
    mid = low + Math.floor((high - low) / 2);
    const probe = values[mid]!;
    comparisons += 1;

    trace.record({
      type: 'compare',
      title: `Probe values[${mid}] against the target`,
      description: `mid = low + floor((high - low) / 2) = ${mid}; values[${mid}] = ${probe} compared with target ${target}.`,
      why: `The closed midpoint form splits the current ${high - low + 1}-element window into two nearly equal halves, which is what drives the logarithmic probe count.`,
      invariant: WINDOW_INVARIANT,
      anchor: 'const mid = low + Math.floor((high - low) / 2);',
      variables: { low, high, mid, probe, target, comparisons },
      stateAfter: snapshot('searching'),
      highlights: [`cell:${mid}`],
      annotations: [{ label: 'window', detail: `values[${low}…${high}]` }],
      impact: { comparisons: 1, reads: 1, arithmetic: 1 }
    });

    if (probe === target) {
      foundIndex = mid;
      trace.record({
        type: 'found',
        title: `values[${mid}] equals the target — return ${mid}`,
        description: `The probe landed on ${target} after ${comparisons} comparison(s), so the search stops with index ${mid}.`,
        why: 'The documented contract accepts any matching index; when duplicates exist, the midpoint-first probe order decides which match is reported.',
        invariant: WINDOW_INVARIANT,
        anchor: 'if (probe === target) {',
        variables: { low, high, mid, target, comparisons, foundIndex },
        stateAfter: snapshot('found'),
        highlights: [`cell:${mid}`],
        annotations: [{ label: 'match', detail: `values[${mid}] = ${target}` }]
      });
      break;
    }

    if (probe < target) {
      const discardedFrom = low;
      low = mid + 1;
      trace.record({
        type: 'prune',
        title: `Drop the left half up to index ${mid}`,
        description: `values[${mid}] = ${probe} is smaller than ${target}, so no index at or below ${mid} can match; low moves from ${discardedFrom} to ${low}.`,
        why: 'Sorted order certifies that every discarded cell is smaller than the target, so half the window disappears on this single comparison.',
        invariant: WINDOW_INVARIANT,
        anchor: 'low = mid + 1;',
        variables: { low, high, mid, probe, target, comparisons },
        stateAfter: snapshot('searching'),
        highlights: cellsIn(discardedFrom, mid),
        annotations: [{ label: 'discarded', detail: `indices ${discardedFrom}…${mid}` }],
        impact: { assignments: 1 }
      });
    } else {
      const discardedTo = high;
      high = mid - 1;
      trace.record({
        type: 'prune',
        title: `Drop the right half from index ${mid}`,
        description: `values[${mid}] = ${probe} is larger than ${target}, so no index at or above ${mid} can match; high moves from ${discardedTo} to ${high}.`,
        why: 'Sorted order certifies that every discarded cell is larger than the target, so half the window disappears on this single comparison.',
        invariant: WINDOW_INVARIANT,
        anchor: 'high = mid - 1;',
        variables: { low, high, mid, probe, target, comparisons },
        stateAfter: snapshot('searching'),
        highlights: cellsIn(mid, discardedTo),
        annotations: [{ label: 'discarded', detail: `indices ${mid}…${discardedTo}` }],
        impact: { assignments: 1 }
      });
    }
  }

  if (foundIndex === null) {
    mid = null;
    trace.record({
      type: 'not-found',
      title: `Window collapsed — ${target} is not in the array`,
      description: `low = ${low} now exceeds high = ${high} after ${comparisons} comparison(s); every index has been ruled out.`,
      why: 'The window invariant still holds, but the window is empty — a contradiction with the target being present — so null is the proven answer.',
      invariant: WINDOW_INVARIANT,
      anchor: 'return null;',
      variables: { low, high, mid: null, target, comparisons },
      stateAfter: snapshot('exhausted'),
      highlights: [`cell:${Math.min(low, n - 1)}`],
      annotations: [{ label: 'insertion point', detail: `${target} would belong at index ${low}` }]
    });
  }

  return trace.finish(foundIndex, {
    summary: [
      foundIndex === null
        ? `Binary Search returned null — ${target} is absent from the ${n}-element array.`
        : `Binary Search returned index ${foundIndex} where values[${foundIndex}] = ${target}.`,
      `Comparisons: ${comparisons} · at most floor(log2 n) + 1 = ${Math.floor(Math.log2(n)) + 1} probes can be needed for n = ${n}.`
    ]
  });
}

function visualize(event: ExecutionEvent, state: BinarySearchState): VisualizationState {
  const { values, target, low, high, mid, foundIndex, phase } = state;
  const n = values.length;
  const caption = `${event.title}. Window [${low}…${high}]${mid === null ? '' : `, probe at ${mid}`}.`;
  const indexLabels = values.map((_, index) => String(index));
  const highlighted = new Set(event.visualization.highlights);

  const stateFor = (index: number, id: string): VisualState | undefined => {
    if (phase === 'found' && index === foundIndex) return 'found';
    if (index < low || index > high) return 'discarded';
    if (highlighted.has(id)) return 'compare';
    return 'idle';
  };
  const badgeFor = (index: number, id: string): string | undefined => {
    if (phase === 'found' && index === foundIndex) return 'match';
    if (highlighted.has(id)) return event.type === 'prune' ? 'out' : 'probe';
    return undefined;
  };
  const pointers: PointerVisual[] = [];
  if (low >= 0 && low < n && low <= high) pointers.push({ id: 'low', label: 'low', target: `cell:${low}` });
  if (high >= 0 && high < n && low <= high)
    pointers.push({ id: 'high', label: 'high', target: `cell:${high}` });
  if (mid !== null && mid >= 0 && mid < n)
    pointers.push({ id: 'mid', label: 'mid', target: `cell:${mid}`, state: 'compare' });
  const legend = mergeLegend(DEFAULT_LEGEND, [
    { state: 'compare', label: 'probe / discarded span' },
    { state: 'found', label: 'match' },
    { state: 'discarded', label: 'outside window' }
  ]);

  const cells = buildArray({
    values,
    labels: indexLabels,
    caption,
    stateFor,
    badgeFor,
    pointers,
    legend
  });
  const bars = buildBars({
    values,
    labels: indexLabels,
    caption,
    stateFor: (index: number) => stateFor(index, `cell:${index}`),
    badgeFor: (index: number) => badgeFor(index, `cell:${index}`),
    pointers
  });
  bars.guide = { value: target, label: 'target' };
  bars.legend = legend;
  return { kind: 'composite', primary: bars, secondary: cells, caption };
}

/** Trace-grounded extra questions: predict the probe, the range after a prune, and the log bound. */
function practiceExtras(trace: ExecutionTrace<BinarySearchState, BinarySearchResult>): PracticeQuestion[] {
  const questions: PracticeQuestion[] = [];
  const firstCompare = trace.events.find((event) => event.type === 'compare');
  const values = (trace.input as BinarySearchInput).values;

  if (firstCompare) {
    const mid = (firstCompare.stateAfter as BinarySearchState).mid ?? 0;
    const wrong = new Set<number>([0, values.length - 1, Math.floor(values.length / 2)]);
    wrong.delete(mid);
    const choices = [...new Set([mid, ...[...wrong].slice(0, 2)])].map((index) => `index ${index}`);
    questions.push({
      id: `${ALGORITHM_ID}-first-probe`,
      algorithmId: ALGORITHM_ID,
      kind: 'predict-next',
      difficulty: 'easy',
      prompt: `On a ${values.length}-element window, which index does binary search probe first?`,
      choices,
      answerIndex: 0,
      answer: choices[0],
      explanation:
        'The first probe is the closed midpoint low + floor((high - low) / 2); with low = 0 and high = n - 1 that is floor((n - 1) / 2).',
      eventSteps: [firstCompare.step]
    });
  }

  const firstPrune = trace.events.find((event) => event.type === 'prune');
  if (firstPrune) {
    const before = firstPrune.stateBefore as BinarySearchState;
    const after = firstPrune.stateAfter as BinarySearchState;
    const shrunkFrom = before.high - before.low + 1;
    const shrunkTo = after.high - after.low + 1;
    questions.push({
      id: `${ALGORITHM_ID}-range-after-prune`,
      algorithmId: ALGORITHM_ID,
      kind: 'predict-state',
      difficulty: 'easy',
      prompt: `After the first half-discard the window drops from ${shrunkFrom} to how many cells?`,
      choices: [
        ...new Set([
          String(shrunkTo),
          String(Math.max(1, shrunkFrom - 1)),
          String(shrunkFrom),
          String(shrunkTo + 1),
          String(shrunkFrom + 1)
        ])
      ].slice(0, 3),
      answerIndex: 0,
      answer: String(shrunkTo),
      explanation:
        'One probe removes at least half of the current window (the probed cell plus one side), which is exactly why the algorithm runs in O(log n).',
      eventSteps: [firstPrune.step]
    });
  }

  const size = Math.max(1, values.length);
  questions.push({
    id: `${ALGORITHM_ID}-log-bound`,
    algorithmId: ALGORITHM_ID,
    kind: 'complexity',
    difficulty: 'easy',
    prompt: `What is the maximum number of probes needed for ${size} sorted cells?`,
    choices: [String(Math.floor(Math.log2(size)) + 1), String(size), '1'],
    answerIndex: 0,
    answer: String(Math.floor(Math.log2(size)) + 1),
    explanation:
      'Each comparison halves the window, so at most floor(log2 n) + 1 probes are needed before the window collapses.',
    eventSteps: []
  });

  return questions;
}

const EVEN_48 = Array.from({ length: 48 }, (_, index) => index * 2);

const TESTS: AlgorithmTestCase[] = [
  {
    id: 'canonical',
    name: 'Finds an element in the right half (7 sorted values)',
    family: 'canonical',
    input: { values: [1, 3, 5, 7, 9, 11, 15], target: 11 },
    expect: {
      result: 5,
      eventTypes: ['init', 'compare', 'prune', 'found'],
      counters: {
        comparisons: { exact: 2 },
        reads: { exact: 2 },
        arithmetic: { exact: 2 },
        assignments: { exact: 1 }
      },
      minEvents: 5,
      maxEvents: 10
    },
    note: 'Probes mid 3 (7 < 11, drop left), then mid 5 where 11 is found.'
  },
  {
    id: 'empty',
    name: 'Empty array yields null with zero comparisons',
    family: 'empty',
    input: { values: [], target: 1 },
    expect: {
      result: null,
      eventTypes: ['init', 'done'],
      counters: { comparisons: { exact: 0 } },
      maxEvents: 5
    },
    note: 'low = 0 already exceeds high = -1, so the guard never runs.'
  },
  {
    id: 'singleton-found',
    name: 'Single element hit',
    family: 'singleton',
    input: { values: [5], target: 5 },
    expect: {
      result: 0,
      eventTypes: ['compare', 'found'],
      counters: { comparisons: { exact: 1 } }
    }
  },
  {
    id: 'singleton-absent',
    name: 'Single element miss',
    family: 'minimum',
    input: { values: [5], target: 4 },
    expect: {
      result: null,
      eventTypes: ['compare', 'prune', 'not-found'],
      counters: { comparisons: { exact: 1 }, assignments: { exact: 1 } }
    }
  },
  {
    id: 'first-element-negative',
    name: 'First element with negative values (lower boundary)',
    family: 'minimum',
    input: { values: [-9, -4, 0, 3, 10], target: -9 },
    expect: {
      result: 0,
      eventTypes: ['prune', 'found'],
      counters: { comparisons: { exact: 2 }, arithmetic: { exact: 2 } }
    },
    note: 'The window narrows to index 0 where the negative target lives.'
  },
  {
    id: 'last-element',
    name: 'Last element (upper boundary)',
    family: 'maximum',
    input: { values: [1, 2, 3, 4], target: 4 },
    expect: {
      result: 3,
      eventTypes: ['prune', 'found'],
      counters: { comparisons: { exact: 3 }, assignments: { exact: 2 } }
    },
    note: 'Probes mid 1 (2 < 4), mid 2 (3 < 4), then mid 3 — three comparisons, two window updates.'
  },
  {
    id: 'duplicates',
    name: 'Duplicates: any matching index satisfies the contract',
    family: 'duplicates',
    input: { values: [2, 2, 2], target: 2 },
    expect: {
      predicate: 'index-of-value',
      predicateArg: { values: [2, 2, 2], target: 2 },
      counters: { comparisons: { exact: 1 } }
    },
    note: 'Contract returns any valid index; the midpoint probe reports the middle match.'
  },
  {
    id: 'duplicates-run',
    name: 'Duplicates with a distinct neighbour: still a real match',
    family: 'duplicates',
    input: { values: [2, 2, 2, 2, 3], target: 2 },
    expect: {
      predicate: 'index-of-value',
      predicateArg: { values: [2, 2, 2, 2, 3], target: 2 },
      counters: { comparisons: { exact: 1 } }
    }
  },
  {
    id: 'already-solved',
    name: 'Target at the very first midpoint (best case O(1))',
    family: 'already-solved',
    input: { values: [1, 2, 3, 4, 5, 6, 7, 8, 9], target: 5 },
    expect: {
      result: 4,
      eventTypes: ['compare', 'found'],
      counters: { comparisons: { exact: 1 }, assignments: { exact: 0 } }
    },
    note: 'One probe, zero window updates — this is the O(1) best case.'
  },
  {
    id: 'adversarial',
    name: 'Absent target in 48 elements forces full logarithmic narrowing',
    family: 'adversarial',
    input: { values: EVEN_48, target: 17 },
    expect: {
      result: null,
      eventTypes: ['prune', 'not-found'],
      counters: {
        comparisons: { exact: 5 },
        reads: { exact: 5 },
        arithmetic: { exact: 5 },
        assignments: { exact: 5 }
      },
      maxEvents: 400
    },
    note: 'Odd target between even neighbours: every probe prunes until low > high (5 probes ≤ floor(log2 48) + 1).'
  },
  {
    id: 'determinism',
    name: 'Identical input produces an identical trace',
    family: 'determinism',
    input: { values: [1, 3, 5, 7, 9, 11, 13, 15], target: 13 },
    expect: {
      result: 6,
      counters: { comparisons: { exact: 3 } },
      eventTypes: ['found']
    }
  },
  {
    id: 'trace-property',
    name: 'Miss path: one not-found event per counted comparison',
    family: 'trace-property',
    input: { values: [1, 3, 5, 7], target: 4 },
    expect: {
      result: null,
      eventTypes: ['init', 'compare', 'prune', 'not-found'],
      counters: {
        comparisons: { exact: 2 },
        reads: { exact: 2 },
        arithmetic: { exact: 2 },
        assignments: { exact: 2 }
      },
      minEvents: 6,
      maxEvents: 20
    },
    note: '4 lies between 3 and 5: both neighbours are probed and discarded before null is proven.'
  },
  {
    id: 'invalid-unsorted',
    name: 'Unsorted input is rejected (search precondition)',
    family: 'invalid',
    input: { values: [3, 1, 2], target: 1 },
    expect: { rejects: true }
  },
  {
    id: 'invalid-nan-target',
    name: 'NaN target is rejected by the finite-number contract',
    family: 'invalid',
    input: { values: [1, 2, 3], target: Number.NaN },
    expect: { rejects: true }
  },
  {
    id: 'invalid-infinity-element',
    name: 'Infinity element is rejected (finite integers only)',
    family: 'invalid',
    input: { values: [1, 3, Number.POSITIVE_INFINITY], target: 2 },
    expect: { rejects: true }
  },
  {
    id: 'invalid-unknown-field',
    name: 'Unknown field is rejected instead of silently ignored',
    family: 'invalid',
    input: { values: [1, 2, 3], target: 2, ascending: false },
    expect: { rejects: true }
  },
  {
    id: 'invalid-non-integer-target',
    name: 'Fractional target against integer values is rejected',
    family: 'invalid',
    input: { values: [1, 2, 3], target: 1.5 },
    expect: { rejects: true }
  }
];

export const binarySearch = defineAlgorithm<BinarySearchInput, BinarySearchState, BinarySearchResult>({
  id: ALGORITHM_ID,
  name: 'Binary Search',
  category: 'arrays-searching',
  subcategory: 'searching',
  difficulty: 'easy',
  tags: ['search', 'binary-search', 'divide-and-conquer', 'sorted', 'logarithmic'],
  prerequisites: ['sorted arrays', 'loop invariants'],
  related: [],

  concept: {
    definition:
      'Binary search locates a target inside a sorted array by repeatedly probing the midpoint of a shrinking window [low…high]. Each probe compares the target with values[mid] and provably discards half of the remaining candidates, so the window collapses after O(log n) comparisons and the algorithm returns either a matching index or null when the window empties.',
    problem:
      'Given a sorted integer array and a target, return the index of an element equal to the target — any such index — or null if the target never occurs.',
    intuition:
      'Sorted order means every cell left of mid is ≤ values[mid] and every cell right of mid is ≥ values[mid]. One comparison therefore tells you that half the window cannot contain the target, so you delete it instead of looking.',
    motivation:
      'Linear scan costs O(n); binary search turns the sortedness you already paid for into a logarithmic probe budget — a million-element array needs at most 20 probes.',
    whenToUse: [
      'The collection is already sorted (or sorted order is cheap to maintain).',
      'You need repeated lookups where O(log n) per query beats O(n) scan.',
      'You need the insertion position, the closest element, or a lower/upper bound via small variants.'
    ],
    whenNotToUse: [
      'Unsorted input — sorting first only pays off when you run enough searches.',
      'Linked lists — midpoint access is O(n) and destroys the log bound.',
      'Data that changes on every insert without re-establishing order (consider a tree or hash structure).'
    ],
    preconditions: [
      'values is sorted in non-decreasing order — enforced at runtime, since binary search on unsorted input returns wrong answers silently.',
      'All values and the target are finite integers (NaN and ±Infinity are rejected by the schema).'
    ],
    invariants: [
      'After the initial step and after every probe: if the target is present in values, it lies inside values[low…high] (the window invariant).',
      'The window only shrinks: high − low strictly decreases on each iteration, which guarantees termination.'
    ],
    correctness:
      'Termination: every non-final iteration executes one probe and then either low = mid + 1 or high = mid − 1, so high − low decreases by at least one and the guard low ≤ high eventually fails. Partial correctness: the window invariant starts true for the full array (empty input included) and is preserved by each probe — sortedness guarantees everything discarded cannot equal the target — so when low > high the window is empty and the invariant proves the target is absent; when a probe matches, sortedness guarantees values[mid] = target, so the returned index satisfies the contract.',
    commonMistakes: [
      'mid = Math.floor((low + high) / 2) overflows in fixed-width integers — use the closed form low + Math.floor((high − low) / 2).',
      'Forgetting the low ≤ high guard (off-by-one: low < high misses the final single-element window).',
      'Updating the wrong bound (low = mid instead of mid + 1 causes infinite loops).',
      'Running binary search on unsorted data and trusting the null answer.'
    ],
    applications: [
      'Dictionary and symbol-table lookup, std::lower_bound / bisect in standard libraries.',
      'Version control bisect: finding the first bad commit in a monotonic history.',
      'Binary search on the answer: minimum feasible capacity, speed, or time under a monotone predicate.',
      'Database index seeks, scheduler deadlines, numerical root finding (bisection method).'
    ],
    variants: [
      'lower_bound / upper_bound variants for duplicate keys.',
      'Rotated-array search (pivot-aware mid arithmetic).',
      'Interpolation search for uniformly distributed keys.',
      'Exponential (galloping) search to find the doubling window before searching.'
    ]
  },

  visualModel:
    'Primary bars with a horizontal target guide, paired with indexed cells that carry low/mid/high pointers; cells leave the window (state "discarded") the moment their half is pruned.',
  visualNotes:
    'The probed cell flashes "probe" (state compare), pruned spans flash "out", the match is labelled "match", and the three pointers move only when the window bounds or midpoint change.',

  inputSchema: INPUT_SCHEMA,
  outputSchema: 'number | null (index of any element equal to the target, or null when absent)',

  implementations: {
    typescript: TYPESCRIPT_IMPLEMENTATION,
    python: PYTHON_IMPLEMENTATION,
    cpp: CPP_IMPLEMENTATION,
    java: JAVA_IMPLEMENTATION
  },

  execute,
  visualize,

  complexity: {
    best: 'O(1)',
    average: 'O(log n)',
    worst: 'O(log n)',
    space: 'O(1)',
    notes:
      'Best case hits the first midpoint; worst case halves the window until it collapses, giving floor(log2 n) + 1 probes. Only three indices are stored, so the auxiliary space is constant.'
  },

  tests: TESTS,
  practiceExtras: practiceExtras
});