import type {
  ArrayVisual,
  BarsVisual,
  BitsVisual,
  CallStackVisual,
  CellVisual,
  EdgeVisual,
  LegendEntry,
  NodeVisual,
  NodesVisual,
  PlaneVisual,
  QueueVisual,
  StackVisual,
  StringVisual,
  TableVisual,
  TextVisual,
  VisualizationState
} from '../core/types';

/**
 * Visualisation runtime.
 *
 * One generic renderer per visual kind — no algorithm-specific drawing code.
 * Everything is driven by the `VisualizationState` produced from the active
 * execution event, so a highlight in the trace always becomes a visible change.
 *
 * Accessibility: every element exposes `role="img"` with a label that includes
 * its value, index and semantic state, so state is never conveyed by colour
 * alone, and the container announces the active step with `aria-live="polite"`.
 */

interface CanvasProps {
  visual: VisualizationState;
  /** Screen-reader friendly description of the active step. */
  announcement?: string;
}

function LegendRow({ legend }: { legend?: LegendEntry[] }): React.JSX.Element | null {
  if (!legend || legend.length === 0) return null;
  return (
    <div className="pointers" aria-label="state legend">
      {legend.map((entry) => (
        <span className="pointer" key={entry.state}>
          <span
            aria-hidden="true"
            data-state={entry.state}
            style={{
              display: 'inline-block',
              width: '0.6rem',
              height: '0.6rem',
              borderRadius: '3px',
              marginRight: '0.3rem'
            }}
          />
          {entry.label} <code>({entry.state})</code>
        </span>
      ))}
    </div>
  );
}

function Pointers({ pointers }: { pointers?: { id: string; label: string; target: string }[] }) {
  if (!pointers || pointers.length === 0) return null;
  return (
    <div className="pointers" aria-label="cursors">
      {pointers.map((pointer) => (
        <span className="pointer" key={pointer.id}>
          {pointer.label} → <code>{pointer.target}</code>
        </span>
      ))}
    </div>
  );
}

function Cell({ cell }: { cell: CellVisual }): React.JSX.Element {
  const state = cell.state ?? 'idle';
  const label = `cell ${cell.id ?? ''} value ${cell.value ?? 'empty'}${
    cell.badge ? `, ${cell.badge}` : ''
  }, state ${state}`;
  return (
    <div
      className={`cell${cell.value === '·' ? ' empty' : ''}`}
      data-state={state}
      role="img"
      aria-label={label}
      title={label}
    >
      <span className="cell-value">{cell.value ?? '·'}</span>
      {cell.label !== undefined ? <span className="cell-label">{cell.label}</span> : null}
      {cell.badge ? <span className="cell-badge">{cell.badge}</span> : null}
    </div>
  );
}

function CellRow({ cells }: { cells: CellVisual[] }): React.JSX.Element {
  if (cells.length === 0) {
    return <p className="muted">(empty)</p>;
  }
  return (
    <div className="cells">
      {cells.map((cell, index) => (
        <Cell cell={cell} key={cell.id ?? `cell-${index}`} />
      ))}
    </div>
  );
}

function ArrayView({ visual }: { visual: ArrayVisual }): React.JSX.Element {
  return (
    <div>
      <CellRow cells={visual.cells} />
      <Pointers pointers={visual.pointers} />
    </div>
  );
}

