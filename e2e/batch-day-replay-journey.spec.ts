import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { STORAGE_KEYS } from './support/storage'

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: 'block' })

function response(data: unknown) {
  return { code: 'SUCCESS', message: 'ok', data }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((keys) => {
    localStorage.setItem(keys.session, '1')
    localStorage.setItem(keys.tenantId, 'ta')
    localStorage.setItem(keys.locale, 'zh-CN')
    localStorage.setItem(keys.onboardingDone, '1')
  }, STORAGE_KEYS)
  await page.route('**/api/console/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const businessKey = new URL(route.request().url()).searchParams.get('businessKey')
    const data =
      path === '/api/console/auth/me'
        ? { username: 'journey-admin', tenantId: 'ta', authorities: ['ROLE_ADMIN'] }
        : path === '/api/console/tenants'
          ? { items: [{ tenantId: 'ta', tenantName: 'Tenant A', status: 'ACTIVE' }], total: 1 }
          : path === '/api/console/ops/summary'
            ? {
                tenantId: 'ta',
                pendingApprovals: 0,
                openAlerts: 0,
                criticalAlerts: 0,
                runningJobs: 0,
                failedJobs: 0,
                slaBreaches: 0,
                onlineWorkers: 0,
                drainingWorkers: 0,
                offlineWorkers: 0,
                outboxRetryBacklog: 0,
                outboxDeliveryFailures: 0,
              }
            : path === '/api/console/queries/job-definitions/codes'
              ? ['JOB_REPLAY_A', 'JOB_REPLAY_B']
              : path === '/api/console/result-versions'
                ? [
                    { id: 503, tenantId: 'ta', businessKey, versionNo: 3, status: 'EFFECTIVE' },
                    { id: 502, tenantId: 'ta', businessKey, versionNo: 2, status: 'PENDING' },
                  ]
                : path === '/api/console/ops/batch-day-replay/sessions'
                  ? []
                  : { items: [], total: 0, pageNo: 1, pageSize: 20 }
    await route.fulfill({ status: 200, json: response(data) })
  })
})

async function openReplayPage(page: import('@playwright/test').Page) {
  await page.goto('/ops/batch-day-replay')
  await expect(page.getByRole('heading', { name: '批次日重放' }).first()).toBeVisible()
}

async function openJobInstances(page: import('@playwright/test').Page) {
  await page.goto('/monitor/job-instances')
  await expect(page.locator('.page-header .title').first()).toHaveText('作业运行')
  await expect(page.locator('.el-table__body-wrapper')).toBeVisible()
}

test('重放提交前必须预览当前请求影响', async ({ page }) => {
  await openReplayPage(page)
  await page.getByRole('button', { name: '新建重放' }).first().click()

  const drawer = page.locator('.el-drawer', { hasText: '新建批次日重放' })
  await drawer.getByRole('textbox', { name: '原因' }).fill('验证提交前预览约束')

  await expect(drawer.getByRole('button', { name: '提交', exact: true })).toBeDisabled()
})

