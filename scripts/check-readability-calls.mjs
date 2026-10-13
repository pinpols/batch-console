#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { findChangedCallsiteCandidates, parseAddedLineRanges } from './lib/readability-callsite.mjs'

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function resolveBase() {
  const explicit = process.argv.find((argument) => argument.startsWith('--base='))?.slice(7)
  if (explicit) return explicit

  const branch = process.env.GITHUB_BASE_REF
  const ref = branch ? `origin/${branch}` : 'origin/main'
  return git('merge-base', ref, 'HEAD').trim()
}

function isProductionSource(file) {
  if (!file.startsWith('src/')) return false
  if (!/\.(?:ts|tsx|vue)$/.test(file)) return false
  if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(file)) return false
  if (file.endsWith('.d.ts') || file.endsWith('/api.generated.ts')) return false
  return true
}

const base = resolveBase()
const diff = git('diff', '--unified=0', '--no-color', base, '--', 'src')
const changedFiles = parseAddedLineRanges(diff)
const untrackedFiles = git('ls-files', '--others', '--exclude-standard', '--', 'src')
  .split('\n')
  .filter(Boolean)
for (const file of untrackedFiles) {
  if (!changedFiles.has(file)) {
    const lineCount = readFileSync(file, 'utf8').split('\n').length
    changedFiles.set(file, [[1, lineCount]])
  }
}
const findings = []

for (const [file, changedLines] of changedFiles) {
  if (!isProductionSource(file) || changedLines.length === 0) continue
  findings.push(...findChangedCallsiteCandidates(readFileSync(file, 'utf8'), file, changedLines))
}

if (findings.length > 0) {
  console.error('新增/修改的生产表达式包含至少 3 层嵌套调用；请评估提取有业务含义的局部变量：')
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line} ${finding.kind}（嵌套深度 ${finding.depth}）`)
  }
  process.exitCode = 1
} else {
  console.log(`✅ 调用现场可读性门禁通过：基线 ${base.slice(0, 12)}，未发现新增深层嵌套调用`)
}
