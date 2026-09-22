import { defineAlgorithm } from '../../core/define';
import { requireValidInput } from '../../core/errors';
import { TraceBuilder } from '../../core/trace';
import { buildArray, buildBars, mergeLegend } from '../../visualization/builders';
import type {
  AlgorithmTestCase,
  ExecutionEvent,
  ExecutionTrace,
  VisualState,
  VisualizationState
} from '../../core/types';

/**
 * Bubble Sort — Atlas §Sorting.
 *
 * Reference implementation (also the trace source): the same statement order as
 * `IMPLEMENTATIONS.typescript`, with instrumentation recording one event per
 * semantic transition. Anchors below map every event to a real line.
 */

const ALGORITHM_ID = 'bubble-sort';

const TYPESCRIPT_IMPLEMENTATION = `export function bubbleSort(values: number[]): number[] {
  const a = [...values];
  const n = a.length;
  for (let i = 0; i < n - 1; i += 1) {
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j += 1) {
      if (a[j] > a[j + 1]) {
        const tmp = a[j];
        a[j] = a[j + 1];
        a[j + 1] = tmp;
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return a;
}`;

const PYTHON_IMPLEMENTATION = `def bubble_sort(values: list[int]) -> list[int]:
    a = list(values)
    n = len(a)
    for i in range(n - 1):
        swapped = False
        for j in range(n - 1 - i):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True
        if not swapped:
            break
    return a`;

const CPP_IMPLEMENTATION = `std::vector<int> bubbleSort(std::vector<int> values) {
    std::vector<int> a = values;
    const int n = static_cast<int>(a.size());
    for (int i = 0; i < n - 1; ++i) {
        bool swapped = false;
        for (int j = 0; j < n - 1 - i; ++j) {
            if (a[j] > a[j + 1]) {
                std::swap(a[j], a[j + 1]);
                swapped = true;
            }
        }
        if (!swapped) break;
    }
    return a;
}`;

const JAVA_IMPLEMENTATION = `public static int[] bubbleSort(int[] values) {
    int[] a = values.clone();
    int n = a.length;
    for (int i = 0; i < n - 1; i++) {
        boolean swapped = false;
        for (int j = 0; j < n - 1 - i; j++) {
            if (a[j] > a[j + 1]) {
                int tmp = a[j];
                a[j] = a[j + 1];
                a[j + 1] = tmp;
                swapped = true;
            }
        }
        if (!swapped) break;
    }
    return a;
}`;

export interface BubbleSortInput {
  values: number[];
}

export interface BubbleSortResult {
  sorted: number[];
  passes: number;
  comparisons: number;
  swaps: number;
  earlyExit: boolean;
}

interface BubbleSortState {
  values: number[];
  /** Zero-based pass index. */
  pass: number;
  /** Index of the left element of the current comparison pair (-1 when idle). */
  j: number;
  comparisons: number;
  swaps: number;
  swappedInPass: boolean;
  /** Number of elements already fixed at the end of the array. */
  sortedSuffix: number;
  phase: 'init' | 'scanning' | 'passed' | 'done';
}

const INPUT_SCHEMA = {
  summary: 'One integer array; duplicate and negative values are allowed.',
  fields: [
    {
      kind: 'int-array' as const,
      name: 'values',
      label: 'Values',
      help: 'Comma separated integers. The sort is in place, ascending.',
      min: -999,
      max: 999,
      maxLength: 40,
      allowEmpty: true,
      default: [5, 1, 4, 2, 8]
    }
  ],
  examples: [
    { label: 'Random 5', value: { values: [5, 1, 4, 2, 8] } },
    { label: 'Already sorted', value: { values: [1, 2, 3, 4, 5] }, note: 'The swap flag exits after one pass.' },
    { label: 'Reverse sorted', value: { values: [6, 5, 4, 3, 2, 1] }, note: 'Worst case: every comparison swaps.' },
    { label: 'Duplicates', value: { values: [3, 1, 3, 2, 1, 3] } },
    {
      label: 'Adversarial (12)',
      value: { values: [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] },
      note: 'Maximum swap count for n = 12.'
    }
  ]
};

function initialState(values: number[]): BubbleSortState {
  return {
    values: [...values],
    pass: 0,
    j: -1,
    comparisons: 0,
    swaps: 0,
    swappedInPass: false,
    sortedSuffix: 0,
    phase: 'init'
  };
}

