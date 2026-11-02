// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/locales'
import SelfServiceQuotaChangeTab from './SelfServiceQuotaChangeTab.vue'

const requests = vi.hoisted(() => ({
  submit: vi.fn(async () => undefined),
  quota: vi.fn(async () => ({ items: [{ field: 'maxConcurrentJobs' }] })),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'sample' }) }))
vi.mock('@/api/tenantSelfService', () => ({
  getTenantQuota: requests.quota,
  requestQuotaChange: requests.submit,
}))

const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
})
afterAll(() => {
  if (scrollDescriptor)
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollDescriptor)
  else delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
})
afterEach(() => {
  document.body.replaceChildren()
})
beforeEach(() => {
  requests.submit.mockClear()
})

async function fillAndSubmit(value: string) {
  const wrapper = mount(SelfServiceQuotaChangeTab, {
    attachTo: document.body,
    global: {
      plugins: [i18n, ElementPlus],
      stubs: { transition: false },
      directives: { 'track-click': {} },
    },
  })
  await flushPromises()
  await wrapper.find('.el-select').trigger('click')
  await vi.waitFor(() => expect(document.querySelector('[role="option"]')).not.toBeNull())
  const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (item) => item.textContent?.includes('maxConcurrentJobs'),
  )
  expect(option).toBeDefined()
  option!.click()
  await flushPromises()
  const formItems = wrapper.findAll('.el-form-item')
  await formItems[1]!.get('input').setValue(value)
  await formItems[2]!.get('textarea').setValue('容量调整')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  return wrapper
}

describe('自助配额变更输入', () => {
  it.each(['12abc', '12.9'])('拒绝不完整的整数输入 %s', async (value) => {
    const wrapper = await fillAndSubmit(value)
    try {
      expect(requests.submit).not.toHaveBeenCalled()
      await vi.waitFor(() => expect(wrapper.find('.el-form-item__error').exists()).toBe(true))
    } finally {
      wrapper.unmount()
    }
  })

  it('合法正整数按原值提交', async () => {
    const wrapper = await fillAndSubmit('12')
    try {
      expect(requests.submit).toHaveBeenCalledWith('sample', {
        field: 'maxConcurrentJobs',
        requestedValue: 12,
        reason: '容量调整',
      })
    } finally {
      wrapper.unmount()
    }
  })
})
