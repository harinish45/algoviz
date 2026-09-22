import { formatIssues, validateInput } from './validation';
import type { AlgorithmInputSchema } from './types';

/** Raised when user input does not satisfy the algorithm's declared schema. */
export class InputRejectedError extends Error {
  readonly issues: { path: string; message: string }[];

  constructor(algorithmId: string, issues: { path: string; message: string }[]) {
    super(`input rejected by ${algorithmId}: ${formatIssues(issues)}`);
    this.name = 'InputRejectedError';
    this.issues = issues;
  }
}

/** Raised when an algorithm detects that one of its own invariants broke. */
export class AlgorithmInvariantError extends Error {
  constructor(algorithmId: string, invariant: string, detail: string) {
    super(`${algorithmId} invariant violated — ${invariant}: ${detail}`);
    this.name = 'AlgorithmInvariantError';
  }
}

/**
 * Validates raw input or throws `InputRejectedError`.
 * Every algorithm entry point starts with this call so that invalid input is
 * reported as a first-class outcome instead of a silent NaN/undefined result.
 */
export function requireValidInput<T>(algorithmId: string, schema: AlgorithmInputSchema, raw: unknown): T {
  const result = validateInput<T>(schema, raw);
  if (!result.ok) {
    throw new InputRejectedError(algorithmId, result.issues);
  }
  return result.value as T;
}

export function isInputRejected(error: unknown): error is InputRejectedError {
  return error instanceof InputRejectedError;
}
