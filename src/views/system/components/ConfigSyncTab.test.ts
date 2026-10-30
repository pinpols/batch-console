// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import ConfigSyncTab from './ConfigSyncTab.vue'

const { webcrypto } = await vi.importActual<{ webcrypto: Crypto }>('node:crypto')

const mocks = vi.hoisted(() => ({
  state: null as unknown as { tenantId: string; writer: boolean; writesFrozen: boolean },
  auth: null as unknown as { userInfo: { username: string } },
  export: vi.fn(),
  import: vi.fn(),
  confirm: vi.fn(),
  objectUrl: vi.fn(),
  status: vi.fn(),
  reconcile: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.state }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({
    canManageSystem: computed(() => mocks.state.writer),
    canWriteSystem: computed(() => mocks.state.writer && !mocks.state.writesFrozen),
  }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/api/configReleases', () => ({
  exportConfigSync: mocks.export,
  importConfigSync: mocks.import,
  getConfigSyncRequestStatus: mocks.status,
  reconcileConfigSyncLog: mocks.reconcile,
}))
vi.mock('@/api/tenants', () => ({ listTenants: vi.fn().mockResolvedValue({ items: [] }) }))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: mocks.confirm }))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}))
enableAutoUnmount(afterEach)
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
const pass = { template: '<section><slot /></section>' }
function render() {
  return shallowMount(ConfigSyncTab, {
    global: {
      directives: { 'track-click': () => {} },
      stubs: {
        ElForm: pass,
        ElFormItem: pass,
        ElButton: {
          props: ['disabled', 'loading'],
          template: '<button :disabled="disabled || loading"><slot /></button>',
        },
        JsonTextareaInput: {
          name: 'JsonTextareaInput',
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template:
            '<section><textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" /><slot name="actions" /></section>',
        },
        JsonPreview: { props: ['data'], template: '<pre>{{ JSON.stringify(data) }}</pre>' },
      },
    },
  })
}
function pending<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
function exportResult(key = 'private-export-a') {
  return { sourceTenantId: 'tenant-a', sourceEnv: 'default', targetEnv: 'default', bundle: { key } }
}
async function click(wrapper: ReturnType<typeof render>, key: string) {
  const button = wrapper.findAll('button').find((element) => element.text() === key)
  expect(button, key).toBeDefined()
  const enabled = button!.attributes('disabled') === undefined
  const previousConfirmations = mocks.confirm.mock.calls.length
  await button!.trigger('click')
  await flushPromises()
  if (enabled && key === 'configSyncTab.btnImport') {
    // 每次摘要计算均为异步；旧确认次数不能证明本次点击已经到达确认阶段。
    await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledTimes(previousConfirmations + 1))
    await flushPromises()
  }
}
beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('crypto', webcrypto)
  mocks.status.mockReset().mockResolvedValue({ found: false, audit: null })
  mocks.reconcile.mockReset().mockResolvedValue({
    id: 41,
    tenantId: 'tenant-a',
    syncDirection: 'IMPORT',
    syncStatus: 'RUNNING',
  })
  vi.mocked(ElMessage.success).mockClear()
  vi.mocked(ElMessage.error).mockClear()
  mocks.state = reactive({ tenantId: 'tenant-a', writer: true, writesFrozen: false })
  mocks.auth = reactive({ userInfo: { username: 'operator' } })
  mocks.export.mockReset().mockResolvedValue(exportResult())
  mocks.import.mockReset().mockResolvedValue({
    result: {
      totalTenants: 1,
      successTenants: 1,
      failureTenants: 0,
      results: [{ tenantId: 'tenant-a', success: true }],
    },
  })
  mocks.confirm.mockReset().mockResolvedValue(undefined)
  mocks.objectUrl.mockReset().mockReturnValue('blob:config-export')
  const OriginalUrl = URL
  vi.stubGlobal(
    'URL',
    class extends OriginalUrl {
      static createObjectURL = mocks.objectUrl
      static revokeObjectURL = vi.fn()
    },
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
describe('配置同步确认与输入快照一致', () => {
  it.each(['source', 'target', 'tenants', 'payload'])(
    '确认期间修改 %s 后不提交旧同步',
    async (field) => {
      const confirmation = pending<void>()
      mocks.confirm.mockReturnValueOnce(confirmation.promise)
      const wrapper = render()
      await flushPromises()
      await wrapper.get('textarea').setValue('{"key":"original"}')
      await click(wrapper, 'configSyncTab.btnImport')
      if (field === 'payload') await wrapper.get('textarea').setValue('{"key":"new"}')
      else {
        const index = field === 'source' ? 0 : field === 'target' ? 1 : 2
        wrapper
          .findAllComponents({ name: 'ElSelect' })
          [index]!.vm.$emit('update:modelValue', field === 'tenants' ? ['tenant-b'] : 'prod')
        await flushPromises()
      }
      confirmation.resolve()
      await flushPromises()
      expect(mocks.import).not.toHaveBeenCalled()
    },
  )

  it('编辑粘贴内容后迟到预览不得恢复旧差异', async () => {
    const preview = pending<object>()
    mocks.import.mockReturnValueOnce(preview.promise)
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnPreview')
    await wrapper.get('textarea').setValue('{"key":"new"}')
    preview.resolve({ diff: 'private-old-diff' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('private-old-diff')
  })

  it('导出期间经历 A→B→A 后不下载或展示旧结果', async () => {
    const exported = pending<ReturnType<typeof exportResult>>()
    mocks.export.mockReturnValueOnce(exported.promise)
    const wrapper = render()
    await flushPromises()
    await click(wrapper, 'configSyncTab.btnExport')
    mocks.state.tenantId = 'tenant-b'
    mocks.state.tenantId = 'tenant-a'
    exported.resolve(exportResult())
    await flushPromises()
    expect(mocks.objectUrl).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('private-export-a')
  })

  it('已展示的导出在租户清空后立即移除', async () => {
    const wrapper = render()
    await flushPromises()
    await click(wrapper, 'configSyncTab.btnExport')
    expect(wrapper.text()).toContain('private-export-a')
    mocks.state.tenantId = ''
    await flushPromises()
    expect(wrapper.text()).not.toContain('private-export-a')
    expect(
      wrapper.findAll('button').some((button) => button.text() === 'configSyncTab.btnCopyToTarget'),
    ).toBe(false)
  })

  it('导出环境改变后旧导出不能再复制到目标', async () => {
    const wrapper = render()
    await flushPromises()
    await click(wrapper, 'configSyncTab.btnExport')
    wrapper.findAllComponents({ name: 'ElSelect' })[0]!.vm.$emit('update:modelValue', 'prod')
    await flushPromises()
    expect(
      wrapper.findAll('button').some((button) => button.text() === 'configSyncTab.btnCopyToTarget'),
    ).toBe(false)
  })

  it('早发导出晚于预览返回时不清空最新预览', async () => {
    const exported = pending<ReturnType<typeof exportResult>>()
    mocks.export.mockReturnValueOnce(exported.promise)
    mocks.import.mockResolvedValueOnce({ diff: 'latest-preview' })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnExport')
    await click(wrapper, 'configSyncTab.btnPreview')
    expect(wrapper.text()).toContain('latest-preview')
    exported.resolve(exportResult())
    await flushPromises()
    expect(wrapper.text()).toContain('latest-preview')
  })

  it('较早预览不能在新导出完成后恢复旧结果', async () => {
    const preview = pending<object>()
    mocks.import.mockReturnValueOnce(preview.promise)
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnPreview')
    await click(wrapper, 'configSyncTab.btnExport')
    preview.resolve({ diff: 'older-preview' })
    await flushPromises()
    expect(wrapper.text()).toContain('private-export-a')
    expect(wrapper.text()).not.toContain('older-preview')
  })

  it.each(['operator', 'permission', 'maintenance'])(
    '确认期间 %s 变化使原导入失效',
    async (field) => {
      const confirmation = pending<void>()
      mocks.confirm.mockReturnValueOnce(confirmation.promise)
      const wrapper = render()
      await flushPromises()
      await wrapper.get('textarea').setValue('{"key":"original"}')
      await click(wrapper, 'configSyncTab.btnImport')
      if (field === 'operator') mocks.auth.userInfo.username = 'other-operator'
      if (field === 'permission') mocks.state.writer = false
      if (field === 'maintenance') mocks.state.writesFrozen = true
      confirmation.resolve()
      await flushPromises()
      expect(mocks.import).not.toHaveBeenCalled()
    },
  )

  it('服务端返回业务失败时不提示导入成功', async () => {
    mocks.import.mockResolvedValueOnce({
      result: {
        totalTenants: 1,
        successTenants: 0,
        failureTenants: 1,
        results: [{ tenantId: 'tenant-a', success: false }],
      },
    })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnImport')
    expect(ElMessage.error).toHaveBeenCalled()
    expect(ElMessage.success).not.toHaveBeenCalled()
  })

  it('导入响应丢失后不能用新命令再次应用同一配置', async () => {
    mocks.import.mockRejectedValueOnce(new Error('response lost after commit'))
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnImport')
    await click(wrapper, 'configSyncTab.btnImport')
    expect(mocks.import).toHaveBeenCalledTimes(1)
  })

  it('页面重新挂载后保留未知命令，不允许直接发起另一条导入', async () => {
    mocks.import.mockRejectedValueOnce(new Error('response lost after commit'))
    const first = render()
    await flushPromises()
    await first.get('textarea').setValue('{"key":"original"}')
    await click(first, 'configSyncTab.btnImport')
    first.unmount()
    const second = render()
    await flushPromises()
    await second.get('textarea').setValue('{"key":"different"}')
    await click(second, 'configSyncTab.btnImport')
    expect(mocks.import).toHaveBeenCalledTimes(1)
  })

  it('仅使用原请求键重试原输入，冲突响应继续保留未知状态', async () => {
    mocks.import.mockRejectedValueOnce(new Error('response lost'))
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnImport')
    const originalKey = mocks.import.mock.calls[0]![1]
    mocks.import.mockRejectedValueOnce({ response: { status: 409 } })
    await click(wrapper, 'configSyncTab.retryOriginal')
    await vi.waitFor(() => expect(mocks.import).toHaveBeenCalledTimes(2))
    expect(mocks.import.mock.calls[1]![1]).toBe(originalKey)
    await flushPromises()
    await click(wrapper, 'configSyncTab.btnImport')
    expect(mocks.import).toHaveBeenCalledTimes(2)
  })

  it('恢复原命令后改变输入不能用原键提交另一份配置', async () => {
    mocks.import.mockRejectedValueOnce(new Error('response lost'))
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnImport')
    await wrapper.get('textarea').setValue('{"key":"different"}')
    await click(wrapper, 'configSyncTab.retryOriginal')
    await vi.waitFor(() =>
      expect(ElMessage.warning).toHaveBeenCalledWith('configSyncTab.restoreOriginalInput'),
    )
    expect(mocks.import).toHaveBeenCalledTimes(1)
  })

  it('重新挂载后恢复原输入仍沿用原请求键', async () => {
    mocks.import.mockRejectedValueOnce(new Error('response lost'))
    const first = render()
    await flushPromises()
    await first.get('textarea').setValue('{"key":"original"}')
    await click(first, 'configSyncTab.btnImport')
    const originalKey = mocks.import.mock.calls[0]![1]
    first.unmount()
    const second = render()
    await flushPromises()
    await second.get('textarea').setValue('{"key":"original"}')
    await click(second, 'configSyncTab.retryOriginal')
    await vi.waitFor(() => expect(mocks.import).toHaveBeenCalledTimes(2))
    expect(mocks.import.mock.calls[1]![1]).toBe(originalKey)
  })

  it('未找到审计时不解除原命令或执行导入', async () => {
    mocks.import.mockRejectedValueOnce(new Error('response lost'))
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnImport')
    await click(wrapper, 'configSyncTab.checkOriginal')
    expect(mocks.status).toHaveBeenCalledWith('tenant-a', mocks.import.mock.calls[0]![1])
    expect(mocks.reconcile).not.toHaveBeenCalled()
    await click(wrapper, 'configSyncTab.btnImport')
    expect(mocks.import).toHaveBeenCalledTimes(1)
  })

  it('RUNNING 原审计按目标回执核对，结果仍未知时不放行新命令', async () => {
    mocks.import.mockRejectedValueOnce(new Error('response lost'))
    mocks.status.mockResolvedValueOnce({
      found: true,
      audit: { id: 41, tenantId: 'tenant-a', syncDirection: 'IMPORT', syncStatus: 'RUNNING' },
    })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnImport')
    await click(wrapper, 'configSyncTab.checkOriginal')
    expect(mocks.reconcile).toHaveBeenCalledExactlyOnceWith('tenant-a', 41)
    await click(wrapper, 'configSyncTab.btnImport')
    expect(mocks.import).toHaveBeenCalledTimes(1)
  })

  it('确认原审计已完成后清除恢复身份及旧输入，不再次应用业务', async () => {
    mocks.import.mockRejectedValueOnce(new Error('response lost'))
    mocks.status.mockResolvedValueOnce({
      found: true,
      audit: { id: 41, tenantId: 'tenant-a', syncDirection: 'IMPORT', syncStatus: 'SUCCESS' },
    })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnImport')
    await click(wrapper, 'configSyncTab.checkOriginal')
    expect(mocks.import).toHaveBeenCalledTimes(1)
    expect(mocks.reconcile).not.toHaveBeenCalled()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(
      wrapper.findAll('button').some((button) => button.text() === 'configSyncTab.checkOriginal'),
    ).toBe(false)
    expect(ElMessage.success).toHaveBeenCalledWith('configSyncTab.originalConfirmed')
  })

  it('核对结果租户或记录身份错误时保持未知', async () => {
    mocks.import.mockRejectedValueOnce(new Error('response lost'))
    mocks.status.mockResolvedValueOnce({
      found: true,
      audit: { id: 41, tenantId: 'tenant-b', syncDirection: 'IMPORT', syncStatus: 'SUCCESS' },
    })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnImport')
    await click(wrapper, 'configSyncTab.checkOriginal')
    expect(ElMessage.error).toHaveBeenCalledWith('configSyncTab.checkOriginalFailed')
    await click(wrapper, 'configSyncTab.btnImport')
    expect(mocks.import).toHaveBeenCalledTimes(1)
  })

  it('核对期间切换租户，迟到完成回包不清除另一租户输入或提示成功', async () => {
    const status = pending<object>()
    mocks.import.mockRejectedValueOnce(new Error('response lost'))
    mocks.status.mockReturnValueOnce(status.promise)
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnImport')
    await click(wrapper, 'configSyncTab.checkOriginal')
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"tenant-b-input"}')
    status.resolve({
      found: true,
      audit: { id: 41, tenantId: 'tenant-a', syncDirection: 'IMPORT', syncStatus: 'SUCCESS' },
    })
    await flushPromises()
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toContain(
      'tenant-b-input',
    )
    expect(ElMessage.success).not.toHaveBeenCalledWith('configSyncTab.originalConfirmed')
    mocks.state.tenantId = 'tenant-a'
    await flushPromises()
    expect(
      wrapper.findAll('button').some((button) => button.text() === 'configSyncTab.checkOriginal'),
    ).toBe(true)
  })

  it('首次请求明确参数拒绝可更正后重提，未知原请求的重试被拒仍不可解除', async () => {
    mocks.import.mockRejectedValueOnce({ response: { status: 400 } })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnImport')
    expect(
      wrapper.findAll('button').some((button) => button.text() === 'configSyncTab.checkOriginal'),
    ).toBe(false)
    mocks.import.mockRejectedValueOnce(new Error('response lost'))
    await click(wrapper, 'configSyncTab.btnImport')
    mocks.import.mockRejectedValueOnce({ response: { status: 403 } })
    await click(wrapper, 'configSyncTab.retryOriginal')
    await vi.waitFor(() => expect(mocks.import).toHaveBeenCalledTimes(3))
    await flushPromises()
    expect(
      wrapper.findAll('button').some((button) => button.text() === 'configSyncTab.checkOriginal'),
    ).toBe(true)
  })

  it('无法可靠保存原命令身份时不发导入请求', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })
    await click(wrapper, 'configSyncTab.btnImport')
    expect(mocks.import).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'ElAlert' }).props('title')).toBe(
      'configSyncTab.recoveryUnavailable',
    )
  })

  it('输入不变的正常导入保留目标、环境和粘贴配置', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper.get('textarea').setValue('{"key":"original"}')
    await click(wrapper, 'configSyncTab.btnImport')
    expect(mocks.import).toHaveBeenCalledExactlyOnceWith(
      {
        tenantId: 'tenant-a',
        sourceEnv: 'default',
        targetEnv: 'default',
        targetTenantIds: ['tenant-a'],
        bundle: { key: 'original' },
      },
      expect.any(String),
    )
  })
})
