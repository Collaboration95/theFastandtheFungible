import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir:'./tests', testMatch:'ledger-viewer.spec.ts', workers:1, use:{headless:true} })
