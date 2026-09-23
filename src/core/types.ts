/**
 * AlgoViz — Cinematic Atlas
 * Core contracts (single source of truth).
 *
 * These types are implementation directives. Every algorithm in the atlas must
 * plug into them instead of inventing one-off structures. Changing anything in
 * this file is a *shared contract change*: see CONTRIBUTING.md → Shared file rule.
 */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'advanced';

export type Language = 'typescript' | 'python' | 'cpp' | 'java' | 'c';

export type CategoryId =
  | 'arrays-searching'
  | 'sorting'
  | 'linked-lists'
  | 'stacks-queues-hashing'
  | 'trees'
  | 'graphs'
  | 'greedy'
  | 'dynamic-programming'
  | 'strings'
  | 'backtracking'
  | 'number-theory'
  | 'bit-manipulation'
  | 'geometry'
  | 'advanced-daa';

export interface CategoryDocs {
  id: CategoryId;
  name: string;
  blurb: string;
  /** Atlas page range that authorises this category. */
  atlasPages: string;
}

/* -------------------------------------------------------------------------- */
/* Code mapping                                                               */
/* -------------------------------------------------------------------------- */

export interface CodeReference {
  language: Language;
  lineStart: number;
  lineEnd: number;
}

/* -------------------------------------------------------------------------- */
/* Complexity                                                                 */
/* -------------------------------------------------------------------------- */

export type CounterKey =
  | 'comparisons'
  | 'swaps'
  | 'assignments'
  | 'reads'
  | 'writes'
  | 'relaxations'
  | 'recursiveCalls'
  | 'iterations'
  | 'probes'
  | 'allocations'
  | 'arithmetic';

export type ComplexityCounters = Record<CounterKey, number>;

export type ComplexityImpact = Partial<Record<CounterKey, number>>;

export interface ComplexityDoc {
  best: string;
  average: string;
  worst: string;
  space: string;
  notes?: string;
  /** Behaviour that depends on the concrete input rather than the size. */
  inputSensitive?: string;
  /** Stability / in-place / online / amortised properties where they apply. */
  properties?: string[];
}

/* -------------------------------------------------------------------------- */
/* Visualisation state (presentation-independent, JSON serialisable)          */
/* -------------------------------------------------------------------------- */

/**
 * Semantic state of a visual element. Colour is NEVER the only signal: every
 * element also carries a `badge`/`state` label that is rendered as text.
 */
export type VisualState =
  | 'idle'
  | 'active'
  | 'compare'
  | 'swap'
  | 'write'
  | 'selected'
  | 'sorted'
  | 'visited'
  | 'frontier'
  | 'path'
  | 'discarded'
  | 'inserted'
  | 'updated'
  | 'found'
  | 'blocked'
  | 'error'
  | 'muted';

export interface CellVisual {
  id?: string;
  /** Rendered text of the cell (index, value, blank for empty). */
  value: string | number | null;
  /** Small caption under the cell (index labels, row/column names). */
  label?: string;
  state?: VisualState;
  /** Text token that mirrors `state` for non-colour perception. */
  badge?: string;
}

export interface PointerVisual {
  id: string;
  label: string;
  /** Target cell/element the pointer refers to. */
  target: string;
  state?: VisualState;
}

export interface LegendEntry {
  state: VisualState;
  label: string;
}

export interface ArrayVisual {
  kind: 'array';
  cells: CellVisual[];
  pointers?: PointerVisual[];
  caption: string;
  legend?: LegendEntry[];
}

export interface BarsVisual {
  kind: 'bars';
  bars: { id: string; value: number; label?: string; state?: VisualState; badge?: string }[];
  pointers?: PointerVisual[];
  caption: string;
  /** Axis/annotation line rendered across the bars (e.g. target value). */
  guide?: { value: number; label: string };
  legend?: LegendEntry[];
}

export interface NodeVisual {
  id: string;
  label: string;
  sub?: string;
  state?: VisualState;
  badge?: string;
  /** Optional explicit coordinates for graph layouts (0..1 normalised). */
  x?: number;
  y?: number;
}

export interface EdgeVisual {
  id?: string;
  from: string;
  to: string;
  label?: string;
  state?: VisualState;
  directed?: boolean;
}

