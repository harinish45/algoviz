import type { CategoryDocs, CategoryId } from './types';

/**
 * Category contract for the atlas. Order defines the sidebar order.
 * `atlasPages` points at the master-prompt page ranges that authorise the
 * category (see docs/ATLAS.md).
 */
export const CATEGORIES: CategoryDocs[] = [
  {
    id: 'arrays-searching',
    name: 'Arrays & Searching',
    blurb: 'Index arithmetic, two pointers, sliding windows, prefix sums and every search variant.',
    atlasPages: 'Atlas §Arrays & Searching (25 algorithms)'
  },
  {
    id: 'sorting',
    name: 'Sorting',
    blurb: 'Comparison and distribution sorts with stability, in-place and adaptivity properties.',
    atlasPages: 'Atlas §Sorting (18 algorithms)'
  },
  {
    id: 'linked-lists',
    name: 'Linked Lists',
    blurb: 'Pointer surgery on singly, doubly and circular lists, cycles and merging.',
    atlasPages: 'Atlas §Linked Lists (18 algorithms)'
  },
  {
    id: 'stacks-queues-hashing',
    name: 'Stacks, Queues & Hashing',
    blurb: 'LIFO/FIFO structures, monotonic stacks, expression evaluation and hash collisions.',
    atlasPages: 'Atlas §Stacks Queues Hashing (21 algorithms)'
  },
  {
    id: 'trees',
    name: 'Trees',
    blurb: 'Traversals, BST operations, balanced trees, heaps, tries and index structures.',
    atlasPages: 'Atlas §Trees (45 algorithms)'
  },
  {
    id: 'graphs',
    name: 'Graphs',
    blurb: 'Traversal, shortest paths, MST, connectivity, flow and matching.',
    atlasPages: 'Atlas §Graphs (39 algorithms)'
  },
  {
    id: 'greedy',
    name: 'Greedy',
    blurb: 'Exchange-argument algorithms: scheduling, compression, coverage and jumps.',
    atlasPages: 'Atlas §Greedy (15 algorithms)'
  },
  {
    id: 'dynamic-programming',
    name: 'Dynamic Programming',
    blurb: 'Memoisation, tabulation, interval/bitmask/tree DP and state compression.',
    atlasPages: 'Atlas §Dynamic Programming (36 algorithms)'
  },
  {
    id: 'strings',
    name: 'Strings',
    blurb: 'Exact and hashed matching, prefix functions, suffix structures and windows.',
    atlasPages: 'Atlas §Strings (20 algorithms)'
  },
  {
    id: 'backtracking',
    name: 'Backtracking & Recursion',
    blurb: 'Search trees, pruning, call stacks and constraint propagation.',
    atlasPages: 'Atlas §Backtracking & Recursion (18 algorithms)'
  },
  {
    id: 'number-theory',
    name: 'Number Theory & Math',
    blurb: 'GCD family, sieves, modular arithmetic, primality and matrix power.',
    atlasPages: 'Atlas §Number Theory & Math (21 algorithms)'
  },
  {
    id: 'bit-manipulation',
    name: 'Bit Manipulation',
    blurb: 'Bit twiddling identities, XOR tricks, masks, subsets and bitwise tries.',
    atlasPages: 'Atlas §Bit Manipulation (18 algorithms)'
  },
  {
    id: 'geometry',
    name: 'Computational Geometry',
    blurb: 'Orientation predicates, hulls, intersections, areas and closest pairs.',
    atlasPages: 'Atlas §Computational Geometry (16 algorithms)'
  },
  {
    id: 'advanced-daa',
    name: 'Advanced DAA',
    blurb: 'Divide & conquer analysis, randomised algorithms, amortised analysis and complexity classes.',
    atlasPages: 'Atlas §Advanced DAA (20 algorithms)'
  }
];

export const CATEGORY_BY_ID: Record<CategoryId, CategoryDocs> = CATEGORIES.reduce(
  (acc, category) => {
    acc[category.id] = category;
    return acc;
  },
  {} as Record<CategoryId, CategoryDocs>
);

export const DIFFICULTY_ORDER: Record<string, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
  advanced: 3
};