function execute(
  input: BubbleSortInput,
  options?: { maxEvents?: number }
): ExecutionTrace<BubbleSortState, BubbleSortResult> {
  const valid = requireValidInput<BubbleSortInput>(ALGORITHM_ID, INPUT_SCHEMA, input);
  const a = [...valid.values];
  const n = a.length;
  const state = initialState(a);
  const trace = new TraceBuilder<BubbleSortState, BubbleSortResult>({
    algorithmId: ALGORITHM_ID,
    algorithmName: 'Bubble Sort',
    input: valid,
    initial: state,
    code: TYPESCRIPT_IMPLEMENTATION,
    determinism: 'deterministic',
    ...(options?.maxEvents !== undefined ? { maxEvents: options.maxEvents } : {})
  });

  trace.record({
    type: 'init',
    title: 'Copy the input into a working array',
    description: `Working array a = [${a.join(', ')}] with n = ${n}. Nothing is sorted yet.`,
    why: 'Bubble sort mutates the array it sorts, so the reference implementation copies the caller input first to keep the operation pure.',
    invariant: 'a is a permutation of the input values',
    anchor: 'const a = [...values];',
    variables: { n, a: [...a] },
    stateAfter: { ...state, values: [...a] },
    highlights: a.map((_, index) => `cell:${index}`)
  });

  if (n <= 1) {
    trace.record({
      type: 'done',
      title: 'Trivial input: already sorted',
      description: `n = ${n}, so there is not a single pair to compare. The result is [${a.join(', ')}].`,
      why: 'The outer loop runs while i < n - 1; with n ≤ 1 that bound is never satisfied, therefore zero comparisons are performed.',
      invariant: 'A sequence with fewer than two elements is trivially non-decreasing',
      anchor: 'for (let i = 0; i < n - 1; i += 1) {',
      variables: { n, comparisons: 0 },
      stateAfter: { ...state, values: [...a], phase: 'done', sortedSuffix: n },
      highlights: a.map((_, index) => `cell:${index}`),
      annotations: [{ label: 'zero comparisons', detail: 'The loop bound n - 1 = 0 is never met.' }]
    });
    return trace.finish(
      { sorted: [...a], passes: 0, comparisons: 0, swaps: 0, earlyExit: false },
      { summary: ['Bubble Sort returned the input unchanged.', 'Comparisons: 0 · swaps: 0 · passes: 0'] }
    );
  }

  let pass = 0;
  let earlyExit = false;

  outer: for (let i = 0; i < n - 1; i += 1) {
    let swapped = false;
    pass = i + 1;
    state.pass = i;
    state.swappedInPass = false;
    state.phase = 'scanning';
    trace.record({
      type: 'highlight',
      title: `Start pass ${i + 1}: bubble the largest remaining value to index ${n - 1 - i}`,
      description: `In pass ${i + 1} only indices 0…${n - 2 - i} are compared; the last ${i} element(s) are already final.`,
      why: `Each pass moves the maximum of the unsorted prefix to the end of that prefix, so after ${i} pass(es) the suffix of length ${i} no longer needs comparisons.`,
      invariant: `a[n - ${i}…n - 1] is sorted and contains the ${i} largest values`,
      anchor: 'let swapped = false;',
      variables: { pass: i + 1, comparisonsAllowed: Math.max(0, n - 1 - i), sortedSuffix: i },
      stateAfter: { ...state, values: [...a] },
      highlights: a.map((_, index) => `cell:${index}`).slice(0, Math.max(1, n - i)),
      annotations: [{ label: `sorted suffix length ${i}`, detail: 'never compared again' }],
      impact: { iterations: 1 }
    });

    for (let j = 0; j < n - 1 - i; j += 1) {
      state.j = j;
      const left = a[j];
      const right = a[j + 1];
      state.comparisons += 1;
      trace.record({
        type: 'compare',
        title: `Compare a[${j}] = ${left} with a[${j + 1}] = ${right}`,
        description: `a[${j}] = ${left} and a[${j + 1}] = ${right}; the pair is inverted when ${left} > ${right}.`,
        why: 'Adjacent comparison is the only primitive bubble sort uses: it decides whether the larger value must move one position to the right.',
        invariant: `At index ${j} the running maximum of a[0…${j}] is available to bubble further right`,
        anchor: 'if (a[j] > a[j + 1]) {',
        variables: { i, j, left, right, wouldSwap: left > right },
        stateAfter: { ...state, values: [...a] },
        highlights: [`cell:${j}`, `cell:${j + 1}`],
        impact: { comparisons: 1, reads: 2 }
      });

      if (left > right) {
        swapped = true;
        state.swappedInPass = true;
        const tmp = a[j];
        a[j] = a[j + 1];
        a[j + 1] = tmp;
        state.values = [...a];
        state.swaps += 1;
        trace.record({
          type: 'swap',
          title: `Swap a[${j}] and a[${j + 1}] (${left} ⇄ ${right})`,
          description: `Because ${left} > ${right} the entries exchange places: a[${j}] becomes ${right} and a[${j + 1}] becomes ${left}.`,
          why: 'Swapping the inverted pair restores local order, so the larger value has bubbled one step to the right.',
          invariant: `a[0…${j + 1}] is a permutation of the original prefix with its maximum at index ${j + 1}`,
          anchor: 'a[j + 1] = tmp;',
          variables: { i, j, before: [left, right], after: [right, left] },
          stateAfter: { ...state, values: [...a] },
          highlights: [`cell:${j}`, `cell:${j + 1}`],
          mutations: [
            { target: `cell:${j}`, from: left, to: right },
            { target: `cell:${j + 1}`, from: right, to: left }
          ],
          impact: { swaps: 1, assignments: 3, writes: 3, reads: 3 }
        });
      }
    }

    state.sortedSuffix = i + 1;
    state.phase = 'passed';
    state.j = -1;
    state.values = [...a];
    trace.record({
      type: 'invariant-check',
      title: `Pass ${i + 1} complete: the last ${i + 1} element(s) are final`,
      description: `a[${n - 1 - i}] = ${a[n - 1 - i]} is now in its final position; the sorted suffix has length ${i + 1}.`,
      why: `The maximum of the compared prefix always lands at index ${n - 1 - i}, so it can never move again — that is the invariant that lets the next pass skip one comparison.`,
      invariant: `a[n - ${i + 1}…n - 1] is sorted and holds the ${i + 1} largest values`,
      anchor: 'for (let i = 0; i < n - 1; i += 1) {',
      variables: { pass: i + 1, sortedSuffix: i + 1, comparisons: state.comparisons, swaps: state.swaps },
      stateAfter: { ...state, values: [...a] },
      highlights: a.map((_, index) => `cell:${index}`).slice(n - 1 - i),
      annotations: [{ label: `a[${n - 1 - i}] = ${a[n - 1 - i]} is final` }]
    });

    if (!swapped) {
      earlyExit = true;
      state.sortedSuffix = n;
      state.phase = 'done';
      trace.record({
        type: 'state-update',
        title: `No swap happened in pass ${i + 1} — stop early`,
        description: `Every adjacent pair of the unsorted prefix was already ordered, so \`swapped\` stayed false after ${state.comparisons} comparison(s) and the loop breaks.`,
        why: 'A pass without a single swap proves that no inverted pair remains anywhere, so no further pass could change anything.',
        invariant: 'a is fully sorted — no inversion exists',
        anchor: 'if (!swapped) break;',
        variables: { pass: i + 1, swapped: false },
        stateAfter: { ...state, values: [...a] },
        highlights: a.map((_, index) => `cell:${index}`),
        mutations: [{ target: 'loop i', from: `i = ${i}`, to: 'break' }]
      });
      break outer;
    }
  }

  state.phase = 'done';
  state.j = -1;
  state.sortedSuffix = n;
  state.values = [...a];
  const result: BubbleSortResult = {
    sorted: [...a],
    passes: pass,
    comparisons: state.comparisons,
    swaps: state.swaps,
    earlyExit
  };
  trace.record({
    type: 'done',
    title: `Sorted: [${a.join(', ')}]`,
    description: `After ${pass} pass(es), ${state.comparisons} comparison(s) and ${state.swaps} swap(s) the array is fully ordered.`,
    why: earlyExit
      ? 'The early-exit test proved the array was already ordered, so the remaining passes were skipped.'
      : `All n - 1 = ${n - 1} passes ran; the sorted suffix reached length n, therefore no inverted pair is left.`,
    invariant: 'a is sorted in non-decreasing order and is a permutation of the input',
    anchor: 'return a;',
    variables: { sorted: [...a], passes: pass, comparisons: state.comparisons, swaps: state.swaps },
    stateAfter: { ...state, values: [...a] },
    highlights: a.map((_, index) => `cell:${index}`)
  });

  return trace.finish(result, {
    summary: [
      `Sorted array: [${a.join(', ')}]`,
      `passes: ${pass} · comparisons: ${state.comparisons} · swaps: ${state.swaps}${
        earlyExit ? ' · early exit' : ''
      }`
    ]
  });
}