export interface NodesVisual {
  kind: 'nodes';
  layout: 'list' | 'tree' | 'graph';
  nodes: NodeVisual[];
  edges: EdgeVisual[];
  pointers?: PointerVisual[];
  caption: string;
  legend?: LegendEntry[];
}

export interface TableVisual {
  kind: 'table';
  colHeader?: string[];
  rowHeader?: string[];
  rows: CellVisual[][];
  caption: string;
  legend?: LegendEntry[];
}

export interface StackVisual {
  kind: 'stack';
  label: string;
  items: CellVisual[];
  caption: string;
  legend?: LegendEntry[];
}

export interface QueueVisual {
  kind: 'queue';
  label: string;
  items: CellVisual[];
  caption: string;
  legend?: LegendEntry[];
}

export interface StringVisual {
  kind: 'strings';
  rows: { label: string; chars: CellVisual[] }[];
  /** Aligned cursors over a row, e.g. the matcher window. */
  cursors?: { id: string; label: string; row: number; index: number; state?: VisualState }[];
  caption: string;
  legend?: LegendEntry[];
}

export interface BitsVisual {
  kind: 'bits';
  /** Most-significant-bit first. */
  words: { label: string; value: number; bits: CellVisual[] }[];
  caption: string;
  legend?: LegendEntry[];
}

export interface PlaneVisual {
  kind: 'plane';
  points: { id: string; label?: string; x: number; y: number; state?: VisualState; badge?: string }[];
  segments: { id?: string; from: string; to: string; state?: VisualState; label?: string }[];
  polygons: { id?: string; label: string; points: string[]; state?: VisualState }[];
  range: { xMin: number; xMax: number; yMin: number; yMax: number };
  caption: string;
  legend?: LegendEntry[];
}

export interface CallStackVisual {
  kind: 'calls';
  frames: { id: string; label: string; detail?: string; state?: VisualState; args?: Record<string, unknown> }[];
  caption: string;
  legend?: LegendEntry[];
}

export interface TextVisual {
  kind: 'text';
  lines: string[];
  caption: string;
}

/**
 * Composite view: the atlas requires a primary visual model plus synchronised
 * secondary views (e.g. bars + indexed cells, table + recursion tree). Both
 * sides are derived from the same event and the same algorithm state.
 */
export interface CompositeVisual {
  kind: 'composite';
  primary: VisualizationState;
  secondary?: VisualizationState;
  tertiary?: VisualizationState;
  caption: string;
}

export type VisualizationState =
  | ArrayVisual
  | BarsVisual
  | NodesVisual
  | TableVisual
  | StackVisual
  | QueueVisual
  | StringVisual
  | BitsVisual
  | PlaneVisual
  | CallStackVisual
  | TextVisual
  | CompositeVisual;

/* -------------------------------------------------------------------------- */
/* Execution trace                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Canonical, documented event types. Algorithms may use additional specific
 * types (they are plain strings) but must document them in their definition.
 */
export const CORE_EVENT_TYPES = [
  'init',
  'validate',
  'compare',
  'swap',
  'write',
  'read',
  'select',
  'insert',
  'delete',
  'visit',
  'push',
  'pop',
  'enqueue',
  'dequeue',
  'recurse',
  'return',
  'prune',
  'relax',
  'merge',
  'partition',
  'highlight',
  'state-update',
  'invariant-check',
  'found',
  'not-found',
  'done'
] as const;

export interface VisualizationMutation {
  /** Element id that changed (e.g. `cell:3`, `node:A`, `dp[2][3]`). */
  target: string;
  from?: unknown;
  to?: unknown;
  note?: string;
}

export interface VisualizationAnnotation {
  target?: string;
  label: string;
  detail?: string;
}

export interface VisualizationHints {
  /** Element ids the learner must look at for this event. */
  highlights: string[];
  mutations: VisualizationMutation[];
  annotations: VisualizationAnnotation[];
}

export interface ExecutionEvent<State = unknown> {
  step: number;
  type: string;
  title: string;
  /** What happened — concrete, never "continue"/"processing"/"next step". */
  description: string;
  /** Why it happened now, in terms of the algorithm's decision rule. */
  why: string;
  /** Which invariant is preserved by this transition. */
  invariant?: string;
  /** Element id or variable the learner should watch. */
  focus?: string;
  codeReference?: CodeReference;
  variables: Record<string, unknown>;
  stateBefore: State;
  stateAfter: State;
  visualization: VisualizationHints;
  complexityImpact?: ComplexityImpact;
}

