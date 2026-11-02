// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ElementPlus from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { useTenantStore } from '@/stores/tenant'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CalendarMiniCreateDrawer from './CalendarMiniCreateDrawer.vue'
import WindowMiniCreateDrawer from './WindowMiniCreateDrawer.vue'

const api = vi.hoisted(() => ({ createCalendar: vi.fn(), createBatchWindow: vi.fn() }))
vi.mock('@/api/governance', () => ({ governanceApi: api }))

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      common: { maxLength: '最多 {max} 个字符' },
      jobConfigBasic: { miniTimezoneRequired: '请选择时区' },
    },
  },
  missingWarn: false,
})

describe.each([
  ['calendar', CalendarMiniCreateDrawer, api.createCalendar],
  ['window', WindowMiniCreateDrawer, api.createBatchWindow],
] as const)('%s 快捷创建时区长度', (_kind, Component, submitApi) => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTenantStore().setTenantId('tenant-a')
    api.createCalendar.mockReset()
    api.createBatchWindow.mockReset()
  })

  it.each([['x'.repeat(65)], ['😀'.repeat(33)]])(
    '拒绝超出后端 UTF-16 64 上限的时区',
    async (timezone) => {
      const wrapper = mount(Component, {
        props: { tenantId: 'tenant-a', visible: true },
        global: { plugins: [i18n, ElementPlus] },
      })
      await flushPromises()
      const state = (
        wrapper.vm.$ as unknown as {
          setupState: {
            form: Record<string, unknown>
            submit: () => Promise<void>
          }
        }
      ).setupState
      const validFields =
        _kind === 'calendar'
          ? { calendarCode: 'CAL', calendarName: 'Name' }
          : { windowCode: 'WIN', windowName: 'Name', startTime: '09:00:00', endTime: '17:00:00' }
      Object.assign(state.form, validFields, { timezone })
      await state.submit()
      await flushPromises()
      expect(submitApi).not.toHaveBeenCalled()
      wrapper.unmount()
    },
  )

  it('允许 64 个 UTF-16 单位通过长度校验', async () => {
    submitApi.mockResolvedValue({})
    const wrapper = mount(Component, {
      props: { tenantId: 'tenant-a', visible: true },
      global: { plugins: [i18n, ElementPlus] },
    })
    await flushPromises()
    const state = (
      wrapper.vm.$ as unknown as {
        setupState: {
          form: Record<string, unknown>
          submit: () => Promise<void>
        }
      }
    ).setupState
    const validFields =
      _kind === 'calendar'
        ? { calendarCode: 'CAL', calendarName: 'Name' }
        : { windowCode: 'WIN', windowName: 'Name', startTime: '09:00:00', endTime: '17:00:00' }
    Object.assign(state.form, validFields, { timezone: 'x'.repeat(64) })
    await state.submit()
    await flushPromises()
    expect(submitApi).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('校验期间切换租户再切回，旧表单不发送创建请求', async () => {
    const wrapper = mount(Component, {
      props: { tenantId: 'tenant-a', visible: true },
      global: { plugins: [i18n, ElementPlus] },
    })
    await flushPromises()
    const state = (
      wrapper.vm.$ as unknown as {
        setupState: {
          formRef: { validate: () => Promise<boolean> }
          submit: () => Promise<void>
        }
      }
    ).setupState
    let finish!: (valid: boolean) => void
    vi.spyOn(state.formRef, 'validate').mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const pending = state.submit()
    useTenantStore().setTenantId('tenant-b')
    useTenantStore().setTenantId('tenant-a')
    finish(true)
    await pending
    expect(submitApi).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