function visualStateFor(
  event: ExecutionEvent<BubbleSortState>,
  state: BubbleSortState,
  index: number
): VisualState {
  const id = `cell:${index}`;
  const highlighted = event.visualization.highlights.includes(id);
  if (state.phase === 'done') return 'sorted';
  if (highlighted) {
    if (event.type === 'swap') return 'swap';
    if (event.type === 'compare') return 'compare';
    return 'active';
  }
  if (state.sortedSuffix > 0 && index >= state.values.length - state.sortedSuffix) return 'sorted';
  return 'idle';
}

function visualize(
  event: ExecutionEvent<BubbleSortState>,
  state: BubbleSortState
): VisualizationState {
  const { values } = state;
  const labels = values.map((_, index) => String(index));
  const stateFor = (index: number): VisualState => visualStateFor(event, state, index);
  const badgeFor = (index: number): string | undefined => {
    if (state.j === index) return 'j';
    if (state.j >= 0 && state.j + 1 === index) return 'j+1';
    if (state.sortedSuffix > 0 && index >= values.length - state.sortedSuffix) return 'final';
    return undefined;
  };
  const pointers = state.j >= 0 && state.j < values.length
    ? [
        { id: 'pointer-j', label: 'j', target: `cell:${state.j}`, state: 'active' as VisualState },
        ...(state.j + 1 < values.length
          ? [{ id: 'pointer-j1', label: 'j+1', target: `cell:${state.j + 1}`, state: 'active' as VisualState }]
          : [])
      ]
    : [];
  const bars = buildBars({
    values,
    labels,
    caption: `values as bars — ${event.title}`,
    stateFor,
    badgeFor
  });
  const cells = buildArray({
    values,
    labels,
    caption: `indexed cells — pass ${state.pass + (state.phase === 'scanning' ? 1 : 0)} of ${Math.max(
      1,
      values.length - 1
    )}`,
    stateFor,
    badgeFor,
    pointers,
    legend: mergeLegend(undefined, [
      { state: 'swap', label: 'swapped pair' },
      { state: 'sorted', label: 'fixed suffix' }
    ])
  });
  return {
    kind: 'composite',
    primary: bars,
    secondary: cells,
    caption: 'Primary: value bars. Secondary: indexed cells with j / j+1 cursors.'
  };
}

