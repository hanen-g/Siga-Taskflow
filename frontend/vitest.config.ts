import { defineConfig } from 'vitest/config';

// CI stability: avoid Vitest fork-pool worker timeouts on GitHub Actions runners.
export default defineConfig({
  test: {
    pool: 'forks',
    singleFork: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
