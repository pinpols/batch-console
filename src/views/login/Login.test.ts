// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import Login from './Login.vue'

const mocks = vi.hoisted(() => ({ logout: vi.fn(), login: vi.fn(), push: vi.fn() }))
vi.mock('@/api/auth', () => ({ authApi: { logout: mocks.logout } }))
vi.mock('@/api/captcha', () => ({
  getCaptchaConfig: vi.fn().mockResolvedValue({ provider: 'none', loginProtectionEnabled: false }),
}))
vi.mock('@/api/oidc', () => ({
  getConsoleOidcProvider: vi.fn().mockResolvedValue({ enabled: false }),
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ login: mocks.login }) }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push }),
  useRoute: () => ({ query: {} }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/composables/useLocale', async () => {
  const { ref } = await import('vue')
  return { useLocale: () => ({ current: ref('zh-CN'), setLocale: vi.fn() }) }
})
vi.mock('@/constants/theme', () => ({
  applyThemeToDocument: vi.fn(),
  getSystemIsDark: () => false,
  readThemePreference: () => 'system',
  resolveEffectiveTheme: () => 'light',
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('__APP_VERSION__', 'test')
  mocks.login.mockResolvedValue(true)
})

it('打开登录页不登出其他标签的会话，登录提交正常发起', async () => {
  mocks.logout.mockResolvedValue(undefined)
  const wrapper = mount(Login, {
    global: {
      stubs: {
        ElForm: defineComponent({
          emits: ['submit'],
          setup(_, { slots, expose, emit }) {
            expose({ validate: vi.fn().mockResolvedValue(true) })
            return () =>
              h(
                'form',
                {
                  onSubmit: (event: Event) => {
                    event.preventDefault()
                    emit('submit', event)
                  },
                },
                slots.default?.(),
              )
          },
        }),
        ElInput: {
          props: ['modelValue', 'placeholder'],
          emits: ['update:modelValue'],
          template:
            '<input :placeholder="placeholder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        ElButton: { template: '<button><slot /></button>' },
        ElFormItem: { template: '<div><slot /></div>' },
        ElTooltip: { template: '<div><slot /></div>' },
        ElIcon: { template: '<span><slot /></span>' },
        BatchMark: true,
      },
    },
  })
  await wrapper.get('input[placeholder="login.usernamePlaceholder"]').setValue('admin')
  await wrapper.get('input[placeholder="login.passwordPlaceholder"]').setValue('secret')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  expect(mocks.logout).not.toHaveBeenCalled()
  expect(mocks.login).toHaveBeenCalledWith('admin', 'secret', undefined)
  wrapper.unmount()
})
