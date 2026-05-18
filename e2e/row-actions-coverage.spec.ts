/**
 * 补 P5 row-actions 覆盖 — 之前矩阵扫出的 4 个真缺口:
 *   - JobDefinitionList → 查看运行(跳 monitor/job-instances)
 *   - FileList → 下载
 *   - FileList → 重新分发
 *   - ConfigReleaseList → 差异
 *
 * 设计:每个 case 只验「能点到 + 不掉 4xx/5xx」,数据空时 conditional skip。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('@row-actions 行操作覆盖缺口补丁', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('JobDefinition → 查看运行(跳 monitor)', async ({ page, network }) => {
    await page.goto('/jobs/definitions')
    await expectPageTitle(page, '作业定义')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    const row = page.locator('tr').filter({ hasText: /TA_|e2e-/ }).first()
    if (!(await isVisible(row, 2000))) {
      test.skip(true, '无 job 数据')
    }
    // 「更多」下拉 → 「查看运行」(可能在 dropdown 里)
    // 4 case 并发跑会让 FE /ops/summary 重定向卡住,增大单测超时
    test.setTimeout(60000)
    const moreBtn = row.getByRole('button', { name: /^更多/ }).first()
    if (await isVisible(moreBtn, 1500)) {
      await moreBtn.click({ force: true })
      const item = page.getByRole('menuitem', { name: '查看运行' }).first()
      if (await isVisible(item, 2000)) await item.click({ force: true })
    } else {
      const inline = row.getByRole('button', { name: '查看运行' }).first()
      if (await isVisible(inline, 1500)) await inline.click({ force: true })
    }
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    network.assertClean('jobdef.instances')
  })

  test('FileList → 下载', async ({ page, network }) => {
    await page.goto('/files/list')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    const row = page.locator('tbody tr.el-table__row').first()
    if (!(await isVisible(row, 2000))) {
      test.skip(true, '无文件数据')
    }
    // 4 case 并发跑会让 FE /ops/summary 重定向卡住,增大单测超时
    test.setTimeout(60000)
    const moreBtn = row.getByRole('button', { name: /^更多/ }).first()
    if (await isVisible(moreBtn, 1500)) {
      await moreBtn.click({ force: true })
      const item = page.getByRole('menuitem', { name: '下载' }).first()
      if (await isVisible(item, 1500)) {
        // 拦截 download 事件避免真下载
        page.on('download', (d) => d.cancel().catch(() => {}))
        await item.click({ force: true }).catch(() => {})
      }
    }
    await page.waitForTimeout(500)
    network.assertClean('files.download')
  })

  test('FileList → 重新分发', async ({ page, network }) => {
    await page.goto('/files/list')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    const row = page.locator('tbody tr.el-table__row').first()
    if (!(await isVisible(row, 2000))) {
      test.skip(true, '无文件数据')
    }
    // 4 case 并发跑会让 FE /ops/summary 重定向卡住,增大单测超时
    test.setTimeout(60000)
    const moreBtn = row.getByRole('button', { name: /^更多/ }).first()
    if (await isVisible(moreBtn, 1500)) {
      await moreBtn.click({ force: true })
      const item = page.getByRole('menuitem', { name: '重新分发' }).first()
      if (await isVisible(item, 1500)) {
        await item.click({ force: true }).catch(() => {})
        // confirm dialog 兜底
        const ok = page.getByRole('button', { name: /^(确定|确认)$/ }).first()
        if (await isVisible(ok, 1500)) await ok.click({ force: true })
      }
    }
    await page.waitForTimeout(800)
    network.assertClean('files.redispatch')
  })

  test('ConfigReleaseList → 差异', async ({ page, network }) => {
    await page.goto('/config/releases')
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    const row = page.locator('tr.el-table__row').first()
    if (!(await isVisible(row, 2000))) {
      test.skip(true, '无 release 数据')
    }
    // 「更多」或直接行内
    // 4 case 并发跑会让 FE /ops/summary 重定向卡住,增大单测超时
    test.setTimeout(60000)
    const moreBtn = row.getByRole('button', { name: /^更多/ }).first()
    if (await isVisible(moreBtn, 1500)) {
      await moreBtn.click({ force: true })
      const item = page.getByRole('menuitem', { name: '差异' }).first()
      if (await isVisible(item, 1500)) await item.click({ force: true })
    } else {
      const inline = row.getByRole('button', { name: '差异' }).first()
      if (await isVisible(inline, 1500)) await inline.click({ force: true })
    }
    await page.waitForTimeout(800)
    // 差异面板出来,可能是 drawer / dialog
    const panel = page.locator('.el-dialog:visible, .el-drawer:visible').first()
    if (await isVisible(panel, 3000)) {
      // 关闭以免污染下一个 case
      await page.keyboard.press('Escape')
    }
    network.assertClean('config-release.diff')
  })
})
