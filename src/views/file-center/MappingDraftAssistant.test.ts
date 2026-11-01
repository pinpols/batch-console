// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import MappingDraftAssistant from './MappingDraftAssistant.vue'

const mocks = vi.hoisted(() => ({ draft: vi.fn() }))
vi.mock('@/api/system', () => ({ draftFileTemplateMapping: mocks.draft }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
enableAutoUnmount(afterEach)
beforeEach(() => mocks.draft.mockReset())

function setup() {
  return mount(MappingDraftAssistant, {
    props: { tenantId: 'tenant-a', direction: 'IMPORT', canApply: true },
    global: {
      stubs: {
        ElCollapse: { template: '<div><slot /></div>' },
        ElCollapseItem: { template: '<div><slot /></div>' },
        ElForm: { template: '<div><slot /></div>' },
        ElFormItem: { template: '<label><slot /></label>' },
        ElInput: {
          props: ['modelValue'],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        ElButton: {
          props: ['disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
        ElAlert: true,
      },
    },
  })
}

async function fillAndGenerate(wrapper: ReturnType<typeof setup>) {
  const inputs = wrapper.findAll('input')
  await inputs[1].setValue('orders')
  await inputs[2].setValue('order_id')
  await inputs[3].setValue('id')
  const button = wrapper
    .findAll('button')
    .find((item) => item.text() === 'fileTemplateList.mappingGenerate')
  await button!.trigger('click')
}

describe('file template mapping assistant', () => {
  it('explains that export SQL must scope tenant and batch before generating a draft', async () => {
    const wrapper = setup()
    expect(wrapper.find('el-alert-stub').exists()).toBe(false)
    await wrapper.setProps({ direction: 'EXPORT' })
    expect(wrapper.get('el-alert-stub').attributes('title')).toBe(
      'fileTemplateMappingHelp.exportSqlRequired',
    )
  })

  it('requests a tenant-scoped backend draft and applies it only on explicit confirmation', async () => {
    const result = {
      direction: 'IMPORT',
      fieldMappingsJson: '[{"name":"order_id"}]',
      queryParamSchemaJson: '{"jdbcMappedImport":{"table":"orders"}}',
      warnings: [],
    }
    mocks.draft.mockResolvedValue(result)
    const wrapper = setup()
    await fillAndGenerate(wrapper)
    await flushPromises()
    expect(mocks.draft).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      direction: 'IMPORT',
      tableName: 'orders',
      schemaName: undefined,
      fields: [{ sourceColumn: 'order_id', targetColumn: 'id' }],
    })
    expect(wrapper.emitted('apply')).toBeUndefined()
    const button = wrapper
      .findAll('button')
      .find((item) => item.text() === 'fileTemplateList.mappingApply')
    await button!.trigger('click')
    expect(wrapper.emitted('apply')).toEqual([[result]])
  })

  it('discards an in-flight draft after a tenant change or existing configuration', async () => {
    let resolve!: (value: object) => void
    mocks.draft.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const wrapper = setup()
    await fillAndGenerate(wrapper)
    await wrapper.setProps({ tenantId: 'tenant-b', canApply: false })
    resolve({ fieldMappingsJson: '[]', queryParamSchemaJson: '{}' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('fileTemplateList.mappingApply')
    expect(wrapper.emitted('apply')).toBeUndefined()
  })
})
