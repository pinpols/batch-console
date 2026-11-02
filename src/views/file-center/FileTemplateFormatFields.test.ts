// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ElButton } from 'element-plus'
import FileTemplateFormatFields from './FileTemplateFormatFields.vue'

describe('FileTemplateFormatFields', () => {
  it('保留格式字段并在格式和高级设置切换后继续编辑', async () => {
    const wrapper = mount(FileTemplateFormatFields, {
      props: {
        fileFormatType: 'DELIMITED',
        delimiter: ',',
        lineSeparator: '\\n',
        charset: 'UTF-8',
        targetCharset: 'UTF-8',
        withBom: false,
        showAdvanced: false,
      },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'zh-CN',
            messages: { 'zh-CN': { fileTemplateList: {} } },
            missingWarn: false,
            fallbackWarn: false,
          }),
        ],
        components: { ElButton },
        stubs: {
          ElFormItem: { template: '<div><slot /></div>' },
          ElInput: {
            props: ['modelValue', 'maxlength'],
            emits: ['update:modelValue'],
            template:
              '<input :value="modelValue" :maxlength="maxlength" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          ElCheckbox: { template: '<input type="checkbox" />' },
          MetaSelect: { template: '<div />' },
        },
      },
    })
    expect(wrapper.findAll('input')).toHaveLength(2)
    await wrapper.setProps({ fileFormatType: 'FIXED_WIDTH' })
    expect(wrapper.findAll('input')).toHaveLength(0)
    await wrapper.setProps({ fileFormatType: 'DELIMITED' })
    expect(wrapper.findAll('input')[0].element.value).toBe(',')
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:showAdvanced')?.[0]).toEqual([true])
    await wrapper.setProps({ showAdvanced: true })
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true')
    const inputs = wrapper.findAll('input')
    expect(inputs[2].element.value).toBe('UTF-8')
    await inputs[2].setValue('GB18030')
    expect(wrapper.emitted('update:charset')?.[0]).toEqual(['GB18030'])
  })
})
