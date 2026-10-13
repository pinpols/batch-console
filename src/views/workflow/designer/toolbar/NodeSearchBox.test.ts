// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import NodeSearchBox from './NodeSearchBox.vue'
import { useDesignerStore } from '../store/useDesignerStore'

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      workflowDesignerSearch: {
        placeholder: '搜索节点',
        noMatch: '无匹配节点',
        noData: '暂无节点',
      },
    },
  },
})

const SelectStub = defineComponent({
  name: 'ElSelect',
  props: ['modelValue'],
  emits: ['change', 'clear'],
  template: '<div class="select-stub" :data-value="modelValue"><slot /></div>',
})

describe('NodeSearchBox', () => {
  it('echoes the selected workflow node and clears with the canvas selection', async () => {
    setActivePinia(createPinia())
    const store = useDesignerStore()
    store.nodes.push({
      id: 'job-a',
      nodeCode: 'job-a',
      nodeName: 'Import data',
      nodeType: 'JOB',
      x: 0,
      y: 0,
      attrs: {},
    })
    const wrapper = mount(NodeSearchBox, {
      global: { plugins: [i18n], stubs: { ElSelect: SelectStub, ElOption: true } },
    })
    const select = wrapper.findComponent(SelectStub)

    select.vm.$emit('change', 'job-a')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('focus')).toEqual([['job-a']])
    expect(select.attributes('data-value')).toBe('')

    store.setSelection(['job-a'])
    await wrapper.vm.$nextTick()
    expect(select.attributes('data-value')).toBe('job-a')

    select.vm.$emit('clear')
    await wrapper.vm.$nextTick()
    expect(store.selectedIds.size).toBe(0)
    expect(select.attributes('data-value')).toBe('')
  })
})