export type Determinism = 'deterministic' | 'seeded';

export interface TraceMeta {
  eventCount: number;
  /** Maximum recursion/auxiliary-structure depth observed. */
  maxDepth: number;
  ok: boolean;
}

export interface ExecutionTrace<State = unknown, Result = unknown> {
  algorithmId: string;
  algorithmName: string;
  input: unknown;
  seed?: number;
  determinism: Determinism;
  initial: State;
  final: State;
  result: Result;
  events: ExecutionEvent<State>[];
  counters: ComplexityCounters;
  /** Human readable result summary lines (result + key counters). */
  summary: string[];
  warnings: string[];
  meta: TraceMeta;
}

export interface ExecuteOptions {
  seed?: number;
  /** Safety valve for pathological inputs; the trace records truncation. */
  maxEvents?: number;
}

/* -------------------------------------------------------------------------- */
/* Input schema (validated input + generatable UI + reusable in tests)         */
/* -------------------------------------------------------------------------- */

export interface InputFieldBase {
  name: string;
  label: string;
  help?: string;
  optional?: boolean;
}

export interface IntArrayField extends InputFieldBase {
  kind: 'int-array';
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  allowEmpty?: boolean;
  default: number[];
}

export interface NumberField extends InputFieldBase {
  kind: 'number';
  min?: number;
  max?: number;
  integer?: boolean;
  default: number;
}

export interface TextField extends InputFieldBase {
  kind: 'text';
  minLength?: number;
  maxLength?: number;
  charset?: 'any' | 'lowercase' | 'digits' | 'lowercase-upper-digits';
  default: string;
}

export interface BooleanField extends InputFieldBase {
  kind: 'boolean';
  default: boolean;
}

export interface EnumField extends InputFieldBase {
  kind: 'enum';
  options: { value: string; label: string }[];
  default: string;
}

export interface IntMatrixField extends InputFieldBase {
  kind: 'int-matrix';
  min?: number;
  max?: number;
  rows: number;
  cols: number;
  default: number[][];
}

export interface EdgeListField extends InputFieldBase {
  kind: 'edges';
  /** Node labels available for selection; when omitted edges are free-form ints. */
  nodes?: string[];
  weighted?: boolean;
  directed?: boolean;
  default: { from: string; to: string; weight?: number }[];
}

export interface IntervalField extends InputFieldBase {
  kind: 'intervals';
  maxEnd?: number;
  default: { start: number; end: number }[];
}

export interface ItemsField extends InputFieldBase {
  kind: 'items';
  /** Items with weight/profit style payloads. */
  default: { label: string; weight: number; profit: number }[];
}

export type InputField =
  | IntArrayField
  | NumberField
  | TextField
  | BooleanField
  | EnumField
  | IntMatrixField
  | EdgeListField
  | IntervalField
  | ItemsField;

export interface AlgorithmInputSchema {
  /** One-line description of the input shape. */
  summary: string;
  fields: InputField[];
  /** Ready-made inputs offered in the input panel. */
  examples: { label: string; value: unknown; note?: string }[];
}

/* -------------------------------------------------------------------------- */
/* Concept documentation                                                      */
/* -------------------------------------------------------------------------- */

export interface ConceptDoc {
  definition: string;
  problem: string;
  intuition: string;
  /** Why the learner should care — motivation. */
  motivation: string;
  whenToUse: string[];
  whenNotToUse: string[];
  preconditions: string[];
  invariants: string[];
  correctness: string;
  commonMistakes: string[];
  applications: string[];
  variants: string[];
}

/* -------------------------------------------------------------------------- */
/* Practice                                                                   */
/* -------------------------------------------------------------------------- */

export type PracticeKind =
  | 'predict-next'
  | 'predict-state'
  | 'trace-variable'
  | 'invariant'
  | 'complexity'
  | 'complete-code'
  | 'debug'
  | 'edge-case'
  | 'correctness';

