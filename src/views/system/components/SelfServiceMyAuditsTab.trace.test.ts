// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import SelfServiceMyAuditsTab from './SelfServiceMyAuditsTab.vue'

const state = vi.hoisted(() => ({ row: { traceId: '' } }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => reactive({ tenantId: 'tenant-a' }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ userInfo: { userId: 'operator' } }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: () => {} }))

function render() {
  return mount(SelfServiceMyAuditsTab, {
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
      },
    },
  })
}

describe('自助审计 Trace 查看', () => {
  it('保留八位摘要并提供只读的完整值查看，空值仍显示占位', () => {
    state.row.traceId = '12345678-abcdef-1234567890'
    const wrapper = render()
    const cell = wrapper.get('[data-col="traceId"]')
    expect(cell.get('.trace-short').text()).toBe('12345678')
    expect(cell.get('.copyable-text__inspect').attributes('aria-label')).toBe(
      'common.viewFullValue',
    )
    expect(cell.get('.copyable-text__full-value').text()).toBe(state.row.traceId)
    expect(cell.find('.copyable-text__copy').exists()).toBe(false)
    wrapper.unmount()

    state.row.traceId = ''
    const empty = render()
    expect(empty.get('[data-col="traceId"]').text()).toBe('—')
    expect(empty.get('[data-col="traceId"]').find('.copyable-text__inspect').exists()).toBe(false)
    empty.unmount()
  })
})
