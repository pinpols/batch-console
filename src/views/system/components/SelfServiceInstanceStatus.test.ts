// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import zhCN from '@/locales/zh-CN'
import enUS from '@/locales/en-US'
import Compensation from './SelfServiceCompensationTab.vue'
import Rerun from './SelfServiceRerunTab.vue'

vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: () => {} }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: undefined } }),
}))
vi.mock('@/composables/useJobCodeSearch', async () => {
  const { ref } = await import('vue')
  return {
    useJobCodeSearch: () => ({
      jobCodeLoading: ref(false),
      jobCodeOptions: ref([]),
      loadDefaultJobCodes: vi.fn(),
      queryJobCodes: vi.fn(),
      clearOptions: vi.fn(),
    }),
  }
})
vi.mock('@/composables/useInstanceNoSearch', async () => {
  const { ref } = await import('vue')
  return {
    useInstanceNoSearch: () => ({
      instanceLoading: ref(false),
      instanceOptions: ref([
        { instanceNo: 'run-a', status: 'RUNNING' },
        { instanceNo: 'run-b', status: 'FUTURE_STATUS' },
      ]),
      loadInstances: vi.fn(),
      queryInstances: vi.fn(),
      clearOptions: vi.fn(),
    }),
  }
})

const slot = { template: '<div><slot /></div>' }

describe('自助申请的实例状态', () => {
  it.each([
    { component: Compensation, locale: 'zh-CN', label: '运行中' },
    { component: Compensation, locale: 'en-US', label: 'Running' },
    { component: Rerun, locale: 'zh-CN', label: '运行中' },
    { component: Rerun, locale: 'en-US', label: 'Running' },
  ])('显示已知状态的本地化名称，未知状态保留原值', ({ component, locale, label }) => {
    const i18n = createI18n({ legacy: false, locale, messages: { 'zh-CN': zhCN, 'en-US': enUS } })
    const wrapper = mount(component, {
      global: {
        plugins: [i18n],
        directives: { 'track-click': () => {} },
        stubs: {
          ElForm: slot,
          ElFormItem: slot,
          ElSelect: slot,
          ElOption: slot,
          ElTag: slot,
          ElButton: slot,
          ElInput: slot,
          ElDatePicker: slot,
        },
      },
    })
    expect(wrapper.text()).toContain(label)
    expect(wrapper.text()).toContain('FUTURE_STATUS')
    wrapper.unmount()
  })
})
