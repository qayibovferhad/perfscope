import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, type Query } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './styles/index.css';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeProvider } from '@/shared/ui/theme/ThemeProvider';
import { Toaster } from '@/shared/ui/toast';
import { configureApiToken, configureTokenRefresh, configureUnauthorizedHandler, isTransientError } from '@/shared/api/client';
import { configureSocketToken } from '@/shared/api/socket';
import { useAuthStore } from '@/features/auth';
import { useAnalysisStore } from '@/features/analyzer';
import { useAuthAuditStore } from '@/features/auth-audit';
import { usePrefetchStore } from '@/entities/analysis';
import { clearComparePreload } from '@/features/compare';

const getToken = () => useAuthStore.getState().token;
configureApiToken(getToken);
configureSocketToken(getToken);

// Access tokens last half an hour, so the ordinary state of an open dashboard is one that
// has just lapsed. The client renews it against the stored refresh token and replays the
// request; the reader sees nothing. Only a refresh that *fails* becomes a sign-out.
configureTokenRefresh(
  () => useAuthStore.getState().refreshToken,
  (token, refreshToken) => useAuthStore.getState().setTokens(token, refreshToken),
);

// A dead token leaves the UI looking logged in while every request 401s.
// Drop the stored session and bounce to /login, keeping the current page as redirect target.
configureUnauthorizedHandler((reason) => {
  const { token, logout } = useAuthStore.getState();
  if (!token) return; // already cleared by a concurrent 401 — don't redirect twice

  // Not `signOut()`: we are here *because* the credentials no longer work, so there is
  // nothing to tell the server that it does not already know.
  logout();

  const here = window.location.pathname + window.location.search;
  const back = here.startsWith('/login') ? '' : `&redirect=${encodeURIComponent(here)}`;
  window.location.replace(`/login?reason=${reason}${back}`);
});

/** How often a failed query re-tries by itself. Short enough that a backend restart is
 *  over before the user reaches for the reload button, slow enough to be free. */
const ERROR_RETRY_MS = 5_000;

/** A query that failed for a reason that may pass on its own. A 404 or a 400 never will,
 *  and polling it for as long as the page is open would be a loop with no end. */
const isRecoverable = (query: Query) =>
  query.state.status === 'error' && isTransientError(query.state.error);

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
      // Nothing else notices that the backend came back. A dev server reloading, a laptop
      // waking, a restart mid-deploy: the request fails once and the page keeps its error
      // panel for as long as it stays open, long after the cause is gone. Only *failed*
      // queries poll — a healthy page issues no extra requests — and the first success
      // stops it, so the panel clears itself a few seconds after the backend is back.
      refetchInterval: (query) => (isRecoverable(query) ? ERROR_RETRY_MS : false),
      // Polling a hidden tab keeps a broken page busy for no one; the focus rule below
      // covers coming back to it.
      refetchIntervalInBackground: false,
      // Healthy data is left alone — with the ambient staleTime of 0, refetching on every
      // focus re-ran the whole app's requests each time the user changed tab, and every
      // mutation and finished audit already invalidates explicitly. A *failed* query is the
      // exception: returning to the tab is the clearest signal to try again.
      refetchOnWindowFocus: (query) => isRecoverable(query),
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
            {/* Outside the router: a toast raised by a navigation, a logout or a background
                socket event has to outlive whatever route was on screen when it fired. */}
            <Toaster />
          </QueryClientProvider>
        </ThemeProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
