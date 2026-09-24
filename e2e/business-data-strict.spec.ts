import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

type StrictPage = {
  path: string
  title: string | RegExp
  listUrl: RegExp
  fields: string[]
}

const STRICT_PAGES: StrictPage[] = [
  {
    path: '/jobs/definitions',
    title: '作业定义',
    listUrl: /\/api\/console\/queries\/job-definitions\b/,
    fields: ['jobCode', 'jobName', 'queueCode'],
  },
  {
    path: '/files/list',
    title: '文件列表',
    listUrl: /\/api\/console\/queries\/files\b/,
    fields: ['fileName', 'bizType'],
  },
  {
    path: '/workflow/definitions',
    title: '工作流定义',
    listUrl: /\/api\/console\/queries\/workflow-definitions\b/,
    fields: ['workflowCode', 'workflowName'],
  },
  {
    path: '/monitor/job-instances',
    title: '作业运行',
    listUrl: /\/api\/console\/queries\/instances\b/,
    fields: ['jobCode', 'bizDate'],
  },
]

for (const pg of STRICT_PAGES) {
  test(`严格数据校验:${pg.path} — 首条业务字段来自当前 API 响应`, async ({ page, network }) => {
    await enterDemoApp(page)
    const responses: unknown[] = []

    page.on('response', async (resp) => {
      if (!pg.listUrl.test(resp.url())) return
      if (resp.request().method() !== 'GET' || resp.status() !== 200) return
      try {
        responses.push(await resp.json())
      } catch {
        /* non-json response is not a list candidate */
      }
    })

    await page.goto(pg.path)
    await expectPageTitle(page, pg.title)
    await expect
      .poll(() => responses.length, {
        message: `${pg.path} 应捕获到至少一条列表 API 响应`,
        timeout: 15000,
      })
      .toBeGreaterThan(0)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})

    const items = responses.flatMap((body) => {
      const data = (body as { data?: unknown })?.data ?? body
      return Array.isArray(data)
        ? data
        : (((data as { items?: unknown[]; records?: unknown[] })?.items ??
            (data as { items?: unknown[]; records?: unknown[] })?.records ??
            []) as unknown[])
    })

    if (items.length === 0) {
      test.skip(true, `${pg.path} 当前 API 返回空列表,跳过首行字段校验`)
      return
    }

    const visibleText = await page.locator('body').innerText()
    const matched = items.find((item) => {
      const row = item as Record<string, unknown>
      return pg.fields.every((field) => {
        const value = row[field]
        return value != null && value !== '' && visibleText.includes(String(value))
      })
    })

    expect(
      matched,
      `${pg.path} 可见页面中应至少有一条业务记录能和捕获到的 API items 按字段 ${pg.fields.join(
        ', ',
      )} 对齐`,
    ).toBeTruthy()

    network.assertClean(pg.path)
  })
}
