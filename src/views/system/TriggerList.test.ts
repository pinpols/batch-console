// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TriggerList from './TriggerList.vue'

const state = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  admin: true,
  list: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  register: vi.fn(),
  push: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ activeDegradationSources: [] }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canManageSystem: ref(state.admin) }),
}))
vi.mock('@/composables/useWriteAvailability', () => ({
  useWriteAvailability: () => ({ writesFrozen: ref(false), ensureWriteAvailable: () => true }),
}))
vi.mock('@/composables/useDangerConfirm', () => ({
  confirmDanger: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/api/triggers', () => ({
  listTriggers: state.list,
  pauseTrigger: state.pause,
  resumeTrigger: state.resume,
  registerTrigger: state.register,
  unregisterTrigger: vi.fn(),
}))

const rows = [
  {
    tenantId: 'ta',
    workflowCode: 'TA_FLOW',
    scheduleType: 'CRON',
    scheduleExpression: '0 0 22 * * ?',
    status: 'NORMAL',
  },
  {
    tenantId: 'tb',
    workflowCode: 'TB_FLOW',
    scheduleType: 'CRON',
    scheduleExpression: '0 0 7 * * ?',
    status: 'NORMAL',
  },
]
const stubs = {
  PageContainer: { template: '<main><slot /></main>' },
  PageHeader: true,
  ListPageQueryBar: true,
  ProTable: {
    props: ['data'],
    template:
      '<table><tr v-for="row in data" :key="row.workflowCode" class="row"><slot :row="row" /></tr></table>',
  },
  ElTableColumn: { template: '<td><slot :row="$parent.$props.data?.[0]" /></td>' },
  DatetimeColumn: true,
  StatusTag: true,
  CopyableText: { props: ['text'], template: '<span>{{ text }}</span>' },
}

describe('触发器列表', () => {
  beforeEach(() => {
    state.tenant = reactive({ tenantId: 'ta' })
    state.admin = true
    state.list.mockReset().mockResolvedValue(rows)
    state.pause.mockReset().mockResolvedValue(undefined)
    state.resume.mockReset().mockResolvedValue(undefined)
    state.register.mockReset().mockResolvedValue(undefined)
    state.push.mockReset()
  })

  it('只显示当前租户的触发器，并展示后端返回的调度表达式', async () => {
    const wrapper = mount(TriggerList, { global: { stubs } })
    await flushPromises()
    expect(wrapper.findAll('.row')).toHaveLength(1)
    expect(wrapper.text()).toContain('TA_FLOW')
    expect(wrapper.text()).not.toContain('TB_FLOW')
    expect(wrapper.text()).toContain('0 0 22 * * ?')
  })

  it('运行中仅显示暂停调度与调度设置按钮，点击调度设置跳工作流定义', async () => {
    const wrapper = mount(TriggerList, { global: { stubs } })
    await flushPromises()
    const labels = wrapper.findAll('button').map((b) => b.text().trim())
    expect(labels).toContain('triggerList.actionPauseSchedule')
    expect(labels).not.toContain('triggerList.actionEnableSchedule')
    expect(labels).toContain('triggerList.actionScheduleSettings')

    const settingsBtn = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'triggerList.actionScheduleSettings')!
    await settingsBtn.trigger('click')
    expect(state.push).toHaveBeenCalledWith({
      path: '/workflow/definitions',
      query: { workflowCode: 'TA_FLOW' },
    })
  })

  it('未启用或已暂停行仅显示开启调度按钮并调用对应后端接口', async () => {
    state.list.mockResolvedValueOnce([
      {
        tenantId: 'ta',
        workflowCode: 'TA_PAUSED',
        scheduleType: 'CRON',
        scheduleExpression: '0 0 8 * * ?',
        status: 'PAUSED',
      },
    ])
    const wrapper = mount(TriggerList, { global: { stubs } })
    await flushPromises()
    const enableBtn = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'triggerList.actionEnableSchedule')!
    expect(enableBtn).toBeDefined()
    await enableBtn.trigger('click')
    await flushPromises()
    expect(state.resume).toHaveBeenCalledWith('TA_PAUSED', 'ta')
  })

  it('非平台管理员的写按钮禁用并说明原因', async () => {
    state.admin = false
    const wrapper = mount(TriggerList, { global: { stubs } })
    await flushPromises()
    const pause = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'triggerList.actionPauseSchedule')
    expect(pause?.attributes('disabled')).toBeDefined()
    expect(pause?.attributes('title')).toBe('common.permissionDenied')
  })
})