test('提交响应丢失后用原预览查询结果且不重复创建会话', async ({ page }) => {
  const previewRequest: Record<string, unknown>[] = []
  const submitRequests: Array<{ body: Record<string, unknown>; key: string | undefined }> = []
  let submitAttempt = 0
  await page.route('**/api/console/ops/batch-day-replay/sessions/preview', async (route) => {
    previewRequest.push(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({
      status: 200,
      json: response({
        tenantId: 'ta',
        calendarCode: 'default',
        bizDate: '2026-10-11',
        scope: 'ALL',
        executionMode: 'REPLAY',
        candidateSource: 'EXISTING_INSTANCES',
        resultPolicy: 'CREATE_NEW_VERSION',
        configVersionPolicy: 'USE_ORIGINAL_CONFIG',
        previewToken: 'unknown-outcome-preview-token',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        totalCount: 1,
        entries: [],
        resultVersionImpacts: [],
        assetPartitionImpacts: [],
        dispatchImpacts: [],
        warnings: [],
      }),
    })
  })
  await page.route('**/api/console/ops/batch-day-replay/sessions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ status: 200, json: response([]) })
      return
    }
    submitRequests.push({
      body: route.request().postDataJSON() as Record<string, unknown>,
      key: (await route.request().allHeaders())['idempotency-key'],
    })
    submitAttempt += 1
    if (submitAttempt === 1) {
      await route.abort('failed')
      return
    }
    await route.fulfill({
      status: 200,
      json: response({
        id: 321,
        tenantId: 'ta',
        calendarCode: 'default',
        bizDate: '2026-10-11',
        scope: 'ALL',
        executionMode: 'REPLAY',
        candidateSource: 'EXISTING_INSTANCES',
        status: 'PENDING_APPROVAL',
        totalCount: 1,
        succeededCount: 0,
        failedCount: 0,
        inFlightCount: 1,
        requestedBy: 'journey-admin',
        reason: '验证未知结果恢复',
      }),
    })
  })
  await page.route('**/api/console/ops/batch-day-replay/sessions/321/entries**', async (route) => {
    await route.fulfill({ status: 200, json: response([]) })
  })

  await openReplayPage(page)
  await page.getByRole('button', { name: '新建重放' }).first().click()
  const drawer = page.locator('.el-drawer', { hasText: '新建批次日重放' })
  await drawer.getByRole('textbox', { name: '原因' }).fill('验证未知结果恢复')
  await drawer.getByRole('button', { name: '预览影响' }).click()
  await drawer.getByRole('button', { name: '提交', exact: true }).click()

  await expect(drawer.getByText('提交结果暂时未知')).toBeVisible()
  await expect(drawer.getByRole('button', { name: '查询提交结果' })).toBeEnabled()
  await expect(drawer.getByRole('textbox', { name: '原因' })).toBeDisabled()
  await drawer.getByRole('button', { name: '查询提交结果' }).click()

  await expect(page.getByRole('heading', { name: '重放会话 #321' })).toBeVisible()
  expect(previewRequest).toHaveLength(1)
  expect(submitRequests).toHaveLength(2)
  expect(submitRequests[0].body).toEqual(submitRequests[1].body)
  expect(submitRequests[0].body).toMatchObject({
    ...previewRequest[0],
    previewToken: 'unknown-outcome-preview-token',
  })
  expect(submitRequests[0].key).toBeTruthy()
  expect(submitRequests[1].key).toBeTruthy()
  expect(submitRequests[1].key).not.toBe(submitRequests[0].key)
})

test('预览清单可分页且修改参数后失效', async ({ page }) => {
  const previewEntries = Array.from({ length: 21 }, (_, index) => ({
    jobCode: `JOB_REPLAY_${String(index + 1).padStart(2, '0')}`,
    sourceInstanceId: index + 1,
    resultVersionId: null,
    action: 'RERUN_INSTANCE',
    businessKey: `ta:${index + 1}`,
  }))
  await page.route('**/api/console/ops/batch-day-replay/sessions/preview', async (route) => {
    await route.fulfill({
      status: 200,
      json: response({
        tenantId: 'ta',
        calendarCode: 'default',
        bizDate: '2026-10-11',
        scope: 'ALL',
        executionMode: 'REPLAY',
        candidateSource: 'EXISTING_INSTANCES',
        resultPolicy: 'CREATE_NEW_VERSION',
        configVersionPolicy: 'USE_ORIGINAL_CONFIG',
        previewToken: 'e2e-preview-token',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        totalCount: previewEntries.length,
        entries: previewEntries,
        resultVersionImpacts: [],
        assetPartitionImpacts: [],
        dispatchImpacts: [],
        warnings: [],
      }),
    })
  })

  await openReplayPage(page)
  await page.getByRole('button', { name: '新建重放' }).first().click()
  const drawer = page.locator('.el-drawer', { hasText: '新建批次日重放' })
  await drawer.getByRole('textbox', { name: '原因' }).fill('验证完整预览清单分页')
  await drawer.getByRole('button', { name: '预览影响' }).click()

  const table = drawer.locator('.replay-preview-table')
  await expect(drawer.locator('.preview-panel__head .el-tag')).toHaveText('全部候选')
  await expect(table.getByText('JOB_REPLAY_01')).toBeVisible()
  await expect(table.getByText('重新运行原作业实例').first()).toBeVisible()
  await expect(table.getByText('JOB_REPLAY_21')).toHaveCount(0)
  await drawer.locator('.el-pagination .el-pager li', { hasText: '2' }).click()
  await expect(table.getByText('JOB_REPLAY_21')).toBeVisible()

  await drawer.getByRole('textbox', { name: '原因' }).fill('修改参数后必须重新预览')
  await expect(drawer.getByRole('button', { name: '提交', exact: true })).toBeDisabled()
})

