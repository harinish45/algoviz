import { describe, expect, it } from 'vitest';
import {
  BASE_STEP_MS,
  DEFAULT_SPEED,
  clampIndex,
  currentEventIndex,
  hasNext,
  hasPrevious,
  initialPlayerState,
  playerReducer,
  progressRatio,
  stepDurationMs,
  type PlayerAction,
  type PlayerContext,
  type PlayerState,
  type Speed
} from './player';

/**
 * Player lifecycle suite.
 *
 * Maps the code-review findings for Uday's `AlgorithmExecutor` onto this
 * repository's architecture: main has no async executor with `waitForResume`
 * polling — playback is this pure reducer plus one cleared `setTimeout` per
 * tick in `usePlayer`, so no orphaned timers exist. These tests pin the
 * lifecycle semantics the review demanded: step-exactly-one (§18), completion
 * only at the end of the trace (§16), reset/replay preserving speed and index
 * correctness (§19), and speed scaling.
 */
const CTX: PlayerContext = { total: 5 };
const EMPTY: PlayerContext = { total: 0 };

function run(from: PlayerState, actions: PlayerAction[], context = CTX): PlayerState {
  return actions.reduce((state, action) => playerReducer(state, action, context), from);
}

describe('player lifecycle', () => {
  it('starts parked before the first event', () => {
    expect(initialPlayerState(5)).toEqual({ index: 0, playing: false, speed: DEFAULT_SPEED });
    expect(initialPlayerState(0)).toEqual({ index: -1, playing: false, speed: DEFAULT_SPEED });
    expect(currentEventIndex(initialPlayerState(5))).toBe(-1);
  });

  it('step semantics: one "next" advances exactly one event', () => {
    const before = initialPlayerState(5);
    const after = playerReducer(before, { type: 'next' }, CTX);
    expect(after.index).toBe(1);
    expect(currentEventIndex(after)).toBe(0);
    expect(after.playing).toBe(false);
    expect(playerReducer(after, { type: 'previous' }, CTX).index).toBe(0);
  });

  it('never steps past the final event and stops playback at the end', () => {
    const atEnd: PlayerState = { index: CTX.total, playing: true, speed: DEFAULT_SPEED };
    const after = playerReducer(atEnd, { type: 'next' }, CTX);
    expect(after.index).toBe(CTX.total);
    expect(after.playing).toBe(false);
    expect(hasNext(after, CTX.total)).toBe(false);
  });

  it('turn loop plays through the whole trace and completes exactly once', () => {
    let state = playerReducer(initialPlayerState(5), { type: 'play' }, CTX);
    expect(state.playing).toBe(true);
    const seen: number[] = [];
    for (let tick = 0; tick < 10 && state.playing; tick += 1) {
      state = playerReducer(state, { type: 'turn' }, CTX);
      seen.push(state.index);
    }
    expect(seen).toEqual([1, 2, 3, 4, 5]);
    expect(state.playing).toBe(false);
    expect(progressRatio(state, CTX.total)).toBe(1);
  });

  it('pause freezes the position; play resumes from it (no skipped events)', () => {
    const playing = run(initialPlayerState(5), [{ type: 'play' }, { type: 'turn' }]);
    expect(playing.index).toBe(1);
    const paused = playerReducer(playing, { type: 'pause' }, CTX);
    expect(paused).toEqual({ index: 1, playing: false, speed: DEFAULT_SPEED });
    const whilePaused = playerReducer(paused, { type: 'turn' }, CTX);
    expect(whilePaused.index).toBe(1); // a stale timer tick cannot advance a paused player
    const again = playerReducer(whilePaused, { type: 'play' }, CTX);
    expect(again).toEqual({ index: 1, playing: true, speed: DEFAULT_SPEED });
  });

  it('replay ("start") rewinds to the initial state and preserves speed', () => {
    const fast = playerReducer(initialPlayerState(5), { type: 'set-speed', speed: 4 as Speed }, CTX);
    const ended = run(fast, [{ type: 'end' }]);
    expect(ended.index).toBe(5);
    const replayed = playerReducer(ended, { type: 'start' }, CTX);
    expect(replayed).toEqual({ index: 0, playing: true, speed: 4 });
  });

  it('reset parks at the initial state without touching speed', () => {
    const state = run(initialPlayerState(5), [
      { type: 'set-speed', speed: 0.5 as Speed },
      { type: 'play' },
      { type: 'turn' },
      { type: 'turn' }
    ]);
    expect(state.index).toBe(2);
    const reset = playerReducer(state, { type: 'reset' }, CTX);
    expect(reset).toEqual({ index: 0, playing: false, speed: 0.5 });
    expect(hasPrevious(reset)).toBe(false);
  });

  it('goto clamps into range and pauses (scrubbing never keeps playing)', () => {
    const playing = run(initialPlayerState(5), [{ type: 'play' }]);
    expect(playerReducer(playing, { type: 'goto', index: 99 }, CTX)).toEqual({
      index: 5,
      playing: false,
      speed: DEFAULT_SPEED
    });
    expect(playerReducer(playing, { type: 'goto', index: -3 }, CTX).index).toBe(0);
    expect(clampIndex(9, 5)).toBe(5);
    expect(clampIndex(3, 0)).toBe(-1);
  });

  it('sync-total clamps a stale index and stops playback for an empty trace', () => {
    const mid: PlayerState = { index: 5, playing: true, speed: DEFAULT_SPEED };
    expect(playerReducer(mid, { type: 'sync-total', total: 2 }, CTX)).toEqual({
      index: 2,
      playing: true,
      speed: DEFAULT_SPEED
    });
    expect(playerReducer(mid, { type: 'sync-total', total: 0 }, CTX)).toEqual({
      index: -1,
      playing: false,
      speed: DEFAULT_SPEED
    });
  });

  it('empty traces reject playback instead of spinning timers', () => {
    const empty = initialPlayerState(0);
    expect(playerReducer(empty, { type: 'play' }, EMPTY)).toBe(empty);
    expect(playerReducer(empty, { type: 'turn' }, EMPTY).playing).toBe(false);
    expect(playerReducer(empty, { type: 'next' }, EMPTY)).toEqual({
      index: -1,
      playing: false,
      speed: DEFAULT_SPEED
    });
  });

  it('speed scales the auto-play delay inversely', () => {
    expect(stepDurationMs(1)).toBe(BASE_STEP_MS);
    expect(stepDurationMs(2)).toBe(BASE_STEP_MS / 2);
    expect(stepDurationMs(0.25)).toBe(BASE_STEP_MS * 4);
    const sped = playerReducer(initialPlayerState(5), { type: 'set-speed', speed: 8 as Speed }, CTX);
    expect(sped.speed).toBe(8);
    expect(sped.index).toBe(0);
  });

  it('progress helpers agree with the reducer state', () => {
    const half: PlayerState = { index: 3, playing: false, speed: DEFAULT_SPEED };
    expect(progressRatio(half, CTX.total)).toBeCloseTo(0.6);
    expect(hasNext(half, CTX.total)).toBe(true);
    expect(hasPrevious(half)).toBe(true);
    expect(progressRatio(half, 0)).toBe(0);
  });

  it('throws on unknown actions instead of silently ignoring typos', () => {
    const typo = { type: 'step' } as unknown as PlayerAction;
    expect(() => playerReducer(initialPlayerState(5), typo, CTX)).toThrowError(/unhandled player action/);
  });
});