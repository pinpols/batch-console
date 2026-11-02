// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { ElInput } from 'element-plus'
import { reactive } from 'vue'
import MExecutionLog from './MExecutionLog.vue'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  replace: vi.fn(),
  route: null as unknown as { query: { traceId?: string } },
  tenant: null as unknown as { tenantId: string },
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.tenant }))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: { value: {} } }),
}))
vi.mock('@/api/observabilityQueries', () => ({ queryAuditsPage: mocks.query }))
vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))

enableAutoUnmount(afterEach)
beforeEach(() => {
  mocks.query.mockReset().mockResolvedValue({ items: [], total: 0 })
  mocks.route = reactive({ query: {} })
  mocks.tenant = reactive({ tenantId: 'tenant-a' })
  mocks.replace.mockReset().mockImplementation(({ query }) => {
    mocks.route.query = query
    return Promise.resolve()
  })
})

function render() {
  return shallowMount(MExecutionLog, {
    global: {
      stubs: {
        MPullRefresh: { template: '<div><slot /></div>' },
        ElInput,
      },
    },
  })
}

describe('移动执行日志 Trace 查询', () => {
  it('输入后回车只查询一次，再次回车、失焦和清空仍能查询', async () => {
    const wrapper = render()
    await flushPromises()
    const input = wrapper.get('input')

    input.element.value = '  trace-123  '
    await input.trigger('input')
    // Chrome 对修改后的文本输入依次派发 keydown、change 和 keyup。
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('change')
    await input.trigger('keydown', { key: 'Enter', repeat: true })
    await input.trigger('keyup', { key: 'Enter' })
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.query).toHaveBeenLastCalledWith('tenant-a', 1, 30, { traceId: 'trace-123' })

    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('keyup', { key: 'Enter' })
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(3)
    expect(mocks.query).toHaveBeenLastCalledWith('tenant-a', 1, 30, { traceId: 'trace-123' })

    await input.setValue('trace-456')
    await input.trigger('blur')
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(4)
    expect(mocks.query).toHaveBeenLastCalledWith('tenant-a', 1, 30, { traceId: 'trace-456' })

    await wrapper.get('.el-input__clear').trigger('click')
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(5)
    expect(mocks.query).toHaveBeenLastCalledWith('tenant-a', 1, 30, undefined)
  })

  it('输入法组合期间回车选词不触发查询，组合完成后可正常查询', async () => {
    const wrapper = render()
    await flushPromises()
    const input = wrapper.get('input')

    await input.trigger('compositionstart')
    input.element.value = 'trace-中文'
    await input.trigger('input')
    await input.trigger('keydown', { key: 'Enter', isComposing: true })
    await input.trigger('change')
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(1)
    await input.trigger('compositionend')
    await input.trigger('keyup', { key: 'Enter' })
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(1)

    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('change')
    await input.trigger('keyup', { key: 'Enter' })
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.query).toHaveBeenLastCalledWith('tenant-a', 1, 30, { traceId: 'trace-中文' })
  })

  it('输入法组合期间的变更在组合结束后失焦时提交一次', async () => {
    const wrapper = render()
    await flushPromises()
    const input = wrapper.get('input')

    await input.trigger('compositionstart')
    input.element.value = 'trace-中文'
    await input.trigger('input')
    await input.trigger('keydown', { key: 'Enter', isComposing: true })
    await input.trigger('change')
    await input.trigger('compositionend')
    await input.trigger('keyup', { key: 'Enter' })
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(1)
    await input.trigger('blur')
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.query).toHaveBeenLastCalledWith('tenant-a', 1, 30, { traceId: 'trace-中文' })
  })

  it('组合尚未结束时失焦，待组合结束后提交最终值', async () => {
    const wrapper = render()
    await flushPromises()
    const input = wrapper.get('input')

    await input.trigger('compositionstart')
    input.element.value = 'trace-中文'
    await input.trigger('input')
    await input.trigger('change')
    await input.trigger('blur')
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(1)
    await input.trigger('compositionend')
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.query).toHaveBeenLastCalledWith('tenant-a', 1, 30, { traceId: 'trace-中文' })
  })

  it('租户切换后旧租户组合期间的延迟变更不再次提交', async () => {
    const wrapper = render()
    await flushPromises()
    const input = wrapper.get('input')

    await input.trigger('compositionstart')
    input.element.value = 'trace-中文'
    await input.trigger('input')
    await input.trigger('keydown', { key: 'Enter', isComposing: true })
    await input.trigger('change')
    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.query).toHaveBeenLastCalledWith('tenant-b', 1, 30, { traceId: 'trace-中文' })
    await input.trigger('compositionend')
    await input.trigger('keyup', { key: 'Enter' })
    await input.trigger('blur')
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(2)
  })

  it('没有当前租户时搜索不发请求，选定租户后按当前条件加载', async () => {
    const wrapper = render()
    await flushPromises()
    mocks.tenant.tenantId = ''
    await flushPromises()
    const input = wrapper.get('input')
    input.element.value = 'trace-new'
    await input.trigger('input')
    await input.trigger('keydown', { key: 'Enter' })
    await input.trigger('change')
    await input.trigger('keyup', { key: 'Enter' })
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(1)

    mocks.tenant.tenantId = 'tenant-b'
    await flushPromises()
    expect(mocks.query).toHaveBeenCalledTimes(2)
    expect(mocks.query).toHaveBeenLastCalledWith('tenant-b', 1, 30, { traceId: 'trace-new' })
  })
})
