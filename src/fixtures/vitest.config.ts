import { defineConfig } from 'vitest/config'

// Package-scoped tests; W2 may add src/fixtures to the root test include list.
export default defineConfig({ test: { include: ['src/fixtures/**/*.test.tsx'] } })
