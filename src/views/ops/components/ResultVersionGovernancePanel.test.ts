// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ResultVersionGovernancePanel from './ResultVersionGovernancePanel.vue'

const api = vi.hoisted(() => ({ versions: vi.fn(), effective: vi.fn() }))
vi.mock('@/api/batchDayReplay', () => ({
  batchDayReplayApi: { resultVersions: api.versions, effectiveResultVersion: api.effective },
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (load: () => void) => load() }))
vi.mock('@/composables/usePermission', () => ({
  usePermission: () => ({ canMutateConfig: false }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
const slots = { template: '<div><slot name="header" /><slot /></div>' }
const input = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}
function render() {
  return mount(ResultVersionGovernancePanel, {
    global: {
      directives: { loading: () => {} },
      stubs: {
        SectionCard: slots,
        ElForm: { template: '<form><slot /></form>' },
        ElFormItem: slots,
        ElInput: input,
        ElButton: {
          props: ['nativeType'],
          template: '<button :type="nativeType || \'button\'"><slot /></button>',
        },
        ElAlert: true,
        ElTable: true,
        ElTableColumn: true,
        ElTag: true,
        ElDrawer: true,
        ElDescriptions: true,
        ElDescriptionsItem: true,
      },
    },
  })
}
describe('ResultVersionGovernancePanel', () => {
  beforeEach(() => {
    api.versions.mockReset().mockResolvedValue([])
    api.effective.mockReset().mockResolvedValue(null)
  })
  it('回车提交只查询一次列表和生效版本', async () => {
    const wrapper = render()
    await wrapper.get('input').setValue('job:billing:2026-10-25')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('input').trigger('keyup.enter')
    await flushPromises()
    expect(api.versions).toHaveBeenCalledTimes(1)
    expect(api.effective).toHaveBeenCalledTimes(1)
    expect(api.versions).toHaveBeenCalledWith('tenant-a', 'job:billing:2026-10-25')
    expect(wrapper.get('form button').attributes('type')).toBe('submit')
    wrapper.unmount()
  })
})
