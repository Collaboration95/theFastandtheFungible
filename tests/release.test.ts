import { it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, copyFileSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Strip GIT_* (set by git hooks) so fixture git never touches the real repo.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')))

it('backfills the exact old commit without changing HEAD, package versions or existing tags', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env }).trim()
  const run = (...args: string[]) => execFileSync(process.execPath, ['scripts/release.mjs', '2', 'Fact menu', ...args], { cwd: dir, encoding: 'utf8', stdio: 'pipe', env })
  try {
    git('init', '-q', '-b', 'main'); git('config','user.email','fixture@example.invalid'); git('config','user.name','Fixture')
    mkdirSync(join(dir,'scripts')); mkdirSync(join(dir,'docs'))
    copyFileSync(resolve('scripts/release.mjs'),join(dir,'scripts/release.mjs'))
    writeFileSync(join(dir,'package.json'),'{"version": "0.2.0"}\n'); writeFileSync(join(dir,'docs/SFF-PUSH.md'),'# CURRENT material must not leak into a backfill\n')
    writeFileSync(join(dir,'notes.md'),'Historical measurements; waste regressed.\n')
    git('add','.'); git('commit','-qm','fact menu (#304)'); const old = git('rev-parse','HEAD')
    git('tag','v0.2.0'); git('commit','--allow-empty','-qm','Mac app (#303)'); git('tag','v0.4.0')
    const head = git('rev-parse','HEAD'), tags = git('show-ref','--tags')
    execFileSync('git',['init','--bare','-q',join(dir,'remote.git')],{ env }); git('remote','add','origin',join(dir,'remote.git')); git('push','-q','origin','main','--tags')
    writeFileSync(join(dir,'.gitignore'),'remote.git/\n'); git('add','.gitignore'); git('commit','-qm','ignore fixture remote'); git('push','-q','origin','main')
    const current = git('rev-parse','HEAD')
    expect(run('--at',old,'--notes-file','notes.md','--dry-run')).toContain('Historical measurements')
    const semver = execFileSync(process.execPath, ['scripts/release.mjs','1.0.0','Finals','--dry-run'], {cwd:dir,encoding:'utf8',env})
    expect(semver).toContain('v1.0.0')
    expect(() => execFileSync(process.execPath, ['scripts/release.mjs','1.0.0','Finals'], {cwd:dir,stdio:'pipe',env})).toThrow()
    expect(git('rev-parse','HEAD')).toBe(current)
    expect(git('tag','-l','v1.0.0')).toBe('')

    expect(() => run('--at',old)).toThrow()
    run('--at',old,'--notes-file','notes.md','--push')
    expect(git('rev-parse','v0.3.0^{}')).toBe(old)
    expect(git('rev-parse','HEAD')).toBe(current)
    expect(git('rev-parse','v0.4.0')).toBe(head)
    expect(git('show-ref','--tags')).toContain(tags.split('\n')[0])
    expect(readFileSync(join(dir,'package.json'),'utf8')).toContain('0.2.0')
    expect(git('for-each-ref','refs/tags/v0.3.0','--format=%(contents)')).not.toContain('CURRENT')
    expect(git('ls-remote','--tags','origin','v0.3.0')).toContain('refs/tags/v0.3.0')
    expect(() => run('--at',old,'--notes-file','notes.md')).toThrow()
    expect(git('status','--porcelain')).toBe('')
  } finally { rmSync(dir,{recursive:true,force:true}) }
})
