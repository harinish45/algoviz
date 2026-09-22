import { SeededRandom } from './rng';
import { formatValue, stableStringify } from './format';
import type {
  AnyAlgorithmDefinition,
  ExecutionTrace,
  PracticeGrade,
  PracticeQuestion,
  PracticeResponse
} from './types';

/**
 * Practice & Assessment engine.
 *
 * Questions are generated from the *same* execution trace and algorithm state
 * model the visualiser uses — never from hand-written filler. For a fixed
 * (input, seed) pair the engine emits the same questions in the same order,
 * which makes practice replayable and testable.
 */

/** Optional complexity strings used as plausible distractors. */
const COMPLEXITY_POOL = [
  'O(1)',
  'O(log n)',
  'O(n)',
  'O(n log n)',
  'O(n^2)',
  'O(n^3)',
  'O(2^n)'
];

function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function joinOr(items: string[], fallback: string): string {
  return items.length > 0 ? items.join(' ') : fallback;
}

/** Deterministically orders choices and records where the answer landed. */
function finalise(
  question: Omit<PracticeQuestion, 'choices' | 'answerIndex' | 'answer'> & {
    choices: string[];
    correctChoice: string;
  },
  rng: SeededRandom
): PracticeQuestion {
  const uniqueChoices = [...new Set(question.choices)];
  const shuffled = rng.shuffle(uniqueChoices);
  const answerIndex = shuffled.indexOf(question.correctChoice);
  if (answerIndex < 0) {
    throw new Error(
      `practice engine: correct choice "${question.correctChoice}" was dropped while de-duplicating options`
    );
  }
  return {
    id: question.id,
    algorithmId: question.algorithmId,
    kind: question.kind,
    difficulty: question.difficulty,
    prompt: question.prompt,
    choices: shuffled,
    answerIndex,
    answer: question.correctChoice,
    explanation: question.explanation,
    eventSteps: question.eventSteps
  };
}

/* -------------------------------------------------------------------------- */
/* Question generators                                                        */
/* -------------------------------------------------------------------------- */

/** Picks a step in the "interesting" middle of the trace, if one exists. */
function pickStep(trace: ExecutionTrace<unknown, unknown>, rng: SeededRandom): number {
  const count = trace.events.length;
  if (count === 0) return 0;
  const start = Math.max(0, Math.floor(count * 0.2));
  const end = Math.max(start, Math.floor(count * 0.8) - 1);
  return rng.int(start, end);
}

function nextOperationQuestion(
  definition: AnyAlgorithmDefinition,
  trace: ExecutionTrace<unknown, unknown>,
  rng: SeededRandom
): PracticeQuestion | null {
  if (trace.events.length < 3) return null;
  const index = pickStep(trace, rng);
  const current = trace.events[index];
  const next = trace.events[index + 1];
  if (!next) return null;
  const otherTitles = trace.events
    .filter((event) => event.title !== next.title)
    .map((event) => event.title);
  const distractors = rng.shuffle([...new Set(otherTitles)]).slice(0, 3);
  const choices = [next.title, ...distractors];
  if (choices.length < 2) return null;
  return finalise(
    {
      id: `${definition.id}-predict-next-${next.step}`,
      algorithmId: definition.id,
      kind: 'predict-next',
      difficulty: 'easy',
      prompt: `After step ${current.step} ("${current.title}") the state is \`${formatValue(
        current.stateAfter,
        90
      )}\`. Which operation happens next?`,
      choices,
      correctChoice: next.title,
      explanation: `Step ${next.step} executes "${next.title}": ${next.description} Reason: ${next.why}`,
      eventSteps: [current.step, next.step]
    },
    rng
  );
}

function predictStateQuestion(
  definition: AnyAlgorithmDefinition,
  trace: ExecutionTrace<unknown, unknown>,
  rng: SeededRandom
): PracticeQuestion | null {
  if (trace.events.length < 4) return null;
  const index = pickStep(trace, rng);
  const event = trace.events[index];
  const correct = formatValue(event.stateAfter, 110);
  const alternatives = trace.events
    .filter((candidate) => candidate.step !== event.step)
    .map((candidate) => formatValue(candidate.stateAfter, 110));
  const distractors = rng.shuffle([...new Set(alternatives.filter((text) => text !== correct))]).slice(0, 3);
  if (distractors.length < 2) return null;
  return finalise(
    {
      id: `${definition.id}-predict-state-${event.step}`,
      algorithmId: definition.id,
      kind: 'predict-state',
      difficulty: 'medium',
      prompt: `Before step ${event.step} the state is \`${formatValue(
        event.stateBefore,
        110
      )}\`. Step ${event.step} performs "${event.title}". What is the state immediately after that step?`,
      choices: [correct, ...distractors],
      correctChoice: correct,
      explanation: `Step ${event.step} ("${event.title}") produces ${correct}. ${event.description}`,
      eventSteps: [event.step]
    },
    rng
  );
}

