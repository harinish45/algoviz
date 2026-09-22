import { Link } from 'react-router-dom';
import { CATEGORIES } from '../core/categories';
import { percent } from '../core/format';
import { countByCategory, registryStats } from '../core/registry';
import { CORE_EVENT_TYPES } from '../core/types';

/** Planned count is written inside each category's atlasPages blurb, e.g. "(25 algorithms)". */
function plannedFrom(atlasPages: string): number {
  const match = /\((\d+)\s+algorithms\)/.exec(atlasPages);
  return match ? Number(match[1]) : 0;
}

const DEFINITION_OF_DONE = [
  'Input schema with examples; invalid inputs rejected with a per-field reason.',
  'Executable TypeScript reference implementation plus Python, C++ and Java study snippets (>20 chars each).',
  'Trace records one event per semantic transition — each with title, description, why and (usually) a code anchor.',
  'Anchors resolve to real, unique lines of the reference implementation (executable code, never display text).',
  'Visualisation derived only from event highlights/mutations — no hidden state in the view.',
  'Declared tests covering canonical, invalid, empty and singleton inputs plus a trace-property/counters assertion.',
  'Determinism: identical input produces an identical trace (checked in CI).',
  'Concept doc with intuition, invariants, correctness argument and common mistakes.',
  'Complexity documented for best, average and worst case (no placeholder text).',
  'Practice questions generated from the trace, graded deterministically.'
];

const TEST_FAMILIES: { family: string; purpose: string }[] = [
  { family: 'canonical', purpose: 'The textbook example the explanation quotes.' },
  { family: 'invalid', purpose: 'Must be rejected by validation with a reason — never executed.' },
  { family: 'empty', purpose: 'Zero-length input exercises the degenerate bound safely.' },
  { family: 'singleton', purpose: 'One element — loops and recursion must terminate immediately.' },
  { family: 'minimum', purpose: 'Smallest interesting non-trivial structure.' },
  { family: 'maximum', purpose: 'Largest documented size / stress path.' },
  { family: 'duplicates', purpose: 'Repeated values expose unstable or equality-blind logic.' },
  { family: 'already-solved', purpose: 'Best case — adaptive algorithms must exploit it.' },
  { family: 'adversarial', purpose: 'Worst case for the algorithm’s specific decision rule.' },
  { family: 'determinism', purpose: 'Same input executed twice yields an identical trace.' },
  { family: 'trace-property', purpose: 'Counters and event types must match the real execution.' }
];

export function AtlasPage(): React.JSX.Element {
  const stats = registryStats();
  const counts = countByCategory();
  const plannedTotal = CATEGORIES.reduce(
    (sum, category) => sum + plannedFrom(category.atlasPages),
    0
  );

  return (
    <div className="stack">
      <section className="hero">
        <span className="card-hint">Source of truth</span>
        <h1>The Cinematic Atlas contract</h1>
        <p>
          The atlas promises <strong>{plannedTotal} algorithms</strong> across{' '}
          <strong>{CATEGORIES.length} categories</strong>; <strong>{stats.implemented}</strong> are
          live and executable today ({percent(stats.implemented, stats.planned)}% coverage,{' '}
          {stats.totalTestCases} declared tests). Planned entries are indexed but not routable — an
          algorithm only appears in the sidebar once it satisfies the definition of done below.
        </p>
        <div className="stat-row">
          <div className="stat">
            <b>{stats.implemented}</b>
            <span>live</span>
          </div>
          <div className="stat">
            <b>{plannedTotal}</b>
            <span>planned</span>
          </div>
          <div className="stat">
            <b>{CATEGORIES.length}</b>
            <span>categories</span>
          </div>
          <div className="stat">
            <b>{stats.totalTestCases}</b>
            <span>test cases</span>
          </div>
        </div>
        <p className="card-hint">
          The coverage table is regenerated straight from the sources with{' '}
          <code className="mono">npm run atlas</code> — see{' '}
          <code className="mono">docs/ATLAS.md</code>.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <span className="card-title">Categories & coverage</span>
        </div>
        <div className="table-grid">
          <table className="data">
            <thead>
              <tr>
                <th>Category</th>
                <th>Atlas pages</th>
                <th className="num">Planned</th>
                <th className="num">Live</th>
                <th className="num">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category) => {
                const planned = plannedFrom(category.atlasPages);
                const live = counts[category.id] ?? 0;
                return (
                  <tr key={category.id}>
                    <td>
                      <Link to={`/category/${category.id}`}>{category.name}</Link>
                    </td>
                    <td className="mono">{category.atlasPages}</td>
                    <td className="num">{planned}</td>
                    <td className="num">{live}</td>
                    <td className="num">{percent(live, planned)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <span className="card-title">Definition of done</span>
            <span className="card-hint">enforced by validateRegistry + CI</span>
          </div>
          <ul className="list">
            {DEFINITION_OF_DONE.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-head">
            <span className="card-title">Mastery model</span>
          </div>
          <ul className="list">
            <li>
              <strong>40% trace coverage</strong> — the fraction of the canonical trace you actually
              stepped through.
            </li>
            <li>
              <strong>40% practice accuracy</strong> — graded attempts against trace-grounded
              questions.
            </li>
            <li>
              <strong>20% exploration</strong> — concept, code and complexity panels viewed, plus
              completed runs.
            </li>
          </ul>
          <p className="card-hint">
            Scores are always shown with their breakdown — never as an opaque number. Stored locally
            in your browser; reset any time from the <Link to="/progress">progress page</Link>.
          </p>
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <span className="card-title">Test families every algorithm declares</span>
          </div>
          <div className="table-grid">
            <table className="data">
              <thead>
                <tr>
                  <th>Family</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {TEST_FAMILIES.map((entry) => (
                  <tr key={entry.family}>
                    <td className="mono">{entry.family}</td>
                    <td>{entry.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <span className="card-title">Canonical event types</span>
            <span className="card-hint">algorithms may add more and document them</span>
          </div>
          <div className="pill-list">
            {CORE_EVENT_TYPES.map((type) => (
              <span className="badge" key={type}>
                {type}
              </span>
            ))}
          </div>
          <p className="card-hint">
            Every event carries a 1-based contiguous step, a concrete title and description, the why
            behind the transition, an optional invariant, a chained stateBefore → stateAfter pair,
            and visualization highlights/mutations/annotations. Counters equal the sum of per-event
            complexity impacts — CI proves it — and traces are JSON-serialisable so runs can be
            replayed and diffed.
          </p>
        </section>
      </div>
    </div>
  );
}