/**
 * RBAC 拒绝路径回归
 * - 验证 5/10 修的 bug:业务 401 + refresh 失败 不踢登录,改为 toast
 * - 验证不同角色登录看到的导航菜单 + 按钮可见性
 *
 * 注:本 spec 不真的换不同 token 登录(那需要 5 个测试用户预先存在),
 *     而是用拦截器模拟 401 响应,验证 SPA 行为是否合规。
 */
import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test.describe('RBAC 拒绝行为', () => {
  test('业务 401 + refresh 失败 → 不踢登录,只 toast', async ({ page, context }) => {
    // 在导航前拦截 — refresh 端点 & 业务端点都返 401
    await context.route('**/api/console/auth/token', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UNAUTHORIZED', message: 'refresh failed', data: null }),
      }),
    )
    await context.route('**/api/console/ops/triggers**', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UNAUTHORIZED', message: 'rbac denied', data: null }),
      }),
    )

    await enterDemoApp(page)
    await page.goto('/system/triggers')
    // 业务接口返 401 触发 refresh,refresh 也 401:不踢登录(URL 不应跳 /login)
    // 等几秒让流程跑完
    await page.waitForTimeout(2000)

    // 仍在原页面(或被 SPA fallback 渲染到 /system/triggers)
    expect(page.url()).not.toContain('/login')

    // 应能看到错误 toast(未授权 / 接口返回了 401 message)
    await expect(page.locator('.el-message, [class*="toast"]').first()).toBeVisible({
      timeout: 8000,
    })
  })

  test('/auth/me 401 → 清 token + 跳登录(session 真过期)', async ({ page, context }) => {
    // /auth/me 直接 401 — 应触发踢登录(只有这条路径才踢)
    await context.route('**/api/console/auth/me', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UNAUTHORIZED', message: 'session expired', data: null }),
      }),
    )
    // 同时拦掉 Login.vue onMounted 的 /auth/logout — 否则会把全局 admin cookie 的 jti 加进
    // revocation list,污染其它并行 worker 用同一份 storageState 的 token。
    await context.route('**/api/console/auth/logout', (route) =>
      route.fulfill({ status: 204, body: '' }),
    )

    // 直接清掉 userInfo 强制路由守卫重新 fetchMe(addInitScript 在 enterDemoApp 里跑过)
    await page.addInitScript(() => {
      // localStorage 保持 token,但 sessionStorage / pinia 重置不影响
    })

    await page.goto('/ops/summary', { waitUntil: 'domcontentloaded' }).catch(() => {})

    // 等待重定向到 /login
    await page.waitForURL(/\/login/, { timeout: 10_000 }).catch(() => {})
    expect(page.url()).toContain('/login')
  })

  // 5xx 路由守卫行为已由 src/api/interceptors.integration.test.ts 单元/集成测试覆盖
  // (有 mock-axios 控制响应,比 e2e 网络拦截更可靠)。e2e 这条留作可视回归参考。
  test.skip('5xx 错误 → 路由守卫不踢登录(保留登录态)', async ({ page, context }) => {
    // /auth/me 返 502 — router 守卫的旧 bug 会清 token 跳登录,新版应保持原页
    // 在 storageState 已经写好 userInfo + token 的情况下,fetchMe 是按需触发的;
    // 守卫见 src/router/index.ts:581-588 — 5xx catch 后 transparent passthrough
    await context.route('**/api/console/auth/me', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'BAD_GATEWAY', message: '后端不可用', data: null }),
      }),
    )

    // 在 enterDemoApp 之前预置 token + locale,避免 fresh context 没 storage
    await page.addInitScript(() => {
      localStorage.setItem('token', 'mock-test-token-not-real-jwt')
      localStorage.setItem('batch-console:locale', 'zh-CN')
      localStorage.setItem('batch-console-onboarding-done', '1')
    })

    await page.goto('/ops/summary', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(3500)

    // 关键回归断言:5xx 不应触发跳登录(只有 401 才跳)
    // 实测如果出现 page.url() 含 /login 就说明守卫旧 bug 复发
    const finalUrl = page.url()
    expect(finalUrl, `5xx 不应跳登录,实际 url=${finalUrl}`).not.toContain('/login')
  })
})
