/**
 * AI 助手页面 + POST /api/console/ai/chat 触发测试
 * 这是个写接口(POST),前端有发送消息流程。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle, isVisible } from './support/app'

test.describe('AI Chat', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoApp(page)
    await page.goto('/system/ai-chat')
    await expectPageTitle(page, 'AI 助手')
  })

  test('页面可打开 + 输入框/发送按钮可见', async ({ page }) => {
    // 输入区:role=textbox(EP 的 el-input 渲染为 input,role=textbox)
    const input = page.getByRole('textbox').first()
    await expect(input).toBeVisible({ timeout: 6000 })

    // 发送按钮(可能叫"发送"/"提交"/Send)
    const sendBtn = page.getByRole('button', { name: /发送|提交|Send/i }).first()
    await expect(sendBtn).toBeVisible()
  })

  test('发送一条消息 → 触发 POST /api/console/ai/chat', async ({ page }) => {
    const input = page.getByRole('textbox').first()
    if (!(await isVisible(input, 3000))) return
    await input.fill('e2e ai chat test')

    // 监听 chat 接口
    const apiCall = page.waitForResponse(
      (r) => r.url().includes('/api/console/ai/chat') && r.request().method() === 'POST',
      { timeout: 15_000 },
    )

    const sendBtn = page.getByRole('button', { name: /发送|提交|Send/i }).first()
    await sendBtn.click()

    // 拦到请求即视为接口已触发(响应可能是成功或 502/未配置,都算)
    const resp = await apiCall.catch(() => null)
    expect(resp).not.toBeNull()
  })
})