function BarsView({ visual }: { visual: BarsVisual }): React.JSX.Element {
  const max = Math.max(1, ...visual.bars.map((bar) => Math.abs(bar.value)));
  return (
    <div>
      {visual.guide ? (
        <div className="guide">
          {visual.guide.label} = {visual.guide.value}
        </div>
      ) : null}
      <div className="bars" role="img" aria-label={visual.caption}>
        {visual.bars.map((bar) => {
          const state = bar.state ?? 'idle';
          const height = Math.max(8, Math.round((Math.abs(bar.value) / max) * 150));
          return (
            <div className="bar-wrap" key={bar.id}>
              <div
                className="bar"
                data-state={state}
                style={{ height: `${height}px` }}
                aria-label={`bar ${bar.id} value ${bar.value}${bar.badge ? `, ${bar.badge}` : ''}, state ${state}`}
                title={`${bar.value}${bar.badge ? ` — ${bar.badge}` : ''}`}
              >
                <span className="bar-value">{bar.value}</span>
              </div>
              {bar.label !== undefined ? <span className="cell-label">{bar.label}</span> : null}
              {bar.badge ? <span className="cell-badge">{bar.badge}</span> : null}
            </div>
          );
        })}
      </div>
      <Pointers pointers={visual.pointers} />
    </div>
  );
}

function nodeLabel(node: NodeVisual): string {
  return `${node.label}${node.sub ? ` (${node.sub})` : ''}${node.badge ? ` [${node.badge}]` : ''}`;
}

function NodesListView({ visual }: { visual: NodesVisual }): React.JSX.Element {
  const edgesByFrom = new Map<string, EdgeVisual>();
  for (const edge of visual.edges) edgesByFrom.set(edge.from, edge);
  return (
    <div>
      <div className="nodes" role="img" aria-label={visual.caption}>
        {visual.nodes.length === 0 ? <p className="muted">(empty list)</p> : null}
        {visual.nodes.map((node, index) => (
          <span key={node.id} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <span
              className="node"
              data-state={node.state ?? 'idle'}
              aria-label={`node ${nodeLabel(node)}, state ${node.state ?? 'idle'}`}
              title={nodeLabel(node)}
            >
              <span className="node-label">{node.label}</span>
              {node.sub ? <span className="node-sub">{node.sub}</span> : null}
              {node.badge ? <span className="node-badge">{node.badge}</span> : null}
            </span>
            {index < visual.nodes.length - 1 && edgesByFrom.get(node.id) ? (
              <span className="edge-label" aria-hidden="true">
                →
              </span>
            ) : null}
          </span>
        ))}
      </div>
      <Pointers pointers={visual.pointers} />
    </div>
  );
}

