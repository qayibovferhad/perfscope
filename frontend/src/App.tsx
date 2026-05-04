import { Routes, Route } from 'react-router-dom';
import { Analyzer } from './features/analyzer/components/Analyzer';
import { ComparisonPage } from './features/compare/ComparisonPage';
import { HistoryPage } from './features/history/HistoryPage';
import { CompareHistoryPage } from './features/compare-history/CompareHistoryPage';

export default function App() {
  return (
    <main className="min-h-screen bg-background">
      <Routes>
        <Route path="/" element={<Analyzer />} />
        <Route path="/compare" element={<ComparisonPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/compare-history" element={<CompareHistoryPage />} />
      </Routes>
    </main>
  );
}
