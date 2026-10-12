import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const sourceRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const baselineFiles = ['config/maintainability-baseline.json', 'config/ui-complexity-baseline.json']

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'fe-baseline-'))
  mkdirSync(join(root, 'scripts'), { recursive: true })
  mkdirSync(join(root, 'config'), { recursive: true })
  cpSync(
    join(sourceRoot, 'scripts/check-governance-baseline-expansion.mjs'),
    join(root, 'scripts/check-governance-baseline-expansion.mjs'),
  )
  for (const file of baselineFiles) writeFileSync(join(root, file), '{}\n')
  writeFileSync(
    join(root, 'config/baseline-expansion-approvals.json'),
    '{"schemaVersion":1,"approvals":[]}\n',
  )
  execFileSync('git', ['init', '-q'], { cwd: root })
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root })
  execFileSync('git', ['config', 'user.name', 'Baseline Test'], { cwd: root })
  execFileSync('git', ['add', '.'], { cwd: root })
  execFileSync('git', ['commit', '-qm', 'baseline'], { cwd: root })
  return root
}

function run(root) {
  return spawnSync(process.execPath, ['scripts/check-governance-baseline-expansion.mjs'], {
    cwd: root,
    env: { ...process.env, BASELINE_BASE_REF: 'HEAD' },
    encoding: 'utf8',
  })
}

function addApproval(root, baseline, item, value) {
  const approvals = [
    {
      baseline,
      item,
      value,
      owner: '@pinpols',
      reason: 'Keep the existing migration window unblocked.',
      reviewBy: '2030-12-31',
      removalCondition: 'Remove after the legacy file is split.',
    },
  ]
  writeFileSync(
    join(root, 'config/baseline-expansion-approvals.json'),
    JSON.stringify({ schemaVersion: 1, approvals }, null, 2),
  )
}

test('baseline checker passes unchanged baselines', () => {
  const root = setup()
  try {
    const result = run(root)
    assert.equal(result.status, 0, result.stderr)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('baseline checker rejects unapproved page budget growth', () => {
  const root = setup()
  try {
    writeFileSync(
      join(root, baselineFiles[0]),
      JSON.stringify({ 'src/views/Large.vue': 1400 }) + '\n',
    )
    const result = run(root)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /unapproved baseline expansion/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('baseline checker accepts growth only with complete matching approval', () => {
  const root = setup()
  try {
    writeFileSync(
      join(root, baselineFiles[1]),
      JSON.stringify({ 'src/views/Large.vue': { lines: 1300 } }) + '\n',
    )
    addApproval(root, baselineFiles[1], 'src/views/Large.vue#lines', 1300)
    const result = run(root)
    assert.equal(result.status, 0, result.stderr)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('baseline checker rejects expired or stale approvals', () => {
  const root = setup()
  try {
    addApproval(root, baselineFiles[0], 'src/views/Removed.vue', 1400)
    const result = run(root)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /stale or value does not match/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
