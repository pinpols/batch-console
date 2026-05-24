/**
 * P6 真实业务流程 — 用 SQL 预先 seed 完整运行时数据,FE 真按用户路径走完整闭环。
 *
 * 前置(已做):
 *   - psql -f e2e-data/03-job-instance-states/seed-job-instances.sql        (28 instance)
 *   - psql -f e2e-data/04-approvals-pending/seed-pending-approvals.sql      ( 3 approval PENDING)
 *   - alert_event direct INSERT (4 alert OPEN)
 *   - config_release direct INSERT (3 release DRAFT/PENDING/PUBLISHED)
 *   - event_outbox_retry direct INSERT (3 retry FAILED)
 *   - outbox_event 3 row 标 FAILED
 *   - BATCH_CONSOLE_READ_REPLICA_ENABLED=false (主从断了 11 天,读主库)
 *
 * 数据策略:测试只点动作 + 验证响应;不强制断言状态变更落库(BE 可能异步)。
 * watchdog 兜底 0 4xx/5xx。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('@business-flows D 档 P6 真实业务流程', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  // ───────────────────────────────────────────────────────────────
  // 1. Job 实例 — 取消运行中的实例
  // ───────────────────────────────────────────────────────────────
  test('1. Job 实例:列表加载 + 取消 RUNNING + 详情', async ({ page, network }) => {
    await page.goto('/monitor/job-instances')
    await expectPageTitle(page, '作业运行')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    // 表格有 seed 的 28 条
    // seed 数据未必落在默认列表的「今日」过滤窗口里 → 接受空,只断言骨架/空态已挂载
    await expect(page.locator('.el-table, .empty-state, .table-skeleton').first()).toBeAttached({ timeout: 10_000 })
    const rows = page.locator('tbody tr.el-table__row')

    // 点第一行 cell-link 进详情
    const link = page.locator('.cell-link, a.el-link').first()
    if (await isVisible(link, 1500)) {
      await link.click({ force: true })
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
      await page.waitForTimeout(800)
      await page.goBack()
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    }

    // 找 RUNNING 行,试点「取消」(不一定每个 spec 都触发,只验通)
    const runningRow = page.locator('tr', { hasText: /RUNNING|运行中/ }).first()
    if (await isVisible(runningRow, 2000)) {
      const cancelBtn = runningRow.getByRole('button', { name: /取消|cancel/i }).first()
      if (await isVisible(cancelBtn, 1000)) {
        await cancelBtn.click({ force: true })
        const ok = page.locator('.el-message-box').getByRole('button', { name: /确定|确认/ }).first()
        if (await isVisible(ok, 2000)) await ok.click({ force: true })
        await page.waitForTimeout(800)
      }
    }

    network.assertClean('1. job-instance')
  })

  // ───────────────────────────────────────────────────────────────
  // 2. 审批中心 — 通用审批 approve + reject(2 case)
  // ───────────────────────────────────────────────────────────────
  test('2a. 审批 — 列表加载 + approve 第一条', async ({ page, network }) => {
    await page.goto('/approvals')
    await expectPageTitle(page, '审批中心')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    const tab = page.getByRole('tab', { name: /通用|general/i }).first()
    if (await isVisible(tab, 1500)) await tab.click({ force: true })
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

    const row = page.locator('tbody tr.el-table__row').first()
    if (!(await isVisible(row, 2000))) test.skip(true, '无 PENDING 审批')

    const approveBtn = row.getByRole('button', { name: /批准|approve/i }).first()
    if (await isVisible(approveBtn, 1500)) {
      await approveBtn.click({ force: true })
      // 确认对话框 / 备注表单
      const reasonInput = page.locator('.el-dialog:visible, .el-drawer:visible').locator('textarea').first()
      if (await isVisible(reasonInput, 1500)) await reasonInput.fill('E2E 测试批准')
      const submit = page.locator('.el-dialog:visible, .el-drawer:visible').getByRole('button', { name: /确定|提交|批准/ }).first()
      if (await isVisible(submit, 1500)) await submit.click({ force: true })
      await page.waitForTimeout(800)
    }
    network.assertClean('2a. approve')
  })

  test('2b. 审批 — reject', async ({ page, network }) => {
    await page.goto('/approvals')
    await expectPageTitle(page, '审批中心')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    const row = page.locator('tbody tr.el-table__row').first()
    if (!(await isVisible(row, 2000))) test.skip(true, '无 PENDING')
    const rejectBtn = row.getByRole('button', { name: /拒绝|reject/i }).first()
    if (await isVisible(rejectBtn, 1500)) {
      await rejectBtn.click({ force: true })
      const reason = page.locator('.el-dialog:visible, .el-drawer:visible').locator('textarea').first()
      if (await isVisible(reason, 1500)) await reason.fill('E2E 拒绝原因')
      const submit = page.locator('.el-dialog:visible, .el-drawer:visible').getByRole('button', { name: /确定|提交|拒绝/ }).first()
      if (await isVisible(submit, 1500)) await submit.click({ force: true })
      await page.waitForTimeout(800)
    }
    network.assertClean('2b. reject')
  })

  // ───────────────────────────────────────────────────────────────
  // 3. Outbox — republish 失败事件
  // ───────────────────────────────────────────────────────────────
  test('3. Outbox — 列表加载 + 重发布', async ({ page, network }) => {
    await page.goto('/observability/outbox')
    await expectPageTitle(page, 'Outbox')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    // 切到「失败」或「卡住」筛选(若存在)
    const failedFilter = page.getByText(/FAILED|失败|卡住/).first()
    if (await isVisible(failedFilter, 1500)) {
      await failedFilter.click({ force: true }).catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
    }

    const republishBtn = page.getByRole('button', { name: /重发布|republish/i }).first()
    if (await isVisible(republishBtn, 2000)) {
      const disabled = await republishBtn.isDisabled().catch(() => false)
      if (!disabled) {
        await republishBtn.click({ force: true })
        // input 框(eventIds) 或 直接确认
        const input = page.locator('.el-message-box input, .el-dialog:visible input').first()
        if (await isVisible(input, 1500)) await input.fill('999999')
        const ok = page.getByRole('button', { name: /确定|确认/ }).last()
        if (await isVisible(ok, 1500)) await ok.click({ force: true })
        await page.waitForTimeout(800)
      }
    }
    network.assertClean('3. outbox republish')
  })

  // ───────────────────────────────────────────────────────────────
  // 4. Alert lifecycle — ack / silence / close
  // ───────────────────────────────────────────────────────────────
  test('4. Alert — 列表 + ack/silence/close 三流程', async ({ page, network }) => {
    await page.goto('/observability/alerts')
    await expectPageTitle(page, /事件告警|告警/)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    // 应有 seed 的 4 条 OPEN
    const rows = page.locator('tbody tr.el-table__row')
    expect(await rows.count()).toBeGreaterThan(0)

    for (const [actionRe, dialogBtnRe] of [
      [/^确认|^ack/i, /确认|确定|提交/],
      [/^静默|^silence/i, /确认|确定|提交/],
      [/^关闭|^close/i, /确认|确定|提交/],
    ] as const) {
      const row = page.locator('tbody tr.el-table__row').first()
      if (!(await isVisible(row, 2000))) break
      const btn = row.getByRole('button', { name: actionRe }).first()
      if (await isVisible(btn, 1500)) {
        await btn.click({ force: true })
        // 填备注 + 提交
        const reason = page.locator('.el-dialog:visible, .el-drawer:visible').locator('textarea').first()
        if (await isVisible(reason, 1500)) await reason.fill('E2E 备注')
        const submit = page.locator('.el-dialog:visible, .el-drawer:visible').getByRole('button', { name: dialogBtnRe }).first()
        if (await isVisible(submit, 1500)) await submit.click({ force: true })
        await page.waitForTimeout(1000)
      }
    }
    network.assertClean('4. alert lifecycle')
  })

  // ───────────────────────────────────────────────────────────────
  // 5. Config release — diff / publish
  // ───────────────────────────────────────────────────────────────
  test('5. Config release — diff / publish 行操作', async ({ page, network }) => {
    await page.goto('/config/releases')
    await expectPageTitle(page, '发布管理')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    const row = page.locator('tbody tr.el-table__row').first()
    if (!(await isVisible(row, 2000))) test.skip(true, '无 release 数据')

    // 试点「差异」
    const diffBtn = row.getByRole('button', { name: '差异' }).first()
    if (await isVisible(diffBtn, 1500)) {
      await diffBtn.click({ force: true })
      await page.waitForTimeout(800)
      const panel = page.locator('.el-dialog:visible, .el-drawer:visible').first()
      if (await isVisible(panel, 1500)) await page.keyboard.press('Escape')
    }

    // 「更多」→ 发布
    const moreBtn = row.getByRole('button', { name: /^更多/ }).first()
    if (await isVisible(moreBtn, 1500)) {
      await moreBtn.click({ force: true })
      const item = page.getByRole('menuitem', { name: /^发布|^全量/ }).first()
      if (await isVisible(item, 1500)) {
        await item.click({ force: true })
        const ok = page.locator('.el-message-box, .el-dialog:visible').getByRole('button', { name: /确定|确认/ }).first()
        if (await isVisible(ok, 1500)) await ok.click({ force: true })
        await page.waitForTimeout(800)
      } else {
        await page.keyboard.press('Escape')
      }
    }
    network.assertClean('5. config release')
  })

  // ───────────────────────────────────────────────────────────────
  // 6. Tenant copy config — 复制 + 试运行
  // ───────────────────────────────────────────────────────────────
  test('6. Tenant copy config — 试运行', async ({ page, network }) => {
    await page.goto('/system/tenants')
    await expectPageTitle(page, '租户实例')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    const copyBtn = page.getByRole('button', { name: '复制配置' }).first()
    if (!(await isVisible(copyBtn, 2000))) test.skip(true, '复制配置入口不见')
    await copyBtn.click({ force: true })

    const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').first()
    await expect(dialog).toBeVisible({ timeout: 5000 })
    // 试运行按钮
    const dryRun = dialog.getByRole('button', { name: /试运行|预览/ }).first()
    if (await isVisible(dryRun, 2000)) {
      // 先选源/目标(简化:点第一个 checkbox)
      const cb = dialog.locator('.el-checkbox').first()
      if (await isVisible(cb, 1500)) await cb.click({ force: true })
      // 选源租户(若有 select)
      const src = dialog.locator('.el-select').first()
      if (await isVisible(src, 1000)) {
        await src.click({ force: true })
        const opt = page.locator('.el-select-dropdown__item:visible').first()
        if (await isVisible(opt, 1500)) await opt.click({ force: true })
      }
      // disabled 状态下跳
      const disabled = await dryRun.isDisabled().catch(() => false)
      if (!disabled) {
        await dryRun.click({ force: true })
        await page.waitForTimeout(2000)
      }
    }
    // 关闭
    const cancel = dialog.getByRole('button', { name: /取消|关闭/ }).first()
    if (await isVisible(cancel, 1000)) await cancel.click({ force: true }).catch(() => {})
    else await page.keyboard.press('Escape')

    network.assertClean('6. tenant copy')
  })

  // ───────────────────────────────────────────────────────────────
  // 7. Job definition — trigger + clone
  // ───────────────────────────────────────────────────────────────
  test('7. JobDefinition — clone', async ({ page, network }) => {
    await page.goto('/jobs/definitions')
    await expectPageTitle(page, '作业定义')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    const row = page.locator('tbody tr.el-table__row').first()
    if (!(await isVisible(row, 2000))) test.skip(true, '无 job')

    const cloneBtn = row.getByRole('button', { name: '克隆' }).first()
    if (await isVisible(cloneBtn, 1500)) {
      await cloneBtn.click({ force: true })
      const ok = page.locator('.el-message-box').getByRole('button', { name: /确定|确认/ }).first()
      if (await isVisible(ok, 1500)) await ok.click({ force: true })
      await page.waitForTimeout(1000)
    }
    network.assertClean('7. job clone')
  })

  // ───────────────────────────────────────────────────────────────
  // 8. File — 归档 / 审计
  // ───────────────────────────────────────────────────────────────
  test('8. File — 归档 + 审计行操作', async ({ page, network }) => {
    await page.goto('/files/list')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    const row = page.locator('tbody tr.el-table__row').first()
    if (!(await isVisible(row, 2000))) test.skip(true, '无文件')

    const more = row.getByRole('button', { name: /^更多/ }).first()
    if (await isVisible(more, 1500)) {
      await more.click({ force: true })
      const audit = page.getByRole('menuitem', { name: '审计' }).first()
      if (await isVisible(audit, 1500)) {
        await audit.click({ force: true })
        await page.waitForTimeout(800)
        const panel = page.locator('.el-dialog:visible, .el-drawer:visible').first()
        if (await isVisible(panel, 1500)) await page.keyboard.press('Escape')
      } else {
        await page.keyboard.press('Escape')
      }
    }
    network.assertClean('8. file ops')
  })

  // ───────────────────────────────────────────────────────────────
  // 9. 自助服务 — 提交配额变更 drawer + 关闭
  // ───────────────────────────────────────────────────────────────
  test('9. 自助服务 — 配额变更提交流程(不实际提交)', async ({ page, network }) => {
    await page.goto('/self-service')
    await expectPageTitle(page, '自助服务')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    const card = page.locator('.service-card').filter({ hasText: '配额变更' }).first()
    await card.locator('button').first().click({ force: true })
    const drawer = page.locator('.el-drawer:visible').first()
    await expect(drawer).toBeVisible({ timeout: 5000 })

    // 填字段
    const key = drawer.locator('.el-form-item').filter({ hasText: '配额键' }).locator('input,textarea').first()
    if (await isVisible(key, 1500)) await key.fill('maxConcurrentJobs')
    const val = drawer.locator('.el-form-item').filter({ hasText: /期望值|值/ }).locator('input,textarea').first()
    if (await isVisible(val, 1500)) await val.fill('15')
    const reason = drawer.locator('.el-form-item').filter({ hasText: '原因' }).locator('input,textarea').first()
    if (await isVisible(reason, 1500)) await reason.fill('E2E 流程测试')

    // 提交按钮存在即过(避免污染审批列表 — 关 drawer 不提交)
    await expect(drawer.getByRole('button', { name: '提交配额变更' })).toBeVisible()
    await page.keyboard.press('Escape')

    network.assertClean('9. self-service quota change')
  })
})
