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
  const commands = all
    ? [
        ['diff', '--name-only', 'HEAD', '--'],
        ['ls-files', '--others', '--exclude-standard'],
      ]
    : [['diff', '--name-only', staged ? '--cached' : 'HEAD', '--']]
  const files = new Set()
  for (const commandArgs of commands) {
    const res = spawnSync('git', commandArgs, { encoding: 'utf8' })
    if (res.status !== 0) {
      process.stderr.write(res.stderr || res.stdout)
      process.exit(res.status ?? 1)
    }
    for (const file of res.stdout.split('\n').map((x) => x.trim()).filter(Boolean)) {
      files.add(file)
    }
  }
  return [...files]
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

run('UTF-8 text encoding', 'npm', ['run', 'check:encoding'])

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
  (f) => /^scripts\/docs-(prepare|build|serve|lib)\./.test(f),
])
const architectureChanged = hasAny(files, [
  (f) => /^src\/.+\.(vue|ts|tsx)$/.test(f),
  (f) => /^scripts\/check-architecture\.mjs$/.test(f),
])
const environmentChanged = hasAny(files, [
  (f) => /^\.env/.test(f),
  (f) => /^config\/frontend-env\.json$/.test(f),
  (f) => f === 'Dockerfile' || /^docker-compose/.test(f),
  (f) => /^\.github\/workflows\//.test(f),
])
const workflowChanged = hasAny(files, [(f) => /^\.github\/workflows\//.test(f)])
const complianceChanged = hasAny(files, [
  (f) => f === 'package.json' || f === 'package-lock.json',
  (f) => /^scripts\/(generate-frontend-compliance|check-compliance-drift)\.mjs$/.test(f),
])
const releaseImpact = hasAny(files, [
  (f) => /^(src\/|public\/|Dockerfile$|docker-compose.*\.ya?ml$|nginx\/|package(?:-lock)?\.json$)/.test(f),
])

const commentScopeChanged = hasAny(files, [
  (f) => /^(src|e2e|scripts)\/.+\.(cjs|css|js|mjs|sh|ts|tsx|vue)$/.test(f),
  (f) => ['eslint.config.js', 'playwright.config.cjs', 'playwright.visual.config.cjs', 'vite.config.ts'].includes(f),
])

if (commentScopeChanged) {
  run('Chinese explanatory comments', 'npm', ['run', 'check:comments'])
}

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

if (architectureChanged) {
  run('architecture boundaries', 'npm', ['run', 'check:architecture'])
  run('maintainability limits', 'npm', ['run', 'check:maintainability'])
}

if (environmentChanged) {
  run('environment governance', 'npm', ['run', 'check:env'])
}

if (workflowChanged) {
  run('workflow governance', 'npm', ['run', 'check:workflows'])
}

if (docsChanged) {
  run('documentation links and paths', 'npm', ['run', 'check:docs'])
  run('unified docs build', 'npm', ['run', 'docs:build'])
}

if (complianceChanged) {
  run('SBOM and license drift', 'npm', ['run', 'compliance:check'])
}

if (releaseImpact) {
  run('changelog coverage', 'npm', ['run', 'check:changelog'])
}

console.log('\n[preflight] changed-file checks passed')
