#!/usr/bin/env node
// 用途：检查 Shell 脚本在 Linux CI 与 macOS 本地的跨平台兼容性。
// 用法：在仓库根目录执行 node scripts/check-shell-portability.mjs。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GATE_CODE = 'SHELL_PORTABILITY'
const GATE_NAME = 'Shell 跨平台兼容性'
const EXTRA_FILES = ['.husky/pre-commit', '.husky/pre-push']
const EXEMPTION = /^#\s*shell-min-version:\s*4\b/m

const LINE_RULES = [
  {
    name: 'bsd-sed-in-place',
    pattern: /\bsed\s+-i\s+(['"]{2}|'')/,
    message: '使用临时文件 + mv，替代 BSD 专属的 sed -i。',
  },
  {
    name: 'bsd-date-v',
    pattern: /\bdate\s+-v[+-]?\d/,
    message: '使用可移植的时间计算，替代 BSD 专属的 date -v。',
  },
  {
    name: 'bsd-stat-f-without-linux-fallback',
    pattern: /\bstat\s+-f\b/,
    allow: /\|\|\s*stat\s+-c\b/,
    message: 'stat -f 必须提供 Linux 的 stat -c 回退。',
  },
  {
    name: 'macos-open',
    pattern: /\bopen\s+-a\b/,
    message: 'open 仅 macOS 可用，请加 OS 判断或改用跨平台命令。',
  },
  {
    name: 'pbcopy-pbpaste',
    pattern: /\b(pbcopy|pbpaste)\b/,
    message: 'pbcopy/pbpaste 仅 macOS 可用，不要用于仓库自动化。',
  },
  {
    name: 'osascript',
    pattern: /\bosascript\b/,
    message: 'osascript 仅 macOS 可用，不要用于仓库自动化。',
  },
  {
    name: 'gnu-xargs-r',
    pattern: /\bxargs\b[^|;\n]*\s-r\b/,
    message: 'BSD xargs 不支持 -r，请改用读循环。',
  },
  {
    name: 'lowercase-expansion',
    pattern: /\$\{[A-Za-z_][A-Za-z0-9_]*,,}/,
    message: 'Bash 3.2 不支持 ${var,,}，请使用 tr。',
  },
  {
    name: 'uppercase-expansion',
    pattern: /\$\{[A-Za-z_][A-Za-z0-9_]*\^\^}/,
    message: 'Bash 3.2 不支持 ${var^^}，请使用 tr。',
  },
  { name: 'mapfile', pattern: /\bmapfile\b/, message: 'mapfile 需要 Bash 4+，请改用 while read。' },
  {
    name: 'readarray',
    pattern: /\breadarray\b/,
    message: 'readarray 需要 Bash 4+，请改用 while read。',
  },
  {
    name: 'associative-array',
    pattern: /\b(declare|local|typeset)\s+-[A-Za-z]*A(\s|$)/,
    message: '关联数组需要 Bash 4+，请改用索引数组或其他查表方式。',
  },
]

const FILE_RULES = [
  {
    name: 'shasum-sha256-without-fallback',
    usage: /\bshasum\s+-a\s+256\b/,
    fallback: /\bsha256sum\b/,
    message: 'Linux 使用 sha256sum，shasum 仅作回退。',
  },
  {
    name: 'shasum-sha512-without-fallback',
    usage: /\bshasum\s+-a\s+512\b/,
    fallback: /\bsha512sum\b/,
    message: 'Linux 使用 sha512sum，shasum 仅作回退。',
  },
  {
    name: 'shasum-without-linux-fallback',
    usage: /\bshasum\b/,
    fallback: /\b(sha1sum|sha256sum|sha512sum)\b/,
    message: '许多 Linux 镜像没有 shasum，请优先 sha*sum。',
  },
  {
    name: 'md5-without-md5sum',
    usage: /\bmd5\s+-[A-Za-z]/,
    fallback: /\bmd5sum\b/,
    message: 'md5 仅 macOS 可用，请使用 md5sum 回退。',
  },
]

function isCommentOrBlank(line) {
  const trimmed = line.trim()
  return trimmed === '' || trimmed.startsWith('#')
}

function isExempt(content) {
  return EXEMPTION.test(content.split('\n').slice(0, 15).join('\n'))
}

export function scanContent(relativePath, content) {
  if (isExempt(content)) return []
  const errors = []
  const lines = content.split('\n')
  lines.forEach((line, index) => {
    if (isCommentOrBlank(line)) return
    for (const rule of LINE_RULES) {
      if (!rule.pattern.test(line)) continue
      if (rule.allow?.test(line)) continue
      errors.push(`${relativePath}:${index + 1}: ${rule.name}: ${rule.message}`)
    }
  })
  for (const rule of FILE_RULES) {
    if (!rule.usage.test(content) || rule.fallback.test(content)) continue
    const line = lines.findIndex((candidate) => rule.usage.test(candidate))
    errors.push(`${relativePath}:${line + 1}: ${rule.name}: ${rule.message}`)
  }
  return errors
}

export function shellFiles() {
  const tracked = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.sh'],
    { cwd: root, encoding: 'utf8' },
  )
    .split('\0')
    .filter(Boolean)
  for (const extra of EXTRA_FILES) {
    if (existsSync(join(root, extra)) && !tracked.includes(extra)) tracked.push(extra)
  }
  return tracked
}

export function scanRepository(files = shellFiles()) {
  const errors = []
  for (const file of files) {
    const absolute = join(root, file)
    if (!existsSync(absolute)) continue
    errors.push(...scanContent(relative(root, absolute), readFileSync(absolute, 'utf8')))
  }
  return errors
}

export function main() {
  const files = shellFiles()
  const errors = scanRepository(files)
  if (errors.length > 0) {
    console.error(`❌ 不通过 | code=${GATE_CODE} | gate=${GATE_NAME} | exit_code=1`)
    for (const error of errors) console.error(`  - ${error}`)
    return 1
  }
  console.log(`✅ 通过 | code=${GATE_CODE} | gate=${GATE_NAME} | files=${files.length}`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}
