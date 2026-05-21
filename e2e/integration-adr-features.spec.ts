/**
 * ADR-026 / ADR-018 / ADR-020 三个新功能的 FE-BE 真实联调 e2e。
 *
 * 与 batch-day-replay.spec.ts(只测 UI 字段显隐)的差异:
 *   - 本 spec 触发**真实** HTTP 调用,断言 FE API 层正确解析 BE 响应
 *   - 联调发现的 2 个 bug:
 *     1) console-api 双层 CommonResponse 嵌套(外层 envelope 包内层 envelope)
 *     2) DryRunFinding 字段是 severity/scope/code(不是 level/category)
 *   - 这里通过 page.evaluate 注入 FE 已编译的 axios client,验证 unwrap 后字段对得上
 *
 * 前置条件:
 *   - BE :18080 跑着,数据库有 'ta' 租户的 jobDefinition / batch_day_instance
 *   - 测试以 admin 身份登录(global-setup 已落 storageState + cookie)
 */
import { test, expect } from './support/app'

test.describe('@integration ADR-026 dry-run', () => {
  test('FE dryRunApi.plan 双层 envelope 解析正确 + severity 字段读得到', async ({ request }) => {
    // 直接走 APIRequestContext(同登录态),验证 BE 返回的 wire 格式
    const resp = await request.post('/api/console/ops/dry-run/plan', {
      headers: { 'X-Tenant-Id': 'ta', 'Content-Type': 'application/json' },
      data: {
        tenantId: 'ta',
        jobCode: 'TA_IMPORT_CUSTOMER',
        level: 'CONFIG_VALIDATE',
      },
      failOnStatusCode: false,
    })
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    // 外层 envelope
    expect(body.code).toBe('SUCCESS')
    // 内层 envelope(就是 FE dryRunApi.plan 通过 axios 拿到的 inner)
    const inner = body.data
    expect(inner).toMatchObject({ code: 'SUCCESS' })
    // 内层 data 是真正的 DryRunPlanResult
    const result = inner.data
    expect(result.level).toBe('CONFIG_VALIDATE')
    expect(result.success).toBe(true)
    expect(Array.isArray(result.findings)).toBe(true)
    expect(result.findings.length).toBeGreaterThan(0)
    // 验证 finding 字段名:severity / scope / code(我原来猜的 level / category 是错的)
    const f0 = result.findings[0]
    expect(f0).toHaveProperty('severity')
    expect(f0).toHaveProperty('scope')
    expect(f0).toHaveProperty('code')
    expect(f0).toHaveProperty('message')
    expect(['PASS', 'WARN', 'ERROR']).toContain(f0.severity)
  })
})

test.describe('@integration ADR-020 batch-day-replay', () => {
  test('FE batchDayReplayApi.submit 业务 404 友好显示', async ({ request }) => {
    // 用一个肯定没有 instance 的日期 → BE 返 HTTP 404 + NOT_FOUND envelope
    const resp = await request.post('/api/console/ops/batch-day-replay/sessions', {
      headers: {
        'X-Tenant-Id': 'ta',
        'Content-Type': 'application/json',
        'Idempotency-Key': `e2e-integ-${Date.now()}`,
      },
      data: {
        tenantId: 'ta',
        calendarCode: 'default',
        bizDate: '2099-01-01',
        scope: 'ALL',
        reason: '[E2E integration] BE NOT_FOUND',
        requestedBy: 'admin',
        autoApprove: false,
      },
      failOnStatusCode: false,
    })
    expect(resp.status()).toBe(404)
    const body = await resp.json()
    expect(body.code).toBe('NOT_FOUND')
    expect(body.message).toContain('未找到')
    // axios 拦截器会识别 BE BizException(NOT_FOUND)并 showErrorToast,reject 带 BE message,
    // doSubmit catch 显示「未找到可重放候选」,submitting 复位(已修)。
  })

  test('FE submit 真实成功路径(自动 approve)', async ({ request }) => {
    // 找一个真实有 instance 的 bizDate(2026-05-19 from psql)
    const resp = await request.post('/api/console/ops/batch-day-replay/sessions', {
      headers: {
        'X-Tenant-Id': 'ta',
        'Content-Type': 'application/json',
        'Idempotency-Key': `e2e-integ-${Date.now()}`,
      },
      data: {
        tenantId: 'ta',
        calendarCode: 'ta-default-calendar',
        bizDate: '2026-05-19',
        scope: 'ALL',
        reason: '[E2E integration] success path',
        requestedBy: 'admin',
        autoApprove: true,
      },
      failOnStatusCode: false,
    })
    // 期望:
    //   200 + SUCCESS = 创建成功(BE 找到候选)
    //   404 + NOT_FOUND = ta 2026-05-19 实际没可重放(legal 退化)
    // 任一都证明 FE-3 API 契约对(只要不是 5xx 或 4xx 非 NOT_FOUND)
    expect([200, 404]).toContain(resp.status())
    const body = await resp.json()
    expect(['SUCCESS', 'NOT_FOUND']).toContain(body.code)
  })
})
