import { readdir, readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const budgets = [
  { name: 'vendor-element-plus', prefix: 'vendor-element-plus-', maxBytes: 340_000 },
  { name: 'vendor-vue', prefix: 'vendor-vue-', maxBytes: 60_000 },
  { name: 'main (index)', prefix: 'index-', maxBytes: 200_000 },
]
const gateCode = 'FE_BUNDLE_SIZE'
const gateName = 'Bundle 体积预算'

function failLine() {
  console.error(`❌ 不通过 | code=${gateCode} | gate=${gateName} | exit_code=1`)
}

const assetDir = fileURLToPath(new URL('../dist/assets/', import.meta.url))
let files
try {
  files = await readdir(assetDir)
} catch {
  failLine()
  console.error('dist/assets is missing; run the frontend build before checking bundle size')
  process.exit(1)
}

let failed = false
for (const budget of budgets) {
  const matches = files.filter((name) => name.startsWith(budget.prefix) && name.endsWith('.js'))
  if (matches.length !== 1) {
    console.error(`${budget.name}: expected one matching JS asset, found ${matches.length}`)
    failed = true
    continue
  }

  const gzipBytes = gzipSync(await readFile(join(assetDir, matches[0]))).byteLength
  const result = `${gzipBytes} / ${budget.maxBytes} bytes gzip`
  if (process.argv.includes('--why')) {
    console.log(`${budget.name}: ${matches[0]} (${result})`)
  }
  if (gzipBytes > budget.maxBytes) {
    console.error(`${budget.name}: ${result}`)
    failed = true
  } else {
    console.log(`${budget.name}: ${result}`)
  }
}

if (failed) {
  failLine()
  process.exit(1)
}
console.log(`✅ 通过 | code=${gateCode} | gate=${gateName} | budgets=${budgets.length}`)
