/**
 * 作业实例行操作覆盖 — 监控页是运维最高频入口,补齐 row-actions 实操覆盖。
 *
 * 覆盖 JobInstanceList 每行的:详情跳转 / 分片跳转 / instanceNo·jobCode·traceId 链接 /
 * 详情页重跑对话框。需要 ta 有 job_instance 数据(本地由真实 launch 产生;无数据优雅 skip)。
 *
 * 设计:只验「点了有正确反应」(导航到对,弹窗开)—— 重跑只开确认框后取消,不真重跑避免污染。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('@row-actions 作业实例行操作', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    const listP = page
      .waitForResponse(
        (r) => /\/queries\/instances/.test(r.url()) && r.status() === 200,
        { timeout: 12000 },
      )
      .catch(() => null)
    await page.goto('/monitor/job-instances')
    await expectPageTitle(page, /作业运行|作业实例|实例|运行/)
    await listP
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    // 等表格行渲染(有数据则出现,空表则空态)— 给足渲染时间避免误判无数据
    await page
      .locator('tbody tr.el-table__row, .el-empty, .empty-state')
      .first()
      .waitFor({ state: 'visible', timeout: 8000 })
      .catch(() => {})
  })

  test('行「详情」→ 跳作业实例详情页', async ({ page }) => {
    const row = page.locator('tbody tr.el-table__row').first()
    if (!(await isVisible(row, 3000))) {
      test.skip(true, '无作业实例数据')
      return
    }
    await row.getByRole('button', { name: /详情/ }).first().click()
    await expect(page).toHaveURL(/\/monitor\/job-instances\/\d+/, { timeout: 8000 })
    // 详情页有实例状态/编号区块
    await expect(page.locator('.page-header, .el-descriptions, .detail-header').first()).toBeVisible({
      timeout: 6000,
    })
  })

  test('行「步骤/分片」→ 跳步骤分片视图', async ({ page }) => {
    const row = page.locator('tbody tr.el-table__row').first()
    if (!(await isVisible(row, 3000))) {
      test.skip(true, '无作业实例数据')
      return
    }
    // 行内第二个动作按钮(label「步骤」,即分片视图入口)
    const partBtn = row.getByRole('button', { name: /步骤|分片|partition/i }).first()
    if (!(await isVisible(partBtn, 2000))) {
      test.skip(true, '该行无步骤/分片入口')
      return
    }
    await partBtn.click()
    await expect(
      page.locator('.partition-view, .el-table, .page-header, .el-drawer').first(),
    ).toBeVisible({ timeout: 8000 })
  })

  test('instanceNo 链接 → 详情页', async ({ page }) => {
    const link = page.locator('a.cell-link, tbody a').filter({ hasText: /\w/ }).first()
    if (!(await isVisible(link, 3000))) {
      test.skip(true, '无可点击实例链接')
      return
    }
    const href = await link.getAttribute('href')
    if (!href || !/job-instances|jobs\/definitions|job-definitions|trace/.test(href)) {
      test.skip(true, '首链接非已知跳转')
      return
    }
    await link.click()
    await expect(page).toHaveURL(/job-instances|jobs\/definitions|job-definitions|trace/, { timeout: 8000 })
  })

  test('详情页「重跑」→ 开确认对话框(取消,不真重跑)', async ({ page }) => {
    const row = page.locator('tbody tr.el-table__row').first()
    if (!(await isVisible(row, 3000))) {
      test.skip(true, '无作业实例数据')
      return
    }
    await row.getByRole('button', { name: /详情/ }).first().click()
    await expect(page).toHaveURL(/\/monitor\/job-instances\/\d+/, { timeout: 8000 })

    const rerunBtn = page.getByRole('button', { name: /重跑|重新运行/ }).first()
    if (!(await isVisible(rerunBtn, 3000))) {
      test.skip(true, '该实例状态无重跑入口(可能非终态)')
      return
    }
    await rerunBtn.click()
    // 确认弹窗出现(ElMessageBox)
    const confirmBox = page.locator('.el-message-box, .el-dialog:visible').first()
    await expect(confirmBox).toBeVisible({ timeout: 5000 })
    // 取消,不真重跑(避免造脏实例)
    const cancelBtn = confirmBox.getByRole('button', { name: /取消|关闭/ }).first()
    if (await isVisible(cancelBtn, 2000)) await cancelBtn.click()
    else await page.keyboard.press('Escape')
    await expect(confirmBox).toBeHidden({ timeout: 5000 })
  })
})