function traceVariableQuestion(
  definition: AnyAlgorithmDefinition,
  trace: ExecutionTrace<unknown, unknown>,
  rng: SeededRandom
): PracticeQuestion | null {
  const candidates = trace.events.filter((event) => Object.keys(event.variables).length > 0);
  if (candidates.length < 4) return null;
  const event = candidates[rng.int(0, candidates.length - 1)];
  const names = Object.keys(event.variables);
  const name = names[rng.int(0, names.length - 1)];
  const correct = formatValue(event.variables[name], 60);
  const alternatives = candidates
    .filter((candidate) => candidate.step !== event.step)
    .map((candidate) => candidate.variables[name])
    .filter((value) => value !== undefined)
    .map((value) => formatValue(value, 60));
  const distractors = rng.shuffle([...new Set(alternatives.filter((text) => text !== correct))]).slice(0, 3);
  if (distractors.length < 2) return null;
  return finalise(
    {
      id: `${definition.id}-trace-variable-${event.step}-${name}`,
      algorithmId: definition.id,
      kind: 'trace-variable',
      difficulty: 'medium',
      prompt: `At step ${event.step} ("${event.title}"), what is the value of the variable \`${name}\`?`,
      choices: [correct, ...distractors],
      correctChoice: correct,
      explanation: `The reference implementation reports \`${name} = ${correct}\` at step ${event.step}.`,
      eventSteps: [event.step]
    },
    rng
  );
}

function invariantQuestion(
  definition: AnyAlgorithmDefinition,
  trace: ExecutionTrace<unknown, unknown>,
  rng: SeededRandom
): PracticeQuestion | null {
  const withInvariant = trace.events.filter((event) => Boolean(event.invariant));
  const correct =
    withInvariant.length > 0
      ? withInvariant[rng.int(0, withInvariant.length - 1)].invariant!
      : definition.concept.invariants[0];
  if (!correct) return null;
  const pool = [
    ...definition.concept.commonMistakes,
    ...definition.concept.whenNotToUse,
    ...withInvariant.map((event) => event.invariant!).filter((text) => text !== correct)
  ];
  const distractors = rng.shuffle([...new Set(pool.filter((text) => text !== correct))]).slice(0, 3);
  if (distractors.length < 2) return null;
  return finalise(
    {
      id: `${definition.id}-invariant`,
      algorithmId: definition.id,
      kind: 'invariant',
      difficulty: 'medium',
      prompt: `Which of these statements is an invariant that genuinely holds throughout ${definition.name}?`,
      choices: [correct, ...distractors],
      correctChoice: correct,
      explanation: `"${correct}" is maintained by the algorithm itself and is reported on the events that touch it. The other statements describe mistakes or cases where the approach does not apply.`,
      eventSteps: withInvariant.map((event) => event.step).slice(0, 3)
    },
    rng
  );
}

function complexityQuestion(
  definition: AnyAlgorithmDefinition,
  rng: SeededRandom
): PracticeQuestion {
  const { best, average, worst, space } = definition.complexity;
  const correct = `worst ${worst} · average ${average} · space ${space}`;
  const wrongPools = [
    `worst ${best} · average ${best} · space O(1)`,
    `worst ${average} · average ${worst} · space ${space}`,
    `worst O(n^3) · average O(n^2) · space O(n^2)`
  ];
  const candidates = COMPLEXITY_POOL.filter((entry) => entry !== worst && entry !== average);
  wrongPools.push(`worst ${candidates[0]} · average ${candidates[1] ?? candidates[0]} · space ${space}`);
  const distractors = rng.shuffle([...new Set(wrongPools.filter((text) => text !== correct))]).slice(0, 3);
  return finalise(
    {
      id: `${definition.id}-complexity`,
      algorithmId: definition.id,
      kind: 'complexity',
      difficulty: 'easy',
      prompt: `Which complexity profile is declared by the reference implementation of ${definition.name}?`,
      choices: [correct, ...distractors],
      correctChoice: correct,
      explanation: `Declared profile of the implementation shown in the Code tab — ${joinOr(
        [definition.complexity.notes ?? ''],
        'no extra notes'
      )}`,
      eventSteps: []
    },
    rng
  );
}