function GraphView({ visual }: { visual: NodesVisual }): React.JSX.Element {
  const width = 520;
  const height = 300;
  const positions = new Map<string, { x: number; y: number }>();
  const total = visual.nodes.length;
  visual.nodes.forEach((node, index) => {
    if (node.x !== undefined && node.y !== undefined) {
      positions.set(node.id, { x: node.x * width, y: node.y * height });
      return;
    }
    const angle = (2 * Math.PI * index) / Math.max(1, total);
    positions.set(node.id, {
      x: width / 2 + Math.cos(angle) * width * 0.35,
      y: height / 2 + Math.sin(angle) * height * 0.35
    });
  });
  return (
    <div>
      <svg
        className="graph-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`graph with ${total} vertices and ${visual.edges.length} edges`}
      >
        {visual.edges.map((edge, index) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const isPath = edge.state === 'path' || edge.state === 'found';
          return (
            <g key={edge.id ?? `edge-${index}`}>
              <line
                className={isPath ? 'edge-path' : 'edge'}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
              />
              {edge.label ? (
                <text
                  className="edge-label"
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 4}
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}
        {visual.nodes.map((node) => {
          const position = positions.get(node.id);
          if (!position) return null;
          return (
            <g key={node.id}>
              <circle
                cx={position.x}
                cy={position.y}
                r={18}
                data-state={node.state ?? 'idle'}
                stroke="rgba(122,148,200,0.5)"
              />
              <text
                className="edge-label"
                x={position.x}
                y={position.y + 4}
                textAnchor="middle"
                fill="#eef3ff"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
      <Pointers pointers={visual.pointers} />
    </div>
  );
}

function NodesView({ visual }: { visual: NodesVisual }): React.JSX.Element {
  return visual.layout === 'graph' ? <GraphView visual={visual} /> : <NodesListView visual={visual} />;
}

function TableView({ visual }: { visual: TableVisual }): React.JSX.Element {
  return (
    <div className="table-grid">
      <table role="img" aria-label={visual.caption}>
        {visual.colHeader ? (
          <thead>
            <tr>
              <th />
              {visual.colHeader.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {visual.rows.map((row, rowIndex) => (
            <tr key={visual.rowHeader?.[rowIndex] ?? `row-${rowIndex}`}>
              <th scope="row">{visual.rowHeader?.[rowIndex] ?? rowIndex}</th>
              {row.map((cell, colIndex) => (
                <td
                  key={cell.id ?? `cell-${rowIndex}-${colIndex}`}
                  data-state={cell.state ?? 'idle'}
                  title={`cell ${cell.id ?? ''} = ${cell.value} (${cell.state ?? 'idle'})`}
                >
                  {cell.value ?? '·'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StackQueueView({ visual }: { visual: StackVisual | QueueVisual }): React.JSX.Element {
  const isStack = visual.kind === 'stack';
  return (
    <div>
      <div className="viz-label">
        {visual.label} — {isStack ? 'top is last (LIFO)' : 'front is first (FIFO)'}
      </div>
      <CellRow cells={visual.items} />
    </div>
  );
}

function StringsView({ visual }: { visual: StringVisual }): React.JSX.Element {
  return (
    <div className="strings">
      {visual.rows.map((row, rowIndex) => {
        const cursors = (visual.cursors ?? []).filter((cursor) => cursor.row === rowIndex);
        return (
          <div className="string-row" key={`${row.label}-${rowIndex}`}>
            <span className="string-name">{row.label}</span>
            <div>
              <CellRow cells={row.chars} />
              {cursors.length > 0 ? (
                <div className="pointers">
                  {cursors.map((cursor) => (
                    <span className="pointer" key={cursor.id}>
                      {cursor.label} at index <code>{cursor.index}</code>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BitsView({ visual }: { visual: BitsVisual }): React.JSX.Element {
  return (
    <div className="strings">
      {visual.words.map((word, wordIndex) => (
        <div className="string-row" key={`${word.label}-${wordIndex}`}>
          <span className="string-name">
            {word.label}
            <br />
            <span className="muted mono">{word.value}</span>
          </span>
          <div className="cells nowrap">
            {word.bits.map((bit, index) => (
              <Cell cell={bit} key={bit.id ?? `bit-${index}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlaneView({ visual }: { visual: PlaneVisual }): React.JSX.Element {
  const width = 520;
  const height = 320;
  const { range } = visual;
  const scaleX = (x: number) =>
    ((x - range.xMin) / Math.max(1e-9, range.xMax - range.xMin)) * (width - 40) + 20;
  const scaleY = (y: number) =>
    height - 20 - ((y - range.yMin) / Math.max(1e-9, range.yMax - range.yMin)) * (height - 40);
  const byId = new Map(visual.points.map((point) => [point.id, point]));
  return (
    <svg className="plane" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={visual.caption}>
      <line className="axis" x1={20} y1={height - 20} x2={width - 20} y2={height - 20} />
      <line className="axis" x1={20} y1={20} x2={20} y2={height - 20} />
      {visual.polygons.map((polygon, index) => {
        const coordinates = polygon.points
          .map((id) => byId.get(id))
          .filter((point): point is PlaneVisual['points'][number] => Boolean(point))
          .map((point) => `${scaleX(point.x)},${scaleY(point.y)}`)
          .join(' ');
        return (
          <polygon
            key={polygon.id ?? `poly-${index}`}
            points={coordinates}
            fill="rgba(110,168,255,0.18)"
            stroke="rgba(110,168,255,0.6)"
          />
        );
      })}
      {visual.segments.map((segment, index) => {
        const from = byId.get(segment.from);
        const to = byId.get(segment.to);
        if (!from || !to) return null;
        const isPath = segment.state === 'path' || segment.state === 'found';
        return (
          <line
            key={segment.id ?? `seg-${index}`}
            className={isPath ? 'edge-path' : 'edge'}
            x1={scaleX(from.x)}
            y1={scaleY(from.y)}
            x2={scaleX(to.x)}
            y2={scaleY(to.y)}
          />
        );
      })}
      {visual.points.map((point) => (
        <g key={point.id}>
          <circle
            cx={scaleX(point.x)}
            cy={scaleY(point.y)}
            r={5}
            data-state={point.state ?? 'idle'}
            stroke="rgba(238,243,255,0.7)"
          />
          <text className="axis-label" x={scaleX(point.x) + 7} y={scaleY(point.y) - 6}>
            {point.label ?? point.id}
          </text>
        </g>
      ))}
    </svg>
  );
}

function CallsView({ visual }: { visual: CallStackVisual }): React.JSX.Element {
  return (
    <div className="frames" role="img" aria-label={visual.caption}>
      {visual.frames.length === 0 ? <p className="muted">(call stack empty)</p> : null}
      {visual.frames.map((frame) => (
        <div
          className="frame"
          data-state={frame.state ?? 'idle'}
          key={frame.id}
          aria-label={`frame ${frame.label}${frame.detail ? `, ${frame.detail}` : ''}, state ${
            frame.state ?? 'idle'
          }`}
        >
          <span>{frame.label}</span>
          {frame.detail ? <span className="muted">{frame.detail}</span> : null}
        </div>
      ))}
      <div className="viz-label">bottom → top: frames are pushed onto the top</div>
    </div>
  );
}

function TextView({ visual }: { visual: TextVisual }): React.JSX.Element {
  return (
    <pre className="code-block" aria-label={visual.caption}>
      {visual.lines.join('\n')}
    </pre>
  );
}

function VisualBody({ visual }: { visual: VisualizationState }): React.JSX.Element {
  switch (visual.kind) {
    case 'array':
      return <ArrayView visual={visual} />;
    case 'bars':
      return <BarsView visual={visual} />;
    case 'nodes':
      return <NodesView visual={visual} />;
    case 'table':
      return <TableView visual={visual} />;
    case 'stack':
    case 'queue':
      return <StackQueueView visual={visual} />;
    case 'strings':
      return <StringsView visual={visual} />;
    case 'bits':
      return <BitsView visual={visual} />;
    case 'plane':
      return <PlaneView visual={visual} />;
    case 'calls':
      return <CallsView visual={visual} />;
    case 'text':
      return <TextView visual={visual} />;
    case 'composite':
      return (
        <div>
          <div className="viz-section">
            <div className="viz-label">primary view</div>
            <VisualBody visual={visual.primary} />
          </div>
          {visual.secondary ? (
            <div className="viz-section">
              <div className="viz-label">secondary (synchronised) view</div>
              <VisualBody visual={visual.secondary} />
            </div>
          ) : null}
          {visual.tertiary ? (
            <div className="viz-section">
              <div className="viz-label">supporting view</div>
              <VisualBody visual={visual.tertiary} />
            </div>
          ) : null}
        </div>
      );
    default: {
      const exhaustive: never = visual;
      return <p className="muted">unsupported visual kind: {JSON.stringify(exhaustive)}</p>;
    }
  }
}

function legendOf(visual: VisualizationState): LegendEntry[] | undefined {
  if (visual.kind === 'text' || visual.kind === 'composite') return undefined;
  return visual.legend;
}

/** Renders the visual state produced by the active execution event. */
export function VisualizationCanvas({ visual, announcement }: CanvasProps): React.JSX.Element {
  return (
    <div className="viz-frame">
      <VisualBody visual={visual} />
      <LegendRow legend={legendOf(visual)} />
      <p className="viz-caption">{visual.caption}</p>
      <p className="viz-caption" aria-live="polite">
        {announcement ?? ''}
      </p>
    </div>
  );
}



