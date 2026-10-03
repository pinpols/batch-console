#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readinessPath = join(root, 'docs/runbook/go-live-readiness-checklist.md')
const maturityPath = join(root, 'docs/engineering/engineering-maturity-roadmap.md')
const indexPaths = [
  join(root, 'docs/README.md'),
  join(root, 'docs/runbook/README.md'),
  join(root, 'docs/engineering/README.md'),
]

const errors = []

function readRequired(path) {
  if (!existsSync(path)) {
    errors.push(`缺少文件: ${relativePath(path)}`)
    return ''
  }
  return readFileSync(path, 'utf8')
}

function relativePath(path) {
  return path.replace(`${root}/`, '')
}

function requireIncludes(label, text, needles) {
  const missing = needles.filter((needle) => !text.includes(needle))
  if (missing.length) {
    errors.push(`${label} 缺少关键口径: ${missing.join(', ')}`)
  }
}

const readinessText = readRequired(readinessPath)
const maturityText = readRequired(maturityPath)

for (const path of indexPaths) {
  const text = readRequired(path)
  if (path.endsWith('docs/README.md')) {
    requireIncludes(relativePath(path), text, [
      'engineering/engineering-maturity-roadmap.md',
      'runbook/go-live-readiness-checklist.md',
    ])
  }
  if (path.endsWith('runbook/README.md')) {
    requireIncludes(relativePath(path), text, ['go-live-readiness-checklist.md'])
  }
  if (path.endsWith('engineering/README.md')) {
    requireIncludes(relativePath(path), text, ['engineering-maturity-roadmap.md'])
  }
}

requireIncludes('上线准入清单', readinessText, [
  'PR 快门禁',
  '真实环境验收',
  'UI 与交互准入',
  '发布运行时',
  '证据留存',
  '未验证',
  'ROLE_ADMIN',
  'ROLE_AUDITOR',
  'ROLE_TENANT_ADMIN',
  'ROLE_TENANT_USER',
  'version.json',
  'TraceId',
])

requireIncludes('工程成熟度路线图', maturityText, [
  'API 契约',
  '四角色权限',
  '关键流程真环境可验收',
  '运维型 UI 一致性',
  '页面复杂度治理',
  'Playwright route mock',
  '上线准入',
])

if (errors.length) {
  console.error('[go-live-readiness] 检查失败:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('[go-live-readiness] 通过：上线准入与工程成熟度文档覆盖关键治理口径')
