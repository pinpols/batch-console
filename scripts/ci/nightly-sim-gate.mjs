#!/usr/bin/env node
// 用途：按北京时间调度档关联 nightly 前端镜像与后端 daily sim-strict。
// 用法：node scripts/ci/nightly-sim-gate.mjs plan --now <ISO>
//       node scripts/ci/nightly-sim-gate.mjs changed --repo <目录> --since <时间> --until <时间>
//       node scripts/ci/nightly-sim-gate.mjs snapshot --repo <目录> --before <时间>
//       node scripts/ci/nightly-sim-gate.mjs enrich --repo <owner/name>
//       node scripts/ci/nightly-sim-gate.mjs decide --now <ISO> --target-sha <sha> --frontend-changed <bool> --backend-changed <bool> [--repo <目录>]
//       node scripts/ci/nightly-sim-gate.mjs conclude
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const FRONTEND_CRON = '0 19 * * *'
export const BACKEND_CRON = '31 13 * * *'
export const SIM_JOB_NAMES = new Set([
  'sim-and-strict',
  'Run simulation and strict validation',
])

const SHANGHAI = 'Asia/Shanghai'
const DAY_MS = 86400000
const IGNORED_PATH = /(^|\/)([^/]+\.(md|rst)|LICENSE|NOTICE)$/

function parseDailyCron(cron) {
  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5 || fields.slice(2).some((field) => field !== '*')) {
    throw new Error(`仅支持每日 cron: ${cron}`)
  }
  const minute = Number(fields[0])
  const hour = Number(fields[1])
  if (!Number.isInteger(minute) || minute < 0 || minute > 59
    || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`非法每日 cron: ${cron}`)
  }
  return { minute, hour }
}

function asDate(instant) {
  const date = instant instanceof Date ? instant : new Date(instant)
  if (Number.isNaN(date.getTime())) throw new Error(`无法解析时间: ${instant}`)
  return date
}

export function shanghaiDate(instant) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(asDate(instant))
}

function addCalendarDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

// 每日 cron 的归属日是不晚于该时刻的最近一次档期，再换算成北京时间日历日。
// run 的 createdAt 常因排队跨过 UTC 或北京时间午夜，不能用日期前缀直接比较。
export function latestDailySlot(instant, cron) {
  const { minute, hour } = parseDailyCron(cron)
  const date = asDate(instant)
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  let best = null
  for (let delta = -2; delta <= 1; delta += 1) {
    const day = new Date(utcMidnight + delta * DAY_MS)
    const slot = new Date(Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      hour,
      minute,
      0,
    ))
    if (slot.getTime() <= date.getTime() && (best === null || slot.getTime() > best.getTime())) {
      best = slot
    }
  }
  if (best === null) throw new Error(`找不到不晚于 ${date.toISOString()} 的 ${cron} 档期`)
  return best
}

export function scheduleValidationDay(instant, cron) {
  return shanghaiDate(latestDailySlot(instant, cron))
}

export function dispatchValidationDay(instant) {
  return shanghaiDate(instant)
}

function slotInstantForShanghaiDate(isoDate, cron) {
  const { minute, hour } = parseDailyCron(cron)
  const [year, month, day] = isoDate.split('-').map(Number)
  for (const delta of [0, -1, 1]) {
    const slot = new Date(Date.UTC(year, month - 1, day + delta, hour, minute, 0))
    if (shanghaiDate(slot) === isoDate) return slot
  }
  throw new Error(`找不到北京时间 ${isoDate} 的 ${cron} 档期`)
}

export function frontendValidationPlan(now) {
  const frontendSlot = latestDailySlot(now, FRONTEND_CRON)
  const validationDay = addCalendarDays(shanghaiDate(frontendSlot), -1)
  const backendSlotStart = slotInstantForShanghaiDate(validationDay, BACKEND_CRON)
  const backendSlotEnd = new Date(backendSlotStart.getTime() + DAY_MS)
  return {
    validationDay,
    since: `${validationDay} 00:00:00 +0800`,
    until: `${addCalendarDays(validationDay, 1)} 00:00:00 +0800`,
    backendSlotStart: backendSlotStart.toISOString(),
    backendSlotEnd: backendSlotEnd.toISOString(),
    listSince: new Date(backendSlotStart.getTime() - DAY_MS).toISOString(),
  }
}

function lastSecondBefore(instant) {
  return new Date(asDate(instant).getTime() - 1000).toISOString()
}

