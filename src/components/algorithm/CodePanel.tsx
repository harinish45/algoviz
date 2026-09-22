import { useMemo, useState } from 'react';
import type { AnyAlgorithmDefinition, Language } from '../../core/types';

interface CodePanelProps {
  definition: AnyAlgorithmDefinition;
  /** Line range of the active event (TypeScript reference implementation). */
  activeRange?: { lineStart: number; lineEnd: number };
}

const LANGUAGE_LABELS: Record<Language, string> = {
  typescript: 'TypeScript (executable reference)',
  python: 'Python',
  cpp: 'C++',
  java: 'Java',
  c: 'C'
};

const ORDER: Language[] = ['typescript', 'python', 'cpp', 'java', 'c'];

/**
 * Code panel with line-level synchronisation.
 *
 * The TypeScript snippet *is* the implementation that produced the trace, so
 * the highlighted lines always correspond to the recorded event. For the other
 * languages the same algorithm is shown for study; no highlight is fabricated
 * when no mapping has been declared.
 */
export function CodePanel({ definition, activeRange }: CodePanelProps): React.JSX.Element {
  const [language, setLanguage] = useState<Language>('typescript');
  const available = useMemo(
    () => ORDER.filter((candidate) => Boolean(definition.implementations[candidate])),
    [definition]
  );
  const source = definition.implementations[language] ?? '';
  const lines = useMemo(() => source.replace(/\r\n/g, '\n').split('\n'), [source]);
  const highlight = language === 'typescript' ? activeRange : undefined;

  return (
    <section className="card" aria-label="Code panel">
      <div className="card-head">
        <span className="card-title">Code</span>
        <span className="card-hint">
          {highlight
            ? `executing lines ${highlight.lineStart}${
                highlight.lineEnd !== highlight.lineStart ? `–${highlight.lineEnd}` : ''
              }`
            : 'line mapping is declared for the executable TypeScript reference'}
        </span>
      </div>

      <div className="btn-row" role="tablist" aria-label="Implementation language">
        {available.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={language === candidate}
            aria-pressed={language === candidate}
            onClick={() => setLanguage(candidate)}
          >
            {LANGUAGE_LABELS[candidate]}
          </button>
        ))}
      </div>

      <pre className="code-block" tabIndex={0} aria-label={`${definition.name} in ${language}`}>
        {lines.map((line, index) => {
          const lineNumber = index + 1;
          const isActive =
            highlight !== undefined &&
            lineNumber >= highlight.lineStart &&
            lineNumber <= highlight.lineEnd;
          return (
            <span
              className={`code-line${isActive ? ' highlight' : ''}`}
              key={`${lineNumber}-${line}`}
              data-line={lineNumber}
            >
              <span className="code-num" aria-hidden="true">
                {lineNumber}
              </span>
              <span>{line.length === 0 ? ' ' : line}</span>
            </span>
          );
        })}
      </pre>

      <p className="card-hint">
        {definition.outputSchema} — {definition.visualNotes}
      </p>
    </section>
  );
}
