import { Link, useParams } from 'react-router-dom';
import { CATEGORIES } from '../core/categories';
import { algorithmsByCategory, sortByDifficulty } from '../core/registry';
import type { ProgressApi } from '../hooks/useProgress';

export function CategoryPage({ progress }: { progress: ProgressApi }): React.JSX.Element {
  const { categoryId } = useParams();
  const category = CATEGORIES.find((entry) => entry.id === categoryId);

  if (!category) {
    return (
      <div className="stack">
        <section className="card">
          <div className="card-head">
            <span className="card-title">Unknown category</span>
          </div>
          <p className="muted">
            No category with id <code className="mono">{categoryId ?? ''}</code> exists in the
            atlas.
          </p>
          <Link to="/">← Back home</Link>
        </section>
      </div>
    );
  }

  const algorithms = sortByDifficulty(algorithmsByCategory(category.id));

  return (
    <div className="stack">
      <section className="card">
        <span className="card-hint">Atlas category</span>
        <h1>{category.name}</h1>
        <p>{category.blurb}</p>
        <div className="spread">
          <span className="card-hint">{category.atlasPages}</span>
          <span className="badge">{algorithms.length} live</span>
        </div>
      </section>

      {algorithms.length === 0 ? (
        <section className="card">
          <div className="card-head">
            <span className="card-title">Not implemented yet</span>
          </div>
          <p className="muted">
            No algorithm in this section has shipped yet — the atlas still promises{' '}
            <span className="mono">{category.atlasPages}</span>. Scaffold one with{' '}
            <code className="mono">npm run scaffold -- {category.id} &quot;Algorithm Name&quot;</code>{' '}
            and register it in <code className="mono">src/algorithms/index.ts</code>.
          </p>
        </section>
      ) : (
        <div className="grid-2">
          {algorithms.map((definition) => {
            const mastery = progress.masteryOf(definition.id);
            return (
              <section className="card" key={definition.id}>
                <div className="spread">
                  <Link to={`/algorithm/${definition.id}`}>
                    <strong>{definition.name}</strong>
                  </Link>
                  <span className={`badge ${definition.difficulty}`}>{definition.difficulty}</span>
                </div>
                <span className="card-hint">{definition.subcategory}</span>
                <p style={{ marginTop: '0.35rem' }}>{definition.concept.definition}</p>
                <div className="pill-list">
                  {definition.tags.map((tag) => (
                    <span className="badge" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="spread">
                  <span className="card-hint">
                    mastery {mastery.level} · {mastery.score}%
                  </span>
                  <span className="card-hint">{definition.tests.length} declared tests</span>
                </div>
                <div className="progress-track" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${mastery.score}%` }} />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}