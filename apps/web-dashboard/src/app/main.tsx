import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './styles/index.css';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeProvider } from '@/shared/ui/theme/ThemeProvider';
import { configureApiToken, configureUnauthorizedHandler } from '@/shared/api/client';
import { configureSocketToken } from '@/shared/api/socket';
import { useAuthStore } from '@/features/auth/model/authStore';
import { useAnalysisStore } from '@/features/analyzer/model/analysisStore';
import { useAuthAuditStore } from '@/features/auth-audit';
import { usePrefetchStore } from '@/entities/analysis';
import { clearComparePreload } from '@/features/compare/model/comparePreloadStore';

const getToken = () => useAuthStore.getState().token;
configureApiToken(getToken);
configureSocketToken(getToken);

// A dead token leaves the UI looking logged in while every request 401s.
// Drop the stored session and bounce to /login, keeping the current page as redirect target.
configureUnauthorizedHandler((reason) => {
  const { token, logout } = useAuthStore.getState();
  if (!token) return; // already cleared by a concurrent 401 — don't redirect twice

  logout();

  const here = window.location.pathname + window.location.search;
  const back = here.startsWith('/login') ? '' : `&redirect=${encodeURIComponent(here)}`;
  window.location.replace(`/login?reason=${reason}${back}`);
});

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { retry: false },
    queries: {
      // React Query's stock `retry: 3` with exponential backoff keeps a failed request in
      // the pending state for four attempts and seven seconds of waiting. Every list page
      // shows a spinner for that whole window and then falls through to its *empty* state,
      // so a dead backend is indistinguishable from an account with no data. One quick
      // retry still absorbs a genuine blip; anything worse should be reported, not hidden.
      retry: 1,
      retryDelay: 400,
      // With the ambient staleTime of 0, every return to the tab re-runs the full sequence
      // above — a broken page re-enters the spinner each time the user comes back. Every
      // mutation and finished audit already invalidates explicitly.
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Signing out and back in as someone else never reloads the page, so every cache
 * that outlives a route change would otherwise show the previous account's data:
 * the React Query cache is keyed by resource, not by user, and the analysis and
 * auth-audit stores hold whatever the last person looked at. Wipe all of it the
 * moment the signed-in identity changes — including to null on logout.
 */
let currentUserId = useAuthStore.getState().user?.sub ?? null;
useAuthStore.subscribe((state) => {
  const nextUserId = state.user?.sub ?? null;
  if (nextUserId === currentUserId) return;
  currentUserId = nextUserId;

  queryClient.clear();
  useAnalysisStore.getState().clear();
  usePrefetchStore.getState().clear();
  useAuthAuditStore.getState().clearSession();
  clearComparePreload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </QueryClientProvider>
        </ThemeProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