const TESTS: AlgorithmTestCase[] = [
  {
    id: 'canonical',
    name: 'Canonical unsorted input',
    family: 'canonical',
    input: { values: [5, 1, 4, 2, 8] },
    expect: {
      result: { sorted: [1, 2, 4, 5, 8], passes: 3, comparisons: 9, swaps: 4, earlyExit: true },
      predicate: 'permutation-of-input',
      predicatePath: 'sorted',
      predicateArg: [5, 1, 4, 2, 8],
      eventTypes: ['init', 'compare', 'swap', 'invariant-check', 'state-update', 'done'],
      minEvents: 18,
      counters: { comparisons: { exact: 9 }, swaps: { exact: 4 } }
    },
    note: 'Nine adjacent comparisons and four swaps; the third pass swaps nothing, so the early exit fires.'
  },
  {
    id: 'empty',
    name: 'Empty array is valid and stays empty',
    family: 'empty',
    input: { values: [] },
    expect: {
      result: { sorted: [], passes: 0, comparisons: 0, swaps: 0, earlyExit: false },
      counters: { comparisons: { exact: 0 } },
      minEvents: 2
    },
    note: 'No pair exists, so the counters must stay at zero.'
  },
  {
    id: 'singleton',
    name: 'Singleton array',
    family: 'singleton',
    input: { values: [7] },
    expect: {
      result: { sorted: [7], passes: 0, comparisons: 0, swaps: 0, earlyExit: false },
      counters: { comparisons: { exact: 0 }, swaps: { exact: 0 } }
    }
  },
  {
    id: 'minimum',
    name: 'Minimum non-trivial size (two elements, swapped)',
    family: 'minimum',
    input: { values: [2, 1] },
    expect: {
      result: { sorted: [1, 2], passes: 1, comparisons: 1, swaps: 1, earlyExit: false },
      eventTypes: ['compare', 'swap', 'done'],
      counters: { comparisons: { exact: 1 } }
    }
  },
  {
    id: 'duplicates',
    name: 'Duplicate-heavy input keeps multiplicities',
    family: 'duplicates',
    input: { values: [3, 1, 3, 2, 1, 3] },
    expect: {
      result: { sorted: [1, 1, 2, 3, 3, 3], passes: 4, comparisons: 14, swaps: 6, earlyExit: true },
      predicate: 'permutation-of-input',
      predicatePath: 'sorted',
      predicateArg: [3, 1, 3, 2, 1, 3]
    },
    note: 'Equal neighbours never swap, which is exactly why bubble sort is stable.'
  },
  {
    id: 'already-sorted',
    name: 'Already sorted input exits after one pass',
    family: 'already-solved',
    input: { values: [1, 2, 3, 4, 5] },
    expect: {
      result: { sorted: [1, 2, 3, 4, 5], passes: 1, comparisons: 4, swaps: 0, earlyExit: true },
      eventTypes: ['state-update', 'done'],
      counters: { comparisons: { exact: 4 }, swaps: { exact: 0 } }
    },
    note: 'Best case O(n): one clean pass proves the array is ordered.'
  },
  {
    id: 'adversarial',
    name: 'Reverse sorted input (worst case)',
    family: 'adversarial',
    input: { values: [9, 8, 7, 6, 5, 4, 3, 2, 1] },
    expect: {
      result: {
        sorted: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        passes: 8,
        comparisons: 36,
        swaps: 36,
        earlyExit: false
      },
      counters: { comparisons: { exact: 36 }, swaps: { exact: 36 } }
    },
    note: 'n(n-1)/2 = 36 comparisons and 36 swaps.'
  },
  {
    id: 'maximum',
    name: 'Largest supported input (40 elements, reverse ordered)',
    family: 'maximum',
    input: {
      values: [
        40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19,
        18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1
      ]
    },
    expect: {
      predicate: 'sorted',
      predicatePath: 'sorted',
      counters: { comparisons: { exact: 780 } },
      maxEvents: 2000
    },
    note: 'Confirms the trace stays bounded: 780 comparisons for n = 40.'
  },
  {
    id: 'invalid-non-integer',
    name: 'Non-integer value is rejected',
    family: 'invalid',
    input: { values: [1, 2.5, 3] },
    expect: { rejects: true }
  },
  {
    id: 'invalid-unknown-field',
    name: 'Unknown field is rejected instead of silently ignored',
    family: 'invalid',
    input: { values: [1, 2], ascending: false },
    expect: { rejects: true }
  },
  {
    id: 'invalid-out-of-range',
    name: 'Value outside the supported range is rejected',
    family: 'invalid',
    input: { values: [1, 5000] },
    expect: { rejects: true }
  },
  {
    id: 'trace-property',
    name: 'Trace records one comparison event per counted comparison',
    family: 'trace-property',
    input: { values: [4, 2, 5, 1] },
    expect: {
      result: { sorted: [1, 2, 4, 5], passes: 3, comparisons: 6, swaps: 4, earlyExit: false },
      counters: { comparisons: { exact: 6 }, swaps: { exact: 4 } },
      eventTypes: ['compare', 'swap', 'invariant-check', 'done'],
      minEvents: 14
    },
    note: 'Guards against fabricated or missing visual steps.'
  }
];

