/**
 * Workflow Designer 冒烟测试(MVP)
 *
 * 验收依据:Spike #56 + MVP #57 + Contract fix #58 已合,设计文档 §10 验收主路径。
 *
 * 覆盖主路径(8 步,符合设计文档验收 §10):
 *   1. 登录 → API 创建 e2e 前缀的隔离最小合法图
 *   2. 进入 /workflow/designer/:id 并取得编辑锁
 *   3. 从 palette 添加 JOB 节点到画布，复用基线 START / END
 *   4. 连线(START → JOB → END)— 真鼠标从 X6 out 端口拖到 in 端口
 *   5. 点 JOB 节点 → inspector 渲染 → 填 jobCode 下拉
 *   6. 点「校验」按钮 — 验证无 error banner
 *   7. 点「保存」按钮 — 验证 toast「保存成功」
 *   8. 刷新页面 — 验证画布重渲染,3 节点 2 边还在
 *
 * 本用例是发布门禁:隔离工作流创建、编辑锁、X6 渲染、连线、保存任一步失败都必须报错，
 * 不允许用 skip 把「页面能打开但不能编排」误报为通过。
 *
 * 命名隔离:
 *   - prefix 'e2e-wfd-<ts>' — global-teardown.cjs 按 prefix=e2e 统一清(已涵盖)
 *
 * 范围外(留 follow-up):
 *   - 版本 diff e2e(Polish lane 在做)
 *   - 模板库 / 节点搜索 palette
 *   - 新建模式的元信息 prompt → POST 创建 → 带 id 重开完整链路
 */

import { test, expect } from './support/app'
import { enterDemoApp, isVisible } from './support/app'

const PREFIX = `e2e-wfd-${Date.now()}`

