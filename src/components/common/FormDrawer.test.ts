// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import FormDrawer from './FormDrawer.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

// 只保留 el-drawer 的 header / default / footer 插槽与 size、before-close 契约
const ElDrawerStub = defineComponent({
  name: 'ElDrawer',
  props: {
    modelValue: Boolean,
    size: [String, Number],
    beforeClose: Function,
    closeOnClickModal: Boolean,
  },
  setup(props, { slots }) {
    return () =>
      props.modelValue
        ? h('div', { class: 'drawer-stub', 'data-size': String(props.size) }, [
            h('div', { class: 'stub-header' }, slots.header?.({ titleId: 't1', titleClass: 'tc' })),
            h('div', { class: 'stub-body' }, slots.default?.()),
            h('div', { class: 'stub-footer' }, slots.footer?.()),
          ])
        : null
  },
})

const ElButtonStub = defineComponent({
  name: 'ElButton',
  props: { type: String, loading: Boolean, disabled: Boolean },
  emits: ['click'],
  setup(props, { slots, emit }) {
    return () =>
      h(
        'button',
        {
          class: ['btn', props.type ? `btn--${props.type}` : 'btn--default'],
          disabled: props.disabled || props.loading,
          onClick: () => emit('click'),
        },
        slots.default?.(),
      )
  },
})

function mountDrawer(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(FormDrawer, {
    props: { visible: true, title: '新增 Webhook', ...props },
    slots: { default: '<div class="field">body</div>', ...slots },
    global: { stubs: { ElDrawer: ElDrawerStub, ElButton: ElButtonStub } },
  })
}

describe('FormDrawer', () => {
  it('标题、说明和正文都在抽屉内，默认中档宽度', () => {
    const wrapper = mountDrawer({ description: '回调地址需可从平台访问' })
    expect(wrapper.find('.stub-header').text()).toContain('新增 Webhook')
    expect(wrapper.find('.stub-header').text()).toContain('回调地址需可从平台访问')
    expect(wrapper.find('.field').exists()).toBe(true)
    expect(wrapper.find('.drawer-stub').attributes('data-size')).toBe('640px')
  })

  it('宽度只接受三档', () => {
    expect(mountDrawer({ size: 'sm' }).find('.drawer-stub').attributes('data-size')).toBe('480px')
    expect(mountDrawer({ size: 'lg' }).find('.drawer-stub').attributes('data-size')).toBe('880px')
  })

  it('取消在前、主操作在后；点主操作发出 submit', async () => {
    const wrapper = mountDrawer({ submitText: '创建' })
    const buttons = wrapper.findAll('.stub-footer button')
    expect(buttons.map((b) => b.text())).toEqual(['common.cancel', '创建'])
    await buttons[1].trigger('click')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('保存中不重复提交，也不能关闭', async () => {
    const wrapper = mountDrawer({ saving: true })
    const [cancel, submit] = wrapper.findAll('.stub-footer button')
    expect(cancel.attributes('disabled')).toBeDefined()
    expect(submit.attributes('disabled')).toBeDefined()
    // 直接调用组件对外暴露的提交入口也被拦截
    ;(wrapper.vm as unknown as { submit: () => void }).submit()
    expect(wrapper.emitted('submit')).toBeUndefined()

    const drawer = wrapper.findComponent(ElDrawerStub)
    let closed = false
    ;(drawer.props('beforeClose') as (done: () => void) => void)(() => {
      closed = true
    })
    expect(closed).toBe(false)
  })

  it('点取消关闭抽屉并发出 cancel', async () => {
    const wrapper = mountDrawer()
    await wrapper.findAll('.stub-footer button')[0].trigger('click')
    expect(wrapper.emitted('update:visible')?.[0]).toEqual([false])
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('只读模式只有关闭按钮', () => {
    const wrapper = mountDrawer({ readonly: true })
    const buttons = wrapper.findAll('.stub-footer button')
    expect(buttons.map((b) => b.text())).toEqual(['common.close'])
  })

  it('footer-extra 插槽放在按钮左侧', () => {
    const wrapper = mountDrawer({}, { 'footer-extra': '<span class="extra">测试连接</span>' })
    const footer = wrapper.find('.stub-footer')
    expect(footer.find('.form-drawer__footer-extra .extra').exists()).toBe(true)
  })
})
