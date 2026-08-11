import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Stable vendor chunks: framework code changes far less often than app
        // code, so returning visitors keep these cached across deploys.
        advancedChunks: {
          groups: [
            { name: 'react',  test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/]framer-motion[\\/]/ },
            { name: 'socket', test: /node_modules[\\/](socket\.io-client|engine\.io-client)[\\/]/ },
            { name: 'icons',  test: /node_modules[\\/]lucide-react[\\/]/ },
            // Charts load on the dashboard, history and RUM views, but never on the
            // landing page or the analyzer — worth its own chunk rather than the app bundle.
            { name: 'charts', test: /node_modules[\\/](recharts|d3-.*|victory-vendor|internmap|decimal\.js-light)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3101',
    },
  },
});
