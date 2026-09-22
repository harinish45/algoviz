import { useCallback, useMemo, useState } from 'react';
import {
  computeMastery,
  createProgressStorage,
  emptyProgress,
  recordPanelView,
  recordPracticeResult,
  recordRunComplete,
  recordStep,
  recordVisit,
  type AlgorithmProgress,
  type MasteryBreakdown,
  type ProgressState
} from '../core/progress';

export interface ProgressApi {
  state: ProgressState;
  of: (algorithmId: string) => AlgorithmProgress | undefined;
  masteryOf: (algorithmId: string) => MasteryBreakdown;
  visit: (algorithmId: string) => void;
  step: (algorithmId: string, step: number, totalSteps: number) => void;
  runComplete: (algorithmId: string) => void;
  panel: (algorithmId: string, panel: 'concept' | 'code' | 'complexity') => void;
  practiceResult: (algorithmId: string, correct: boolean) => void;
  reset: () => void;
}

/** Progress/mastery state persisted in localStorage (falls back to memory). */
export function useProgress(): ProgressApi {
  const storage = useMemo(() => createProgressStorage(), []);
  const [state, setState] = useState<ProgressState>(() => storage.load());

  const update = useCallback(
    (next: ProgressState) => {
      storage.save(next);
      setState(next);
    },
    [storage]
  );

  return useMemo<ProgressApi>(
    () => ({
      state,
      of: (algorithmId: string) => state.algorithms[algorithmId],
      masteryOf: (algorithmId: string) => computeMastery(state.algorithms[algorithmId]),
      visit: (algorithmId: string) => update(recordVisit(state, algorithmId)),
      step: (algorithmId: string, stepIndex: number, totalSteps: number) =>
        update(recordStep(state, algorithmId, stepIndex, totalSteps)),
      runComplete: (algorithmId: string) => update(recordRunComplete(state, algorithmId)),
      panel: (algorithmId: string, panel: 'concept' | 'code' | 'complexity') =>
        update(recordPanelView(state, algorithmId, panel)),
      practiceResult: (algorithmId: string, correct: boolean) =>
        update(recordPracticeResult(state, algorithmId, correct)),
      reset: () => update(emptyProgress())
    }),
    [state, update]
  );
}
