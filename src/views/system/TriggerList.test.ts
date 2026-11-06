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
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ activeDegradationSources: [] }) }))
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
  resumeTrigger: vi.fn(),
  registerTrigger: vi.fn(),
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
  })

  it('只显示当前租户的触发器，并展示后端返回的调度表达式', async () => {
    const wrapper = mount(TriggerList, { global: { stubs } })
    await flushPromises()
    expect(wrapper.findAll('.row')).toHaveLength(1)
    expect(wrapper.text()).toContain('TA_FLOW')
    expect(wrapper.text()).not.toContain('TB_FLOW')
    expect(wrapper.text()).toContain('0 0 22 * * ?')
  })

  it('非平台管理员的写按钮禁用并说明原因', async () => {
    state.admin = false
    const wrapper = mount(TriggerList, { global: { stubs } })
    await flushPromises()
    const pause = wrapper.findAll('button').find((b) => b.text() === 'triggerList.actionPause')
    expect(pause?.attributes('disabled')).toBeDefined()
    expect(pause?.attributes('title')).toBe('common.permissionDenied')
  })
})
