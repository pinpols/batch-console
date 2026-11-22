// 用途：验证 Shell 跨平台检查规则与 Bash 3.2 豁免。
// 用法：在仓库根目录执行 node --test scripts/tests/test-shell-portability.test.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'

import { scanContent } from '../check-shell-portability.mjs'

const find = (content) => scanContent('probe.sh', content).join('\n')

test('BSD 专属命令被拦截', () => {
  assert.match(find("sed -i '' 's/a/b/' file\n"), /bsd-sed-in-place/)
  assert.match(find('date -v+1d\n'), /bsd-date-v/)
  assert.match(find('open -a Docker\n'), /macos-open/)
  assert.match(find('pbcopy\n'), /pbcopy-pbpaste/)
  assert.match(find('osascript -e 1\n'), /osascript/)
})

test('stat -f 必须提供 Linux 回退', () => {
  assert.match(find('stat -f %z data\n'), /bsd-stat-f-without-linux-fallback/)
  assert.equal(find('stat -f %z data || stat -c %s data\n'), '')
})

test('校验工具必须有 Linux 回退', () => {
  assert.match(find('shasum -a 256 data\n'), /shasum-sha256-without-fallback/)
  assert.equal(
    find(
      'if command -v sha256sum >/dev/null 2>&1; then sha256sum data; else shasum -a 256 data; fi\n',
    ),
    '',
  )
  assert.equal(find('mlock="md5/scram"\n'), '')
})

test('GNU 专属参数与 Bash 4 语法被拦截', () => {
  assert.match(find('printf \'%s\\n\' "$@" | xargs -r rm -f\n'), /gnu-xargs-r/)
  assert.match(find('echo "${value,,}"\n'), /lowercase-expansion/)
  assert.match(find('echo "${value^^}"\n'), /uppercase-expansion/)
  assert.match(find("mapfile -t rows < <(printf 'a\\n')\n"), /mapfile/)
  assert.match(find("readarray -t rows < <(printf 'a\\n')\n"), /readarray/)
  assert.match(find('declare -A lookup=()\n'), /associative-array/)
  assert.match(find('local -A lookup=()\n'), /associative-array/)
})

test('注释和索引数组不误报', () => {
  assert.equal(find('# mapfile 只在说明里出现\nlocal -a rows=()\n'), '')
})

test('显式 Bash 4 声明允许豁免', () => {
  assert.equal(find('#!/usr/bin/env bash\n# shell-min-version: 4\ndeclare -A lookup=()\n'), '')
})
