// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkflowScheduleDialog from './WorkflowScheduleDialog.vue'

const state = vi.hoisted(() => ({
  detailById: vi.fn(),
  updateSchedule: vi.fn(),
  loadJobCodes: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('@/api/workflow', () => ({
  workflowApi: { detailById: state.detailById, updateSchedule: state.updateSchedule },
}))
vi.mock('@/composables/useJobCodeOptions', () => ({
  useJobCodeOptions: () => ({ load: state.loadJobCodes }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: state.success, error: state.error, warning: state.warning },
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))

const slot = { template: '<div><slot /><slot name="footer" /></div>' }
const stubs = {
  ElDialog: slot,
  ElForm: slot,
  ElFormItem: slot,
  ElSelect: true,
  ElOption: true,
  ElInput: true,
  ElAlert: true,
  ElButton: {
    props: ['type', 'disabled'],
    emits: ['click'],
    template:
      '<button :class="`btn-${type || \'default\'}`" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
}

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(WorkflowScheduleDialog, {
    props: { modelValue: true, workflowId: 9, tenantId: 'ta', canEdit: true, ...props },
    global: { stubs, directives: { loading: {} } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  state.detailById.mockResolvedValue({
    version: 3,
    scheduleType: 'CRON',
    scheduleExpr: '0 0 2 * * ?',
    timezone: 'Asia/Shanghai',
    triggerMode: 'SCHEDULED',
    calendarCode: '',
    dependsOnJobCode: 'OLD_JOB',
  })
  state.loadJobCodes.mockResolvedValue(['JOB_A'])
  state.updateSchedule.mockResolvedValue({ version: 4 })
})

describe('工作流调度设置', () => {
  it('读到 Cron + 手动 这类不兼容组合时改为定时并提示，保存时提交兼容值', async () => {
    state.detailById.mockResolvedValueOnce({
      version: 3,
      scheduleType: 'CRON',
      scheduleExpr: '0 0 2 * * ?',
      timezone: 'UTC',
      triggerMode: 'MANUAL',
    })
    const wrapper = mountDialog()
    await flushPromises()
    const alerts = wrapper.findAll('el-alert-stub').map((a) => a.attributes('title'))
    expect(alerts).toContain('workflowDefinitionList.scheduleTriggerModeNormalized')
    await wrapper.get('.btn-primary').trigger('click')
    await flushPromises()
    expect(state.updateSchedule).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ scheduleType: 'CRON', triggerMode: 'SCHEDULED' }),
    )
  })

  it('兼容组合不显示纠正提示', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    const alerts = wrapper.findAll('el-alert-stub').map((a) => a.attributes('title'))
    expect(alerts).not.toContain('workflowDefinitionList.scheduleTriggerModeNormalized')
  })

  it('打开时读取最新调度并带版本号保存，成功后交出新版本号', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    expect(state.detailById).toHaveBeenCalledWith(9, 'ta')
    await wrapper.get('.btn-primary').trigger('click')
    await flushPromises()
    expect(state.updateSchedule).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        tenantId: 'ta',
        expectedVersion: 3,
        scheduleType: 'CRON',
        scheduleExpr: '0 0 2 * * ?',
        dependsOnJobCode: 'OLD_JOB',
      }),
    )
    expect(wrapper.emitted('saved')?.[0]).toEqual([4])
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
  })

  it('无编辑权限时不能保存', async () => {
    const wrapper = mountDialog({ canEdit: false })
    await flushPromises()
    expect(wrapper.get('.btn-primary').attributes('disabled')).toBeDefined()
  })
})
