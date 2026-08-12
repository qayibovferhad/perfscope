// Temporary: the same dev server proxied at a spare port, so the probes in e2e/ can take
// "the backend" down and bring it back without touching the running dev stack.
import base from './vite.config';
import { mergeConfig } from 'vite';

export default mergeConfig(base, {
  server: {
    port: 5199,
    proxy: { '/api': 'http://localhost:3197' },
  },
});
