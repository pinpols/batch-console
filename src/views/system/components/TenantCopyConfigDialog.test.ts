// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { computed, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ElMessage } from 'element-plus'
import TenantCopyConfigDialog from './TenantCopyConfigDialog.vue'

const state = vi.hoisted(() => ({
  copy: vi.fn(),
  preview: vi.fn(),
  overlay: vi.fn(),
  matrix: vi.fn(),
  validate: vi.fn(),
  context: null as unknown as { actor: string; writer: boolean; frozen: boolean },
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
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
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
    vi.clearAllMocks()
    state.context = reactive({ actor: 'operator', writer: true, frozen: false })
    state.validate.mockReset().mockResolvedValue(true)
    state.copy.mockReset().mockResolvedValue(success())
    state.preview.mockReset().mockResolvedValue(diff())
    state.overlay.mockReset().mockResolvedValue(diff())
    state.matrix.mockReset().mockResolvedValue({ rows: [{ tenantId: 'current-matrix' }] })
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
    })
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
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
