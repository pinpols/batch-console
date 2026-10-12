#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const baselineFiles = ['config/maintainability-baseline.json', 'config/ui-complexity-baseline.json']
const approvalsPath = 'config/baseline-expansion-approvals.json'
const baseRef = process.env.BASELINE_BASE_REF || `origin/${process.env.GITHUB_BASE_REF || 'main'}`
const today = new Date().toISOString().slice(0, 10)

function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'))
}

function readBase(path) {
  return JSON.parse(
    execFileSync('git', ['show', `${baseRef}:${path}`], { cwd: root, encoding: 'utf8' }),
  )
}

function flatten(path, value) {
  const items = new Map()
  for (const [file, limits] of Object.entries(value)) {
    if (typeof limits === 'number') {
      if (!Number.isInteger(limits) || limits < 0)
        throw new Error(`${path}: invalid limit for ${file}`)
      items.set(file, limits)
      continue
    }
    if (!limits || typeof limits !== 'object' || Array.isArray(limits)) {
      throw new Error(`${path}: invalid baseline entry for ${file}`)
    }
    for (const [metric, limit] of Object.entries(limits)) {
      if (!Number.isInteger(limit) || limit < 0)
        throw new Error(`${path}: invalid ${file}#${metric} limit`)
      items.set(`${file}#${metric}`, limit)
    }
  }
  return items
}

function validateApprovalManifest(manifest, currentValues) {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.approvals)) {
    throw new Error(`${approvalsPath}: expected schemaVersion=1 and approvals array`)
  }
  const approvals = new Map()
  const errors = []
  for (const record of manifest.approvals) {
    const key = `${record.baseline}::${record.item}`
    if (
      !baselineFiles.includes(record.baseline) ||
      typeof record.item !== 'string' ||
      approvals.has(key)
    ) {
      errors.push(`invalid or duplicate approval key: ${key}`)
      continue
    }
    for (const field of ['owner', 'reason', 'removalCondition', 'reviewBy']) {
      if (typeof record[field] !== 'string' || record[field].trim() === '') {
        errors.push(`${key}: ${field} is required`)
      }
    }
    if (Number.isNaN(Date.parse(`${record.reviewBy}T00:00:00Z`)) || record.reviewBy < today) {
      errors.push(`${key}: reviewBy is invalid or expired (${record.reviewBy})`)
    }
    const expected = currentValues.get(key)
    if (expected === undefined || record.value !== expected) {
      errors.push(`${key}: approval is stale or value does not match the current baseline`)
    }
    approvals.set(key, record)
  }
  return { approvals, errors }
}

function main() {
  const currentByFile = new Map()
  const additions = []
  for (const path of baselineFiles) {
    const current = flatten(path, readJson(path))
    const before = flatten(path, readBase(path))
    currentByFile.set(path, current)
    for (const [item, value] of current) {
      if (value > (before.get(item) ?? 0)) additions.push({ path, item, value })
    }
  }

  const currentValues = new Map()
  for (const [path, items] of currentByFile) {
    for (const [item, value] of items) currentValues.set(`${path}::${item}`, value)
  }
  const { approvals, errors } = validateApprovalManifest(readJson(approvalsPath), currentValues)
  for (const addition of additions) {
    const key = `${addition.path}::${addition.item}`
    const approval = approvals.get(key)
    if (!approval || approval.value !== addition.value) {
      errors.push(`unapproved baseline expansion: ${key} -> ${addition.value}`)
    }
  }

  if (errors.length) {
    errors.forEach((error) => console.error(`[baseline-expansion] ${error}`))
    console.error(`[baseline-expansion] compare base: ${baseRef}`)
    process.exitCode = 1
    return
  }
  console.log(`[baseline-expansion] passed; no unapproved growth against ${baseRef}`)
}

try {
  main()
} catch (error) {
  console.error(`[baseline-expansion] ${error.message}`)
  process.exitCode = 1
}
