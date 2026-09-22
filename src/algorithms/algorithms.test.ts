import { describe, expect, it } from 'vitest';
import { ALGORITHMS } from './index';
import { checkDeterminism, runDeclaredTests, verifyTraceHygiene } from '../core/testkit';
import { buildPracticeQuestions, gradeAnswer, PRACTICE_KIND_LABELS } from '../core/practice';
import { validateRegistry } from '../core/registry';
import type { AnyAlgorithmDefinition, ExecutionTrace } from '../core/types';

/**
 * Contract suite for every registered algorithm.
 * These assertions run against the real implementations and real traces, so the
 * in-app Test panel and CI cannot disagree about what "tested" means.
 */

describe('registry contract', () => {
  it('exposes at least one algorithm', () => {
    expect(ALGORITHMS.length).toBeGreaterThan(0);
  });

  it('passes structural validation', () => {
    expect(validateRegistry(ALGORITHMS)).toEqual([]);
  });

  it('has unique ids', () => {
    const ids = ALGORITHMS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe.each(ALGORITHMS.map((definition) => [definition.id, definition] as const))(
  'algorithm %s',
  (_id: string, definition: AnyAlgorithmDefinition) => {
    const run = definition.execute as (input: unknown) => ExecutionTrace<unknown, unknown>;
    const canonical = definition.tests.find((test) => test.family === 'canonical');
    const canonicalInput = canonical?.input ?? definition.inputSchema.examples[0]?.value;

    it('declares code in all four reference languages', () => {
      for (const language of ['typescript', 'python', 'cpp', 'java'] as const) {
        expect(definition.implementations[language]?.length ?? 0).toBeGreaterThan(20);
      }
    });

    it('passes every declared test case', () => {
      const report = runDeclaredTests(definition);
      const failures = report.reports.filter((entry) => !entry.passed);
      expect(failures.map((entry) => `${entry.testId}: ${entry.failures.join(' | ')}`)).toEqual([]);
      expect(report.failed).toBe(0);
      expect(report.determinismChecked).toBe(true);
      expect(report.determinismPassed).toBe(true);
    });

    it('produces a hygienic trace for the canonical input', () => {
      const trace = run(canonicalInput);
      expect(verifyTraceHygiene(definition, trace)).toEqual([]);
      expect(trace.meta.ok).toBe(true);
      expect(trace.events.length).toBeGreaterThan(1);
    });

    it('maps every event to a real line of the reference implementation', () => {
      const trace = run(canonicalInput);
      const lines = definition.implementations.typescript.replace(/\r\n/g, '\n').split('\n');
      const mapped = trace.events.filter((event) => event.codeReference);
      expect(mapped.length).toBeGreaterThan(0);
      for (const event of mapped) {
        const { lineStart, lineEnd, language } = event.codeReference!;
        expect(language).toBe('typescript');
        expect(lineStart).toBeGreaterThanOrEqual(1);
        expect(lineEnd).toBeLessThanOrEqual(lines.length);
        expect(lines.slice(lineStart - 1, lineEnd).join('\n').trim().length).toBeGreaterThan(0);
      }
    });

    it('replays deterministically', () => {
      const result = checkDeterminism(definition, canonicalInput);
      expect(result.detail).toBeTruthy();
      expect(result.passed).toBe(true);
    });

    it('visualises every event into a serialisable state', () => {
      const trace = run(canonicalInput);
      for (const event of trace.events) {
        const visual = definition.visualize(event, event.stateAfter);
        expect(visual.kind).toBeTruthy();
        expect(visual.caption.length).toBeGreaterThan(0);
        expect(JSON.parse(JSON.stringify(visual))).toEqual(visual);
      }
    });

    it('reacts visually to every non-bookkeeping event', () => {
      const trace = run(canonicalInput);
      for (const event of trace.events) {
        if (['init', 'validate', 'done', 'return'].includes(event.type)) continue;
        const visual = definition.visualize(event, event.stateAfter);
        expect(
          event.visualization.highlights.length > 0 || event.visualization.mutations.length > 0
        ).toBe(true);
        expect(JSON.stringify(visual).length).toBeGreaterThan(20);
      }
    });

    it('rejects invalid input with a reason', () => {
      const invalid = definition.tests.filter((test) => test.expect.rejects);
      expect(invalid.length).toBeGreaterThan(0);
      for (const test of invalid) {
        expect(() => run(test.input)).toThrowError(/input rejected by/);
      }
    });

    it('generates grounded practice questions', () => {
      const trace = run(canonicalInput);
      const questions = buildPracticeQuestions(definition, trace);
      expect(questions.length).toBeGreaterThanOrEqual(5);
      for (const question of questions) {
        expect(PRACTICE_KIND_LABELS[question.kind]).toBeTruthy();
        expect(question.explanation.length).toBeGreaterThan(20);
        expect(question.prompt.length).toBeGreaterThan(20);
        if (question.choices) {
          expect(new Set(question.choices).size).toBe(question.choices.length);
          expect(question.answerIndex).toBeGreaterThanOrEqual(0);
          expect(question.answerIndex).toBeLessThan(question.choices.length);
        }
      }
      const multipleChoice = questions.find((question) => question.choices);
      expect(multipleChoice).toBeDefined();
      expect(gradeAnswer(multipleChoice!, { choiceIndex: multipleChoice!.answerIndex }).correct).toBe(
        true
      );
    });

    it('generates identical practice for identical traces', () => {
      const first = buildPracticeQuestions(definition, run(canonicalInput));
      const second = buildPracticeQuestions(definition, run(canonicalInput));
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    it('declares complexity for every case', () => {
      expect(definition.complexity.best).toBeTruthy();
      expect(definition.complexity.average).toBeTruthy();
      expect(definition.complexity.worst).toBeTruthy();
      expect(definition.complexity.space).toBeTruthy();
    });

  }
);
