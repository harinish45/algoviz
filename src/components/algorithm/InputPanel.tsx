import type { AlgorithmInputSchema, InputField } from '../../core/types';
import type { ValidationIssue } from '../../core/validation';
import {
  formatEdges,
  formatIntervals,
  formatItems,
  formatMatrix,
  formatNumberList,
  parseEdges,
  parseIntervals,
  parseItems,
  parseMatrix,
  parseNumberList
} from './parsing';

interface InputPanelProps {
  schema: AlgorithmInputSchema;
  value: Record<string, unknown>;
  issues: ValidationIssue[];
  onChange: (value: Record<string, unknown>) => void;
  onReset: () => void;
  onRun: () => void;
}

function textValue(field: InputField, raw: unknown): string {
  switch (field.kind) {
    case 'int-array':
      return formatNumberList(raw);
    case 'int-matrix':
      return formatMatrix(raw);
    case 'edges':
      return formatEdges(raw);
    case 'intervals':
      return formatIntervals(raw);
    case 'items':
      return formatItems(raw);
    case 'number':
      return raw === undefined || raw === null ? '' : String(raw);
    case 'text':
      return typeof raw === 'string' ? raw : '';
    default:
      return '';
  }
}

function fromText(field: InputField, text: string): unknown {
  switch (field.kind) {
    case 'int-array':
      return parseNumberList(text);
    case 'int-matrix':
      return parseMatrix(text);
    case 'edges':
      return parseEdges(text);
    case 'intervals':
      return parseIntervals(text);
    case 'items':
      return parseItems(text);
    case 'number': {
      const trimmed = text.trim();
      if (trimmed.length === 0) return undefined;
      const value = Number(trimmed);
      return Number.isFinite(value) ? value : trimmed;
    }
    case 'text':
      return text;
    default:
      return text;
  }
}

/**
 * Input panel generated from the algorithm's own `inputSchema`.
 * One field renderer covers every input shape, so no algorithm needs bespoke
 * form code, and validation issues are reported per field path.
 */
export function InputPanel({
  schema,
  value,
  issues,
  onChange,
  onReset,
  onRun
}: InputPanelProps): React.JSX.Element {
  const issuesFor = (field: string): ValidationIssue[] =>
    issues.filter((issue) => issue.path === field || issue.path.startsWith(`${field}[`));

  const setField = (field: string, parsed: unknown): void => {
    onChange({ ...value, [field]: parsed });
  };

  const isTextLike = (kind: InputField['kind']): boolean =>
    kind === 'int-array' ||
    kind === 'int-matrix' ||
    kind === 'edges' ||
    kind === 'intervals' ||
    kind === 'items' ||
    kind === 'text';

  return (
    <section className="card" aria-label="Input panel">
      <div className="card-head">
        <span className="card-title">Input</span>
        <span className="card-hint">{schema.summary}</span>
      </div>

      <div className="row" style={{ marginBottom: '0.6rem' }}>
        {schema.examples.map((example) => (
          <button
            key={example.label}
            type="button"
            title={example.note}
            onClick={() => onChange(example.value as Record<string, unknown>)}
          >
            {example.label}
          </button>
        ))}
      </div>

      {schema.fields.map((field) => {
        const fieldIssues = issuesFor(field.name);
        const describedBy = fieldIssues.length > 0 ? `${field.name}-error` : undefined;
        return (
          <div className="field" key={field.name}>
            <label htmlFor={field.name}>{field.label}</label>

            {field.kind === 'boolean' ? (
              <input
                id={field.name}
                type="checkbox"
                checked={Boolean(value[field.name])}
                onChange={(event) => setField(field.name, event.target.checked)}
                style={{ width: 'auto' }}
                aria-describedby={describedBy}
              />
            ) : null}

            {field.kind === 'enum' ? (
              <select
                id={field.name}
                value={String(value[field.name] ?? field.default)}
                onChange={(event) => setField(field.name, event.target.value)}
                aria-describedby={describedBy}
              >
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : null}

            {field.kind === 'number' ? (
              <input
                id={field.name}
                type="text"
                inputMode="numeric"
                value={textValue(field, value[field.name])}
                onChange={(event) => setField(field.name, fromText(field, event.target.value))}
                aria-describedby={describedBy}
              />
            ) : null}

            {isTextLike(field.kind) ? (
              <textarea
                id={field.name}
                value={textValue(field, value[field.name])}
                onChange={(event) => setField(field.name, fromText(field, event.target.value))}
                aria-describedby={describedBy}
                spellCheck={false}
                rows={field.kind === 'int-array' || field.kind === 'text' ? 2 : 4}
              />
            ) : null}

            {field.help ? <span className="card-hint">{field.help}</span> : null}
            {fieldIssues.length > 0 ? (
              <ul className="list" id={`${field.name}-error`} style={{ color: 'var(--danger)' }}>
                {fieldIssues.map((issue) => (
                  <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}

      <div className="btn-row">
        <button type="button" className="primary" onClick={onRun}>
          Run / re-run trace
        </button>
        <button type="button" onClick={onReset}>
          Reset to defaults
        </button>
      </div>
      <p className="card-hint" style={{ marginTop: '0.5rem' }}>
        Input is validated against the algorithm schema; invalid values are rejected with a reason
        instead of producing a misleading trace.
      </p>
    </section>
  );
}

