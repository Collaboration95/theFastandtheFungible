import { expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { once } from 'node:events'
import { ResourceScope, withResourceScope, groupMembers } from '../shared/resource-scope.js'
import { execFileSync } from 'node:child_process'

it.each(['success', 'failure', 'startup', 'timeout'])('cleans scratch and groups after %s', async mode => {
  let root = '', pid = 0
  const result = withResourceScope(async scope => {
    root = scope.tempDir('scope-regression-')
    const child = scope.spawn(process.execPath, ['-e', "console.log('ready');setInterval(()=>{},1000)"])
    pid = child.pid!
    await once(child.stdout, 'data')
    if (mode !== 'success') throw Error(mode)
  })
  if (mode === 'success') await result
  else await expect(result).rejects.toThrow(mode)
  expect(existsSync(root)).toBe(false)
  expect(groupMembers(pid)).toEqual([])
})
it('attempts all closers and aggregates errors; close is idempotent', async () => {
  const scope = new ResourceScope(), order: number[] = [], root = scope.tempDir()
  scope.defer(() => { order.push(1); throw Error('one') })
  scope.defer(() => { order.push(2); throw Error('two') })
  const close = scope.close()
  expect(scope.close()).toBe(close)
  await expect(close).rejects.toBeInstanceOf(AggregateError)
  expect(order).toEqual([2, 1]); expect(existsSync(root)).toBe(false)
})
it('wrapper rejects a deliberate uncaught directory and removes its invocation', () => {
  expect(() => execFileSync(process.execPath, ['scripts/test-resources.mjs', process.execPath, '-e', "require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'deliberate-'))"], { encoding: 'utf8', stdio: 'pipe' })).toThrow(/Resource leak: 1 entries/)
})
it('kills a SIGTERM-ignoring grandchild after its leader exits within five seconds', async () => {
  const scope = new ResourceScope()
  const child = scope.spawn(process.execPath, ['-e', `const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000)"],{stdio:['ignore','pipe','inherit']});c.stdout.pipe(process.stdout);setInterval(()=>{},1000)`])
  try {
    await once(child.stdout, 'data')
    const start = Date.now(); await scope.close()
    expect(Date.now() - start).toBeLessThanOrEqual(5000)
    expect(groupMembers(child.pid!)).toEqual([])
  } finally { await scope.close() }
})
it('startup timeout and spawn error release groups and scratch', async () => {
  const { waitForOutput } = await import('../shared/resource-scope.js')
  for (const missing of [false, true]) {
    const scope = new ResourceScope(), root = scope.tempDir()
    const child = scope.spawn(missing ? '/nonexistent/ra-resource-test' : process.execPath, ['-e', 'setInterval(()=>{},1000)'])
    try { await expect(waitForOutput(child, /ready/, 50)).rejects.toThrow() }
    finally { await scope.close() }
    expect(existsSync(root)).toBe(false)
    if (child.pid) expect(groupMembers(child.pid)).toEqual([])
  }
})
it('wrapper fails on a live owned group, kills it and removes its exact root', async () => {
  const { resources } = await import('./helpers/resource-scope.js')
  const { join } = await import('node:path')
  const { readFileSync } = await import('node:fs')
  const record = join(resources().tempDir(), 'owner.json')
  const code = `const fs=require('node:fs');const c=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});fs.writeFileSync(process.env.RA_RESOURCE_REGISTRY+'/'+c.pid+'.json',JSON.stringify({group:c.pid}));fs.writeFileSync(process.argv[1],JSON.stringify({pid:c.pid,root:process.env.RA_RESOURCE_INVOCATION}));c.unref()`
  expect(() => execFileSync(process.execPath, ['scripts/test-resources.mjs', process.execPath, '-e', code, record], { stdio: 'pipe' })).toThrow()
  const saved = JSON.parse(readFileSync(record, 'utf8'))
  for (let i = 0; i < 100 && groupMembers(saved.pid).length; i++) await new Promise(r => setTimeout(r, 10))
  expect(groupMembers(saved.pid)).toEqual([])
  expect(existsSync(saved.root)).toBe(false)
})
it('wrapper enforces an actual invocation timeout and removes scratch', async () => {
  const { resources } = await import('./helpers/resource-scope.js')
  const { join } = await import('node:path')
  const { readFileSync } = await import('node:fs')
  const record = join(resources().tempDir(), 'root.txt')
  expect(() => execFileSync(process.execPath, ['scripts/test-resources.mjs', process.execPath, '-e', "require('node:fs').writeFileSync(process.argv[1],process.env.RA_RESOURCE_INVOCATION);setInterval(()=>{},1000)", record], { env: { ...process.env, RA_TEST_TIMEOUT_MS: '250' }, stdio: 'pipe' })).toThrow()
  expect(existsSync(readFileSync(record, 'utf8'))).toBe(false)
})
