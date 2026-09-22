import { createCodeMap } from './code-map';
import { SeededRandom, DEFAULT_SEED } from './rng';
import type {
  CodeReference,
  ComplexityCounters,
  ComplexityImpact,
  CounterKey,
  Determinism,
  ExecutionEvent,
  ExecutionTrace,
  TraceMeta,
  VisualizationAnnotation,
  VisualizationMutation
} from './types';

export const ZERO_COUNTERS: ComplexityCounters = {
  comparisons: 0,
  swaps: 0,
  assignments: 0,
  reads: 0,
  writes: 0,
  relaxations: 0,
  recursiveCalls: 0,
  iterations: 0,
  probes: 0,
  allocations: 0,
  arithmetic: 0
};

const COUNTER_KEYS: CounterKey[] = Object.keys(ZERO_COUNTERS) as CounterKey[];

export function emptyCounters(): ComplexityCounters {
  return { ...ZERO_COUNTERS };
}

export function addCounters(target: ComplexityCounters, impact?: ComplexityImpact): void {
  if (!impact) return;
  for (const key of COUNTER_KEYS) {
    const amount = impact[key];
    if (typeof amount === 'number' && Number.isFinite(amount)) {
      target[key] += amount;
    }
  }
}

/** Structural clone that never shares references with live algorithm state. */
export function cloneState<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value) as T;
    } catch {
      // Data structures holding functions fall back to JSON (state has no functions).
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface RecordEventInput<State> {
  type: string;
  title: string;
  description: string;
  why: string;
  invariant?: string;
  focus?: string;
  /**
   * Anchor substring inside the TypeScript reference implementation.
   * Resolved to real line numbers — the mapping can never drift.
   */
  anchor?: string;
  variables?: Record<string, unknown>;
  stateAfter: State;
  highlights?: string[];
  mutations?: VisualizationMutation[];
  annotations?: VisualizationAnnotation[];
  impact?: ComplexityImpact;
  /** Auxiliary-structure depth after this event (stack, recursion, heap…). */
  depth?: number;
}

export interface TraceBuilderOptions<State> {
  algorithmId: string;
  algorithmName: string;
  input: unknown;
  initial: State;
  /** TypeScript reference implementation used for line mapping. */
  code: string;
  determinism: Determinism;
  seed?: number;
  maxEvents?: number;
}

const DEFAULT_MAX_EVENTS = 20000;

/** Thrown when `maxEvents` is exceeded; caught by the algorithm wrapper. */
export class TraceTruncatedError extends Error {
  constructor(limit: number) {
    super(`trace truncated at ${limit} events`);
    this.name = 'TraceTruncatedError';
  }
}

/**
 * Builds a canonical `ExecutionTrace`.
 *
 * Guarantees enforced here (and re-checked by the testkit):
 *  - step numbers are 1-based and contiguous;
 *  - `stateBefore` of step n is exactly `stateAfter` of step n-1;
 *  - every event has a concrete description, a reason and real code lines;
 *  - counters only ever grow and equal the sum of per-event impacts.
 */
export class TraceBuilder<State, Result> {
  readonly rng: SeededRandom;
  private readonly codeMap: ReturnType<typeof createCodeMap>;
  private readonly events: ExecutionEvent<State>[] = [];
  private readonly counterTotals: ComplexityCounters = emptyCounters();
  private readonly warningList: string[] = [];
  /** Pristine copy of the starting state (never shares references with live state). */
  private readonly initialState: State;
  private current: State;
  private maxDepth = 0;
  private truncated = false;
  private readonly maxEvents: number;

  constructor(private readonly options: TraceBuilderOptions<State>) {
    this.codeMap = createCodeMap(options.code, 'typescript');
    this.rng = new SeededRandom(options.seed ?? DEFAULT_SEED);
    this.initialState = cloneState(options.initial);
    this.current = cloneState(options.initial);
    this.maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
  }

  get stepCount(): number {
    return this.events.length;
  }

  get counters(): ComplexityCounters {
    return { ...this.counterTotals };
  }

  /** Current state (defensive copy — callers cannot mutate the trace). */
  snapshot(): State {
    return cloneState(this.current);
  }

  /** Resolves an anchor in the reference code; throws when it is not unique. */
  ref(anchor: string): CodeReference {
    return this.codeMap.ref(anchor);
  }

  record(input: RecordEventInput<State>): void {
    if (this.events.length >= this.maxEvents) {
      this.truncated = true;
      this.warn(`trace truncated at ${this.maxEvents} events — the run stopped before completion`);
      throw new TraceTruncatedError(this.maxEvents);
    }
    if (!input.description.trim()) {
      throw new Error(`event "${input.title}" has an empty description`);
    }
    if (!input.why.trim()) {
      throw new Error(`event "${input.title}" has no reason (why)`);
    }
    const stateAfter = cloneState(input.stateAfter);
    const stateBefore = cloneState(this.current);
    const depth = input.depth ?? this.maxDepth;
    this.maxDepth = Math.max(this.maxDepth, depth);
    this.current = cloneState(stateAfter);
    addCounters(this.counterTotals, input.impact);
    const event: ExecutionEvent<State> = {
      step: this.events.length + 1,
      type: input.type,
      title: input.title,
      description: input.description,
      why: input.why,
      variables: input.variables ? cloneState(input.variables) : {},
      stateBefore,
      stateAfter,
      visualization: {
        highlights: input.highlights ?? [],
        mutations: input.mutations ?? [],
        annotations: input.annotations ?? []
      }
    };
    if (input.invariant) event.invariant = input.invariant;
    if (input.focus) event.focus = input.focus;
    if (input.anchor) event.codeReference = this.codeMap.ref(input.anchor);
    if (input.impact) event.complexityImpact = { ...input.impact };
    this.events.push(event);
  }

  warn(message: string): void {
    if (!this.warningList.includes(message)) this.warningList.push(message);
  }

  finish(
    result: Result,
    options?: { summary?: string[]; final?: State }
  ): ExecutionTrace<State, Result> {
    const finalState = options?.final !== undefined ? cloneState(options.final) : cloneState(this.current);
    const meta: TraceMeta = {
      eventCount: this.events.length,
      maxDepth: this.maxDepth,
      ok: !this.truncated
    };
    const trace: ExecutionTrace<State, Result> = {
      algorithmId: this.options.algorithmId,
      algorithmName: this.options.algorithmName,
      input: cloneState(this.options.input),
      determinism: this.options.determinism,
      initial: cloneState(this.initialState),
      final: finalState,
      result: cloneState(result),
      events: this.events,
      counters: { ...this.counterTotals },
      summary: options?.summary ?? [],
      warnings: [...this.warningList],
      meta
    };
    if (this.options.seed !== undefined) trace.seed = this.options.seed;
    return trace;
  }
}

