// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ElMessage } from 'element-plus'
import { computed, reactive } from 'vue'
import TenantInitConfigDialog from './TenantInitConfigDialog.vue'

const state = vi.hoisted(() => ({
  submit: vi.fn(),
  validate: vi.fn(),
  context: null as unknown as { writer: boolean; frozen: boolean; actor: string },
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
    canWriteSystem: computed(() => state.context.writer && !state.context.frozen),
  }),
}))
vi.mock('@/api/ops', () => ({ batchInitTenantConfig: state.submit }))
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
  ElCheckboxGroup: slot,
  ElRadioGroup: slot,
  ElTag: slot,
  ElCheckbox: true,
  ElRadio: true,
  JsonTextareaInput: true,
  ElButton: { template: '<button><slot /></button>' },
}
async function open() {
  const wrapper = mount(TenantInitConfigDialog, {
    props: { modelValue: false, targetTenantId: 'selected-tenant' },
    global: { stubs },
  })
  await wrapper.setProps({ modelValue: true })
  return wrapper
}
async function submit(wrapper: Awaited<ReturnType<typeof open>>, dryRun = false) {
  const label = dryRun ? 'tenantConfigShared.dryRunPreview' : 'tenantInitConfigDialog.btnRunFormal'
  await wrapper
    .findAll('button')
    .find((button) => button.text() === label)!
    .trigger('click')
  await flushPromises()
}
function result(success: boolean, failedItems = 0) {
  return {
    totalTenants: 1,
    successTenants: success ? 1 : 0,
    failureTenants: success ? 0 : 1,
    results: [{ tenantId: 'selected-tenant', success, jobDefinitions: { failed: failedItems } }],
  }
}
function pending<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('租户初始化结果反馈', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.context = reactive({ writer: true, frozen: false, actor: 'operator' })
    state.validate.mockResolvedValue(true)
    state.submit.mockResolvedValue(result(true))
  })

  it.each([result(false), result(true, 1), null])(
    '失败、条目部分失败或无结果时不提示完成、不关闭面板：%j',
    async (response) => {
      state.submit.mockResolvedValue(response)
      const wrapper = await open()
      await submit(wrapper)
      expect(ElMessage.success).not.toHaveBeenCalled()
      expect(ElMessage.warning).toHaveBeenCalledWith('tenantInitConfigDialog.toastFailed')
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.emitted('result')).toEqual([[response]])
      wrapper.unmount()
    },
  )

  it('只有全量成功的正式执行才提示完成并关闭面板', async () => {
    const wrapper = await open()
    await submit(wrapper)
    expect(ElMessage.success).toHaveBeenCalledWith('tenantInitConfigDialog.toastDone')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    wrapper.unmount()
  })

  it('试运行结果不关闭面板或提示正式初始化完成', async () => {
    const wrapper = await open()
    await submit(wrapper, true)
    expect(ElMessage.success).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })

  it.each(['close', 'target', 'actor', 'permission', 'maintenance', 'input', 'unmount'])(
    '异步校验期间 %s 后不续发原操作',
    async (change) => {
      const validation = pending<boolean>()
      state.validate.mockReturnValueOnce(validation.promise)
      const wrapper = await open()
      await submit(wrapper)
      if (change === 'close') await wrapper.setProps({ modelValue: false })
      if (change === 'target') await wrapper.setProps({ targetTenantId: 'another-tenant' })
      if (change === 'actor') state.context.actor = 'another-operator'
      if (change === 'permission') state.context.writer = false
      if (change === 'maintenance') state.context.frozen = true
      if (change === 'input')
        wrapper
          .findComponent({ name: 'JsonTextareaInput' })
          .vm.$emit('update:modelValue', '{"resourceQueues":[]}')
      if (change === 'unmount') wrapper.unmount()
      validation.resolve(true)
      await flushPromises()
      expect(state.submit).not.toHaveBeenCalled()
      if (change !== 'unmount') wrapper.unmount()
    },
  )

  it('等待校验期间重复点击只发起一次请求', async () => {
    const validation = pending<boolean>()
    state.validate.mockReturnValue(validation.promise)
    const wrapper = await open()
    await submit(wrapper)
    await submit(wrapper)
    expect(state.validate).toHaveBeenCalledTimes(1)
    validation.resolve(true)
    await flushPromises()
    expect(state.submit).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('旧请求返回不关闭重新打开的面板或投递旧结果', async () => {
    const request = pending<ReturnType<typeof result>>()
    state.submit.mockReturnValueOnce(request.promise)
    const wrapper = await open()
    await submit(wrapper)
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true, targetTenantId: 'another-tenant' })
    request.resolve(result(true))
    await flushPromises()
    expect(wrapper.emitted('result')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(ElMessage.success).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('初次已打开的面板使用传入目标，目标变更同步展示', async () => {
    const wrapper = mount(TenantInitConfigDialog, {
      props: { modelValue: true, targetTenantId: 'selected-tenant' },
      global: { stubs },
    })
    expect(wrapper.text()).toContain('selected-tenant')
    await wrapper.setProps({ targetTenantId: 'another-tenant' })
    expect(wrapper.text()).toContain('another-tenant')
    wrapper.unmount()
  })
})
