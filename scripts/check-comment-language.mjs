#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '..')
const generatedFiles = new Set([
  'src/types/api.generated.ts',
  'src/types/auto-imports.d.ts',
  'src/types/components.d.ts',
])
const rootSourceFiles = new Set([
  'eslint.config.js',
  'playwright.config.cjs',
  'playwright.visual.config.cjs',
  'vite.config.ts',
])
const supportedExtensions = new Set(['.cjs', '.css', '.js', '.mjs', '.sh', '.ts', '.tsx', '.vue'])

function repositoryFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root },
  )
  return output
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter((file) => {
      if (generatedFiles.has(file) || !supportedExtensions.has(extname(file))) return false
      return (
        file.startsWith('src/') ||
        file.startsWith('e2e/') ||
        file.startsWith('scripts/') ||
        rootSourceFiles.has(file)
      )
    })
}

function lineNumber(text, offset) {
  let line = 1
  for (let index = 0; index < offset; index += 1) {
    if (text.charCodeAt(index) === 10) line += 1
  }
  return line
}

function scanScript(text, baseOffset = 0) {
  const sourceFile = ts.createSourceFile('comment-scan.ts', text, ts.ScriptTarget.Latest, true)
  const ranges = new Map()

  function collect(found) {
    for (const range of found ?? []) ranges.set(`${range.pos}:${range.end}`, range)
  }

  function visit(node) {
    collect(ts.getLeadingCommentRanges(text, node.pos))
    collect(ts.getTrailingCommentRanges(text, node.end))
    ts.forEachChild(node, visit)
  }

  collect(ts.getLeadingCommentRanges(text, 0))
  visit(sourceFile)
  return [...ranges.values()]
    .sort((a, b) => a.pos - b.pos)
    .map((range) => ({
      text: text.slice(range.pos, range.end),
      offset: baseOffset + range.pos,
    }))
}

function scanPattern(text, pattern, baseOffset = 0) {
  return [...text.matchAll(pattern)].map((match) => ({
    text: match[0],
    offset: baseOffset + (match.index ?? 0),
  }))
}

