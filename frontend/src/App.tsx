import { Routes, Route } from 'react-router-dom';
import { LandingPage } from './features/landing/LandingPage';
import { Analyzer } from './features/analyzer/components/Analyzer';
import { ComparisonPage } from './features/compare/ComparisonPage';
import { HistoryPage } from './features/history/HistoryPage';
import { CompareHistoryPage } from './features/compare-history/CompareHistoryPage';

export default function App() {
  return (
    <div className="relative min-h-screen">
      {/* Global mesh gradient blobs — fixed, behind all content */}
      <div className="pointer-events-none fixed top-0 left-0 w-[700px] h-[700px]"
        style={{ background: 'var(--ps-blob-tl)', zIndex: 0 }} />
      <div className="pointer-events-none fixed bottom-0 right-0 w-[700px] h-[700px]"
        style={{ background: 'var(--ps-blob-br)', zIndex: 0 }} />

      <main className="relative z-10 min-h-screen">
        <Routes>
          <Route path="/"                element={<LandingPage />} />
          <Route path="/app"             element={<Analyzer />} />
          <Route path="/compare"         element={<ComparisonPage />} />
          <Route path="/history"         element={<HistoryPage />} />
          <Route path="/compare-history" element={<CompareHistoryPage />} />
        </Routes>
      </main>
    </div>
  );
}
