import { deepEqual, stableStringify } from './format';
import { isInputRejected } from './errors';
import { ZERO_COUNTERS } from './trace';
import type {
  AlgorithmTestCase,
  AnyAlgorithmDefinition,
  CounterKey,
  ExecutionTrace,
  TestExpectation
} from './types';

/**
 * Testkit — the evidence layer.
 *
 * The vitest suite runs exactly these checks, so "tests passed" always means
 * *these* assertions were really executed:
 *  - trace hygiene (contiguous steps, real state chaining, real code lines);
 *  - determinism (same input + seed ⇒ identical trace);
 *  - per-test-case expectations (results, counters, event types, rejection).
 */

const BANNED_FILLER = ['continue', 'processing', 'next step', 'and so on'];

export interface TestCaseReport {
  testId: string;
  name: string;
  family: AlgorithmTestCase['family'];
  passed: boolean;
  failures: string[];
}

export interface TestSuiteReport {
  algorithmId: string;
  total: number;
  passed: number;
  failed: number;
  reports: TestCaseReport[];
  hygieneViolations: string[];
  determinismChecked: boolean;
  determinismPassed: boolean;
  durationMs: number;
}

/* ------------------------------- predicates -------------------------------- */

export function isSorted(values: readonly number[]): boolean {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] < values[i - 1]) return false;
  }
  return true;
}

