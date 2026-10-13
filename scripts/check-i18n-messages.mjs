#!/usr/bin/env node
/**
 * i18n 消息守护：先校验 zh-CN / en-US 的 key 集合 1:1 对齐，再用
 * vue-i18n 的 message-compiler 静态校验每条翻译值，拦截会让运行时
 * "Invalid linked format" / "Unbalanced closing brace" 等的脏数据。
 *
 * 触发场景:消息里含未转义的 `@`(被当作 linked-key)、不平衡的 `{}`、悬挂 `|` 等。
 * 一旦运行时编译失败,Vue 会冒泡到 ErrorBoundary 显示"组件渲染异常",整个路由不可用。
 *
 * 使用:
 *   node scripts/check-i18n-messages.mjs
 *   npm run check:i18n
 *
 * 退出码:发现错误 1,否则 0。
 */
import { baseCompile } from '@intlify/message-compiler'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const FILES = ['src/locales/zh-CN.ts', 'src/locales/en-US.ts']

function walk(obj, prefix, out) {
  if (typeof obj === 'string') {
    out.push([prefix, obj])
    return
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) walk(v, prefix ? `${prefix}.${k}` : k, out)
  }
}

async function load(file) {
  const url = pathToFileURL(path.resolve(file)).href
  const mod = await import(url)
  const data = mod.default
  if (!data || typeof data !== 'object') {
    throw new Error(`${file} 没有导出消息对象`)
  }
  const flat = []
  walk(data, '', flat)
  return flat
}

function difference(left, right) {
  return [...left].filter((key) => !right.has(key)).sort()
}

function checkKeyParity(entriesByFile) {
  const [zhFile, enFile] = FILES
  const zhKeys = new Set(entriesByFile.get(zhFile).map(([key]) => key))
  const enKeys = new Set(entriesByFile.get(enFile).map(([key]) => key))
  const onlyInZh = difference(zhKeys, enKeys)
  const onlyInEn = difference(enKeys, zhKeys)

  if (!onlyInZh.length && !onlyInEn.length) {
    console.log(`✓ i18n keys: ${zhKeys.size} keys aligned`)
    return 0
  }

  console.error('✗ i18n keys are not aligned')
  for (const key of onlyInZh) console.error(`  ${enFile} missing: ${key}`)
  for (const key of onlyInEn) console.error(`  ${zhFile} missing: ${key}`)
  return onlyInZh.length + onlyInEn.length
}

function checkMessages(flat) {
  const bad = []
  for (const [k, v] of flat) {
    const errs = []
    try {
      baseCompile(v, {
        onError: (e) => errs.push(e.message || String(e)),
      })
    } catch (e) {
      errs.push(e.message || String(e))
    }
    if (errs.length) bad.push({ key: k, value: v, errs })
  }
  return bad
}

const entriesByFile = new Map()
for (const file of FILES) entriesByFile.set(file, await load(file))

const parityBad = checkKeyParity(entriesByFile)
let messageBad = 0
for (const f of FILES) {
  const bad = checkMessages(entriesByFile.get(f))
  if (!bad.length) {
    console.log(`✓ ${f}: 0 issues`)
    continue
  }
  messageBad += bad.length
  console.error(`✗ ${f}: ${bad.length} issue(s)`)
  for (const b of bad) {
    const preview = JSON.stringify(b.value).slice(0, 120)
    console.error(`  [${b.key}] ${preview}`)
    for (const e of b.errs) console.error(`     → ${e}`)
  }
}

if (messageBad > 0) {
  console.error('\n常见原因 + 修复:')
  console.error('  - 含未转义的 @  → 改为 "at 符号" 或末位放(不接 - / 空格 / 字母)')
  console.error('  - 不平衡 { }    → 配对补齐,或转义')
  console.error('  - 悬挂 | / @ 后接非 key → 重写,避免触发 vue-i18n linked 语法')
}

if (parityBad + messageBad > 0) process.exit(1)