test('仅输出结果按作业和批次日选择版本并提交准确版本 ID', async ({ page }) => {
  let previewRequest: Record<string, unknown> | undefined
  let resultVersionBusinessKey = ''
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname === '/api/console/result-versions') {
      resultVersionBusinessKey = url.searchParams.get('businessKey') ?? ''
    }
  })
  await page.route('**/api/console/ops/batch-day-replay/sessions/preview', async (route) => {
    previewRequest = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      status: 200,
      json: response({
        tenantId: 'ta',
        calendarCode: 'default',
        bizDate: '2026-10-11',
        scope: 'OUTPUTS_ONLY',
        executionMode: 'REPLAY',
        candidateSource: 'EXISTING_INSTANCES',
        resultPolicy: 'CREATE_NEW_VERSION',
        configVersionPolicy: 'USE_ORIGINAL_CONFIG',
        previewToken: 'outputs-preview-token',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        totalCount: 1,
        entries: [],
        resultVersionImpacts: [],
        assetPartitionImpacts: [],
        dispatchImpacts: [],
        warnings: [],
      }),
    })
  })

  await openReplayPage(page)
  await page.getByRole('button', { name: '新建重放' }).first().click()
  const drawer = page.locator('.el-drawer', { hasText: '新建批次日重放' })
  await drawer.getByRole('textbox', { name: '原因' }).fill('核验结果版本选择')
  const bizDate = await drawer.locator('.el-date-editor input').inputValue()
  await drawer.getByText('仅输出结果', { exact: true }).click()
  await drawer
    .locator('.el-form-item')
    .filter({ hasText: '结果所属作业' })
    .locator('.el-select')
    .click()
  await page.getByRole('option', { name: 'JOB_REPLAY_A' }).click()
  await expect.poll(() => resultVersionBusinessKey).toBe(`job:JOB_REPLAY_A:${bizDate}`)
  await drawer
    .locator('.el-form-item')
    .filter({ hasText: '选择要恢复为当前有效结果的版本' })
    .locator('.el-select')
    .click()
  await expect(page.getByRole('option', { name: /#503/ })).toHaveCount(0)
  await page.getByRole('option', { name: /JOB_REPLAY_A · v2 · PENDING · #502/ }).click()
  await drawer.getByRole('button', { name: '预览影响' }).click()

  await expect.poll(() => previewRequest?.versionIds).toEqual([502])
  expect(previewRequest?.scope).toBe('OUTPUTS_ONLY')
})

test('作业定义页以新建作业为主入口并保留熟练用户快速表单', async ({ page }) => {
  await openReplayPage(page)
  await page.goto('/jobs/definitions')
  await expect(page.locator('.page-header .title').first()).toHaveText('作业定义')

  await page.getByRole('button', { name: '新建作业' }).click()
  await expect(page).toHaveURL(/\/jobs\/definitions\/new$/)
  await expect(page.locator('.page-header .title').first()).toBeVisible()

  await page.goto('/jobs/definitions')
  await page.getByRole('button', { name: '快速表单' }).click()
  await expect(page.getByRole('dialog', { name: '新建 · 作业定义' })).toBeVisible()
})

test('作业向导收敛为六步并在一个可选步骤中呈现关联配置', async ({ page }) => {
  await page.goto('/jobs/definitions/new')
  await expect(page.locator('.wizard-step-banner__title')).toHaveText('基本信息')
  await expect(page.locator('.el-step')).toHaveCount(6)
  await expect(page.locator('.el-step__title')).toContainText([
    '基本信息',
    '调度',
    '执行策略',
    '触发',
    '关联配置',
    '复核',
  ])

  await page.locator('.cnb-biz input').fill('JOURNEY_WIZARD')
  await page.getByLabel('作业名称').fill('用户旅程向导')
  for (let index = 0; index < 4; index += 1) {
    await page.getByRole('button', { name: '下一步' }).click()
  }

  await expect(page.locator('.wizard-step-banner__title')).toHaveText('关联配置')
  await expect(page.getByText('选择 channel', { exact: true })).toBeVisible()
  await expect(page.getByText('选择工作流', { exact: true })).toBeVisible()
  await expect(page.getByText('选择路由', { exact: true })).toBeVisible()
  await expect(page.getByText('以下关联均可选；只需填写当前作业实际使用的配置。')).toBeVisible()
  await expect(page.getByText('高级配置：通过 JSON 新建关联对象')).toHaveCount(3)
})

test('作业向导提交时保留文件、工作流和告警高级 JSON 配置', async ({ page }) => {
  let submittedBundle: Record<string, unknown> | undefined
  await page.route('**/api/console/jobs/bundle/create', async (route) => {
    submittedBundle = (route.request().postDataJSON() as { bundle: Record<string, unknown> }).bundle
    await route.fulfill({ status: 200, json: response({ created: 1 }) })
  })

  await page.goto('/jobs/definitions/new')
  await page.locator('.cnb-biz input').fill('JOURNEY_ADVANCED_JSON')
  await page.getByLabel('作业名称').fill('高级关联配置保留')

  for (let index = 0; index < 4; index += 1) {
    await page.getByRole('button', { name: '下一步' }).click()
  }

  const sections = page.locator('.association-section')
  for (const section of await sections.all()) {
    await section.getByText('高级配置：通过 JSON 新建关联对象', { exact: true }).click()
  }
  await sections
    .nth(0)
    .locator('.json-step textarea')
    .nth(0)
    .fill('[{"channelCode":"E2E_CHANNEL"}]')
  await sections
    .nth(0)
    .locator('.json-step textarea')
    .nth(1)
    .fill('[{"templateCode":"E2E_TEMPLATE"}]')
  await sections.nth(1).locator('.json-step textarea').fill('[{"workflowCode":"E2E_WORKFLOW"}]')
  await sections.nth(2).locator('.json-step textarea').fill('[{"routingCode":"E2E_ALERT"}]')

  await page.getByRole('button', { name: '下一步' }).click()
  await expect(page.locator('.wizard-step-banner__title')).toHaveText('复核')
  await page.getByRole('button', { name: '提交创建' }).click()

  await expect.poll(() => submittedBundle).toBeDefined()
  expect(submittedBundle).toMatchObject({
    fileChannels: [{ channelCode: 'E2E_CHANNEL' }],
    fileTemplates: [{ templateCode: 'E2E_TEMPLATE' }],
    workflowDefinitions: [{ workflowCode: 'E2E_WORKFLOW' }],
    alertRoutings: [{ routingCode: 'E2E_ALERT' }],
  })
})

test('租户管理员作业向导不暴露平台队列和 Worker 组', async ({ page }) => {
  await page.route('**/api/console/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      json: response({
        username: 'tenant-admin',
        tenantId: 'ta',
        authorities: ['ROLE_TENANT_ADMIN'],
      }),
    })
  })

  await page.goto('/jobs/definitions/new')
  await page.locator('.cnb-biz input').fill('TENANT_JOB')
  await page.getByLabel('作业名称').fill('租户作业')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '下一步' }).click()

  await expect(page.locator('.wizard-step-banner__title')).toHaveText('执行策略')
  const executionPolicy = page.locator('.wizard-form')
  await expect(executionPolicy.getByText('队列', { exact: true })).toHaveCount(0)
  await expect(executionPolicy.getByText('Worker 组', { exact: true })).toHaveCount(0)
  await expect(executionPolicy.getByText('重试策略', { exact: true })).toBeVisible()
})

