import { useMemo, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { CATEGORIES } from '../core/categories';
import {
  algorithmsByCategory,
  countByCategory,
  registryStats,
  searchAlgorithms
} from '../core/registry';
import type { MasteryBreakdown } from '../core/progress';

interface SidebarProps {
  masteryOf: (algorithmId: string) => MasteryBreakdown;
}

const MASTERY_GLYPH: Record<MasteryBreakdown['level'], string> = {
  unseen: '○',
  exploring: '◔',
  practising: '◑',
  mastered: '●'
};

function SearchPalette(): React.JSX.Element {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const hits = useMemo(() => searchAlgorithms(query, 8), [query]);
  return (
    <div className="stack" style={{ marginBottom: '0.9rem' }}>
      <label htmlFor="algo-search">Find an algorithm</label>
      <input
        id="algo-search"
        type="text"
        value={query}
        placeholder="binary search, dijkstra, kmp…"
        onChange={(event) => setQuery(event.target.value)}
        aria-describedby="algo-search-hint"
      />
      <span id="algo-search-hint" className="card-hint">
        {query.trim()
          ? `${hits.length} match(es) across name, tags and concept text`
          : 'Searches names, tags, categories and concept definitions'}
      </span>
      {hits.length > 0 ? (
        <div className="stack" role="list">
          {hits.map((hit) => (
            <button
              className="search-hit"
              key={hit.definition.id}
              type="button"
              onClick={() => {
                navigate(`/algorithm/${hit.definition.id}`);
                setQuery('');
              }}
            >
              {hit.definition.name}
              <span className="card-hint"> · {hit.definition.category}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({ masteryOf }: SidebarProps): React.JSX.Element {
  const counts = countByCategory();
  const stats = registryStats();
  const { algorithmId } = useParams();
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          AV
        </span>
        <span>
          <span className="brand-title">AlgoViz</span>
          <br />
          <span className="brand-sub">Cinematic Atlas · execution-level DSA/DAA</span>
        </span>
      </div>

      <nav aria-label="Algorithms by category" className="stack">
        <SearchPalette />
        <NavLink to="/" className="btn" end>
          Home · coverage
        </NavLink>
        <NavLink to="/progress" className="btn">
          My progress · mastery
        </NavLink>
        <NavLink to="/atlas" className="btn">
          Atlas contract · docs
        </NavLink>

        {CATEGORIES.map((category) => {
          const implemented = counts[category.id] ?? 0;
          return (
            <div key={category.id}>
              <NavLink
                to={`/category/${category.id}`}
                className="spread"
                style={{ padding: '0.25rem 0', color: 'var(--text-0)' }}
              >
                <span style={{ fontWeight: 600 }}>{category.name}</span>
                <span className="badge">
                  {implemented > 0 ? `${implemented} live` : 'planned'}
                </span>
              </NavLink>
              <span className="card-hint">{category.blurb}</span>
              <MasteryDots categoryId={category.id} masteryOf={masteryOf} activeId={algorithmId} />
            </div>
          );
        })}
      </nav>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-title">Atlas coverage</div>
        <p className="card-hint">
          {stats.implemented} of {stats.planned} planned algorithms are executable end to end ·{' '}
          {stats.totalTestCases} declared test cases
        </p>
        <div className="progress-track" aria-hidden="true">
          <div
            className="progress-fill"
            style={{ width: `${Math.round((stats.implemented / stats.planned) * 100)}%` }}
          />
        </div>
      </div>
    </aside>
  );
}

function MasteryDots({
  categoryId,
  masteryOf,
  activeId
}: {
  categoryId: string;
  masteryOf: (algorithmId: string) => MasteryBreakdown;
  activeId?: string;
}): React.JSX.Element | null {
  const algorithms = useMemo(
    () => algorithmsByCategory(categoryId as never),
    [categoryId]
  );
  if (algorithms.length === 0) return null;
  return (
    <ul className="list" style={{ listStyle: 'none', paddingLeft: 0, marginTop: '0.25rem' }}>
      {algorithms.map((definition) => {
        const mastery = masteryOf(definition.id);
        return (
          <li key={definition.id}>
            <Link
              to={`/algorithm/${definition.id}`}
              aria-label={`${definition.name} — ${mastery.level} mastery, score ${mastery.score}%`}
              style={{
                color: definition.id === activeId ? 'var(--accent-3)' : 'var(--text-1)',
                fontSize: '0.84rem'
              }}
            >
              <span aria-hidden="true">{MASTERY_GLYPH[mastery.level]}</span> {definition.name}
              <span className="card-hint"> · {mastery.score}%</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
