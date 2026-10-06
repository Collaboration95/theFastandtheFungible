import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // D22: tracing is never on in tests, whatever the shell exports.
    env: { LANGFUSE_ENABLED: '0' },
    // Vitest owns the app's unit-test convention. Playwright specs are run by
    // their dedicated npm scripts, while prototype dependencies stay outside
    // this deterministic collection boundary.
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'src/fixtures/**/*.test.tsx',
      'tests/**/*.test.js',
      'tests/**/*.test.jsx',
    ],
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e.spec.ts', 'tests/a11y.spec.ts'],
  },
})
