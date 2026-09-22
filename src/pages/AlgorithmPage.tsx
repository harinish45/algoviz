import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CATEGORIES } from '../core/categories';
import { formatValue } from '../core/format';
import { getAlgorithm } from '../core/registry';
import { addCounters, emptyCounters } from '../core/trace';
import { formatIssues } from '../core/validation';
import type {
  AlgorithmInputSchema,
  AnyAlgorithmDefinition,
  ComplexityCounters,
  ExecutionTrace,
  VisualizationState
} from '../core/types';
import { CodePanel } from '../components/algorithm/CodePanel';
import { ControlsBar } from '../components/algorithm/ControlsBar';
import { ExplanationPanel } from '../components/algorithm/ExplanationPanel';
import { InputPanel } from '../components/algorithm/InputPanel';
import { PracticePanel } from '../components/algorithm/PracticePanel';
import { useAlgorithmTrace } from '../hooks/useAlgorithmTrace';
import { usePlayer } from '../hooks/usePlayer';
import type { ProgressApi } from '../hooks/useProgress';
import { VisualizationCanvas } from '../visualization/VisualizationCanvas';

type TabId = 'visualize' | 'concept' | 'code' | 'complexity' | 'practice' | 'tests';

const TABS: { id: TabId; label: string }[] = [
  { id: 'visualize', label: 'Visualise' },
  { id: 'concept', label: 'Concept' },
  { id: 'code', label: 'Code' },
  { id: 'complexity', label: 'Complexity' },
  { id: 'practice', label: 'Practice' },
  { id: 'tests', label: 'Tests' }
];

function defaultInput(schema: AlgorithmInputSchema): Record<string, unknown> {
  return Object.fromEntries(schema.fields.map((field) => [field.name, field.default]));
}

export function AlgorithmPage({ progress }: { progress: ProgressApi }): React.JSX.Element {
  const { algorithmId } = useParams();
  const definition = algorithmId ? getAlgorithm(algorithmId) : undefined;

  if (!definition) {
    return (
      <div className="stack">
        <section className="card">
          <div className="card-head">
            <span className="card-title">Algorithm not found</span>
          </div>
          <p className="muted">
            No registered algorithm with id{' '}
            <code className="mono">{algorithmId ?? ''}</code>. Planned atlas entries are indexed but
            not routable yet — browse the <Link to="/atlas">atlas contract</Link> for the full plan.
          </p>
          <Link to="/">← Back home</Link>
        </section>
      </div>
    );
  }

  // key: a different algorithm fully remounts the workspace (fresh input/player state).
  return <AlgorithmWorkspace key={definition.id} definition={definition} progress={progress} />;
}

