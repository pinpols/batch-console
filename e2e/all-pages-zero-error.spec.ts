/**
 * 全页面零服务端错误巡检 — D 档 C 任务核心:
 * 把 src/views 下所有路由级页面挨个进一遍,网络层断言每个页面**没有未忽略的 4xx/5xx**。
 * 单页失败不影响其他页面(每页独立 test,失败时 network.log 自动落盘到 test-results/)。
 *
 * 与 smoke.spec.ts 的差别:
 *   - smoke 只断言 page-header / URL,不看网络
 *   - 本 spec 是 network watchdog 全程开,assertClean 兜底
 *   - 包含 list + 详情(若可点)的两段巡检
 */
import { expect, test } from './support/app'
import { enterDemoApp, isVisible, expectPageTitle } from './support/app'

type PageCheck = {
  path: string
  title: string | RegExp
  /** 详情链(若 list 有数据,点第一条进详情) */
  drillFirstRow?: boolean
  /** tab 切换 */
  tabs?: (string | RegExp)[]
  /** 该页面已知/允许的服务端错误 URL 子串(白名单) */
  allowErrors?: (string | RegExp)[]
}

const PAGES: PageCheck[] = [
  // 工作台
  { path: '/ops/summary', title: '控制面板' },
  { path: '/ops/diagnostic', title: '运维诊断', tabs: [/SLO/, /分布/, /趋势/] },
  { path: '/approvals', title: '审批中心', tabs: [/补登/, /通用/] },
  { path: '/reports', title: '报表中心' },
  { path: '/self-service', title: '自助服务' },
  // 配置 / 发布
  { path: '/config/releases', title: '发布管理' },
  { path: '/config/management', title: '变更与同步' },
  { path: '/config/tenant-package', title: '配置批量导入' },
  { path: '/system/tags', title: '标签管理' },
  // 文件中心
  { path: '/files/list', title: '文件列表', drillFirstRow: true },
  { path: '/files/templates', title: '文件模板' },
  { path: '/files/arrival-groups', title: '到达组治理' },
  { path: '/files/pipeline-obs', title: '流水线观测' },
  // 定义
  { path: '/jobs/definitions', title: '作业定义', drillFirstRow: true },
  { path: '/workflow/definitions', title: '工作流定义', drillFirstRow: true },
  // Runs
  { path: '/runs', title: '全部运行' },
  { path: '/monitor/job-instances', title: '作业运行', drillFirstRow: true },
  { path: '/monitor/job-steps', title: '作业步骤' },
  { path: '/monitor/workflow-runs', title: '工作流运行', drillFirstRow: true },
  // 观测
  { path: '/observability/alerts', title: /事件告警|告警/ },
  { path: '/observability/audits', title: '审计日志' },
  { path: '/observability/outbox', title: 'Outbox' },
  { path: '/observability/queries', title: '综合查询' },
  { path: '/system/event-catalog', title: '事件目录' },
  // 调度 / 治理
  { path: '/governance/quota', title: /配额策略|租户配额/ },
  { path: '/governance/queues', title: /队列/ },
  { path: '/workers/management', title: 'Worker' },
  { path: '/system/triggers', title: '触发器' },
  // 系统
  { path: '/system/tenants', title: '租户实例' },
  { path: '/system/user-accounts', title: '登录账户' },
  { path: '/system/users', title: '权限自查' },
  { path: '/system/api-keys', title: 'API Key' },
  { path: '/system/parameters', title: '系统参数' },
  { path: '/system/notifications', title: '通知与投递', tabs: [/规则/, /渠道/, /Webhook/, /投递/] },
]

test.describe('@cross-browser 全页面零 4xx/5xx 巡检', () => {
  // 这些页面 list+drill+tab 多轮串行,默认 25s 不够;按页 60s 兜底
  test.describe.configure({ timeout: 60_000 })
  for (const target of PAGES) {
    test(`无服务端错误: ${target.path}`, async ({ page, network }) => {
      for (const u of target.allowErrors ?? []) network.ignore(u)
      // 跨多个测试同时跑时,主页面去往新 path 有时间 race;允许全局忽略 ConsoleSession 的 SSE 心跳
      network.ignore(/\/notifications\/sse\b/)

      await enterDemoApp(page)
      await page.goto(target.path, { waitUntil: 'domcontentloaded' })
      await expectPageTitle(page, target.title)
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

      // 切 tab
      for (const tabName of target.tabs ?? []) {
        const tab = page.getByRole('tab', { name: tabName }).first()
        if (await isVisible(tab, 1500)) {
          await tab.click({ force: true }).catch(() => {})
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
        }
      }

      // 翻页(若有)
      const next = page.locator('.el-pagination .btn-next').first()
      if (await isVisible(next, 1000)) {
        const disabled = await next.getAttribute('disabled')
        if (disabled === null) {
          await next.click({ force: true }).catch(() => {})
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
        }
      }

      // 点详情(若启用)
      if (target.drillFirstRow) {
        const link = page.locator('.cell-link, a.el-link').first()
        if (await isVisible(link, 1500)) {
          await link.click({ force: true }).catch(() => {})
          await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
          // 等待详情挂载 — 1s 缓冲,容忍 detail 内联请求
          await page.waitForTimeout(800)
        }
      }

      network.assertClean(target.path)
    })
  }
})

/**
 * /system/ai-chat 不在本巡检 — 用户明确要求排除 AI 那个。
 */
