import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const scriptPath = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  'report-playwright-release.mjs',
)

function runReport(specs) {
  const dir = mkdtempSync(join(tmpdir(), 'playwright-release-'))
  const path = join(dir, 'results.json')
  writeFileSync(path, JSON.stringify({ suites: [{ file: 'e2e/example.spec.ts', specs }] }))
  const result = spawnSync(process.execPath, [scriptPath, path], { encoding: 'utf8' })
  rmSync(dir, { recursive: true, force: true })
  return result
}

test('release report fails when a required scenario is skipped', () => {
  const result = runReport([
    {
      title: '@release-required import seed',
      tests: [{ results: [{ status: 'skipped', errors: [] }] }],
    },
  ])
  assert.notEqual(result.status, 0)
  assert.match(result.stdout, /SKIP \(required\)/)
})

test('release report preserves optional skips as visible evidence', () => {
  const result = runReport([
    {
      title: '@release-required required seed',
      tests: [{ results: [{ status: 'passed', errors: [] }] }],
    },
    {
      title: 'optional visual environment',
      tests: [{ results: [{ status: 'skipped', errors: [] }] }],
    },
  ])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /SKIP.*optional visual environment/)
})

test('release report fails when no required scenario was discovered', () => {
  const result = runReport([
    {
      title: 'optional visual environment',
      tests: [{ results: [{ status: 'passed', errors: [] }] }],
    },
  ])
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /no @release-required scenarios/)
})