export function isPermutationOf(values: readonly number[], original: readonly unknown[]): boolean {
  if (values.length !== original.length) return false;
  const counts = new Map<string, number>();
  for (const value of original) {
    const key = stableStringify(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const value of values) {
    const key = stableStringify(value);
    const remaining = counts.get(key);
    if (!remaining) return false;
    counts.set(key, remaining - 1);
  }
  return [...counts.values()].every((count) => count === 0);
}

/** Runs one declared test case and returns the concrete failures (empty = pass). */
export function runTestCase(
  definition: AnyAlgorithmDefinition,
  testCase: AlgorithmTestCase
): string[] {
  const failures: string[] = [];
  const run = definition.execute as (input: unknown) => ExecutionTrace<unknown, unknown>;
  let trace: ExecutionTrace<unknown, unknown> | undefined;
  let rejected = false;
  try {
    trace = run(testCase.input);
  } catch (error) {
    if (isInputRejected(error)) {
      rejected = true;
    } else {
      failures.push(`execution threw: ${(error as Error).message}`);
    }
  }
  const expectation: TestExpectation = testCase.expect;
  if (expectation.rejects) {
    if (!rejected) failures.push('expected the input to be rejected as invalid, but execution succeeded');
    return failures;
  }
  if (rejected) {
    failures.push('input was rejected although the test case declares it valid');
    return failures;
  }
  if (!trace) return failures;

  if ('result' in expectation && !deepEqual(trace.result, expectation.result)) {
    failures.push(
      `result mismatch: expected ${stableStringify(expectation.result)} but got ${stableStringify(trace.result)}`
    );
  }
  if (expectation.predicate) {
    const raw = trace.result;
    const subject =
      expectation.predicatePath && raw && typeof raw === 'object'
        ? (raw as Record<string, unknown>)[expectation.predicatePath]
        : raw;
    if (expectation.predicate === 'sorted' || expectation.predicate === 'non-decreasing') {
      if (!Array.isArray(subject) || !isSorted(subject as number[])) {
        failures.push(`expected a sorted result at "${expectation.predicatePath ?? '$'}", got ${stableStringify(subject)}`);
      }
    }
    if (expectation.predicate === 'permutation-of-input') {
      const original = (expectation.predicateArg ?? (testCase.input as { values?: unknown }).values) as unknown[];
      if (!Array.isArray(subject) || !isPermutationOf(subject as number[], original)) {
        failures.push(
          `result at "${expectation.predicatePath ?? '$'}" is not a permutation of the input values`
        );
      }
    }
  }
  if (expectation.eventTypes) {
    const seen = new Set(trace.events.map((event) => event.type));
    for (const type of expectation.eventTypes) {
      if (!seen.has(type)) failures.push(`expected an event of type "${type}" in the trace`);
    }
  }
  if (expectation.minEvents !== undefined && trace.events.length < expectation.minEvents) {
    failures.push(
      `expected at least ${expectation.minEvents} events, observed ${trace.events.length} (trace would be fabricated, not real)`
    );
  }
  if (expectation.maxEvents !== undefined && trace.events.length > expectation.maxEvents) {
    failures.push(
      `expected at most ${expectation.maxEvents} events, observed ${trace.events.length} (padding beyond the real execution)`
    );
  }
  if (expectation.counters) {
    for (const [key, bound] of Object.entries(expectation.counters)) {
      const observed = trace.counters[key as CounterKey] ?? 0;
      if (bound?.exact !== undefined && observed !== bound.exact) {
        failures.push(`counter ${key} = ${observed}, expected exactly ${bound.exact}`);
      }
      if (bound?.min !== undefined && observed < bound.min) {
        failures.push(`counter ${key} = ${observed}, expected at least ${bound.min}`);
      }
      if (bound?.max !== undefined && observed > bound.max) {
        failures.push(`counter ${key} = ${observed}, expected at most ${bound.max}`);
      }
    }
  }
  if (expectation.warnings) {
    for (const warning of expectation.warnings) {
      if (!trace.warnings.some((entry) => entry.includes(warning))) {
        failures.push(`expected a warning containing "${warning}"`);
      }
    }
  }
  return failures;
}

/* ------------------------------- trace hygiene ----------------------------- */

export function verifyTraceHygiene(
  definition: AnyAlgorithmDefinition,
  trace: ExecutionTrace<unknown, unknown>
): string[] {
  const violations: string[] = [];
  const { events } = trace;
  if (events.length === 0) {
    violations.push('trace contains no events — an algorithm must record its execution');
    return violations;
  }
  const codeLines = definition.implementations.typescript.replace(/\r\n/g, '\n').split('\n');
  if (trace.meta.eventCount !== events.length) {
    violations.push(`meta.eventCount (${trace.meta.eventCount}) ≠ recorded events (${events.length})`);
  }
  if (!deepEqual(trace.initial, events[0].stateBefore)) {
    violations.push('step 1 stateBefore does not equal trace.initial');
  }
  if (!deepEqual(trace.final, events[events.length - 1].stateAfter)) {
    violations.push('trace.final does not equal the last event stateAfter');
  }
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.step !== index + 1) {
      violations.push(`event ${index} has step ${event.step} — steps must be 1-based and contiguous`);
    }
    if (index > 0 && !deepEqual(event.stateBefore, events[index - 1].stateAfter)) {
      violations.push(`step ${event.step}: stateBefore ≠ previous stateAfter (broken state chain)`);
    }
    if (!event.title.trim() || !event.description.trim() || !event.why.trim()) {
      violations.push(`step ${event.step}: title/description/why must all be non-empty`);
    }
    const haystack = `${event.title} ${event.description}`.toLowerCase();
    for (const filler of BANNED_FILLER) {
      if (haystack.includes(filler)) {
        violations.push(`step ${event.step}: explanation uses generic filler "${filler}"`);
      }
    }
    if (event.codeReference) {
      const { lineStart, lineEnd, language } = event.codeReference;
      if (language !== 'typescript') {
        violations.push(`step ${event.step}: events must map to the executable TypeScript reference`);
      }
      if (lineStart < 1 || lineEnd > codeLines.length || lineStart > lineEnd) {
        violations.push(
          `step ${event.step}: code reference ${lineStart}-${lineEnd} is outside the reference implementation (${codeLines.length} lines)`
        );
      } else if (!codeLines.slice(lineStart - 1, lineEnd).some((line) => line.trim().length > 0)) {
        violations.push(`step ${event.step}: code reference ${lineStart}-${lineEnd} points at blank lines`);
      }
    }
    if (event.visualization.highlights.length === 0 && event.visualization.mutations.length === 0) {
      const pureBookkeeping = ['init', 'done', 'validate', 'return'];
      if (!pureBookkeeping.includes(event.type)) {
        violations.push(
          `step ${event.step} ("${event.title}"): no highlight or mutation — the visual layer would not react`
        );
      }
    }
  }
  const expected: Record<string, number> = { ...ZERO_COUNTERS };
  for (const event of events) {
    if (!event.complexityImpact) continue;
    for (const [key, amount] of Object.entries(event.complexityImpact) as [
      string,
      number | undefined
    ][]) {
      expected[key] = (expected[key] ?? 0) + (amount ?? 0);
    }
  }
  for (const key of Object.keys(expected) as CounterKey[]) {
    if ((trace.counters[key] ?? 0) !== expected[key]) {
      violations.push(
        `counter "${key}" is ${trace.counters[key]} but per-event impacts sum to ${expected[key]}`
      );
    }
  }
  const roundTripped = JSON.parse(JSON.stringify(trace)) as ExecutionTrace<unknown, unknown>;
  if (!deepEqual(roundTripped, trace)) {
    violations.push('trace is not JSON serialisable — replay and diffing would break');
  }
  return violations;
}