export const bubbleSort = defineAlgorithm<BubbleSortInput, BubbleSortState, BubbleSortResult>({
  id: ALGORITHM_ID,
  name: 'Bubble Sort',
  category: 'sorting',
  subcategory: 'Comparison sorts',
  difficulty: 'easy',
  tags: ['sorting', 'in-place', 'stable', 'adaptive', 'comparison'],
  prerequisites: ['arrays', 'loops', 'loop invariants'],
  related: ['cocktail-sort', 'insertion-sort', 'selection-sort', 'comb-sort'],

  concept: {
    definition:
      'Bubble sort repeatedly walks the array exchanging every adjacent pair that is out of order; after each pass the largest remaining value has bubbled to its final position at the end of the active prefix.',
    problem:
      'Given a sequence of comparable values, produce a non-decreasing rearrangement of the same multiset using only adjacent comparisons and exchanges.',
    intuition:
      'Swapping an inverted neighbouring pair strictly decreases the number of inversions, so progress is monotone; the maximum of the scanned prefix is carried to the far right of that prefix, so one element becomes final per pass. A pass without a single swap proves that no inversion remains.',
    motivation:
      'Bubble sort is the smallest complete example of a loop invariant, of best/worst case analysis and of adaptivity — the reasoning you reuse for insertion sort, selection sort and sorting networks.',
    whenToUse: [
      'Teaching loop invariants, inversion counting and early-exit optimisation.',
      'Tiny, nearly sorted inputs (n < 10) where one or two clean passes suffice.',
      'Answering "is this sequence already sorted?" as a side effect of one pass.'
    ],
    whenNotToUse: [
      'Any real workload at scale: Θ(n²) data movement makes it unusable for n ≥ 1000.',
      'Input on slow storage where insertion sort shifts instead of swapping.',
      'Linked lists, where adjacent exchanging is awkward and merge sort is natural.'
    ],
    preconditions: [
      'Values are totally ordered.',
      'The sequence fits in memory: the sort is performed in place on a working copy.'
    ],
    invariants: [
      'a is always a permutation of the input values (only exchanges occur).',
      'After pass i the last i elements of a are sorted and hold the i largest values.',
      'During pass i, a[0…j] holds the same multiset as the input prefix and its maximum sits at index j.'
    ],
    correctness:
      'Termination: the outer loop runs at most n - 1 times. Partial correctness: after pass i the suffix of length i is final because the running maximum is carried to index n - 1 - i, so after n - 1 passes the whole array is sorted. The early exit is sound since a pass with no swap means every adjacent pair is ordered, which is equivalent to being sorted.',
    commonMistakes: [
      'Comparing a[j] with a[j + 1] but swapping a[j] with a[j + 2].',
      'Using the inner bound j < n - 1 instead of j < n - 1 - i, wasting comparisons on the fixed suffix.',
      'Sharing one temporary across iterations of a manual swap, so the saved value is overwritten.',
      'Omitting the early-exit flag and losing the O(n) best case on sorted input.'
    ],
    applications: [
      'Introductory analysis of inversion counts and adaptivity.',
      'Detecting ordering violations in nearly sorted pipelines.',
      'Basis for cocktail shaker sort and comb sort.'
    ],
    variants: [
      'Cocktail shaker sort — bidirectional passes.',
      'Comb sort — shrinking gaps to remove turtles early.',
      'Odd–even transposition sort — parallel-comparison ordering.'
    ]
  },

  visualModel: 'Synchronised value bars plus indexed cells with j / j+1 cursors.',
  visualNotes:
    'Bar heights show values, cells show indices, and the cursors j / j+1 mark the compared pair. The fixed suffix is labelled "final" so it is never confused with the working prefix.',

  inputSchema: INPUT_SCHEMA,
  outputSchema:
    '{ sorted: number[], passes: number, comparisons: number, swaps: number, earlyExit: boolean }',

  implementations: {
    typescript: TYPESCRIPT_IMPLEMENTATION,
    python: PYTHON_IMPLEMENTATION,
    cpp: CPP_IMPLEMENTATION,
    java: JAVA_IMPLEMENTATION
  },

  execute,
  visualize,

  complexity: {
    best: 'O(n)',
    average: 'O(n^2)',
    worst: 'O(n^2)',
    space: 'O(1) auxiliary',
    notes:
      'The O(n) best case needs the early-exit flag: one pass of n - 1 comparisons proves the array is ordered. Space is O(1) beyond the defensive copy of the input.',
    inputSensitive:
      'Comparison count depends on the data, not only on n: sorted input costs n - 1 comparisons, reverse ordered input costs n(n - 1)/2.',
    properties: ['stable', 'in-place on the working array', 'adaptive (early exit on a clean pass)']
  },

  tests: TESTS,

  references: [
    { label: 'Bubble sort — analysis and variants', url: 'https://en.wikipedia.org/wiki/Bubble_sort' },
    { label: 'Knuth, TAOCP Vol. 3 §5.2.2', url: 'https://en.wikipedia.org/wiki/The_Art_of_Computer_Programming' }
  ]
});





