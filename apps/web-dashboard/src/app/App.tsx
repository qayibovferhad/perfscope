import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute }  from '@/features/auth/ui/ProtectedRoute';
import { DashboardLayout } from '@/widgets/dashboard-layout';

// Each page is its own chunk — visiting the landing no longer downloads the dashboard.
const LandingPage           = lazy(() => import('@/pages/landing').then(m => ({ default: m.LandingPage })));
const LoginPage             = lazy(() => import('@/pages/login/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage          = lazy(() => import('@/pages/register/RegisterPage').then(m => ({ default: m.RegisterPage })));
const AnalyzerPage          = lazy(() => import('@/pages/analyzer/AnalyzerPage').then(m => ({ default: m.AnalyzerPage })));
const ComparisonPage        = lazy(() => import('@/pages/compare/ComparisonPage').then(m => ({ default: m.ComparisonPage })));
const HistoryPage           = lazy(() => import('@/pages/history/HistoryPage').then(m => ({ default: m.HistoryPage })));
const CompareHistoryPage    = lazy(() => import('@/pages/compare-history/CompareHistoryPage').then(m => ({ default: m.CompareHistoryPage })));
const WebsitesPage          = lazy(() => import('@/pages/websites/WebsitesPage').then(m => ({ default: m.WebsitesPage })));
const ProjectDetailPage     = lazy(() => import('@/pages/project-detail/ProjectDetailPage').then(m => ({ default: m.ProjectDetailPage })));
const AutomationPage        = lazy(() => import('@/pages/automation/AutomationPage').then(m => ({ default: m.AutomationPage })));
const ExtensionSettingsPage = lazy(() => import('@/pages/extension/ExtensionSettingsPage').then(m => ({ default: m.ExtensionSettingsPage })));
const SettingsPage          = lazy(() => import('@/pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const CliAuthPage           = lazy(() => import('@/pages/cli-auth/CliAuthPage').then(m => ({ default: m.CliAuthPage })));

function PageFallback() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <Loader2 className="w-6 h-6 animate-spin text-ld-text-3" />
    </div>
  );
}

function DashboardRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
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
        <Route path="/settings"        element={<DashboardRoute><SettingsPage /></DashboardRoute>} />
        <Route path="/cli-auth"        element={<CliAuthPage />} />
      </Routes>
    </Suspense>
  );
}
