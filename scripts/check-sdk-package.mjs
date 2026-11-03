import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
const dir = mkdtempSync(join(tmpdir(), 'sdk-package-'))
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', './packages/sdk', '--json', '--pack-destination', dir], { encoding: 'utf8' }))[0]
  assert(packed.files.every(f => /^(dist\/|README.md$|LICENSE$|package.json$)/.test(f.path)))
  assert(!packed.files.some(f => /\.env|desktop|tests\/|node_modules/.test(f.path)))
  const modules = join(dir, 'node_modules')
  mkdirSync(join(modules, '@researchagent'), { recursive: true })
  execFileSync('tar', ['-xzf', join(dir, packed.filename), '-C', dir])
  symlinkSync(join(dir, 'package'), join(modules, '@researchagent/sdk'), 'dir')
  // Reuse the lockfile-installed dependencies; no install, publication or network.
  symlinkSync(resolve('node_modules'), join(dir, 'package/node_modules'), 'dir')
  writeFileSync(join(dir, 'consumer.mjs'), `import {createClient} from '@researchagent/sdk';
import {openPaymentJournal} from '@researchagent/sdk/journal';
const c = createClient({baseUrl:'http://localhost'});
if (!(await c.verify({})).ok && typeof openPaymentJournal === 'function') console.log('ESM package OK');
else throw Error('bad exports');`)
  execFileSync(process.execPath, [join(dir, 'consumer.mjs')], { stdio: 'inherit' })
  writeFileSync(join(dir, 'consumer.mts'), `import {createClient, type AskTask, type AskResult, type VerificationResult} from '@researchagent/sdk';
const c = createClient({baseUrl:'http://localhost',token:'synthetic'});
const task: AskTask = c.ask('q', {budget:1,idempotencyKey:'key'});
const result: AskResult = await task;
const verification: VerificationResult = await c.verify({});
const clamped: boolean = result.clamped;
void [verification,clamped,task.events,c.walletStatus(),c.getRun('id'),c.hire('q',{budgetMinor:100,idempotencyKey:'key'}),c.pay('https://example.test')];
// @ts-expect-error: budget must be numeric SGD
c.ask('q',{budget:'1'});
// @ts-expect-error: unknown methods must not be exposed
c.settle();`)
  execFileSync(resolve('node_modules/.bin/tsc'), ['--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', join(dir, 'consumer.mts')], { stdio: 'inherit' })
  console.log(`Package OK: ${packed.size} bytes, ${packed.files.length} files; ESM and public declarations checked`)
} finally { rmSync(dir, { recursive: true, force: true }) }