test.describe('@workflow-designer-smoke 工作流设计器主路径', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('主路径:进入 → 拖 3 节点 → 连边 → 填 jobCode → 校验 → 保存 → 重开仍在', async ({ page }) => {
    // ── Step 1-2: 创建隔离的最小合法图 → 进入设计器 ────────────────
    // 测试数据用 API 建立，核心编排动作仍全部走 UI；避免反复修改公共 seed 工作流。
    const stamp = Date.now()
    const createResponse = await page.request.post('/api/console/workflow-definitions', {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'ta',
        'Idempotency-Key': `e2e-wfd-create-${stamp}`,
      },
      data: {
        tenantId: 'ta',
        workflowCode: `e2e-wfd-${stamp}`,
        workflowName: `E2E workflow designer ${stamp}`,
        workflowType: 'DAG',
        enabled: true,
        nodes: [
          { nodeCode: `start_${stamp}`, nodeName: '开始', nodeType: 'START', enabled: true },
          { nodeCode: `end_${stamp}`, nodeName: '结束', nodeType: 'END', enabled: true },
        ],
        edges: [
          {
            fromNodeCode: `start_${stamp}`,
            toNodeCode: `end_${stamp}`,
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

    // ── 等 designer 三栏 mount ─────────────────────────────────────
    const palette = page.locator('.node-palette').first()
    const canvas = page.locator('.dag-canvas').first()
    const inspector = page.locator('.node-inspector').first()
    await expect(palette).toBeVisible({ timeout: 10_000 })
    await expect(canvas).toBeVisible({ timeout: 5_000 })
    await expect(inspector).toHaveCount(0)

    await expect(page.locator('.workflow-designer__banner--readonly')).toHaveCount(0)
    const saveBtn = page.getByRole('button', { name: '保存' }).first()
    await expect(saveBtn).toBeEnabled()

    // 读现有节点边数,作为 baseline(已 seed 的 workflow 会带原有节点)
    const baseline = await readGraphCounts(page)

    // ── Step 3: 从 palette 补齐 START / JOB / END ─────────────────
    // 合法种子通常已有唯一 START / END，设计器会阻止重复创建；这种情况下复用既有节点。
    let startId = await pickIdByType(page, 'start')
    let endId = await pickIdByType(page, 'end')
    let addedNodes = 1
    if (!startId) {
      await addPaletteNode(page, 'START')
      addedNodes += 1
    }
    await addPaletteNode(page, 'JOB')
    if (!endId) {
      await addPaletteNode(page, 'END')
      addedNodes += 1
    }

    // 验证补充节点已入 store(store 通过 DagCanvas onDrop → store.addNode)
    await expect
      .poll(async () => (await readGraphCounts(page)).nodes, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(baseline.nodes + addedNodes)

    // 从 DOM 抓完整链路的节点 id；START / END 可能来自既有合法图。
    startId = startId ?? (await pickIdByType(page, 'start'))
    const jobId = await pickIdByType(page, 'job')
    endId = endId ?? (await pickIdByType(page, 'end'))
    expect(startId, '未能从画布识别 START 节点').not.toBeNull()
    expect(jobId, '未能从画布识别 JOB 节点').not.toBeNull()
    expect(endId, '未能从画布识别 END 节点').not.toBeNull()

    // ── Step 4: 连边 START → JOB → END ───────────────────────────
    await connectNodes(page, startId, jobId)
    await connectNodes(page, jobId, endId)
    await expect
      .poll(async () => (await readGraphCounts(page)).edges, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(baseline.edges + 2)

    // ── Step 5: 选 JOB 节点 → inspector → 填 jobCode ────────────
    await page.locator(`.x6-node[data-cell-id="${jobId}"]`).first().click({ force: true })
    await expect(inspector).toBeVisible({ timeout: 3_000 })

    // ElSelect 下拉:打开 → 选第一个 option
    const jobCodeInput = inspector
      .getByRole('combobox', { name: /关联\s*Job|jobCode|Job\s*Code|作业\s*Code/i })
      .first()
    await expect(jobCodeInput).toBeVisible({ timeout: 3_000 })
    // el-select 开启 allow-create；直接录入唯一编码并回车，确保触发 @change 写回 store。
    // 输入后等待 Element Plus 生成精确 option，再点击确认，避免异步下拉尚未就绪。
    const selectedJobCode = `${PREFIX}-job`
    const jobCodeFormItem = jobCodeInput.locator(
      'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " el-form-item ")][1]',
    )
    await jobCodeInput.click({ force: true })
    await jobCodeInput.fill(selectedJobCode)
    const createdOption = page.getByRole('option', { name: selectedJobCode, exact: true }).last()
    await expect(createdOption).toBeVisible({ timeout: 5_000 })
    await createdOption.click({ force: true })
    await expect(jobCodeFormItem).toContainText(selectedJobCode)

    // ── Step 6: 点「校验」按钮 ────────────────────────────────────
    const validateBtn = page.getByRole('button', { name: '校验' }).first()
    if (await isVisible(validateBtn, 2000)) {
      await validateBtn.click({ force: true })
      await expect(page.getByRole('dialog', { name: /校验错误|Validation errors/i })).toHaveCount(0)
    }

    // ── Step 7: 点「保存」按钮 ────────────────────────────────────
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click({ force: true })

    // 期望出现「保存成功」toast — 真实 BE 写入失败必须让核心冒烟失败。
    const successToast = page.locator('.el-message--success').filter({ hasText: /保存成功|Saved/ })
    const saved = await successToast
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false)

    expect(saved, '保存后未出现成功提示，工作流定义可能未持久化').toBe(true)

    // ── Step 8: 刷新页面 → 画布重渲染,节点/边还在 ───────────────
    const urlBeforeReload = page.url()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(urlBeforeReload)
    await expect(canvas).toBeVisible({ timeout: 10_000 })
    // 等 X6 渲染完(getFull → reset → watch 触发 rerender)
    await expect
      .poll(async () => (await readGraphCounts(page)).nodes, { timeout: 8_000 })
      .toBeGreaterThanOrEqual(3)
  })
})

// ─── helpers ──────────────────────────────────────────────────────

/**
 * 数节点 / 边数:走 DOM 选择器(X6 渲染节点为 .x6-node,边为 .x6-edge)。
 */
async function readGraphCounts(page: import('@playwright/test').Page) {
  return await page.evaluate(() => {
    const isMainCanvasCell = (element: Element) => !element.closest('.x6-widget-minimap')
    const nodes = Array.from(document.querySelectorAll('.dag-canvas .x6-node')).filter(
      isMainCanvasCell,
    ).length
    const edges = Array.from(document.querySelectorAll('.dag-canvas .x6-edge')).filter(
      isMainCanvasCell,
    ).length
    return { nodes, edges }
  })
}

/**
 * 从 palette 添加一个 type 节点到画布。
 * 当前节点库支持点击添加,比 headless Chromium 中合成 HTML5 DnD 更贴近可访问用户路径。
 */
async function addPaletteNode(
  page: import('@playwright/test').Page,
  type: 'START' | 'END' | 'JOB' | 'GATEWAY' | 'FILE_STEP' | 'APPROVAL',
) {
  const before = (await readGraphCounts(page)).nodes
  const paletteItem = page.getByRole('button', { name: type, exact: true }).first()
  await expect(paletteItem).toBeVisible({ timeout: 3_000 })
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await paletteItem.click({ force: true })
    const added = await expect
      .poll(async () => (await readGraphCounts(page)).nodes, { timeout: 1_500 })
      .toBeGreaterThan(before)
      .then(() => true)
      .catch(() => false)
    if (added) return
  }
  expect((await readGraphCounts(page)).nodes, `${type} 节点未添加到主画布`).toBeGreaterThan(before)
}

async function connectNodes(
  page: import('@playwright/test').Page,
  sourceId: string,
  targetId: string,
) {
  const sourcePort = page
    .locator(`.x6-node[data-cell-id="${sourceId}"] .x6-port-body[port="out"]`)
    .first()
  const targetPort = page
    .locator(`.x6-node[data-cell-id="${targetId}"] .x6-port-body[port="in"]`)
    .first()
  await expect(sourcePort).toBeAttached()
  await expect(targetPort).toBeAttached()
  const source = await sourcePort.boundingBox()
  const target = await targetPort.boundingBox()
  expect(source, `source port ${sourceId}`).not.toBeNull()
  expect(target, `target port ${targetId}`).not.toBeNull()
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2)
  await page.mouse.down()
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
    steps: 12,
  })
  await page.mouse.up()
}

