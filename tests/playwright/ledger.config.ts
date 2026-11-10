import { defineConfig } from '@playwright/test'
import { outputDir } from './paths'
export default defineConfig({ testDir:'..', outputDir, testMatch:'ledger-viewer.spec.ts', workers:1, use:{headless:true} })
