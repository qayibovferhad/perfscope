import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './styles/index.css';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { ThemeProvider } from '@/shared/ui/theme/ThemeProvider';
import { configureApiToken } from '@/shared/api/client';
import { configureSocketToken } from '@/shared/api/socket';
import { useAuthStore } from '@/features/auth/model/authStore';

const getToken = () => useAuthStore.getState().token;
configureApiToken(getToken);
configureSocketToken(getToken);

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
