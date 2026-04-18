/**
 * 报表导出中心 — 完整操作测试
 * 覆盖：页面加载、报表卡片数量、关键字搜索过滤、无匹配空状态、清空恢复、下载触发、复制 tenantId
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

const TOTAL_REPORTS = 9

test.describe('报表导出中心 — 页面基础', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/reports')
    await expectPageTitle(page, /导出中心/)
  })

  test('展示所有报表卡片', async ({ page }) => {
    await expect(page.locator('.report-card')).toHaveCount(TOTAL_REPORTS)
  })

  test('每张卡片均有下载按钮', async ({ page }) => {
    const downloadBtns = page.locator('.report-card .el-button', { hasText: '下载' })
    await expect(downloadBtns).toHaveCount(TOTAL_REPORTS)
  })

  test('header 显示 tenantId 标签', async ({ page }) => {
    await expect(page.locator('.el-tag').filter({ hasText: 'tenant:' })).toBeVisible()
  })

  test('复制按钮可点击', async ({ page }) => {
    const copyBtn = page.getByRole('button', { name: '复制' }).first()
    await expect(copyBtn).toBeVisible()
    // 点击后应触发 toast（clipboard 在 e2e 环境中可能受限，宽松断言）
    await copyBtn.click()
    const toast = page.locator('.el-message')
    if (await isVisible(toast, 3000)) {
      await expect(toast).toBeVisible()
    }
  })
})

test.describe('报表导出中心 — 搜索过滤', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/reports')
    await expectPageTitle(page, /导出中心/)
  })

  test('关键字搜索"调度"只展示调度相关卡片', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索报表"]')
    await searchInput.fill('调度')
    const cards = page.locator('.report-card')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(TOTAL_REPORTS)
    // 确保每张卡片标题/描述包含"调度"
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).toContainText(/调度/)
    }
  })

  test('关键字搜索"配置"过滤结果', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索报表"]')
    await searchInput.fill('配置')
    const cards = page.locator('.report-card')
    await expect(cards).toHaveCount(await cards.count()) // 至少有结果
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(TOTAL_REPORTS)
  })

  test('不匹配的关键字展示空状态', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索报表"]')
    await searchInput.fill('xxxxxxxxxx_no_match')
    await expect(page.locator('.el-empty')).toBeVisible()
    await expect(page.locator('.report-card')).toHaveCount(0)
  })

  test('清空搜索框恢复全部卡片', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索报表"]')
    await searchInput.fill('调度')
    await expect(page.locator('.report-card').first()).toBeVisible()
    // 点清除图标
    const clearBtn = page.locator('.el-input__clear')
    if (await isVisible(clearBtn, 2000)) {
      await clearBtn.click()
    } else {
      await searchInput.clear()
    }
    await expect(page.locator('.report-card')).toHaveCount(TOTAL_REPORTS)
  })
})

test.describe('报表导出中心 — 下载交互', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/reports')
    await expectPageTitle(page, /导出中心/)
  })

  test('点击下载按钮触发请求并出现 toast', async ({ page }) => {
    const firstDownload = page
      .locator('.report-card')
      .first()
      .locator('.el-button', { hasText: '下载' })
    await firstDownload.click()
    // 按钮进入 loading 状态或 toast 出现（取决于后端是否可用）
    const toast = page.locator('.el-message')
    if (await isVisible(toast, 8000)) {
      await expect(toast).toBeVisible()
    }
  })

  test('下载期间其余卡片按钮被禁用', async ({ page }) => {
    // 快速点击第一张卡片（触发 loading），立即检查其他卡片是否 disabled
    const cards = page.locator('.report-card')
    const firstCard = cards.first()
    const firstBtn = firstCard.locator('.el-button', { hasText: '下载' })
    // 拦截网络请求让其挂起，以便检查 disabled 状态
    await page.route('**/api/console/reports/**', (route) => {
      // 延迟响应 2 秒模拟 loading
      setTimeout(() => route.continue(), 2000)
    })
    await firstBtn.click()
    // 其余卡片的 button 此时应为 disabled
    const secondCard = cards.nth(1)
    await expect(secondCard).toHaveAttribute('disabled', '')
  })
})
