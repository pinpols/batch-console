import { expect, type APIRequestContext } from '@playwright/test'

export async function createDraftConfigRelease(
  request: APIRequestContext,
  tenantId = 'ta',
): Promise<{ id: number; configKey: string }> {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const configKey = `e2e_ui_release_${suffix.replaceAll('-', '_')}`
  const response = await request.post('/api/console/config/releases', {
    headers: {
      'X-Tenant-Id': tenantId,
      'Idempotency-Key': `e2e-config-release-${suffix}`,
    },
    data: {
      tenantId,
      configKey,
      configName: `[E2E UI] ${configKey}`,
      configType: 'RESOURCE_QUEUE',
      configPayloadJson: JSON.stringify({
        queueCode: configKey,
        queueName: `[E2E UI] ${configKey}`,
        queueType: 'MIXED',
        maxRunningJobs: 2,
        maxRunningPartitions: 20,
        maxQps: 10,
        priorityPolicy: 'FIFO',
        fairShareWeight: 1,
        enabled: true,
      }),
      operatorId: 'admin',
    },
  })
  expect(response.status(), `create config release ${configKey}`).toBe(200)

  const listResponse = await request.get(
    `/api/console/config/releases?tenantId=${tenantId}&pageSize=200`,
    { headers: { 'X-Tenant-Id': tenantId } },
  )
  expect(listResponse.status(), `list config release ${configKey}`).toBe(200)
  const list = (await listResponse.json()) as {
    data?: Array<{ id: number; configKey: string; versionNo: number }>
  }
  const release = list.data?.find((item) => item.configKey === configKey && item.versionNo === 1)
  expect(release, `find config release ${configKey}`).toBeTruthy()
  return { id: release!.id, configKey }
}

export async function createPendingApproval(
  request: APIRequestContext,
  label: string,
  tenantId = 'ta',
): Promise<string> {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const response = await request.post('/api/console/self-service/jobs/rerun-request', {
    headers: {
      'X-Tenant-Id': tenantId,
      'Idempotency-Key': `e2e-approval-${label}-${suffix}`,
    },
    data: {
      tenantId,
      jobCode: `e2e-approval-${label}-${suffix}`,
      bizDate: '2026-09-21',
      reason: `e2e ${label} approval action`,
    },
  })
  expect(response.status(), `create ${label} approval`).toBe(200)
  const body = (await response.json()) as { data?: string }
  expect(body.data, `create ${label} approval number`).toBeTruthy()
  return body.data!
}
