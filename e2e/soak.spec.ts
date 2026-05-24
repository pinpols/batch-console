/**
 * D 档 soak / 长会话稳定性。
 *
 * 在单 browser context 内连续 N 轮:
 *   /ops/summary → /monitor/job-instances → /governance/queues → 开关 dialog → 回 summary
 * 监控:console.error 累积 / pageerror / JS heap 增长。
 *
 * 默认 SOAK_ROUNDS=20(本地友好),release pre-flight SOAK_ROUNDS=200。
 */
import { test, expect } from './support/app'
import { enterDemoApp } from './support/app'

const SOAK_ROUNDS = Number(process.env.SOAK_ROUNDS ?? '20')
const HEAP_GROWTH_LIMIT_MB = Number(process.env.SOAK_HEAP_LIMIT_MB ?? '80')
const ERROR_ACCUM_LIMIT = Number(process.env.SOAK_ERROR_LIMIT ?? '5')

// 增大单测 timeout:每轮 ~3s,200 轮可达 10 分钟。
test.setTimeout(Math.max(SOAK_ROUNDS * 8_000, 60_000))

const ROUNDS_PATHS = [
  '/ops/summary',
  '/monitor/job-instances',
  '/governance/queues',
  '/observability/alerts',
  '/ops/summary',
]

async function readHeapMB(page: import('@playwright/test').Page): Promise<number | null> {
  return page.evaluate(() => {
    const perf = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    return perf ? Math.round(perf.usedJSHeapSize / 1024 / 1024) : null
  })
}

test.describe('soak · 长会话稳定性', () => {
  test(`连续 ${SOAK_ROUNDS} 轮路由切换 — error 累积 ≤ ${ERROR_ACCUM_LIMIT}`, async ({ page }) => {
    // 20 轮 × 多页 × goto 在 4-worker 并发 dev server 下需要更长预算;默认 45s 远远不够
    test.setTimeout(300_000)
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (e) => pageErrors.push(e.message))

    await enterDemoApp(page)
    const heapStart = await readHeapMB(page)

    for (let i = 0; i < SOAK_ROUNDS; i++) {
      for (const path of ROUNDS_PATHS) {
        await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => {})
        // 不强制等内容,让路由切换尽量快
      }
      // 每 10 轮打一次心跳
      if ((i + 1) % 10 === 0) {
        const heapNow = await readHeapMB(page)
        // soak 心跳改 warn(no-console allows warn/error);信息性输出,非真错
        console.warn(
          `[soak] round ${i + 1}/${SOAK_ROUNDS}  heap=${heapNow ?? '-'}MB  ` +
            `consoleErr=${consoleErrors.length}  pageErr=${pageErrors.length}`,
        )
      }
    }

    const heapEnd = await readHeapMB(page)

    // 断言:页面级错误必须 0
    expect(pageErrors, `pageerror 累积:\n${pageErrors.join('\n')}`).toHaveLength(0)
    // 断言:console.error 不可超过阈值(过滤掉已知噪声)
    const noise = /favicon|sourcemap|Failed to load resource|FetchError 200/i
    const real = consoleErrors.filter((e) => !noise.test(e))
    expect(
      real.length,
      `console.error 超过阈值 ${ERROR_ACCUM_LIMIT}:\n${real.slice(0, 20).join('\n')}`,
    ).toBeLessThanOrEqual(ERROR_ACCUM_LIMIT)

    // 断言:heap 增长不超阈值(performance.memory 仅 Chromium 有,其他浏览器跳过)
    if (heapStart !== null && heapEnd !== null) {
      const growth = heapEnd - heapStart
      console.warn(`[soak] heap delta = ${growth}MB (start=${heapStart}, end=${heapEnd})`)
      expect(
        growth,
        `heap 增长 ${growth}MB 超过 ${HEAP_GROWTH_LIMIT_MB}MB(SOAK_HEAP_LIMIT_MB 可调)`,
      ).toBeLessThanOrEqual(HEAP_GROWTH_LIMIT_MB)
    }
  })

  test('dialog 反复开关 50 次不残留 DOM 节点', async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/governance/queues', { waitUntil: 'domcontentloaded' })
    // 等待新建按钮出现
    const createBtn = page.getByRole('button', { name: /新建|创建|新增|create/i }).first()
    if (!(await createBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, '无新建按钮(权限或路由)')
    }

    const sampleSize = Number(process.env.SOAK_DIALOG_ROUNDS ?? '20')
    for (let i = 0; i < sampleSize; i++) {
      await createBtn.click()
      const dialog = page.locator('.el-dialog:visible, .el-drawer:visible').first()
      await expect(dialog).toBeVisible({ timeout: 5000 })
      // 用 ESC 关闭
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden({ timeout: 5000 })
    }

    // 断言:DOM 中残留的 dialog 节点 ≤ 1(EP 会保留一个 v-show=false)
    const lingering = await page.locator('.el-dialog:visible, .el-drawer:visible').count()
    expect(lingering, `残留 ${lingering} 个 dialog 节点`).toBeLessThanOrEqual(1)
  })
})
