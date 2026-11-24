import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  BACKEND_CRON,
  concludeNightlySim,
  decideNightlySim,
  dispatchValidationDay,
  frontendValidationPlan,
  hasRelevantCodeChanges,
  scheduleValidationDay,
} from '../ci/nightly-sim-gate.mjs'

const script = resolve('scripts/ci/nightly-sim-gate.mjs')
const TARGET = 'df5a875673d5ddd970e8d7468d53450eb9f15a7b'
const OLD = 'a'.repeat(40)

function simRun(overrides) {
  return {
    databaseId: 1,
    attempt: 1,
    event: 'schedule',
    status: 'completed',
    conclusion: 'success',
    headSha: TARGET,
    jobs: [{ name: 'sim-and-strict', status: 'completed', conclusion: 'success' }],
    ...overrides,
  }
}

function decide(overrides) {
  return decideNightlySim({
    now: '2026-11-24T04:15:00Z',
    frontendChanged: false,
    backendChanged: true,
    targetSha: TARGET,
    runs: [],
    coversTarget: (sha) => sha === TARGET,
    ...overrides,
  })
}

test('后端延迟跨过北京时间午夜时，调度日仍是上一计划日', () => {
  assert.equal(scheduleValidationDay('2026-09-27T01:18:39+08:00', BACKEND_CRON), '2026-09-26')
  assert.equal(scheduleValidationDay('2026-09-26T13:31:00Z', BACKEND_CRON), '2026-09-26')
})

test('手动派发按北京时间日历日归属，不回拨到上一档', () => {
  assert.equal(dispatchValidationDay('2026-09-27T01:18:39+08:00'), '2026-09-27')
})

test('前端门禁按已到点的 19:00 UTC 档确定前一北京时间验证日', () => {
  const onTime = frontendValidationPlan('2026-11-23T19:00:00Z')
  assert.equal(onTime.validationDay, '2026-11-23')
  assert.equal(onTime.since, '2026-11-23 00:00:00 +0800')
  assert.equal(onTime.until, '2026-11-24 00:00:00 +0800')
  assert.equal(onTime.backendSlotStart, '2026-11-23T13:31:00.000Z')
  assert.equal(onTime.backendSlotEnd, '2026-11-24T13:31:00.000Z')

  const delayedPastShanghaiMidnight = frontendValidationPlan('2026-11-24T18:30:00Z')
  assert.equal(delayedPastShanghaiMidnight.validationDay, '2026-11-23')
})

test('2026-11-24 04:15Z 的门禁认 45302243041，不用 UTC 日期前缀或前一档成功结果', () => {
  const plan = frontendValidationPlan('2026-11-24T04:15:00Z')
  assert.equal(plan.validationDay, '2026-11-23')
  const matched = simRun({
    databaseId: 45302243041,
    createdAt: '2026-11-24T01:04:40Z',
    conclusion: 'failure',
    status: 'completed',
    jobs: [{ name: 'sim-and-strict', status: 'completed', conclusion: 'failure' }],
  })
  const previousSlot = simRun({
    databaseId: 45200000000,
    createdAt: '2026-11-22T20:25:00Z',
    headSha: OLD,
  })
  assert.equal(matched.createdAt.startsWith(plan.validationDay), false)
  assert.equal(scheduleValidationDay(previousSlot.createdAt, BACKEND_CRON), '2026-11-22')
  assert.equal(scheduleValidationDay('2026-11-23T16:00:00Z', BACKEND_CRON), '2026-11-23')
  assert.equal(scheduleValidationDay('2026-11-24T13:30:59Z', BACKEND_CRON), '2026-11-23')
  assert.equal(scheduleValidationDay('2026-11-24T13:31:00Z', BACKEND_CRON), '2026-11-24')

  const decision = decide({
    runs: [previousSlot, matched],
    coversTarget: () => true,
  })
  assert.equal(decision.action, 'fail')
  assert.equal(decision.code, 'SIM_FAILED')
  assert.equal(decision.runId, 45302243041)
  assert.equal(decision.shouldBuild, false)
})

test('当日档期缺失时继续等待，超时后失败，不采纳相邻成功 run', () => {
  const adjacent = simRun({
    databaseId: 45200000000,
    createdAt: '2026-11-22T20:25:00Z',
    headSha: OLD,
  })
  const waiting = decide({ runs: [adjacent], coversTarget: () => true })
  assert.equal(waiting.action, 'wait')
  assert.equal(waiting.code, 'MISSING_SIM')
  assert.equal(waiting.runId, null)
  const timedOut = concludeNightlySim(waiting)
  assert.equal(timedOut.action, 'fail')
  assert.equal(timedOut.code, 'MISSING_SIM')
  assert.equal(timedOut.shouldBuild, false)
})

test('同一档期里不覆盖目标提交的成功 sim 按过期证据失败', () => {
  const stale = simRun({
    databaseId: 77,
    createdAt: '2026-11-23T13:40:00Z',
    headSha: OLD,
  })
  const decision = decide({
    now: '2026-11-23T19:00:00Z',
    runs: [stale],
  })
  assert.equal(decision.action, 'fail')
  assert.equal(decision.code, 'SIM_STALE')
  assert.equal(decision.runId, 77)
})