test('五类 Worker 作业均可从向导提交并保留所选类型', async ({ page }) => {
  const workerTypes = ['IMPORT', 'EXPORT', 'PROCESS', 'DISPATCH', 'ATOMIC']
  const createRequests: Array<{ jobType: string; jobCode: string }> = []
  await page.route('**/api/console/meta/enums', async (route) => {
    await route.fulfill({
      status: 200,
      json: response({
        jobType: workerTypes.map((value) => ({ value, label: value })),
        executionMode: [{ value: 'FULL', label: 'FULL' }],
        scheduleType: [{ value: 'MANUAL', label: 'MANUAL' }],
        retryPolicy: [{ value: 'NONE', label: 'NONE' }],
      }),
    })
  })
  await page.route('**/api/console/jobs/bundle/create', async (route) => {
    const request = route.request().postDataJSON() as {
      bundle: { jobDefinitions: Array<{ jobType: string; jobCode: string }> }
    }
    createRequests.push(request.bundle.jobDefinitions[0])
    await route.fulfill({ status: 200, json: response({ created: 1 }) })
  })

  for (const [index, workerType] of workerTypes.entries()) {
    await page.goto('/jobs/definitions/new')
    const jobCode = `JOURNEY_${workerType}`
    await page.locator('.cnb-biz input').fill(jobCode)
    await page.getByLabel('作业名称').fill(`${workerType} 用户旅程`)
    const jobTypeField = page.locator('.el-form-item').filter({ hasText: '作业类型' })
    await jobTypeField.locator('.el-select').click()
    await page.getByRole('option', { name: workerType, exact: false }).click()

    for (let step = 0; step < 5; step += 1) {
      await page.getByRole('button', { name: '下一步' }).click()
    }
    await expect(page.locator('.wizard-step-banner__title')).toHaveText('复核')
    await expect(page.locator('.review-step')).toContainText(workerType)
    await page.getByRole('button', { name: '提交创建' }).click()
    await expect.poll(() => createRequests.length).toBe(index + 1)
    expect(createRequests[index]).toMatchObject({
      jobType: workerType,
      jobCode: `IMPORT_${jobCode}`,
    })
  }
})

