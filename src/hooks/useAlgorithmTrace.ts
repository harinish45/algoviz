import { useMemo } from 'react';
import { formatIssues, validateInput, type ValidationIssue } from '../core/validation';
import { isInputRejected } from '../core/errors';
import type { AnyAlgorithmDefinition, ExecutionTrace } from '../core/types';

export interface TraceResult {
  ok: boolean;
  issues: ValidationIssue[];
  trace?: ExecutionTrace<unknown, unknown>;
  /** Normalised input that produced the trace (used for reset and practice). */
  input?: Record<string, unknown>;
}

/**
 * Runs the algorithm against raw input from the input panel.
 *
 * Validation happens before execution, and execution failures (including
 * `InputRejectedError` thrown by the algorithm itself) surface as issues —
 * never as a broken trace.
 */
export function useAlgorithmTrace(
  definition: AnyAlgorithmDefinition,
  rawInput: unknown,
  options?: { maxEvents?: number }
): TraceResult {
  return useMemo<TraceResult>(() => {
    const validation = validateInput(definition.inputSchema, rawInput);
    if (!validation.ok) {
      return { ok: false, issues: validation.issues };
    }
    try {
      const run = definition.execute as (
        input: unknown,
        options?: { maxEvents?: number }
      ) => ExecutionTrace<unknown, unknown>;
      const trace = run(validation.value, options);
      return { ok: true, issues: [], trace, input: validation.value as Record<string, unknown> };
    } catch (error) {
      if (isInputRejected(error)) {
        return { ok: false, issues: error.issues };
      }
      return {
        ok: false,
        issues: [{ path: '$', message: `execution failed: ${(error as Error).message}` }]
      };
    }
  }, [definition, rawInput, options]);
}

export function describeIssues(result: TraceResult): string {
  return formatIssues(result.issues);
}
