import type { Browser, BrowserContext, TestInfo } from '@playwright/test'
import { expect } from './app'
import { e2eText, installE2eLocale } from './i18n'
import { seedBrowserStorage } from './storage'
import type { WorkerRoleFixture } from '../fixtures/runtime-progress/worker-role-fixture'

type Role = 'TENANT_ADMIN' | 'AUDITOR' | 'TENANT_USER'
type Snapshot = { kind: 'workflow' | 'job'; data: Record<string, unknown> }

/** 在同一真实运行上以独立 Cookie 验证三个非 ADMIN 角色的页面、API 和 SSE。 */
export async function verifyWorkerRoleProgress(
  browser: Browser,
  fixture: WorkerRoleFixture,
  baseURL: string,
  runId: number,
  instanceId: number,
  testInfo: TestInfo,
) {
  const contexts: BrowserContext[] = []
  const checks: Array<Record<string, unknown>> = []
  let failure: unknown
  try {
    for (const role of ['TENANT_ADMIN', 'AUDITOR', 'TENANT_USER'] as const) {
      const context = await browser.newContext({ baseURL, serviceWorkers: 'block' })
      contexts.push(context)
      const username =
        role === 'TENANT_ADMIN'
          ? fixture.readerName
          : role === 'AUDITOR'
            ? fixture.auditorName
            : fixture.userName
      const login = await context.request.post('/api/console/auth/login', {
        headers: { 'X-Tenant-Id': fixture.tenantId },
        data: { username, password: fixture.password },
      })
      expect(login.status(), `${role} 登录`).toBe(200)
      const profile = await context.request.get('/api/console/auth/me', {
        headers: { 'X-Tenant-Id': fixture.tenantId },
      })
      expect(profile.status()).toBe(200)
      const identity = (await profile.json()).data
      expect(identity.authorities).toContain(`ROLE_${role}`)
      const paths = (identity.menus as Array<{ children: Array<{ path: string }> }>).flatMap(
        (group) => group.children.map((child) => child.path),
      )
      expect(paths, `${role} 工作流运行菜单`).toContain('/monitor/workflow-runs')
      expect(paths, `${role} 作业运行菜单`).toContain('/monitor/job-instances')

      for (const [path, field, id] of [
        [`/api/console/workflow-runs/${runId}/execution-progress`, 'workflowRunId', runId],
        [
          `/api/console/job-instances/${instanceId}/execution-progress`,
          'jobInstanceId',
          instanceId,
        ],
      ] as const) {
        const response = await context.request.get(path, { params: { tenantId: fixture.tenantId } })
        expect(response.status(), `${role} ${path}`).toBe(200)
        const result = (await response.json()).data
        expect(result[field], `${role} ${path} 属于同一运行`).toBe(id)
        if (field === 'workflowRunId') {
          expect(result.runStatus, `${role} Workflow 终态`).toBe('SUCCESS')
          expect(result.nodes, `${role} DAG 节点关联真实作业`).toContainEqual(
            expect.objectContaining({ jobInstanceId: instanceId }),
          )
        } else {
          expect(result.instanceStatus, `${role} Job 终态`).toBe('SUCCESS')
          expect(result.workflowRunId, `${role} 作业关联真实 Workflow`).toBe(runId)
        }
      }

      const rolePage = await context.newPage()
      const snapshots: Snapshot[] = []
      await rolePage.exposeFunction(
        'captureRoleProgress',
        (kind: Snapshot['kind'], data: unknown) => {
          if (data && typeof data === 'object')
            snapshots.push({ kind, data: data as Record<string, unknown> })
        },
      )
      await rolePage.addInitScript(() => {
        const Native = window.EventSource
        window.EventSource = class extends Native {
          constructor(url: string | URL, options?: EventSourceInit) {
            super(url, options)
            for (const [eventName, kind] of [
              ['workflow-execution-progress', 'workflow'],
              ['job-execution-progress', 'job'],
            ] as const) {
              this.addEventListener(eventName, (event) => {
                const value = JSON.parse((event as MessageEvent).data)
                void (
                  window as unknown as {
                    captureRoleProgress: (type: string, data: unknown) => Promise<void>
                  }
                ).captureRoleProgress(kind, value.data ?? value)
              })
            }
          }
        }
      })
      await installE2eLocale(rolePage)
      await seedBrowserStorage(rolePage, {
        session: '1',
        tenantId: fixture.tenantId,
        onboardingDone: '1',
      })
      await rolePage.setViewportSize({ width: 1440, height: 1100 })
      await rolePage.goto(`/monitor/workflow-runs/${runId}`)
      const workflow = rolePage
        .locator('.section-card')
        .filter({ hasText: e2eText('workflowProgress.title') })
      await expect(workflow.locator('.mini-dag__graph .node'), `${role} 真实 DAG`).toHaveCount(3, {
        timeout: 30_000,
      })
      await expect(
        workflow.locator('.live-status-badge--live'),
        `${role} Workflow 推送`,
      ).toBeVisible()
      await expect
        .poll(
          () =>
            snapshots.some(
              (item) =>
                item.kind === 'workflow' &&
                item.data.workflowRunId === runId &&
                item.data.runStatus === 'SUCCESS',
            ),
          { timeout: 20_000 },
        )
        .toBe(true)
      await rolePage.goto(`/monitor/job-instances/${instanceId}`)
      const job = rolePage
        .locator('.section-card')
        .filter({ hasText: e2eText('jobProgress.title') })
      await expect(job.getByRole('progressbar'), `${role} Job 进度`).toHaveCount(2, {
        timeout: 30_000,
      })
      await expect(job.locator('.live-status-badge--live'), `${role} Job 推送`).toBeVisible()
      await expect
        .poll(
          () =>
            snapshots.some(
              (item) =>
                item.kind === 'job' &&
                item.data.jobInstanceId === instanceId &&
                item.data.instanceStatus === 'SUCCESS',
            ),
          { timeout: 20_000 },
        )
        .toBe(true)
      checks.push({
        role: role as Role,
        workflowRunId: runId,
        jobInstanceId: instanceId,
        graphNodes: 3,
        progressBars: 2,
        workflowPush: true,
        jobPush: true,
      })
    }
  } catch (error) {
    failure =
      error instanceof Error && /cookie:|authorization:|x-xsrf-token/i.test(error.message)
        ? new Error(`${error.name}: 真实请求失败；认证请求头已省略`)
        : error
  } finally {
    const errors: unknown[] = []
    for (const context of contexts) {
      try {
        const response = await fixture.mutate(context.request, '/api/console/auth/logout', {})
        expect(response.status(), '本例角色登出').toBeLessThan(400)
      } catch (error) {
        errors.push(
          new Error(`本例角色登出失败：${error instanceof Error ? error.name : 'unknown'}`),
        )
      }
      await context.close()
    }
    await testInfo.attach('worker-role-progress.json', {
      body: JSON.stringify({ checks }),
      contentType: 'application/json',
    })
    if (errors.length)
      failure = new AggregateError(
        failure ? [failure, ...errors] : errors,
        '角色进度验证或登出失败',
      )
  }
  if (failure) throw failure
}
