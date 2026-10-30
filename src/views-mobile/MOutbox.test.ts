// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import MOutbox from './MOutbox.vue'

const mocks = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  permission: null as unknown as { allowed: boolean },
  query: vi.fn(),
  republish: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))
vi.mock('@/composables/useAutoRefresh', () => ({ useAutoRefresh: vi.fn() }))
vi.mock('@/composables/usePermission', async () => {
  const { computed } = await import('vue')
  return { usePermission: () => ({ canMutateConfig: computed(() => mocks.permission.allowed) }) }
})
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/api/observabilityQueries', () => ({ queryOutboxRetries: mocks.query }))
vi.mock('@/api/ops', () => ({ republishOutbox: mocks.republish }))

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.permission = reactive({ allowed: true })
  mocks.query
    .mockReset()
    .mockResolvedValue([
      { id: 7, outboxEventId: 42, tenantId: 'tenant-a', retryStatus: 'FAILED', eventType: 'test' },
    ])
  mocks.republish
    .mockReset()
    .mockResolvedValue({ tenantId: 'tenant-a', requestedCount: 1, resetCount: 1 })
})
function render() {
  return shallowMount(MOutbox, {
    global: {
      stubs: {
        MPullRefresh: { template: '<div><slot /></div>' },
        ElSegmented: {
          template: `<div><button class="show-giveup" @click="$emit('update:modelValue', 'giveup')" /><button class="show-pending" @click="$emit('update:modelValue', 'pending')" /><button class="show-published" @click="$emit('update:modelValue', 'published')" /></div>`,
        },
      },
    },
  })
}

describe('移动 Outbox 重投', () => {
  it('耗尽状态的重试记录可进入重投', async () => {
    mocks.query.mockResolvedValueOnce([
      {
        id: 7,
        outboxEventId: 42,
        tenantId: 'tenant-a',
        retryStatus: 'EXHAUSTED',
        eventType: 'test',
      },
    ])
    const wrapper = render()
    await flushPromises()
    await wrapper.find('.show-giveup').trigger('click')
    const button = wrapper.find('[data-track="outbox.republish"]')
    expect(button.exists()).toBe(true)
    await button.trigger('click')
    await flushPromises()
    expect(mocks.republish).toHaveBeenCalledWith('tenant-a', [42])
  })

  it.each([
    ['pending', 'WAITING'],
    ['published', 'SUCCESS'],
  ])('%s 筛选展示重试日志 %s 状态', async (filter, status) => {
    mocks.query.mockResolvedValueOnce([
      {
        id: 7,
        outboxEventId: 42,
        tenantId: 'tenant-a',
        retryStatus: status,
        eventType: 'matched-event',
      },
    ])
    const wrapper = render()
    await flushPromises()
    await wrapper.find(`.show-${filter}`).trigger('click')
    expect(wrapper.text()).toContain('matched-event')
    expect(wrapper.find('[data-track="outbox.republish"]').exists()).toBe(false)
  })

  it('使用事件 ID 而不是重试日志 ID', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper.find('[data-track="outbox.republish"]').trigger('click')
    await flushPromises()
    expect(mocks.republish).toHaveBeenCalledWith('tenant-a', [42])
  })

  it('服务端未重置事件时不报告成功', async () => {
    mocks.republish.mockResolvedValueOnce({
      tenantId: 'tenant-a',
      requestedCount: 1,
      resetCount: 0,
    })
    const wrapper = render()
    await flushPromises()
    await wrapper.find('[data-track="outbox.republish"]').trigger('click')
    await flushPromises()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalled()
  })

  it('切换租户后旧请求不能覆盖新租户的事件', async () => {
    let finishOld!: (value: unknown[]) => void
    mocks.query.mockImplementation((tenantId: string) => {
      if (tenantId === 'tenant-a')
        return new Promise((resolve) => {
          finishOld = resolve
        })
      return Promise.resolve([
        {
          id: 8,
          outboxEventId: 43,
          tenantId: 'tenant-b',
          retryStatus: 'FAILED',
          eventType: 'new-event',
        },
      ])
    })
    const wrapper = render()
    await flushPromises()
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    finishOld([
      {
        id: 7,
        outboxEventId: 42,
        tenantId: 'tenant-a',
        retryStatus: 'FAILED',
        eventType: 'old-event',
      },
    ])
    await flushPromises()
    expect(wrapper.text()).toContain('new-event')
    expect(wrapper.text()).not.toContain('old-event')
  })

  it('没有写权限时不展示重投入口', async () => {
    mocks.permission.allowed = false
    const wrapper = render()
    await flushPromises()
    expect(wrapper.find('[data-track="outbox.republish"]').exists()).toBe(false)
  })

  it('切换租户后不显示旧租户重投结果', async () => {
    let finish!: (value: { tenantId: string; requestedCount: number; resetCount: number }) => void
    mocks.republish.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await wrapper.find('[data-track="outbox.republish"]').trigger('click')
    mocks.tenant.tenantId = 'tenant-b'
    finish({ tenantId: 'tenant-a', requestedCount: 1, resetCount: 1 })
    await flushPromises()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(ElMessage.warning).not.toHaveBeenCalled()
  })
})
