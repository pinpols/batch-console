#!/usr/bin/env node
/**
 * docs-prepare:vitepress 启动前清理 BE 仓 docs 目录里残留的 index.md 软链
 *
 * 历史:之前试过 README.md → index.md 软链让根路径 /docs/ 命中,但 vitepress 1.6.4
 * 的 search index 用文件路径当 ID,会把 README.md 和 index.md 当两个文档,触发
 * "MiniSearch: duplicate ID" 启动失败。
 *
 * 现行方案:
 *   - LayoutHeader 的"文档中心"按钮直跳 /docs/README(README.md 在 cleanUrls 下的 URL)
 *   - nginx 加 /docs/ → /docs/README 的 302 兜底外部进入
 *   - 不再用软链。本脚本只在启动前清理历史可能遗留的软链(防 search 启动崩),
 *     若 BE 仓干净则一次性 0,无副作用
 */
import { readdirSync, statSync, lstatSync, unlinkSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const docsRoot = join(__dirname, '..', '..', 'file-batch-system', 'docs')

if (!existsSync(docsRoot)) {
  console.log('[docs-prepare] sibling file-batch-system/docs 不存在,跳过')
  process.exit(0)
}

let removed = 0

function walk(dir) {
  const index = join(dir, 'index.md')
  if (existsSync(index) && lstatSync(index).isSymbolicLink()) {
    unlinkSync(index)
    removed++
  }
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const sub = join(dir, name)
    try {
      if (statSync(sub).isDirectory()) walk(sub)
    } catch {
      /* broken symlink etc. */
    }
  }
}

walk(docsRoot)
if (removed) console.log(`[docs-prepare] cleaned ${removed} stale index.md symlinks`)
