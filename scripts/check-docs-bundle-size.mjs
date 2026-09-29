#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assetDir = fileURLToPath(
  new URL('../tools/docs-bridge/frontend/.vitepress/dist/assets/', import.meta.url),
)
const maxRawBytes = 850_000
const maxGzipBytes = 220_000

let files
try {
  files = await collectJavaScript(assetDir)
} catch {
  console.error('FAIL DOCS_BUNDLE_SIZE: 未找到统一文档站产物，请先执行 npm run docs:build')
  process.exit(1)
}

const violations = []
for (const name of files) {
  const content = await readFile(name)
  const gzipBytes = gzipSync(content).byteLength
  const isSearchIndex = name.includes('@localSearchIndex')
  // 单站索引覆盖两仓：产品指南保留全文，工程文档仅保留标题层级。
  const rawBudget = isSearchIndex ? 4_500_000 : maxRawBytes
  const gzipBudget = isSearchIndex ? 1_200_000 : maxGzipBytes
  if (content.byteLength > rawBudget || gzipBytes > gzipBudget) {
    violations.push(`${name.slice(assetDir.length)}: raw=${content.byteLength}, gzip=${gzipBytes}`)
  }
}

if (violations.length) {
  console.error(
    'FAIL DOCS_BUNDLE_SIZE: 文档 JS chunk 超过通用预算(raw 850KB/gzip 220KB)或搜索索引预算(raw 4.5MB/gzip 1.2MB)',
  )
  violations.forEach((item) => console.error(`  - ${item}`))
  process.exit(1)
}

console.log(
  'PASS DOCS_BUNDLE_SIZE: 统一文档站 JS chunk 通过通用预算，搜索索引通过独立预算',
)

async function collectJavaScript(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return collectJavaScript(path)
      return entry.isFile() && entry.name.endsWith('.js') ? [path] : []
    }),
  )
  return nested.flat()
}