test('同一验证日失败后的手动重跑成功且覆盖目标时放行', () => {
  const failed = simRun({
    databaseId: 10,
    createdAt: '2026-11-23T13:40:00Z',
    conclusion: 'failure',
    jobs: [{ name: 'sim-and-strict', status: 'completed', conclusion: 'failure' }],
  })
  const retry = simRun({
    databaseId: 11,
    createdAt: '2026-11-23T23:10:00+08:00',
    event: 'workflow_dispatch',
    headSha: TARGET,
  })
  const decision = decide({
    now: '2026-11-23T19:00:00Z',
    runs: [failed, retry],
  })
  assert.equal(decision.action, 'build')
  assert.equal(decision.code, 'SIM_COVERS')
  assert.equal(decision.runId, 11)
  assert.equal(decision.shouldBuild, true)
  assert.equal(decision.headSha, TARGET)
})

test('同一验证日较新的失败候选优先于较早成功', () => {
  const success = simRun({
    databaseId: 21,
    createdAt: '2026-11-23T13:40:00Z',
  })
  const failedLater = simRun({
    databaseId: 22,
    createdAt: '2026-11-23T22:00:00+08:00',
    event: 'workflow_dispatch',
    conclusion: 'failure',
    jobs: [{ name: 'sim-and-strict', status: 'completed', conclusion: 'failure' }],
  })
  const decision = decide({
    now: '2026-11-23T19:30:00Z',
    runs: [success, failedLater],
  })
  assert.equal(decision.action, 'fail')
  assert.equal(decision.code, 'SIM_FAILED')
  assert.equal(decision.runId, 22)
})

test('次日北京时间的手动派发不能充当前一日验证', () => {
  const nextDayDispatch = simRun({
    databaseId: 33,
    createdAt: '2026-11-24T09:04:00+08:00',
    event: 'workflow_dispatch',
  })
  const decision = decide({ runs: [nextDayDispatch] })
  assert.equal(decision.action, 'wait')
  assert.equal(decision.code, 'MISSING_SIM')
})

test('排队、进行中和等待中的最新候选继续等待，超时失败', () => {
  for (const [status, jobs] of [
    ['queued', []],
    ['in_progress', [{ name: 'sim-and-strict', status: 'in_progress', conclusion: '' }]],
    ['waiting', [{ name: 'Run simulation and strict validation', status: 'waiting', conclusion: null }]],
  ]) {
    const decision = decide({
      now: '2026-11-23T19:00:00Z',
      runs: [simRun({
        databaseId: 40,
        createdAt: '2026-11-23T13:31:05Z',
        status,
        conclusion: '',
        jobs,
      })],
    })
    assert.equal(decision.action, 'wait', status)
    assert.equal(decision.code, 'SIM_IN_PROGRESS', status)
    assert.equal(decision.runId, 40)
    assert.equal(concludeNightlySim(decision).code, 'SIM_TIMEOUT')
  }
})

test('跳过的 sim 与启动失败都不算成功验证', () => {
  const skipped = decide({
    now: '2026-11-23T19:00:00Z',
    runs: [simRun({
      databaseId: 51,
      createdAt: '2026-11-23T13:40:00Z',
      conclusion: 'success',
      jobs: [{ name: 'sim-and-strict', status: 'completed', conclusion: 'skipped' }],
    })],
  })
  assert.equal(skipped.code, 'SIM_NOT_EXECUTED')
  const startupFailed = decide({
    now: '2026-11-23T19:00:00Z',
    runs: [simRun({
      databaseId: 52,
      createdAt: '2026-11-23T13:45:00Z',
      conclusion: 'failure',
      jobs: [],
    })],
  })
  assert.equal(startupFailed.action, 'fail')
  assert.equal(startupFailed.code, 'SIM_NOT_EXECUTED')
  assert.equal(startupFailed.runId, 52)
})

test('重命名后的 sim job 成功且覆盖目标时放行', () => {
  const decision = decide({
    now: '2026-11-23T19:00:00Z',
    runs: [simRun({
      databaseId: 61,
      createdAt: '2026-11-23T13:40:00Z',
      jobs: [{ name: 'Run simulation and strict validation', status: 'completed', conclusion: 'success' }],
    })],
  })
  assert.equal(decision.action, 'build')
  assert.equal(decision.runId, 61)
})

test('同一 run 的更高 attempt 覆盖旧结论', () => {
  const decision = decide({
    now: '2026-11-23T19:00:00Z',
    runs: [
      simRun({
        databaseId: 71,
        attempt: 1,
        createdAt: '2026-11-23T13:40:00Z',
        conclusion: 'failure',
        jobs: [{ name: 'sim-and-strict', status: 'completed', conclusion: 'failure' }],
      }),
      simRun({
        databaseId: 71,
        attempt: 2,
        createdAt: '2026-11-23T13:40:00Z',
        jobs: [{ name: 'sim-and-strict', status: 'completed', conclusion: 'success' }],
      }),
    ],
  })
  assert.equal(decision.action, 'build')
  assert.equal(decision.runId, 71)
  assert.equal(decision.attempt, 2)
})

