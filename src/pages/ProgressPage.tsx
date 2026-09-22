import { Link } from 'react-router-dom';
import { REGISTRY, sortByDifficulty } from '../core/registry';
import type { ProgressApi } from '../hooks/useProgress';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

export function ProgressPage({ progress }: { progress: ProgressApi }): React.JSX.Element {
  const rows = sortByDifficulty(REGISTRY).map((definition) => ({
    definition,
    raw: progress.of(definition.id),
    mastery: progress.masteryOf(definition.id)
  }));
  const touched = rows.filter((row) => row.raw !== undefined);
  const average =
    touched.length === 0
      ? 0
      : Math.round(touched.reduce((sum, row) => sum + row.mastery.score, 0) / touched.length);
  const attempts = touched.reduce((sum, row) => sum + (row.raw?.practiceAttempts ?? 0), 0);
  const correct = touched.reduce((sum, row) => sum + (row.raw?.practiceCorrect ?? 0), 0);
  const runs = touched.reduce((sum, row) => sum + (row.raw?.completedRuns ?? 0), 0);
  const accuracy = attempts > 0 ? Math.round((100 * correct) / attempts) : null;

  return (
    <div className="stack">
      <section className="hero">
        <span className="card-hint">Stored in this browser only — reset any time</span>
        <h1>Your mastery</h1>
        <p>
          Scores are a transparent function of observed work: 40% trace coverage, 40% practice
          accuracy, 20% exploration. Nothing is inferred from time spent.
        </p>
        <div className="stat-row">
          <div className="stat">
            <b>{touched.length}</b>
            <span>algorithms touched</span>
          </div>
          <div className="stat">
            <b>{average}%</b>
            <span>average mastery</span>
          </div>
          <div className="stat">
            <b>{runs}</b>
            <span>completed runs</span>
          </div>
          <div className="stat">
            <b>{attempts}</b>
            <span>practice attempts</span>
          </div>
          <div className="stat">
            <b>{accuracy === null ? '—' : `${accuracy}%`}</b>
            <span>practice accuracy</span>
          </div>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (window.confirm('Reset all mastery and practice history?')) progress.reset();
            }}
          >
            Reset all progress
          </button>
        </div>
      </section>

      {touched.length === 0 ? (
        <section className="card">
          <div className="card-head">
            <span className="card-title">No progress yet</span>
          </div>
          <p className="muted">
            Open an algorithm and step through its trace — coverage, practice and exploration show
            up here immediately.
          </p>
          <Link to="/">← Pick your first algorithm</Link>
        </section>
      ) : (
        <section className="card">
          <div className="card-head">
            <span className="card-title">Per-algorithm breakdown</span>
            <span className="card-hint">score always shown with its parts</span>
          </div>
          <div className="table-grid">
            <table className="data">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Level</th>
                  <th className="num">Score</th>
                  <th className="num">Coverage</th>
                  <th className="num">Practice</th>
                  <th className="num">Exploration</th>
                  <th className="num">Runs</th>
                  <th className="num">Accuracy</th>
                  <th>Visited</th>
                </tr>
              </thead>
              <tbody>
                {touched.map(({ definition, raw, mastery }) => (
                  <tr key={definition.id}>
                    <td>
                      <Link to={`/algorithm/${definition.id}`}>{definition.name}</Link>
                    </td>
                    <td>
                      <span className="badge">{mastery.level}</span>
                    </td>
                    <td className="num">{mastery.score}%</td>
                    <td className="num">{Math.round(mastery.coverage * 100)}%</td>
                    <td className="num">{Math.round(mastery.practice * 100)}%</td>
                    <td className="num">{Math.round(mastery.exploration * 100)}%</td>
                    <td className="num">{raw?.completedRuns ?? 0}</td>
                    <td className="num">
                      {raw && raw.practiceAttempts > 0
                        ? `${Math.round((100 * raw.practiceCorrect) / raw.practiceAttempts)}%`
                        : '—'}
                    </td>
                    <td>{raw ? formatDate(raw.lastVisited) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}