function snapshotBefore(repo, instant) {
  const sha = execFileSync('git', [
    '-C', repo, 'rev-list', '--first-parent', '--max-count=1',
    `--before=${lastSecondBefore(instant)}`, 'HEAD',
  ], { encoding: 'utf8' }).trim()
  if (!sha) throw new Error(`缺少 ${instant} 之前的后端主干提交`)
  return sha
}

export function hasRelevantCodeChanges(repo, since, until) {
  const output = execFileSync('git', [
    '-C', repo,
    'log',
    `--since=${since}`,
    `--until=${lastSecondBefore(until)}`,
    '--format=',
    '--name-only',
    '--no-renames',
    'HEAD',
  ], { encoding: 'utf8' })
  return output.split('\n').some((path) => path && !IGNORED_PATH.test(path))
}

function runValidationDay(run) {
  if (!run?.createdAt) return null
  if (run.event === 'schedule') return scheduleValidationDay(run.createdAt, BACKEND_CRON)
  if (run.event === 'workflow_dispatch') return dispatchValidationDay(run.createdAt)
  return null
}

function latestAttempt(runs) {
  const byId = new Map()
  for (const run of runs) {
    const key = run.databaseId ?? `${run.event}:${run.createdAt}`
    const current = byId.get(key)
    if (!current || Number(run.attempt ?? 1) > Number(current.attempt ?? 1)) byId.set(key, run)
  }
  return [...byId.values()]
}

function newestRun(runs) {
  return [...runs].sort((left, right) => {
    const byTime = asDate(right.createdAt).getTime() - asDate(left.createdAt).getTime()
    if (byTime !== 0) return byTime
    return Number(right.attempt ?? 1) - Number(left.attempt ?? 1)
  })[0]
}

function simJob(run) {
  return (run.jobs ?? []).find((job) => SIM_JOB_NAMES.has(job.name))
}

function unresolved(run, job) {
  if (job?.status && job.status !== 'completed') return true
  return !job && run.status !== 'completed'
}

function decisionMessage(decision) {
  const day = decision.validationDay
  const runId = decision.runId ?? 'none'
  switch (decision.code) {
    case 'NO_CODE_CHANGE':
      return `北京时间 ${day} 没有前后端代码或配置变更。`
    case 'FRONTEND_ONLY':
      return `北京时间 ${day} 只有前端代码或配置变更，不依赖后端 sim。`
    case 'MISSING_SIM':
      return `未找到后端 ${day} 对应调度档的 daily sim-strict run。`
    case 'SIM_IN_PROGRESS':
      return `后端 ${day} daily sim-strict 仍在排队或执行: run=${runId}`
    case 'SIM_TIMEOUT':
      return `后端 ${day} daily sim-strict 等待超时: run=${runId}`
    case 'SIM_FAILED':
      return `后端 daily sim-strict 未成功: run=${runId}`
    case 'SIM_STALE':
      return `后端 daily sim-strict 未覆盖目标提交: run=${runId}`
    case 'SIM_NOT_EXECUTED':
      return `后端 daily sim-strict 未执行验证: run=${runId}`
    case 'SIM_COVERS':
      return `后端 daily sim-strict 已覆盖目标提交: run=${runId}`
    default:
      return `后端 daily sim-strict 门禁失败: ${decision.code}`
  }
}

function result(plan, fields) {
  const decision = {
    validationDay: plan.validationDay,
    action: fields.action,
    code: fields.code,
    shouldBuild: fields.action === 'build',
    runId: fields.runId ?? null,
    headSha: fields.headSha ?? null,
    attempt: fields.attempt ?? null,
  }
  decision.message = decisionMessage(decision)
  return decision
}

