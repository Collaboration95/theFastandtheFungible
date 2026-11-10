import { readdirSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import { heldOutBankTest } from './scripts/local-gate-banks.mjs'

// RA_DEV_BANKS_ONLY=1 skips the frozen-bank schema test of a bank that has not been measured yet.
// v1–v5 are used development data, so their tests run (scripts/local-gate-banks.mjs).
const heldOutTests = process.env.RA_DEV_BANKS_ONLY === '1' ? readdirSync('tests').map(name => `tests/${name}`).filter(heldOutBankTest) : []

export default defineConfig({
  test: {
    globalSetup: ['scripts/test-resources.mjs'],
    setupFiles: ['tests/helpers/resource-scope.ts'],
    // D22: tracing is never on in tests, whatever the shell exports.
    env: { LANGFUSE_ENABLED: '0', DOTENV_CONFIG_PATH: '.playwright/no-env' },
    maxWorkers: process.env.RA_TEST_WORKERS ? Math.max(1, Number(process.env.RA_TEST_WORKERS)) : 3,
    coverage: { provider: 'v8', reporter: ['json', 'json-summary', 'text'],
      include: ['server/**/*.{ts,mjs}', 'shared/**/*.{ts,mjs}', 'publisher/**/*.{ts,mjs}', 'sdk/**/*.{ts,mjs}', 'mcp/**/*.{ts,mjs}', 'src/**/*.{ts,tsx}', 'desktop/**/*.mjs'],
      exclude: ['**/*.d.ts', '**/*.test.*', 'desktop/build.mjs', 'desktop/out/**', 'desktop/dist/**'],
    },
    // Vitest owns the app's unit-test convention. Playwright specs are run by
    // their dedicated npm scripts, while prototype dependencies stay outside
    // this deterministic collection boundary.
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'src/**/*.test.tsx',
      'tests/**/*.test.js',
      'tests/**/*.test.jsx',
    ],
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e.spec.ts', 'tests/a11y.spec.ts', ...heldOutTests],
  },
})
