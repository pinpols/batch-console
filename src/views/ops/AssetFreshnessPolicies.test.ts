// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, inject, provide, ref, toRef, type Ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AssetFreshnessPolicies from './AssetFreshnessPolicies.vue'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/api/assetFreshnessPolicies', () => ({
  listAssetFreshnessPolicies: api.list,
  createAssetFreshnessPolicy: api.create,
  updateAssetFreshnessPolicy: api.update,
  toggleAssetFreshnessPolicy: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => ({ tenantId: 'tenant-a' }) }))
vi.mock('@/composables/useTenantReload', () => ({ useTenantReload: (load: () => void) => load() }))
vi.mock('@/composables/useWriteAvailability', async () => {
  const { ref } = await import('vue')
  return {
    useWriteAvailability: () => ({ writesFrozen: ref(false), ensureWriteAvailable: () => true }),
  }
})
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (key: string, params?: { code?: string }) =>
      key === 'assetFreshness.editPolicy' ? `编辑 ${params?.code}` : key,
    te: () => false,
  }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { success: vi.fn(), warning: api.warning, error: vi.fn() },
}))

const input = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}
const slots = { template: '<div><slot /><slot name="actions" /><slot name="footer" /></div>' }
const row = {
  id: 7,
  assetCode: 'JOB_EXISTING',
  timezone: 'UTC',
  expectedByLocalTime: '02:00:00',
  staleAfterSeconds: 0,
  lookbackDays: 1,
  severity: 'WARN',
  enabled: true,
}
function render() {
  return mount(AssetFreshnessPolicies, {
    global: {
      directives: { loading: () => {} },
      stubs: {
        PageContainer: slots,
        PageHeader: slots,
        ListPageQueryBar: true,
        EmptyState: true,
        CopyableText: true,
        TablePagerBar: true,
        ElDrawer: {
          props: ['modelValue'],
          template: '<aside v-if="modelValue"><slot /><slot name="footer" /></aside>',
        },
        ElForm: { template: '<form><slot /></form>' },
        ElFormItem: { props: ['label'], template: '<label :data-label="label"><slot /></label>' },
        ElInput: input,
        ElInputNumber: true,
        ElTimePicker: true,
        ElSelect: true,
        ElOption: true,
        ElSwitch: true,
        ElTag: true,
        ElTooltip: { template: '<span><slot /></span>' },
        ElButton: { template: '<button type="button"><slot /></button>' },
        ElTable: defineComponent({
          props: ['data'],
          setup(props, { slots }) {
            provide('rows', toRef(props, 'data'))
            return () => h('div', slots.default?.())
          },
        }),
        ElTableColumn: defineComponent({
          setup(_, { slots }) {
            const rows = inject<Ref<Record<string, unknown>[]>>('rows', ref([]))
            return () =>
              h(
                'div',
                rows.value.map((value) => slots.default?.({ row: value })),
              )
          },
        }),
      },
    },
  })
}

describe('AssetFreshnessPolicies', () => {
  beforeEach(() => {
    api.list.mockReset().mockResolvedValue({ items: [row], total: 1 })
    api.create.mockReset().mockResolvedValue(undefined)
    api.update.mockReset().mockResolvedValue(undefined)
    api.warning.mockReset()
  })
  it('编辑按钮标明对应的作业编码', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.find('button[aria-label="编辑 JOB_EXISTING"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('按实际提交值检查新增的编码与时区长度，保留 trim 后的编码', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'assetFreshness.create')!
      .trigger('click')
    const code = wrapper.get('aside [data-label="assetFreshness.assetCode"] input')
    const timezone = wrapper.get('aside [data-label="assetFreshness.timezone"] input')
    await code.setValue(' ' + 'A'.repeat(128) + ' ')
    await timezone.setValue('T'.repeat(64))
    await wrapper.get('aside form').trigger('submit')
    await flushPromises()
    expect(api.create).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({ assetCode: 'A'.repeat(128), timezone: 'T'.repeat(64) }),
    )
    await wrapper
      .findAll('button')
      .find((item) => item.text() === 'assetFreshness.create')!
      .trigger('click')
    await wrapper
      .get('aside [data-label="assetFreshness.assetCode"] input')
      .setValue('A'.repeat(129))
    await wrapper.get('aside form').trigger('submit')
    expect(api.create).toHaveBeenCalledTimes(1)
    await wrapper.get('aside [data-label="assetFreshness.assetCode"] input').setValue('JOB')
    await wrapper.get('aside [data-label="assetFreshness.timezone"] input').setValue('T'.repeat(65))
    await wrapper.get('aside form').trigger('submit')
    expect(api.create).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
  it('编辑已有策略时也拦截超长时区，未改变的合法值照常提交', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((item) => !item.text())!
      .trigger('click')
    await wrapper.get('aside [data-label="assetFreshness.timezone"] input').setValue('T'.repeat(65))
    await wrapper.get('aside form').trigger('submit')
    expect(api.update).not.toHaveBeenCalled()
    await wrapper.get('aside [data-label="assetFreshness.timezone"] input').setValue('UTC')
    await wrapper.get('aside form').trigger('submit')
    await flushPromises()
    expect(api.update).toHaveBeenCalledWith(
      7,
      'tenant-a',
      expect.objectContaining({ assetCode: 'JOB_EXISTING', timezone: 'UTC' }),
    )
    wrapper.unmount()
  })
})
