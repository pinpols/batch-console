import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('config management (配置管理)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('配置管理页面可打开并展示 5 个标签页', async ({ page }) => {
    await page.goto('/config/management')
    await expectPageTitle(page, '配置管理')
    await expect(page.getByRole('tab', { name: '变更日志' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Secrets' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '配置导出' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '配置导入' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '同步日志' })).toBeVisible()
  })

  test('变更日志标签页展示表格与刷新按钮', async ({ page }) => {
    await page.goto('/config/management')
    await expect(page.getByRole('tab', { name: '变更日志' })).toHaveClass(/is-active/)
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '变更类型' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '配置键' })).toBeVisible()
  })

  test('Secrets 标签页展示表格与操作列', async ({ page }) => {
    await page.goto('/config/management')
    await page.getByRole('tab', { name: 'Secrets' }).click()
    await expect(page.getByRole('columnheader', { name: 'Secret Key' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '版本' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '操作' })).toBeVisible()
  })

  test('配置导出标签页展示表单与导出按钮', async ({ page }) => {
    await page.goto('/config/management')
    await page.getByRole('tab', { name: '配置导出' }).click()
    await expect(page.getByText('配置类型')).toBeVisible()
    await expect(page.getByRole('button', { name: '导出' })).toBeVisible()
  })

  test('配置导入标签页展示 Payload 文本域与操作按钮', async ({ page }) => {
    await page.goto('/config/management')
    await page.getByRole('tab', { name: '配置导入' }).click()
    await expect(page.getByText('Payload')).toBeVisible()
    await expect(page.getByRole('button', { name: '预览变更' })).toBeVisible()
    await expect(page.getByRole('button', { name: '确认导入' })).toBeVisible()
  })

  test('同步日志标签页展示表格', async ({ page }) => {
    await page.goto('/config/management')
    await page.getByRole('tab', { name: '同步日志' }).click()
    await expect(page.getByRole('columnheader', { name: '类型' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '摘要' })).toBeVisible()
  })

  test('旧路由重定向到配置管理页', async ({ page }) => {
    await page.goto('/config/change-logs')
    await expect(page).toHaveURL(/\/config\/management/)

    await page.goto('/config/sync')
    await expect(page).toHaveURL(/\/config\/management/)
  })
})

test.describe('config releases (配置发布)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('配置发布列表可打开并展示表格与筛选', async ({ page }) => {
    await page.goto('/config/releases')
    await expectPageTitle(page, '配置发布')
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })
})

test.describe('excel maintenance (Excel 维护)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('Excel 维护页可打开并展示步骤向导', async ({ page }) => {
    await page.goto('/config/excel')
    await expectPageTitle(page, /Excel 维护/)
  })

  test('各 domain 子路由可达', async ({ page }) => {
    const domains = [
      'file-templates',
      'file-channels',
      'workflows',
      'job-definitions',
      'alert-routings',
    ]
    for (const domain of domains) {
      await page.goto(`/config/excel/${domain}`)
      await expect(page).toHaveURL(/\/config\/excel/)
    }
  })
})

test.describe('tags (标签管理)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
  })

  test('标签管理页可打开', async ({ page }) => {
    await page.goto('/system/tags')
    await expectPageTitle(page, '标签管理')
  })
})
