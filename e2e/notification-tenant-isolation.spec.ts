import { expect, test } from './support/app'
import { enterDemoApp, expectPageTitle } from './support/app'

test('same-code notification channels remain isolated across tenant switch', async ({ page }) => {
  const channelCode = `e2e_scope_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const { cookies } = await page.request.storageState()
  const csrfToken = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value
  const requestHeaders = (tenantId: string) => ({
    'X-Tenant-Id': tenantId,
    ...(csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
  })

  async function createChannel(tenantId: string, channelName: string) {
    const response = await page.request.post(
      `/api/console/notifications/channels?tenantId=${tenantId}`,
      {
        headers: requestHeaders(tenantId),
        data: { channelCode, channelName, channelType: 'EMAIL', configJson: '{}', enabled: true },
      },
    )
    expect(response.status(), `create channel for ${tenantId}`).toBe(200)
  }

  async function readChannel(tenantId: string) {
    const response = await page.request.get(
      `/api/console/notifications/channels/${encodeURIComponent(channelCode)}?tenantId=${tenantId}`,
      { headers: requestHeaders(tenantId) },
    )
    expect(response.status(), `read channel for ${tenantId}`).toBe(200)
    const body = (await response.json()) as { data?: { channel_name?: string } }
    return body.data?.channel_name
  }

  async function deleteChannel(tenantId: string) {
    const response = await page.request.delete(
      `/api/console/notifications/channels/${encodeURIComponent(channelCode)}?tenantId=${tenantId}`,
      { headers: requestHeaders(tenantId) },
    )
    expect([200, 404], `delete channel for ${tenantId}`).toContain(response.status())
  }

  try {
    await createChannel('ta', 'A 原始渠道')
    await createChannel('tb', 'B 原始渠道')

    await enterDemoApp(page)
    await page.goto('/system/notifications')
    await expectPageTitle(page, '通知与投递')
    await page.getByRole('combobox', { name: '切换租户' }).fill('tb')
    await page.getByRole('option', { name: /tb/ }).click()

    const row = page.locator('tr', { hasText: channelCode })
    await expect(row).toContainText('B 原始渠道')
    await row.getByRole('button', { name: '编辑' }).click()
    await expect(page.getByText('编辑渠道')).toBeVisible()
    await page.getByLabel('名称').fill('B 修改后的渠道')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(row).toContainText('B 修改后的渠道')

    expect(await readChannel('ta')).toBe('A 原始渠道')
    expect(await readChannel('tb')).toBe('B 修改后的渠道')
  } finally {
    await deleteChannel('ta')
    await deleteChannel('tb')
  }
})
