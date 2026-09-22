export type Difficulty = "easy" | "medium" | "hard" | "advanced";

export interface AlgorithmConcept {
  definition: string;
  problem: string;
  intuition: string;
  whenToUse: string[];
  whenNotToUse: string[];
  preconditions: string[];
  invariants: string[];
  correctness: string;
  commonMistakes: string[];
  applications: string[];
  variants: string[];
}

export interface AlgorithmComplexity {
  best: string;
  average: string;
  worst: string;
  space: string;
  notes?: string;
}

export interface AlgorithmImplementations {
  python: string;
  cpp: string;
  java: string;
  c?: string;
  typescript?: string;
}

export interface CodeReference {
  language: string;
  lineStart: number;
  lineEnd: number;
}

export interface ExecutionEvent {
  step: number;
  type: string;
  title: string;
  description: string;
  why: string;
  invariant?: string;
  codeReference?: CodeReference;
  variables: Record<string, unknown>;
  stateBefore: unknown;
  stateAfter: unknown;
  visualization: {
    highlights: string[];
    mutations: unknown[];
    annotations: unknown[];
  };
  complexityImpact?: {
    comparisons?: number;
    swaps?: number;
    assignments?: number;
    relaxations?: number;
    recursiveCalls?: number;
  };
}

export interface ExecutionTrace<State = unknown, Event extends ExecutionEvent = ExecutionEvent> {
  algorithmId: string;
  input: unknown;
  initialState: State;
  events: Event[];
  finalState: State;
  finalResult: unknown;
  metadata: {
    startTime: number;
    endTime: number;
    totalSteps: number;
    seed?: number;
  };
}

export interface VisualizationState {
  type: "array" | "linked-list" | "tree" | "graph" | "dp-table" | "call-stack" | "string" | "geometry" | "heap";
  data: unknown;
  highlights: string[];
  annotations: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface PracticeQuestion {
  id: string;
  type: "predict-next-operation" | "predict-next-state" | "trace-variables" | "identify-invariant" | "identify-complexity" | "complete-code" | "debug-implementation" | "handle-edge-case" | "explain-correctness";
  prompt: string;
  expectedAnswer: unknown;
  explanation: string;
  difficulty: Difficulty;
  traceReference?: {
    stepIndex: number;
    eventType: string;
  };
}

export interface TestCase {
  id: string;
  name: string;
  input: unknown;
  expectedOutput: unknown;
  expectedTraceProperties?: {
    stepCount?: number;
    eventTypes?: string[];
    invariants?: string[];
    complexityBounds?: Record<string, number>;
  };
  category: "canonical" | "empty" | "singleton" | "min-size" | "max-size" | "duplicates" | "solved" | "adversarial" | "invalid" | "replay";
}

export interface AlgorithmDefinition<
  Input = unknown,
  State = unknown,
  Event extends ExecutionEvent = ExecutionEvent
> {
  id: string;
  name: string;
  category: string;
  difficulty: Difficulty;
  tags: string[];
  prerequisites: string[];
  concept: AlgorithmConcept;
  inputSchema: unknown;
  outputSchema: unknown;
  implementations: AlgorithmImplementations;
  execute(input: Input): ExecutionTrace<State, Event>;
  visualize(event: Event, state: State): VisualizationState;
  generatePractice(trace: ExecutionTrace<State, Event>): PracticeQuestion[];
  complexity: AlgorithmComplexity;
  tests: TestCase[];
}

export interface AlgorithmRegistry {
  register<Input, State, Event extends ExecutionEvent>(def: AlgorithmDefinition<Input, State, Event>): void;
  get(id: string): AlgorithmDefinition | undefined;
  getByCategory(category: string): AlgorithmDefinition[];
  getAll(): AlgorithmDefinition[];
}

export type VisualizationAdapter<State = unknown, Event extends ExecutionEvent = ExecutionEvent> = {
  initialState(state: State): VisualizationState;
  onEvent(event: Event, state: State): VisualizationState;
  onStep(step: number, state: State): VisualizationState;
  onReset(): VisualizationState;
};

export type ExplanationEvent = {
  title: string;
  operation: string;
  why: string;
  state: string;
  invariant: string;
  code: string;
  complexity: string;
};