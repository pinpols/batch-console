/**
 * 编排设计器 — 桌面控件补充(P1-P8)。与既有 smoke / save-flow 互补:
 * smoke 已覆盖「拖节点→连边→校验→保存→重开」主路径;本 spec 补:
 *   - 新建直入(/workflow/designer 无 id)就位 —— P3 新建闭环入口
 *   - 工具栏关键控件齐全(撤销/重做/自动布局/校验/保存)—— P4 undo + P5 工具栏
 *   - 校验给出反馈 —— P7
 * 移动端按 AGENTS.md「不写自动化测试」,此处只桌面;用稳定 class/role + 真实文案。
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
    const feedback = page
      .locator('.el-message, .el-drawer.workflow-error-drawer, .el-drawer')
      .first()
    await expect(feedback).toBeVisible({ timeout: 8_000 })
  })

  test('画布优先布局 → 辅助面板互斥且支持专注模式', async ({ page }) => {
    await page.goto('/workflow/designer')
    await expect(page.locator('.workflow-designer')).toBeVisible({ timeout: 15_000 })

    const body = page.locator('.workflow-designer__body')
    const canvas = page.locator('.workflow-designer__canvas-shell')
    const canvasRatio = async () => {
      const bodyBox = await body.boundingBox()
      const canvasBox = await canvas.boundingBox()
      expect(bodyBox).not.toBeNull()
      expect(canvasBox).not.toBeNull()
      return canvasBox!.width / bodyBox!.width
    }

    await expect(page.locator('.node-palette')).toHaveClass(/node-palette--collapsed/)
    await expect(page.locator('.node-inspector')).toHaveCount(0)
    expect(await canvasRatio()).toBeGreaterThan(0.88)

    await page.getByRole('button', { name: '展开节点库' }).click()
    await expect(body).toHaveClass(/workflow-designer__body--palette-expanded/)
    await page.getByRole('button', { name: '打开属性面板' }).click()
    await expect(page.locator('.node-palette')).toHaveClass(/node-palette--collapsed/)
    await expect(page.locator('.node-inspector')).toBeVisible()
    await expect(body).not.toHaveClass(/workflow-designer__body--palette-expanded/)

    await page.getByRole('button', { name: '专注画布' }).click()
    await expect(page.locator('.node-palette')).toHaveCount(0)
    await expect(page.locator('.node-inspector')).toHaveCount(0)
    await expect(body).toHaveClass(/workflow-designer__body--focus/)
    expect(await canvasRatio()).toBeGreaterThan(0.96)

    await page.getByRole('button', { name: '退出专注画布' }).click()
    await expect(page.locator('.node-palette')).toBeVisible()
  })

  test('连续添加 START、JOB、END 不重叠且可以连接成完整链路', async ({ page }) => {
    await page.goto('/workflow/designer')
    await expect(page.locator('.workflow-designer')).toBeVisible({ timeout: 15_000 })

    for (const type of ['START', 'JOB', 'END']) {
      await page.getByRole('button', { name: type, exact: true }).click()
    }

    const nodes = page.locator('.dag-canvas__graph .x6-node')
    await expect(nodes).toHaveCount(3)
    const boxes = await nodes.evaluateAll((items) =>
      items.map((item) => {
        const rect = item.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      }),
    )
    const overlaps = (a: (typeof boxes)[number], b: (typeof boxes)[number]) =>
      !(
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y
      )
    expect(overlaps(boxes[0]!, boxes[1]!)).toBe(false)
    expect(overlaps(boxes[1]!, boxes[2]!)).toBe(false)

    const ids = await nodes.evaluateAll((items) =>
      items.map((item) => item.getAttribute('data-cell-id') ?? ''),
    )
    await connect(page, ids[0]!, ids[1]!)
    await connect(page, ids[1]!, ids[2]!)
    await expect(page.locator('.workflow-designer__canvas-status')).toContainText('2 edges')
  })
})

async function connect(page: import('@playwright/test').Page, sourceId: string, targetId: string) {
  const source = page
    .locator(`.dag-canvas__graph .x6-node[data-cell-id="${sourceId}"] .x6-port-body[port="out"]`)
    .first()
  const target = page
    .locator(`.dag-canvas__graph .x6-node[data-cell-id="${targetId}"] .x6-port-body[port="in"]`)
    .first()
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(targetBox).not.toBeNull()
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, {
    steps: 12,
  })
  await page.mouse.up()
}
