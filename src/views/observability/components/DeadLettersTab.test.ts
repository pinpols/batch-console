// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, inject, provide, reactive, type ComputedRef } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import messages from '@/locales/zh-CN'
import Tab from './DeadLettersTab.vue'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  replay: vi.fn(),
  confirm: vi.fn(),
  state: null as unknown as { tenantId: string; admin: boolean; writesFrozen: boolean },
}))
vi.mock('@/api/observabilityQueries', () => ({
  queryDeadLetters: mocks.query,
  replayDeadLetter: mocks.replay,
}))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: mocks.confirm }))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => mocks.state }))
vi.mock('@/stores/app', () => ({ useAppStore: () => mocks.state }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    userInfo: { username: 'admin-a' },
    hasPermission: (p: string) => mocks.state.admin && p === 'ROLE_ADMIN',
  }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))
enableAutoUnmount(afterEach)
const pass = { template: '<div><slot /><slot name="footer" /></div>' }
const row = {
  id: 41,
  sourceType: 'JOB_TASK',
  sourceId: '17',
  deadLetterReason: 'EXTERNAL_OUTCOME_UNKNOWN',
  replayStatus: 'NEW',
}
const table = defineComponent({
  props: ['data'],
  setup(props, { slots }) {
    provide(
      'deadLetterTestRow',
      computed(() => props.data[0]),
    )
    return () => h('div', slots.default?.())
  },
})
const column = defineComponent({
  props: ['type'],
  setup(props, { slots }) {
    const value = inject<ComputedRef<typeof row>>('deadLetterTestRow')!
    return () =>
      props.type === 'selection'
        ? h('span', { class: 'test-selection' })
        : h('div', value.value ? slots.default?.({ row: value.value }) : [])
  },
})
const actions = defineComponent({
  props: ['actions'],
  setup(props) {
    return () =>
      h(
        'div',
        props.actions.map((a: { label: string; onClick: () => void }) =>
          h('button', { onClick: a.onClick }, a.label),
        ),
      )
  },
})
function render() {
  return mount(Tab, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': messages } })],
      directives: { loading: () => {} },
      stubs: {
        ListPageQueryBar: true,
        TablePagerBar: true,
        DetailDrawer: true,
        DatetimeColumn: true,
        DataState: pass,
        BulkActionBar: {
          props: ['running'],
          template: '<section class="test-bulk"><slot :running="running" /></section>',
        },
        RowActions: actions,
        ElTable: table,
        ElTableColumn: column,
        ElDialog: {
          props: ['modelValue'],
          template:
            '<section v-if="modelValue" class="test-dialog"><slot /><slot name="footer" /></section>',
        },
        ElFormItem: pass,
        ElInput: true,
        ElCheckbox: true,
        ElButton: { template: '<button><slot /></button>' },
      },
    },
  })
}
async function openReplay() {
  const wrapper = render()
  await flushPromises()
  await wrapper
    .findAll('button')
    .find((b) => b.text() === messages.observability.dlqReplay)!
    .trigger('click')
  await flushPromises()
  expect(wrapper.find('.test-dialog').exists()).toBe(true)
  return wrapper
}

describe('死信重放权限和确认范围', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state = reactive({ tenantId: 'tenant-a', admin: true, writesFrozen: false })
    mocks.query.mockResolvedValue([row])
    mocks.replay.mockResolvedValue('approval-1')
    mocks.confirm.mockResolvedValue(undefined)
  })
  it('切租户立即清空旧列表，不在新租户加载期间显示旧目标', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findComponent(table).props('data')).toEqual([row])
    mocks.query.mockReturnValue(new Promise(() => {}))
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    expect(wrapper.findComponent(table).props('data')).toEqual([])
  })
  it.each(['success', 'failure'] as const)('旧租户迟到%s不能覆盖新租户列表', async (outcome) => {
    let complete!: (value: (typeof row)[]) => void
    let fail!: (reason: Error) => void
    mocks.query.mockReturnValueOnce(
      new Promise<(typeof row)[]>((resolve, reject) => {
        complete = resolve
        fail = reject
      }),
    )
    const currentRow = { ...row, id: 84, sourceId: 'current-tenant' }
    const wrapper = render()
    mocks.query.mockResolvedValueOnce([currentRow])
    mocks.state.tenantId = 'tenant-b'
    await flushPromises()
    expect(wrapper.findComponent(table).props('data')).toEqual([currentRow])
    if (outcome === 'success') complete([row])
    else fail(new Error('old tenant unavailable'))
    await flushPromises()
    expect(wrapper.findComponent(table).props('data')).toEqual([currentRow])
  })
  it('租户管理员只读，无重放和批量选择入口', async () => {
    mocks.state.admin = false
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findAll('button').map((b) => b.text())).not.toContain(
      messages.observability.dlqReplay,
    )
    expect(wrapper.find('.test-selection').exists()).toBe(false)
  })
  it('确认期间切换租户丢弃旧动作', async () => {
    let confirm!: () => void
    mocks.confirm.mockReturnValue(
      new Promise<void>((resolve) => {
        confirm = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === messages.observability.dlqReplay)!
      .trigger('click')
    mocks.state.tenantId = 'tenant-b'
    confirm()
    await flushPromises()
    expect(wrapper.find('.test-dialog').exists()).toBe(false)
    expect(mocks.replay).not.toHaveBeenCalled()
  })
  it.each(['tenant', 'role', 'freeze'] as const)(
    '表单打开后%s变化不能提交旧目标',
    async (change) => {
      const wrapper = await openReplay()
      if (change === 'tenant') mocks.state.tenantId = 'tenant-b'
      if (change === 'role') mocks.state.admin = false
      if (change === 'freeze') mocks.state.writesFrozen = true
      const submit = wrapper
        .findAll('.test-dialog button')
        .find((b) => b.text() === messages.observability.dlqReplay)
      if (submit) await submit.trigger('click')
      await flushPromises()
      expect(mocks.replay).not.toHaveBeenCalled()
    },
  )
  it('当前管理员可对确认过的当前租户目标申请审批', async () => {
    const wrapper = await openReplay()
    await wrapper
      .findAll('.test-dialog button')
      .find((b) => b.text() === messages.observability.dlqReplay)!
      .trigger('click')
    await flushPromises()
    expect(mocks.replay).toHaveBeenCalledWith(
      'tenant-a',
      41,
      undefined,
      { externalActionVerifiedNotExecuted: false },
      'admin-a',
    )
  })

  it('批量确认期间切换租户不使用新租户提交旧ID', async () => {
    let confirm!: () => void
    mocks.confirm.mockReturnValue(
      new Promise<void>((resolve) => {
        confirm = resolve
      }),
    )
    const wrapper = render()
    await flushPromises()
    wrapper.findComponent(table).vm.$emit('selection-change', [row])
    await flushPromises()
    await wrapper
      .findAll('.test-bulk button')
      .find((b) => b.text() === messages.observability.dlqBulkReplay)!
      .trigger('click')
    mocks.state.tenantId = 'tenant-b'
    confirm()
    await flushPromises()
    expect(mocks.replay).not.toHaveBeenCalled()
  })
})
