// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/locales'
import ApiKeyList from './ApiKeyList.vue'

const createKey = vi.hoisted(() => vi.fn(async () => ({ rawKey: 'fixture-key' })))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'sample' }) }))
vi.mock('@/composables/useWriteAvailability', async () => {
  const { ref } = await import('vue')
  return {
    useWriteAvailability: () => ({ writesFrozen: ref(false), ensureWriteAvailable: () => true }),
  }
})
vi.mock('@/api/apiKeys', () => ({
  listApiKeys: vi.fn(async () => []),
  createApiKey: createKey,
  getApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
}))

afterEach(() => {
  document.body.replaceChildren()
  createKey.mockClear()
})

describe('API Key 权限范围提示', () => {
  it('提示留空会匹配全部权限范围，并保留原有留空提交语义', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()
    const locale = i18n.global.locale.value
    i18n.global.locale.value = 'zh-CN'
    const wrapper = mount(ApiKeyList, {
      attachTo: document.body,
      global: { plugins: [createPinia(), router, i18n, ElementPlus], stubs: { transition: false } },
    })
    try {
      await flushPromises()
      const button = wrapper
        .findAll('button')
        .find((item) => item.text().includes(i18n.global.t('apiKeyList.headerCreate')))
      expect(button).toBeDefined()
      await button!.trigger('click')
      await vi.waitFor(() => expect(document.querySelector('.el-drawer')).not.toBeNull())
      const drawer = document.querySelector<HTMLElement>('.el-drawer')!
      expect(drawer.textContent).toContain('留空时使用通配权限（*），匹配所有权限范围')
      const input = drawer.querySelector<HTMLInputElement>('input')!
      input.value = 'example'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      const buttons = drawer.querySelectorAll<HTMLButtonElement>('.el-drawer__footer button')
      buttons[buttons.length - 1]!.click()
      await flushPromises()
      await vi.waitFor(() =>
        expect(createKey).toHaveBeenCalledWith('sample', { keyName: 'example' }),
      )
    } finally {
      wrapper.unmount()
      i18n.global.locale.value = locale
    }
  })

  it.each([
    ['Worker 只读', 'worker.read'],
    ['Worker 执行', 'worker.execute'],
  ])('选择%s时提交精确 scope %s', async (label, scope) => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()
    const locale = i18n.global.locale.value
    i18n.global.locale.value = 'zh-CN'
    const wrapper = mount(ApiKeyList, {
      attachTo: document.body,
      global: { plugins: [createPinia(), router, i18n, ElementPlus], stubs: { transition: false } },
    })
    try {
      await flushPromises()
      const button = wrapper
        .findAll('button')
        .find((item) => item.text().includes(i18n.global.t('apiKeyList.headerCreate')))
      expect(button).toBeDefined()
      await button!.trigger('click')
      await vi.waitFor(() => expect(document.querySelector('.el-drawer')).not.toBeNull())
      const drawer = document.querySelector<HTMLElement>('.el-drawer')!
      const input = drawer.querySelector<HTMLInputElement>('input')!
      input.value = 'example'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      drawer.querySelector<HTMLElement>('.el-select')!.click()
      await vi.waitFor(() => {
        const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
        expect(options.some((option) => option.textContent?.includes(`${label} (${scope})`))).toBe(
          true,
        )
      })
      const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))
      options.find((option) => option.textContent?.includes(`${label} (${scope})`))!.click()
      await flushPromises()
      const buttons = drawer.querySelectorAll<HTMLButtonElement>('.el-drawer__footer button')
      buttons[buttons.length - 1]!.click()
      await flushPromises()
      await vi.waitFor(() =>
        expect(createKey).toHaveBeenCalledWith('sample', { keyName: 'example', scopes: scope }),
      )
    } finally {
      wrapper.unmount()
      i18n.global.locale.value = locale
    }
  })
})
