import { Routes, Route } from 'react-router-dom';
import { LandingPage }            from '@/pages/landing';
import { LoginPage }              from '@/pages/login/LoginPage';
import { RegisterPage }           from '@/pages/register/RegisterPage';
import { ProtectedRoute }         from '@/features/auth/components/ProtectedRoute';
import { DashboardLayout }        from '@/widgets/dashboard-layout';
import { AnalyzerPage }           from '@/pages/analyzer/AnalyzerPage';
import { ComparisonPage }         from '@/pages/compare/ComparisonPage';
import { HistoryPage }            from '@/pages/history/HistoryPage';
import { CompareHistoryPage }     from '@/pages/compare-history/CompareHistoryPage';
import { WebsitesPage }           from '@/pages/websites/WebsitesPage';
import { ProjectDetailPage }      from '@/pages/project-detail/ProjectDetailPage';
import { AutomationPage }         from '@/pages/automation/AutomationPage';
import { ExtensionSettingsPage }  from '@/pages/extension/ExtensionSettingsPage';
import { CliAuthPage }            from '@/pages/cli-auth/CliAuthPage';

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
      <Routes>
        <Route path="/"      element={<LandingPage />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/app"             element={<DashboardRoute><AnalyzerPage /></DashboardRoute>} />
        <Route path="/compare"         element={<DashboardRoute><ComparisonPage /></DashboardRoute>} />
        <Route path="/history"         element={<DashboardRoute><HistoryPage /></DashboardRoute>} />
        <Route path="/compare-history" element={<DashboardRoute><CompareHistoryPage /></DashboardRoute>} />
        <Route path="/websites"        element={<DashboardRoute><WebsitesPage /></DashboardRoute>} />
        <Route path="/projects/:id"    element={<DashboardRoute><ProjectDetailPage /></DashboardRoute>} />
        <Route path="/automation"      element={<DashboardRoute><AutomationPage /></DashboardRoute>} />
        <Route path="/extension"       element={<DashboardRoute><ExtensionSettingsPage /></DashboardRoute>} />
        <Route path="/cli-auth"        element={<CliAuthPage />} />
      </Routes>
    </>
  );
}
