#!/usr/bin/env node
// A publishable bin entry without installing tsx globally.
import { register } from 'tsx/esm/api'
register()
await import('./publish-site.ts').then(m => m.main())
