import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

const REAL_MONITORING_ENABLED = process.env.E2E_MONITORING_REAL === '1'
const PROMETHEUS_URL = process.env.E2E_PROMETHEUS_URL || 'http://127.0.0.1:19090'
const ALERTMANAGER_URL = process.env.E2E_ALERTMANAGER_URL || 'http://127.0.0.1:19093'

function assertLocalEndpoint(value: string, name: string) {
  const url = new URL(value)
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
  if (!localHosts.has(url.hostname) && process.env.E2E_MONITORING_ALLOW_REMOTE !== '1') {
    throw new Error(
      `${name} must point to a loopback address unless E2E_MONITORING_ALLOW_REMOTE=1 is explicit`,
    )
  }
}

async function getJson(url: string, name: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) })
  expect(response.status, `${name} returned HTTP ${response.status}`).toBe(200)
  return (await response.json()) as unknown
}

test.describe('真实监控联测 @monitoring-real', () => {
  test.skip(!REAL_MONITORING_ENABLED, '通过 npm run test:e2e:monitoring:real 显式启用')

  test('Prometheus 已加载平台规则且 Alertmanager 暴露目标接收器', async () => {
    assertLocalEndpoint(PROMETHEUS_URL, 'E2E_PROMETHEUS_URL')
    assertLocalEndpoint(ALERTMANAGER_URL, 'E2E_ALERTMANAGER_URL')

    const [rules, receivers] = await Promise.all([
      getJson(`${PROMETHEUS_URL}/api/v1/rules?type=alert`, 'Prometheus rules'),
      getJson(`${ALERTMANAGER_URL}/api/v2/receivers`, 'Alertmanager receivers'),
    ])

    const rulePayload = rules as {
      status?: string
      data?: { groups?: Array<{ rules?: Array<{ type?: string; name?: string }> }> }
    }
    expect(rulePayload.status).toBe('success')
    const ruleNames = (rulePayload.data?.groups ?? []).flatMap((group) =>
      (group.rules ?? []).filter((rule) => rule.type === 'alerting').map((rule) => rule.name),
    )
    expect(ruleNames).toContain('BatchServiceDown')
    expect(ruleNames).toContain('BatchAlertEventsGrowing')

    const receiverNames = (receivers as Array<{ name: string }>).map((receiver) => receiver.name)
    expect(receiverNames).toContain('batch-default')
    expect(receiverNames).toContain('batch-sre')
  })

  test('真实 Console 页面读取事件目录、告警和通知配置 API', async ({ page, network }) => {
    await enterDemoApp(page)

    const eventTypesResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/console/event-catalog/event-types'),
    )
    await page.goto('/system/event-catalog')
    await expectPageTitle(page, '事件目录')
    const eventTypesResponse = await eventTypesResponsePromise
    expect(eventTypesResponse.status()).toBe(200)
    const eventTypesBody = (await eventTypesResponse.json()) as {
      data: Array<{ code?: string; eventType?: string; event_type?: string }>
    }
    const eventTypes = eventTypesBody.data.map(
      (item) => item.code ?? item.eventType ?? item.event_type ?? '',
    )
    expect(eventTypes).toEqual(expect.arrayContaining(['ALERT_TRIGGERED', 'ALERT_ESCALATED']))
    await expect(
      page.locator('.catalog-list__item').filter({ hasText: 'ALERT_TRIGGERED' }),
    ).toBeVisible()

    const alertQueryResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/console/queries/alerts'),
    )
    await page.goto('/observability/alerts')
    await expectPageTitle(page, /事件告警|告警/)
    const alertQueryResponse = await alertQueryResponsePromise
    expect(alertQueryResponse.status()).toBe(200)
    await expect(page.locator('.al-list')).toBeVisible()
    await expect(page.locator('.al-card, .empty-state').first()).toBeAttached()

    const notificationResponses: Array<{ endpoint: string; status: number }> = []
    page.on('response', (response) => {
      const endpoint = ['channels', 'rules', 'delivery-logs'].find((name) =>
        response.url().includes(`/api/console/notifications/${name}`),
      )
      if (endpoint) notificationResponses.push({ endpoint, status: response.status() })
    })
    await page.goto('/system/notifications')
    await expectPageTitle(page, '通知与投递')
    await page.getByRole('tab', { name: '订阅规则' }).click()
    await page.getByRole('tab', { name: '投递日志' }).click()
    await expect
      .poll(() => notificationResponses.map((response) => response.endpoint))
      .toEqual(expect.arrayContaining(['channels', 'rules', 'delivery-logs']))
    expect(notificationResponses.every((response) => response.status === 200)).toBe(true)
    network.assertClean('real monitoring pages')
  })

  test('平台规则不提供租户级编辑入口，告警路由页面明确显示预留', async ({ page, network }) => {
    await enterDemoApp(page)
    await page.goto('/observability/alert-routings')
    await expectPageTitle(page, '告警路由（预留）')
    await expect(page.getByText('预留配置，当前不生效')).toBeVisible()
    await expect(page.getByRole('button', { name: '新增路由' })).toHaveCount(0)
    network.assertClean('reserved alert routing page')
  })
})
