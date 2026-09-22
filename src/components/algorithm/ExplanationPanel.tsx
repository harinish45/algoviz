import { formatValue } from '../../core/format';
import type { ComplexityCounters, ExecutionEvent } from '../../core/types';

interface ExplanationProps {
  event: ExecutionEvent<unknown> | undefined;
  counters: ComplexityCounters;
  step: number;
  total: number;
}

const COUNTER_LABELS: { key: keyof ComplexityCounters; label: string }[] = [
  { key: 'comparisons', label: 'comparisons' },
  { key: 'swaps', label: 'swaps' },
  { key: 'writes', label: 'writes' },
  { key: 'reads', label: 'reads' },
  { key: 'relaxations', label: 'relaxations' },
  { key: 'recursiveCalls', label: 'recursive calls' },
  { key: 'iterations', label: 'loop iterations' },
  { key: 'probes', label: 'probes' },
  { key: 'allocations', label: 'allocations' },
  { key: 'assignments', label: 'assignments' },
  { key: 'arithmetic', label: 'arithmetic ops' }
];

export function ExplanationPanel({ event, counters, step, total }: ExplanationProps): React.JSX.Element {
  if (!event) {
    return (
      <section className="card" aria-label="Explanation">
        <div className="card-head">
          <span className="card-title">Explanation</span>
          <span className="card-hint">initial state — press Next or Play</span>
        </div>
        <p>
          The trace has {total} recorded step(s). Step 0 is the validated input before the algorithm
          touched it. Press <strong>Next</strong> to see the first concrete operation, or scrub the
          timeline above.
        </p>
      </section>
    );
  }

  const impact = Object.entries(event.complexityImpact ?? {}).filter(
    ([, value]) => typeof value === 'number' && value !== 0
  );

  return (
    <section className="card" aria-label="Explanation">
      <div className="card-head">
        <span className="card-title">
          Step {step} · {event.title}
        </span>
        <span className="badge">{event.type}</span>
      </div>

      <p>
        <strong>What changed:</strong> {event.description}
      </p>
      <p>
        <strong>Why this operation now:</strong> {event.why}
      </p>
      {event.invariant ? (
        <p>
          <strong>Invariant still true:</strong> <em>{event.invariant}</em>
        </p>
      ) : null}

      {event.codeReference ? (
        <p className="mono">
          code: line {event.codeReference.lineStart}
          {event.codeReference.lineEnd !== event.codeReference.lineStart
            ? `–${event.codeReference.lineEnd}`
            : ''}{' '}
          of the {event.codeReference.language} reference implementation
        </p>
      ) : null}

      {impact.length > 0 ? (
        <p className="card-hint">
          complexity impact: {impact.map(([key, value]) => `${key} +${String(value)}`).join(' · ')}
        </p>
      ) : null}

      {event.visualization.mutations.length > 0 ? (
        <div>
          <h3>Mutations</h3>
          <ul className="list">
            {event.visualization.mutations.map((mutation) => (
              <li key={`${mutation.target}-${String(mutation.from)}-${String(mutation.to)}`}>
                <code>{mutation.target}</code>: {formatValue(mutation.from)} →{' '}
                {formatValue(mutation.to)}
                {mutation.note ? ` (${mutation.note})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {event.visualization.annotations.length > 0 ? (
        <div>
          <h3>Annotations</h3>
          <ul className="list">
            {event.visualization.annotations.map((annotation) => (
              <li key={`${annotation.label}-${annotation.detail ?? ''}`}>
                {annotation.label}
                {annotation.detail ? ` — ${annotation.detail}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <h3 style={{ marginTop: '0.7rem' }}>Variables at this step</h3>
      {Object.keys(event.variables).length === 0 ? (
        <p className="muted">This step changes no local variables beyond the state snapshot.</p>
      ) : (
        <table className="data">
          <tbody>
            {Object.entries(event.variables).map(([name, value]) => (
              <tr key={name}>
                <th scope="row" className="mono">
                  {name}
                </th>
                <td className="mono">{formatValue(value, 160)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginTop: '0.7rem' }}>Running counters</h3>
      <div className="row">
        {COUNTER_LABELS.map(({ key, label }) => (
          <span className="badge" key={key}>
            {label}: <span className="mono">{counters[key]}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
