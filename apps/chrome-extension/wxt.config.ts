import { defineConfig } from 'wxt'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  manifest: {
    name: 'PerfScope Companion',
    description: "Analyze any page with PerfScope's Lighthouse engine and compare against your own sites.",
    version: '1.0.0',
    permissions: ['tabs', 'activeTab', 'storage'],
    host_permissions: [
      'http://localhost:3101/*',
      'https://localhost:3101/*',
    ],
    // A custom backend URL from the settings drawer needs a runtime
    // permissions.request() for its origin — granted on Save.
    optional_host_permissions: [
      'http://*/*',
      'https://*/*',
    ],
    action: {
      default_title: 'PerfScope Companion',
    },
  },
  vite: () => ({
    plugins: [react()],
    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    },
  }),
})
