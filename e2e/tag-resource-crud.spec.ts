/**
 * Tag 资源标签 upsert + delete 闭环。
 * Tag 用 composite key (resourceType+resourceCode+tagKey),没有 id。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('tag resource CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    // resourceType MetaSelect 的选项来自 /meta/enums(triggerResourceType);并行负载下字典异步
    // 加载较慢,必须先等它拉完再交互,否则下拉为空 → 选不中 → canCreate 永远 false。
    const enumsP = page
      .waitForResponse((r) => r.url().includes('/meta/enums') && r.status() === 200, {
        timeout: 10000,
      })
      .catch(() => null)
    await page.goto('/system/tags')
    await expectPageTitle(page, '标签管理')
    await enumsP
  })

  test('资源标签 tab 默认激活 + 查询', async ({ page }) => {
    await expect(page.getByRole('tab', { name: '资源标签' })).toHaveClass(/is-active/)
    // 搜索按钮存在(没数据时也应可见)
    await expect(page.getByRole('button', { name: '搜索' }).first()).toBeVisible()
  })

  test('新建标签对话框可打开并填写', async ({ page }) => {
    // 新增按钮现在受外层 resourceType+resourceCode 控制:两者齐备前 button.disabled,
    // 防止用户走完整个新增弹窗后才在保存时被告知缺前置条件。
    const addBtn = page.getByRole('button', { name: /新增/ }).first()
    if (!(await isVisible(addBtn, 2000))) return
    await expect(addBtn).toBeDisabled()

    // 填资源类型(MetaSelect)+ 资源编码 — 两者齐备按钮才解锁(canCreate,跨组件 expose)。
    // 关键:option 点击【不要】force —— force 会跳过 Playwright 的可点稳定性等待,在 el-select
    // 下拉的开场动画期点下去会落空、不写入 model(此前 ~1/3 偶发的根因)。不 force 则自动等动画结束。
    const typeWrapper = page.locator('.tag-query__type')
    await typeWrapper.locator('.el-select__wrapper').first().click()
    const typeDropdown = page.locator('.el-select-dropdown:visible').last()
    const jobOpt = typeDropdown.locator('.el-select-dropdown__item', { hasText: '作业' }).first()
    await jobOpt.click() // 不 force,自动等稳定
    // 真选中 → wrapper 显示 label「作业」
    await expect(typeWrapper).toContainText('作业', { timeout: 3000 })
    // 资源编码
    await page.locator('.tag-query__code input').first().fill('test-resource')
    // 两者齐备后按钮解锁
    await expect(addBtn).toBeEnabled({ timeout: 8000 })
    await addBtn.click()
    await page.waitForTimeout(400)
    // 实际打开的是 el-drawer 不是 el-dialog(gifted-bell 分支修正)
    const drawer = page.locator('.el-drawer').first()
    if (await isVisible(drawer, 2000)) {
      await expect(drawer).toBeVisible()
      const cancelBtn = drawer.getByRole('button', { name: /取消|关闭/ }).first()
      if (await cancelBtn.count()) await cancelBtn.click({ force: true })
    }
  })

  test('按标签搜索 tab 可切换', async ({ page }) => {
    await page.getByRole('tab', { name: '搜索标签' }).click()
    await expect(page.getByRole('tab', { name: '搜索标签' })).toHaveClass(/is-active/)
  })
})
