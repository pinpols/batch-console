// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import OutboxRecordSummary from './OutboxRecordSummary.vue'

vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
const slot = { template: '<div><slot /></div>' }
function render(kind: 'retry' | 'delivery', row: Record<string, unknown>) {
  return shallowMount(OutboxRecordSummary, {
    props: { kind, row: row as never },
    global: {
      stubs: {
        ElDescriptions: slot,
        ElDescriptionsItem: slot,
        StatusTag: { props: ['value'], template: '<span>{{ value }}</span>' },
        DatetimeText: { props: ['value'], template: '<span>{{ value ?? "—" }}</span>' },
      },
    },
  })
}
describe('OutboxRecordSummary', () => {
  it('shows the outbox event identity and retry state without treating zero as missing', () => {
    const text = render('retry', {
      id: 3,
      outboxEventId: 42,
      retryStatus: 'FAILED',
      retryCount: 0,
      nextRetryAt: null,
    }).text()
    expect(text).toContain('42')
    expect(text).toContain('FAILED')
    expect(text).toContain('0')
    expect(text).toContain('—')
  })
  it('shows a single delivery attempt and its error', () => {
    const text = render('delivery', {
      id: 8,
      deliveryStatus: 'FAILED',
      deliveryAttempt: 2,
      targetTopic: 'orders',
      errorMessage: 'timeout',
    }).text()
    expect(text).toContain('FAILED')
    expect(text).toContain('2')
    expect(text).toContain('orders')
    expect(text).toContain('timeout')
  })
})
