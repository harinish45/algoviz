/**
 * Progress & Mastery engine (pure logic + pluggable storage).
 *
 * Mastery is a transparent function of *observed* work:
 *   coverage    (40%) — how much of the execution trace was actually inspected
 *   practice    (40%) — accuracy over grounded practice questions
 *   exploration (20%) — concept, code and complexity panels opened
 * Nothing is inferred from wall-clock time or click counts alone.
 */

export const PROGRESS_VERSION = 1;
export const PROGRESS_STORAGE_KEY = 'algoviz.progress.v1';

export type MasteryLevel = 'unseen' | 'exploring' | 'practising' | 'mastered';

export interface AlgorithmProgress {
  algorithmId: string;
  /** Highest event step the learner reached (0 = only the initial state). */
  furthestStep: number;
  furthestRatio: number;
  practiceAttempts: number;
  practiceCorrect: number;
  conceptViewed: boolean;
  codeViewed: boolean;
  complexityViewed: boolean;
  lastVisited: string;
  completedRuns: number;
}

export interface ProgressState {
  version: number;
  algorithms: Record<string, AlgorithmProgress>;
}

export interface MasteryBreakdown {
  level: MasteryLevel;
  score: number;
  coverage: number;
  practice: number;
  exploration: number;
}

export function emptyProgress(): ProgressState {
  return { version: PROGRESS_VERSION, algorithms: {} };
}

export function emptyAlgorithmProgress(algorithmId: string, now = new Date()): AlgorithmProgress {
  return {
    algorithmId,
    furthestStep: 0,
    furthestRatio: 0,
    practiceAttempts: 0,
    practiceCorrect: 0,
    conceptViewed: false,
    codeViewed: false,
    complexityViewed: false,
    lastVisited: now.toISOString(),
    completedRuns: 0
  };
}

export function computeMastery(progress: AlgorithmProgress | undefined): MasteryBreakdown {
  if (!progress) {
    return { level: 'unseen', score: 0, coverage: 0, practice: 0, exploration: 0 };
  }
  const coverage = Math.min(1, progress.furthestRatio);
  const practice =
    progress.practiceAttempts > 0 ? progress.practiceCorrect / progress.practiceAttempts : 0;
  const exploration =
    (progress.conceptViewed ? 1 : 0) / 3 +
    (progress.codeViewed ? 1 : 0) / 3 +
    (progress.complexityViewed ? 1 : 0) / 3;
  const score = Math.round((coverage * 0.4 + practice * 0.4 + exploration * 0.2) * 100);
  let level: MasteryLevel = 'exploring';
  if (score === 0) level = 'unseen';
  else if (score >= 85 && progress.practiceAttempts >= 5 && coverage >= 0.95) level = 'mastered';
  else if (progress.practiceAttempts > 0) level = 'practising';
  return { level, score, coverage, practice, exploration };
}

function withAlgorithm(
  state: ProgressState,
  algorithmId: string,
  update: (current: AlgorithmProgress) => AlgorithmProgress
): ProgressState {
  const current = state.algorithms[algorithmId] ?? emptyAlgorithmProgress(algorithmId);
  const next = update({ ...current });
  return {
    version: PROGRESS_VERSION,
    algorithms: { ...state.algorithms, [algorithmId]: next }
  };
}

export function recordVisit(
  state: ProgressState,
  algorithmId: string,
  now = new Date()
): ProgressState {
  return withAlgorithm(state, algorithmId, (current) => ({
    ...current,
    lastVisited: now.toISOString()
  }));
}

export function recordStep(
  state: ProgressState,
  algorithmId: string,
  step: number,
  totalSteps: number,
  now = new Date()
): ProgressState {
  return withAlgorithm(state, algorithmId, (current) => {
    const furthestStep = Math.max(current.furthestStep, step);
    const ratio = totalSteps > 0 ? Math.min(1, furthestStep / totalSteps) : 0;
    return {
      ...current,
      furthestStep,
      furthestRatio: Math.max(current.furthestRatio, ratio),
      lastVisited: now.toISOString()
    };
  });
}

export function recordRunComplete(
  state: ProgressState,
  algorithmId: string,
  now = new Date()
): ProgressState {
  return withAlgorithm(state, algorithmId, (current) => ({
    ...current,
    completedRuns: current.completedRuns + 1,
    furthestRatio: 1,
    lastVisited: now.toISOString()
  }));
}

export function recordPanelView(
  state: ProgressState,
  algorithmId: string,
  panel: 'concept' | 'code' | 'complexity',
  now = new Date()
): ProgressState {
  return withAlgorithm(state, algorithmId, (current) => ({
    ...current,
    conceptViewed: current.conceptViewed || panel === 'concept',
    codeViewed: current.codeViewed || panel === 'code',
    complexityViewed: current.complexityViewed || panel === 'complexity',
    lastVisited: now.toISOString()
  }));
}

export function recordPracticeResult(
  state: ProgressState,
  algorithmId: string,
  correct: boolean,
  now = new Date()
): ProgressState {
  return withAlgorithm(state, algorithmId, (current) => ({
    ...current,
    practiceAttempts: current.practiceAttempts + 1,
    practiceCorrect: current.practiceCorrect + (correct ? 1 : 0),
    lastVisited: now.toISOString()
  }));
}

export interface ProgressStorage {
  load(): ProgressState;
  save(state: ProgressState): void;
  clear(): void;
}

function isProgressState(value: unknown): value is ProgressState {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ProgressState).version === PROGRESS_VERSION &&
    typeof (value as ProgressState).algorithms === 'object' &&
    (value as ProgressState).algorithms !== null
  );
}

/** localStorage-backed storage; degrades to memory when storage is unavailable. */
export function createProgressStorage(storageKey = PROGRESS_STORAGE_KEY): ProgressStorage {
  let memory: ProgressState = emptyProgress();
  const available = (): boolean => {
    try {
      return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch {
      return false;
    }
  };
  return {
    load(): ProgressState {
      if (!available()) return memory;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return emptyProgress();
        const parsed: unknown = JSON.parse(raw);
        return isProgressState(parsed) ? parsed : emptyProgress();
      } catch {
        return emptyProgress();
      }
    },
    save(state: ProgressState): void {
      memory = state;
      if (!available()) return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // Storage full or blocked: keep the in-memory copy, never crash the UI.
      }
    },
    clear(): void {
      memory = emptyProgress();
      if (!available()) return;
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  };
}

