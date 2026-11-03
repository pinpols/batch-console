// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { shallowMount } from '@vue/test-utils'
import QueueConfig from './QueueConfig.vue'

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/governance/windows', query: {}, meta: { mode: 'windows' } }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: vi.fn() }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canAccess: () => true, canWriteSystem: ref(true) }),
}))
const slot = { template: '<div><slot /></div>' }

describe('批次窗口编辑预览', () => {
  it('编辑非跨日无效时间时显示保存校验警告', async () => {
    const wrapper = shallowMount(QueueConfig, {
      global: {
        stubs: {
          PageContainer: slot,
          ElDrawer: slot,
          FormDrawer: slot,
          ElForm: slot,
          ElFormItem: slot,
          WindowSchedulePreview: false,
        },
      },
    })
    const vm = wrapper.vm as unknown as { openWindowEdit: (row: object) => void }
    vm.openWindowEdit({
      id: 9,
      windowCode: 'night',
      timezone: 'UTC',
      startTime: '20:00',
      endTime: '08:00',
      allowCrossDay: false,
      enabled: true,
    })
    await nextTick()
    expect(wrapper.find('.window-preview').exists()).toBe(true)
    expect(wrapper.text()).toContain('queueConfig.windowPreviewRangeInvalid')
    wrapper.unmount()
  })
})
