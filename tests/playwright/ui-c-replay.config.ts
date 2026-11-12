import { defineConfig } from '@playwright/test'
import demo from './demo.config'
export default defineConfig({ ...demo, testMatch: 'ui-c-replay.spec.ts', workers: 1 })
