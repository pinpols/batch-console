/**
 * Workflow Designer 保存流 e2e —— 不依赖原生 HTML5 DnD。
 *
 * 背景:`workflow-designer-smoke.spec.ts` 用原生拖拽建图,Playwright 无法可靠驱动
 *   native HTML5 DnD → 长期 flaky / skip,save/persist 业务逻辑从未端到端验证。
 *
 * 策略:用 API 建立 e2e 前缀的隔离合法图，再进入设计器，避免修改公共 seed 工作流；
 *   用工具栏「自动布局」(store.moveNode,纯点击) 改动节点坐标 → 图变 dirty 但仍合法,
 *   端到端验证真实业务流:
 *     进入 → 自动布局(改图)→ 保存(graphToDefinition → PUT /full)→ 刷新 → 节点仍在。
 *   顺带覆盖:
 *     - 画布渲染(X6 vue-shape-view / clientToLocal 修复后不再「组件渲染异常」)
 *     - 全屏设计器「返回列表」按钮存在(B)
 *     - save → getFull 持久化往返(核心业务逻辑)
 *
 * 数据:每次创建独立 e2e 工作流，仅改节点坐标后保存；global-teardown 按 prefix=e2e 清理。
 */

import { test, expect } from './support/app'
import { enterDemoApp } from './support/app'

test.describe('@workflow-designer-save 工作流设计器保存流', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('进入 → 自动布局改图 → 保存 → 刷新后节点仍在', async ({ page }) => {
    const stamp = Date.now()
    const startCode = `start_${stamp}`
    const jobCode = `job_${stamp}`
    const endCode = `end_${stamp}`
    const createResponse = await page.request.post('/api/console/workflow-definitions', {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'ta',
        'Idempotency-Key': `e2e-wfd-save-create-${stamp}`,
      },
      data: {
        tenantId: 'ta',
        workflowCode: `e2e_wfd_save_${stamp}`,
        workflowName: `E2E workflow save ${stamp}`,
        workflowType: 'DAG',
        enabled: true,
        nodes: [
          { nodeCode: startCode, nodeName: '开始', nodeType: 'START', enabled: true },
          {
            nodeCode: jobCode,
            nodeName: '作业',
            nodeType: 'JOB',
            relatedJobCode: `e2e_job_${stamp}`,
            enabled: true,
          },
          { nodeCode: endCode, nodeName: '结束', nodeType: 'END', enabled: true },
        ],
        edges: [
          {
            fromNodeCode: startCode,
            toNodeCode: jobCode,
            edgeType: 'SUCCESS',
            enabled: true,
          },
          {
            fromNodeCode: jobCode,
            toNodeCode: endCode,
            edgeType: 'SUCCESS',
            enabled: true,
          },
        ],
      },
    })
    const createPayload = (await createResponse.json()) as {
      data?: { id?: number | string }
      id?: number | string
    }
    expect(createResponse.ok(), JSON.stringify(createPayload)).toBe(true)
    const workflowId = Number(createPayload.data?.id ?? createPayload.id)
    expect(Number.isFinite(workflowId), '创建工作流响应缺少 id').toBe(true)
    await page.goto(`/workflow/designer/${workflowId}`)
    await expect(page).toHaveURL(new RegExp(`/workflow/designer/${workflowId}$`), {
      timeout: 10_000,
    })

    // ── 画布渲染验证(修复后不再崩溃)──
    await expect(page.locator('.node-palette').first()).toBeVisible({ timeout: 12_000 })
    await expect(page.locator('.dag-canvas').first()).toBeVisible({ timeout: 8_000 })
    // 全屏设计器返回入口(B)
    await expect(page.getByRole('button', { name: /返回列表/ }).first()).toBeVisible()

    await expect(page.locator('.workflow-designer__banner--readonly')).toHaveCount(0)

    await expect.poll(() => mainCanvasNodeCount(page), { timeout: 12_000 }).toBe(3)
    const initialNodes = await mainCanvasNodeCount(page)

    // ── 自动布局:改节点坐标 → 图 dirty 但仍合法(借既有合法图,绕 JOB-jobCode 校验)──
    const autoLayoutBtn = page.getByRole('button', { name: '自动布局' }).first()
    await expect(autoLayoutBtn).toBeEnabled()
    await autoLayoutBtn.click()
    await page.waitForTimeout(800)

    const saveBtn = page.getByRole('button', { name: '保存' }).first()
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 })
    await saveBtn.click({ timeout: 15_000 })

    await expect(page.locator('.el-message--success').first()).toBeVisible({ timeout: 8_000 })

    // ── 刷新 → getFull 重渲染 → 节点数不变(持久化业务逻辑)──
    await page.reload()
    await expect(page.locator('.dag-canvas').first()).toBeVisible({ timeout: 12_000 })
    await expect(page.locator('.designer-node').first()).toBeVisible({ timeout: 8_000 })
    expect(await mainCanvasNodeCount(page)).toBe(initialNodes)
  })
})

async function mainCanvasNodeCount(page: import('@playwright/test').Page): Promise<number> {
  return await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('.dag-canvas .x6-node')).filter(
        (node) => !node.closest('.x6-widget-minimap'),
      ).length,
  )
}
