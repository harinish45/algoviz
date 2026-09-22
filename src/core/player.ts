/**
 * Player — the execution-trace transport control.
 *
 * Pure, deterministic state machine: step, play, pause, next, previous, replay,
 * reset and speed. It is deliberately framework free so that both the React
 * hook and the test-suite drive the *same* logic (no duplicated playback rules).
 */

export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const;
export type Speed = (typeof SPEEDS)[number];
export const DEFAULT_SPEED: Speed = 1;
export const BASE_STEP_MS = 700;

export interface PlayerState {
  /** 0 = initial state (before any event), 1..total = after event N. */
  index: number;
  playing: boolean;
  speed: Speed;
}

export type PlayerAction =
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'goto'; index: number }
  | { type: 'start' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'reset' }
  | { type: 'end' }
  | { type: 'set-speed'; speed: Speed }
  | { type: 'sync-total'; total: number }
  | { type: 'turn' };

export interface PlayerContext {
  total: number;
}

export function initialPlayerState(total = 0): PlayerState {
  return { index: total > 0 ? 0 : -1, playing: false, speed: DEFAULT_SPEED };
}

export function clampIndex(index: number, total: number): number {
  if (total <= 0) return -1;
  return Math.min(total, Math.max(0, index));
}

/** Auto-play delay for the current speed (higher speed ⇒ shorter delay). */
export function stepDurationMs(speed: Speed): number {
  return Math.round(BASE_STEP_MS / speed);
}

export function playerReducer(
  state: PlayerState,
  action: PlayerAction,
  context: PlayerContext
): PlayerState {
  const { total } = context;
  const atStart = state.index <= 0;
  const atEnd = state.index >= total;
  switch (action.type) {
    case 'next': {
      if (atEnd) return { ...state, playing: false };
      return { ...state, index: clampIndex(state.index + 1, total) };
    }
    case 'previous': {
      if (atStart) return state;
      return { ...state, index: clampIndex(state.index - 1, total), playing: false };
    }
    case 'goto': {
      return { ...state, index: clampIndex(action.index, total), playing: false };
    }
    case 'start':
      return { ...state, index: clampIndex(0, total), playing: total > 0 };
    case 'play': {
      if (total <= 0) return state;
      const restart = atEnd;
      return { ...state, index: restart ? 0 : state.index, playing: true };
    }
    case 'pause':
      return { ...state, playing: false };
    case 'reset':
      return { ...state, index: clampIndex(0, total), playing: false };
    case 'end':
      return { ...state, index: clampIndex(total, total), playing: false };
    case 'set-speed':
      return { ...state, speed: action.speed };
    case 'sync-total': {
      const index = clampIndex(state.index, action.total);
      return { ...state, index, playing: state.playing && action.total > 0 };
    }
    case 'turn': {
      // Fired by the auto-play timer: advance or stop at the end of the trace.
      if (atEnd) return { ...state, playing: false };
      const nextIndex = clampIndex(state.index + 1, total);
      return { ...state, index: nextIndex, playing: nextIndex < total };
    }
    default: {
      const exhaustive: never = action;
      throw new Error(`unhandled player action: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Convenience: the event currently displayed (null when at index 0/empty). */
export function currentEventIndex(state: PlayerState): number {
  return state.index - 1;
}

export function progressRatio(state: PlayerState, total: number): number {
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, state.index / total));
}

export function hasNext(state: PlayerState, total: number): boolean {
  return total > 0 && state.index < total;
}

export function hasPrevious(state: PlayerState): boolean {
  return state.index > 0;
}
