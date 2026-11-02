// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import JobStepInstanceList from './JobStepInstanceList.vue'

const state = vi.hoisted(() => ({ row: { errorCode: '', errorMessage: '' } }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => reactive({ tenantId: 'tenant-a' }) }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: () => {} }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref({}) }),
}))

function render() {
  return mount(JobStepInstanceList, {
    global: {
      stubs: {
        PageContainer: { template: '<div><slot /></div>' },
        PageHeader: true,
        ProTable: { template: '<div><slot /></div>' },
        ElTableColumn: {
          props: ['label'],
          setup: () => ({ row: state.row }),
          template: '<div :data-label="label"><slot :row="row" /></div>',
        },
        ElPopover: { template: '<div><slot name="reference" /><slot /></div>' },
        ElIcon: { template: '<span><slot /></span>' },
        ElButton: { template: '<button><slot /></button>' },
        RouterLink: { template: '<a><slot /></a>' },
        StatusTag: true,
        DatetimeColumn: true,
      },
    },
  })
}

describe('作业步骤错误详情', () => {
  it.each([
    ['ERR_CODE', 'long error message', '[ERR_CODE] long error message'],
    ['ERR_CODE', '', '[ERR_CODE]'],
    ['', 'long error message', 'long error message'],
  ])('只读查看组合后的已有错误内容', (errorCode, errorMessage, expected) => {
    Object.assign(state.row, { errorCode, errorMessage })
    const wrapper = render()
    const cell = wrapper.get('[data-label="monitor.stepColError"]')
    expect(cell.get('.copyable-text__inspect').attributes('aria-label')).toBe(
      'common.viewFullValue',
    )
    expect(cell.get('.copyable-text__full-value').text()).toBe(expected)
    expect(cell.find('.copyable-text__copy').exists()).toBe(false)
    expect(cell.find('.mono').exists()).toBe(!!errorCode)
    wrapper.unmount()
  })

  it('错误内容为空时保留占位', () => {
    Object.assign(state.row, { errorCode: '', errorMessage: '' })
    const wrapper = render()
    const cell = wrapper.get('[data-label="monitor.stepColError"]')
    expect(cell.text()).toBe('—')
    expect(cell.find('.copyable-text__inspect').exists()).toBe(false)
    wrapper.unmount()
  })
})
