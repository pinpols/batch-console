// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import ListPageQueryBar from './ListPageQueryBar.vue'
import OpsFilterToolbar from './OpsFilterToolbar.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRoute: () => ({ path: '/query-bar-test' }) }))

const stubs = {
  ElForm: { template: '<form class="el-form--inline"><slot /></form>' },
  ElFormItem: { template: '<div class="el-form-item"><slot /></div>' },
  ElButton: { template: '<button><slot /></button>' },
  ElIcon: { template: '<span><slot /></span>' },
}

describe('列表筛选工具栏', () => {
  it('字段数量变化不会改变默认标签布局，显式左侧标签仍可使用', async () => {
    const count = ref(1)
    const wrapper = mount(ListPageQueryBar, {
      props: { collapsible: false },
      slots: {
        default: () =>
          Array.from({ length: count.value }, () => h('div', { class: 'el-form-item' }, '字段')),
      },
      global: { stubs },
    })

    expect(wrapper.classes()).not.toContain('query-form--label-left')
    count.value = 4
    await nextTick()
    expect(wrapper.classes()).not.toContain('query-form--label-left')
    await wrapper.setProps({ labelPosition: 'left' })
    expect(wrapper.classes()).toContain('query-form--label-left')
  })

  it('列表与运维筛选的操作顺序一致，并分别发出原有事件', async () => {
    const options = { global: { stubs } }
    const list = mount(ListPageQueryBar, { ...options, props: { collapsible: false } })
    const ops = mount(OpsFilterToolbar, options)
    for (const wrapper of [list, ops]) {
      const buttons = wrapper.findAll('button')
      expect(buttons.map((button) => button.text())).toEqual([
        'common.search',
        'common.reset',
        'common.refresh',
      ])
      await buttons[1].trigger('click')
      await buttons[2].trigger('click')
      expect(wrapper.emitted('reset')).toHaveLength(1)
      expect(wrapper.emitted('refresh')).toHaveLength(1)
    }
    await list.find('form').trigger('submit')
    await ops.findAll('button')[0].trigger('click')
    expect(list.emitted('search')).toHaveLength(1)
    expect(ops.emitted('search')).toHaveLength(1)
  })
})
