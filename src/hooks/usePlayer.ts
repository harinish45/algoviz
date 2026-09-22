import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  clampIndex,
  hasNext,
  hasPrevious,
  initialPlayerState,
  playerReducer,
  progressRatio,
  stepDurationMs,
  type PlayerAction,
  type PlayerState,
  type Speed
} from '../core/player';

export interface PlayerApi {
  state: PlayerState;
  /** 0-based index of the visible event, or -1 when nothing is visible yet. */
  eventIndex: number;
  total: number;
  ratio: number;
  hasNext: boolean;
  hasPrevious: boolean;
  next: () => void;
  previous: () => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  replay: () => void;
  jumpTo: (index: number) => void;
  setSpeed: (speed: Speed) => void;
}

/**
 * Transport control over an execution trace.
 *
 * The playback rules live in `core/player.ts` (pure reducer); this hook only
 * wires them to timers and keyboard shortcuts, so tests exercise the same
 * state transitions the UI uses.
 */
export function usePlayer(total: number, options?: { autoplay?: boolean }): PlayerApi {
  const [state, dispatch] = useReducer(
    (current: PlayerState, action: PlayerAction) =>
      playerReducer(current, action, { total }),
    total,
    () => {
      const initial = initialPlayerState(total);
      return options?.autoplay && total > 0 ? { ...initial, playing: true } : initial;
    }
  );

  useEffect(() => {
    dispatch({ type: 'sync-total', total });
  }, [total]);

  useEffect(() => {
    if (!state.playing || total <= 0) return;
    const timer = window.setTimeout(() => dispatch({ type: 'turn' }), stepDurationMs(state.speed));
    return () => window.clearTimeout(timer);
  }, [state.playing, state.index, state.speed, total]);

  const setSpeed = useCallback((speed: Speed) => dispatch({ type: 'set-speed', speed }), []);

  const api = useMemo<PlayerApi>(
    () => ({
      state,
      eventIndex: state.index - 1,
      total,
      ratio: progressRatio(state, total),
      hasNext: hasNext(state, total),
      hasPrevious: hasPrevious(state),
      next: () => dispatch({ type: 'next' }),
      previous: () => dispatch({ type: 'previous' }),
      play: () => dispatch({ type: 'play' }),
      pause: () => dispatch({ type: 'pause' }),
      toggle: () => dispatch({ type: state.playing ? 'pause' : 'play' }),
      reset: () => dispatch({ type: 'reset' }),
      replay: () => dispatch({ type: 'start' }),
      jumpTo: (index: number) => dispatch({ type: 'goto', index: clampIndex(index, total) }),
      setSpeed
    }),
    [state, total, setSpeed]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        api.next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        api.previous();
      } else if (event.key === ' ') {
        event.preventDefault();
        api.toggle();
      } else if (event.key === 'Home') {
        api.reset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);

  return api;
}
