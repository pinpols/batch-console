// 用途：锁定密钥扫描在浅克隆和缺失基线下失败，在完整历史下只扫描目标范围。
// 用法：在仓库根目录执行 node --test scripts/tests/test-gitleaks-scan.test.mjs。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../ci/gitleaks-scan.sh', import.meta.url))

function git(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'gitleaks-test',
      GIT_AUTHOR_EMAIL: 'gitleaks-test@example.com',
      GIT_COMMITTER_NAME: 'gitleaks-test',
      GIT_COMMITTER_EMAIL: 'gitleaks-test@example.com',
    },
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
}

function commitFile(cwd, name, content, message) {
  writeFileSync(join(cwd, name), content)
  git(cwd, ['add', name])
  git(cwd, ['commit', '-m', message])
}

function initRepo(cwd) {
  git(cwd, ['init', '-b', 'main'])
  commitFile(cwd, 'a.txt', 'one\n', 'init')
  commitFile(cwd, 'b.txt', 'two\n', 'second')
}

function writeFakeGitleaks(binDir) {
  mkdirSync(binDir, { recursive: true })
  const file = join(binDir, 'gitleaks')
  writeFileSync(
    file,
    `#!/bin/sh
printf '%s\\n' "$@" > "$GITLEAKS_ARGS_FILE"
exit "\${GITLEAKS_EXIT_CODE:-0}"
`,
  )
  chmodSync(file, 0o755)
}

function runScan(cwd, binDir, argsFile, env = {}) {
  return spawnSync('bash', [script], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_BASE_REF: '',
      PATH: `${binDir}:${process.env.PATH}`,
      GITLEAKS_ARGS_FILE: argsFile,
      GITLEAKS_EXIT_CODE: '0',
      ...env,
    },
  })
}

function recordedArgs(argsFile) {
  return readFileSync(argsFile, 'utf8').trim().split('\n')
}

test('没有父提交时拒绝扫描，不调用 gitleaks', () => {
  const root = mkdtempSync(join(tmpdir(), 'gitleaks-root-'))
  const binDir = join(root, 'bin')
  const argsFile = join(root, 'args.txt')
  try {
    writeFakeGitleaks(binDir)
    git(root, ['init', '-b', 'main'])
    commitFile(root, 'a.txt', 'one\n', 'init')
    const result = runScan(root, binDir, argsFile)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /父提交/)
    assert.throws(() => recordedArgs(argsFile))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('depth 1 浅克隆拒绝扫描', () => {
  const root = mkdtempSync(join(tmpdir(), 'gitleaks-source-'))
  const shallow = join(root, 'shallow')
  const binDir = join(root, 'bin')
  const argsFile = join(root, 'args.txt')
  try {
    writeFakeGitleaks(binDir)
    const source = join(root, 'source')
    mkdirSync(source)
    initRepo(source)
    git(root, ['clone', '--depth', '1', '--no-local', source, shallow])
    const result = runScan(shallow, binDir, argsFile)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /父提交/)
    assert.throws(() => recordedArgs(argsFile))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('完整历史的非 PR 扫描只覆盖最新提交', () => {
  const root = mkdtempSync(join(tmpdir(), 'gitleaks-full-'))
  const binDir = join(root, 'bin')
  const argsFile = join(root, 'args.txt')
  const repo = join(root, 'repo')
  try {
    writeFakeGitleaks(binDir)
    mkdirSync(repo)
    initRepo(repo)
    const result = runScan(repo, binDir, argsFile)
    assert.equal(result.status, 0, result.stderr)
    assert.deepEqual(recordedArgs(argsFile), [
      'git',
      '.',
      '--log-opts=-1',
      '--redact',
      '--no-banner',
      '--exit-code',
      '1',
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('PR 基线缺失时失败，基线存在时扫描 origin/<base>..HEAD', () => {
  const root = mkdtempSync(join(tmpdir(), 'gitleaks-pr-'))
  const binDir = join(root, 'bin')
  const argsFile = join(root, 'args.txt')
  const repo = join(root, 'repo')
  try {
    writeFakeGitleaks(binDir)
    mkdirSync(repo)
    initRepo(repo)
    const missing = runScan(repo, binDir, argsFile, { GITHUB_BASE_REF: 'main' })
    assert.notEqual(missing.status, 0)
    assert.match(missing.stderr, /origin\/main/)
    assert.throws(() => recordedArgs(argsFile))

    git(repo, ['update-ref', 'refs/remotes/origin/main', 'HEAD~1'])
    const present = runScan(repo, binDir, argsFile, { GITHUB_BASE_REF: 'main' })
    assert.equal(present.status, 0, present.stderr)
    assert.deepEqual(recordedArgs(argsFile), [
      'git',
      '.',
      '--log-opts=origin/main..HEAD',
      '--redact',
      '--no-banner',
      '--exit-code',
      '1',
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('gitleaks 非零退出码原样传出', () => {
  const root = mkdtempSync(join(tmpdir(), 'gitleaks-exit-'))
  const binDir = join(root, 'bin')
  const argsFile = join(root, 'args.txt')
  const repo = join(root, 'repo')
  try {
    writeFakeGitleaks(binDir)
    mkdirSync(repo)
    initRepo(repo)
    const result = runScan(repo, binDir, argsFile, { GITLEAKS_EXIT_CODE: '1' })
    assert.equal(result.status, 1)
    assert.equal(recordedArgs(argsFile)[0], 'git')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
