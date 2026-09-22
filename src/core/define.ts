import type { AlgorithmDefinition, AnyAlgorithmDefinition } from './types';

/**
 * Type-erasing helper for the registry.
 *
 * Algorithms are authored with concrete `Input`/`State`/`Result` types; the
 * registry, the testkit and the UI consume them through the loose
 * `AnyAlgorithmDefinition` view. This is the single place where the erasure
 * happens, so no other module needs an `as unknown as` cast.
 */
export function defineAlgorithm<Input, State, Result>(
  definition: AlgorithmDefinition<Input, State, Result>
): AnyAlgorithmDefinition {
  return definition as unknown as AnyAlgorithmDefinition;
}
