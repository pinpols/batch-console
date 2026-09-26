#!/usr/bin/env node
/**
 * 按变更文件选择本地预检项。
 *
 * 目标不是替代 CI 全量门禁，而是在提交前拦住最常见、最便宜的漂移：
 * - locale 变更后忘跑 i18n
 * - API / 生成类型变更后忘跑 OpenAPI drift
 * - package 版本或 lockfile 漂移
 * - 文档站入口改坏
 * - src 代码改动后未做类型检查
 */
import { spawnSync } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const staged = args.has('--staged')
const all = args.has('--all')

function gitChangedFiles() {
  const diffArgs = all
    ? ['ls-files']
    : ['diff', '--name-only', staged ? '--cached' : 'HEAD', '--']
  const res = spawnSync('git', diffArgs, { encoding: 'utf8' })
  if (res.status !== 0) {
    process.stderr.write(res.stderr || res.stdout)
    process.exit(res.status ?? 1)
  }
  return res.stdout
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
}

function hasAny(files, predicates) {
  return files.some((file) => predicates.some((p) => p(file)))
}

function run(label, command, commandArgs) {
  console.log(`\n[preflight] ${label}`)
  const res = spawnSync(command, commandArgs, { stdio: 'inherit', shell: false })
  if (res.status !== 0) process.exit(res.status ?? 1)
}

const files = gitChangedFiles()

if (files.length === 0) {
  console.log('[preflight] no changed files, skip')
  process.exit(0)
}

const srcChanged = hasAny(files, [(f) => /^src\/.+\.(vue|ts|tsx)$/.test(f)])
const localeChanged = hasAny(files, [
  (f) => /^src\/locales\/.+\.(ts|json)$/.test(f),
  (f) => /^src\/.+\.(vue|ts|tsx)$/.test(f),
])
const apiChanged = hasAny(files, [
  (f) => /^src\/api\/.+\.ts$/.test(f),
  (f) => f === 'src/types/api.generated.ts',
  (f) => /^src\/types\/.+\.ts$/.test(f),
])
const packageChanged = hasAny(files, [
  (f) => f === 'package.json',
  (f) => f === 'package-lock.json',
])
const docsChanged = hasAny(files, [
  (f) => /^docs\//.test(f),
  (f) => /^tools\/docs-bridge\/frontend\//.test(f),
])
const backendDocsBridgeChanged = hasAny(files, [(f) => /^tools\/docs-bridge\/backend\//.test(f)])

if (packageChanged) {
  run('package version alignment', 'npm', ['run', 'check:version'])
}

if (srcChanged) {
  run('ESLint check', 'npm', ['run', 'lint:check'])
  run('TypeScript check', 'npm', ['run', 'typecheck'])
}

if (localeChanged) {
  run('i18n consistency', 'npm', ['run', 'check:i18n'])
}

if (apiChanged) {
  run('OpenAPI drift', 'npm', ['run', 'gen:api:check'])
}

if (docsChanged) {
  run('frontend docs build', 'npm', ['run', 'fe-docs:build'])
}

if (backendDocsBridgeChanged) {
  run('backend docs bridge build', 'npm', ['run', 'docs:build'])
}

console.log('\n[preflight] changed-file checks passed')
