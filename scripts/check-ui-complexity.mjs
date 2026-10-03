#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src')
const baselinePath = join(root, 'config', 'ui-complexity-baseline.json')
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))

const thresholds = {
  fixedPx: 120,
  lines: 1200,
  overlays: 4,
  tableTags: 30
}

const metricLabels = {
  fixedPx: '固定 px',
  lines: '行数',
  overlays: '弹层数量',
  tableTags: '表格片段'
}

const errors = []
const observed = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      walk(path)
    } else if (extname(path) === '.vue') {
      inspectVue(path)
    }
  }
}

function countMatches(content, pattern) {
  return content.match(pattern)?.length ?? 0
}

function inspectVue(path) {
  const rel = relative(root, path).replaceAll('\\', '/')
  const content = readFileSync(path, 'utf8')
  const metrics = {
    fixedPx: countMatches(content, /\b\d+(?:\.\d+)?px\b/g),
    lines: content.split('\n').length,
    overlays: countMatches(content, /<\s*el-(?:dialog|drawer)(?:\s|>|\n)/g),
    tableTags: countMatches(
      content,
      /<\s*(?:el-table|el-table-column|ProTable)(?:\s|>|\n)/g
    )
  }
  const hotMetrics = Object.entries(metrics).filter(
    ([key, value]) => value > thresholds[key]
  )
  if (hotMetrics.length === 0) return

  const allowed = baseline[rel]
  if (!allowed) {
    errors.push(
      `${rel}: 新增 UI 复杂页面未登记基线（${formatMetrics(metrics, hotMetrics)}）`
    )
    return
  }

  for (const [key, value] of Object.entries(metrics)) {
    if (value > allowed[key]) {
      errors.push(`${rel}: ${metricLabels[key]} ${value}，超过基线 ${allowed[key]}`)
    }
  }
  if (!errors.some((error) => error.startsWith(`${rel}:`))) {
    observed.push(`${rel}: ${formatMetrics(metrics, hotMetrics)}`)
  }
}

function formatMetrics(metrics, entries = Object.entries(metrics)) {
  return entries.map(([key, value]) => `${metricLabels[key]} ${value}`).join('，')
}

walk(src)

if (errors.length) {
  errors.forEach((error) => console.error(`[ui-complexity] ${error}`))
  process.exit(1)
}

observed.forEach((item) => console.log(`[ui-complexity] 已登记: ${item}`))
console.log(`[ui-complexity] 通过，${observed.length} 个存量复杂页面未继续膨胀`)
