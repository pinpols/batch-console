// @vitest-environment jsdom
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SelfServiceTriggerPauseTab from './SelfServiceTriggerPauseTab.vue'
import TagSearchTab from './TagSearchTab.vue'

const state = vi.hoisted(() => ({
  tenant: null as unknown as { tenantId: string },
  triggers: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  search: vi.fn(),
  keys: vi.fn(),
}))
vi.mock('@/stores/tenant', () => ({ useTenantStore: () => state.tenant }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/api/triggers', () => ({
  listTriggers: state.triggers,
  pauseTrigger: state.pause,
  resumeTrigger: state.resume,
}))
vi.mock('@/api/tags', () => ({ searchByTag: state.search, listTagKeys: state.keys }))
vi.mock('@/composables/queries/useConsoleMeta', async () => {
  const { ref } = await import('vue')
  return { useConsoleMetaEnumsQuery: () => ({ data: ref([]) }) }
})
vi.mock('@/utils/metaEnumPick', () => ({ pickMetaEnumGroup: () => [] }))
const input = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}
const stubs = {
  ElAlert: true,
  ElForm: { template: '<form><slot /></form>' },
  ElFormItem: { template: '<div><slot /></div>' },
  ElSelect: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
  },
  ElOption: { props: ['label', 'value'], template: '<option :value="value">{{ label }}</option>' },
  ElButton: true,
  ElRadioGroup: true,
  ElRadioButton: true,
  ElTag: true,
  ProTable: {
    props: ['data'],
    template: '<div><pre>{{ JSON.stringify(data) }}</pre><slot name="query" /></div>',
  },
  ListPageQueryBar: {
    emits: ['search'],
    template: '<div><slot /><button @click="$emit(\'search\')">search</button></div>',
  },
  ElAutocomplete: input,
  ElInput: input,
  MetaSelect: true,
  StatusTag: true,
  EmptyState: true,
}

describe('trigger and tag tenant targets', () => {
  beforeEach(() => {
    state.tenant = reactive({ tenantId: 'tenant-a' })
    state.triggers.mockReset().mockResolvedValue([])
    state.keys.mockReset().mockResolvedValue([])
    state.search.mockReset().mockResolvedValue([])
    state.pause.mockReset().mockResolvedValue(undefined)
    state.resume.mockReset().mockResolvedValue(undefined)
  })

  it('offers only the selected tenant workflows from an administrator-wide trigger response', async () => {
    state.triggers.mockResolvedValue([
      { tenantId: 'tenant-a', workflowCode: 'A-flow' },
      { tenantId: 'tenant-b', workflowCode: 'B-flow' },
    ])
    const wrapper = mount(SelfServiceTriggerPauseTab, { global: { stubs } })
    await flushPromises()
    expect(wrapper.text()).toContain('A-flow')
    expect(wrapper.text()).not.toContain('B-flow')
    wrapper.unmount()
  })

  it('requires reselecting the workflow after changing tenants', async () => {
    state.triggers.mockResolvedValue([{ tenantId: 'tenant-a', workflowCode: 'shared-flow' }])
    const wrapper = mount(SelfServiceTriggerPauseTab, { global: { stubs } })
    await flushPromises()
    await wrapper.get('select').setValue('shared-flow')
    state.tenant.tenantId = 'tenant-b'
    await nextTick()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(state.pause).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not show a previous tenant tag search after switching tenants', async () => {
    let resolveA!: (rows: unknown) => void
    state.search.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveA = resolve
      }),
    )
    const wrapper = mount(TagSearchTab, { global: { stubs } })
    await flushPromises()
    await wrapper.findAll('input')[0]!.setValue('team')
    await wrapper.get('button').trigger('click')
    state.tenant.tenantId = 'tenant-b'
    await nextTick()
    resolveA([{ resourceCode: 'A-secret-resource' }])
    await flushPromises()
    expect(wrapper.text()).not.toContain('A-secret-resource')
    wrapper.unmount()
  })
})
