import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./client', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}))

import { get } from './client'
import {
  listNotificationChannels,
  listNotificationDeliveryLogs,
  listNotificationRules,
} from './notifications'

const mockedGet = vi.mocked(get)

describe('notification response adapters', () => {
  beforeEach(() => mockedGet.mockReset())

  it('maps channel snake_case fields for the UI', async () => {
    mockedGet.mockResolvedValue([
      {
        id: 1,
        tenant_id: 'ta',
        channel_code: 'mail',
        channel_name: 'Mail',
        channel_type: 'EMAIL',
        config_json: {},
        enabled: true,
        created_at: '2026-09-21T00:00:00Z',
      },
    ] as never)

    await expect(listNotificationChannels('ta')).resolves.toMatchObject([
      {
        id: 1,
        tenantId: 'ta',
        channelCode: 'mail',
        channelName: 'Mail',
        channelType: 'EMAIL',
        configJson: {},
        createdAt: '2026-09-21T00:00:00Z',
      },
    ])
  })

  it('maps rule and delivery snake_case fields for the UI', async () => {
    mockedGet
      .mockResolvedValueOnce([
        {
          id: 2,
          tenant_id: 'ta',
          rule_name: 'Failures',
          channel_code: 'mail',
          event_types: 'JOB_FAILED',
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: 3,
          tenant_id: 'ta',
          rule_id: 2,
          channel_code: 'mail',
          event_type: 'JOB_FAILED',
          delivery_status: 'SUCCESS',
        },
      ] as never)

    await expect(listNotificationRules('ta')).resolves.toMatchObject([
      {
        tenantId: 'ta',
        ruleName: 'Failures',
        channelCode: 'mail',
        eventTypes: 'JOB_FAILED',
      },
    ])
    await expect(listNotificationDeliveryLogs('ta')).resolves.toMatchObject([
      {
        tenantId: 'ta',
        ruleId: 2,
        channelCode: 'mail',
        eventType: 'JOB_FAILED',
        deliveryStatus: 'SUCCESS',
      },
    ])
  })
})
