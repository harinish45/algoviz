import { ALGORITHMS } from '../algorithms';
import { CATEGORIES, DIFFICULTY_ORDER } from './categories';
import type { AnyAlgorithmDefinition, CategoryDocs, CategoryId, Difficulty } from './types';

/**
 * Algorithm registry.
 *
 * Single lookup surface used by the router, the sidebar, the search palette,
 * the progress engine and the test suite. It never mutates the definitions.
 */

/** Number of algorithms promised by the master atlas (docs/ATLAS.md). */
export const PLANNED_ALGORITHM_TOTAL = 330;

export const REGISTRY: AnyAlgorithmDefinition[] = ALGORITHMS;

export const ALGORITHM_BY_ID: Map<string, AnyAlgorithmDefinition> = new Map(
  REGISTRY.map((definition) => [definition.id, definition])
);

export function getAlgorithm(id: string): AnyAlgorithmDefinition | undefined {
  return ALGORITHM_BY_ID.get(id);
}

export function requireAlgorithm(id: string): AnyAlgorithmDefinition {
  const definition = ALGORITHM_BY_ID.get(id);
  if (!definition) throw new Error(`unknown algorithm id "${id}"`);
  return definition;
}

export interface CategoryGroup {
  category: CategoryDocs;
  algorithms: AnyAlgorithmDefinition[];
}

function byName(a: AnyAlgorithmDefinition, b: AnyAlgorithmDefinition): number {
  return a.name.localeCompare(b.name);
}

export function categoryGroups(): CategoryGroup[] {
  return CATEGORIES.map((category) => ({
    category,
    algorithms: REGISTRY.filter((definition) => definition.category === category.id).sort(byName)
  }));
}

export function algorithmsByCategory(category: CategoryId): AnyAlgorithmDefinition[] {
  return REGISTRY.filter((definition) => definition.category === category).sort(byName);
}

export function countByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const definition of REGISTRY) {
    counts[definition.category] = (counts[definition.category] ?? 0) + 1;
  }
  return counts;
}

export function countByDifficulty(): Record<Difficulty, number> {
  const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0, advanced: 0 };
  for (const definition of REGISTRY) counts[definition.difficulty] += 1;
  return counts;
}

export function sortByDifficulty(algorithms: AnyAlgorithmDefinition[]): AnyAlgorithmDefinition[] {
  return [...algorithms].sort((a, b) => {
    const difference =
      (DIFFICULTY_ORDER[a.difficulty] ?? 0) - (DIFFICULTY_ORDER[b.difficulty] ?? 0);
    return difference !== 0 ? difference : a.name.localeCompare(b.name);
  });
}

/** Deterministic scoring search across name, ids, tags, category and concept. */
export function searchAlgorithms(query: string, limit = 12): { definition: AnyAlgorithmDefinition; score: number }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: { definition: AnyAlgorithmDefinition; score: number }[] = [];
  for (const definition of REGISTRY) {
    const haystacks: [string, number][] = [
      [definition.name.toLowerCase(), 6],
      [definition.id.toLowerCase(), 5],
      [definition.category.toLowerCase(), 3],
      [definition.subcategory.toLowerCase(), 2],
      [definition.tags.join(' ').toLowerCase(), 3],
      [definition.concept.definition.toLowerCase(), 1]
    ];
    let score = 0;
    for (const [text, weight] of haystacks) {
      if (text === needle) score += weight * 3;
      else if (text.startsWith(needle)) score += weight * 2;
      else if (text.includes(needle)) score += weight;
    }
    if (score > 0) hits.push({ definition, score });
  }
  return hits
    .sort((a, b) =>
      b.score !== a.score ? b.score - a.score : a.definition.name.localeCompare(b.definition.name)
    )
    .slice(0, limit);
}

export interface RegistryStats {
  implemented: number;
  planned: number;
  categories: number;
  byCategory: Record<string, number>;
  byDifficulty: Record<Difficulty, number>;
  totalTestCases: number;
}

export function registryStats(): RegistryStats {
  return {
    implemented: REGISTRY.length,
    planned: PLANNED_ALGORITHM_TOTAL,
    categories: CATEGORIES.length,
    byCategory: countByCategory(),
    byDifficulty: countByDifficulty(),
    totalTestCases: REGISTRY.reduce((total, definition) => total + definition.tests.length, 0)
  };
}

/** Structural validation of the registry itself (used by the test suite). */
export function validateRegistry(entries: AnyAlgorithmDefinition[] = REGISTRY): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const definition of entries) {
    if (seen.has(definition.id)) problems.push(`duplicate algorithm id "${definition.id}"`);
    seen.add(definition.id);
    if (!/^[a-z0-9-]+$/.test(definition.id)) {
      problems.push(`id "${definition.id}" must be kebab-case`);
    }
    if (!CATEGORIES.some((category) => category.id === definition.category)) {
      problems.push(`algorithm "${definition.id}" uses unknown category "${definition.category}"`);
    }
    for (const language of ['typescript', 'python', 'cpp', 'java'] as const) {
      if (!definition.implementations[language]?.trim()) {
        problems.push(`algorithm "${definition.id}" is missing its ${language} implementation`);
      }
    }
    if (definition.concept.invariants.length === 0) {
      problems.push(`algorithm "${definition.id}" declares no invariant`);
    }
    if (definition.concept.correctness.trim().length < 40) {
      problems.push(`algorithm "${definition.id}" has no meaningful correctness argument`);
    }
    if (definition.tests.length === 0) {
      problems.push(`algorithm "${definition.id}" declares no test cases`);
    }
    const families = new Set(definition.tests.map((test) => test.family));
    for (const required of ['canonical', 'invalid', 'empty', 'singleton'] as const) {
      if (!families.has(required)) {
        problems.push(`algorithm "${definition.id}" has no "${required}" test case`);
      }
    }
    if (!definition.tests.some((test) => test.expect.counters || test.expect.eventTypes)) {
      problems.push(`algorithm "${definition.id}" has no trace-property assertion`);
    }
    if (definition.inputSchema.examples.length === 0) {
      problems.push(`algorithm "${definition.id}" exposes no ready-made input examples`);
    }
  }
  return problems;
}