function completeCodeQuestion(
  definition: AnyAlgorithmDefinition,
  rng: SeededRandom
): PracticeQuestion | null {
  const source = definition.implementations.typescript;
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const candidates = lines
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(({ text }) => {
      const trimmed = text.trim();
      return (
        trimmed.length >= 12 &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('/*') &&
        !trimmed.startsWith('import ') &&
        !trimmed.startsWith('export ')
      );
    });
  if (candidates.length < 6) return null;
  const picked = candidates[rng.int(Math.floor(candidates.length * 0.3), candidates.length - 1)];
  const distractors = rng
    .shuffle(candidates.filter((candidate) => candidate.line !== picked.line))
    .slice(0, 3)
    .map((candidate) => candidate.text.trim());
  const correct = picked.text.trim();
  const pool = [...new Set([correct, ...distractors])];
  if (pool.length < 3) return null;
  return finalise(
    {
      id: `${definition.id}-complete-code-${picked.line}`,
      algorithmId: definition.id,
      kind: 'complete-code',
      difficulty: 'hard',
      prompt: `Line ${picked.line} was deleted from the reference implementation of ${definition.name}. Which line completes the code at that position?`,
      choices: pool,
      correctChoice: correct,
      explanation: `The reference implementation of ${definition.name} has \`${correct}\` on line ${picked.line} — deleting it changes the execution trace.`,
      eventSteps: []
    },
    rng
  );
}

function debugQuestion(
  definition: AnyAlgorithmDefinition,
  rng: SeededRandom
): PracticeQuestion | null {
  const source = definition.implementations.typescript;
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const mutables = lines
    .map((text, index) => ({ text: text.trim(), line: index + 1 }))
    .filter(({ text }) => /(<=|>=|<|>)/.test(text) && !text.startsWith('//'));
  const mistakes = definition.concept.commonMistakes;
  if (mutables.length === 0 || mistakes.length === 0) return null;
  const target = mutables[rng.int(0, mutables.length - 1)];
  const mutated = target.text.replace(/<=/, '<').replace(/>=/, '>').replace(/</, '<=').replace(/>/, '>=');
  if (mutated === target.text) return null;
  const correct = mistakes[rng.int(0, mistakes.length - 1)];
  const distractors = rng
    .shuffle([
      ...definition.concept.invariants,
      ...definition.concept.whenToUse
    ].filter((text) => text !== correct))
    .slice(0, 3);
  if (distractors.length < 2) return null;
  return finalise(
    {
      id: `${definition.id}-debug-${target.line}`,
      algorithmId: definition.id,
      kind: 'debug',
      difficulty: 'hard',
      prompt: `A learner changed line ${target.line} of ${definition.name} from \`${target.text}\` to \`${mutated}\`. Which mistake is being made?`,
      choices: [correct, ...distractors],
      correctChoice: correct,
      explanation: `The boundary change on line ${target.line} (\`${target.text}\` → \`${mutated}\`) makes the loop/strictness behave differently: ${correct}`,
      eventSteps: []
    },
    rng
  );
}

function edgeCaseQuestion(
  definition: AnyAlgorithmDefinition,
  rng: SeededRandom
): PracticeQuestion | null {
  const families = ['empty', 'singleton', 'duplicates', 'adversarial', 'already-solved'];
  const candidates = definition.tests.filter((test) => families.includes(test.family) && !test.expect.rejects);
  if (candidates.length < 3) return null;
  const shuffled = rng.shuffle([...candidates]);
  const outcomes: { label: string; rendered: string }[] = [];
  const run = definition.execute as (input: unknown) => ExecutionTrace<unknown, unknown>;
  for (const test of shuffled) {
    try {
      const trace = run(test.input);
      outcomes.push({ label: test.name, rendered: formatValue(trace.result, 80) });
    } catch {
      // Invalid or unsupported edge input: not a usable practice anchor.
    }
    if (outcomes.length >= 4) break;
  }
  if (outcomes.length < 3) return null;
  const correct = outcomes[0].rendered;
  const unique = [...new Set([correct, ...outcomes.slice(1).map((outcome) => outcome.rendered)])];
  if (unique.length < 3) return null;
  return finalise(
    {
      id: `${definition.id}-edge-case-${shuffled[0].id}`,
      algorithmId: definition.id,
      kind: 'edge-case',
      difficulty: 'medium',
      prompt: `Running ${definition.name} on the edge case "${shuffled[0].name}" with input \`${formatValue(
        shuffled[0].input,
        90
      )}\` returns which result?`,
      choices: unique,
      correctChoice: correct,
      explanation: `Executed live on that input: ${correct}. ${
        shuffled[0].note ?? 'The edge case is handled explicitly by the reference implementation.'
      }`,
      eventSteps: []
    },
    rng
  );
}

