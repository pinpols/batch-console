import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const script = resolve('scripts/ci/check-backend-validation-coverage.sh')

test('后端验证基线必须覆盖当前代码，文档变更允许通过', () => {
  const dir = mkdtempSync(join(tmpdir(), 'backend-sim-coverage-'))
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe', encoding: 'utf8' }).trim()
  try {
    git('init')
    git('config', 'user.name', 'CI Test')
    git('config', 'user.email', 'ci-test@example.invalid')
    writeFileSync(join(dir, 'app.java'), 'base')
    git('add', '.')
    git('commit', '-m', 'base')
    const base = git('rev-parse', 'HEAD')
    writeFileSync(join(dir, 'guide.md'), 'documentation')
    git('add', '.')
    git('commit', '-m', 'docs')
    assert.equal(spawnSync('bash', [script, dir, base, 'HEAD']).status, 0)
    writeFileSync(join(dir, 'app.java'), 'changed')
    git('add', '.')
    git('commit', '-m', 'code')
    assert.notEqual(spawnSync('bash', [script, dir, base, 'HEAD']).status, 0)
    assert.notEqual(spawnSync('bash', [script, dir, 'missing', 'HEAD']).status, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
