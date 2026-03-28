import fs from 'node:fs'
import { execSync } from 'node:child_process'

if (!fs.existsSync(new URL('../.git', import.meta.url))) {
  process.exit(0)
}

execSync('husky', { stdio: 'inherit' })

