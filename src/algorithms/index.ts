import type { AnyAlgorithmDefinition } from '../core/types';
import { bubbleSort } from './sorting/bubble-sort';

/**
 * Algorithm atlas index.
 *
 * Every implemented algorithm is exported through `ALGORITHMS`, which the
 * registry, the test suite, the doc generator and the UI all consume. Adding an
 * algorithm means adding one import + one array entry; nothing else changes.
 * Use `npm run scaffold -- <category> <name>` to generate a compliant file.
 */
export const ALGORITHMS: AnyAlgorithmDefinition[] = [bubbleSort];
