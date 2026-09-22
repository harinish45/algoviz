import { Route, Routes } from 'react-router-dom';
import { Sidebar } from './components/Shell';
import { useProgress } from './hooks/useProgress';
import { AlgorithmPage } from './pages/AlgorithmPage';
import { AtlasPage } from './pages/AtlasPage';
import { CategoryPage } from './pages/CategoryPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProgressPage } from './pages/ProgressPage';

export function App(): React.JSX.Element {
  const progress = useProgress();

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="app-shell">
        <Sidebar masteryOf={progress.masteryOf} />
        <main className="main" id="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/progress" element={<ProgressPage progress={progress} />} />
            <Route path="/atlas" element={<AtlasPage />} />
            <Route path="/category/:categoryId" element={<CategoryPage progress={progress} />} />
            <Route path="/algorithm/:algorithmId" element={<AlgorithmPage progress={progress} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
    </>
  );
}