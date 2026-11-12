import { defineConfig } from '@playwright/test'
import declutter from './declutter.config'
export default defineConfig({ ...declutter, testMatch: 'ui-a.spec.ts' })
