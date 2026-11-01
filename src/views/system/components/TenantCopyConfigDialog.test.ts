// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ElMessage } from 'element-plus'
import TenantCopyConfigDialog from './TenantCopyConfigDialog.vue'
import {
  createConfigBatchRecovery,
  listConfigBatchRecoveries,
  saveConfigBatchRecovery,
} from '@/utils/configBatchRecovery'
import { STORAGE_KEYS } from '@/constants/storageKeys'

const state = vi.hoisted(() => ({
  copy: vi.fn(),
  preview: vi.fn(),
  overlay: vi.fn(),
  matrix: vi.fn(),
  recover: vi.fn(),
  confirm: vi.fn(),
  validate: vi.fn(),
  useRealTenant: false,
  context: null as unknown as { actor: string; tenant: string; writer: boolean; frozen: boolean },
}))
vi.mock('@/api/configBatchRecovery', () => ({
  getConfigBatchOperation: state.recover,
}))
vi.mock('@/api/ops', () => ({
  copyTenantConfig: state.copy,
  previewTenantConfigCopy: state.preview,
  previewTenantConfigOverlay: state.overlay,
  compareTenantJobConfigMatrix: state.matrix,
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get userInfo() {
      return { username: state.context.actor }
    },
  }),
}))
vi.mock('@/stores/tenant', async (original) => {
  const actual = await original<typeof import('@/stores/tenant')>()
  return {
    useTenantStore: () => state.useRealTenant ? actual.useTenantStore() : {
      get tenantId() {
        return state.context.tenant
      },
    },
  }
})
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({
    canManageSystem: computed(() => state.context.writer),
    canWriteSystem: computed(() => state.context.writer && !state.context.frozen),
  }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), warning: vi.fn() },
  ElMessageBox: { confirm: state.confirm },
}))
vi.mock('@/composables/useFormValidate', async () => {
  const { ref } = await import('vue')
  return {
    useFormValidate: () => ({ formRef: ref(null), validate: state.validate }),
    rules: { required: () => ({}) },
  }
})
const slot = { template: '<div><slot /><slot name="footer" /></div>' }
const stubs = {
  ElDrawer: slot,
  ElForm: slot,
  ElFormItem: slot,
  ElAlert: slot,
  ElTag: slot,
  ElRadioGroup: slot,
  ElRadio: true,
  ElCheckboxGroup: slot,
  ElCheckbox: true,
  ElOption: true,
  ElTabs: slot,
  ElTabPane: slot,
  ElCollapse: slot,
  ElCollapseItem: slot,
  ElTable: { props: ['data'], template: '<pre>{{ JSON.stringify(data) }}</pre>' },
  ElTableColumn: true,
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
  ElInputTag: {
    name: 'ElInputTag',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
  ElButton: { template: '<button><slot /></button>' },
}
function pending<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
function diff(marker = 'current-preview') {
  return { summary: { targetTenantCount: 1 }, tenants: [{ tenantId: marker, items: [] }] }
}
function success() {
  return {
    totalTenants: 1,
    successTenants: 1,
    failureTenants: 0,
    results: [{ tenantId: 'target-a', success: true }],
  }
}
async function open() {
  const wrapper = mount(TenantCopyConfigDialog, {
    props: { modelValue: false, items: [] },
    global: { stubs },
  })
  await wrapper.setProps({ modelValue: true })
  const selects = wrapper.findAllComponents({ name: 'ElSelect' })
  selects[0]!.vm.$emit('update:modelValue', 'source-a')
  selects[1]!.vm.$emit('update:modelValue', ['target-a'])
  wrapper.findComponent({ name: 'ElInputTag' }).vm.$emit('update:modelValue', ['JOB_A'])
  await flushPromises()
  return wrapper
}
async function click(wrapper: Awaited<ReturnType<typeof open>>, action: string) {
  await wrapper
    .findAll('button')
    .find((button) => button.text() === action)!
    .trigger('click')
  await flushPromises()
}
function changeSource(wrapper: Awaited<ReturnType<typeof open>>, value = 'source-b') {
  wrapper.findAllComponents({ name: 'ElSelect' })[0]!.vm.$emit('update:modelValue', value)
}
const previews = [
  { action: 'tenantCopyConfigDialog.btnCopyPreview', api: state.preview, marker: 'stale-copy' },
  {
    action: 'tenantCopyConfigDialog.btnOverlayPreview',
    api: state.overlay,
    marker: 'stale-overlay',
  },
  { action: 'tenantCopyConfigDialog.btnMatrix', api: state.matrix, marker: 'stale-matrix' },
]

describe('租户复制的输入与异步结果边界', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    sessionStorage.clear()
    localStorage.setItem(STORAGE_KEYS.tenantId, 'tenant-a')
    state.useRealTenant = false
    state.context = reactive({ actor: 'operator', tenant: 'tenant-a', writer: true, frozen: false })
    state.validate.mockReset().mockResolvedValue(true)
    state.copy.mockReset().mockResolvedValue(success())
    state.preview.mockReset().mockResolvedValue(diff())
    state.overlay.mockReset().mockResolvedValue(diff())
    state.matrix.mockReset().mockResolvedValue({ rows: [{ tenantId: 'current-matrix' }] })
    state.recover.mockReset()
    state.confirm.mockReset().mockResolvedValue('confirm')
  })

  it.each(['close', 'input', 'actor', 'permission', 'maintenance', 'unmount'])(
    '正式复制校验期间 %s 后不续发旧操作',
    async (change) => {
      const validation = pending<boolean>()
      state.validate.mockReturnValueOnce(validation.promise)
      const wrapper = await open()
      await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
      if (change === 'close') await wrapper.setProps({ modelValue: false })
      if (change === 'input') changeSource(wrapper)
      if (change === 'actor') state.context.actor = 'another-operator'
      if (change === 'permission') state.context.writer = false
      if (change === 'maintenance') state.context.frozen = true
      if (change === 'unmount') wrapper.unmount()
      validation.resolve(true)
      await flushPromises()
      expect(state.copy).not.toHaveBeenCalled()
      if (change !== 'unmount') wrapper.unmount()
    },
  )

  it('等待校验时重复点击只提交一次', async () => {
    const validation = pending<boolean>()
    state.validate.mockReturnValue(validation.promise)
    const wrapper = await open()
    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
    expect(state.validate).toHaveBeenCalledTimes(1)
    validation.resolve(true)
    await flushPromises()
    expect(state.copy).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('旧复制响应不关闭重开后的面板或投递旧结果', async () => {
    const request = pending<ReturnType<typeof success>>()
    state.copy.mockReturnValueOnce(request.promise)
    const wrapper = await open()
    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    request.resolve(success())
    await flushPromises()
    expect(wrapper.emitted('result')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toHaveLength(1)
    wrapper.unmount()
  })

  it.each(previews)('$action 的迟到结果不恢复修改前的预览', async ({ action, api, marker }) => {
    const request = pending<object>()
    api.mockReturnValueOnce(request.promise)
    const wrapper = await open()
    await click(wrapper, action)
    changeSource(wrapper)
    request.resolve(action.endsWith('btnMatrix') ? { rows: [{ tenantId: marker }] } : diff(marker))
    await flushPromises()
    expect(wrapper.text()).not.toContain(marker)
    wrapper.unmount()
  })

  it('编辑输入时立即清除已展示差异', async () => {
    state.preview.mockResolvedValueOnce(diff('old-input-preview'))
    const wrapper = await open()
    await click(wrapper, 'tenantCopyConfigDialog.btnCopyPreview')
    expect(wrapper.text()).toContain('old-input-preview')
    changeSource(wrapper)
    await flushPromises()
    expect(wrapper.text()).not.toContain('old-input-preview')
    wrapper.unmount()
  })

  it('旧预览不能覆盖关闭重开后的最新预览', async () => {
    const old = pending<object>()
    state.preview.mockReturnValueOnce(old.promise).mockResolvedValueOnce(diff('latest-preview'))
    const wrapper = await open()
    await click(wrapper, 'tenantCopyConfigDialog.btnCopyPreview')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    changeSource(wrapper, 'source-b')
    await flushPromises()
    await click(wrapper, 'tenantCopyConfigDialog.btnCopyPreview')
    expect(wrapper.text()).toContain('latest-preview')
    old.resolve(diff('stale-reopened-preview'))
    await flushPromises()
    expect(wrapper.text()).toContain('latest-preview')
    expect(wrapper.text()).not.toContain('stale-reopened-preview')
    wrapper.unmount()
  })

  it('正常正式复制提交明确目标并按完整成功结果关闭', async () => {
    const wrapper = await open()
    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
    expect(state.copy).toHaveBeenCalledExactlyOnceWith({
      sourceTenantId: 'source-a',
      targetTenantIds: ['target-a'],
      configTypes: undefined,
      jobCodes: ['JOB_A'],
      mode: 'SKIP_EXISTING',
      dryRun: false,
    }, expect.any(String))
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toHaveLength(0)
    wrapper.unmount()
  })

  it('成功响应后的本地清理失败保留记录并提示', async () => {
    const request = pending<ReturnType<typeof success>>()
    state.copy.mockReturnValueOnce(request.promise)
    const wrapper = await open()
    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    request.resolve(success())
    await flushPromises()

    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toHaveLength(1)
    expect(ElMessage.warning).toHaveBeenCalledWith(
      'tenantCopyConfigDialog.recoveryStorageUnavailable',
    )
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('正式复制存在业务失败时保留原请求身份', async () => {
    state.copy.mockResolvedValueOnce({
      totalTenants: 1,
      successTenants: 0,
      failureTenants: 1,
      results: [{ tenantId: 'target-a', success: false }],
    })
    const wrapper = await open()

    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')

    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it.each([
    { description: '网络中断', error: { code: 'ERR_NETWORK' } },
    { description: '服务端异常', error: { response: { status: 500 } } },
    { description: '幂等或状态冲突', error: { response: { status: 409 } } },
  ])('正式复制$description 后提示先核实目标，不能假定未执行', async ({ error }) => {
    state.copy.mockRejectedValueOnce(error)
    const wrapper = await open()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
    expect(ElMessage.warning).toHaveBeenCalledWith('tenantCopyConfigDialog.unknownOutcome')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it('复制参数被明确拒绝时不提示结果未知', async () => {
    state.copy.mockRejectedValueOnce({ response: { status: 400 } })
    const wrapper = await open()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
    expect(ElMessage.warning).not.toHaveBeenCalledWith('tenantCopyConfigDialog.unknownOutcome')
    wrapper.unmount()
  })

  it('试运行中断不提示正式复制结果未知', async () => {
    state.copy.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    const wrapper = await open()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'tenantConfigShared.dryRunPreviewDiff')
    expect(ElMessage.warning).not.toHaveBeenCalledWith('tenantCopyConfigDialog.unknownOutcome')
    wrapper.unmount()
  })

  it('正式复制无法保存原请求身份时提示并阻止写请求', async () => {
    const wrapper = await open()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')

    expect(state.copy).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledWith(
      'tenantCopyConfigDialog.recoveryStorageUnavailable',
    )
    wrapper.unmount()
  })

  it('租户状态与请求租户不一致时提示刷新并阻止正式复制', async () => {
    const wrapper = await open()
    localStorage.setItem(STORAGE_KEYS.tenantId, 'tenant-b')

    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')

    expect(state.copy).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledWith(
      'tenantCopyConfigDialog.recoveryTenantMismatch',
    )
    wrapper.unmount()
  })

  it('无法读取请求租户时阻止正式复制', async () => {
    const wrapper = await open()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')

    expect(state.copy).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledWith(
      'tenantCopyConfigDialog.recoveryTenantMismatch',
    )
    wrapper.unmount()
  })

  it('响应丢失后刷新面板并只读回查，展示已确认失败而不重复提交', async () => {
    state.copy.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    const first = await open()
    first.vm.$.appContext.config.errorHandler = vi.fn()
    await click(first, 'tenantCopyConfigDialog.btnRunFormal')
    const key = state.copy.mock.calls[0]?.[1]
    expect(key).toEqual(expect.any(String))
    first.unmount()
    state.recover.mockResolvedValueOnce({
      operationId: 'op-original', operationKind: 'TENANT_COPY', responseMetadata: {},
      status: 'COMPLETE',
      targets: [{ ordinal: 0, tenantId: 'target-a', status: 'COMPLETE',
        result: { tenantId: 'target-a', success: false, errorMessage: '真实失败原因' } }],
    })

    const reopened = await open()
    expect(reopened.text()).toContain('source-a')
    await click(reopened, 'tenantCopyConfigDialog.recoveryQuery')

    expect(state.recover).toHaveBeenCalledOnce()
    expect(state.recover.mock.calls[0]?.[0].key).toBe(key)
    expect(reopened.text()).toContain('op-original')
    expect(reopened.text()).toContain('tenantCopyConfigDialog.recoveryFailed')
    expect(reopened.text()).toContain('真实失败原因')
    expect(state.copy).toHaveBeenCalledTimes(1)
    reopened.unmount()
  })

  it('回查 404 保留原请求身份，不能清除或重发', async () => {
    const command = createConfigBatchRecovery({
      actor: 'operator', headerTenant: 'tenant-a', auditTenantId: 'source-a', operationKind: 'TENANT_COPY',
    })
    expect(saveConfigBatchRecovery(command)).toBe(true)
    state.recover.mockRejectedValueOnce({ response: { status: 404 } })
    const wrapper = await open()

    await click(wrapper, 'tenantCopyConfigDialog.recoveryQuery')

    expect(wrapper.findAll('button').some((button) =>
      button.text() === 'tenantCopyConfigDialog.recoveryClear')).toBe(false)
    expect(state.copy).not.toHaveBeenCalled()
    wrapper.unmount()
    const reopened = await open()
    expect(reopened.text()).toContain('source-a')
    reopened.unmount()
  })

  it('404 后只有明确确认停止跟踪才删除本地记录，且不重发', async () => {
    const command = createConfigBatchRecovery({
      actor: 'operator', headerTenant: 'tenant-a', auditTenantId: 'source-a', operationKind: 'TENANT_COPY',
    })
    expect(saveConfigBatchRecovery(command)).toBe(true)
    state.recover.mockRejectedValueOnce({ response: { status: 404 } })
    state.confirm.mockRejectedValueOnce('cancel').mockResolvedValueOnce('confirm')
    const wrapper = await open()
    await click(wrapper, 'tenantCopyConfigDialog.recoveryQuery')

    await click(wrapper, 'tenantCopyConfigDialog.recoveryStopTracking')
    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toHaveLength(1)
    await click(wrapper, 'tenantCopyConfigDialog.recoveryStopTracking')

    expect(state.confirm).toHaveBeenCalledWith(
      'tenantCopyConfigDialog.recoveryStopConfirm',
      'tenantCopyConfigDialog.recoveryStopTitle',
      { type: 'warning' },
    )
    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toHaveLength(0)
    expect(state.copy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('停止跟踪确认期间切换账号，不删除原账号记录', async () => {
    const command = createConfigBatchRecovery({
      actor: 'operator', headerTenant: 'tenant-a', auditTenantId: 'source-a', operationKind: 'TENANT_COPY',
    })
    expect(saveConfigBatchRecovery(command)).toBe(true)
    state.recover.mockRejectedValueOnce({ response: { status: 404 } })
    const confirmation = pending<string>()
    state.confirm.mockReturnValueOnce(confirmation.promise)
    const wrapper = await open()
    await click(wrapper, 'tenantCopyConfigDialog.recoveryQuery')
    await click(wrapper, 'tenantCopyConfigDialog.recoveryStopTracking')
    state.context.actor = 'another-operator'

    confirmation.resolve('confirm')
    await flushPromises()

    expect(listConfigBatchRecoveries('operator', 'tenant-a').commands).toHaveLength(1)
    expect(state.copy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('多个原请求独立回查，只清除用户确认且回执完整的那一项', async () => {
    const first = createConfigBatchRecovery({
      actor: 'operator', headerTenant: 'tenant-a', auditTenantId: 'source-a', operationKind: 'TENANT_COPY',
    })
    const second = createConfigBatchRecovery({
      actor: 'operator', headerTenant: 'tenant-a', auditTenantId: 'source-b', operationKind: 'TENANT_COPY',
    })
    expect(saveConfigBatchRecovery(first)).toBe(true)
    expect(saveConfigBatchRecovery(second)).toBe(true)
    state.recover.mockResolvedValueOnce({ operationId: 'op-first', operationKind: 'TENANT_COPY',
      responseMetadata: {}, status: 'COMPLETE',
      targets: [{ ordinal: 0, tenantId: 'target-a', status: 'COMPLETE',
        result: { tenantId: 'target-a', success: true } }] })
    const wrapper = await open()
    expect(wrapper.text()).toContain('source-a')
    expect(wrapper.text()).toContain('source-b')

    await click(wrapper, 'tenantCopyConfigDialog.recoveryQuery')
    await click(wrapper, 'tenantCopyConfigDialog.recoveryClear')

    expect(wrapper.text()).not.toContain('source-a')
    expect(wrapper.text()).toContain('source-b')
    expect(state.copy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('账号或租户切换时隐藏原记录并丢弃旧回查响应', async () => {
    const command = createConfigBatchRecovery({
      actor: 'operator', headerTenant: 'tenant-a', auditTenantId: 'source-a', operationKind: 'TENANT_COPY',
    })
    expect(saveConfigBatchRecovery(command)).toBe(true)
    const delayed = pending<object>()
    state.recover.mockReturnValueOnce(delayed.promise)
    const wrapper = await open()
    await click(wrapper, 'tenantCopyConfigDialog.recoveryQuery')
    state.context.tenant = 'tenant-b'
    delayed.resolve({ operationId: 'old-operation', operationKind: 'TENANT_COPY',
      responseMetadata: {}, status: 'COMPLETE', targets: [] })
    await flushPromises()
    expect(wrapper.text()).not.toContain('old-operation')
    expect(wrapper.text()).not.toContain('tenantCopyConfigDialog.recoveryQuery')
    state.context.tenant = 'tenant-a'
    await flushPromises()
    expect(wrapper.text()).toContain('tenantCopyConfigDialog.recoveryQuery')
    state.context.actor = 'other-user'
    await flushPromises()
    expect(wrapper.text()).not.toContain('tenantCopyConfigDialog.recoveryQuery')
    expect(state.copy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('真实租户切换后显示新租户待查记录，并撤销旧租户的在途结果', async () => {
    state.useRealTenant = true
    setActivePinia(createPinia())
    const { useTenantStore } = await vi.importActual<typeof import('@/stores/tenant')>(
      '@/stores/tenant',
    )
    const tenant = useTenantStore()
    const first = createConfigBatchRecovery({
      actor: 'operator', headerTenant: 'tenant-a', auditTenantId: 'source-a', operationKind: 'TENANT_COPY',
    })
    const second = createConfigBatchRecovery({
      actor: 'operator', headerTenant: 'tenant-b', auditTenantId: 'source-b', operationKind: 'TENANT_COPY',
    })
    expect(saveConfigBatchRecovery(first)).toBe(true)
    expect(saveConfigBatchRecovery(second)).toBe(true)
    const delayed = pending<object>()
    state.recover.mockReturnValueOnce(delayed.promise)
    const wrapper = await open()
    expect(wrapper.text()).toContain('source-a')
    await click(wrapper, 'tenantCopyConfigDialog.recoveryQuery')

    tenant.setTenantId('tenant-b')
    delayed.resolve({ operationId: 'old-operation', operationKind: 'TENANT_COPY',
      responseMetadata: {}, status: 'COMPLETE', targets: [] })
    await flushPromises()

    expect(localStorage.getItem(STORAGE_KEYS.tenantId)).toBe('tenant-b')
    expect(wrapper.text()).toContain('source-b')
    expect(wrapper.text()).not.toContain('source-a')
    expect(wrapper.text()).not.toContain('old-operation')
    wrapper.unmount()
  })

  it('切换账号后旧复制失败不向新账号提示', async () => {
    const request = pending<ReturnType<typeof success>>()
    state.copy.mockReturnValueOnce(request.promise)
    const wrapper = await open()
    wrapper.vm.$.appContext.config.errorHandler = vi.fn()
    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
    state.context.actor = 'another-operator'
    request.reject({ code: 'ERR_NETWORK' })
    await flushPromises()
    expect(ElMessage.warning).not.toHaveBeenCalledWith('tenantCopyConfigDialog.unknownOutcome')
    wrapper.unmount()
  })

  it('维护冻结POST时业务只读预览和正式复制均不发送', async () => {
    const wrapper = await open()
    state.context.frozen = true
    await click(wrapper, 'tenantCopyConfigDialog.btnCopyPreview')
    expect(state.preview).not.toHaveBeenCalled()
    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
    expect(state.copy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('旧读取收尾不能解除新预览的忙碌状态并放行写入', async () => {
    const older = pending<object>()
    const current = pending<object>()
    state.preview.mockReturnValueOnce(older.promise)
    state.overlay.mockReturnValueOnce(current.promise)
    const wrapper = await open()
    await click(wrapper, 'tenantCopyConfigDialog.btnCopyPreview')
    changeSource(wrapper)
    await flushPromises()
    await click(wrapper, 'tenantCopyConfigDialog.btnOverlayPreview')
    older.resolve(diff('older-preview'))
    await flushPromises()
    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
    expect(state.copy).not.toHaveBeenCalled()
    current.resolve(diff('current-overlay'))
    await flushPromises()
    expect(wrapper.text()).toContain('current-overlay')
    expect(wrapper.text()).not.toContain('older-preview')
    wrapper.unmount()
  })

  it('矩阵未选择作业时保持原提示且不发送请求', async () => {
    const wrapper = await open()
    wrapper.findComponent({ name: 'ElInputTag' }).vm.$emit('update:modelValue', [])
    await flushPromises()
    await click(wrapper, 'tenantCopyConfigDialog.btnMatrix')
    expect(state.matrix).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledWith(
      'tenantCopyConfigDialog.jobCodesRequiredForMatrix',
    )
    wrapper.unmount()
  })

  it('把已选目标切换为源租户时移除重合目标并阻止提交空目标', async () => {
    const wrapper = await open()
    const target = wrapper.findAllComponents({ name: 'ElSelect' })[1]!
    state.validate.mockImplementation(
      async () => (target.props('modelValue') as string[]).length > 0,
    )
    changeSource(wrapper, 'target-a')
    await flushPromises()
    expect(target.props('modelValue')).toEqual([])
    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
    expect(state.copy).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('已有重合状态即使校验回调放行也不发送复制', async () => {
    const wrapper = await open()
    const target = wrapper.findAllComponents({ name: 'ElSelect' })[1]!
    target.vm.$emit('update:modelValue', ['source-a'])
    await flushPromises()
    await click(wrapper, 'tenantCopyConfigDialog.btnRunFormal')
    expect(state.copy).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledWith('tenantCopyConfigDialog.sourceTargetOverlap')
    wrapper.unmount()
  })

  it('变更源租户只移除重合项并保留其他目标', async () => {
    const wrapper = await open()
    const target = wrapper.findAllComponents({ name: 'ElSelect' })[1]!
    target.vm.$emit('update:modelValue', ['target-a', 'target-b'])
    changeSource(wrapper, 'target-a')
    await flushPromises()
    expect(target.props('modelValue')).toEqual(['target-b'])
    wrapper.unmount()
  })
})
