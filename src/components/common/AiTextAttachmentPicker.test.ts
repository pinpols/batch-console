// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { useTenantStore } from '@/stores/tenant'
import AiTextAttachmentPicker from './AiTextAttachmentPicker.vue'

const mocks = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/utils/aiTextAttachment', async (original) => ({
  ...(await original<typeof import('@/utils/aiTextAttachment')>()),
  readAiTextAttachment: mocks.read,
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('AiTextAttachmentPicker', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTenantStore().setTenantId('ta')
    mocks.read.mockReset()
  })

  it('读取中取消切租户保留请求，确认后旧文件不会进入新租户', async () => {
    let resolve!: (value: { name: string; content: string }) => void
    mocks.read.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const wrapper = shallowMount(AiTextAttachmentPicker, {
      props: { modelValue: null, contextRevision: 0 },
    })
    const input = wrapper.get('input')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['x'], 'a.txt')],
    })
    await input.trigger('change')
    const tenant = useTenantStore()
    expect(await tenant.requestTenantSwitch('tb', async () => false)).toBe(false)
    expect(await tenant.requestTenantSwitch('tb', async () => true)).toBe(true)
    resolve({ name: 'a.txt', content: 'old-tenant' })
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('读取期间切换会话后不向新会话写入旧文件', async () => {
    let resolve!: (value: { name: string; content: string }) => void
    mocks.read.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    const wrapper = shallowMount(AiTextAttachmentPicker, {
      props: { modelValue: null, contextRevision: 0 },
    })
    const input = wrapper.get('input')
    Object.defineProperty(input.element, 'files', {
      configurable: true,
      value: [new File(['x'], 'a.txt')],
    })
    await input.trigger('change')
    await wrapper.setProps({ contextRevision: 1 })
    resolve({ name: 'a.txt', content: 'old-session' })
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
})
