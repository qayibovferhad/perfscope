import { Routes, Route } from 'react-router-dom';
import { LandingPage }      from './features/landing/LandingPage';
import { LoginPage }        from './features/auth/LoginPage';
import { RegisterPage }     from './features/auth/RegisterPage';
import { ProtectedRoute }   from './features/auth/ProtectedRoute';
import { DashboardLayout }  from './features/dashboard/DashboardLayout';
import { Analyzer }         from './features/analyzer/components/Analyzer';
import { ComparisonPage }   from './features/compare/ComparisonPage';
import { HistoryPage }      from './features/history/HistoryPage';
import { CompareHistoryPage } from './features/compare-history/CompareHistoryPage';
import { WebsitesPage }       from './features/dashboard/WebsitesPage';
import { ProjectDetailPage }  from './features/projects/ProjectDetailPage';
import { AutomationPage }     from './features/automation/AutomationPage';

function DashboardRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <>
      {/* Global mesh blobs — only for public pages (landing/login) */}
      <Routes>
        <Route path="/"      element={<LandingPage />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/app"             element={<DashboardRoute><Analyzer /></DashboardRoute>} />
        <Route path="/compare"         element={<DashboardRoute><ComparisonPage /></DashboardRoute>} />
        <Route path="/history"         element={<DashboardRoute><HistoryPage /></DashboardRoute>} />
        <Route path="/compare-history" element={<DashboardRoute><CompareHistoryPage /></DashboardRoute>} />
        <Route path="/websites"          element={<DashboardRoute><WebsitesPage /></DashboardRoute>} />
        <Route path="/projects/:id"    element={<DashboardRoute><ProjectDetailPage /></DashboardRoute>} />
        <Route path="/automation"      element={<DashboardRoute><AutomationPage /></DashboardRoute>} />
      </Routes>
    </>
  );
}
