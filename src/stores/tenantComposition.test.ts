// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { ElInput } from 'element-plus'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useDirtyForm } from '@/composables/useDirtyForm'
import { useTenantStore } from './tenant'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
})

function formWithInput() {
  const value = ref('')
  const wrapper = mount(
    defineComponent({
      setup() {
        useDirtyForm(value)
        return () =>
          h(ElInput, {
            modelValue: value.value,
            'onUpdate:modelValue': (v: string) => {
              value.value = v
            },
          })
      },
    }),
    { attachTo: document.body },
  )
  return { value, wrapper, input: wrapper.get('input').element }
}

it('输入法组合中 v-model 尚为空时也确认，期间原生输入变化则中止切换', async () => {
  const tenant = useTenantStore()
  tenant.setTenantId('tenant-a')
  const { value, wrapper, input } = formWithInput()
  input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  input.value = '中'
  input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
  expect(value.value).toBe('')
  let finish!: (accepted: boolean) => void
  const confirm = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve
      }),
  )
  const changed = vi.fn()
  const pending = tenant.requestTenantSwitch('tenant-b', confirm, changed)
  expect(confirm).toHaveBeenCalledOnce()
  input.value = '中文'
  input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
  finish(true)
  expect(await pending).toBe(false)
  expect(tenant.tenantId).toBe('tenant-a')
  expect(changed).toHaveBeenCalledOnce()
  input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
  wrapper.unmount()
})

it('compositionend 到模型提交间仍视为有草稿', async () => {
  const tenant = useTenantStore()
  tenant.setTenantId('tenant-a')
  const { value, wrapper, input } = formWithInput()
  input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  input.value = '草稿'
  input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
  input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
  const confirm = vi.fn(async () => false)
  expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(false)
  expect(confirm).toHaveBeenCalledOnce()
  await nextTick()
  expect(value.value).toBe('草稿')
  wrapper.unmount()
})

it('普通筛选框非组合输入不触发切换确认', async () => {
  const tenant = useTenantStore()
  tenant.setTenantId('tenant-a')
  const input = document.createElement('input')
  document.body.appendChild(input)
  input.value = 'filter'
  input.dispatchEvent(new InputEvent('input', { bubbles: true }))
  const confirm = vi.fn(async () => false)
  expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(true)
  expect(confirm).not.toHaveBeenCalled()
  input.remove()
})

it('已有草稿确认期间开始并结束另一处输入法组合时不切换', async () => {
  const tenant = useTenantStore()
  tenant.setTenantId('tenant-a')
  const { value, wrapper, input } = formWithInput()
  value.value = 'draft'
  let finish!: (accepted: boolean) => void
  const pending = tenant.requestTenantSwitch(
    'tenant-b',
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  input.value = '新'
  input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
  input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
  finish(true)
  expect(await pending).toBe(false)
  expect(tenant.tenantId).toBe('tenant-a')
  wrapper.unmount()
})
