import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

test('类型检查入口覆盖应用 TS、Vue 和 Vite 配置', { timeout: 240_000 }, async (context) => {
  const fixture = mkdtempSync(join(tmpdir(), 'batch-console-typecheck-scope-'))

  function writeSources(invalidScope) {
    const literal = (scope) => (scope === invalidScope ? '123' : '"valid"')
    writeFileSync(join(fixture, 'src/alias.ts'), 'export const aliasValue = "valid"\n')
    writeFileSync(
      join(fixture, 'src/probe.ts'),
      `
import { aliasValue } from '@/alias'
export const applicationProbe: string = ${literal('ts')}
export { aliasValue }
`,
    )
    writeFileSync(
      join(fixture, 'src/Probe.vue'),
      `
<script setup lang="ts">
const componentProbe: string = ${literal('vue')}
</script>
<template><div>{{ componentProbe }}</div></template>
`,
    )
    writeFileSync(
      join(fixture, 'vite.config.ts'),
      `
import { defineConfig } from 'vite'
const configurationProbe: string = ${literal('node')}
export default defineConfig({ define: { __PROBE__: JSON.stringify(configurationProbe) } })
`,
    )
  }

  function runTypecheck() {
    const result = spawnSync('npm', ['run', 'typecheck'], {
      cwd: fixture,
      encoding: 'utf8',
      timeout: 60_000,
    })
    assert.ifError(result.error)
    assert.equal(result.signal, null)
    return { status: result.status, output: `${result.stdout}${result.stderr}` }
  }

  try {
    mkdirSync(join(fixture, 'src'))
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir')
    for (const config of ['tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json']) {
      copyFileSync(join(root, config), join(fixture, config))
    }
    writeFileSync(
      join(fixture, 'package.json'),
      JSON.stringify({
        private: true,
        type: 'module',
        scripts: { typecheck: packageJson.scripts.typecheck },
      }),
    )

    await context.test('合法源码和路径别名通过', () => {
      writeSources(undefined)
      const result = runTypecheck()
      assert.equal(result.status, 0, result.output)
    })

    for (const [scope, source] of [
      ['ts', 'src/probe.ts'],
      ['vue', 'src/Probe.vue'],
      ['node', 'vite.config.ts'],
    ]) {
      await context.test(`${source} 中的类型错误必须阻断`, () => {
        writeSources(scope)
        const result = runTypecheck()
        assert.notEqual(result.status, 0, result.output)
        assert.ok(result.output.includes(`${source}(`), result.output)
        assert.match(result.output, /error TS2322:/)
      })
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
