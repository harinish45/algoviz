import { SPEEDS, type Speed } from '../../core/player';
import type { ExecutionTrace } from '../../core/types';
import type { PlayerApi } from '../../hooks/usePlayer';

interface ControlsProps {
  player: PlayerApi;
  trace: ExecutionTrace<unknown, unknown>;
}

const MAX_TICKS = 160;

function Timeline({
  trace,
  player
}: {
  trace: ExecutionTrace<unknown, unknown>;
  player: PlayerApi;
}): React.JSX.Element {
  const total = trace.events.length;
  const stride = Math.max(1, Math.ceil(total / MAX_TICKS));
  const ticks: number[] = [];
  for (let step = 1; step <= total; step += stride) ticks.push(step);
  if (ticks[ticks.length - 1] !== total) ticks.push(total);

  return (
    <div className="timeline" role="group" aria-label="Execution timeline">
      {ticks.map((step) => {
        const event = trace.events[step - 1];
        return (
          <button
            key={step}
            type="button"
            className={`tick${player.state.index >= step ? ' done' : ''}`}
            aria-current={player.state.index === step ? 'step' : undefined}
            title={`Step ${step}: ${event.title} (${event.type})`}
            onClick={() => player.jumpTo(step)}
          >
            {step}
            <br />
            <span aria-hidden="true">{event.type.slice(0, 6)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Transport controls over the execution trace: reset, previous, play, pause,
 * next, replay, jump to end, speed — plus a clickable timeline. All buttons are
 * real buttons with labels so the control surface is keyboard accessible.
 */
export function ControlsBar({ player, trace }: ControlsProps): React.JSX.Element {
  const total = trace.events.length;
  const atEnd = total > 0 && player.state.index >= total;
  return (
    <section className="card" aria-label="Execution controls">
      <div className="spread">
        <div className="btn-row">
          <button type="button" onClick={player.reset} disabled={player.state.index === 0}>
            ⏮ Reset
          </button>
          <button type="button" onClick={player.previous} disabled={!player.hasPrevious}>
            ◀ Previous
          </button>
          <button
            type="button"
            className="primary"
            onClick={player.toggle}
            disabled={total === 0}
            aria-pressed={player.state.playing}
          >
            {player.state.playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button type="button" onClick={player.next} disabled={!player.hasNext}>
            Next ▶
          </button>
          <button type="button" onClick={player.replay} disabled={total === 0}>
            ↻ Replay
          </button>
          <button type="button" onClick={() => player.jumpTo(total)} disabled={atEnd}>
            ⏭ End
          </button>
        </div>
        <div className="row">
          <label htmlFor="speed" style={{ margin: 0 }}>
            Speed
          </label>
          <select
            id="speed"
            value={player.state.speed}
            onChange={(event) => player.setSpeed(Number(event.target.value) as Speed)}
            style={{ width: 'auto' }}
          >
            {SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="spread" style={{ marginTop: '0.6rem' }}>
        <span className="mono card-hint">
          step {Math.max(0, player.state.index)} / {total}
        </span>
        <span className="card-hint">
          {trace.determinism === 'deterministic' ? 'deterministic' : `seeded (seed ${trace.seed})`} ·
          replayable
        </span>
      </div>
      <div className="progress-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${Math.round(player.ratio * 100)}%` }} />
      </div>

      <Timeline trace={trace} player={player} />
      <p className="card-hint">
        Keyboard: ← previous · → next · Space play/pause · Home reset
      </p>
    </section>
  );
}
