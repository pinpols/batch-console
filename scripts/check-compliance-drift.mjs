#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tracked = ['docs/compliance/sbom.json', 'docs/compliance/THIRD-PARTY-LICENSES.md']
const before = new Map(tracked.map((file) => [file, readFileSync(resolve(root, file), 'utf8')]))
const generated = spawnSync(process.execPath, ['scripts/generate-frontend-compliance.mjs'], {
  cwd: root,
  stdio: 'inherit',
})
if (generated.status !== 0) process.exit(generated.status ?? 1)

const changed = tracked.filter(
  (file) => readFileSync(resolve(root, file), 'utf8') !== before.get(file),
)
if (changed.length) {
  changed.forEach((file) => console.error(`[compliance] 已过期: ${file}`))
  console.error('[compliance] SBOM 或许可证快照已过期，请提交 npm run compliance:sbom 的结果')
  process.exit(1)
}
console.log('[compliance] SBOM 与 package-lock.json 一致')
