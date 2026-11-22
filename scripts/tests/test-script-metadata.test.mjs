// 用途：验证脚本头与索引门禁的正反例。
// 用法：在仓库根目录执行 node --test scripts/tests/test-script-metadata.test.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'

import { checkMetadata } from '../check-script-metadata.mjs'

const readme = '| `scripts/good.sh` | 示例 |\n'
const sources = {
  'scripts/good.sh': '#!/usr/bin/env bash\n# 用途：示例。\n# 用法：bash scripts/good.sh。\n',
  'scripts/no-purpose.sh': '#!/usr/bin/env bash\n# 用法：bash scripts/no-purpose.sh。\n',
  'scripts/no-usage.sh': '#!/usr/bin/env bash\n# 用途：示例。\n',
  'scripts/unlisted.sh':
    '#!/usr/bin/env bash\n# 用途：示例。\n# 用法：bash scripts/unlisted.sh。\n',
  'e2e/tool.sh': '#!/usr/bin/env bash\n# 用途：示例。\n# 用法：bash e2e/tool.sh。\n',
}
const read = (file) => sources[file] ?? null

test('完整头与索引通过', () => {
  assert.deepEqual(checkMetadata(['scripts/good.sh', 'e2e/tool.sh'], readme, read), [])
})

test('缺少用途或用法被拦截', () => {
  const errors = checkMetadata(['scripts/no-purpose.sh', 'scripts/no-usage.sh'], readme, read).join(
    '\n',
  )
  assert.match(errors, /no-purpose\.sh: 缺少 "# 用途："/)
  assert.match(errors, /no-usage\.sh: 缺少 "# 用法："/)
})

test('scripts 下未登记索引被拦截', () => {
  const errors = checkMetadata(['scripts/unlisted.sh'], readme, read).join('\n')
  assert.match(errors, /unlisted\.sh: 未登记到 scripts\/README\.md/)
})