test('新租户可从工作台直接进入配置包导入', async ({ page }) => {
  const renderWarnings: string[] = []
  page.on('console', (message) => {
    const text = message.text()
    if (
      message.type() === 'warning' &&
      (text.includes('Property "Download"') || text.includes('[intlify] Not found'))
    ) {
      renderWarnings.push(text)
    }
  })
  await page.goto('/ops/summary')
  await page.getByRole('tab', { name: '扩展面板' }).click()
  await expect(page.getByText('当前租户暂无运行数据')).toBeVisible()
  await page.getByRole('button', { name: /导入配置包/ }).click()
  await expect(page).toHaveURL(/\/config\/tenant-package/)
  await expect(page.getByRole('heading', { name: '配置批量导入' })).toBeVisible()
  expect(renderWarnings).toEqual([])
})

test('配置包场景选择驱动多场景精简模板下载', async ({ page }) => {
  let requestedScenarios: string[] = []
  await page.route(
    '**/api/console/config/tenant-package/excel/scenario-template**',
    async (route) => {
      requestedScenarios = new URL(route.request().url()).searchParams.getAll('scenarios')
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Buffer.from('mock-xlsx'),
        headers: { 'content-disposition': 'attachment; filename=tenant-config-package.xlsx' },
      })
    },
  )

  await page.goto('/config/tenant-package')
  await expect(page.getByRole('heading', { name: '配置批量导入' })).toBeVisible()
  const importGroup = page.locator('.scenario-template-control__group').nth(0)
  const otherGroup = page.locator('.scenario-template-control__group--other')
  await importGroup.getByText('Excel', { exact: true }).click()
  await otherGroup.getByText('数据处理', { exact: true }).click()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载配置包模板' }).click()
  const file = await download

  expect(requestedScenarios.sort()).toEqual(['IMPORT_EXCEL', 'PROCESS'])
  expect(file.suggestedFilename()).toBe('tenant-package-import_excel-process.xlsx')
})

test('批量重试逐项展示成功与失败原因', async ({ page }) => {
  const rows = [
    {
      id: 101,
      instanceNo: 'INS_RETRY_OK',
      jobCode: 'JOB_RETRY_OK',
      bizDate: '2026-10-11',
      instanceStatus: 'FAILED',
    },
    {
      id: 102,
      instanceNo: 'INS_RETRY_FAIL',
      jobCode: 'JOB_RETRY_FAIL',
      bizDate: '2026-10-11',
      instanceStatus: 'FAILED',
    },
  ]
  await page.route('**/api/console/queries/instances**', async (route) => {
    await route.fulfill({
      status: 200,
      json: response({ items: rows, total: rows.length, pageNo: 1, pageSize: 20 }),
    })
  })
  await page.route('**/api/console/jobs/rerun', async (route) => {
    const body = route.request().postDataJSON() as { targetInstanceNo: string }
    if (body.targetInstanceNo === 'INS_RETRY_FAIL') {
      await route.fulfill({
        status: 500,
        json: { code: 'EXECUTION_FAILED', message: '实例仍处于不可重试状态' },
      })
      return
    }
    await route.fulfill({ status: 200, json: response('accepted') })
  })

  await openJobInstances(page)
  const checkboxes = page.locator('.el-table__body-wrapper .el-checkbox__input')
  await checkboxes.nth(0).click()
  await checkboxes.nth(1).click()
  await page.getByRole('button', { name: '批量重试' }).click()
  const confirm = page.locator('.el-message-box')
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: '确定' }).click()

  const resultDialog = page.getByRole('dialog', { name: '批量操作结果' })
  await expect(resultDialog).toBeVisible()
  await expect(resultDialog).toContainText('成功 1 项，失败 1 项')
  await expect(resultDialog).toContainText('INS_RETRY_OK')
  await expect(resultDialog).toContainText('INS_RETRY_FAIL')
  await expect(resultDialog).toContainText('实例仍处于不可重试状态')
})

