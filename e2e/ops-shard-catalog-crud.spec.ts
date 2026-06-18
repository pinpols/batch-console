/**
 * 分片目录 CRUD(biz 多租分片路由 #473,平台 ADMIN)。
 * smoke:进页 + 字段渲染;persist:真创建→列表出现→删除→消失(删除步即自清理,afterEach API 兜底)。
 */
import { enterDemoApp, expectPageTitle, expect, test } from './support/app'

const KEY = `e2e-shard-${Date.now()}`

async function fillFormItem(drawer, label: string, value: string) {
  await drawer.locator('.el-form-item').filter({ hasText: label }).locator('input').first().fill(value)
}

test.describe('分片目录 shard-catalog (ADMIN)', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/ops/shard-catalog')
    await expectPageTitle(page, '分片目录')
  })

  // 兜底清理:删除步若失败,直接调 DELETE 端点把 e2e 分片删掉,不留残行
  test.afterEach(async ({ request }) => {
    await request
      .delete(`/api/console/ops/shard-catalog/${encodeURIComponent(KEY)}`)
      .catch(() => {})
  })

  test('页可达 + 新建入口可见', async ({ page }) => {
    await expect(page.getByRole('button', { name: '新建' }).first()).toBeVisible()
  })

  test('新增分片抽屉打开 + 字段齐 + 可取消', async ({ page }) => {
    await page.getByRole('button', { name: '新建' }).first().click()
    await page.waitForTimeout(400)
    const drawer = page.locator('.el-drawer:visible').filter({ hasText: '新增分片' })
    await expect(drawer).toBeVisible()
    for (const label of ['分片 key', '主机', '端口', '数据库', '凭据引用', '描述']) {
      await expect(drawer.getByText(label, { exact: true }).first()).toBeVisible()
    }
    await drawer.getByRole('button', { name: '取消' }).click({ force: true })
    await expect(drawer).toBeHidden()
  })

  test('真 CRUD:创建 → 列表出现 → 删除 → 消失', async ({ page }) => {
    // —— 创建 ——
    await page.getByRole('button', { name: '新建' }).first().click()
    const drawer = page.locator('.el-drawer:visible').filter({ hasText: '新增分片' })
    await expect(drawer).toBeVisible()
    await fillFormItem(drawer, '分片 key', KEY)
    await fillFormItem(drawer, '主机', 'localhost')
    await fillFormItem(drawer, '数据库', 'e2e_testdb')
    await fillFormItem(drawer, '凭据引用', 'e2e-secret-ref')
    await drawer.getByRole('button', { name: '保存' }).click()
    await expect(drawer).toBeHidden({ timeout: 8000 })

    // —— 列表出现 ——
    await expect(page.getByRole('cell', { name: KEY })).toBeVisible({ timeout: 8000 })

    // —— 删除(行操作里 danger '删除';可能折在"更多")——
    const row = page.locator('tr', { hasText: KEY })
    let delBtn = row.getByRole('button', { name: '删除' }).first()
    if (!(await delBtn.isVisible().catch(() => false))) {
      const more = row.getByRole('button', { name: /更多|More/i }).first()
      if (await more.isVisible().catch(() => false)) {
        await more.click()
        delBtn = page.getByRole('menuitem', { name: '删除' }).first()
      }
    }
    await delBtn.click({ force: true })
    // ElMessageBox 确认
    await page.getByRole('button', { name: '确认' }).first().click({ force: true })

    // —— 消失 ——
    await expect(page.getByRole('cell', { name: KEY })).toBeHidden({ timeout: 8000 })
  })
})
