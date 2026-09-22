import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Scaffolds a contract-complete algorithm file:
 *   npm run scaffold -- <category> <name>
 *   npm run scaffold -- sorting merge-sort
 *
 * The generated file compiles immediately and satisfies the registry contract
 * (input schema, four language listings, a traced execution with real anchors,
 * all required test families) using placeholder *echo* semantics, so
 * `npm run verify` stays green while you replace the TODOs. Registration in
 * src/algorithms/index.ts is left to you — the scaffold never edits other files.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseCategoryIds() {
  const source = readFileSync(path.join(root, 'src/core/categories.ts'), 'utf8');
  return [...source.matchAll(/id:\s*'([a-z0-9-]+)'/g)].map((match) => match[1]);
}

function kebab(value) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function walk(directory, out = []) {
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const [category, ...nameParts] = process.argv.slice(2);
const categories = parseCategoryIds();
if (!category || nameParts.length === 0) {
  console.error('usage: npm run scaffold -- <category> <name>');
  console.error(`known categories: ${categories.join(', ')}`);
  process.exit(1);
}
if (!categories.includes(category)) {
  console.error(`unknown category "${category}". known: ${categories.join(', ')}`);
  process.exit(1);
}

const algorithmId = kebab(nameParts.join(' '));
const words = algorithmId.split('-');
const pascal = words.map((part) => part[0].toUpperCase() + part.slice(1)).join('');
const camel = words.map((part, index) => (index === 0 ? part : part[0].toUpperCase() + part.slice(1))).join('');
const display = words.map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');

const algorithmsDir = path.join(root, 'src/algorithms');
for (const file of walk(algorithmsDir)) {
  const source = readFileSync(file, 'utf8');
  if (source.includes(`'${algorithmId}'`)) {
    console.error(`id "${algorithmId}" already exists in ${path.relative(root, file)}`);
    process.exit(1);
  }
}
const targetDir = path.join(algorithmsDir, category);
const target = path.join(targetDir, `${algorithmId}.ts`);
if (existsSync(target)) {
  console.error(`${path.relative(root, target)} already exists`);
  process.exit(1);
}
mkdirSync(targetDir, { recursive: true });

const partA = `import { defineAlgorithm } from '../../core/define';
import { requireValidInput } from '../../core/errors';
import { TraceBuilder } from '../../core/trace';
import { buildArray } from '../../visualization/builders';
import type {
  AlgorithmTestCase,
  ExecutionEvent,
  ExecutionTrace,
  VisualizationState
} from '../../core/types';

/**
 * ${display} — Atlas §${category} (scaffolded).
 *
 * TODO(author): the scaffold ships *echo* semantics (returns a copy of the
 * input) so the registry contract passes from day one. Replace execute() with
 * the real algorithm and record one event per semantic transition — every
 * anchor must be a unique line inside TYPESCRIPT_IMPLEMENTATION — then expand
 * the concept doc, complexity and tests before registering this file in
 * src/algorithms/index.ts.
 */

const ALGORITHM_ID = '${algorithmId}';

const TYPESCRIPT_IMPLEMENTATION = \`export function ${camel}(values: number[]): number[] {
  const output = [...values];
  return output;
}\`;

const PYTHON_IMPLEMENTATION = \`def ${words.join('_')}(values: list[int]) -> list[int]:
    return list(values)\`;

const CPP_IMPLEMENTATION = \`std::vector<int> ${camel}(const std::vector<int>& values) {
    return values;
}\`;

const JAVA_IMPLEMENTATION = \`public static int[] ${camel}(int[] values) {
    return values.clone();
}\`;

export interface ${pascal}Input {
  values: number[];
}

export interface ${pascal}Result {
  output: number[];
}

interface ${pascal}State {
  values: number[];
  phase: 'init' | 'done';
}

const INPUT_SCHEMA = {
  summary: 'One integer array; the scaffold echoes it back unchanged.',
  fields: [
    {
      kind: 'int-array' as const,
      name: 'values',
      label: 'Values',
      help: 'Comma separated integers (duplicates and negatives allowed).',
      min: -999,
      max: 999,
      maxLength: 40,
      allowEmpty: true,
      default: [3, 1, 2]
    }
  ],
  examples: [
    { label: 'Small', value: { values: [3, 1, 2] } },
    { label: 'Empty', value: { values: [] } },
    { label: 'Singleton', value: { values: [7] } }
  ]
};
`;
const partB = `
const TESTS: AlgorithmTestCase[] = [
  {
    id: '${algorithmId}-canonical',
    name: 'echoes a three-element array',
    family: 'canonical',
    input: { values: [3, 1, 2] },
    expect: { result: { output: [3, 1, 2] }, eventTypes: ['init', 'done'], minEvents: 2 }
  },
  {
    id: '${algorithmId}-invalid',
    name: 'rejects a non-array value',
    family: 'invalid',
    input: { values: 'not-an-array' },
    expect: { rejects: true }
  },
  {
    id: '${algorithmId}-empty',
    name: 'handles the empty array',
    family: 'empty',
    input: { values: [] },
    expect: { result: { output: [] } }
  },
  {
    id: '${algorithmId}-singleton',
    name: 'handles a single element',
    family: 'singleton',
    input: { values: [7] },
    expect: { result: { output: [7] } }
  },
  {
    id: '${algorithmId}-trace-property',
    name: 'records an init and a done event',
    family: 'trace-property',
    input: { values: [2, 1] },
    expect: { result: { output: [2, 1] }, eventTypes: ['init', 'done'], minEvents: 2 },
    note: 'Guards against fabricated or missing visual steps.'
  }
];

function initialState(values: number[]): ${pascal}State {
  return { values: [...values], phase: 'init' };
}

function execute(
  input: ${pascal}Input,
  options?: { maxEvents?: number }
): ExecutionTrace<${pascal}State, ${pascal}Result> {
  const valid = requireValidInput<${pascal}Input>(ALGORITHM_ID, INPUT_SCHEMA, input);
  const n = valid.values.length;
  const state = initialState(valid.values);
  const trace = new TraceBuilder<${pascal}State, ${pascal}Result>({
    algorithmId: ALGORITHM_ID,
    algorithmName: '${display}',
    input: valid,
    initial: state,
    code: TYPESCRIPT_IMPLEMENTATION,
    determinism: 'deterministic',
    ...(options?.maxEvents !== undefined ? { maxEvents: options.maxEvents } : {})
  });

  trace.record({
    type: 'init',
    title: 'Copy the input into a working array',
    description:
      'Working copy output = [' + valid.values.join(', ') + '] with n = ' + n + '. No element has been processed yet.',
    why: 'The reference implementation copies the caller input first so the operation stays pure and the trace can compare before/after states.',
    invariant: 'output is a permutation of the input values',
    anchor: 'const output = [...values];',
    variables: { n, output: [...valid.values] },
    stateAfter: { ...state, values: [...valid.values] },
    highlights: valid.values.map((_, index) => 'cell:' + index),
    impact: { reads: n, assignments: n }
  });

  // TODO(author): replace the echo body with the real algorithm, recording one
  // event per semantic transition (description, why and a unique anchor each).
  const output = [...valid.values];
  state.values = [...output];
  state.phase = 'done';

  trace.record({
    type: 'done',
    title: 'Echo complete: output equals the input',
    description:
      'The scaffolded body returned [' +
      output.join(', ') +
      '] unchanged — replace this step with the real per-step events.',
    why: 'Placeholder semantics: copying the input satisfies the trace contract while the real algorithm is being written.',
    invariant: 'output holds exactly the input multiset',
    anchor: 'return output;',
    variables: { output: [...output] },
    stateAfter: { ...state, values: [...output] },
    highlights: output.map((_, index) => 'cell:' + index)
  });

  const result: ${pascal}Result = { output: [...output] };
  return trace.finish(result, {
    summary: [
      'Output: [' + output.join(', ') + ']',
      'events: ' + trace.stepCount + ' (placeholder echo semantics)'
    ]
  });
}

function visualize(
  event: ExecutionEvent<${pascal}State>,
  state: ${pascal}State
): VisualizationState {
  return buildArray({
    values: state.values,
    caption: event.title,
    stateFor: (index) =>
      state.phase === 'done'
        ? 'sorted'
        : event.visualization.highlights.includes('cell:' + index)
          ? 'compare'
          : 'idle'
  });
}

export const ${camel} = defineAlgorithm<${pascal}Input, ${pascal}State, ${pascal}Result>({
  id: ALGORITHM_ID,
  name: '${display}',
  category: '${category}',
  subcategory: '${category} (scaffolded)',
  difficulty: 'easy',
  tags: ['${category}', 'scaffold', 'introduction'],
  prerequisites: ['arrays', 'loops'],
  related: ['${algorithmId}-variant'],

  concept: {
    definition:
      'TODO — one precise paragraph describing exactly what ${display} does to its input, verifiable against the reference implementation above.',
    problem:
      'TODO — the problem statement: given the validated input defined by INPUT_SCHEMA, produce the documented output contract.',
    intuition:
      'TODO — the mental model that makes the algorithm obvious before reading a single line of code.',
    motivation:
      'TODO — why this algorithm exists and which constraint or resource it optimises for.',
    whenToUse: ['TODO: a concrete situation where this is the right tool.'],
    whenNotToUse: ['TODO: where this is the wrong tool, and what to prefer instead.'],
    preconditions: ['TODO: what must hold about the input before the algorithm is meaningful.'],
    invariants: ['TODO: the property that holds before and after every recorded step.'],
    correctness:
      'TODO — a real argument: termination plus partial correctness tied to the invariant above, in several sentences.',
    commonMistakes: ['TODO: the classic off-by-one, wrong-base-case or missing-update bug.'],
    applications: ['TODO: where this shows up in real systems.'],
    variants: ['TODO: the variants worth comparing against.']
  },

  visualModel: 'Indexed value cells whose marks come from each event highlights list.',
  visualNotes:
    'Cells light up exactly for the element ids the trace highlights; after the final step every cell is marked final.',

  inputSchema: INPUT_SCHEMA,
  outputSchema: '{ output: number[] }',

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
    average: 'O(n)',
    worst: 'O(n)',
    space: 'O(1) auxiliary',
    notes:
      'Placeholder bounds for the echo scaffold: it reads the input once and returns a copy. Replace with a real analysis (including what drives best vs worst) when you implement the algorithm.'
  },

  tests: TESTS
});
`;
const template = partA + partB;

writeFileSync(target, `${template}\n`, 'utf8');
console.log(`created ${path.relative(root, target)}`);
console.log('next steps:');
console.log('  1. replace the TODO echo semantics with the real algorithm');
console.log('  2. register it in src/algorithms/index.ts (export + ALGORITHMS entry)');
console.log('  3. npm run verify && npm run atlas');