export interface PracticeQuestion {
  id: string;
  algorithmId: string;
  kind: PracticeKind;
  difficulty: Difficulty;
  prompt: string;
  /** Multiple-choice answers. Free-text questions omit `choices`. */
  choices?: string[];
  answerIndex?: number;
  /** Free-text answer or the canonical answer text for MC questions. */
  answer?: string;
  explanation: string;
  /** Trace steps this question is grounded in (empty for conceptual ones). */
  eventSteps: number[];
}

export interface PracticeResponse {
  /** Selected choice for MC questions. */
  choiceIndex?: number;
  /** Free-text response. */
  text?: string;
}

export interface PracticeGrade {
  correct: boolean;
  expected: string;
  received: string;
  explanation: string;
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

export type TestFamily =
  | 'canonical'
  | 'empty'
  | 'singleton'
  | 'minimum'
  | 'maximum'
  | 'duplicates'
  | 'already-solved'
  | 'adversarial'
  | 'invalid'
  | 'determinism'
  | 'trace-property';

export interface TestExpectation {
  /** Exact expected result (compared structurally). */
  result?: unknown;
  /** Name of a structural predicate applied to the result. */
  predicate?:
    | 'sorted'
    | 'sorted-stable'
    | 'permutation-of-input'
    | 'non-decreasing'
    | 'partitioned'
    /**
     * `index-of-value`: the result is `null` exactly when the target is absent,
     * otherwise an integer index inside `predicateArg.values` (or the input's
     * own `values`) whose element equals `predicateArg.target`. Use this when
     * several indices are equally valid answers (e.g. binary search over
     * duplicates) instead of hard-coding one occurrence as the expectation.
     */
    | 'index-of-value';
  /**
   * Property of the result the predicate applies to, e.g. `sorted` when the
   * algorithm returns `{ sorted, comparisons }`. Empty means the result itself.
   */
  predicatePath?: string;
  /** Predicate argument (e.g. the original array for permutation checks). */
  predicateArg?: unknown;
  /** Event types that must occur in the trace. */
  eventTypes?: string[];
  /** Minimum number of events (proves the trace is real, not fabricated). */
  minEvents?: number;
  /** Maximum number of events (guards against fabricated padding). */
  maxEvents?: number;
  /** Counter bounds, e.g. { comparisons: { min: 1 } }. */
  counters?: Partial<Record<CounterKey, { min?: number; max?: number; exact?: number }>>;
  /** The input is invalid and must be rejected by validation. */
  rejects?: boolean;
  /** Required warnings. */
  warnings?: string[];
}

export interface AlgorithmTestCase {
  id: string;
  name: string;
  family: TestFamily;
  input: unknown;
  expect: TestExpectation;
  note?: string;
}

/* -------------------------------------------------------------------------- */
/* Algorithm definition                                                       */
/* -------------------------------------------------------------------------- */

export interface Implementations {
  typescript: string;
  python: string;
  cpp: string;
  java: string;
  c?: string;
}

export interface Reference {
  label: string;
  url: string;
}

export interface AlgorithmDefinition<Input = unknown, State = unknown, Result = unknown> {
  id: string;
  name: string;
  category: CategoryId;
  subcategory: string;
  difficulty: Difficulty;
  tags: string[];
  prerequisites: string[];
  related: string[];

  concept: ConceptDoc;

  /** Truthful description of the primary visual model, e.g. "indexed cells + pointers". */
  visualModel: string;
  /** What the learner sees change, step by step. */
  visualNotes: string;

  inputSchema: AlgorithmInputSchema;
  outputSchema: string;

  implementations: Implementations;

  execute(input: Input, options?: ExecuteOptions): ExecutionTrace<State, Result>;
  visualize(event: ExecutionEvent<State>, state: State): VisualizationState;

  complexity: ComplexityDoc;
  tests: AlgorithmTestCase[];

  /** Extra, algorithm-specific practice questions merged with the generic engine. */
  practiceExtras?: (trace: ExecutionTrace<State, Result>) => PracticeQuestion[];

  references?: Reference[];
}

/** Loose runtime view used by the registry, the UI and the testkit. */
export type AnyAlgorithmDefinition = AlgorithmDefinition<never, unknown, unknown> & {
  execute: (input: never, options?: ExecuteOptions) => ExecutionTrace<unknown, unknown>;
};