test('运行中实例取消只反馈请求已受理和待停止任务数', async ({ page }) => {
  await page.route('**/api/console/queries/instances/101**', async (route) => {
    await route.fulfill({
      status: 200,
      json: response({
        id: 101,
        instanceNo: 'INS_CANCEL_RUNNING',
        tenantId: 'ta',
        jobCode: 'JOB_CANCEL_RUNNING',
        bizDate: '2026-10-11',
        instanceStatus: 'RUNNING',
        triggerType: 'MANUAL',
        createdAt: '2026-10-11T10:00:00Z',
      }),
    })
  })
  await page.route('**/api/console/instances/101/cancel**', async (route) => {
    await route.fulfill({
      status: 200,
      json: response({ status: 'CANCEL_REQUESTED', cancelRequestedTasks: 2 }),
    })
  })

  await openJobInstances(page)
  await page.goto('/monitor/job-instances/101')
  await expect(page.getByRole('heading', { name: '作业实例详情' })).toBeVisible()
  await page.getByRole('button', { name: '请求取消' }).click()
  const confirmation = page.getByRole('dialog')
  await expect(confirmation).toContainText('运行中的任务收到协作式取消请求')
  await confirmation.getByRole('button', { name: '确认请求取消' }).click()

  await expect(page.locator('.el-message').last()).toContainText(
    '已受理实例 INS_CANCEL_RUNNING 的取消请求',
  )
  await expect(page.locator('.el-message').last()).toContainText('2')
})

test('强制终止后重新读取实例终态', async ({ page }) => {
  let instanceStatus = 'RUNNING'
  await page.route('**/api/console/queries/instances/102**', async (route) => {
    await route.fulfill({
      status: 200,
      json: response({
        id: 102,
        instanceNo: 'INS_TERMINATE_RUNNING',
        tenantId: 'ta',
        jobCode: 'JOB_TERMINATE_RUNNING',
        bizDate: '2026-10-11',
        instanceStatus,
        triggerType: 'MANUAL',
        createdAt: '2026-10-11T10:00:00Z',
      }),
    })
  })
  await page.route('**/api/console/instances/102/terminate**', async (route) => {
    instanceStatus = 'TERMINATED'
    await route.fulfill({ status: 200, json: response('TERMINATED') })
  })

  await openJobInstances(page)
  await page.goto('/monitor/job-instances/102')
  await expect(page.getByRole('heading', { name: '作业实例详情' })).toBeVisible()
  await page.getByRole('button', { name: '终止实例' }).click()

  const confirmation = page.getByRole('dialog')
  await expect(confirmation).toContainText('强制终止')
  await expect(confirmation).toContainText('中间结果')
  await confirmation.getByRole('button', { name: '确认强制终止' }).click()

  await expect(page.locator('.el-message').last()).toContainText(
    '已强制终止实例 INS_TERMINATE_RUNNING',
  )
  await expect(page.getByText('TERMINATED', { exact: true }).first()).toBeVisible()
})

test('窄屏作业向导与重放页无页面横向溢出和严重可访问性问题', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/jobs/definitions/new')
  await expect(page.getByRole('heading', { name: '该功能需要桌面端' })).toBeVisible()
  await expect(page.getByRole('button', { name: '切换桌面版' })).toBeVisible()
  await expect(page.getByRole('link', { name: '任务' })).toBeVisible()

  await page.setViewportSize({ width: 820, height: 900 })

  for (const route of ['/jobs/definitions/new', '/ops/batch-day-replay']) {
    await page.goto(route)
    if (route === '/jobs/definitions/new') {
      await expect(page.locator('.wizard-step-banner__title')).toHaveText('基本信息')
    } else {
      await expect(page.getByRole('heading', { name: '批次日重放' }).first()).toBeVisible()
    }
    const pageWidths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }))
    expect(pageWidths.document, `${route} 页面不应整体横向溢出`).toBeLessThanOrEqual(
      pageWidths.viewport + 1,
    )

    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
      .analyze()
    const blockers = audit.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? 'minor'),
    )
    expect(
      blockers.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })),
      `${route} 应无 critical/serious axe 违规`,
    ).toEqual([])
  }
})
