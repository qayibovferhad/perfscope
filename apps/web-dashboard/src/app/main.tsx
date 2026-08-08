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
import { configureCompareSocketToken } from '@/features/compare/api/compareSocket';
import { useAuthStore } from '@/features/auth/model/authStore';

const getToken = () => useAuthStore.getState().token;
configureApiToken(getToken);
configureSocketToken(getToken);
configureCompareSocketToken(getToken);

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
  },
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