test('验证日无代码变更时跳过，仅前端变更时不等待后端 sim', () => {
  const skip = decide({ frontendChanged: false, backendChanged: false, runs: [] })
  assert.equal(skip.action, 'skip')
  assert.equal(skip.code, 'NO_CODE_CHANGE')
  assert.equal(skip.shouldBuild, false)
  const frontendOnly = decide({
    frontendChanged: true,
    backendChanged: false,
    runs: [simRun({
      databaseId: 81,
      createdAt: '2026-11-23T13:40:00Z',
      conclusion: 'failure',
      jobs: [{ name: 'sim-and-strict', status: 'completed', conclusion: 'failure' }],
    })],
  })
  assert.equal(frontendOnly.action, 'build')
  assert.equal(frontendOnly.code, 'FRONTEND_ONLY')
  assert.equal(frontendOnly.runId, null)
  assert.equal(frontendOnly.shouldBuild, true)
})

test('代码窗口只认北京时间验证日，跨日提交与纯文档不触发', () => {
  const plan = frontendValidationPlan('2026-11-24T04:15:00Z')
  const repo = (prefix) => {
    const dir = mkdtempSync(join(tmpdir(), prefix))
    const git = (args, env = {}) => execFileSync('git', ['-C', dir, ...args], {
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env, ...env },
    })
    const commit = (file, body, date) => {
      writeFileSync(join(dir, file), body)
      git(['add', file])
      git(
        ['-c', 'user.name=CI Test', '-c', 'user.email=ci-test@example.invalid', 'commit', '--date', date, '-m', file],
        { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
      )
    }
    return { dir, git, commit }
  }
  const first = repo('nightly-sim-window-')
  const second = repo('nightly-sim-window-next-')
  try {
    first.git(['init'])
    first.commit('before.java', 'before', '2026-11-22T15:59:59Z')
    assert.equal(hasRelevantCodeChanges(first.dir, plan.since, plan.until), false)
    first.commit('guide.md', 'docs', '2026-11-23T02:00:00Z')
    first.commit('LICENSE', 'license', '2026-11-23T03:00:00Z')
    assert.equal(hasRelevantCodeChanges(first.dir, plan.since, plan.until), false)
    first.commit('inside.java', 'inside', '2026-11-22T16:00:00Z')
    assert.equal(hasRelevantCodeChanges(first.dir, plan.since, plan.until), true)

    second.git(['init'])
    second.commit('after.java', 'after', '2026-11-23T16:00:01Z')
    assert.equal(hasRelevantCodeChanges(second.dir, plan.since, plan.until), false)
  } finally {
    rmSync(first.dir, { recursive: true, force: true })
    rmSync(second.dir, { recursive: true, force: true })
  }
})

test('plan CLI 返回同一套验证日、代码窗口和后端档期', () => {
  const stdout = execFileSync(process.execPath, [script, 'plan', '--now', '2026-11-24T04:15:00Z'], {
    encoding: 'utf8',
  })
  const plan = JSON.parse(stdout)
  assert.deepEqual(plan, frontendValidationPlan('2026-11-24T04:15:00Z'))
})

test('decide CLI 用覆盖脚本拒绝未覆盖目标的成功 sim', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nightly-sim-coverage-'))
  const git = (args, env = {}) => execFileSync('git', ['-C', dir, ...args], {
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  try {
    git(['init'])
    git(['config', 'user.name', 'CI Test'])
    git(['config', 'user.email', 'ci-test@example.invalid'])
    writeFileSync(join(dir, 'app.java'), 'base')
    git(['add', '.'])
    git(['commit', '-m', 'base'])
    const base = git(['rev-parse', 'HEAD']).trim()
    writeFileSync(join(dir, 'app.java'), 'changed')
    git(['add', '.'])
    git(['commit', '-m', 'code'])
    const target = git(['rev-parse', 'HEAD']).trim()
    const runDecide = (headSha) => JSON.parse(execFileSync(process.execPath, [
      script, 'decide',
      '--now', '2026-11-23T19:00:00Z',
      '--target-sha', target,
      '--frontend-changed', 'false',
      '--backend-changed', 'true',
      '--repo', dir,
    ], {
      encoding: 'utf8',
      input: JSON.stringify([simRun({
        databaseId: 90,
        createdAt: '2026-11-23T13:40:00Z',
        headSha,
      })]),
    }))
    assert.equal(runDecide(base).code, 'SIM_STALE')
    assert.equal(runDecide(target).code, 'SIM_COVERS')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('镜像 workflow 把档期判断交给脚本，不再用 createdAt 日期前缀', () => {
  const text = readFileSync(resolve('.github/workflows/build-image.yml'), 'utf8')
  assert.match(text, /scripts\/ci\/nightly-sim-gate\.mjs/)
  assert.match(text, /cron: '0 19 \* \* \*'/)
  assert.doesNotMatch(text, /createdAt \| startswith/)
  assert.doesNotMatch(text, /date -d 'yesterday'/)
})
