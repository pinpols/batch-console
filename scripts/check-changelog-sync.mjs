#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

let range
const baseRef = process.env.GITHUB_BASE_REF
if (baseRef) {
  range = `origin/${baseRef}...HEAD`
} else {
  try {
    git(['rev-parse', 'HEAD^'])
    range = 'HEAD^...HEAD'
  } catch {
    console.log('[changelog] 首个提交，无比较基线')
    process.exit(0)
  }
}

const changed = new Set(git(['diff', '--name-only', range]).split('\n').filter(Boolean))
if (!process.env.CI) {
  for (const args of [
    ['diff', '--name-only'],
    ['diff', '--cached', '--name-only'],
  ]) {
    for (const file of git(args).split('\n').filter(Boolean)) changed.add(file)
  }
}
const releaseImpact = [...changed].some((file) =>
  /^(src\/|public\/|Dockerfile$|docker-compose.*\.ya?ml$|nginx\/|package(?:-lock)?\.json$)/.test(
    file,
  ),
)
if (releaseImpact && !changed.has('CHANGELOG.md')) {
  console.error('[changelog] 存在用户或部署影响变更，但 CHANGELOG.md 未更新')
  process.exit(1)
}
console.log(`[changelog] 通过，比较范围 ${range}`)
