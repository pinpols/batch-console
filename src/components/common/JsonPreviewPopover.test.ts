// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import JsonPreviewPopover from './JsonPreviewPopover.vue'

const hide = vi.hoisted(() => vi.fn())

describe('JsonPreviewPopover', () => {
  it('closes an open preview with Escape from the trigger and content', async () => {
    hide.mockReset()
    const wrapper = mount(JsonPreviewPopover, {
      props: { data: { status: 'READY' } },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'zh-CN',
            messages: { 'zh-CN': { common: { viewJson: '查看 JSON' } } },
          }),
        ],
        stubs: {
          ElPopover: {
            name: 'ElPopover',
            setup(_props, { expose }) {
              expose({ hide })
            },
            template: '<div><slot name="reference" /><slot /></div>',
          },
          ElIcon: { template: '<span><slot /></span>' },
          JsonPreview: { template: '<div />' },
        },
      },
    })
    const popover = wrapper.getComponent({ name: 'ElPopover' })
    popover.vm.$emit('before-enter')
    await wrapper.get('button').trigger('keydown', { key: 'Escape' })
    expect(hide).toHaveBeenCalledOnce()
    popover.vm.$emit('before-enter')
    await wrapper.get('.json-preview-popover__content').trigger('keydown', { key: 'Escape' })
    expect(hide).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })
})
