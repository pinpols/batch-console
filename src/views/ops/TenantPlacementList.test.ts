// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TenantPlacementList from './TenantPlacementList.vue'

const api = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn(), warning: vi.fn() }))
vi.mock('@/api/opsManagement', () => ({
  listTenantPlacements: api.list,
  upsertTenantPlacement: api.save,
  deleteTenantPlacement: vi.fn(),
  listShardCatalog: vi.fn().mockResolvedValue([]),
  PLACEMENT_KEY_PATTERN: /^[a-z0-9-]{1,64}$/,
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => true }) }))
vi.mock('@/composables/useWriteAvailability', async () => {
  const { ref } = await import('vue')
  return {
    useWriteAvailability: () => ({ writesFrozen: ref(false), ensureWriteAvailable: () => true }),
  }
})
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: api.warning },
}))
const slots = {
  template:
    '<div><slot /><slot name="header" /><slot name="actions" /><slot name="footer" /></div>',
}
const input = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}
function render() {
  return mount(TenantPlacementList, {
    global: {
      stubs: {
        PageContainer: slots,
        PageHeader: slots,
        SectionCard: slots,
        HelpLabel: slots,
        ProTable: true,
        ElTag: true,
        ElDrawer: {
          props: ['modelValue'],
          template: '<aside v-if="modelValue"><slot /><slot name="footer" /></aside>',
        },
        ElForm: { template: '<form><slot /></form>' },
        ElFormItem: { props: ['label'], template: '<label :data-label="label"><slot /></label>' },
        ElInput: input,
        ElSelect: input,
        ElOption: true,
        ElButton: { template: '<button type="button"><slot /></button>' },
      },
    },
  })
}
describe('TenantPlacementList', () => {
  beforeEach(() => {
    api.list.mockReset().mockResolvedValue([])
    api.save.mockReset().mockResolvedValue(undefined)
    api.warning.mockReset()
  })
  it('空白租户或分片不提交，合法原值原样提交', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'common.create')!
      .trigger('click')
    const tenant = wrapper.get('aside [data-label="tenantPlacementList.colTenant"] input')
    const placement = wrapper.get('aside [data-label="tenantPlacementList.colPlacement"] input')
    const save = wrapper.findAll('aside button').find((item) => item.text() === 'common.save')!
    await tenant.setValue('   ')
    await placement.setValue('shard-a')
    await save.trigger('click')
    expect(api.save).not.toHaveBeenCalled()
    await tenant.setValue('tenant-a')
    await placement.setValue('')
    await save.trigger('click')
    expect(api.save).not.toHaveBeenCalled()
    await placement.setValue('shard-a')
    await save.trigger('click')
    await flushPromises()
    expect(api.save).toHaveBeenCalledWith({ tenantId: 'tenant-a', placementKey: 'shard-a' })
    wrapper.unmount()
  })
})
