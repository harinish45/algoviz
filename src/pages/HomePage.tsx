import { Link } from 'react-router-dom';
import { CATEGORIES } from '../core/categories';
import { percent } from '../core/format';
import { REGISTRY, countByCategory, registryStats, sortByDifficulty } from '../core/registry';

export function HomePage(): React.JSX.Element {
  const stats = registryStats();
  const counts = countByCategory();
  const live = sortByDifficulty(REGISTRY);
  const coverage = percent(stats.implemented, stats.planned);

  return (
    <div className="stack">
      <section className="hero">
        <span className="card-hint">Execution-level DSA / DAA visualisation laboratory</span>
        <h1>AlgoViz — the Cinematic Atlas</h1>
        <p>
          Every algorithm here is <strong>executed</strong>, not dramatised: schema-validated input
          runs a real TypeScript reference implementation that records one event per semantic
          transition, maps each event to the exact code lines that caused it, and derives the
          on-screen state from that same trace. Practice questions and mastery scores come from the
          identical trace, so nothing in the app can drift away from what the code actually did.
        </p>
        <div className="stat-row">
          <div className="stat">
            <b>{stats.implemented}</b>
            <span>live algorithms</span>
          </div>
          <div className="stat">
            <b>{stats.planned}</b>
            <span>atlas planned</span>
          </div>
          <div className="stat">
            <b>{stats.categories}</b>
            <span>categories</span>
          </div>
          <div className="stat">
            <b>{stats.totalTestCases}</b>
            <span>declared tests</span>
          </div>
          <div className="stat">
            <b>{coverage}%</b>
            <span>atlas covered</span>
          </div>
        </div>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${coverage}%` }} />
        </div>
        <div className="btn-row" style={{ marginTop: '0.8rem' }}>
          <Link className="btn" to="/progress">
            Track your mastery
          </Link>
          <Link className="btn" to="/atlas">
            Read the atlas contract
          </Link>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <span className="card-title">Live now</span>
            <span className="card-hint">{live.length} executable</span>
          </div>
          <ul className="list">
            {live.map((definition) => (
              <li key={definition.id}>
                <Link to={`/algorithm/${definition.id}`}>{definition.name}</Link>{' '}
                <span className={`badge ${definition.difficulty}`}>{definition.difficulty}</span>{' '}
                <span className="card-hint">
                  {definition.concept.definition.slice(0, 110)}
                  {definition.concept.definition.length > 110 ? '…' : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="card-hint">
            Algorithms land category by category — see the <Link to="/atlas">atlas contract</Link>{' '}
            for the full plan and the definition of done.
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <span className="card-title">What every algorithm ships with</span>
          </div>
          <ul className="list">
            <li>
              <strong>Schema-validated input</strong> — invalid values are rejected with a precise
              reason instead of producing a misleading trace.
            </li>
            <li>
              <strong>Execution-level trace</strong> — every event carries a concrete description,
              the reason it happened and the invariant it preserves.
            </li>
            <li>
              <strong>Line-accurate code mapping</strong> — anchors resolve to real lines of the
              executable TypeScript reference; Python/C++/Java are study snippets without
              fabricated highlights.
            </li>
            <li>
              <strong>Declared test families</strong> — canonical, invalid, empty, singleton,
              determinism and trace-property cases run in CI.
            </li>
            <li>
              <strong>Grounded practice</strong> — questions are generated deterministically from
              the same trace.
            </li>
            <li>
              <strong>Transparent mastery</strong> — 40% trace coverage, 40% practice accuracy, 20%
              exploration, always shown as its parts.
            </li>
          </ul>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <span className="card-title">Browse by category</span>
          <span className="card-hint">{CATEGORIES.length} atlas sections</span>
        </div>
        <div className="grid-2">
          {CATEGORIES.map((category) => {
            const implemented = counts[category.id] ?? 0;
            return (
              <div className="card" key={category.id}>
                <div className="spread">
                  <Link to={`/category/${category.id}`}>
                    <strong>{category.name}</strong>
                  </Link>
                  <span className="badge">{implemented > 0 ? `${implemented} live` : 'planned'}</span>
                </div>
                <p className="card-hint" style={{ marginTop: '0.35rem' }}>
                  {category.blurb}
                </p>
                <span className="card-hint">{category.atlasPages}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}