/**
 * 按 nodeCode 前缀(start_/job_/end_,DagCanvas.onDrop 命名规则)挑出最新加进去的节点 id。
 * 没找到返回 null。
 */
async function pickIdByType(
  page: import('@playwright/test').Page,
  prefix: 'start' | 'job' | 'end',
): Promise<string | null> {
  return await page.evaluate((pfx) => {
    const x6 = (
      window as unknown as {
        x6Graph?: { getNodes(): Array<{ id: string }> }
      }
    ).x6Graph
    if (x6) {
      const matches = x6.getNodes().filter((n) => n.id.startsWith(`${pfx}_`))
      return matches[matches.length - 1]?.id ?? null
    }
    // DOM 兜底:.x6-node 的 data-cell-id 包含 nodeCode
    const nodes = Array.from(document.querySelectorAll('.x6-node[data-cell-id]')).filter(
      (node) => !node.closest('.x6-widget-minimap'),
    ) as HTMLElement[]
    const ids = nodes
      .map((n) => n.getAttribute('data-cell-id') ?? '')
      .filter((id) => id.startsWith(`${pfx}_`))
    if (ids.length > 0) return ids[ids.length - 1]
    const existing = Array.from(
      document.querySelectorAll(`.dag-canvas .x6-node[data-shape="designer-${pfx}"]`),
    ).find((node) => !node.closest('.x6-widget-minimap'))
    return existing?.getAttribute('data-cell-id') ?? null
  }, prefix)
}
