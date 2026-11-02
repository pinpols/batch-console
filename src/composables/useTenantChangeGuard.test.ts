// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { expect, it, vi } from 'vitest'
import { useTenantStore } from '@/stores/tenant'
import { useTenantChangeGuard } from './useTenantChangeGuard'

it('只在 KeepAlive 页面激活时检查草稿，重新激活后恢复检查', async () => {
  setActivePinia(createPinia())
  const tenant = useTenantStore()
  tenant.setTenantId('tenant-a')
  const active = ref(true)
  const page = defineComponent({
    setup() {
      useTenantChangeGuard(
        () => true,
        () => true,
      )
      return () => h('div', 'draft')
    },
  })
  const wrapper = mount(
    defineComponent({
      setup: () => () => h(KeepAlive, null, () => (active.value ? h(page) : null)),
    }),
  )
  const confirm = vi.fn(async () => false)
  expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(false)
  active.value = false
  await nextTick()
  expect(await tenant.requestTenantSwitch('tenant-b', confirm)).toBe(true)
  active.value = true
  await nextTick()
  expect(await tenant.requestTenantSwitch('tenant-c', confirm)).toBe(false)
  wrapper.unmount()
  expect(await tenant.requestTenantSwitch('tenant-c', confirm)).toBe(true)
  expect(confirm).toHaveBeenCalledTimes(2)
})
