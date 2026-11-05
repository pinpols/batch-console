// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PasswordNoticeBanner from './PasswordNoticeBanner.vue'
import { STORAGE_KEYS } from '@/constants/storageKeys'

const auth = reactive({ userInfo: { username: 'admin', mustChangePassword: true } })
vi.mock('@/stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/ops/summary' }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const stubs = {
  AutoDismissBannerActions: {
    emits: ['dismiss'],
    template: '<div><button class="close" @click="$emit(\'dismiss\')">x</button><slot /></div>',
  },
  ElButton: true,
}

beforeEach(() => {
  sessionStorage.clear()
  auth.userInfo = { username: 'admin', mustChangePassword: true }
})

describe('改密提示横幅', () => {
  it('关闭后记入本次会话，同一用户再次进入页面不再出现', async () => {
    const first = mount(PasswordNoticeBanner, { global: { stubs } })
    expect(first.find('.password-notice').exists()).toBe(true)
    await first.get('.close').trigger('click')
    expect(sessionStorage.getItem(STORAGE_KEYS.passwordNoticeDismissed)).toBe('admin')
    first.unmount()

    const second = mount(PasswordNoticeBanner, { global: { stubs } })
    expect(second.find('.password-notice').exists()).toBe(false)
  })

  it('换了用户仍然提示', () => {
    sessionStorage.setItem(STORAGE_KEYS.passwordNoticeDismissed, 'someone-else')
    const wrapper = mount(PasswordNoticeBanner, { global: { stubs } })
    expect(wrapper.find('.password-notice').exists()).toBe(true)
  })
})
