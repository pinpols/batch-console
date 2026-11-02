// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/locales'
import ApiKeyList from './ApiKeyList.vue'

const record = { id: 1, keyName: 'preview-key', scopes: 'worker.read', enabled: false }
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'sample' }) }))
vi.mock('@/composables/useWriteAvailability', async () => {
  const { ref } = await import('vue')
  return {
    useWriteAvailability: () => ({ writesFrozen: ref(false), ensureWriteAvailable: () => true }),
  }
})
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/api/apiKeys', () => ({
  listApiKeys: vi.fn(async () => [record]),
  getApiKey: vi.fn(async () => record),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
}))

afterEach(() => document.body.replaceChildren())

describe('API Key 状态展示', () => {
  it.each([
    ['zh-CN', '停用'],
    ['en-US', 'Disabled'],
  ] as const)('列表和详情使用同一状态文案（%s）', async (locale, label) => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    await router.push('/')
    await router.isReady()
    const originalLocale = i18n.global.locale.value
    i18n.global.locale.value = locale
    const wrapper = mount(ApiKeyList, {
      attachTo: document.body,
      global: {
        plugins: [createPinia(), router, i18n, ElementPlus],
        stubs: { transition: false },
        directives: { 'track-click': () => {} },
      },
    })
    try {
      await vi.waitFor(() => expect(wrapper.text()).toContain(label))
      const detailButton = wrapper
        .findAll('button')
        .find((button) => button.text() === i18n.global.t('apiKeyList.actionDetail'))
      expect(detailButton).toBeDefined()
      await detailButton!.trigger('click')
      await flushPromises()
      const drawers = Array.from(document.querySelectorAll('.el-drawer'))
      const detailDrawer = drawers.find((drawer) =>
        drawer.textContent?.includes(i18n.global.t('apiKeyList.detailTitle')),
      )
      expect(detailDrawer?.textContent).toContain(label)
    } finally {
      wrapper.unmount()
      i18n.global.locale.value = originalLocale
    }
  })
})
