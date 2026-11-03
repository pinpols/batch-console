// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MaintenanceSettings from './MaintenanceSettings.vue'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  update: vi.fn(),
  confirm: vi.fn(),
  setMaintenance: vi.fn(),
}))

vi.mock('@/api/system.maintenance', () => ({
  getAdminMaintenanceState: mocks.load,
  updateMaintenance: mocks.update,
}))
vi.mock('@/composables/useDangerConfirm', () => ({ confirmDanger: mocks.confirm }))
vi.mock('@/stores/app', () => ({ useAppStore: () => ({ setMaintenance: mocks.setMaintenance }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => true }) }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('element-plus', async () => {
  const actual = await vi.importActual<typeof import('element-plus')>('element-plus')
  return { ...actual, ElMessage: { success: vi.fn(), error: vi.fn() } }
})

const base = {
  enabled: false,
  active: false,
  readOnly: true,
  message: null,
  etaAt: null,
  startsAt: null,
  affectedServices: [],
  version: 1,
  updatedAt: null,
}
const slots = { template: '<div><slot name="header" /><slot /></div>' }
const stubs = {
  PageContainer: slots,
  PageHeader: slots,
  SectionCard: slots,
  ElAlert: true,
  ElTag: slots,
  ElForm: slots,
  ElFormItem: slots,
  ElRadioGroup: slots,
  ElRadioButton: slots,
  ElInput: true,
  ElDatePicker: true,
  ElSwitch: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<button class="maintenance-switch" @click="$emit(\'update:modelValue\', !modelValue)">switch</button>',
  },
  ElButton: {
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
  },
}

describe('维护设置交互', () => {
  beforeEach(() => {
    mocks.load.mockReset().mockResolvedValue({ ...base })
    mocks.update.mockReset().mockResolvedValue({ ...base, enabled: true, active: true, version: 2 })
    mocks.confirm.mockReset()
    mocks.setMaintenance.mockReset()
  })

  it('启用维护时取消确认不会提交，确认后才保存并同步状态', async () => {
    const wrapper = mount(MaintenanceSettings, { global: { stubs } })
    await flushPromises()
    await wrapper.get('.maintenance-switch').trigger('click')
    const save = wrapper
      .findAll('button')
      .find((button) => button.text() === 'maintenanceSettings.save')!

    mocks.confirm.mockRejectedValueOnce('cancel')
    await save.trigger('click')
    await flushPromises()
    expect(mocks.update).not.toHaveBeenCalled()

    mocks.confirm.mockResolvedValueOnce(undefined)
    await save.trigger('click')
    await flushPromises()
    expect(mocks.update).toHaveBeenCalledOnce()
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, readOnly: true }),
    )
    expect(mocks.setMaintenance).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