function correctnessQuestion(
  definition: AnyAlgorithmDefinition,
  rng: SeededRandom
): PracticeQuestion | null {
  const correct = definition.concept.correctness;
  const pool = [
    ...definition.concept.commonMistakes,
    ...definition.concept.whenNotToUse,
    ...definition.concept.preconditions
  ].filter((text) => text !== correct);
  const distractors = rng.shuffle([...new Set(pool)]).slice(0, 3);
  if (distractors.length < 2) return null;
  return finalise(
    {
      id: `${definition.id}-correctness`,
      algorithmId: definition.id,
      kind: 'correctness',
      difficulty: 'medium',
      prompt: `Why is the result produced by ${definition.name} guaranteed to be correct?`,
      choices: [correct, ...distractors],
      correctChoice: correct,
      explanation: definition.concept.correctness,
      eventSteps: []
    },
    rng
  );
}

export const PRACTICE_KIND_LABELS: Record<PracticeQuestion['kind'], string> = {
  'predict-next': 'Predict the next operation',
  'predict-state': 'Predict the next state',
  'trace-variable': 'Trace a variable',
  invariant: 'Identify the invariant',
  complexity: 'Identify the complexity',
  'complete-code': 'Complete the missing code',
  debug: 'Debug a broken implementation',
  'edge-case': 'Handle an edge case',
  correctness: 'Explain why the result is correct'
};

/**
 * Builds the full practice set for an algorithm from its own trace.
 * Every family from the atlas practice contract is attempted; a family is
 * skipped (never faked) when the concrete trace does not contain enough
 * evidence to ground a question.
 */
export function buildPracticeQuestions(
  definition: AnyAlgorithmDefinition,
  trace: ExecutionTrace<unknown, unknown>,
  seed?: number
): PracticeQuestion[] {
  const rng = new SeededRandom(seed ?? hashString(`${definition.id}|${traceFingerprint(trace)}`));
  const questions: PracticeQuestion[] = [];
  const push = (question: PracticeQuestion | null): void => {
    if (question) questions.push(question);
  };
  push(nextOperationQuestion(definition, trace, rng));
  push(predictStateQuestion(definition, trace, rng));
  push(traceVariableQuestion(definition, trace, rng));
  push(invariantQuestion(definition, trace, rng));
  push(complexityQuestion(definition, rng));
  push(completeCodeQuestion(definition, rng));
  push(debugQuestion(definition, rng));
  push(edgeCaseQuestion(definition, rng));
  push(correctnessQuestion(definition, rng));
  if (definition.practiceExtras) {
    for (const extra of definition.practiceExtras(trace as never)) {
      questions.push(extra);
    }
  }
  const seen = new Set<string>();
  const unique: PracticeQuestion[] = [];
  for (const question of questions) {
    if (seen.has(question.id)) continue;
    seen.add(question.id);
    unique.push(question);
  }
  return unique;
}

/** Grades a practice response against the canonical answer. */
export function gradeAnswer(question: PracticeQuestion, response: PracticeResponse): PracticeGrade {
  if (question.choices && question.answerIndex !== undefined) {
    const expected = question.answer ?? question.choices[question.answerIndex];
    const receivedIndex = response.choiceIndex;
    const received =
      receivedIndex !== undefined && receivedIndex >= 0 && receivedIndex < question.choices.length
        ? question.choices[receivedIndex]
        : '(no answer)';
    return {
      correct: receivedIndex === question.answerIndex,
      expected,
      received,
      explanation: question.explanation
    };
  }
  const expected = question.answer ?? '';
  const received = (response.text ?? '').trim();
  const normalise = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').trim();
  const receivedNumber = Number.parseFloat(received);
  const expectedNumber = Number.parseFloat(expected);
  const correct =
    normalise(received) === normalise(expected) ||
    (!Number.isNaN(receivedNumber) && !Number.isNaN(expectedNumber) && receivedNumber === expectedNumber);
  return { correct, expected, received: received || '(no answer)', explanation: question.explanation };
}

/** Deterministic fingerprint of a trace, used to seed practice generation. */
export function traceFingerprint(trace: ExecutionTrace<unknown, unknown>): string {
  return stableStringify({
    algorithmId: trace.algorithmId,
    input: trace.input,
    final: trace.final,
    result: trace.result,
    steps: trace.events.length,
    counters: trace.counters
  });
}




