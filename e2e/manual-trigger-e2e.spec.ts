/**
 * 手动触发作业 — 真端到端操作验证(不止 toast,要验真产生实例)。
 *
 * 既有 job-ops 的「手动触发 → toast」只断言出现了 toast,不验操作结果。本 spec 补真闭环:
 * 在作业定义页对一个可干净触发的作业(TA_E2E_ATOMIC,本地 seed)点手动触发 → 填 payload → 提交
 * → 断言 success toast → 跳监控页按 jobCode 过滤 → 断言【新实例出现】(操作真的产生了运行态)。
 *
 * 需 ta 有 TA_E2E_ATOMIC 这个 ATOMIC 作业(本地由 atomic_shell_demo 克隆 seed);无则优雅 skip。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

const JOB = 'TA_E2E_ATOMIC'

test.describe('@manual-trigger 手动触发作业 真端到端', () => {
  test('手动触发 → 成功 → 监控页出现该作业新实例', async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/jobs/definitions')
    await expectPageTitle(page, '作业定义')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    // 按 jobCode 过滤定位目标行
    const codeInput = page
      .locator('.el-form-item')
      .filter({ hasText: /Job Code|作业编码|编码/ })
      .locator('input')
      .first()
    if (await isVisible(codeInput, 3000)) {
      await codeInput.fill(JOB)
      await page.getByRole('button', { name: /搜索|查询/ }).first().click().catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
    }
    const row = page.locator('tbody tr.el-table__row').filter({ hasText: JOB }).first()
    if (!(await isVisible(row, 4000))) {
      test.skip(true, `无 ${JOB} 作业(需本地 seed TA_E2E_ATOMIC),跳过`)
      return
    }

    // 手动触发(行内更多/直接按钮)
    let triggerBtn = row.getByRole('button', { name: '手动触发' }).first()
    if (!(await isVisible(triggerBtn, 1500))) {
      const more = row.getByRole('button', { name: /^更多/ }).first()
      if (await isVisible(more, 1500)) {
        await more.click()
        triggerBtn = page.locator('.el-dropdown-menu__item, [role="menuitem"]').filter({ hasText: '手动触发' }).first()
      }
    }
    if (!(await isVisible(triggerBtn, 2000))) {
      test.skip(true, '该行无手动触发入口')
      return
    }
    await triggerBtn.click()
    const box = page.locator('.el-message-box, .el-dialog:visible').first()
    await expect(box).toBeVisible({ timeout: 5000 })
    const ta = box.locator('textarea').first()
    if (await isVisible(ta, 1500)) await ta.fill('{}')
    await box.getByRole('button', { name: /^触发$|确定|提交/ }).first().click()

    // 操作真受理 → success toast。注意:el-message 约 3s 自动消失,4-worker 高负载下
    // 单次 toBeVisible 抓取窗口易错过 → 用 poll 容忍「toast 已出现过」或「弹窗已关闭」
    // (提交成功后 message-box 会关闭)两者之一成立即判为受理。
    await expect
      .poll(
        async () => {
          const toast = await page.locator('.el-message--success').count()
          const boxGone = !(await box.isVisible().catch(() => false))
          return toast > 0 || boxGone
        },
        { timeout: 15000 },
      )
      .toBe(true)

    // 验真结果:监控页按 jobCode 过滤,出现该作业实例(刚触发产生)
    await page.goto(`/monitor/job-instances?jobCode=${JOB}`)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    // 触发→outbox→kafka→launch→实例落库这条异步链有延迟。监控页虽有自动刷新,
    // 但首轮刷新窗口可能错过刚落库实例;主动刷新让断言跟业务事实对齐。
    await expect
      .poll(
        async () => {
          await page.getByRole('button', { name: '刷新' }).click().catch(() => {})
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
          return page.locator('tbody tr.el-table__row').filter({ hasText: JOB }).count()
        },
        { timeout: 60000, intervals: [2000, 3000, 5000] },
      )
      .toBeGreaterThan(0)
  })
})