export function decideNightlySim(input) {
  const plan = frontendValidationPlan(input.now)
  if (!input.backendChanged) {
    if (!input.frontendChanged) return result(plan, { action: 'skip', code: 'NO_CODE_CHANGE' })
    return result(plan, { action: 'build', code: 'FRONTEND_ONLY' })
  }

  const candidates = latestAttempt((input.runs ?? []).filter(
    (run) => runValidationDay(run) === plan.validationDay,
  ))
  if (candidates.length === 0) return result(plan, { action: 'wait', code: 'MISSING_SIM' })

  const selected = newestRun(candidates)
  const identity = {
    runId: selected.databaseId ?? null,
    headSha: selected.headSha ?? null,
    attempt: Number(selected.attempt ?? 1),
  }
  const job = simJob(selected)
  if (unresolved(selected, job)) {
    return result(plan, { action: 'wait', code: 'SIM_IN_PROGRESS', ...identity })
  }
  const conclusion = job?.conclusion || ''
  if (!job || conclusion === 'skipped') {
    return result(plan, { action: 'fail', code: 'SIM_NOT_EXECUTED', ...identity })
  }
  if (conclusion !== 'success') {
    return result(plan, { action: 'fail', code: 'SIM_FAILED', ...identity })
  }
  if (input.coversTarget?.(selected.headSha) !== true) {
    return result(plan, { action: 'fail', code: 'SIM_STALE', ...identity })
  }
  return result(plan, { action: 'build', code: 'SIM_COVERS', ...identity })
}

export function concludeNightlySim(decision) {
  if (decision.action !== 'wait') return decision
  const code = decision.code === 'SIM_IN_PROGRESS' ? 'SIM_TIMEOUT' : decision.code
  const concluded = {
    ...decision,
    action: 'fail',
    code,
    shouldBuild: false,
  }
  concluded.message = decisionMessage(concluded)
  return concluded
}

function option(name) {
  const index = process.argv.indexOf(name)
  if (index === -1 || process.argv[index + 1] === undefined) {
    throw new Error(`缺少参数 ${name}`)
  }
  return process.argv[index + 1]
}

function readStdin() {
  return readFileSync(0, 'utf8')
}

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }))
}

function enrichRuns(runs, repository) {
  return runs.map((run) => {
    const viewed = ghJson([
      'run', 'view', String(run.databaseId),
      '--repo', repository,
      '--json', 'jobs,status,conclusion,headSha,attempt',
    ])
    return {
      ...run,
      status: viewed.status ?? run.status,
      conclusion: viewed.conclusion ?? run.conclusion,
      headSha: viewed.headSha ?? run.headSha,
      attempt: viewed.attempt ?? run.attempt,
      jobs: (viewed.jobs ?? []).map((job) => ({
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
      })),
    }
  })
}

function coversWithRepo(repo, validated, target) {
  const isAncestor = (older, newer) => spawnSync('git', [
    '-C', repo, 'merge-base', '--is-ancestor', older, newer,
  ], { stdio: 'ignore' }).status === 0

  if (!validated || !isAncestor(validated, 'HEAD')) return false
  // 调度延迟后，实际验证的主干提交可能比验证日快照更新。镜像使用实际验证的提交。
  if (isAncestor(target, validated)) return true

  const resultStatus = spawnSync('bash', [
    resolve('scripts/ci/check-backend-validation-coverage.sh'),
    repo,
    validated,
    target,
  ], { encoding: 'utf8' })
  return resultStatus.status === 0
}

function main() {
  const command = process.argv[2]
  if (command === 'plan') {
    process.stdout.write(`${JSON.stringify(frontendValidationPlan(option('--now')))}\n`)
    return 0
  }
  if (command === 'changed') {
    const changed = hasRelevantCodeChanges(option('--repo'), option('--since'), option('--until'))
    return changed ? 0 : 1
  }
  if (command === 'snapshot') {
    process.stdout.write(`${snapshotBefore(option('--repo'), option('--before'))}\n`)
    return 0
  }
  if (command === 'enrich') {
    const runs = JSON.parse(readStdin() || '[]')
    process.stdout.write(`${JSON.stringify(enrichRuns(runs, option('--repo')))}\n`)
    return 0
  }
  if (command === 'decide') {
    const runs = JSON.parse(readStdin() || '[]')
    const targetSha = option('--target-sha')
    const repo = process.argv.includes('--repo') ? option('--repo') : ''
    const decision = decideNightlySim({
      now: option('--now'),
      frontendChanged: option('--frontend-changed') === 'true',
      backendChanged: option('--backend-changed') === 'true',
      targetSha,
      runs,
      coversTarget: (sha) => (repo ? coversWithRepo(repo, sha, targetSha) : sha === targetSha),
    })
    process.stdout.write(`${JSON.stringify(decision)}\n`)
    return 0
  }
  if (command === 'conclude') {
    const decision = concludeNightlySim(JSON.parse(readStdin() || '{}'))
    process.stdout.write(`${JSON.stringify(decision)}\n`)
    return 0
  }
  throw new Error(`未知命令: ${command ?? ''}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main())
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
}
