/**
 * 编排设计器 — 桌面控件补充(P1-P8)。与既有 smoke / save-flow 互补:
 * smoke 已覆盖「拖节点→连边→校验→保存→重开」主路径;本 spec 补:
 *   - 新建直入(/workflow/designer 无 id)就位 —— P3 新建闭环入口
 *   - 工具栏关键控件齐全(撤销/重做/自动布局/校验/保存)—— P4 undo + P5 工具栏
 *   - 校验给出反馈 —— P7
 * 移动端按 CLAUDE.md「不写自动化测试」,此处只桌面;用稳定 class/role + 真实文案。
 */
import { expect, test } from './support/app'
import { enterDemoApp } from './support/app'

test.describe('编排设计器 — 桌面控件', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('新建直入 → 画布 + 工具栏就位', async ({ page }) => {
    await page.goto('/workflow/designer')
    // 设计器较重,放宽超时;不被路由守卫弹回
    await expect(page).toHaveURL(/\/workflow\/designer/, { timeout: 10_000 })
    await expect(page.locator('.workflow-designer')).toBeVisible({ timeout: 15_000 })

    const toolbar = page.locator('.designer-toolbar')
    await expect(toolbar).toBeVisible()
    await expect(toolbar).toHaveAttribute('role', 'toolbar')
    // 关键控件齐全(P4 undo / P5 工具栏)
    for (const label of ['撤销', '重做', '自动布局', '校验', '保存']) {
      await expect(toolbar.getByRole('button', { name: label }).first()).toBeVisible()
    }
  })

  test('点击校验 → 有反馈提示', async ({ page }) => {
    await page.goto('/workflow/designer')
    await expect(page.locator('.workflow-designer')).toBeVisible({ timeout: 15_000 })

    await page.locator('.designer-toolbar').getByRole('button', { name: '校验' }).first().click()
    // 反馈两种形态:校验通过 → toast(.el-message);校验失败 → 错误抽屉(.el-drawer)。
    // 只断言"出现反馈",任一形态即可,不锁定结果(空图通常报错走 drawer)。
    const feedback = page.locator('.el-message, .el-drawer.workflow-error-drawer, .el-drawer').first()
    await expect(feedback).toBeVisible({ timeout: 8_000 })
  })
})
