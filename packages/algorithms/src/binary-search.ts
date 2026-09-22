import type {
  AlgorithmDefinition,
  ExecutionEvent,
  ExecutionTrace,
  PracticeQuestion,
  TestCase,
  VisualizationState,
} from "@algoviz/shared";

export interface BinarySearchInput {
  values: number[];
  target: number;
}

export interface BinarySearchState {
  values: number[];
  low: number;
  high: number;
  mid: number | null;
  foundIndex: number | null;
}

const initialState = (input: BinarySearchInput): BinarySearchState => ({
  values: [...input.values],
  low: 0,
  high: input.values.length - 1,
  mid: null,
  foundIndex: null,
});

const event = (
  step: number,
  type: string,
  title: string,
  description: string,
  why: string,
  before: BinarySearchState,
  after: BinarySearchState,
  variables: Record<string, unknown>,
  comparisons = 1,
): ExecutionEvent => ({
  step,
  type,
  title,
  description,
  why,
  variables,
  stateBefore: before,
  stateAfter: after,
  visualization: {
    highlights: after.mid === null ? [] : [`index:${after.mid}`],
    mutations: [],
    annotations: [],
  },
  complexityImpact: { comparisons },
});

function validate(input: BinarySearchInput): void {
  if (!input || !Array.isArray(input.values) || typeof input.target !== "number") {
    throw new TypeError("Binary search requires numeric values and a numeric target");
  }
  if (input.values.some((value) => typeof value !== "number" || Number.isNaN(value))) {
    throw new TypeError("Binary search values must be numbers");
  }
  for (let index = 1; index < input.values.length; index += 1) {
    if (input.values[index]! < input.values[index - 1]!) {
      throw new RangeError("Binary search requires values sorted in ascending order");
    }
  }
}

function execute(input: BinarySearchInput): ExecutionTrace<BinarySearchState> {
  validate(input);
  const events: ExecutionEvent[] = [];
  let state = initialState(input);
  let low = state.low;
  let high = state.high;
  let step = 0;

  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2);
    const before = state;
    state = { ...state, low, high, mid };
    events.push(event(step++, "compare", "Compare midpoint", `Compare ${input.target} with values[${mid}]`, "The midpoint eliminates half of the remaining range.", before, state, { low, high, mid, value: input.values[mid], target: input.target }));

    if (input.values[mid] === input.target) {
      const found = { ...state, foundIndex: mid };
      events.push(event(step++, "found", "Target found", `Target ${input.target} is at index ${mid}`, "The midpoint equals the target.", state, found, { mid, target: input.target }, 0));
      state = found;
      break;
    }
    const next = input.values[mid]! < input.target
      ? { ...state, low: mid + 1, mid: null }
      : { ...state, high: mid - 1, mid: null };
    events.push(event(step++, "discard-range", "Discard half", "Narrow the search interval around the target", "The sorted order proves the discarded half cannot contain the target.", state, next, { low: next.low, high: next.high }, 0));
    state = next;
    low = state.low;
    high = state.high;
  }

  if (state.foundIndex === null) {
    const done = { ...state, mid: null };
    events.push(event(step, "not-found", "Target absent", `Target ${input.target} is not in the array`, "The search interval is empty, so every possible index was eliminated.", state, done, { low: state.low, high: state.high }, 0));
    state = done;
  }

  return {
    algorithmId: "search.binary",
    input: { values: [...input.values], target: input.target },
    initialState: initialState(input),
    events,
    finalState: state,
    finalResult: state.foundIndex,
    metadata: { startTime: 0, endTime: 0, totalSteps: events.length },
  };
}

const visualize = (_event: ExecutionEvent, state: BinarySearchState): VisualizationState => ({
  type: "array",
  data: state.values,
  highlights: state.mid === null ? [] : [`index:${state.mid}`],
  annotations: { low: String(state.low), high: String(state.high), foundIndex: String(state.foundIndex) },
});

const practice = (trace: ExecutionTrace<BinarySearchState>): PracticeQuestion[] => {
  const compare = trace.events.find((item) => item.type === "compare");
  return compare ? [{
    id: "binary-search-next-midpoint",
    type: "predict-next-operation",
    prompt: "Which index is compared next in the first binary-search step?",
    expectedAnswer: compare.variables.mid,
    explanation: "Binary search compares the middle index of the remaining sorted range.",
    difficulty: "easy",
    traceReference: { stepIndex: compare.step, eventType: compare.type },
  }] : [];
};

const tests: TestCase[] = [
  { id: "canonical", name: "find target", input: { values: [1, 3, 5, 7, 9], target: 7 }, expectedOutput: 3, category: "canonical" },
  { id: "empty", name: "empty array", input: { values: [], target: 1 }, expectedOutput: null, category: "empty" },
  { id: "duplicates", name: "duplicate values", input: { values: [2, 2, 2], target: 2 }, expectedOutput: 1, category: "duplicates" },
  { id: "invalid", name: "unsorted input", input: { values: [2, 1], target: 1 }, expectedOutput: "RangeError", category: "invalid" },
];

export const binarySearch: AlgorithmDefinition<BinarySearchInput, BinarySearchState> = {
  id: "search.binary",
  name: "Binary Search",
  category: "searching",
  difficulty: "easy",
  tags: ["array", "divide-and-conquer", "sorted"],
  prerequisites: ["arrays", "comparison operators"],
  concept: {
    definition: "Find a target in a sorted array by repeatedly halving the search range.",
    problem: "Return the index of target, or null when it is absent.",
    intuition: "Sorted order lets each midpoint comparison eliminate half the candidates.",
    whenToUse: ["The data is sorted and random access is available."],
    whenNotToUse: ["The data is unsorted or does not support indexed access."],
    preconditions: ["values are sorted in ascending order"],
    invariants: ["If the target exists, it remains within [low, high]."],
    correctness: "Each comparison discards only values proven smaller or larger than the target.",
    commonMistakes: ["Using binary search on unsorted input", "off-by-one range updates"],
    applications: ["index lookup", "threshold search", "answer-space search"],
    variants: ["lower bound", "upper bound", "rotated-array search"],
  },
  inputSchema: { values: "number[] sorted ascending", target: "number" },
  outputSchema: "number | null",
  implementations: { python: "", cpp: "", java: "", typescript: "" },
  execute,
  visualize,
  generatePractice: practice,
  complexity: { best: "O(1)", average: "O(log n)", worst: "O(log n)", space: "O(1)" },
  tests,
};
