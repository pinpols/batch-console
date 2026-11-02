// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import NotificationDeliveryLogsTab from './NotificationDeliveryLogsTab.vue'

const state = vi.hoisted(() => ({
  row: { channelCode: '', eventType: '', errorMessage: '' },
}))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => reactive({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: () => {} }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref({}) }),
}))

function render() {
  return mount(NotificationDeliveryLogsTab, {
    global: {
      stubs: {
        ProTable: { template: '<div><slot /></div>' },
        ElTableColumn: {
          props: ['prop'],
          setup: () => ({ row: state.row }),
          template: '<div :data-col="prop"><slot :row="row" /></div>',
        },
        ElPopover: { template: '<div><slot name="reference" /><slot /></div>' },
        ElIcon: { template: '<span><slot /></span>' },
        ElButton: { template: '<button><slot /></button>' },
        DatetimeColumn: true,
      },
    },
  })
}

describe('通知投递记录的长字段', () => {
  it('提供完整渠道编码和事件类型查看入口，并保留空值显示', () => {
    const channelCode = `channel-${'a'.repeat(55)}`
    const eventType = `EVENT_${'B'.repeat(58)}`
    Object.assign(state.row, { channelCode, eventType, errorMessage: '' })
    const wrapper = render()
    for (const [field, expected] of [
      ['channelCode', channelCode],
      ['eventType', eventType],
    ]) {
      const cell = wrapper.get(`[data-col="${field}"]`)
      expect(cell.get('.copyable-text__inspect').attributes('aria-label')).toBe(
        'common.viewFullValue',
      )
      expect(cell.get('.copyable-text__full-value').text()).toBe(expected)
    }
    wrapper.unmount()

    Object.assign(state.row, { channelCode: '', eventType: '', errorMessage: '' })
    const empty = render()
    expect(empty.get('[data-col="channelCode"]').text()).toBe('')
    expect(empty.get('[data-col="eventType"]').text()).toBe('—')
    empty.unmount()
  })
})
