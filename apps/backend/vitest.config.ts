import { defineConfig } from 'vitest/config';

/**
 * Unit tests only. `probes/` stays out: those drive a real Chrome, a real Gemini key or a
 * real database, take minutes, and are run by hand — putting them behind the same command
 * as the unit tests would make `pnpm test` something nobody runs.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
