// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import ConfigReleaseList from './ConfigReleaseList.vue'

const mocks = vi.hoisted(() => ({
  state: null as unknown as { tenantId: string; writer: boolean; writesFrozen: boolean },
  auth: null as unknown as { userInfo: { username: string } },
  list: vi.fn(),
  create: vi.fn(),
  rollback: vi.fn(),
  approval: vi.fn(),
  detail: vi.fn(),
  deps: vi.fn(),
  diff: vi.fn(),
  validate: vi.fn(),
  confirm: vi.fn(),
  prompt: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.state }))
vi.mock('@/composables/useTenantChangeGuard', () => ({ useTenantChangeGuard: () => {} }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canManageSystem: computed(() => mocks.state.writer) }),
}))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({ writesFrozen: computed(() => mocks.state.writesFrozen) }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref({}) }),
}))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: mocks.confirm }))
vi.mock('@/composables/useFormFocus', () => ({ useFormFocus: () => ({ focusFirst: vi.fn() }) }))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  ElMessageBox: { prompt: mocks.prompt },
}))
vi.mock('@/api/configReleases', () => ({
  listConfigReleases: mocks.list,
  createConfigRelease: mocks.create,
  rollbackRelease: mocks.rollback,
  submitReleaseApproval: mocks.approval,
  getConfigRelease: mocks.detail,
  listConfigDependencies: mocks.deps,
  diffConfigReleases: mocks.diff,
  listConfigGovernance: vi.fn().mockResolvedValue([]),
}))
enableAutoUnmount(afterEach)
const pass = { template: '<section><slot /><slot name="actions" /></section>' }
const overlay = defineComponent({
  name: 'OverlayHarness',
  props: ['modelValue', 'title'],
  setup(props, { slots }) {
    return () =>
      props.modelValue ? h('section', { 'data-title': props.title }, slots.default?.()) : null
  },
})
const form = defineComponent({
  setup(_, { slots, expose }) {
    expose({ validate: mocks.validate, clearValidate: vi.fn() })
    return () => h('form', slots.default?.())
  },
})
const stubs = {
  PageContainer: pass,
  PageHeader: pass,
  ListPageQueryBar: pass,
  ElButton: { template: '<button><slot /></button>' },
  ElDrawer: overlay,
  FormDrawer: false,
  FormSection: false,
  ElDialog: overlay,
  ElForm: form,
  ElFormItem: pass,
  ElDescriptions: pass,
  ElDescriptionsItem: pass,
  ElTable: true,
  ElTableColumn: true,
  ElPagination: true,
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue'],
    template: '<div><slot /></div>',
  },
  JsonPreview: { props: ['data'], template: '<pre>{{ JSON.stringify(data) }}</pre>' },
  ElInput: {
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue'],
    template:
      '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}
function row(status = 'PUBLISHED', key = 'release-a', tenantId = 'tenant-a') {
  return { id: 41, tenantId, configStatus: status, configKey: key, versionNo: 3, configType: 'JOB' }
}
function pending<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
function render() {
  return shallowMount(ConfigReleaseList, { global: { stubs, directives: { loading: () => {} } } })
}
async function click(wrapper: ReturnType<typeof render>, key: string) {
  const button = wrapper.findAll('button').find((element) => element.text() === key)
  expect(button, key).toBeDefined()
  await button!.trigger('click')
  await flushPromises()
}
async function fillCreate(wrapper: ReturnType<typeof render>) {
  await click(wrapper, 'configReleaseList.headerCreate')
  for (const [field, value] of Object.entries({
    Key: 'job-a',
    Type: 'JOB',
    Name: 'Job A',
    Payload: '{}',
  })) {
    await wrapper
      .get(`input[placeholder="configReleaseList.create${field}Placeholder"]`)
      .setValue(value)
  }
}
beforeEach(() => {
  mocks.state = reactive({ tenantId: 'tenant-a', writer: true, writesFrozen: false })
  mocks.auth = reactive({ userInfo: { username: 'operator' } })
  mocks.list.mockReset().mockResolvedValue([row()])
  for (const fn of [
    mocks.create,
    mocks.rollback,
    mocks.approval,
    mocks.detail,
    mocks.deps,
    mocks.diff,
  ])
    fn.mockReset().mockResolvedValue(undefined)
  mocks.validate.mockReset().mockResolvedValue(true)
  mocks.confirm.mockReset().mockResolvedValue(undefined)
  mocks.prompt.mockReset().mockResolvedValue({ value: 'reviewed' })
})

it('accepts config names and creation notes up to the backend limits', async () => {
  const wrapper = render()
  await click(wrapper, 'configReleaseList.headerCreate')
  expect(
    wrapper
      .get('input[placeholder="configReleaseList.createNamePlaceholder"]')
      .attributes('maxlength'),
  ).toBe('256')
  expect(
    wrapper
      .get('input[placeholder="configReleaseList.createNotePlaceholder"]')
      .attributes('maxlength'),
  ).toBe('512')
})

describe('配置发布的租户与异步操作边界', () => {
  it('列表加载失败时只显示错误提示，不显示“暂无记录”空态', async () => {
    mocks.list.mockRejectedValue(new Error('boom'))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('.cr-load-error').attributes('title')).toBe('configReleaseList.loadError')
    expect(wrapper.findComponent({ name: 'EmptyState' }).exists()).toBe(false)
  })

  it('版本对比未选择目标版本时显示选择提示，选择后按原 ID 比较', async () => {
    mocks.list.mockResolvedValue([row(), { ...row('PUBLISHED', 'release-b'), id: 42 }])
    const wrapper = render()
    await flushPromises()
    await click(wrapper, 'configReleaseList.actionDiff')
    const target = wrapper.findAllComponents({ name: 'ElSelect' })[1]
    expect(target.props('modelValue')).toBeUndefined()
    expect(target.props('placeholder')).toBe('configReleaseList.diffPlaceholder')
    const compare = wrapper
      .findAll('button')
      .find((button) => button.text() === 'configReleaseList.diffButton')!
    expect(compare.attributes('disabled')).toBeDefined()
    target.vm.$emit('update:modelValue', 42)
    await flushPromises()
    expect(compare.attributes('disabled')).toBeUndefined()
    await compare.trigger('click')
    await flushPromises()
    expect(mocks.diff).toHaveBeenCalledWith('tenant-a', 41, 42)
  })

  it('忽略租户切换后迟到的列表响应', async () => {
    const first = pending<ReturnType<typeof row>[]>()
    mocks.list
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([row('DRAFT', 'release-b', 'tenant-b')])
    const wrapper = render()
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    first.resolve([row()])
    await flushPromises()
    expect(wrapper.text()).toContain('release-b')
    expect(wrapper.text()).not.toContain('release-a')
  })

  it('回滚第二次提示期间经历 A→B→A 后不得提交旧操作', async () => {
    const prompt = pending<{ value: string }>()
    mocks.prompt.mockReturnValueOnce(prompt.promise)
    const wrapper = render()
    await flushPromises()
    await click(wrapper, 'configReleaseList.actionRollback')
    mocks.state.tenantId = 'tenant-b'
    mocks.state.tenantId = 'tenant-a'
    prompt.resolve({ value: 'reviewed' })
    await flushPromises()
    expect(mocks.rollback).not.toHaveBeenCalled()
  })

  it.each(['tenant', 'maintenance', 'permission', 'operator'])(
    '审批提示期间 %s 变化后不提交',
    async (change) => {
      const prompt = pending<{ value: string }>()
      mocks.prompt.mockReturnValueOnce(prompt.promise)
      mocks.list.mockResolvedValue([row('DRAFT')])
      const wrapper = render()
      await flushPromises()
      await click(wrapper, 'configReleaseList.actionSubmit')
      if (change === 'tenant') mocks.state.tenantId = 'tenant-b'
      if (change === 'maintenance') mocks.state.writesFrozen = true
      if (change === 'permission') mocks.state.writer = false
      if (change === 'operator') mocks.auth.userInfo.username = 'other-operator'
      prompt.resolve({ value: 'reviewed' })
      await flushPromises()
      expect(mocks.approval).not.toHaveBeenCalled()
    },
  )

  it('异步表单校验后不把 A 的草稿创建到 B', async () => {
    const validation = pending<boolean>()
    mocks.validate.mockReturnValueOnce(validation.promise)
    const wrapper = render()
    await flushPromises()
    await fillCreate(wrapper)
    await wrapper.get('form').trigger('submit')
    mocks.state.tenantId = 'tenant-b'
    validation.resolve(true)
    await flushPromises()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('旧详情结果在租户切换后不能重新打开抽屉', async () => {
    const detail = pending<object>()
    mocks.detail.mockReturnValueOnce(detail.promise)
    const wrapper = render()
    await flushPromises()
    await click(wrapper, 'configReleaseList.actionDetail')
    mocks.state.tenantId = 'tenant-b'
    detail.resolve({ configKey: 'private-a-detail' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('private-a-detail')
    expect(wrapper.find('[data-title="configReleaseList.detailTitle"]').exists()).toBe(false)
  })

  it('租户切换后清空已展示的依赖和对比选择', async () => {
    mocks.deps.mockResolvedValue({ privateKey: 'private-a-dependency' })
    const wrapper = render()
    await flushPromises()
    await click(wrapper, 'configReleaseList.actionDeps')
    expect(wrapper.text()).toContain('private-a-dependency')
    await click(wrapper, 'configReleaseList.actionDiff')
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    expect(wrapper.text()).not.toContain('private-a-dependency')
    expect(wrapper.find('[data-title="configReleaseList.diffTitle"]').exists()).toBe(false)
  })

  it('同租户切换依赖目标后忽略旧目标回包', async () => {
    const first = pending<object>()
    mocks.deps
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ key: 'second-dependency' })
    mocks.list.mockResolvedValue([row(), { ...row('PUBLISHED', 'release-second'), id: 42 }])
    const wrapper = render()
    await flushPromises()
    await click(wrapper, 'configReleaseList.actionDeps')
    await wrapper.findAll('.cr-card')[1]!.trigger('click')
    await click(wrapper, 'configReleaseList.actionDeps')
    first.resolve({ key: 'old-dependency' })
    await flushPromises()
    expect(wrapper.text()).toContain('second-dependency')
    expect(wrapper.text()).not.toContain('old-dependency')
  })

  it('关闭并重新打开创建表单后不续传旧校验', async () => {
    const validation = pending<boolean>()
    mocks.validate.mockReturnValueOnce(validation.promise)
    const wrapper = render()
    await flushPromises()
    await fillCreate(wrapper)
    await wrapper.get('form').trigger('submit')
    // 新增抽屉由 FormDrawer 承载，模拟用户关闭抽屉
    wrapper.findComponent({ name: 'FormDrawer' }).vm.$emit('update:visible', false)
    await flushPromises()
    await click(wrapper, 'configReleaseList.headerCreate')
    validation.resolve(true)
    await flushPromises()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('创建校验未完成时重复提交只发送一次', async () => {
    const validation = pending<boolean>()
    mocks.validate.mockReturnValueOnce(validation.promise)
    const wrapper = render()
    await flushPromises()
    await fillCreate(wrapper)
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')
    validation.resolve(true)
    await flushPromises()
    expect(mocks.validate).toHaveBeenCalledTimes(1)
    expect(mocks.create).toHaveBeenCalledTimes(1)
  })

  it('取消回滚确认后不打开原因输入或发送请求', async () => {
    mocks.confirm.mockRejectedValueOnce('cancel')
    const wrapper = render()
    await flushPromises()
    await click(wrapper, 'configReleaseList.actionRollback')
    expect(mocks.prompt).not.toHaveBeenCalled()
    expect(mocks.rollback).not.toHaveBeenCalled()
  })

  it('正常审批仍传入原发布单及原因', async () => {
    mocks.list.mockResolvedValue([row('DRAFT')])
    const wrapper = render()
    await flushPromises()
    await click(wrapper, 'configReleaseList.actionSubmit')
    expect(mocks.approval).toHaveBeenCalledWith(41, { tenantId: 'tenant-a', reason: 'reviewed' })
  })

  it('上下文保持不变时回滚保留原租户、版本及原因', async () => {
    const wrapper = render()
    await flushPromises()
    await click(wrapper, 'configReleaseList.actionRollback')
    expect(mocks.rollback).toHaveBeenCalledWith(41, {
      tenantId: 'tenant-a',
      expectedVersionNo: 3,
      reason: 'reviewed',
    })
  })

  it('上下文保持不变时创建仍使用已校验的字段', async () => {
    const wrapper = render()
    await flushPromises()
    await fillCreate(wrapper)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.create).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      configKey: 'job-a',
      configType: 'JOB',
      configName: 'Job A',
      configPayloadJson: '{}',
      reason: undefined,
    })
  })
})
