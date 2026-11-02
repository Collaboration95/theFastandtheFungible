#!/usr/bin/env node
// A publishable bin entry without installing tsx globally.
import { register } from 'node:module'
register('tsx/esm', import.meta.url)
await import('./publish-site.ts').then(m => m.main())
