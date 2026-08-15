import { defineConfig } from 'wxt'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// This package stays on Vite 6 while the dashboard is on Vite 8, and that is not drift to
// tidy up: wxt 0.19 declares a peer range of `^5.0.0 || ^6.0.0`, so Vite 8 here means
// upgrading wxt to 0.21 first — a framework upgrade that moves manifest generation and the
// entrypoint API, not a version bump. TypeScript *is* aligned across every workspace.

export default defineConfig({
  manifest: {
    name: 'PerfScope Companion',
    description: "Analyze any page with PerfScope's Lighthouse engine and compare against your own sites.",
    // No `version` here on purpose: WXT fills it from package.json, so the manifest and
    // the popup footer cannot claim different numbers the way they did (0.0.1 / 1.0.0).
    // 'scripting' is what lets the background worker register the token-sync content
    // script for a self-hosted dashboard origin — see entrypoints/tokenSync.ts.
    permissions: ['tabs', 'activeTab', 'storage', 'scripting'],
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