function extractComments(file, text) {
  if (file.endsWith('.vue')) {
    const comments = scanPattern(text, /<!--[\s\S]*?-->/g)
    for (const match of text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
      const content = match[1]
      const contentOffset = (match.index ?? 0) + match[0].indexOf(content)
      comments.push(...scanScript(content, contentOffset))
    }
    for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      const content = match[1]
      const contentOffset = (match.index ?? 0) + match[0].indexOf(content)
      comments.push(...scanPattern(content, /\/\*[\s\S]*?\*\//g, contentOffset))
    }
    return comments
  }
  if (file.endsWith('.css')) return scanPattern(text, /\/\*[\s\S]*?\*\//g)
  if (file.endsWith('.sh')) {
    return [...text.matchAll(/^\s*#(?!\!)(.*)$/gm)].map((match) => ({
      text: match[0],
      offset: match.index ?? 0,
    }))
  }
  return scanScript(text)
}

function commentLines(comment) {
  return comment
    .replace(/^\s*\/\*+/, '')
    .replace(/\*\/\s*$/, '')
    .replace(/^\s*\/\//, '')
    .replace(/^\s*<!--/, '')
    .replace(/-->\s*$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\*|#)\s?/, '').trim())
}

function isExempt(line) {
  if (!line || /[\p{Script=Han}]/u.test(line)) return true
  if (/^[-=─│┌┐└┘→←+*/.\s]+$/u.test(line)) return true
  if (
    /^(?:eslint|prettier|stylelint|oxlint|oxfmt|biome|c8|istanbul|noinspection|shellcheck)(?:-|\b)/i.test(
      line,
    )
  )
    return true
  if (/^@(?:ts-check|ts-nocheck|ts-ignore|ts-expect-error|vitest-environment)\b/i.test(line))
    return true
  if (/^@(?:param|returns?|throws?|type|template|typedef|property|example|see|link)\b/i.test(line))
    return true
  if (/^(?:https?:\/\/|\.\.?\/|\/)[^\s]*$/i.test(line)) return true
  if (/^```\w*$/u.test(line)) return true
  if (/^<reference\s+types=/.test(line.replace(/^\/\s*/, ''))) return true
  if (/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\/\S*$/i.test(line)) return true
  if (/^\/\S+:\s+\S+/u.test(line)) return true
  if (/^(?:npm|pnpm|yarn|node|bash|npx|docker|git|curl)\s+\S+/i.test(line)) return true
  if (/^(?:env|run):(?:\s|$)/i.test(line)) return true
  if (/^[A-Z][A-Z0-9_]*:\s+(?:https?:\/\/|\S+=)/u.test(line)) return true
  if (/^[A-Z][A-Z0-9_]*(?:\s*[=/|,+-]\s*[A-Z0-9_]+)*$/u.test(line)) return true
  if (/^[\w$.@/-]+(?:\s*[,|/]\s*[\w$.@/-]+)+[,:;。]?$/u.test(line)) return true
  if (
    /^(?:import|export|const|let|var|return|await|if|for|while|function|class|interface|type)\b.*[;{([\]]/u.test(
      line,
    )
  )
    return true
  if (/^[<{[(].*[>})\]];?$/u.test(line)) return true
  if (/^<[A-Z][\w.-]*(?:\s|$)/u.test(line)) return true
  if (/^(?:async\s+)?function\s+.+\{$/u.test(line)) return true
  if (/^\{.*(?:,|\})?$/u.test(line)) return true
  if (/^[\w$]+\s*:\s*(?:`|'|"|true\b|false\b|\d|\w+\()/u.test(line)) return true
  if (/^[\w$.]+\([^)]*\);?$/u.test(line)) return true
  if (/^[\w$.]+\(\{$/u.test(line)) return true
  if (/^[\w$.]+\(.+=>.+\);?$/u.test(line)) return true
  if (/^[\w$.@:-]+\s*=\s*\S+/u.test(line)) return true
  if (/^[-*]\s+`?[\w@./:-]+`?(?:\s*[(/|,+→]\s*`?[\w@./:-]+`?)*[)。;]?$/u.test(line)) return true
  if (/^[-*]\s+`/.test(line)) return true
  if (/^\/?[\w./-]+(?:\s*\/\s*[\w./-]+)+[)。;]?$/u.test(line)) return true
  if (/^[\w.-]+(?:\/[\w.{}:-]+)+[）。;]?$/u.test(line)) return true
  if (/^\$?[A-Z][A-Z0-9_]*=\S+/u.test(line)) return true
  const prose = line
    .replace(/`[^`]+`/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/(?:\.\.?\/|\/)?[\w@.-]+(?:\/[\w@.{}:-]+)+/g, '')
    .replace(/\b[A-Z][A-Z0-9_/-]*\b/g, '')
    .replace(/\b[\w$]+(?:[.:_-][\w$]+)+\b/g, '')
  return !/[A-Za-z]{2}/.test(prose)
}

function verifyPolicy() {
  const cases = [
    ['fallback when the backend request fails', false],
    ['后端请求失败时使用本地回退值', true],
    ['GET /api/console/jobs/{id}', true],
    ['@ts-check', true],
    ['const options = [', true],
  ]
  for (const [line, expected] of cases) {
    if (isExempt(line) !== expected) {
      throw new Error(`[comment-language] 内建策略校验失败：${line}`)
    }
  }

  const parsed = scanScript(
    String.raw`const endpoint = 'https://example.com/api'
const pattern = /https?:\/\//
// 中文解释`,
  )
  if (parsed.length !== 1 || !parsed[0].text.includes('中文解释')) {
    throw new Error('[comment-language] 注释解析器把字符串或正则误判为注释')
  }
}

function verifyLocalHookWiring() {
  const preCommit = readFileSync(resolve(root, '.husky/pre-commit'), 'utf8')
  if (!/^npm run preflight:changed\s*$/m.test(preCommit)) {
    throw new Error('[comment-language] .husky/pre-commit 未接入 preflight:changed')
  }

  const preflight = readFileSync(resolve(root, 'scripts/local/preflight-changed.mjs'), 'utf8')
  if (!/\['run', 'check:comments'\]/u.test(preflight)) {
    throw new Error('[comment-language] preflight:changed 未接入 check:comments')
  }
}

verifyPolicy()
verifyLocalHookWiring()

const failures = []
let checkedComments = 0
for (const file of repositoryFiles()) {
  const text = readFileSync(resolve(root, file), 'utf8')
  for (const comment of extractComments(file, text)) {
    checkedComments += 1
    const lines = commentLines(comment.text)
    lines.forEach((line, index) => {
      if (!isExempt(line)) {
        failures.push(`${file}:${lineNumber(text, comment.offset) + index}: ${line}`)
      }
    })
  }
}

if (failures.length > 0) {
  console.error(
    '[comment-language] 解释性注释必须使用中文，技术标识、工具指令、接口路径和代码示例可保留原文：',
  )
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`[comment-language] 通过：检查 ${checkedComments} 个手写代码注释`)
