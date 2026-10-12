// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import JsonTextareaInput from './JsonTextareaInput.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      jsonTextareaInput: {
        chooseFile: '选择 JSON 文件',
        dropOrPasteHint: '或拖入文件',
        validPrefix: 'JSON 合法',
        placeholder: '输入 JSON',
        expectArray: '期望根是 JSON 数组',
        expectObject: '期望根是 JSON 对象',
        summaryArray: '数组 {n} 项',
        summaryObject: '对象 {n} 字段',
        summaryValue: '{type} 值',
        onlyJsonFile: '仅支持 JSON 文件',
        unknownFile: '未知',
        fileTooLarge: '文件过大',
        loaded: '已加载文件',
        readFailed: '读取失败',
      },
      common: { clear: '清空' },
    },
  },
})

function factory(props: { modelValue?: string; initializeDefault?: boolean } = {}) {
  return mount(JsonTextareaInput, {
    props,
    global: {
      plugins: [i18n],
      stubs: {
        ElInput: true,
        ElButton: true,
        ElIcon: true,
      },
    },
  })
}

describe('JsonTextareaInput', () => {
  it('retains the default JSON seed for existing form callers', () => {
    const wrapper = factory({ modelValue: '', initializeDefault: true })

    expect(wrapper.emitted('update:modelValue')).toEqual([['{}']])
  })

  it('keeps import input empty when default initialization is disabled', () => {
    const wrapper = factory({ modelValue: '', initializeDefault: false })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
