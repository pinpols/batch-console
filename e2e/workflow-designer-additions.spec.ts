/**
 * Workflow 设计器新增能力 e2e(本会话 A/C 组:快捷键帮助面板 + 节点搜索框)。
 * 复用 smoke spec 的"经列表进设计器 + skip 容错"模式;只验我新增的工具栏控件。
 */
import { enterDemoApp, isVisible, expect, test } from './support/app'

async function openDesigner(page): Promise<boolean> {
  // 与 smoke spec 对齐用 domcontentloaded:默认 'load' 在 SW/重定向下偶发 net::ERR_ABORTED
  await page.goto('/workflow/definitions', { waitUntil: 'domcontentloaded' })
  const listMounted = await page
    .locator('.el-table, .empty-state, .table-skeleton')
    .first()
    .waitFor({ state: 'attached', timeout: 10_000 })
    .then(() => true)
    .catch(() => false)
  if (!listMounted) return false

  const firstRow = page.locator('tbody tr.el-table__row').first()
  if (!(await isVisible(firstRow, 4000))) return false

  let openBtn = firstRow.getByRole('button', { name: '设计器' }).first()
  if (!(await isVisible(openBtn, 1500))) {
    const moreBtn = firstRow.getByRole('button', { name: /更多|More/i }).first()
    if (await isVisible(moreBtn, 1000)) {
      await moreBtn.click()
      openBtn = page.getByRole('menuitem', { name: '设计器' }).first()
    }
  }
  if (!(await isVisible(openBtn, 2000))) return false
  await openBtn.click({ force: true })
  await expect(page).toHaveURL(/\/workflow\/designer\/\d+/, { timeout: 10_000 })
  return await isVisible(page.locator('.dag-canvas').first(), 10_000)
}

test.describe('@workflow-designer-additions 工具栏新增控件', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('快捷键帮助:按钮打开面板,列出快捷键', async ({ page }) => {
    if (!(await openDesigner(page))) {
      test.skip(true, '无可用 workflow 行 / 设计器未挂载(BE 未 seed),跳过')
      return
    }
    await page.getByRole('button', { name: '快捷键' }).first().click()
    const dialog = page.locator('.el-dialog:visible').filter({ hasText: '键盘快捷键' })
    await expect(dialog).toBeVisible()
    // 至少列出几条已知快捷键
    await expect(dialog.getByText('保存工作流')).toBeVisible()
    await expect(dialog.getByText('删除选中节点 / 边')).toBeVisible()
  })

  test('节点搜索:工具栏存在搜索框', async ({ page }) => {
    if (!(await openDesigner(page))) {
      test.skip(true, '无可用 workflow 行 / 设计器未挂载(BE 未 seed),跳过')
      return
    }
    const toolbar = page.getByRole('toolbar', { name: '设计器工具栏' })
    await expect(toolbar.getByRole('combobox').first()).toBeVisible()
    await expect(toolbar.getByText('搜索节点…')).toBeVisible()
  })
})
