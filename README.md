# AlgoViz — Cinematic Atlas

> Execution-level DSA/DAA visualisation and learning laboratory.
> Repository: https://github.com/harinish45/algoviz

AlgoViz does not *animate* algorithms — it **executes** them. Every algorithm is a real TypeScript
reference implementation instrumented with `TraceBuilder`: input is schema-validated, each semantic
transition becomes an `ExecutionEvent` (what happened, **why**, which invariant holds), anchors map
each event to the exact source lines that caused it, and the visualiser, code panel, explanation
panel, practice questions and mastery scores are all derived from that one trace — so nothing in
the app can drift away from what the code actually did.

## Quick start

```bash
npm install
npm run dev        # vite dev server
npm run verify     # typecheck + lint + test + build (exactly what CI runs)
```

## What's inside

- **Registry** (`src/core/registry.ts`) — every algorithm declares docs, four language listings,
  complexity and tests; `validateRegistry` enforces the definition of done.
- **Trace engine** (`src/core/trace.ts`) — `TraceBuilder` guarantees contiguous steps, chained
  states, non-empty explanations, line-accurate anchors, counters = Σ per-event impacts, JSON
  serialisability and a max-events safety valve.
- **Visualiser** (`src/visualization/`) — DOM renderer for every visual kind (array, bars, nodes,
  table, stack, queue, string, bits, plane, call stack, text, composite) built from shared
  builders so all algorithms look and behave alike.
- **Panels** (`src/components/algorithm/`) — schema-driven input with per-field validation,
  transport controls with a step timeline, explanation with live counters, code panel with
  language switching and line highlights, practice panel.
- **Practice & mastery** (`src/core/practice.ts`, `src/core/progress.ts`) — deterministic
  trace-grounded questions; mastery = 40% trace coverage + 40% practice accuracy + 20% exploration,
  always shown with its breakdown and stored locally in the browser.
- **Routing** (`src/App.tsx`, HashRouter) — `/` home · `/category/:id` · `/algorithm/:id` ·
  `/progress` · `/atlas`. Indexed-but-unimplemented atlas entries stay out of the sidebar and are
  marked *planned* wherever referenced.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build into `dist/` |
| `npm run typecheck` | `tsc -b --force` |
| `npm run lint` / `lint:fix` | ESLint (flat config: typescript, react-hooks, react-refresh) |
| `npm run test` | Vitest contract suite — runs every registered algorithm |
| `npm run coverage` | Vitest with v8 coverage |
| `npm run atlas` | Regenerate `docs/ATLAS.md` from the sources |
| `npm run scaffold -- <category> <name>` | Scaffold a new contract-complete algorithm file |
| `npm run verify` | typecheck → lint → test → build (matches CI) |

## Adding an algorithm

1. Pick a category id from `src/core/categories.ts` (see the [atlas](docs/ATLAS.md)).
2. Scaffold the file — `npm run scaffold -- sorting merge-sort` creates
   `src/algorithms/sorting/merge-sort.ts` with a contract-complete placeholder: validated input
   schema with examples, a real traced execution with anchored events, four language listings and
   every required test family (canonical, invalid, empty, singleton, trace-property).
3. Replace the placeholder echo semantics with the real algorithm; expand the concept doc,
   complexity analysis and tests as you go. Every event needs a concrete description, a *why* and
   a unique code anchor.
4. Register it: export the definition and add it to `ALGORITHMS` in `src/algorithms/index.ts`.
   (The scaffold deliberately does not edit other files.)
5. `npm run verify` — registry validation, trace hygiene, determinism and the whole contract suite
   must pass. The new algorithm appears in the sidebar automatically once registered.
6. `npm run atlas` refreshes the coverage tables in `docs/ATLAS.md`.

## CI

`.github/workflows/ci.yml` runs `npm ci` → typecheck → lint → test → build on every push to
`main`/`feat/**` and every pull request targeting `main`, then uploads `dist/` as an artifact.

## Project layout

```
src/
  core/            types, registry, trace engine, validation, practice, progress, testkit
  algorithms/      one file per algorithm — it executes and documents itself
  visualization/   renderer + shared builders/marks
  components/      shell + algorithm panels (input, controls, explanation, code, practice)
  hooks/           useAlgorithmTrace / usePlayer / useProgress
  pages/           home, category, algorithm, progress, atlas
  styles/          design system (tokens → primitives → layout → visualiser → responsive)
scripts/           generate-atlas.mjs · scaffold-algorithm.mjs
docs/ATLAS.md      generated atlas contract & coverage
```

## License

MIT