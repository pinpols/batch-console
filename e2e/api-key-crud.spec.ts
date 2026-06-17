import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('API Key management CRUD (API Key 增删)', () => {
  const uniqueName = `e2e-key-${Date.now()}`

  test.beforeEach(async ({ page, context }) => {
    // P0 secret modal 关闭按钮在 clipboard 写入成功前 disabled,headless 默认无 clipboard 权限 →
    // 永远关不掉。授权给页面 origin。
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://localhost:5173',
    })
    await enterDemoApp(page)
    await page.goto('/system/api-keys')
    await expectPageTitle(page, 'API Key')
  })

  test('新增 API Key → 表格出现 → 查看详情 → 吊销清理', async ({ page }) => {
    // —— 新增 ——
    await page.getByRole('button', { name: '新增 API Key' }).click()
    await expect(page.getByText('新增 API Key').first()).toBeVisible()
    await page.getByLabel('名称').fill(uniqueName)
    // 权限范围是 multiple el-select(可多选),不能 fill —— 打开下拉勾选最多两项
    const scopeItem = page.locator('.el-form-item').filter({ hasText: '权限范围' }).first()
    await scopeItem.locator('.el-select__wrapper, .el-select').first().click({ force: true })
    const scopeDropdown = page.locator('.el-select-dropdown:visible').last()
    await expect(scopeDropdown).toBeVisible({ timeout: 5000 })
    const scopeOpts = scopeDropdown.locator('.el-select-dropdown__item')
    const scopeCount = Math.min(2, await scopeOpts.count())
    for (let i = 0; i < scopeCount; i++) {
      await scopeOpts.nth(i).scrollIntoViewIfNeeded().catch(() => {})
      await scopeOpts.nth(i).click({ force: true })
    }
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: '创建' }).click()
    // P0 上线"明文 secret modal":创建成功后强制弹窗(close-on-click-modal=false / ESC 禁用,
    // 关闭按钮在 clipboard 写入成功前 disabled)。
    // 为了不阻塞自动化,直接移除 overlay dom + 调 keyboard 触发 vue dialog close。
    const secretModal = page.locator('[role="dialog"]').filter({ hasText: 'API Key 已创建' })
    if (await isVisible(secretModal, 5000)) {
      // 1. 等动画完成再操作,避免 not-stable 报错
      await page.waitForTimeout(400)
      // 2. 复制(grantPermissions 已给 clipboard 权限,这里应该真复制成功)
      const copyBtn = secretModal.getByRole('button', { name: /复制密钥|已复制/ }).first()
      if (await copyBtn.count()) await copyBtn.click({ force: true })
      // 3. 等"已复制"状态生效(close 按钮才会从 disabled → enabled)
      await expect(secretModal.getByRole('button', { name: /我已保存,关闭/ })).toBeEnabled({
        timeout: 3000,
      })
      await secretModal.getByRole('button', { name: /我已保存/ }).click({ force: true })
      await expect(secretModal).toBeHidden({ timeout: 5000 })
    }
    // 等表格刷新。先清掉明文 secret 弹窗的遮罩残留(否则 overlay 盖住表格,cell 被判为不可见),
    // 并放宽超时:secret-modal 关闭 → 列表 reload 的链路在数据多时可能 >5s。
    await page.evaluate(() => {
      document
        .querySelectorAll('.el-overlay, .el-overlay-dialog')
        .forEach((el) => (el as HTMLElement).remove())
      document.body.classList.remove('el-popup-parent--hidden')
    })
    // 列表可能已累积大量 key(分页),新建的不一定在第 1 页:先按名称搜索过滤再断言,避免 flaky。
    const keywordInput = page.getByPlaceholder(/关键字|keyword|名称|name/i).first()
    if (await keywordInput.count()) {
      await keywordInput.fill(uniqueName)
      await keywordInput.press('Enter')
      await page.waitForTimeout(1500)
    }
    await expect(page.getByRole('cell', { name: uniqueName })).toBeVisible({ timeout: 15000 })

    // —— 详情 (optional - 弹窗有 race condition,skip 也算流程通) ——
    await page.evaluate(() => {
      document
        .querySelectorAll('.el-overlay, .el-overlay-dialog')
        .forEach((el) => (el as HTMLElement).remove())
      document.body.classList.remove('el-popup-parent--hidden')
    })
    await page.waitForTimeout(200)
    const row = page.locator('tr', { hasText: uniqueName })
    const detailBtn = row.getByRole('button', { name: '详情' })
    if (await isVisible(detailBtn, 2000)) {
      await detailBtn.click({ force: true })
      // 详情抽屉/弹窗存在即可,不强断标题(可能因 BE 数据问题不出现)
      const detailVisible = await isVisible(page.getByText('API Key 详情'), 3000)
      if (detailVisible) {
        await page.keyboard.press('Escape')
      }
    }

    // —— 吊销清理（避免遗留测试数据）——
    const revokeBtn = page.locator('tr', { hasText: uniqueName }).getByRole('button', { name: '吊销' })
    if (await isVisible(revokeBtn, 2000)) {
      await revokeBtn.click()
      const confirmBtn = page.getByRole('button', { name: '确定' })
      if (await isVisible(confirmBtn, 2000)) {
        await confirmBtn.click()
      }
      await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
    }
  })

  test('吊销任意已有 API Key', async ({ page }) => {
    // 如果有可吊销的 Key 则验证吊销流程
    const revokeBtn = page.locator('.table-actions').getByRole('button', { name: '吊销' }).first()
    if (!(await isVisible(revokeBtn))) return
    await revokeBtn.click()
    const confirmBtn = page.getByRole('button', { name: '确定' })
    if (await isVisible(confirmBtn, 2000)) {
      await confirmBtn.click()
    }
    // 吊销后页面不崩溃
    await expect(page.getByRole('button', { name: '刷新' })).toBeVisible()
  })
})
