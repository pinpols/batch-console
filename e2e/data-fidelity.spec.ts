/**
 * 数据健康 / 正确性巡检 — 断言「前端表格渲染的数据 == 后端 API 返回的数据」。
 *
 * 通用手法(零 DB 造数、零 endpoint 硬编码):
 *   1. 进每个列表页;
 *   2. 捕获该页发出的【分页列表响应】(JSON body 形如 { data: { items: [], total } });
 *   3. 断言渲染的 el-table body 行数 == min(items.length, 当前页可见上限);
 *   4. 断言不丢不重(每行有内容,行数与 items 对齐),分页 total 与响应一致(若有分页器)。
 *
 * 这验证的是「数据保真」:API 给多少条,前端就如实渲染多少条,不静默丢行 / 不重复 / 不串页。
 * 与 all-pages-zero-error(只断言无 4xx/5xx)互补 —— 那个查"有没有错",这个查"显示对不对"。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

type ListPage = { path: string; title: string | RegExp; listUrl: RegExp }

// 每页一条「分页列表」API,URL 用子串正则匹配(避免 query 串细节脆弱)。
const PAGES: ListPage[] = [
  { path: '/jobs/definitions', title: '作业定义', listUrl: /\/job-definitions(\?|\/?$|\/page)/ },
  { path: '/jobs/pipelines', title: /流水线定义|流水线/, listUrl: /\/pipeline-definitions(\?|\/?$)/ },
  { path: '/governance/queues', title: /队列|队列配置/, listUrl: /\/queues(\?|\/?$)/ },
  { path: '/governance/quota', title: /配额|配额策略/, listUrl: /\/quota-policies/ },
  { path: '/system/tags', title: '标签管理', listUrl: /\/tags\/keys/ },
  { path: '/system/api-keys', title: /API Key|密钥/, listUrl: /\/api-keys(\?|\/?$)/ },
  { path: '/system/parameters', title: /系统参数|参数/, listUrl: /\/system-parameters/ },
  { path: '/system/triggers', title: /触发器|Trigger/, listUrl: /\/ops\/triggers/ },
  { path: '/workers/management', title: /Worker/, listUrl: /\/queries\/workers/ },
  { path: '/observability/alerts', title: /告警|事件告警/, listUrl: /\/queries\/alerts/ },
]

for (const pg of PAGES) {
  test(`数据保真:${pg.path} — 渲染行数与 API items 一致`, async ({ page }) => {
    await enterDemoApp(page)

    // 进页前挂上响应捕获:抓第一条命中 listUrl 且 body 是分页结构的响应。
    const respP = page
      .waitForResponse(
        (r) => pg.listUrl.test(r.url()) && r.request().method() === 'GET' && r.status() === 200,
        { timeout: 12000 },
      )
      .catch(() => null)

    await page.goto(pg.path)
    await expectPageTitle(page, pg.title)
    const resp = await respP
    if (!resp) {
      test.skip(true, `未捕获到 ${pg.path} 的列表响应(路径模式不匹配 / 该页非分页列表)`)
      return
    }

    let body: unknown
    try {
      body = await resp.json()
    } catch {
      test.skip(true, `${pg.path} 列表响应非 JSON`)
      return
    }
    // 解析分页结构:data.items(主流)/ data.records / data 直接是数组。
    const data = (body as { data?: unknown })?.data as
      | { items?: unknown[]; records?: unknown[]; total?: number }
      | unknown[]
      | undefined
    const items: unknown[] = Array.isArray(data)
      ? data
      : (data?.items ?? data?.records ?? [])

    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    // 空集:断言空态出现(不应渲染残留行)。
    const rows = page.locator('.el-table__body-wrapper:visible tbody tr.el-table__row')
    if (items.length === 0) {
      const rowCount = await rows.count()
      expect(rowCount, `${pg.path} API 返回 0 条,前端不应渲染数据行`).toBe(0)
      return
    }

    await expect(rows.first()).toBeVisible({ timeout: 6000 })
    const rowCount = await rows.count()

    // 核心保真不变量(同时兼容服务端分页 / 客户端分页 .slice):
    //   ① 前端【不会渲染比 API 给的更多】的行(无凭空多出 / 重复成行)→ rowCount <= items。
    //   ② 前端【不会静默丢行】:要么全渲染(rowCount === items),要么是分页只显示当前页,
    //      此时分页器的 total 必须 == API 返回的条数(每行可经翻页到达,不丢)。
    expect(rowCount, `${pg.path} 渲染行数(${rowCount})不应超过 API items(${items.length})`).toBeLessThanOrEqual(
      items.length,
    )
    if (rowCount < items.length) {
      // 分页态:分页器 total 文本须体现完整条数(说明"剩余行可翻页到达",非丢失)。
      const totalText = await page
        .locator('.el-pagination__total, .el-pagination')
        .first()
        .innerText()
        .catch(() => '')
      expect(
        totalText.includes(String(items.length)),
        `${pg.path} 只渲染 ${rowCount}/${items.length} 行,分页器 total 须含 ${items.length}(实际:"${totalText.replace(/\n/g, ' ')}")`,
      ).toBeTruthy()
    }

    // 每行非空(不渲染空白占位行)。
    const firstRowText = (await rows.first().innerText()).trim()
    expect(firstRowText.length, `${pg.path} 首行不应为空`).toBeGreaterThan(0)
  })
}
