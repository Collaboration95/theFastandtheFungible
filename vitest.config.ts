import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e.spec.ts', 'tests/a11y.spec.ts'],
  },
})
