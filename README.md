<div align="center">

# 📊 AlgoViz — Cinematic Atlas

**Execution-Level Algorithm Visualizer**

[![CI](https://github.com/harinish45/algoviz/actions/workflows/ci.yml/badge.svg)](https://github.com/harinish45/algoviz/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5.0+-646CFF?logo=vite&logoColor=white)](https://vite.dev)

> *AlgoViz executes real TypeScript algorithms with trace instrumentation — every step visualized in cinematic motion*

[📋 TODO](TODO.md) · [🔍 Live Demo](#) · [📚 Docs](docs/)

</div>

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph UI["🖥️ React Frontend"]
        AlgoSelector["Algorithm\nSelector"]
        InputPanel["Input\nPanel"]
        Visualizer["🎬 Canvas Visualizer\n(SVG + Animation)"]
        StepPanel["Step-by-Step\nPseudocode Panel"]
        MetricsPanel["📊 Metrics\n(Time / Space)"]
    end

    subgraph Engine["⚙️ Trace Engine"]
        Tracer["📍 TraceBuilder\nInstrumentation"]
        Executor["▶️ Algorithm\nExecutor"]
        Replayer["⏮️ Step\nReplayer"]
    end

    subgraph Algorithms["🧮 Algorithm Implementations"]
        Sorting["🔢 Sorting\n(Bubble/Merge/Quick/Heap)"]
        Graph["🕸️ Graph\n(BFS/DFS/Dijkstra/A*)"]
        Tree["🌲 Trees\n(BST/AVL/Segment)"]
        DP["📐 Dynamic\nProgramming"]
    end

    AlgoSelector --> Executor
    InputPanel --> Executor
    Executor --> Algorithms
    Algorithms --> Tracer
    Tracer --> Replayer
    Replayer --> Visualizer
    Replayer --> StepPanel
    Replayer --> MetricsPanel
```

---

## 🎬 How It Works

```mermaid
sequenceDiagram
    participant U as User
    participant E as Executor
    participant T as Tracer
    participant V as Visualizer

    U->>E: Select "Merge Sort" + input [5,2,8,1]
    E->>T: Run mergeSort([5,2,8,1])
    T->>T: Record each comparison/swap
    T-->>V: Trace steps array
    V->>V: Animate step 1: split [5,2] | [8,1]
    V->>V: Animate step 2: sort sublists
    V->>V: Animate step 3: merge
    V-->>U: ✅ [1,2,5,8] — 8 steps shown
```

---

## 📊 Algorithm Coverage

| Category | Algorithms | Status |
|----------|-----------|--------|
| Sorting | Bubble, Merge, Quick, Heap, Insertion | 🔧 |
| Graph | BFS, DFS, Dijkstra, A*, Bellman-Ford | 📋 |
| Trees | BST, AVL, Red-Black, Segment | 📋 |
| Dynamic Programming | LCS, Knapsack, Coin Change | 📋 |
| Pathfinding | Maze solver, grid BFS | 📋 |

---

## 🚀 Quick Start

```bash
git clone https://github.com/harinish45/algoviz.git
cd algoviz
npm install
npm run dev   # → http://localhost:5173
```

---

<div align="center">
<a href="LICENSE">MIT License</a> · Built by harinish45
</div>