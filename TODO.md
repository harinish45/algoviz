# 📋 TODO & Master Plan — algoviz

> **Project**: Algorithm Visualizer — Interactive educational tool for CS algorithms
> **Stack**: TypeScript, React, Vite
> **Status**: 🟡 In Progress (~55%)
> **Last Updated**: 2026-10-30

## 🏗️ Architecture
\\\
algoviz/
├── src/
│   ├── algorithms/     # Algorithm implementations
│   ├── components/     # React UI components
│   ├── visualizers/    # Canvas/SVG renderers
│   └── utils/          # Helpers
├── docs/               # Documentation
├── scripts/            # Build/deploy scripts
└── public/             # Static assets
\\\

## ✅ Completed
- [x] Vite + TypeScript project setup
- [x] Base visualizer component architecture
- [x] GitHub Actions CI pipeline
- [x] ESLint configuration

## 🔧 In Progress
- [ ] Sorting algorithms visualizer (Bubble, Merge, Quick, Heap)
- [ ] Graph traversal (BFS, DFS) with step-by-step animation
- [ ] Pathfinding algorithms (Dijkstra, A*)

## 🚀 Roadmap
### Phase 1 — Sorting (Nov 2026)
- [ ] Bubble Sort with comparisons counter
- [ ] Merge Sort with split/merge animation
- [ ] Quick Sort with pivot highlighting
- [ ] Heap Sort with heap tree visualization
- [ ] Time complexity comparison chart

### Phase 2 — Graph Algorithms (Dec 2026)
- [ ] BFS with queue visualization
- [ ] DFS with stack visualization
- [ ] Dijkstra shortest path
- [ ] A* pathfinding with heuristic display
- [ ] Kruskal/Prim MST

### Phase 3 — Data Structures (Jan 2027)
- [ ] Linked List operations
- [ ] Binary Search Tree (insert/delete/search)
- [ ] AVL Tree rotations
- [ ] Hash Table with collision visualization

### Phase 4 — Polish (Feb 2027)
- [ ] Speed control slider
- [ ] Step-by-step mode
- [ ] Pseudocode panel alongside animation
- [ ] Shareable algorithm URLs
- [ ] Mobile responsive layout