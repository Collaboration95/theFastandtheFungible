import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { cpSync, rmSync } from 'node:fs'
process.chdir(fileURLToPath(new URL('..', import.meta.url)))
rmSync('packages/sdk/dist', { recursive: true, force: true })
execFileSync('node_modules/.bin/tsc', ['-p', 'packages/sdk/tsconfig.json'], { stdio: 'inherit' })
cpSync('docs/sdk.md', 'packages/sdk/README.md')
cpSync('LICENSE', 'packages/sdk/LICENSE')
