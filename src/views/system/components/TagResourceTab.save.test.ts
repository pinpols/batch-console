// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TagResourceTab from './TagResourceTab.vue'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => reactive({ tenantId: 'tenant-a' }) }))
vi.mock('@/api/tags', () => ({
  listResourceTags: mocks.list,
  upsertResourceTag: mocks.upsert,
  deleteResourceTag: mocks.delete,
}))
vi.mock('@/composables/queries/useConsoleMeta', () => ({
  useConsoleMetaEnumsQuery: () => ({ data: ref([]) }),
}))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { error: mocks.error, warning: mocks.warning, success: mocks.success },
}))

const input = {
  props: ['modelValue', 'placeholder'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}
const stubs = {
  ListPageQueryBar: { template: '<div><slot /></div>' },
  MetaSelect: input,
  ElInput: input,
  ElForm: { template: '<div><slot /></div>' },
  ElFormItem: { template: '<div><slot /></div>' },
  ElDrawer: {
    props: ['modelValue'],
    template: '<div v-if="modelValue" role="dialog"><slot /><slot name="footer" /></div>',
  },
  ElButton: {
    inheritAttrs: false,
    emits: ['click'],
    template: '<button @click="$emit(\'click\')"><slot /></button>',
  },
  ElTable: true,
  ElTableColumn: true,
  DataState: { template: '<div><slot /></div>' },
}

describe('资源标签保存', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue([])
  })

  it('保存失败后保留抽屉和输入，便于修正或重试', async () => {
    mocks.upsert.mockRejectedValue(new Error('offline'))
    const wrapper = mount(TagResourceTab, { global: { stubs } })
    await wrapper.findAll('input')[0]!.setValue('JOB')
    await wrapper.findAll('input')[1]!.setValue('job-1')
    wrapper.vm.openNewDialog()
    await flushPromises()
    const dialog = wrapper.get('[role="dialog"]')
    await dialog.get('input[placeholder="tagResourceTab.tagKeyPlaceholder"]').setValue('team')
    await dialog
      .get('input[placeholder="tagResourceTab.tagValueOptionalPlaceholder"]')
      .setValue('billing')
    await dialog.findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(mocks.upsert).toHaveBeenCalledOnce()
    expect(mocks.error).toHaveBeenCalledWith('tagResourceTab.saveFailed')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(
      (
        dialog.get('input[placeholder="tagResourceTab.tagKeyPlaceholder"]')
          .element as HTMLInputElement
      ).value,
    ).toBe('team')
    expect(
      (
        dialog.get('input[placeholder="tagResourceTab.tagValueOptionalPlaceholder"]')
          .element as HTMLInputElement
      ).value,
    ).toBe('billing')
    mocks.upsert.mockResolvedValueOnce(undefined)
    await dialog.findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(mocks.upsert).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(mocks.success).toHaveBeenCalledWith('tagResourceTab.savedToast')
    wrapper.unmount()
  })
})
