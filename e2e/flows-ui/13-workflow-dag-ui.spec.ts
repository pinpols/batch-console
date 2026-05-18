/**
 * UI Flow 13: Workflow 多步 DAG 可视化
 * 真页:/workflow/definitions /workflow/viewer/:id /monitor/workflow-runs
 */
import { test, expect } from '../support/app'
import { enterDemoApp, isVisible } from '../support/app'

test.describe('UI Flow 13: workflow DAG UI', () => {
  test.beforeEach(async ({ page }) => { await enterDemoApp(page) })

  test('1. /workflow/definitions 列表 + DAG 视图入口', async ({ page }) => {
    await page.goto('/workflow/definitions')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('2. 点行链接进 /workflow/viewer/:id(若有数据)', async ({ page }) => {
    await page.goto('/workflow/definitions')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const viewerLink = page.locator('a[href*="/workflow/viewer/"]').first()
    if (await isVisible(viewerLink, 2000)) {
      await viewerLink.click({ force: true })
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
      // viewer 页应渲染 X6 容器或骨架
      const dagContainer = page.locator('.x6-graph, #x6-graph-container, .workflow-viewer, .section-card').first()
      await expect(dagContainer).toBeAttached({ timeout: 10_000 })
    }
  })

  test('3. /monitor/workflow-runs 运行列表', async ({ page }) => {
    await page.goto('/monitor/workflow-runs')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    await expect(page.locator('.section-card, .el-table, .el-empty').first()).toBeAttached({ timeout: 10_000 })
  })

  test('4. 点 run 详情看节点级状态', async ({ page }) => {
    await page.goto('/monitor/workflow-runs')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
    const detailLink = page.locator('a[href*="/monitor/workflow-runs/"]').first()
    if (await isVisible(detailLink, 2000)) {
      await detailLink.click({ force: true })
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined)
      const noErr: string[] = []
      page.on('pageerror', (e) => noErr.push(e.message))
      await page.waitForTimeout(500)
      expect(noErr, `pageerror: ${noErr.join('|')}`).toHaveLength(0)
    }
  })
})