/* ------------------------------- determinism ------------------------------- */

export function checkDeterminism(
  definition: AnyAlgorithmDefinition,
  input: unknown,
  seed?: number
): { passed: boolean; detail: string } {
  const run = definition.execute as (
    value: unknown,
    options?: { seed?: number }
  ) => ExecutionTrace<unknown, unknown>;
  const options = seed === undefined ? undefined : { seed };
  const first = run(input, options);
  const second = run(input, options);
  const print = (trace: ExecutionTrace<unknown, unknown>): string =>
    stableStringify({ events: trace.events, result: trace.result, counters: trace.counters });
  if (print(first) !== print(second)) {
    return {
      passed: false,
      detail: `two runs with the same input${
        seed === undefined ? '' : ` and seed ${seed}`
      } produced different traces`
    };
  }
  return { passed: true, detail: `identical trace over ${first.events.length} events` };
}

/* --------------------------------- suites ---------------------------------- */

export function runDeclaredTests(definition: AnyAlgorithmDefinition): TestSuiteReport {
  const started = Date.now();
  const reports: TestCaseReport[] = [];
  const hygieneViolations: string[] = [];
  let determinismChecked = false;
  let determinismPassed = false;

  for (const testCase of definition.tests) {
    const failures = runTestCase(definition, testCase);
    if (!testCase.expect.rejects) {
      try {
        const trace = (definition.execute as (input: unknown) => ExecutionTrace<unknown, unknown>)(
          testCase.input
        );
        const violations = verifyTraceHygiene(definition, trace);
        for (const violation of violations) {
          failures.push(`hygiene: ${violation}`);
          hygieneViolations.push(`${testCase.id}: ${violation}`);
        }
      } catch {
        // Rejection paths are handled by runTestCase; nothing else to add here.
      }
    }
    reports.push({
      testId: testCase.id,
      name: testCase.name,
      family: testCase.family,
      passed: failures.length === 0,
      failures
    });
  }

  const determinismCase = definition.tests[0];
  if (determinismCase) {
    determinismChecked = true;
    const check = checkDeterminism(definition, determinismCase.input);
    determinismPassed = check.passed;
    if (!check.passed) {
      reports.push({
        testId: `${determinismCase.id}-determinism`,
        name: `${determinismCase.name} (deterministic replay)`,
        family: 'determinism',
        passed: false,
        failures: [check.detail]
      });
    }
  }

  const passed = reports.filter((report) => report.passed).length;
  return {
    algorithmId: definition.id,
    total: reports.length,
    passed,
    failed: reports.length - passed,
    reports,
    hygieneViolations,
    determinismChecked,
    determinismPassed,
    durationMs: Date.now() - started
  };
}


