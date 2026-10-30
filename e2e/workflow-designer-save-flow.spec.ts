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

import { csrfHeaders, test, expect } from './support/app'
import { enterDemoApp } from './support/app'

test.describe('@workflow-designer-save 工作流设计器保存流', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('进入 → 自动布局改图 → 保存 → 刷新后节点仍在', async ({ page }) => {
    const stamp = Date.now()
    const startCode = `start_${stamp}`
    const jobCode = `job_${stamp}`
    const jobDefinitionCode = `e2e-job-${stamp}`
    const endCode = `end_${stamp}`
    const jobResponse = await page.request.post('/api/console/job-definitions', {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'ta',
        'Idempotency-Key': `e2e-wfd-save-job-${stamp}`,
        ...(await csrfHeaders(page.request)),
      },
      data: {
        tenantId: 'ta',
        jobCode: jobDefinitionCode,
        jobName: `E2E workflow save job ${stamp}`,
        jobType: 'GENERAL',
        scheduleType: 'MANUAL',
        enabled: true,
      },
    })
    const jobPayload = (await jobResponse.json()) as { data?: unknown; code?: string }
    expect(jobResponse.ok(), JSON.stringify(jobPayload)).toBe(true)

    const createResponse = await page.request.post('/api/console/workflow-definitions', {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'ta',
        'Idempotency-Key': `e2e-wfd-save-create-${stamp}`,
        ...(await csrfHeaders(page.request)),
      },
      data: {
        tenantId: 'ta',
        workflowCode: `e2e-wfd-save-${stamp}`,
        workflowName: `E2E workflow save ${stamp}`,
        workflowType: 'DAG',
        enabled: true,
        nodes: [
          { nodeCode: startCode, nodeName: '开始', nodeType: 'START', enabled: true },
          {
            nodeCode: jobCode,
            nodeName: '作业',
            nodeType: 'JOB',
            relatedJobCode: jobDefinitionCode,
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

    // ── 属性编辑 + 撤销:画布、表单和 dirty 状态必须同步恢复 ──
    await page.locator(`.dag-canvas .x6-node[data-cell-id="${jobCode}"]`).first().click()
    const nodeNameInput = page.getByRole('textbox', { name: '节点名称' }).first()
    await expect(nodeNameInput).toHaveValue('作业')
    await nodeNameInput.fill('作业-验收修改')
    await nodeNameInput.blur()
    await expect(page.getByText('未保存', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '撤销' }).first().click()
    await expect(nodeNameInput).toHaveValue('作业')
    await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)

    // ── 自动布局:校验节点仍在画布且连线保留;已布局图允许布局操作无变更 ──
    const autoLayoutBtn = page.getByRole('button', { name: '自动布局' }).first()
    await expect(autoLayoutBtn).toBeEnabled()
    await autoLayoutBtn.click()
    await expectNodesInsideCanvas(page)
    await expectEdgesRendered(page, 2)

    // 用确定会产生变化的名称编辑验证撤销/重做,避免依赖自动布局是否改变已布局图坐标。
    await page.locator(`.dag-canvas .x6-node[data-cell-id="${jobCode}"]`).first().click({ force: true })
    await nodeNameInput.fill('作业-保存验收')
    await nodeNameInput.blur()
    await expect(page.getByText('未保存', { exact: true })).toBeVisible()
    const undoBtn = page.getByRole('button', { name: '撤销' }).first()
    const redoBtn = page.getByRole('button', { name: '重做' }).first()
    await undoBtn.click()
    await expect(nodeNameInput).toHaveValue('作业')
    await expect(page.getByText('未保存', { exact: true })).toHaveCount(0)
    await expectNodesInsideCanvas(page)
    await expectEdgesRendered(page, 2)
    await redoBtn.click()
    await expect(nodeNameInput).toHaveValue('作业-保存验收')
    await expect(page.getByText('未保存', { exact: true })).toBeVisible()
    await expectNodesInsideCanvas(page)
    await expectEdgesRendered(page, 2)

    // ── 连线语义:依赖方向可读,CONDITION 表达式可编辑并参与保存 ──
    const firstEdgeId = `e_${startCode}_${jobCode}_0`
    if ((await page.locator('.node-inspector').count()) === 0) {
      await page.getByRole('button', { name: '打开属性面板' }).click()
    }
    await page.getByRole('combobox', { name: '依赖连线选择器' }).click()
    await page.getByRole('option', { name: new RegExp(`${startCode}.*${jobCode}.*成功`) }).click()
    await expect(
      page.locator('.edge-inspector .el-select').nth(0).locator('.el-select__placeholder'),
    ).toContainText(`开始 (${startCode})`)
    await expect(
      page.locator('.edge-inspector .el-select').nth(1).locator('.el-select__placeholder'),
    ).toContainText(`作业-保存验收 (${jobCode})`)

    await page.locator('.edge-inspector .el-select').nth(2).click()
    await page.getByRole('option', { name: /条件.*CONDITION/ }).click()
    const conditionExpr = page.locator('.node-inspector textarea').first()
    await expect(conditionExpr).toBeVisible()
    await expect(page.getByText(/必须配置表达式/)).toBeVisible()
    await conditionExpr.fill('amount > 1000')
    await conditionExpr.blur()
    await expect(page.getByText(/必须配置表达式/)).toHaveCount(0)
    await expect(
      page.locator('.dag-canvas__graph .x6-edge-label').filter({ hasText: 'CONDITION' }),
    ).toBeVisible()

    const saveBtn = page.getByRole('button', { name: '保存' }).first()
    await expect(saveBtn).toBeEnabled({ timeout: 5_000 })
    await saveBtn.click({ timeout: 15_000 })

    await expect(page.locator('.el-message--success').first()).toBeVisible({ timeout: 8_000 })

    // ── 刷新 → getFull 重渲染 → 节点数不变(持久化业务逻辑)──
    await page.reload()
    await expect(page.locator('.dag-canvas').first()).toBeVisible({ timeout: 12_000 })
    await expect(page.locator('.designer-node').first()).toBeVisible({ timeout: 8_000 })
    expect(await mainCanvasNodeCount(page)).toBe(initialNodes)
    await page.locator('.node-search input').fill(jobCode)
    await page.getByRole('option', { name: new RegExp(jobCode) }).click()
    await expect(nodeNameInput).toHaveValue('作业-保存验收')

    await expect(
      page.locator(`.dag-canvas__graph .x6-edge[data-cell-id="${firstEdgeId}"] .x6-edge-label`),
    ).toContainText('CONDITION · amount > 1000')

    if ((await page.locator('.node-inspector').count()) === 0) {
      await page.getByRole('button', { name: '打开属性面板' }).click()
    }
    await page.getByRole('combobox', { name: '依赖连线选择器' }).click()
    await page.getByRole('option', { name: new RegExp(`${startCode}.*${jobCode}.*条件`) }).click()
    await expect(
      page.locator('.edge-inspector .el-select').nth(2).locator('.el-select__placeholder'),
    ).toContainText('CONDITION')
    await expect(page.locator('.edge-inspector textarea').first()).toHaveValue('amount > 1000')

    const persistedResponse = await page.request.get(
      `/api/console/workflow-definitions/${workflowId}?tenantId=ta`,
      { headers: { 'X-Tenant-Id': 'ta' } },
    )
    const persistedPayload = (await persistedResponse.json()) as {
      data?: { edges?: Array<Record<string, unknown>> }
      edges?: Array<Record<string, unknown>>
    }
    expect(persistedResponse.ok(), JSON.stringify(persistedPayload)).toBe(true)
    const persistedEdges = persistedPayload.data?.edges ?? persistedPayload.edges ?? []
    expect(persistedEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromNodeCode: startCode,
          toNodeCode: jobCode,
          edgeType: 'CONDITION',
          conditionExpr: 'amount > 1000',
          enabled: true,
        }),
      ]),
    )
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

async function expectNodesInsideCanvas(page: import('@playwright/test').Page) {
  const currentLayout = () => page.evaluate(() => {
    const canvas = document.querySelector('.dag-canvas__graph')?.getBoundingClientRect()
    const nodes = Array.from(document.querySelectorAll('.dag-canvas__graph .x6-node'))
      .filter((node) => !node.closest('.x6-widget-minimap'))
      .map((node) => node.getBoundingClientRect())
    if (!canvas) return { canvas: false, outside: nodes.length }
    const tolerance = 2
    const outside = nodes.filter(
      (node) =>
        node.left < canvas.left - tolerance ||
        node.top < canvas.top - tolerance ||
        node.right > canvas.right + tolerance ||
        node.bottom > canvas.bottom + tolerance,
    ).length
    return { canvas: true, outside }
  })
  await expect.poll(currentLayout, { message: '画布存在且自动布局节点均在画布内' }).toEqual({ canvas: true, outside: 0 })
}

async function expectEdgesRendered(page: import('@playwright/test').Page, expected: number) {
  const renderedEdgeCount = () => page.evaluate(() => {
    const canvas = document.querySelector('.dag-canvas__graph')?.getBoundingClientRect()
    if (!canvas) return 0
    return Array.from(document.querySelectorAll('.dag-canvas__graph .x6-edge')).filter((edge) => {
      if (edge.closest('.x6-widget-minimap')) return false
      return Array.from(edge.querySelectorAll('path')).some((path) => {
        const style = window.getComputedStyle(path)
        const length = typeof path.getTotalLength === 'function' ? path.getTotalLength() : 0
        const bounds = path.getBoundingClientRect()
        const intersectsCanvas =
          bounds.right >= canvas.left &&
          bounds.left <= canvas.right &&
          bounds.bottom >= canvas.top &&
          bounds.top <= canvas.bottom
        return (
          style.stroke !== 'none' &&
          style.stroke !== 'transparent' &&
          length > 0 &&
          intersectsCanvas
        )
      })
    }).length
  })
  await expect.poll(renderedEdgeCount, { message: '自动布局后连线实际渲染' }).toBe(expected)
}
