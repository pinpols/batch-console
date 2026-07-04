/**
 * 页面主操作按钮巡检 — 每个主列表页的工具栏主按钮「点了有反应」(非死按钮)。
 *
 * 覆盖安全、非破坏性的主操作:刷新(列表重载)/ 新建·新增(打开抽屉/弹窗后关闭,不提交)/
 * 搜索(触发查询)。catch 死按钮一类问题(如此前标签「新增」按钮 reactivity 不解锁那种)。
 *
 * 不点删除/提交/批量执行等破坏性操作(那些由各 CRUD spec 在受控数据上验)。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

type Pg = { path: string; title: string | RegExp; create?: RegExp; refresh?: boolean }
const PAGES: Pg[] = [
  { path: '/jobs/definitions', title: '作业定义', create: /新建作业|新增作业/, refresh: true },
  { path: '/jobs/pipelines', title: /流水线/, create: /新建|新增/, refresh: true },
  { path: '/governance/queues', title: /队列/, create: /新建|新增/, refresh: true },
  { path: '/governance/quota', title: /配额/, create: /新建|新增/, refresh: true },
  { path: '/system/api-keys', title: /API Key|密钥/, create: /新增 API Key|新建/, refresh: true },
  { path: '/system/parameters', title: /参数/, create: /新建|新增/, refresh: true },
  { path: '/system/triggers', title: /触发器|Trigger/, refresh: true },
  // 标签页刷新是 filter-gated(resourceType+编码齐备才查),空筛选下刷新是合法 no-op,不断言发请求
  { path: '/system/tags', title: '标签管理', refresh: false },
  { path: '/workers/management', title: /Worker/, refresh: true },
  { path: '/monitor/job-instances', title: /作业运行|实例|运行/, refresh: true },
  { path: '/observability/alerts', title: /告警/, refresh: true },
  { path: '/files/list', title: /文件/, refresh: true },
]

for (const pg of PAGES) {
  test.describe(`主操作按钮:${pg.path}`, () => {
    test.beforeEach(async ({ page }) => {
      await enterDemoApp(page)
      await page.goto(pg.path)
      await expectPageTitle(page, pg.title)
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    })

    test('刷新 → 触发列表重载', async ({ page }) => {
      if (pg.refresh === false) {
        test.skip(true, '该页刷新为 filter-gated,空筛选下合法 no-op')
        return
      }
      const refreshBtn = page
        .getByRole('button', { name: /^刷新$/ })
        .or(page.locator('button[aria-label*="刷新"], button[title*="刷新"]'))
        .first()
      if (!(await isVisible(refreshBtn, 3000))) {
        test.skip(true, '该页无刷新按钮')
        return
      }
      // 点刷新应发起一次 GET(列表 / 概览),用 response 监听断言"有反应"。
      const reqP = page
        .waitForResponse((r) => r.url().includes('/api/console/') && r.request().method() === 'GET', {
          timeout: 6000,
        })
        .catch(() => null)
      await refreshBtn.click()
      const resp = await reqP
      expect(resp, `${pg.path} 点刷新应发起后端请求`).not.toBeNull()
    })

    if (pg.create) {
      test('新建/新增 → 打开抽屉/弹窗(关闭,不提交)', async ({ page }) => {
        const createBtn = page.getByRole('button', { name: pg.create! }).first()
        if (!(await isVisible(createBtn, 3000))) {
          test.skip(true, '该页无新建按钮(权限/路由)')
          return
        }
        await createBtn.click()
        // 抽屉或弹窗应打开(.jdd = 作业定义新版三态右侧抽屉,非 el-drawer)
        const panel = page.locator('.el-drawer:visible, .el-dialog:visible, .jdd:visible').first()
        await expect(panel, `${pg.path} 点新建应打开抽屉/弹窗`).toBeVisible({ timeout: 5000 })
        // 关闭(Esc 或关闭按钮),不提交
        await page.keyboard.press('Escape')
        await expect(panel).toBeHidden({ timeout: 5000 }).catch(async () => {
          const closeBtn = panel.locator('.el-drawer__close-btn, .el-dialog__headerbtn, button:has-text("取消")').first()
          if (await isVisible(closeBtn, 1500)) await closeBtn.click()
        })
      })
    }
  })
}