function AlgorithmWorkspace({
  definition,
  progress
}: {
  definition: AnyAlgorithmDefinition;
  progress: ProgressApi;
}): React.JSX.Element {
  const category = CATEGORIES.find((entry) => entry.id === definition.category);
  const [rawInput, setRawInput] = useState<Record<string, unknown>>(() =>
    defaultInput(definition.inputSchema)
  );
  const [tab, setTab] = useState<TabId>('visualize');

  const result = useAlgorithmTrace(definition, rawInput);
  const trace: ExecutionTrace<unknown, unknown> | undefined = result.ok ? result.trace : undefined;
  const player = usePlayer(trace?.events.length ?? 0);
  const step = player.state.index;
  const total = trace?.events.length ?? 0;

  const visitedRef = useRef(false);
  useEffect(() => {
    if (visitedRef.current) return;
    visitedRef.current = true;
    progress.visit(definition.id);
  }, [progress, definition.id]);

  const lastStepRef = useRef(-1);
  useEffect(() => {
    if (lastStepRef.current === step) return;
    lastStepRef.current = step;
    progress.step(definition.id, step, total);
    if (total > 0 && step >= total) progress.runComplete(definition.id);
  }, [progress, step, total, definition.id]);

  const lastPanelRef = useRef('');
  useEffect(() => {
    if (tab !== 'concept' && tab !== 'code' && tab !== 'complexity') return;
    const key = `${definition.id}:${tab}`;
    if (lastPanelRef.current === key) return;
    lastPanelRef.current = key;
    progress.panel(definition.id, tab);
  }, [progress, tab, definition.id]);

  const eventIndex = player.eventIndex;
  const event =
    trace && eventIndex >= 0 && eventIndex < trace.events.length ? trace.events[eventIndex] : undefined;

  const counters = useMemo<ComplexityCounters>(() => {
    const totals = emptyCounters();
    if (!trace) return totals;
    const visible = Math.min(step, trace.events.length);
    for (let index = 0; index < visible; index += 1) {
      addCounters(totals, trace.events[index].complexityImpact);
    }
    return totals;
  }, [trace, step]);

  const visual = useMemo<VisualizationState>(() => {
    if (event) return definition.visualize(event, event.stateAfter);
    return {
      kind: 'text',
      lines: trace
        ? [
            'Step 0 — the input passed validation; execution has not started.',
            `Play or step forward: ${total} recorded event(s) await.`
          ]
        : ['Waiting for a valid input to execute.'],
      caption: `${definition.name} · initial state`
    };
  }, [event, definition, trace, total]);

  const announcement = event
    ? `Step ${event.step} of ${total}: ${event.title}`
    : `Step 0 of ${total}: initial state`;

  const mastery = progress.masteryOf(definition.id);

  const handleInput = (value: Record<string, unknown>): void => {
    setRawInput(value);
    player.jumpTo(0);
  };

  const handleRun = (): void => {
    player.jumpTo(0);
    player.play();
  };

  const handleReset = (): void => {
    setRawInput(defaultInput(definition.inputSchema));
    player.jumpTo(0);
  };

  const handlePracticeResult = (correct: boolean): void => {
    progress.practiceResult(definition.id, correct);
  };
  return (
    <div className="stack">
      <section className="card">
        <div className="spread">
          <div>
            <span className="card-hint">
              {category ? category.name : definition.category} · {definition.subcategory}
            </span>
            <h1>{definition.name}</h1>
          </div>
          <div className="row">
            <span className={`badge ${definition.difficulty}`}>{definition.difficulty}</span>
            <span className="badge">{mastery.level}</span>
          </div>
        </div>
        <div className="pill-list">
          {definition.tags.map((tag) => (
            <span className="badge" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <p>{definition.concept.definition}</p>
        <div className="spread">
          <span className="card-hint">
            mastery {mastery.score}% · coverage {Math.round(mastery.coverage * 100)}% · practice{' '}
            {Math.round(mastery.practice * 100)}% · exploration{' '}
            {Math.round(mastery.exploration * 100)}%
          </span>
          <span className="card-hint">
            {total} steps · {definition.tests.length} declared tests
          </span>
        </div>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${mastery.score}%` }} />
        </div>
        <div className="spread">
          <span className="card-hint">prerequisites: {definition.prerequisites.join(' · ')}</span>
          <span className="row">
            <span className="card-hint">related:</span>
            {definition.related.map((relatedId) =>
              getAlgorithm(relatedId) ? (
                <Link className="badge" key={relatedId} to={`/algorithm/${relatedId}`}>
                  {relatedId}
                </Link>
              ) : (
                <span className="badge" key={relatedId}>
                  {relatedId} (planned)
                </span>
              )
            )}
          </span>
        </div>
      </section>

      <div className="tabs" role="tablist" aria-label="Algorithm sections">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === entry.id}
            aria-controls={`panel-${entry.id}`}
            id={`tab-${entry.id}`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'visualize' ? (
        <div role="tabpanel" id="panel-visualize" aria-labelledby="tab-visualize">
          <div className="grid-2">
            <div className="stack">
              <InputPanel
                schema={definition.inputSchema}
                value={rawInput}
                issues={result.issues}
                onChange={handleInput}
                onReset={handleReset}
                onRun={handleRun}
              />
              {trace ? <ControlsBar player={player} trace={trace} /> : null}
            </div>
            <div className="stack">
              {!result.ok ? (
                <section className="card error-banner">
                  <div className="card-head">
                    <span className="card-title">Input rejected</span>
                  </div>
                  <p className="mono">{formatIssues(result.issues)}</p>
                </section>
              ) : null}
              {trace ? <VisualizationCanvas visual={visual} announcement={announcement} /> : null}
              {trace && event ? (
                <ExplanationPanel event={event} counters={counters} step={step} total={total} />
              ) : null}
              {trace ? (
                <section className="card">
                  <div className="card-head">
                    <span className="card-title">Run summary</span>
                    <span className="card-hint">{trace.determinism}</span>
                  </div>
                  <ul className="list">
                    {trace.summary.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {trace.warnings.length > 0 ? (
                    <ul className="list">
                      {trace.warnings.map((warning) => (
                        <li key={warning}>⚠ {warning}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {tab === 'concept' ? (
        <div role="tabpanel" id="panel-concept" aria-labelledby="tab-concept" className="stack">
          <section className="card">
            <div className="card-head">
              <span className="card-title">Problem & definition</span>
            </div>
            <p>{definition.concept.definition}</p>
            <p>{definition.concept.problem}</p>
            <div className="viz-label">Visual model</div>
            <p>{definition.visualModel}</p>
            <p className="card-hint">{definition.visualNotes}</p>
          </section>

          <div className="grid-2">
            <section className="card">
              <div className="card-head">
                <span className="card-title">Intuition & motivation</span>
              </div>
              <p>{definition.concept.intuition}</p>
              <p>{definition.concept.motivation}</p>
            </section>
            <section className="card">
              <div className="card-head">
                <span className="card-title">When to use / avoid</span>
              </div>
              <div className="viz-label">Use it when</div>
              <ul className="list">
                {definition.concept.whenToUse.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="viz-label">Avoid it when</div>
              <ul className="list">
                {definition.concept.whenNotToUse.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>

          <div className="grid-2">
            <section className="card">
              <div className="card-head">
                <span className="card-title">Preconditions & invariants</span>
              </div>
              <ul className="list">
                {definition.concept.preconditions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                {definition.concept.invariants.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="viz-label">Correctness argument</div>
              <p>{definition.concept.correctness}</p>
            </section>
            <section className="card">
              <div className="card-head">
                <span className="card-title">Common mistakes</span>
              </div>
              <ul className="list">
                {definition.concept.commonMistakes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="viz-label">Applications</div>
              <ul className="list">
                {(definition.concept.applications ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="viz-label">Variants</div>
              <ul className="list">
                {(definition.concept.variants ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>

          <section className="card">
            <div className="card-head">
              <span className="card-title">Output contract</span>
            </div>
            <p className="mono">{definition.outputSchema}</p>
          </section>
        </div>
      ) : null}

      {tab === 'code' ? (
        <div role="tabpanel" id="panel-code" aria-labelledby="tab-code" className="stack">
          <CodePanel definition={definition} activeRange={event?.codeReference} />
          <section className="card">
            <div className="card-head">
              <span className="card-title">About these listings</span>
            </div>
            <p className="card-hint">
              Only the TypeScript listing is the executable reference — line numbers come from
              resolving anchors inside that exact string, so highlights can never drift. Python,
              C++ and Java are study snippets shown without line highlights: a fabricated mapping
              would lie about which line actually ran.
            </p>
          </section>
        </div>
      ) : null}
      {tab === 'complexity' ? (
        <div role="tabpanel" id="panel-complexity" aria-labelledby="tab-complexity" className="stack">
          <section className="card">
            <div className="card-head">
              <span className="card-title">Asymptotic complexity</span>
            </div>
            <div className="table-grid">
              <table className="data">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Bound</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Best</td>
                    <td className="mono">{definition.complexity.best}</td>
                  </tr>
                  <tr>
                    <td>Average</td>
                    <td className="mono">{definition.complexity.average}</td>
                  </tr>
                  <tr>
                    <td>Worst</td>
                    <td className="mono">{definition.complexity.worst}</td>
                  </tr>
                  <tr>
                    <td>Space</td>
                    <td className="mono">{definition.complexity.space}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {definition.complexity.properties ? (
              <div className="pill-list">
                {definition.complexity.properties.map((property) => (
                  <span className="badge" key={property}>
                    {property}
                  </span>
                ))}
              </div>
            ) : null}
            {definition.complexity.inputSensitive ? (
              <p>
                <strong>Input sensitive:</strong> {definition.complexity.inputSensitive}
              </p>
            ) : null}
            {definition.complexity.notes ? <p>{definition.complexity.notes}</p> : null}
          </section>

          <section className="card">
            <div className="card-head">
              <span className="card-title">Live counters</span>
              <span className="card-hint">sum of per-event impacts up to step {step}</span>
            </div>
            <div className="table-grid">
              <table className="data">
                <thead>
                  <tr>
                    {Object.keys(counters).map((key) => (
                      <th className="num" key={key}>
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {Object.values(counters).map((value, position) => (
                      <td className="num" key={position}>
                        {value}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="card-hint">
              {trace
                ? `Full-run totals: ${
                    Object.entries(trace.counters)
                      .filter(([, value]) => value !== 0)
                      .map(([key, value]) => `${key}=${value}`)
                      .join(' · ') || 'the full run recorded zero counted operations'
                  }`
                : 'Run a valid input to populate counters.'}
            </p>
          </section>
        </div>
      ) : null}

      {tab === 'practice' ? (
        <div role="tabpanel" id="panel-practice" aria-labelledby="tab-practice">
          {trace ? (
            <PracticePanel definition={definition} trace={trace} onResult={handlePracticeResult} />
          ) : (
            <section className="card">
              <div className="card-head">
                <span className="card-title">Practice</span>
              </div>
              <p className="muted">
                Practice questions are generated from a valid execution trace — fix the input on the
                Visualise tab and come back.
              </p>
            </section>
          )}
        </div>
      ) : null}
      {tab === 'tests' ? (
        <div role="tabpanel" id="panel-tests" aria-labelledby="tab-tests" className="stack">
          <section className="card">
            <div className="card-head">
              <span className="card-title">Declared test cases</span>
              <span className="card-hint">executed by npm run test and the contract suite</span>
            </div>
            <div className="table-grid">
              <table className="data">
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Family</th>
                    <th>Expectation</th>
                  </tr>
                </thead>
                <tbody>
                  {definition.tests.map((testCase) => {
                    const expectation = testCase.expect;
                    const summary = expectation.rejects
                      ? 'rejected by input validation with a reason'
                      : [
                          expectation.result !== undefined
                            ? `result ${formatValue(expectation.result, 160)}`
                            : '',
                          expectation.predicate ? `predicate: ${expectation.predicate}` : '',
                          expectation.eventTypes
                            ? `events ⊇ [${expectation.eventTypes.join(', ')}]`
                            : '',
                          expectation.minEvents !== undefined
                            ? `≥ ${expectation.minEvents} events`
                            : ''
                        ]
                          .filter((part) => part.length > 0)
                          .join(' · ');
                    return (
                      <tr key={testCase.id}>
                        <td className="mono">{testCase.id}</td>
                        <td>
                          <span className="badge">{testCase.family}</span>
                        </td>
                        <td>
                          {summary || 'no expectation'}
                          {testCase.name ? ` — ${testCase.name}` : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="card-hint">
              CI additionally verifies determinism (same input → identical trace), trace hygiene
              (chained states, non-empty explanations, JSON serialisability) and registry
              validation for every algorithm on every push.
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}