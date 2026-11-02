// @vitest-environment jsdom

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { ElForm } from 'element-plus'
import { defineComponent, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useTenantStore } from '@/stores/tenant'
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
        parseError: 'JSON 格式无效：{detail}',
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
    'en-US': {
      jsonTextareaInput: { parseError: 'Invalid JSON: {detail}' },
      common: { clear: 'Clear' },
    },
  },
})

function factory(
  props: { modelValue?: string; initializeDefault?: boolean; disabled?: boolean } = {},
) {
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
  it.each([
    { locale: 'zh-CN', prefix: 'JSON 格式无效：' },
    { locale: 'en-US', prefix: 'Invalid JSON:' },
  ] as const)('本地化解析错误并保留浏览器提供的定位详情（$locale）', ({ locale, prefix }) => {
    let detail = ''
    try {
      JSON.parse('{')
    } catch (error) {
      detail = (error as Error).message.replace(/^JSON\.parse: /, '')
    }
    i18n.global.locale.value = locale
    const wrapper = factory({ modelValue: '{' })
    expect(wrapper.get('.json-textarea-input__parse-err').text()).toContain(prefix)
    expect(wrapper.get('.json-textarea-input__parse-err').text()).toContain(detail)
    wrapper.unmount()
    i18n.global.locale.value = 'zh-CN'
  })

  it('retains the default JSON seed for existing form callers', () => {
    const wrapper = factory({ modelValue: '', initializeDefault: true })

    expect(wrapper.emitted('update:modelValue')).toEqual([['{}']])
  })

  it('keeps import input empty when default initialization is disabled', () => {
    const wrapper = factory({ modelValue: '', initializeDefault: false })

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('禁用时不接受拖放或文件粘贴，也不初始化默认值', async () => {
    const wrapper = factory({ modelValue: '', disabled: true })
    const file = Object.assign(new File(['{}'], 'draft.json', { type: 'application/json' }), {
      text: vi.fn().mockResolvedValue('{}'),
    })
    await wrapper.trigger('dragenter')
    expect(wrapper.classes()).not.toContain('json-textarea-input--dragover')
    await wrapper.trigger('drop', { dataTransfer: { files: [file] } })
    await wrapper.trigger('paste', { clipboardData: { files: [file] } })
    await flushPromises()
    expect(file.text).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('file-loaded')).toBeUndefined()
  })

  it('继承父级 ElForm 禁用状态并阻止默认初始化和文件导入', async () => {
    const Parent = defineComponent({
      components: { ElForm, JsonTextareaInput },
      setup: () => ({ disabled: ref(true) }),
      template: '<ElForm :disabled="disabled"><JsonTextareaInput model-value="" /></ElForm>',
    })
    const wrapper = mount(Parent, {
      global: { plugins: [i18n], stubs: { ElInput: true, ElButton: true, ElIcon: true } },
    })
    const input = wrapper.getComponent(JsonTextareaInput)
    const file = Object.assign(new File(['{}'], 'draft.json'), {
      text: vi.fn().mockResolvedValue('{}'),
    })
    await input.trigger('drop', { dataTransfer: { files: [file] } })
    await flushPromises()
    expect(file.text).not.toHaveBeenCalled()
    expect(input.emitted('update:modelValue')).toBeUndefined()
  })

  it('读取期间进入禁用状态后，即使重新启用也不回写旧文件', async () => {
    const wrapper = factory({ modelValue: '', initializeDefault: false })
    let resolve!: (value: string) => void
    const file = Object.assign(new File(['{}'], 'draft.json'), {
      text: vi.fn(
        () =>
          new Promise<string>((done) => {
            resolve = done
          }),
      ),
    })
    await wrapper.trigger('drop', { dataTransfer: { files: [file] } })
    await wrapper.setProps({ disabled: true })
    await wrapper.setProps({ disabled: false })
    resolve('{"stale":true}')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('file-loaded')).toBeUndefined()
  })

  it('文件读取期间手工编辑不会被旧文件覆盖', async () => {
    const wrapper = factory({ modelValue: '', initializeDefault: false })
    let resolve!: (value: string) => void
    const file = Object.assign(new File(['{}'], 'draft.json'), {
      text: vi.fn(
        () =>
          new Promise<string>((done) => {
            resolve = done
          }),
      ),
    })
    await wrapper.trigger('drop', { dataTransfer: { files: [file] } })
    wrapper.getComponent({ name: 'ElInput' }).vm.$emit('update:modelValue', '{"typed":true}')
    resolve('{"stale":true}')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([['{"typed":true}']])
    expect(wrapper.emitted('file-loaded')).toBeUndefined()
  })

  it('文件读取期间父级更新内容不会被旧文件覆盖', async () => {
    const wrapper = factory({ modelValue: '', initializeDefault: false })
    let resolve!: (value: string) => void
    const file = Object.assign(new File(['{}'], 'draft.json'), {
      text: vi.fn(
        () =>
          new Promise<string>((done) => {
            resolve = done
          }),
      ),
    })
    await wrapper.trigger('drop', { dataTransfer: { files: [file] } })
    await wrapper.setProps({ modelValue: '{"updated":true}' })
    resolve('{"stale":true}')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('file-loaded')).toBeUndefined()
  })

  it('读取期间组件卸载后不再回写', async () => {
    const wrapper = factory({ modelValue: '', initializeDefault: false })
    let resolve!: (value: string) => void
    const file = Object.assign(new File(['{}'], 'draft.json'), {
      text: vi.fn(
        () =>
          new Promise<string>((done) => {
            resolve = done
          }),
      ),
    })
    await wrapper.trigger('drop', { dataTransfer: { files: [file] } })
    wrapper.unmount()
    resolve('{"stale":true}')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('file-loaded')).toBeUndefined()
  })

  it('读取 JSON 时取消切租户保留读取，确认切换并返回后拒绝旧文件', async () => {
    setActivePinia(createPinia())
    const tenant = useTenantStore()
    tenant.setTenantId('ta')
    const wrapper = factory({ modelValue: '', initializeDefault: false })
    let resolve!: (value: string) => void
    const file = Object.assign(new File(['{}'], 'draft.json'), {
      text: vi.fn(
        () =>
          new Promise<string>((done) => {
            resolve = done
          }),
      ),
    })
    await wrapper.trigger('drop', { dataTransfer: { files: [file] } })
    expect(await tenant.requestTenantSwitch('tb', async () => false)).toBe(false)
    expect(await tenant.requestTenantSwitch('tb', async () => true)).toBe(true)
    expect(await tenant.requestTenantSwitch('ta', async () => true)).toBe(true)
    resolve('{"old":true}')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('file-loaded')).toBeUndefined()
    wrapper.unmount()
    setActivePinia(undefined)
  })

  it('启用时仍可通过拖放导入 JSON', async () => {
    const wrapper = factory({ modelValue: '', initializeDefault: false })
    const file = Object.assign(new File(['{}'], 'draft.json'), {
      text: vi.fn().mockResolvedValue('{"ok":true}'),
    })
    await wrapper.trigger('drop', { dataTransfer: { files: [file] } })
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([['{"ok":true}']])
    expect(wrapper.emitted('file-loaded')).toEqual([[file]])
  })
})
