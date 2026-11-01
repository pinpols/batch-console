// @vitest-environment jsdom
import { flushPromises, shallowMount } from '@vue/test-utils'
import { computed, reactive } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import ConfigManagement from './ConfigManagement.vue'

const state = vi.hoisted(() => ({
  auth: null as unknown as { isLoggedIn: boolean; canManage: boolean },
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => state.auth }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canManageSystem: computed(() => state.auth.canManage) }),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { tab: 'sync' } }),
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

beforeEach(() => {
  state.auth = reactive({ isLoggedIn: true, canManage: true })
})

it('退出登录后移除配置页内容，避免页面继续发起读取', async () => {
  const wrapper = shallowMount(ConfigManagement, {
    global: {
      stubs: {
        PageContainer: { template: '<div><slot /></div>' },
        ElTabs: { template: '<div><slot /></div>' },
        ElTabPane: { template: '<div><slot name="label" /><slot /></div>' },
      },
    },
  })
  expect(wrapper.text()).toContain('configManagement.tabSync')
  state.auth.isLoggedIn = false
  state.auth.canManage = false
  await flushPromises()
  expect(wrapper.text()).not.toContain('configManagement.tabLogs')
  wrapper.unmount()
})
