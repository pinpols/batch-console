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
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = new Set(process.argv.slice(2))
const staged = args.has('--staged')
const all = args.has('--all')

function gitChangedFiles() {
  const commands = all
    ? [
        ['diff', '--name-only', '-z', 'HEAD', '--'],
        ['ls-files', '--others', '--exclude-standard', '-z'],
      ]
    : [['diff', '--name-only', '-z', ...(staged ? ['--cached'] : ['HEAD']), '--']]
  const files = new Set()
  for (const commandArgs of commands) {
    const res = spawnSync('git', commandArgs, { encoding: 'utf8' })
    if (res.status !== 0) {
      process.stderr.write(res.stderr || res.stdout)
      process.exit(res.status ?? 1)
    }
    for (const file of res.stdout.split('\0').filter(Boolean)) {
      files.add(file)
    }
  }
  return [...files]
}

function hasAny(files, predicates) {
  return files.some((file) => predicates.some((p) => p(file)))
}

let gateTempDir
let failureFile
let runnerErrors = 0

function run(code, group, label, command, commandArgs) {
  const gateArgs = [
    'scripts/ci/run-gate.sh',
    '--group',
    group,
    code,
    label,
    '--',
    command,
    ...commandArgs,
  ]
  const res = spawnSync('bash', gateArgs, {
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      BATCH_GATE_COLLECT: '1',
      BATCH_GATE_FAILURE_FILE: failureFile,
    },
  })
  if (res.status !== 0) runnerErrors += 1
}

function runNpm(code, group, label, script, args = []) {
  run(code, group, label, 'npm', ['run', script, ...(args.length > 0 ? ['--', ...args] : [])])
}

function assertCollected() {
  const res = spawnSync(
    'bash',
    ['-c', 'source scripts/lib/gate-result.sh; gate_assert_collected'],
    { stdio: 'inherit', shell: false, env: { ...process.env, BATCH_GATE_FAILURE_FILE: failureFile } },
  )
  rmSync(gateTempDir, { recursive: true, force: true })
  if (runnerErrors > 0 || res.status !== 0) process.exit(1)
}

function hasUnstagedChanges(paths) {
  const res = spawnSync('git', ['diff', '--quiet', '--', ...paths], { stdio: 'inherit' })
  if (res.status === 0) return false
  if (res.status === 1) return true
  process.exit(res.status ?? 1)
}

const files = gitChangedFiles()

if (files.length === 0) {
  console.log('[preflight] no changed files, skip')
  process.exit(0)
}

gateTempDir = mkdtempSync(join(tmpdir(), 'batch-console-preflight-'))
failureFile = join(gateTempDir, 'failures.tsv')

run('FE_ENCODING', 'hygiene', 'UTF-8 文本编码', process.execPath, [
  'scripts/check-text-encoding.mjs',
  '--files',
  ...files,
])

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
const docsBuildChanged = hasAny(files, [
  (f) => /^tools\/docs-bridge\/frontend\//.test(f),
  (f) => /^scripts\/docs-(prepare|build|serve|lib)\./.test(f),
])
const architectureChanged = hasAny(files, [
  (f) => /^src\/.+\.(vue|ts|tsx)$/.test(f),
  (f) => /^scripts\/check-architecture\.mjs$/.test(f),
])
const testFixtureSourceChanged = hasAny(files, [
  (f) => /^src\/.+\.(vue|ts|tsx)$/.test(f),
  (f) => /^e2e\/.+\.(spec\.ts|cjs|mjs|json)$/.test(f),
  (f) => f === 'playwright.config.cjs',
  (f) => f === 'src/constants/storageKeys.json',
  (f) => f === 'scripts/check-test-fixture-sources.mjs',
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
  (f) =>
    /^(src\/|public\/|Dockerfile$|docker-compose.*\.ya?ml$|nginx\/|package(?:-lock)?\.json$)/.test(
      f,
    ),
])

const commentScopeChanged = hasAny(files, [
  (f) => /^(src|e2e|scripts)\/.+\.(cjs|css|js|mjs|sh|ts|tsx|vue)$/.test(f),
  (f) =>
    [
      'eslint.config.js',
      'playwright.config.cjs',
      'playwright.visual.config.cjs',
      'vite.config.ts',
    ].includes(f),
])

if (commentScopeChanged) {
  run('FE_COMMENTS', 'quality', '中文解释性注释', process.execPath, [
    'scripts/check-comment-language.mjs',
    '--files',
    ...files,
  ])
}

if (packageChanged) {
  if (staged) {
    if (hasUnstagedChanges(['package.json', 'package-lock.json'])) {
      console.error('[preflight] package 文件还有未暂存改动，拒绝自动生成合规快照')
      runnerErrors += 1
    } else {
      run('FE_SBOM_SYNC', 'supply-chain', '重建并暂存 SBOM 与许可证清单', 'bash', [
        '-c',
        'npm run compliance:sbom && git add -- docs/compliance/sbom.json docs/compliance/THIRD-PARTY-LICENSES.md',
      ])
    }
  }
  runNpm('FE_VERSION', 'configuration', '版本对齐', 'check:version')
}

if (srcChanged) {
  runNpm('FE_LINT', 'quality', 'ESLint', 'lint:check')
  runNpm('FE_TYPECHECK', 'quality', 'TypeScript 类型检查', 'typecheck')
  runNpm('FE_READABILITY_CALLS', 'quality', '新增调用现场深层嵌套', 'check:readability-calls')
}

if (localeChanged) {
  runNpm('FE_I18N', 'localization', '国际化词条一致性', 'check:i18n')
}

if (apiChanged) {
  runNpm('FE_API_DRIFT', 'contracts', 'OpenAPI 漂移', 'gen:api:check')
}

if (architectureChanged) {
  runNpm('FE_ARCHITECTURE', 'quality', '架构边界', 'check:architecture')
  runNpm('FE_MAINTAINABILITY', 'quality', '可维护性限制', 'check:maintainability')
}

if (testFixtureSourceChanged) {
  runNpm('FE_TEST_FIXTURE_SOURCES', 'testing', '测试 fixture 事实来源', 'check:test-fixture-sources')
}

if (environmentChanged) {
  runNpm('FE_ENV', 'configuration', '环境变量治理', 'check:env')
}

if (workflowChanged) {
  runNpm('FE_WORKFLOWS', 'governance', 'Workflow 治理', 'check:workflows')
}

if (docsChanged) {
  runNpm('FE_DOCS', 'docs', '文档链接与路径', 'check:docs')
  runNpm('FE_GO_LIVE_READINESS', 'docs', '上线准入文档覆盖', 'check:go-live-readiness')
}

if (docsBuildChanged) {
  runNpm('FE_DOCS_BUILD', 'docs', '统一文档构建', 'docs:build')
}

if (complianceChanged) {
  runNpm('FE_COMPLIANCE', 'supply-chain', 'SBOM 与许可证漂移', 'compliance:check')
}

if (releaseImpact) {
  runNpm('FE_CHANGELOG', 'docs', 'Changelog 覆盖', 'check:changelog')
}

assertCollected()
console.log('\n[preflight] changed-file checks passed')
