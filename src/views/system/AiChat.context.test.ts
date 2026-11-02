// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { ElMessageBox } from 'element-plus'
import { useTenantStore } from '@/stores/tenant'
import AiChat from './AiChat.vue'

const mocks = vi.hoisted(() => ({ remove: vi.fn(), page: vi.fn() }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {}, name: 'ai-chat' }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/api/ai', () => ({
  deleteAiConversation: mocks.remove,
  pageAiConversations: mocks.page,
  getAiCostSummary: vi.fn().mockResolvedValue(null),
  listAiTurns: vi.fn().mockResolvedValue([]),
  getAiCapabilities: vi.fn().mockResolvedValue(null),
  deleteAiAttachment: vi.fn(),
  getAiAttachmentByClientId: vi.fn(),
  getAiTurnByClientId: vi.fn(),
  uploadAiAttachment: vi.fn(),
}))
vi.mock('@/api/observabilityQueries', () => ({
  queryAiAuditsPage: vi.fn().mockResolvedValue({ items: [], total: 0, hasMore: false }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref(undefined) }),
}))

describe('AiChat 会话删除作用域', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTenantStore().setTenantId('ta')
    mocks.remove.mockReset().mockResolvedValue(undefined)
    mocks.page.mockReset().mockResolvedValue({ items: [], hasMore: false, nextCursor: null })
  })

  it('确认期间租户往返后不发送删除请求', async () => {
    let confirm!: () => void
    vi.spyOn(ElMessageBox, 'confirm').mockReturnValueOnce(
      new Promise((resolve) => {
        confirm = () => resolve(undefined as never)
      }),
    )
    const wrapper = shallowMount(AiChat, { global: { directives: { 'track-click': () => {} } } })
    await flushPromises()
    const vm = wrapper.vm as unknown as { removeConversation: (id: string) => Promise<void> }
    const pending = vm.removeConversation('conversation-a')
    const tenant = useTenantStore()
    tenant.setTenantId('tb')
    tenant.setTenantId('ta')
    confirm()
    await pending
    expect(mocks.remove).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('删除已发出后切换租户，旧响应不能刷新新租户页面', async () => {
    vi.spyOn(ElMessageBox, 'confirm').mockResolvedValueOnce(undefined as never)
    let finish!: () => void
    mocks.remove.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const wrapper = shallowMount(AiChat, { global: { directives: { 'track-click': () => {} } } })
    await flushPromises()
    const vm = wrapper.vm as unknown as { removeConversation: (id: string) => Promise<void> }
    const pending = vm.removeConversation('conversation-a')
    await flushPromises()
    expect(mocks.remove).toHaveBeenCalledWith('conversation-a')
    useTenantStore().setTenantId('tb')
    await flushPromises()
    const requests = mocks.page.mock.calls.length
    finish()
    await pending
    await flushPromises()
    expect(mocks.page).toHaveBeenCalledTimes(requests)
    wrapper.unmount()
  })
})
